

const BriefsManager = (function () {
    'use strict';

    let briefs = [];
    const tableBody = document.getElementById('briefsTableBody');
    const emptyState = document.getElementById('briefsEmpty');

    
    function init() {
        setupEventListeners();
        loadBriefs();
    }

    
    function setupEventListeners() {
        document.getElementById('filterBriefStatus')?.addEventListener('change', filterBriefs);
        document.getElementById('searchBriefs')?.addEventListener('input', debounce(filterBriefs, 300));
    }

    
    async function loadBriefs() {
        const client = AdminAuth.getClient();
        if (!client) return;

        try {
            const { data, error } = await client
                .from('client_briefs')
                .select('*')
                .order('submitted_at', { ascending: false });

            if (error) throw error;

            briefs = data || [];
            renderBriefs(briefs);
            updateStats();
            updateNavBadge();

        } catch (err) {
            console.error('Erreur chargement briefs:', err);
            Toast.error('Erreur', 'Impossible de charger les briefs');
        }
    }

    
    function renderBriefs(data) {
        if (!tableBody) return;

        if (!data.length) {
            tableBody.innerHTML = '';
            emptyState && (emptyState.hidden = false);
            return;
        }

        emptyState && (emptyState.hidden = true);

        tableBody.innerHTML = data.map(brief => `
            <tr data-id="${brief.id}">
                <td>
                    <div class="brief-client">
                        <div class="client-name">${escapeHtml(brief.client_name)}</div>
                        ${brief.client_email ? `<div class="client-email">${escapeHtml(brief.client_email)}</div>` : ''}
                    </div>
                </td>
                <td>${escapeHtml(brief.project_type || 'Non spécifié')}</td>
                <td>
                    <div class="file-info">
                        <i class="fas fa-file-pdf"></i>
                        <a href="${brief.pdf_url}" target="_blank" class="text-truncate">Voir PDF</a>
                    </div>
                </td>
                <td>${formatDate(brief.submitted_at)}</td>
                <td>
                    <span class="badge badge-${getStatusBadge(brief.status)}">
                        ${getStatusLabel(brief.status)}
                    </span>
                </td>
                <td>
                    <div class="actions-cell">
                        <a href="${brief.pdf_url}" target="_blank" class="action-btn download" title="Voir PDF">
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                        <button type="button" class="action-btn edit" title="Marquer comme consulté" onclick="event.preventDefault(); event.stopPropagation(); BriefsManager.updateStatus(${brief.id}, 'consulte')">
                            <i class="fas fa-check"></i>
                        </button>
                        <button type="button" class="action-btn view" title="Archiver" onclick="event.preventDefault(); event.stopPropagation(); BriefsManager.updateStatus(${brief.id}, 'archive')">
                            <i class="fas fa-archive"></i>
                        </button>
                        <button type="button" class="action-btn delete" title="Supprimer" onclick="event.preventDefault(); event.stopPropagation(); BriefsManager.deleteBrief(${brief.id})">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    
    function filterBriefs() {
        const status = document.getElementById('filterBriefStatus')?.value || '';
        const search = document.getElementById('searchBriefs')?.value.toLowerCase() || '';

        let filtered = [...briefs];

        if (status) {
            filtered = filtered.filter(b => b.status === status);
        }

        if (search) {
            filtered = filtered.filter(b =>
                b.client_name.toLowerCase().includes(search) ||
                (b.client_email && b.client_email.toLowerCase().includes(search)) ||
                (b.project_type && b.project_type.toLowerCase().includes(search))
            );
        }

        renderBriefs(filtered);
    }

    
    async function download(briefId) {
        const brief = briefs.find(b => b.id === briefId);
        if (!brief || !brief.pdf_url) return;

        window.open(brief.pdf_url, '_blank');

        if (brief.status === 'nouveau') {
            await updateStatus(briefId, 'consulte', false);
        }
    }

    
    async function updateStatus(briefId, newStatus, showToast = true) {
        const client = AdminAuth.getClient();
        if (!client) return;

        const id = typeof briefId === 'string' ? parseInt(briefId, 10) : briefId;

        try {
            const updateData = { status: newStatus };

            const { error } = await client
                .from('client_briefs')
                .update(updateData)
                .eq('id', id);

            if (error) throw error;

            if (showToast) {
                Toast.success('Succès', 'Statut mis à jour');
            }

            loadBriefs();

        } catch (err) {
            console.error('Erreur mise à jour statut:', err);
            Toast.error('Erreur', 'Impossible de mettre à jour le statut');
        }
    }

    
    function updateStats() {
        const totalCount = briefs.length;
        const newCount = briefs.filter(b => b.status === 'nouveau').length;

        const statBriefs = document.getElementById('statBriefs');
        if (statBriefs) statBriefs.textContent = totalCount;
    }

    
    function updateNavBadge() {
        const newCount = briefs.filter(b => b.status === 'nouveau').length;
        const badge = document.getElementById('newBriefsCount');

        if (badge) {
            badge.textContent = newCount;
            badge.style.display = newCount > 0 ? 'inline-flex' : 'none';
        }
    }

    
    async function deleteBrief(briefId) {
        const id = typeof briefId === 'string' ? parseInt(briefId, 10) : briefId;

        showDeleteConfirmModal(id);
    }

    
    function showDeleteConfirmModal(briefId) {
        const existingModal = document.getElementById('deleteConfirmModal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'deleteConfirmModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="
                background: #1E293B;
                padding: 2rem;
                border-radius: 12px;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                text-align: center;
                border: 1px solid #334155;
            ">
                <div style="
                    width: 60px;
                    height: 60px;
                    background: rgba(220, 38, 38, 0.2);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 1rem;
                ">
                    <i class="fas fa-trash-alt" style="font-size: 1.5rem; color: #EF4444;"></i>
                </div>
                <h3 style="margin-bottom: 0.5rem; color: #F1F5F9;">Confirmer la suppression</h3>
                <p style="color: #94A3B8; margin-bottom: 1.5rem;">
                    Êtes-vous sûr de vouloir supprimer ce brief ?<br>
                    <strong style="color: #EF4444;">Cette action est irréversible.</strong>
                </p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button id="cancelDeleteBtn" style="
                        padding: 0.75rem 1.5rem;
                        border: 1px solid #475569;
                        background: #334155;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 500;
                        color: #CBD5E1;
                    ">Annuler</button>
                    <button id="confirmDeleteBtn" style="
                        padding: 0.75rem 1.5rem;
                        border: none;
                        background: #DC2626;
                        color: white;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 500;
                    ">Supprimer</button>
                </div>
                <div id="deleteStatus" style="margin-top: 1rem; display: none; color: #94A3B8;"></div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
            modal.remove();
        });

        document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
            await executeDelete(briefId, modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    
    async function executeDelete(briefId, modal) {
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        const cancelBtn = document.getElementById('cancelDeleteBtn');
        const statusDiv = document.getElementById('deleteStatus');

        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Suppression...';
        cancelBtn.disabled = true;
        statusDiv.style.display = 'block';
        statusDiv.textContent = 'Suppression en cours...';

        const client = AdminAuth.getClient();
        if (!client) {
            statusDiv.innerHTML = '<span style="color: #DC2626;">❌ Erreur: Non connecté</span>';
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Réessayer';
            cancelBtn.disabled = false;
            return;
        }

        try {
            statusDiv.textContent = '1/3 - Récupération des infos...';

            const { data: brief, error: fetchError } = await client
                .from('client_briefs')
                .select('pdf_url')
                .eq('id', briefId)
                .single();

            if (fetchError) {
                console.error('Erreur récupération brief:', fetchError);
                statusDiv.innerHTML = `<span style="color: #DC2626;">❌ Erreur: ${fetchError.message || 'Brief non trouvé'}</span>`;
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Réessayer';
                cancelBtn.disabled = false;
                return;
            }

            statusDiv.textContent = '2/3 - Suppression du PDF...';

            if (brief && brief.pdf_url) {
                try {
                    const urlParts = brief.pdf_url.split('/briefs/');
                    if (urlParts.length > 1) {
                        const fileName = decodeURIComponent(urlParts[1].split('?')[0]);
                        await client.storage
                            .from('project-images')
                            .remove([`briefs/${fileName}`]);
                    }
                } catch (storageErr) {
                    console.warn('Erreur storage (non bloquante):', storageErr);
                }
            }

            statusDiv.textContent = '3/3 - Suppression de la base...';

            const { error: deleteError } = await client
                .from('client_briefs')
                .delete()
                .eq('id', briefId);

            if (deleteError) {
                console.error('Erreur suppression DB:', deleteError);
                statusDiv.innerHTML = `<span style="color: #DC2626;">❌ Erreur DB: ${deleteError.message || deleteError.code || 'Erreur inconnue'}</span>`;
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Réessayer';
                cancelBtn.disabled = false;
                return;
            }

            statusDiv.innerHTML = '<span style="color: #16A34A;">✅ Brief supprimé avec succès !</span>';

            setTimeout(() => {
                modal.remove();
                Toast.success('Succès', 'Brief et PDF supprimés');
                loadBriefs(); // Recharger la liste
            }, 1000);

        } catch (err) {
            console.error('Erreur suppression brief:', err);
            const errorMsg = err.message || err.details || JSON.stringify(err);
            statusDiv.innerHTML = `<span style="color: #DC2626;">❌ Erreur: ${errorMsg}</span>`;
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Réessayer';
            cancelBtn.disabled = false;
        }
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
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function getStatusLabel(status) {
        const labels = {
            nouveau: 'Nouveau',
            consulte: 'Consulté',
            archive: 'Archivé'
        };
        return labels[status] || status;
    }

    function getStatusBadge(status) {
        const badges = {
            nouveau: 'danger',
            consulte: 'info',
            archive: 'secondary'
        };
        return badges[status] || 'secondary';
    }

    function debounce(fn, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), delay);
        };
    }

    return {
        init,
        loadBriefs,
        download,
        updateStatus,
        deleteBrief
    };
})();

window.BriefsManager = BriefsManager;
