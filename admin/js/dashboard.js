

document.addEventListener('DOMContentLoaded', async () => {
    const isAuth = await AdminAuth.requireAuth();
    if (!isAuth) return;

    initNavigation();
    initMobileMenu();
    initLogout();
    initSettings();
    initQuickActions();

    ProjectsManager.init();
    BriefsManager.init();
    ReviewsManager.init();
    AnalyticsManager.init();

    showPage(getInitialPage());
});

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-page]');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            showPage(page);

            history.pushState({ page }, '', `#${page}`);
        });
    });

    window.addEventListener('popstate', (e) => {
        const page = e.state?.page || 'dashboard';
        showPage(page);
    });
}

function showPage(pageId) {
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });

    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const activeNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }

    const titles = {
        dashboard: 'Dashboard',
        projects: 'Gestion des projets',
        briefs: 'Briefs clients',
        reviews: 'Avis clients',
        analytics: 'Analytics',
        settings: 'Paramètres'
    };

    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = titles[pageId] || 'Dashboard';
    }

    closeMobileMenu();
}

function getInitialPage() {
    const hash = window.location.hash.slice(1);
    const validPages = ['dashboard', 'projects', 'briefs', 'reviews', 'analytics', 'settings'];
    return validPages.includes(hash) ? hash : 'dashboard';
}

function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    mobileMenuBtn?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    });

    overlay?.addEventListener('click', closeMobileMenu);
}

function closeMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    sidebar?.classList.remove('open');
    overlay?.classList.remove('active');
}

function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutModal = document.getElementById('logoutModal');
    const logoutCancelBtn = document.getElementById('logoutCancelBtn');
    const logoutConfirmBtn = document.getElementById('logoutConfirmBtn');

    function openLogoutModal() {
        if (!logoutModal) return;
        logoutModal.hidden = false;
        requestAnimationFrame(() => logoutModal.classList.add('active'));
    }

    function closeLogoutModal() {
        logoutModal.classList.remove('active');
        logoutModal.hidden = true;
    }

    logoutBtn?.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openLogoutModal();
    });

    logoutCancelBtn?.addEventListener('click', function () {
        closeLogoutModal();
    });

    logoutConfirmBtn?.addEventListener('click', async function () {
        closeLogoutModal();
        await AdminAuth.logout();
    });

    logoutModal?.addEventListener('click', function (e) {
        if (e.target === logoutModal) {
            closeLogoutModal();
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && logoutModal && !logoutModal.hidden) {
            closeLogoutModal();
        }
    });
}

function initSettings() {
    const form = document.getElementById('changePasswordForm');

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword.length < 8) {
            Toast.error('Erreur', 'Le mot de passe doit contenir au moins 8 caractères');
            return;
        }

        if (newPassword !== confirmPassword) {
            Toast.error('Erreur', 'Les mots de passe ne correspondent pas');
            return;
        }

        const user = await AdminAuth.getCurrentUser();
        if (!user) {
            Toast.error('Erreur', 'Session expirée');
            return;
        }

        const verifyResult = await AdminAuth.login(user.email, currentPassword);
        if (!verifyResult.success) {
            Toast.error('Erreur', 'Mot de passe actuel incorrect');
            return;
        }

        const result = await AdminAuth.changePassword(newPassword);

        if (result.success) {
            Toast.success('Succès', 'Mot de passe modifié');
            form.reset();
        } else {
            Toast.error('Erreur', result.error || 'Impossible de modifier le mot de passe');
        }
    });

    const lastLoginEl = document.getElementById('lastLogin');
    if (lastLoginEl) {
        const sessionData = sessionStorage.getItem('mw_admin_session');
        if (sessionData) {
            const { loggedAt } = JSON.parse(sessionData);
            lastLoginEl.textContent = new Date(loggedAt).toLocaleString('fr-FR');
        }
    }
}

function initQuickActions() {
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;

            switch (action) {
                case 'new-project':
                    showPage('projects');
                    setTimeout(() => ProjectsManager.edit(null), 100);
                    break;
                case 'view-briefs':
                    showPage('briefs');
                    break;
                case 'view-reviews':
                    showPage('reviews');
                    break;
            }
        });
    });
}
