

const AnalyticsManager = (() => {
    'use strict';

    let supabaseClient = null;
    let currentPeriod = '7d';
    let chartInstances = {};
    let refreshTimer = null;

    function init() {
        initSupabase();
        restorePeriodFromStorage();
        initPeriodSelector();
        initRefreshButton();
        loadAnalytics();

        refreshTimer = setInterval(() => {
            if (document.getElementById('page-analytics')?.classList.contains('active')) {
                loadAnalytics(true);
            }
        }, 30000);
    }

    function initSupabase() {
        if (window.globalSupabaseClient) {
            supabaseClient = window.globalSupabaseClient;
            console.log('[Analytics] Client Supabase global utilisé');
            return;
        }

        if (!window.supabase || !window.supabase.createClient) {
            console.error('[Analytics] SDK Supabase non chargé');
            return;
        }

        if (typeof SUPABASE_CONFIG === 'undefined') {
            console.error('[Analytics] SUPABASE_CONFIG non disponible');
            return;
        }

        try {
            supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.KEY);
            window.globalSupabaseClient = supabaseClient; // Partager avec autres modules
            console.log('[Analytics] Client Supabase créé');
        } catch (err) {
            console.error('[Analytics] Erreur création client Supabase:', err);
        }
    }

    function initPeriodSelector() {
        const selector = document.getElementById('analyticsPeriod');
        if (!selector) return;

        selector.addEventListener('change', (e) => {
            currentPeriod = e.target.value;
            localStorage.setItem('mw_analytics_period', currentPeriod);
            loadAnalytics();
        });
    }

    
    function restorePeriodFromStorage() {
        const saved = localStorage.getItem('mw_analytics_period');
        if (saved && ['1h', '24h', '7d', '30d', '90d'].includes(saved)) {
            currentPeriod = saved;
            const selector = document.getElementById('analyticsPeriod');
            if (selector) {
                selector.value = saved;
            }
        }
    }

    function initRefreshButton() {
        const btn = document.getElementById('analyticsRefreshBtn');
        if (!btn) return;

        btn.addEventListener('click', () => {
            btn.classList.add('spinning');
            loadAnalytics().then(() => {
                setTimeout(() => btn.classList.remove('spinning'), 500);
            });
        });
    }

    
    function getStartDate() {
        const now = new Date();
        switch (currentPeriod) {
            case '1h': return new Date(now - 60 * 60 * 1000);
            case '24h': return new Date(now - 24 * 60 * 60 * 1000);
            case '7d': return new Date(now - 7 * 24 * 60 * 60 * 1000);
            case '30d': return new Date(now - 30 * 24 * 60 * 60 * 1000);
            case '90d': return new Date(now - 90 * 24 * 60 * 60 * 1000);
            default: return new Date(now - 7 * 24 * 60 * 60 * 1000);
        }
    }

    async function loadAnalytics(silent = false) {
        if (!supabaseClient) {
            showEmptyState();
            return;
        }

        if (!silent) {
            showLoading();
        }

        const startDate = getStartDate().toISOString();

        try {
            const [pageviews, sessions, events, prevPageviews, prevSessions] = await Promise.all([
                fetchPageviews(startDate),
                fetchSessions(startDate),
                fetchEvents(startDate),
                fetchPreviousPeriodPageviews(),
                fetchPreviousPeriodSessions()
            ]);

            renderKPIs(pageviews, sessions, events, prevPageviews, prevSessions);
            renderVisitorsChart(pageviews);
            renderPagesTable(pageviews);
            renderSourcesTable(sessions);
            renderDevicesChart(sessions);
            renderBrowsersChart(sessions);
            renderRecentSessions(sessions);
            renderLiveIndicator(sessions);
            renderEventsTable(events);
        } catch (err) {
            console.error('[Analytics] Erreur chargement:', err);
            if (!silent) showErrorState();
        }
    }

    async function fetchPageviews(startDate) {
        const { data, error } = await supabaseClient
            .from('analytics_pageviews')
            .select('*')
            .gte('created_at', startDate)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    async function fetchSessions(startDate) {
        const { data, error } = await supabaseClient
            .from('analytics_sessions')
            .select('*')
            .gte('started_at', startDate)
            .order('started_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    async function fetchEvents(startDate) {
        const { data, error } = await supabaseClient
            .from('analytics_events')
            .select('*')
            .gte('created_at', startDate)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        return data || [];
    }

    async function fetchPreviousPeriodPageviews() {
        const now = new Date();
        let diff;
        switch (currentPeriod) {
            case '1h': diff = 60 * 60 * 1000; break;
            case '24h': diff = 24 * 60 * 60 * 1000; break;
            case '7d': diff = 7 * 24 * 60 * 60 * 1000; break;
            case '30d': diff = 30 * 24 * 60 * 60 * 1000; break;
            case '90d': diff = 90 * 24 * 60 * 60 * 1000; break;
            default: diff = 7 * 24 * 60 * 60 * 1000;
        }

        const endDate = new Date(now - diff).toISOString();
        const startDate = new Date(now - diff * 2).toISOString();

        const { data } = await supabaseClient
            .from('analytics_pageviews')
            .select('id')
            .gte('created_at', startDate)
            .lt('created_at', endDate);

        return data || [];
    }

    async function fetchPreviousPeriodSessions() {
        const now = new Date();
        let diff;
        switch (currentPeriod) {
            case '1h': diff = 60 * 60 * 1000; break;
            case '24h': diff = 24 * 60 * 60 * 1000; break;
            case '7d': diff = 7 * 24 * 60 * 60 * 1000; break;
            case '30d': diff = 30 * 24 * 60 * 60 * 1000; break;
            case '90d': diff = 90 * 24 * 60 * 60 * 1000; break;
            default: diff = 7 * 24 * 60 * 60 * 1000;
        }

        const endDate = new Date(now - diff).toISOString();
        const startDate = new Date(now - diff * 2).toISOString();

        const { data } = await supabaseClient
            .from('analytics_sessions')
            .select('id, is_bounce, total_duration')
            .gte('started_at', startDate)
            .lt('started_at', endDate);

        return data || [];
    }

    function renderKPIs(pageviews, sessions, events, prevPageviews, prevSessions) {
        const uniqueVisitors = new Set(sessions.map(s => s.visitor_id)).size;
        const prevUniqueVisitors = new Set(prevSessions.map(s => s.visitor_id || s.id)).size;

        const totalPageviews = pageviews.length;
        const prevTotalPageviews = prevPageviews.length;

        const bounceSessions = sessions.filter(s => s.is_bounce).length;
        const bounceRate = sessions.length > 0 ? Math.round((bounceSessions / sessions.length) * 100) : 0;
        const prevBounceSessions = prevSessions.filter(s => s.is_bounce).length;
        const prevBounceRate = prevSessions.length > 0 ? Math.round((prevBounceSessions / prevSessions.length) * 100) : 0;

        const avgDuration = sessions.length > 0
            ? Math.round(sessions.reduce((sum, s) => sum + (s.total_duration || 0), 0) / sessions.length)
            : 0;
        const prevAvgDuration = prevSessions.length > 0
            ? Math.round(prevSessions.reduce((sum, s) => sum + (s.total_duration || 0), 0) / prevSessions.length)
            : 0;

        const pagesPerSession = sessions.length > 0
            ? (totalPageviews / sessions.length).toFixed(1)
            : '0';

        const totalEvents = events.length;

        updateKPI('kpiVisitors', uniqueVisitors, prevUniqueVisitors);
        updateKPI('kpiPageviews', totalPageviews, prevTotalPageviews);
        updateKPI('kpiBounceRate', bounceRate + '%', prevBounceRate, true);
        updateKPI('kpiAvgDuration', formatDuration(avgDuration), prevAvgDuration > 0 ? formatDuration(prevAvgDuration) : null);
        updateKPI('kpiPagesSession', pagesPerSession);
        updateKPI('kpiEvents', totalEvents);
        updateKPI('kpiSessions', sessions.length, prevSessions.length);
    }

    function updateKPI(elementId, value, prevValue = null, invertTrend = false) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const valueEl = el.querySelector('.analytics-kpi-value');
        const trendEl = el.querySelector('.analytics-kpi-trend');

        if (valueEl) valueEl.textContent = value;

        if (trendEl && prevValue !== null && typeof prevValue === 'number') {
            const current = typeof value === 'string' ? parseFloat(value) : value;
            const prev = typeof prevValue === 'string' ? parseFloat(prevValue) : prevValue;

            if (prev > 0) {
                const change = Math.round(((current - prev) / prev) * 100);
                const isPositive = invertTrend ? change < 0 : change > 0;
                const icon = change > 0 ? 'fa-arrow-up' : change < 0 ? 'fa-arrow-down' : 'fa-minus';
                const colorClass = change === 0 ? 'neutral' : isPositive ? 'positive' : 'negative';

                trendEl.innerHTML = `<i class="fas ${icon}"></i> ${Math.abs(change)}%`;
                trendEl.className = `analytics-kpi-trend ${colorClass}`;
            } else {
                trendEl.innerHTML = '<i class="fas fa-minus"></i> --';
                trendEl.className = 'analytics-kpi-trend neutral';
            }
        }
    }

    function renderVisitorsChart(pageviews) {
        const canvas = document.getElementById('visitorsChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const { labels, data } = groupByDate(pageviews);
        const sessionsData = groupSessionsByDate(pageviews);

        if (chartInstances.visitors) {
            chartInstances.visitors = null;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawLineChart(ctx, canvas, labels, [
            { data, color: '#6366f1', label: 'Pages vues' },
            { data: sessionsData, color: '#10b981', label: 'Sessions' }
        ]);

        chartInstances.visitors = true;
    }

    function groupByDate(pageviews) {
        const grouped = {};
        const labels = [];
        const data = [];
        const isHourly = currentPeriod === '1h';

        pageviews.forEach(pv => {
            let key;
            if (isHourly) {
                const d = new Date(pv.created_at);
                const mins = Math.floor(d.getMinutes() / 5) * 5;
                key = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(/:..$/, '')
                    + ':' + String(mins).padStart(2, '0');
            } else {
                key = new Date(pv.created_at).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit'
                });
            }
            grouped[key] = (grouped[key] || 0) + 1;
        });

        Object.entries(grouped).forEach(([label, count]) => {
            labels.push(label);
            data.push(count);
        });

        return { labels, data };
    }

    function groupSessionsByDate(pageviews) {
        const grouped = {};
        const isHourly = currentPeriod === '1h';

        pageviews.forEach(pv => {
            let key;
            if (isHourly) {
                const d = new Date(pv.created_at);
                const mins = Math.floor(d.getMinutes() / 5) * 5;
                key = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(/:..$/, '')
                    + ':' + String(mins).padStart(2, '0');
            } else {
                key = new Date(pv.created_at).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit'
                });
            }
            if (!grouped[key]) grouped[key] = new Set();
            grouped[key].add(pv.session_id);
        });

        return Object.values(grouped).map(set => set.size);
    }

    
    function drawLineChart(ctx, canvas, labels, datasets) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;
        const padding = { top: 30, right: 20, bottom: 40, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, width, height);

        if (labels.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '14px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Aucune donnée pour cette période', width / 2, height / 2);
            return;
        }

        let maxVal = 0;
        datasets.forEach(ds => {
            ds.data.forEach(v => { if (v > maxVal) maxVal = v; });
        });
        maxVal = Math.max(maxVal, 1); // Minimum 1
        const yStep = Math.ceil(maxVal / 5);
        maxVal = yStep * 5;

        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#666';
        ctx.font = '11px Outfit, sans-serif';
        ctx.textAlign = 'right';

        for (let i = 0; i <= 5; i++) {
            const y = padding.top + chartHeight - (i / 5) * chartHeight;
            const val = Math.round((i / 5) * maxVal);

            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            ctx.fillText(val.toString(), padding.left - 8, y + 4);
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = '#666';
        const step = Math.max(1, Math.floor(labels.length / 8));

        labels.forEach((label, i) => {
            if (i % step === 0 || i === labels.length - 1) {
                const x = padding.left + (i / Math.max(labels.length - 1, 1)) * chartWidth;
                ctx.fillText(label, x, height - padding.bottom + 20);
            }
        });

        datasets.forEach(dataset => {
            const points = dataset.data.map((val, i) => ({
                x: padding.left + (i / Math.max(dataset.data.length - 1, 1)) * chartWidth,
                y: padding.top + chartHeight - (val / maxVal) * chartHeight
            }));

            if (points.length > 1) {
                const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
                gradient.addColorStop(0, dataset.color + '30');
                gradient.addColorStop(1, dataset.color + '05');

                ctx.beginPath();
                ctx.moveTo(points[0].x, padding.top + chartHeight);
                points.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
                ctx.closePath();
                ctx.fillStyle = gradient;
                ctx.fill();
            }

            ctx.beginPath();
            ctx.strokeStyle = dataset.color;
            ctx.lineWidth = 2.5;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            points.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();

            points.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                ctx.fillStyle = dataset.color;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = '#1e1e1e';
                ctx.fill();
            });
        });

        let legendX = padding.left;
        datasets.forEach(ds => {
            ctx.beginPath();
            ctx.arc(legendX + 6, 12, 4, 0, Math.PI * 2);
            ctx.fillStyle = ds.color;
            ctx.fill();

            ctx.fillStyle = '#a0a0a0';
            ctx.font = '11px Outfit, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(ds.label, legendX + 14, 16);
            legendX += ctx.measureText(ds.label).width + 30;
        });
    }

    function renderPagesTable(pageviews) {
        const container = document.getElementById('topPagesTable');
        if (!container) return;

        const pages = {};
        pageviews.forEach(pv => {
            if (!pages[pv.page_path]) {
                pages[pv.page_path] = {
                    path: pv.page_path,
                    views: 0,
                    totalDuration: 0,
                    sessions: new Set()
                };
            }
            pages[pv.page_path].views++;
            pages[pv.page_path].totalDuration += (pv.duration || 0);
            pages[pv.page_path].sessions.add(pv.session_id);
        });

        const sorted = Object.values(pages)
            .map(p => ({
                ...p,
                uniqueVisitors: p.sessions.size,
                avgDuration: p.views > 0 ? Math.round(p.totalDuration / p.views) : 0
            }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 10);

        const totalViews = pageviews.length || 1;

        if (sorted.length === 0) {
            container.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Aucune donnée</td></tr>';
            return;
        }

        container.innerHTML = sorted.map(page => {
            const percentage = Math.round((page.views / totalViews) * 100);
            const pageName = formatPageName(page.path);

            return `
                <tr>
                    <td>
                        <div class="page-path-cell">
                            <span class="page-name">${pageName}</span>
                            <span class="page-url">${page.path}</span>
                        </div>
                    </td>
                    <td>
                        <div class="views-cell">
                            <span class="views-count">${page.views}</span>
                            <div class="views-bar">
                                <div class="views-bar-fill" style="width: ${percentage}%"></div>
                            </div>
                        </div>
                    </td>
                    <td>${page.uniqueVisitors}</td>
                    <td>${formatDuration(page.avgDuration)}</td>
                </tr>
            `;
        }).join('');
    }

    function renderSourcesTable(sessions) {
        const container = document.getElementById('topSourcesTable');
        if (!container) return;

        const sources = {};
        sessions.forEach(s => {
            let source = 'Direct';
            if (s.utm_source) {
                source = s.utm_source;
            } else if (s.referrer) {
                try {
                    source = new URL(s.referrer).hostname;
                } catch {
                    source = s.referrer;
                }
            }

            if (!sources[source]) {
                sources[source] = { name: source, count: 0, visitors: new Set() };
            }
            sources[source].count++;
            sources[source].visitors.add(s.visitor_id);
        });

        const sorted = Object.values(sources)
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        const totalSessions = sessions.length || 1;

        if (sorted.length === 0) {
            container.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Aucune donnée</td></tr>';
            return;
        }

        container.innerHTML = sorted.map(source => {
            const percentage = Math.round((source.count / totalSessions) * 100);
            const icon = getSourceIcon(source.name);

            return `
                <tr>
                    <td>
                        <div class="source-cell">
                            <i class="${icon}"></i>
                            <span>${escapeHtml(source.name)}</span>
                        </div>
                    </td>
                    <td>${source.count} <span class="text-muted">(${percentage}%)</span></td>
                    <td>${source.visitors.size}</td>
                </tr>
            `;
        }).join('');
    }

    function renderDevicesChart(sessions) {
        const container = document.getElementById('devicesBreakdown');
        if (!container) return;

        const devices = { desktop: 0, mobile: 0, tablet: 0 };
        sessions.forEach(s => {
            const type = s.device_type || 'desktop';
            devices[type] = (devices[type] || 0) + 1;
        });

        const total = sessions.length || 1;
        const items = [
            { label: 'Desktop', count: devices.desktop, icon: 'fas fa-desktop', color: '#6366f1' },
            { label: 'Mobile', count: devices.mobile, icon: 'fas fa-mobile-alt', color: '#10b981' },
            { label: 'Tablette', count: devices.tablet, icon: 'fas fa-tablet-alt', color: '#f59e0b' }
        ].filter(d => d.count > 0);

        if (items.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">Aucune donnée</p>';
            return;
        }

        container.innerHTML = items.map(d => {
            const pct = Math.round((d.count / total) * 100);
            return `
                <div class="device-item">
                    <div class="device-header">
                        <i class="${d.icon}" style="color: ${d.color}"></i>
                        <span class="device-label">${d.label}</span>
                        <span class="device-pct">${pct}%</span>
                    </div>
                    <div class="device-bar">
                        <div class="device-bar-fill" style="width: ${pct}%; background: ${d.color}"></div>
                    </div>
                    <span class="device-count">${d.count} session${d.count > 1 ? 's' : ''}</span>
                </div>
            `;
        }).join('');
    }

    function renderBrowsersChart(sessions) {
        const container = document.getElementById('browsersBreakdown');
        if (!container) return;

        const browsers = {};
        sessions.forEach(s => {
            const browser = s.browser || 'Inconnu';
            browsers[browser] = (browsers[browser] || 0) + 1;
        });

        const total = sessions.length || 1;
        const sorted = Object.entries(browsers)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        const browserColors = {
            'Chrome': '#4285f4',
            'Firefox': '#ff7139',
            'Safari': '#007aff',
            'Edge': '#0078d7',
            'Opera': '#ff1b2d',
            'Autre': '#666'
        };

        if (sorted.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">Aucune donnée</p>';
            return;
        }

        container.innerHTML = sorted.map(b => {
            const pct = Math.round((b.count / total) * 100);
            const color = browserColors[b.name] || '#888';
            const icon = getBrowserIcon(b.name);

            return `
                <div class="browser-item">
                    <div class="browser-header">
                        <i class="${icon}" style="color: ${color}"></i>
                        <span class="browser-label">${b.name}</span>
                        <span class="browser-pct">${pct}%</span>
                    </div>
                    <div class="browser-bar">
                        <div class="browser-bar-fill" style="width: ${pct}%; background: ${color}"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderRecentSessions(sessions) {
        const container = document.getElementById('recentSessionsTable');
        if (!container) return;

        const recent = sessions.slice(0, 15);

        if (recent.length === 0) {
            container.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Aucune session</td></tr>';
            return;
        }

        container.innerHTML = recent.map(s => {
            const startTime = new Date(s.started_at).toLocaleString('fr-FR', {
                day: '2-digit', month: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });

            const deviceIcon = s.device_type === 'mobile' ? 'fa-mobile-alt'
                : s.device_type === 'tablet' ? 'fa-tablet-alt' : 'fa-desktop';

            const bounceClass = s.is_bounce ? 'badge-danger' : 'badge-success';
            const bounceText = s.is_bounce ? 'Rebond' : 'Engagé';

            return `
                <tr>
                    <td>
                        <div class="session-visitor">
                            <i class="fas ${deviceIcon}"></i>
                            <span>${s.visitor_id?.substring(0, 12) || 'Anonyme'}…</span>
                        </div>
                    </td>
                    <td>${formatPageName(s.first_page)}</td>
                    <td>${s.pages_count || 1}</td>
                    <td>${formatDuration(s.total_duration || 0)}</td>
                    <td><span class="badge ${bounceClass}">${bounceText}</span></td>
                    <td>${startTime}</td>
                </tr>
            `;
        }).join('');
    }

    function renderLiveIndicator(sessions) {
        const el = document.getElementById('liveVisitors');
        if (!el) return;

        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000);

        const activeSessions = sessions.filter(s => {
            const endedAt = s.ended_at ? new Date(s.ended_at) : null;
            const startedAt = s.started_at ? new Date(s.started_at) : null;

            return (endedAt && endedAt > fiveMinAgo) || (startedAt && startedAt > threeMinAgo);
        });

        const uniqueActiveVisitors = new Set(activeSessions.map(s => s.visitor_id));

        el.textContent = uniqueActiveVisitors.size;

        const dot = el.previousElementSibling;
        if (dot) {
            dot.className = activeSessions.length > 0 ? 'live-dot active' : 'live-dot';
        }
    }

    function renderEventsTable(events) {
        const container = document.getElementById('recentEventsTable');
        if (!container) return;

        const eventTypes = {};
        events.forEach(e => {
            if (!eventTypes[e.event_name]) {
                eventTypes[e.event_name] = { name: e.event_name, count: 0, lastSeen: e.created_at };
            }
            eventTypes[e.event_name].count++;
        });

        const sorted = Object.values(eventTypes).sort((a, b) => b.count - a.count);

        if (sorted.length === 0) {
            container.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Aucun événement</td></tr>';
            return;
        }

        container.innerHTML = sorted.map(e => {
            const icon = getEventIcon(e.name);
            const lastSeen = new Date(e.lastSeen).toLocaleString('fr-FR', {
                day: '2-digit', month: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });

            return `
                <tr>
                    <td>
                        <div class="event-cell">
                            <i class="${icon}"></i>
                            <span>${formatEventName(e.name)}</span>
                        </div>
                    </td>
                    <td><strong>${e.count}</strong></td>
                    <td>${lastSeen}</td>
                </tr>
            `;
        }).join('');
    }

    function formatDuration(seconds) {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins < 60) return `${mins}m ${secs}s`;
        const hours = Math.floor(mins / 60);
        return `${hours}h ${mins % 60}m`;
    }

    function formatPageName(path) {
        const names = {
            '/': 'Accueil',
            '/index.html': 'Accueil',
            '/pages/apropos.html': 'À propos',
            '/pages/services.html': 'Services',
            '/pages/realisations.html': 'Réalisations',
            '/pages/contact.html': 'Contact',
            '/pages/avis.html': 'Avis',
            '/pages/definir-mon-projet.html': 'Définir mon projet',
            '/pages/confidentialite.html': 'Confidentialité',
            '/pages/mentions-legales.html': 'Mentions légales'
        };
        return names[path] || path;
    }

    function formatEventName(name) {
        const names = {
            'cta_click': '🖱️ Clic CTA',
            'form_submit': '📝 Soumission formulaire',
            'scroll_depth': '📜 Profondeur de scroll'
        };
        return names[name] || name;
    }

    function getSourceIcon(source) {
        if (source === 'Direct') return 'fas fa-arrow-right';
        if (source.includes('google')) return 'fab fa-google';
        if (source.includes('facebook') || source.includes('fb')) return 'fab fa-facebook';
        if (source.includes('instagram')) return 'fab fa-instagram';
        if (source.includes('linkedin')) return 'fab fa-linkedin';
        if (source.includes('twitter') || source.includes('x.com')) return 'fab fa-twitter';
        return 'fas fa-globe';
    }

    function getBrowserIcon(name) {
        const icons = {
            'Chrome': 'fab fa-chrome',
            'Firefox': 'fab fa-firefox',
            'Safari': 'fab fa-safari',
            'Edge': 'fab fa-edge',
            'Opera': 'fab fa-opera'
        };
        return icons[name] || 'fas fa-globe';
    }

    function getEventIcon(name) {
        const icons = {
            'cta_click': 'fas fa-mouse-pointer',
            'form_submit': 'fas fa-paper-plane',
            'scroll_depth': 'fas fa-scroll'
        };
        return icons[name] || 'fas fa-bolt';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showLoading() {
        const container = document.getElementById('analyticsContent');
        if (container) {
            container.querySelectorAll('.analytics-loading').forEach(el => {
                el.style.display = 'flex';
            });
        }
    }

    function showEmptyState() {
        const container = document.getElementById('analyticsContent');
        if (!container) return;

        const reason = !window.supabase ? 'SDK Supabase non chargé' :
            !supabaseClient ? 'Client non initialisé' :
                'Tables non créées';

        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-line"></i>
                <h3>Analytics non disponible</h3>
                <p>${reason}. Vérifiez la console (F12) pour plus de détails.</p>
                <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 1rem;">
                    <i class="fas fa-sync-alt"></i> Recharger la page
                </button>
            </div>
        `;
    }

    function showErrorState() {
        const container = document.getElementById('analyticsContent');
        if (!container) return;
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Erreur de chargement</h3>
                <p>Impossible de récupérer les données analytics. Vérifiez la connexion Supabase.</p>
            </div>
        `;
    }

    return {
        init,
        refresh: loadAnalytics
    };

})();
