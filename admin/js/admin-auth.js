

const AdminAuth = (function () {
    'use strict';

    let supabaseClient = null;

    
    const ALLOWED_ADMIN_EMAILS = [
        atob("bWlsYW4ubGVkQGljbG91ZC5jb20="),
        atob("bWlsYW5uLmxlZGVAaWNsb3VkLmNvbQ=="),
        atob("Y29udGFjdEBtb2Rlcm53ZWIuZnI=")
    ];

    const SESSION_KEY = 'mw_admin_session';

    
    const RATE_LIMIT_CONFIG = {
        MAX_ATTEMPTS: 5,
        LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes (OWASP recommendation)
        RESET_AFTER: 60 * 60 * 1000, // Reset après 1h sans tentative
        STORAGE_KEY: 'mw_login_attempts'
    };

    
    const SESSION_CONFIG = {
        INACTIVITY_TIMEOUT: 30 * 60 * 1000, // 30 minutes
        ACTIVITY_EVENTS: ['click', 'keypress', 'scroll', 'mousemove']
    };

    let sessionTimeoutId = null;

    
    function getLoginAttempts() {
        try {
            const data = localStorage.getItem(RATE_LIMIT_CONFIG.STORAGE_KEY);
            if (!data) return { count: 0, lastAttempt: null, lockoutUntil: null };
            return JSON.parse(data);
        } catch (e) {
            return { count: 0, lastAttempt: null, lockoutUntil: null };
        }
    }

    
    function saveLoginAttempts(attempts) {
        localStorage.setItem(RATE_LIMIT_CONFIG.STORAGE_KEY, JSON.stringify(attempts));
    }

    
    function canAttemptLogin() {
        const attempts = getLoginAttempts();
        const now = Date.now();

        if (attempts.lockoutUntil && now < attempts.lockoutUntil) {
            return {
                allowed: false,
                remainingSeconds: Math.ceil((attempts.lockoutUntil - now) / 1000)
            };
        }

        return { allowed: true };
    }

    
    function recordFailedLoginAttempt() {
        const attempts = getLoginAttempts();
        const now = Date.now();

        if (attempts.lastAttempt && (now - attempts.lastAttempt) > RATE_LIMIT_CONFIG.RESET_AFTER) {
            attempts.count = 0;
        }

        attempts.count++;
        attempts.lastAttempt = now;

        if (attempts.count >= RATE_LIMIT_CONFIG.MAX_ATTEMPTS) {
            attempts.lockoutUntil = now + RATE_LIMIT_CONFIG.LOCKOUT_DURATION;
            console.warn('AdminAuth: Compte verrouillé temporairement (trop de tentatives)');
        }

        saveLoginAttempts(attempts);
    }

    
    function resetLoginAttempts() {
        localStorage.removeItem(RATE_LIMIT_CONFIG.STORAGE_KEY);
    }

    
    function resetSessionTimer() {
        if (sessionTimeoutId) {
            clearTimeout(sessionTimeoutId);
        }

        sessionTimeoutId = setTimeout(async () => {
            console.warn('AdminAuth: Session expirée pour inactivité');
            await logout();
            alert('Votre session a expiré pour inactivité. Veuillez vous reconnecter.');
        }, SESSION_CONFIG.INACTIVITY_TIMEOUT);
    }

    
    function initSessionTimeout() {
        SESSION_CONFIG.ACTIVITY_EVENTS.forEach(event => {
            document.addEventListener(event, resetSessionTimer, { passive: true });
        });
        resetSessionTimer();
    }

    
    function denyAccess() {
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = '/';
    }

    
    function init() {
        if (window.supabase && window.supabase.createClient) {
            supabaseClient = window.supabase.createClient(
                SUPABASE_CONFIG.URL,
                SUPABASE_CONFIG.KEY
            );
            console.log('AdminAuth: Supabase initialisé');
        } else {
            console.error('AdminAuth: SDK Supabase non chargé');
        }
    }

    
    async function login(email, password) {
        const canAttempt = canAttemptLogin();
        if (!canAttempt.allowed) {
            return {
                success: false,
                error: `Trop de tentatives. Réessayez dans ${Math.ceil(canAttempt.remainingSeconds / 60)} minutes.`,
                lockoutSeconds: canAttempt.remainingSeconds
            };
        }

        if (!supabaseClient) {
            return { success: false, error: 'Service non disponible' };
        }

        if (!isAllowedAdminEmail(email)) {
            recordFailedLoginAttempt();
            return { success: false, error: 'Accès non autorisé' };
        }

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                recordFailedLoginAttempt();
                return { success: false, error: 'Email ou mot de passe incorrect' };
            }

            if (data.session) {
                resetLoginAttempts();
                setLocalSession(data.user.email);
                initSessionTimeout();
                return { success: true };
            }

            recordFailedLoginAttempt();
            return { success: false, error: 'Erreur de connexion' };
        } catch (err) {
            console.error('Erreur login:', err);
            recordFailedLoginAttempt();
            return { success: false, error: 'Erreur de connexion' };
        }
    }

    
    async function logout() {
        if (sessionTimeoutId) {
            clearTimeout(sessionTimeoutId);
        }

        if (supabaseClient) {
            await supabaseClient.auth.signOut();
        }

        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = 'login.html';
    }

    
    async function isAuthenticated() {
        if (!supabaseClient) return false;

        try {
            const { data: { session } } = await supabaseClient.auth.getSession();

            if (!session) {
                if (hasLocalSession()) {
                    return true;
                }
                sessionStorage.removeItem(SESSION_KEY);
                return false;
            }

            if (!isAllowedAdminEmail(session.user.email)) {
                await logout();
                return false;
            }

            return true;
        } catch (err) {
            console.error('Erreur vérification auth:', err);
            return hasLocalSession();
        }
    }

    
    async function requireAuth() {
        const authenticated = await isAuthenticated();

        if (!authenticated) {
            window.location.href = 'login.html';
            return false;
        }

        initSessionTimeout();
        return true;
    }

    
    async function getCurrentUser() {
        if (!supabaseClient) return null;

        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            return user;
        } catch (err) {
            return null;
        }
    }

    
    async function changePassword(newPassword) {
        if (!supabaseClient) {
            return { success: false, error: 'Service non disponible' };
        }

        if (!newPassword || newPassword.length < 12) {
            return { success: false, error: 'Le mot de passe doit contenir au moins 12 caractères' };
        }

        const COMMON_PASSWORDS = [
            'password1234', 'motdepasse12', '123456789012',
            'qwertyuiop12', 'admin1234567', 'password12345'
        ];
        if (COMMON_PASSWORDS.includes(newPassword.toLowerCase())) {
            return { success: false, error: 'Ce mot de passe est trop commun. Choisissez-en un plus unique.' };
        }

        try {
            const { error } = await supabaseClient.auth.updateUser({
                password: newPassword
            });

            if (error) {
                console.error('Erreur changement mdp:', error);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (err) {
            console.error('Erreur changement mdp:', err);
            return { success: false, error: 'Erreur lors du changement de mot de passe' };
        }
    }

    
    function getClient() {
        return supabaseClient;
    }

    function setLocalSession(email) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
            email,
            loggedAt: new Date().toISOString()
        }));
    }

    function hasLocalSession() {
        const data = sessionStorage.getItem(SESSION_KEY);
        if (!data) return false;
        try {
            const parsed = JSON.parse(data);
            const loggedAt = new Date(parsed.loggedAt);
            const now = new Date();
            const hoursSinceLogin = (now - loggedAt) / (1000 * 60 * 60);

            if (hoursSinceLogin > 24) {
                sessionStorage.removeItem(SESSION_KEY);
                return false;
            }

            return isAllowedAdminEmail(parsed.email);
        } catch (e) {
            return false;
        }
    }

    function isAllowedAdminEmail(email) {
        const normalized = email?.toLowerCase();
        return !!normalized && ALLOWED_ADMIN_EMAILS.some((allowed) => allowed.toLowerCase() === normalized);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        login,
        logout,
        isAuthenticated,
        requireAuth,
        getCurrentUser,
        changePassword,
        getClient,
        canAttemptLogin
    };
})();

window.AdminAuth = AdminAuth;
