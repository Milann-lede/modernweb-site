

const MWAnalytics = (() => {
    'use strict';

    const CONFIG = {
        version: '1.0.0',
        sessionTimeout: 30 * 60 * 1000, // 30 minutes
        heartbeatInterval: 10000, // 10 secondes
        excludePaths: ['/admin', '/test-'], // Pages à ne pas tracker
        debug: false
    };

    let supabaseClient = null;
    let isActive = false;
    let sessionId = null;
    let visitorId = null;
    let pageStartTime = null;
    let heartbeatTimer = null;
    let currentPageviewId = null;

    function log(...args) {
        if (CONFIG.debug) console.log('[MWAnalytics]', ...args);
    }

    function generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    function getOrCreateVisitorId() {
        let id = localStorage.getItem('mw_visitor_id');
        if (!id) {
            id = generateId();
            localStorage.setItem('mw_visitor_id', id);
        }
        return id;
    }

    function getOrCreateSessionId() {
        const stored = sessionStorage.getItem('mw_session');
        if (stored) {
            const session = JSON.parse(stored);
            const now = Date.now();
            if (now - session.lastActivity < CONFIG.sessionTimeout) {
                session.lastActivity = now;
                sessionStorage.setItem('mw_session', JSON.stringify(session));
                return session.id;
            }
        }
        const newSession = {
            id: generateId(),
            lastActivity: Date.now(),
            started: Date.now()
        };
        sessionStorage.setItem('mw_session', JSON.stringify(newSession));
        return newSession.id;
    }

    function getDeviceType() {
        const width = window.innerWidth;
        if (width < 768) return 'mobile';
        if (width < 1024) return 'tablet';
        return 'desktop';
    }

    function getBrowser() {
        const ua = navigator.userAgent;
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('SamsungBrowser')) return 'Samsung';
        if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
        if (ua.includes('Trident')) return 'IE';
        if (ua.includes('Edge')) return 'Edge';
        if (ua.includes('Edg')) return 'Edge';
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Safari')) return 'Safari';
        return 'Autre';
    }

    function getOS() {
        const ua = navigator.userAgent;
        if (ua.includes('Windows')) return 'Windows';
        if (ua.includes('Mac')) return 'macOS';
        if (ua.includes('Linux')) return 'Linux';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
        return 'Autre';
    }

    function getUTMParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            utm_source: params.get('utm_source') || null,
            utm_medium: params.get('utm_medium') || null,
            utm_campaign: params.get('utm_campaign') || null
        };
    }

    function shouldTrack() {
        const path = window.location.pathname;
        return !CONFIG.excludePaths.some(exclude => path.includes(exclude));
    }

    function hasAnalyticsConsent() {
        try {
            const consent = localStorage.getItem('modernweb_gdpr_consent');
            if (!consent) return false;
            const parsed = JSON.parse(consent);
            return parsed.analytics === true;
        } catch (e) {
            return false;
        }
    }

    async function initSupabase() {
        if (window.globalSupabaseClient) {
            supabaseClient = window.globalSupabaseClient;
            log('Client Supabase global utilisé');
            return true;
        }

        if (!window.supabase || !window.supabase.createClient) {
            log('Chargement du SDK Supabase...');
            await loadSupabaseSDK();
        }

        if (window.supabase && window.supabase.createClient && typeof SUPABASE_CONFIG !== 'undefined') {
            supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.KEY);
            log('Client Supabase créé');
            return true;
        }

        console.error('[MWAnalytics] Impossible d\'initialiser Supabase');
        return false;
    }

    function loadSupabaseSDK() {
        return new Promise((resolve, reject) => {
            if (window.supabase && window.supabase.createClient) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = () => {
                log('SDK Supabase chargé');
                resolve();
            };
            script.onerror = () => {
                console.error('[MWAnalytics] Échec chargement SDK Supabase');
                reject(new Error('SDK load failed'));
            };
            document.head.appendChild(script);
        });
    }

    async function trackPageview() {
        if (!supabaseClient || !shouldTrack()) return;

        const utm = getUTMParams();
        const pageData = {
            session_id: sessionId,
            page_path: window.location.pathname,
            page_title: document.title || '',
            referrer: document.referrer || null,
            utm_source: utm.utm_source,
            utm_medium: utm.utm_medium,
            utm_campaign: utm.utm_campaign,
            device_type: getDeviceType(),
            browser: getBrowser(),
            os: getOS(),
            screen_width: window.screen.width,
            screen_height: window.screen.height,
            duration: 0
        };

        log('Tracking pageview:', pageData.page_path);

        try {
            const { data, error } = await supabaseClient
                .from('analytics_pageviews')
                .insert([pageData])
                .select('id')
                .single();

            if (error) {
                console.error('[MWAnalytics] Erreur INSERT pageview:', error.message);
                return;
            }

            currentPageviewId = data?.id;
            pageStartTime = Date.now();
            log('Pageview enregistré, ID:', currentPageviewId);

        } catch (err) {
            console.error('[MWAnalytics] Exception pageview:', err);
        }
    }

    async function updatePageDuration() {
        if (!supabaseClient || !currentPageviewId || !pageStartTime) return;

        const duration = Math.round((Date.now() - pageStartTime) / 1000);

        try {
            await supabaseClient
                .from('analytics_pageviews')
                .update({ duration })
                .eq('id', currentPageviewId);

            log('Durée mise à jour:', duration, 's');
        } catch (err) {
        }
    }

    async function trackSession() {
        if (!supabaseClient || !shouldTrack()) return;

        const utm = getUTMParams();
        const sessionData = {
            session_id: sessionId,
            visitor_id: visitorId,
            first_page: window.location.pathname,
            last_page: window.location.pathname,
            pages_count: 1,
            total_duration: 0,
            referrer: document.referrer || null,
            utm_source: utm.utm_source,
            utm_medium: utm.utm_medium,
            utm_campaign: utm.utm_campaign,
            device_type: getDeviceType(),
            browser: getBrowser(),
            os: getOS(),
            screen_width: window.screen.width,
            screen_height: window.screen.height,
            is_bounce: true
        };

        log('Tracking session:', sessionId);

        try {
            const { data: existing } = await supabaseClient
                .from('analytics_sessions')
                .select('id, pages_count')
                .eq('session_id', sessionId)
                .single();

            if (existing) {
                await supabaseClient
                    .from('analytics_sessions')
                    .update({
                        last_page: window.location.pathname,
                        pages_count: existing.pages_count + 1,
                        is_bounce: false,
                        ended_at: new Date().toISOString()
                    })
                    .eq('session_id', sessionId);

                log('Session mise à jour, pages:', existing.pages_count + 1);
            } else {
                const { error } = await supabaseClient
                    .from('analytics_sessions')
                    .insert([sessionData]);

                if (error) {
                    console.error('[MWAnalytics] Erreur INSERT session:', error.message);
                }
                log('Nouvelle session créée');
            }
        } catch (err) {
            console.error('[MWAnalytics] Exception session:', err);
        }
    }

    async function updateSessionDuration() {
        if (!supabaseClient || !sessionId) return;

        const sessionData = sessionStorage.getItem('mw_session');
        if (!sessionData) return;

        const session = JSON.parse(sessionData);
        const totalDuration = Math.round((Date.now() - session.started) / 1000);

        try {
            await supabaseClient
                .from('analytics_sessions')
                .update({
                    total_duration: totalDuration,
                    ended_at: new Date().toISOString()
                })
                .eq('session_id', sessionId);
        } catch (err) {
        }
    }

    async function trackEvent(eventName, eventData = {}) {
        if (!supabaseClient || !isActive) {
            log('Event ignoré (tracker inactif):', eventName);
            return;
        }

        const event = {
            session_id: sessionId,
            event_name: eventName,
            event_data: eventData,
            page_path: window.location.pathname
        };

        log('Tracking event:', eventName, eventData);

        try {
            const { error } = await supabaseClient
                .from('analytics_events')
                .insert([event]);

            if (error) {
                console.error('[MWAnalytics] Erreur INSERT event:', error.message);
            }
        } catch (err) {
            console.error('[MWAnalytics] Exception event:', err);
        }
    }

    function startHeartbeat() {
        if (heartbeatTimer) clearInterval(heartbeatTimer);

        heartbeatTimer = setInterval(() => {
            updatePageDuration();
            updateSessionDuration();
        }, CONFIG.heartbeatInterval);

        log('Heartbeat démarré');
    }

    function stopHeartbeat() {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    }

    async function start() {
        if (isActive) {
            log('Tracker déjà actif');
            return;
        }

        if (!hasAnalyticsConsent()) {
            log('Pas de consentement analytics');
            return;
        }

        log('Démarrage du tracker...');

        const initialized = await initSupabase();
        if (!initialized) return;

        visitorId = getOrCreateVisitorId();
        sessionId = getOrCreateSessionId();

        log('Visitor:', visitorId);
        log('Session:', sessionId);

        isActive = true;

        await trackSession();
        await trackPageview();

        startHeartbeat();

        window.addEventListener('popstate', handlePageChange);

        window.addEventListener('beforeunload', handleUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        log('Tracker actif ✓');
    }

    function stop() {
        if (!isActive) return;

        log('Arrêt du tracker');

        isActive = false;
        stopHeartbeat();

        window.removeEventListener('popstate', handlePageChange);
        window.removeEventListener('beforeunload', handleUnload);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    }

    async function handlePageChange() {
        if (!isActive) return;
        sessionId = getOrCreateSessionId();
        await trackSession();
        await trackPageview();
    }

    function handleUnload() {
        updatePageDuration();
        updateSessionDuration();
    }

    function handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            updatePageDuration();
            updateSessionDuration();
        }
    }

    function init() {
        log('Initialisation...');

        window.addEventListener('cookie-consent-updated', (e) => {
            log('Consentement mis à jour:', e.detail);
            if (e.detail && e.detail.analytics === true) {
                start();
            } else {
                stop();
            }
        });

        if (hasAnalyticsConsent()) {
            setTimeout(start, 500);
        } else {
            log('En attente du consentement...');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        version: CONFIG.version,
        isActive: () => isActive,
        trackEvent,
        forceStart: start,
        stop,
        debug: () => {
            console.log('=== MWAnalytics Debug ===');
            console.log('Version:', CONFIG.version);
            console.log('Active:', isActive);
            console.log('Visitor ID:', visitorId);
            console.log('Session ID:', sessionId);
            console.log('Page Start:', pageStartTime);
            console.log('Current Pageview ID:', currentPageviewId);
            console.log('Consent:', hasAnalyticsConsent());
            console.log('Supabase Client:', !!supabaseClient);
            console.log('========================');
        }
    };
})();

window.MWAnalytics = MWAnalytics;
