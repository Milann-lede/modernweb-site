

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof emailjs !== 'undefined' && typeof EMAILJS_CONFIG !== 'undefined') {
        emailjs.init({ publicKey: EMAILJS_CONFIG.REVIEW_PUBLIC_KEY });
    }

    const reviewsList = document.getElementById('reviews-list');
    const reviewForm = document.getElementById('review-form');

    
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    
    function sanitizeAvatarUrl(url) {
        if (!url) return '';
        if (url.startsWith('https://') || url.startsWith('data:image/')) return url;
        return ''; // URL non sûre
    }

    
    function createReviewElement(review) {
        const div = document.createElement('article');
        div.className = 'review-item fade-in-up';

        const safeRating = Math.max(0, Math.min(5, parseInt(review.rating) || 0));
        const stars = Array(5).fill(0).map((_, i) =>
            `<i class="${i < safeRating ? 'fas' : 'far'} fa-star"></i>`
        ).join('');

        const date = new Date(review.created_at).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const safeName = escapeHtml(review.name);
        const safeRole = escapeHtml(review.role);
        const safeMessage = escapeHtml(review.message);
        const safeAvatarUrl = sanitizeAvatarUrl(review.avatar_url);

        let avatarHtml = '';
        if (safeAvatarUrl) {
            avatarHtml = `<img src="${safeAvatarUrl}" alt="${safeName}" style="width: 50px; height: 50px; min-width: 50px; min-height: 50px; border-radius: 50%; object-fit: cover; margin-right: 15px; flex-shrink: 0;" onerror="this.onerror=null; this.parentNode.innerHTML='<div style=\'width: 50px; height: 50px; min-width: 50px; min-height: 50px; border-radius: 50%; background: #F8FAFC; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;\'><img src=\'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23CBD5E1\'%3E%3Cpath d=\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\'/%3E%3C/svg%3E\' style=\'width: 60%; height: 60%; object-fit: contain; opacity: 0.8;\'></div>'">`;
        } else {
            const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23CBD5E1'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
            avatarHtml = `<div style="width: 50px; height: 50px; min-width: 50px; min-height: 50px; border-radius: 50%; background: #F8FAFC; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;"><img src="${defaultAvatar}" alt="Default Avatar" style="width: 60%; height: 60%; object-fit: contain; opacity: 0.8;"></div>`;
        }

        div.innerHTML = `
            <div class="review-header">
                <div class="review-header-left">
                    ${avatarHtml}
                    <div class="review-author">
                        <h4>${safeName}</h4>
                        ${safeRole ? `<span class="review-role">${safeRole}</span>` : ''}
                    </div>
                </div>
                <div class="review-stars">${stars}</div>
            </div>
            <p class="review-content ${safeMessage.length > 120 ? 'clamped' : ''}">${safeMessage}</p>
            ${safeMessage.length > 120 ? `<button class="read-more-btn" onclick="toggleReview(this)">Lire la suite</button>` : ''}
            <span class="review-date">Posté le ${date}</span>
        `;
        return div;
    }

    if (!window.toggleReview) {
        window.toggleReview = function (btn) {
            const content = btn.previousElementSibling;
            content.classList.toggle('clamped');
            btn.textContent = content.classList.contains('clamped') ? 'Lire la suite' : 'Réduire';
        };
    }

    const { data: reviews, error } = await SupabaseService.getReviews();

    if (error) {
        reviewsList.innerHTML = `<p class="text-center text-danger">Erreur lors du chargement des avis. Veuillez vérifier la configuration.</p>`;
        console.error(error);
    } else {
        reviewsList.innerHTML = ''; // Vider le loader
        if (reviews.length === 0) {
            reviewsList.innerHTML = '<p class="text-center">Soyez le premier à donner votre avis !</p>';
        } else {
            reviews.forEach(review => {
                reviewsList.appendChild(createReviewElement(review));
            });
        }
    }

    SupabaseService.subscribeToReviews((newReview) => {
        if (reviewsList.querySelector('p.text-center')) {
            reviewsList.innerHTML = '';
        }
        const newElement = createReviewElement(newReview);
        reviewsList.insertBefore(newElement, reviewsList.firstChild);
    });

    if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = reviewForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Envoi en cours...';

            const formData = new FormData(reviewForm);
            const newReview = {
                name: formData.get('name'),
                role: formData.get('role'),
                message: formData.get('message'),
                rating: parseInt(formData.get('rating'))
            };

            const imageFile = formData.get('avatar'); // Récupérer le fichier

            const { data, error } = await SupabaseService.addReview(newReview, imageFile);

            if (error) {
                alert('Erreur lors de l\'envoi de l\'avis : ' + error.message);
            } else {
                const modal = document.getElementById('success-modal');
                modal.classList.add('active');

                const insertedReview = data[0]; // Get the inserted review data
                const emailParams = {
                    from_name: newReview.name,
                    reply_to: 'no-reply@modernweb.fr',
                    email: 'contact@modernweb.fr', // Destinataire principal (IONOS)
                    to_email: 'contact@modernweb.fr', // Variable souvent utilisée pour le destinataire dynamique
                    subject: `Nouvel Avis Client : ${newReview.rating}/5 ⭐`,
                    type_demande: 'Avis Client',
                    message: `
Nouvel avis reçu sur le site !

👤 Nom : ${newReview.name}
💼 Poste/Entreprise : ${newReview.role || 'Non renseigné'}
⭐ Note : ${newReview.rating}/5

💬 Message :
${newReview.message}

🖼️ Photo : ${insertedReview.avatar_url ? insertedReview.avatar_url : 'Aucune photo'}
                    `
                };

                emailjs.send(EMAILJS_CONFIG.REVIEW_SERVICE_ID, EMAILJS_CONFIG.REVIEW_TEMPLATE_ID, emailParams, EMAILJS_CONFIG.REVIEW_PUBLIC_KEY)
                    .then(() => {
                        console.log('Email de notification envoyé !');
                    })
                    .catch((err) => {
                        console.error('Erreur envoi email:', err);
                    });

                reviewForm.reset();

                const fileNameSpan = document.getElementById('file-name');
                const fileWrapper = document.querySelector('.file-upload-wrapper');
                if (fileNameSpan) fileNameSpan.textContent = 'Choisir une photo';
                if (fileWrapper) {
                    const preview = fileWrapper.querySelector('.avatar-preview');
                    if (preview) preview.remove();

                    fileWrapper.style.borderColor = '#CBD5E1';
                    fileWrapper.style.background = 'rgba(255, 255, 255, 0.5)';
                }
            }

            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        });

        const fileInput = document.getElementById('avatar');
        const fileNameSpan = document.getElementById('file-name');
        const fileWrapper = document.querySelector('.file-upload-wrapper');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    fileNameSpan.textContent = file.name;

                    const reader = new FileReader();
                    reader.onload = function (e) {
                        let previewImg = fileWrapper.querySelector('.avatar-preview');
                        if (!previewImg) {
                            previewImg = document.createElement('img');
                            previewImg.className = 'avatar-preview';
                            previewImg.style.width = '45px';
                            previewImg.style.height = '45px';
                            previewImg.style.borderRadius = '50%';
                            previewImg.style.objectFit = 'cover';

                            previewImg.style.position = 'absolute';
                            previewImg.style.left = '15px';
                            previewImg.style.top = '50%';
                            previewImg.style.transform = 'translateY(-50%)';

                            previewImg.style.border = '2px solid white';
                            previewImg.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';

                            fileWrapper.appendChild(previewImg);
                        }
                        previewImg.style.cursor = 'zoom-in';
                        previewImg.onclick = function (e) {
                            e.stopPropagation();
                            if (typeof openAvatarLightbox === 'function') {
                                openAvatarLightbox(e.target.src);
                            }
                        };
                        previewImg.src = e.target.result;
                    }
                    reader.readAsDataURL(file);

                    fileWrapper.style.borderColor = 'var(--primary)';
                    fileWrapper.style.background = 'rgba(37, 99, 235, 0.05)';
                } else {
                    fileNameSpan.textContent = 'Choisir une photo';
                    const preview = fileWrapper.querySelector('.avatar-preview');
                    if (preview) preview.remove();

                    fileWrapper.style.borderColor = '#CBD5E1';
                    fileWrapper.style.background = 'rgba(255, 255, 255, 0.5)';
                }
            });
        }
    }

    window.closeModal = function () {
        const modal = document.getElementById('success-modal');
        modal.classList.remove('active');
    }

    var successModal = document.getElementById('success-modal');
    if (successModal) {
        successModal.querySelectorAll('.modal-close-btn, .btn-primary').forEach(function(btn) {
            btn.addEventListener('click', window.closeModal);
        });
    }

    window.openAvatarLightbox = function (src) {
        let lightbox = document.getElementById('avatar-lightbox');
        if (!lightbox) {
            lightbox = document.createElement('div');
            lightbox.id = 'avatar-lightbox';
            lightbox.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.3s ease;
                cursor: zoom-out;
                backdrop-filter: blur(5px);
            `;
            const img = document.createElement('img');
            img.style.cssText = `
                max-width: 90%;
                max-height: 90%;
                border-radius: 12px;
                box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                transform: scale(0.9);
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            `;
            lightbox.appendChild(img);

            lightbox.onclick = function () {
                lightbox.style.opacity = '0';
                lightbox.querySelector('img').style.transform = 'scale(0.9)';
                setTimeout(() => {
                    lightbox.style.display = 'none';
                }, 300);
            };
            document.body.appendChild(lightbox);
        }

        const img = lightbox.querySelector('img');
        img.src = src;
        lightbox.style.display = 'flex';
        lightbox.offsetHeight;
        lightbox.style.opacity = '1';
        img.style.transform = 'scale(1)';
    }

    if (reviewsList) {
        reviewsList.addEventListener('click', (e) => {
            if (e.target.tagName === 'IMG' && e.target.closest('.review-header')) {
                openAvatarLightbox(e.target.src);
            }
        });

        const style = document.createElement('style');
        style.innerHTML = `
            .review-header img { cursor: zoom-in; transition: transform 0.2s; }
            .review-header img:hover { transform: scale(1.1); }
        `;
        document.head.appendChild(style);
    }
});
