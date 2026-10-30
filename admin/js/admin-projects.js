

const ProjectsManager = (function () {
    'use strict';

    let projects = [];
    let currentProjectId = null;
    let thumbnailFile = null;

    const modal = document.getElementById('projectModal');
    const deleteModal = document.getElementById('deleteModal');
    const form = document.getElementById('projectForm');
    const tableBody = document.getElementById('projectsTableBody');
    const emptyState = document.getElementById('projectsEmpty');

    const fields = {
        id: document.getElementById('projectId'),
        name: document.getElementById('projectName'),
        slug: document.getElementById('projectSlug'),
        clientType: document.getElementById('projectClientType'),
        projectType: document.getElementById('projectType'),
        category: document.getElementById('projectCategory'),
        shortDesc: document.getElementById('projectShortDesc'),
        fullDesc: document.getElementById('projectFullDesc'),
        technologies: document.getElementById('projectTechnologies'),
        date: document.getElementById('projectDate'),
        status: document.getElementById('projectStatus'),
        link: document.getElementById('projectLink'),
        thumbnail: document.getElementById('projectThumbnail'),
        featured: document.getElementById('projectFeatured')
    };

    
    async function analyzeImageColors(imageFile) {
        return new Promise((resolve) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
                const size = 50;
                canvas.width = size;
                canvas.height = size;
                ctx.drawImage(img, 0, 0, size, size);

                const imageData = ctx.getImageData(0, 0, size, size);
                const data = imageData.data;

                let totalH = 0, totalS = 0, totalL = 0;
                let pixelCount = 0;

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i] / 255;
                    const g = data[i + 1] / 255;
                    const b = data[i + 2] / 255;

                    const max = Math.max(r, g, b);
                    const min = Math.min(r, g, b);
                    let h, s, l = (max + min) / 2;

                    if (max === min) {
                        h = s = 0;
                    } else {
                        const d = max - min;
                        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

                        switch (max) {
                            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                            case g: h = ((b - r) / d + 2) / 6; break;
                            case b: h = ((r - g) / d + 4) / 6; break;
                        }
                    }

                    if (s > 0.1) {
                        totalH += h * 360;
                        totalS += s * 100;
                        totalL += l * 100;
                        pixelCount++;
                    }
                }

                URL.revokeObjectURL(img.src);

                if (pixelCount === 0) {
                    resolve({ hue: 0, saturation: 0, lightness: 50 });
                } else {
                    resolve({
                        hue: totalH / pixelCount,
                        saturation: totalS / pixelCount,
                        lightness: totalL / pixelCount
                    });
                }
            };

            img.onerror = () => resolve({ hue: 0, saturation: 0, lightness: 50 });
            img.src = URL.createObjectURL(imageFile);
        });
    }

    
    function mapColorsToTheme({ hue, saturation, lightness }) {
        if (saturation < 15) {
            return lightness > 50 ? 'minimal' : 'dark';
        }

        if (lightness < 25) {
            if (hue >= 0 && hue < 30) return 'fire';
            if (hue >= 180 && hue < 260) return 'midnight';
            if (hue >= 260 && hue < 330) return 'gaming';
            return 'dark';
        }

        if (lightness > 75) {
            if (hue >= 30 && hue < 60) return 'gold';
            if (hue >= 60 && hue < 90) return 'electric';
            return 'minimal';
        }

        if (hue >= 345 || hue < 15) return 'fire';

        if (hue >= 15 && hue < 45) return 'sunset';

        if (hue >= 45 && hue < 65) return 'gold';

        if (hue >= 65 && hue < 90) return 'electric';

        if (hue >= 90 && hue < 140) {
            return lightness > 40 ? 'nature' : 'forest';
        }

        if (hue >= 140 && hue < 190) return 'arctic';

        if (hue >= 190 && hue < 240) {
            return lightness > 40 ? 'ocean' : 'midnight';
        }

        if (hue >= 240 && hue < 290) {
            return saturation > 50 ? 'neon' : 'lavender';
        }

        if (hue >= 290 && hue < 330) {
            return saturation > 60 ? 'gaming' : 'rose';
        }

        if (hue >= 330 && hue < 345) return 'coral';

        return 'default';
    }

    
    async function detectAutoTheme(projectType, title, description, imageFile = null) {
        if (imageFile && imageFile.size > 0) {
            try {
                const colors = await analyzeImageColors(imageFile);
                const suggestedTheme = mapColorsToTheme(colors);

                const hint = document.getElementById('themeHint');
                if (hint) {
                    hint.textContent = `💡 Thème suggéré : ${suggestedTheme} (basé sur les couleurs de l'image)`;
                    hint.style.color = '#22c55e';
                }

                return suggestedTheme;
            } catch (err) {
                console.warn('Erreur analyse couleurs:', err);
            }
        }

        const text = `${title} ${description}`.toLowerCase();

        const keywordThemes = [
            { keywords: ['jardin', 'bio', 'nature', 'plante', 'vert', 'eco', 'éco', 'agricole', 'ferme'], theme: 'nature' },
            { keywords: ['game', 'gaming', 'jeu', 'esport', 'néon', 'cyber', 'arcade'], theme: 'gaming' },
            { keywords: ['tech', 'digital', 'planner', 'app', 'saas', 'startup', 'business', 'software'], theme: 'tech' },
            { keywords: ['luxe', 'premium', 'gold', 'bijou', 'or', 'prestige'], theme: 'gold' },
            { keywords: ['ocean', 'mer', 'voyage', 'bateau', 'maritime'], theme: 'ocean' },
            { keywords: ['feu', 'sport', 'énergie', 'fitness', 'gym'], theme: 'fire' },
            { keywords: ['spa', 'bien-être', 'yoga', 'zen', 'relaxation'], theme: 'lavender' },
            { keywords: ['café', 'restaurant', 'food', 'cuisine', 'artisan'], theme: 'earth' },
            { keywords: ['mariage', 'événement', 'fleur', 'décoration'], theme: 'rose' },
            { keywords: ['musique', 'club', 'nuit', 'dj', 'festival'], theme: 'neon' },
            { keywords: ['science', 'espace', 'astronomie', 'recherche'], theme: 'midnight' },
            { keywords: ['vintage', 'rétro', 'ancien', 'antique', 'histoire'], theme: 'vintage' }
        ];

        for (const rule of keywordThemes) {
            if (rule.keywords.some(kw => text.includes(kw))) {
                return rule.theme;
            }
        }

        const typeThemeMap = {
            'ecommerce': 'tech',
            'gaming': 'gaming',
            'site_vitrine': 'nature',
            'portfolio': 'minimal',
            'application': 'tech',
            'immobilier': 'earth'
        };

        return typeThemeMap[projectType] || 'default';
    }

    
    function init() {
        setupEventListeners();
        loadProjects();
    }

    
    function setupEventListeners() {
        document.getElementById('addProjectBtn')?.addEventListener('click', () => openModal());
        document.getElementById('addProjectEmptyBtn')?.addEventListener('click', () => openModal());

        document.getElementById('projectModalClose')?.addEventListener('click', closeModal);
        document.getElementById('projectModalCancel')?.addEventListener('click', closeModal);
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        form?.addEventListener('submit', handleSubmit);

        fields.name?.addEventListener('input', () => {
            if (!fields.slug.value || fields.slug.dataset.auto === 'true') {
                fields.slug.value = generateSlug(fields.name.value);
                fields.slug.dataset.auto = 'true';
            }
        });

        fields.slug?.addEventListener('input', () => {
            fields.slug.dataset.auto = 'false';
        });

        const thumbnailUpload = document.getElementById('thumbnailUpload');
        thumbnailUpload?.addEventListener('click', () => fields.thumbnail.click());
        thumbnailUpload?.addEventListener('dragover', (e) => {
            e.preventDefault();
            thumbnailUpload.classList.add('dragover');
        });
        thumbnailUpload?.addEventListener('dragleave', () => {
            thumbnailUpload.classList.remove('dragover');
        });
        thumbnailUpload?.addEventListener('drop', (e) => {
            e.preventDefault();
            thumbnailUpload.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                handleThumbnailSelect(e.dataTransfer.files[0]);
            }
        });

        fields.thumbnail?.addEventListener('change', (e) => {
            if (e.target.files.length) {
                handleThumbnailSelect(e.target.files[0]);
            }
        });

        document.getElementById('filterStatus')?.addEventListener('change', filterProjects);
        document.getElementById('filterCategory')?.addEventListener('change', filterProjects);
        document.getElementById('searchProjects')?.addEventListener('input', debounce(filterProjects, 300));

        document.getElementById('deleteModalClose')?.addEventListener('click', closeDeleteModal);
        document.getElementById('deleteModalCancel')?.addEventListener('click', closeDeleteModal);
        document.getElementById('deleteModalConfirm')?.addEventListener('click', confirmDelete);
    }

    
    async function loadProjects() {
        const client = AdminAuth.getClient();
        if (!client) return;

        try {
            const { data, error } = await client
                .from('projects')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            projects = data || [];
            renderProjects(projects);
            updateStats();
        } catch (err) {
            console.error('Erreur chargement projets:', err);
            Toast.error('Erreur', 'Impossible de charger les projets');
        }
    }

    
    function renderProjects(data) {
        if (!tableBody) return;

        if (!data.length) {
            tableBody.innerHTML = '';
            emptyState && (emptyState.hidden = false);
            return;
        }

        emptyState && (emptyState.hidden = true);

        tableBody.innerHTML = data.map(project => `
            <tr data-id="${project.id}">
                <td>
                    <div class="project-row">
                        ${project.cover_image
                ? `<img src="${project.cover_image}" alt="${project.title}" class="project-thumbnail">`
                : '<div class="project-thumbnail"></div>'
            }
                        <div class="project-info">
                            <div class="project-name">${escapeHtml(project.title)}</div>
                            <div class="project-client-type">${project.client_type === 'professionnel' ? 'Pro' : 'Particulier'}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge badge-secondary">
                        ${project.client_type === 'professionnel' ? 'Professionnel' : 'Particulier'}
                    </span>
                </td>
                <td>
                    <span class="badge badge-${getStatusBadge(project.status)}">
                        ${getStatusLabel(project.status)}
                    </span>
                </td>
                <td>${formatDate(project.project_date)}</td>
                <td>
                    <div class="actions-cell">
                        <button class="action-btn edit" title="Modifier" onclick="ProjectsManager.edit('${project.id}')">
                            <i class="fas fa-pen"></i>
                        </button>
                        ${project.link ? `
                            <a href="${project.link}" target="_blank" class="action-btn view" title="Voir le site">
                                <i class="fas fa-external-link-alt"></i>
                            </a>
                        ` : ''}
                        <button class="action-btn delete" title="Supprimer" onclick="ProjectsManager.delete('${project.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    
    function filterProjects() {
        const status = document.getElementById('filterStatus')?.value || '';
        const category = document.getElementById('filterCategory')?.value || '';
        const search = document.getElementById('searchProjects')?.value.toLowerCase() || '';

        let filtered = [...projects];

        if (status) {
            filtered = filtered.filter(p => p.status === status);
        }

        if (category) {
            filtered = filtered.filter(p => p.category === category);
        }

        if (search) {
            filtered = filtered.filter(p =>
                p.title.toLowerCase().includes(search) ||
                (p.short_desc && p.short_desc.toLowerCase().includes(search))
            );
        }

        renderProjects(filtered);
    }

    
    function openModal(projectId = null) {
        currentProjectId = projectId;
        thumbnailFile = null;

        const modalTitle = document.getElementById('projectModalTitle');
        const thumbnailPreview = document.getElementById('thumbnailPreview');

        if (projectId) {
            const numericId = Number(projectId);
            const project = projects.find(p => p.id === numericId || p.id === projectId);
            if (!project) {
                console.error('Projet non trouvé:', projectId, 'dans', projects.map(p => p.id));
                return;
            }

            modalTitle.textContent = 'Modifier le projet';
            populateForm(project);

            if (project.cover_image) {
                showThumbnailPreview(project.cover_image);
            }
        } else {
            modalTitle.textContent = 'Nouveau projet';
            form.reset();
            fields.slug.dataset.auto = 'true';
            thumbnailPreview && (thumbnailPreview.hidden = true);
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    
    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        currentProjectId = null;
        thumbnailFile = null;
    }

    
    function populateForm(project) {
        fields.id.value = project.id;
        fields.name.value = project.title || '';
        fields.slug.value = '';
        fields.slug.dataset.auto = 'true';
        fields.clientType.value = project.client_type || 'particulier';
        fields.projectType.value = project.project_type || 'site_vitrine';
        fields.category.value = project.theme || 'auto';
        fields.shortDesc.value = project.short_desc || '';
        fields.fullDesc.value = project.description || '';
        fields.technologies.value = (project.technologies || []).join(', ');
        fields.date.value = project.project_date || '';
        fields.status.value = project.status || 'en_cours';
        fields.link.value = project.link || '';
        fields.featured.checked = project.featured || false;
    }

    
    function handleThumbnailSelect(file) {
        if (!file.type.startsWith('image/')) {
            Toast.error('Erreur', 'Veuillez sélectionner une image');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            Toast.error('Erreur', 'L\'image ne doit pas dépasser 5 Mo');
            return;
        }

        thumbnailFile = file;

        const reader = new FileReader();
        reader.onload = (e) => showThumbnailPreview(e.target.result);
        reader.readAsDataURL(file);
    }

    
    function showThumbnailPreview(src) {
        const preview = document.getElementById('thumbnailPreview');
        if (!preview) return;

        preview.innerHTML = `
            <img src="${src}" alt="Prévisualisation">
            <button type="button" class="remove-btn" onclick="ProjectsManager.removeThumbnail()">
                <i class="fas fa-times"></i>
            </button>
        `;
        preview.hidden = false;
    }

    
    function removeThumbnail() {
        thumbnailFile = null;
        const preview = document.getElementById('thumbnailPreview');
        if (preview) preview.hidden = true;
        if (fields.thumbnail) fields.thumbnail.value = '';
    }

    
    async function handleSubmit(e) {
        e.preventDefault();

        const client = AdminAuth.getClient();
        if (!client) {
            Toast.error('Erreur', 'Non connecté');
            return;
        }

        const saveBtn = document.getElementById('projectModalSave');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';

        try {
            let thumbnailUrl = null;

            if (thumbnailFile) {
                const fileExt = thumbnailFile.name.split('.').pop();
                const fileName = `${fields.slug.value || 'project'}_${Date.now()}.${fileExt}`;

                const { error: uploadError } = await client.storage
                    .from('project-images')
                    .upload(fileName, thumbnailFile);

                if (!uploadError) {
                    const { data: { publicUrl } } = client.storage
                        .from('project-images')
                        .getPublicUrl(fileName);
                    thumbnailUrl = publicUrl;
                }
            }

            let themeValue = fields.category.value;
            if (themeValue === 'auto') {
                themeValue = await detectAutoTheme(
                    fields.projectType.value,
                    fields.name.value,
                    fields.shortDesc.value + ' ' + fields.fullDesc.value,
                    thumbnailFile // Passer le fichier image pour analyse des couleurs
                );
            }

            const projectData = {
                title: fields.name.value.trim(),
                client_type: fields.clientType.value,
                project_type: fields.projectType.value,
                theme: themeValue,
                short_desc: fields.shortDesc.value.trim(),
                description: fields.fullDesc.value.trim(),
                technologies: fields.technologies.value.split(',').map(t => t.trim()).filter(Boolean),
                project_date: fields.date.value || null,
                status: fields.status.value,
                link: fields.link.value.trim() || null,
                featured: fields.featured.checked
            };

            if (thumbnailUrl) {
                projectData.cover_image = thumbnailUrl;
            }

            let result;

            if (currentProjectId) {
                result = await client
                    .from('projects')
                    .update(projectData)
                    .eq('id', currentProjectId)
                    .select();
            } else {
                result = await client
                    .from('projects')
                    .insert([projectData])
                    .select();
            }

            if (result.error) throw result.error;

            Toast.success('Succès', currentProjectId ? 'Projet mis à jour' : 'Projet créé');
            closeModal();
            loadProjects();

        } catch (err) {
            console.error('Erreur sauvegarde projet:', err);
            Toast.error('Erreur', err.message || 'Impossible de sauvegarder le projet');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Enregistrer';
        }
    }

    
    function edit(projectId) {
        openModal(projectId);
    }

    
    function deleteProject(projectId) {
        currentProjectId = projectId;
        const project = projects.find(p => p.id == projectId);

        if (project) {
            document.getElementById('deleteModalText').textContent =
                `Êtes-vous sûr de vouloir supprimer "${project.title}" ?`;
        }

        deleteModal.classList.add('active');
    }

    
    function closeDeleteModal() {
        deleteModal.classList.remove('active');
        currentProjectId = null;
    }

    
    async function confirmDelete() {
        if (!currentProjectId) return;

        const client = AdminAuth.getClient();
        if (!client) return;

        try {
            const { error } = await client
                .from('projects')
                .delete()
                .eq('id', currentProjectId);

            if (error) throw error;

            Toast.success('Succès', 'Projet supprimé');
            closeDeleteModal();
            loadProjects();

        } catch (err) {
            console.error('Erreur suppression:', err);
            Toast.error('Erreur', 'Impossible de supprimer le projet');
        }
    }

    
    function updateStats() {
        const publishedCount = projects.filter(p => p.status === 'publie').length;
        const pendingCount = projects.filter(p => p.status === 'en_cours').length;

        const statProjects = document.getElementById('statProjects');
        const statPending = document.getElementById('statPending');

        if (statProjects) statProjects.textContent = publishedCount;
        if (statPending) statPending.textContent = pendingCount;

        renderRecentProjects();
    }

    
    function renderRecentProjects() {
        const container = document.getElementById('recentProjects');
        if (!container) return;

        const recent = projects.slice(0, 5);

        if (!recent.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Aucun projet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = recent.map(project => `
            <div class="recent-project-item">
                ${project.cover_image
                ? `<img src="${project.cover_image}" alt="${project.title}" class="recent-project-thumb">`
                : '<div class="recent-project-thumb"></div>'
            }
                <div class="recent-project-info">
                    <div class="recent-project-name">${escapeHtml(project.title)}</div>
                    <div class="recent-project-date">${formatDate(project.created_at)}</div>
                </div>
                <span class="badge badge-${getStatusBadge(project.status)}">
                    ${getStatusLabel(project.status)}
                </span>
            </div>
        `).join('');
    }

    
    function getPublishedProjects() {
        return projects.filter(p => p.status === 'publie');
    }

    function generateSlug(text) {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
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

    function getStatusLabel(status) {
        const labels = {
            en_cours: 'En cours',
            termine: 'Terminé',
            publie: 'Publié'
        };
        return labels[status] || status;
    }

    function getStatusBadge(status) {
        const badges = {
            en_cours: 'warning',
            termine: 'info',
            publie: 'success'
        };
        return badges[status] || 'secondary';
    }

    function getCategoryBadge(category) {
        const badges = {
            nature: 'success',
            tech: 'primary',
            gaming: 'info',
            construction: 'warning'
        };
        return badges[category] || 'secondary';
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
        loadProjects,
        edit,
        delete: deleteProject,
        removeThumbnail,
        getPublishedProjects
    };
})();

window.ProjectsManager = ProjectsManager;
