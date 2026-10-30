

document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    loadHomeReviews();
    initPortfolioFilters();
    initProjectModal();
});

function initMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (!hamburger || !navLinks) return;

    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        const isActive = navLinks.classList.contains('active');
        toggleHamburgerIcon(hamburger, isActive);
        hamburger.setAttribute('aria-expanded', isActive);
    });

    hamburger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            hamburger.click();
        }
    });

    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            toggleHamburgerIcon(hamburger, false);
            hamburger.setAttribute('aria-expanded', 'false');
        });
    });
}

function toggleHamburgerIcon(hamburger, isOpen) {
    const icon = hamburger.querySelector('i');
    if (!icon) return;

    icon.classList.toggle('fa-bars', !isOpen);
    icon.classList.toggle('fa-times', isOpen);
}

async function loadHomeReviews() {
    const container = document.getElementById('home-testimonials');
    if (!container) return;

    if (typeof SupabaseService === 'undefined') {
        console.error('SupabaseService non disponible');
        container.innerHTML = '<p class="text-center text-danger">Erreur: Service indisponible</p>';
        return;
    }

    try {
        const { data: reviews, error } = await SupabaseService.getReviews();

        if (error) {
            console.error('Erreur chargement avis:', error);
            container.innerHTML = '<p class="text-center text-danger">Impossible de charger les avis.</p>';
            return;
        }

        container.innerHTML = '';

        if (!reviews || reviews.length === 0) {
            container.innerHTML = '<p class="text-center">Aucun avis pour le moment.</p>';
            return;
        }

        reviews.slice(0, 3).forEach(review => {
            container.appendChild(createReviewElement(review));
        });

    } catch (err) {
        console.error('Erreur inattendue:', err);
        container.innerHTML = '<p class="text-center text-danger">Erreur inattendue.</p>';
    }
}

function createReviewElement(review) {
    const article = document.createElement('article');
    article.className = 'review-item fade-in-up';

    const stars = createStarsHtml(review.rating);
    const date = formatDateFr(review.created_at);
    const avatarHtml = createAvatarHtml(review.avatar_url, review.name);

    article.innerHTML = `
        <div class="review-header">
            <div class="review-header-left">
                ${avatarHtml}
                <div class="review-author">
                    <h4>${review.name}</h4>
                    ${review.role ? `<span class="review-role">${review.role}</span>` : ''}
                </div>
            </div>
        <div class="review-stars">${stars}</div>
        </div>
        <p class="review-content ${review.message.length > 120 ? 'clamped' : ''}">${review.message}</p>
        ${review.message.length > 120 ? `<button class="read-more-btn" onclick="toggleReview(this)">Lire la suite</button>` : ''}
        <span class="review-date">Posté le ${date}</span>
    `;

    return article;
}

window.toggleReview = function (btn) {
    const content = btn.previousElementSibling;
    content.classList.toggle('clamped');
    btn.textContent = content.classList.contains('clamped') ? 'Lire la suite' : 'Réduire';
};

function createStarsHtml(rating) {
    return Array(5).fill(0).map((_, i) =>
        `<i class="${i < rating ? 'fas' : 'far'} fa-star" aria-hidden="true"></i>`
    ).join('');
}

function formatDateFr(dateString) {
    return new Date(dateString).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function createAvatarHtml(avatarUrl, name) {
    const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23CBD5E1'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
    const avatarStyles = 'width: 50px; height: 50px; min-width: 50px; min-height: 50px; border-radius: 50%; object-fit: cover; margin-right: 15px; flex-shrink: 0;';
    const containerStyles = 'width: 50px; height: 50px; min-width: 50px; min-height: 50px; border-radius: 50%; background: #F8FAFC; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;';

    if (avatarUrl) {
        return `<img src="${avatarUrl}" alt="${name}" style="${avatarStyles}" onerror="this.style.display='none'">`;
    }

    return `<div style="${containerStyles}"><img src="${DEFAULT_AVATAR}" alt="Avatar" style="width: 60%; height: 60%; object-fit: contain; opacity: 0.8;"></div>`;
}

function initPortfolioFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const projectCards = document.querySelectorAll('.premium-project-card');
    const mobileToggle = document.querySelector('.mobile-filter-toggle');
    const filterWrapper = document.querySelector('.filter-buttons-wrapper');

    if (filterButtons.length === 0 || projectCards.length === 0) return;

    if (mobileToggle && filterWrapper) {
        mobileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            filterWrapper.classList.toggle('active');
            updateFilterIcon(mobileToggle, filterWrapper.classList.contains('active'));
        });

        document.addEventListener('click', (e) => {
            if (!filterWrapper.contains(e.target) && !mobileToggle.contains(e.target)) {
                filterWrapper.classList.remove('active');
                updateFilterIcon(mobileToggle, false);
            }
        });
    }

    const toggleText = mobileToggle?.querySelector('span');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            if (toggleText) toggleText.textContent = button.textContent;

            if (filterWrapper) {
                filterWrapper.classList.remove('active');
                updateFilterIcon(mobileToggle, false);
            }

            filterProjects(projectCards, button.getAttribute('data-filter'));
        });
    });
}

function filterProjects(cards, filter) {
    cards.forEach(card => {
        const category = card.getAttribute('data-category');
        const shouldShow = filter === 'all' || category === filter;

        if (shouldShow) {
            card.style.removeProperty('display');
            card.style.animation = 'none';
            card.offsetHeight; // Force reflow
            card.style.animation = 'fadeInUp 0.6s ease forwards';
        } else {
            card.style.setProperty('display', 'none', 'important');
        }
    });
}

function updateFilterIcon(toggle, isOpen) {
    const icon = toggle?.querySelector('.filter-icon-right');
    if (!icon) return;

    icon.classList.toggle('fa-chevron-down', !isOpen);
    icon.classList.toggle('fa-chevron-up', isOpen);
}

function initProjectModal() {
    const modal = document.querySelector('.project-modal-overlay');
    if (!modal) return;

    const closeBtn = document.querySelector('.modal-close-btn');
    const openBtns = document.querySelectorAll('.open-project-modal');

    const elements = {
        title: modal.querySelector('.modal-title'),
        category: modal.querySelector('.modal-category'),
        desc: modal.querySelector('.modal-desc'),
        duration: modal.querySelector('.modal-duration'),
        client: modal.querySelector('.modal-client'),
        link: modal.querySelector('.modal-project-link')
    };

    openBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            populateModal(elements, btn);
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });

    const closeModal = () => {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    };

    closeBtn?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => e.target === modal && closeModal());
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
    });
}

function populateModal(elements, btn) {
    const data = {
        title: btn.getAttribute('data-title'),
        category: btn.getAttribute('data-category'),
        desc: btn.getAttribute('data-desc'),
        duration: btn.getAttribute('data-duration'),
        client: btn.getAttribute('data-client'),
        link: btn.getAttribute('href')
    };

    if (elements.title) elements.title.textContent = data.title;
    if (elements.category) elements.category.textContent = data.category;
    if (elements.desc) elements.desc.textContent = data.desc;
    if (elements.duration) elements.duration.textContent = data.duration;
    if (elements.client) elements.client.textContent = data.client;
    if (elements.link) elements.link.setAttribute('href', data.link);
}
