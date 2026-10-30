

const ReviewHelpers = {
    
    getDefaultAvatarSvg() {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23CBD5E1'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
    },

    
    createAvatarHtml(avatarUrl, name) {
        const avatarStyles = 'width: 50px; height: 50px; min-width: 50px; min-height: 50px; border-radius: 50%; object-fit: cover; margin-right: 15px; flex-shrink: 0;';
        const containerStyles = 'width: 50px; height: 50px; min-width: 50px; min-height: 50px; border-radius: 50%; background: #F8FAFC; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;';
        const defaultImgStyles = 'width: 60%; height: 60%; object-fit: contain; opacity: 0.8;';

        if (avatarUrl) {
            return `<img src="${avatarUrl}" alt="${name}" style="${avatarStyles}" onerror="this.onerror=null; this.parentNode.innerHTML='<div style=\\'${containerStyles}\\'><img src=\\'${this.getDefaultAvatarSvg()}\\' style=\\'${defaultImgStyles}\\'></div>'">`;
        }

        return `<div style="${containerStyles}"><img src="${this.getDefaultAvatarSvg()}" alt="Avatar par défaut" style="${defaultImgStyles}"></div>`;
    },

    
    createStarsHtml(rating) {
        return Array(5).fill(0).map((_, i) =>
            `<i class="${i < rating ? 'fas' : 'far'} fa-star"></i>`
        ).join('');
    },

    
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    
    createReviewElement(review) {
        const article = document.createElement('article');
        article.className = 'review-item fade-in-up';

        const stars = this.createStarsHtml(review.rating);
        const date = this.formatDate(review.created_at);
        const avatarHtml = this.createAvatarHtml(review.avatar_url, review.name);

        article.innerHTML = `
            <div class="review-header">
                <div style="display: flex; align-items: center;">
                    ${avatarHtml}
                    <div class="review-author">
                        <h4>${review.name}</h4>
                        ${review.role ? `<span class="review-role">${review.role}</span>` : ''}
                    </div>
                </div>
                <div class="review-stars">${stars}</div>
            </div>
            <p class="review-content">${review.message}</p>
            <span class="review-date">Posté le ${date}</span>
        `;

        return article;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReviewHelpers;
}
