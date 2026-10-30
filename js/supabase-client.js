

(function () {
    let supabaseInstance;

    try {
        if (window.supabase && window.supabase.createClient) {
            const { createClient } = window.supabase;
            supabaseInstance = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.KEY);
            window.globalSupabaseClient = supabaseInstance; // Expose globally to prevent multiple instances
        } else {
            console.error("Le SDK Supabase n'est pas chargé.");
        }
    } catch (error) {
        console.error("Erreur lors de l'initialisation de Supabase:", error);
    }

    const SupabaseService = {
        
        async getReviews() {
            if (!supabaseInstance) {
                console.warn("Supabase non initialisé.");
                return { data: null, error: "Supabase non initialisé" };
            }

            try {
                const { data, error } = await supabaseInstance
                    .from('reviews')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                return { data, error };
            } catch (err) {
                console.error("Erreur connexion Supabase:", err);
                return { data: null, error: err };
            }
        },

        
        async addReview(review, imageFile) {
            if (!supabaseInstance) return { data: null, error: "Supabase non initialisé" };

            let avatarUrl = null;

            if (imageFile && imageFile.size > 0) {
                const fileExt = imageFile.name.split('.').pop();
                const sanitizedName = review.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const fileName = `${sanitizedName}_${Date.now()}.${fileExt}`;
                const filePath = `${fileName}`;

                const { data: uploadData, error: uploadError } = await supabaseInstance.storage
                    .from('avatars')
                    .upload(filePath, imageFile);

                if (uploadError) {
                    console.error('Erreur upload:', uploadError);
                } else {
                    const { data: { publicUrl } } = supabaseInstance.storage
                        .from('avatars')
                        .getPublicUrl(filePath);

                    avatarUrl = publicUrl;
                }
            }

            const { data, error } = await supabaseInstance
                .from('reviews')
                .insert([
                    {
                        name: review.name,
                        role: review.role,
                        message: review.message,
                        rating: review.rating,
                        avatar_url: avatarUrl // Nouvelle colonne
                    }
                ])
                .select();

            return { data, error };
        },

        
        subscribeToReviews(onInsert) {
            if (!supabaseInstance) return;

            supabaseInstance
                .channel('public:reviews')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, (payload) => {
                    onInsert(payload.new);
                })
                .subscribe();
        }
    };

    window.SupabaseService = SupabaseService;
    console.log('SupabaseService initialisé et exposé globalement.');

    window.dispatchEvent(new Event('SupabaseReady'));
    console.log('Événement SupabaseReady déclenché.');
})();
