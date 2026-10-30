

const ReviewsManager = (function () {
    'use strict';

    let reviews = [];
    const tableBody = document.getElementById('reviewsTableBody');
    const emptyState = document.getElementById('reviewsEmpty');

    
    function init() {
        loadReviews();
    }

    
    async function loadReviews() {
        const client = AdminAuth.getClient();
        if (!client) return;

        try {
            const { data, error } = await client
                .from('reviews')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            reviews = data || [];
            renderReviews(reviews);
            updateStats();

        } catch (err) {
            console.error('Erreur chargement avis:', err);
            Toast.error('Erreur', 'Impossible de charger les avis');
        }
    }

    
    function renderReviews(data) {
        if (!tableBody) return;

        if (!data.length) {
            tableBody.innerHTML = '';
            emptyState && (emptyState.hidden = false);
            return;
        }

        emptyState && (emptyState.hidden = true);

        tableBody.innerHTML = data.map(review => `
            <tr data-id="${review.id}">
                <td>
                    <div class="review-client">
                        ${review.avatar_url
                ? `<img src="${review.avatar_url}" alt="${review.name}" class="client-avatar">`
                : `<div class="client-avatar-placeholder">${getInitials(review.name)}</div>`
            }
                        <div class="client-info">
                            <div class="client-name">${escapeHtml(review.name)}</div>
                            ${review.role ? `<div class="client-role">${escapeHtml(review.role)}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <div class="review-message text-truncate">
                        ${escapeHtml(review.message)}
                    </div>
                </td>
                <td>
                    <div class="rating-stars">
                        ${renderStars(review.rating)}
                    </div>
                </td>
                <td>${formatDate(review.created_at)}</td>
            </tr>
        `).join('');
    }

    
    function updateStats() {
        const statReviews = document.getElementById('statReviews');
        if (statReviews) {
            statReviews.textContent = reviews.length;
        }
    }

    
    function renderStars(rating) {
        const fullStars = Math.floor(rating);
        const emptyStars = 5 - fullStars;

        return '<i class="fas fa-star"></i>'.repeat(fullStars) +
            '<i class="fas fa-star empty"></i>'.repeat(emptyStars);
    }

    
    function getInitials(name) {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    return {
        init,
        loadReviews
    };
})();

window.ReviewsManager = ReviewsManager;
