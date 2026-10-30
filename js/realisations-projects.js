document.addEventListener('DOMContentLoaded', async function () {
    var grid = document.getElementById('projectsGrid');
    if (!grid) return;

    var attempts = 0;
    while (typeof ProjectsService === 'undefined' && attempts < 50) {
        await new Promise(function (r) { setTimeout(r, 100); });
        attempts++;
    }

    if (typeof ProjectsService === 'undefined') {
        console.error('ProjectsService non disponible');
        return;
    }

    var staticKeywords = ['jardins', 'digital', 'planner'];

    try {
        var projects = await ProjectsService.getPublishedProjects();

        if (!projects || projects.length === 0) return;

        var newProjects = projects.filter(function (p) {
            if (!p.title) return true;
            var titleLower = p.title.toLowerCase();
            return !staticKeywords.some(function (kw) { return titleLower.includes(kw); });
        });

        if (newProjects.length === 0) return;

        newProjects.forEach(function (project) {
            var cardHtml = ProjectsService.renderProjectCard(project);
            grid.insertAdjacentHTML('beforeend', cardHtml);
        });

        initRealisationsModal();

        if (typeof initPortfolioFilters === 'function') {
            initPortfolioFilters();
        }

    } catch (err) {
        console.error('Erreur chargement projets:', err);
    }
});

function initRealisationsModal() {
    var modal = document.getElementById('projectDetailModal');
    if (!modal) return;

    var moreInfoBtns = document.querySelectorAll('.btn-more-info');

    moreInfoBtns.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.preventDefault();

            var title = this.getAttribute('data-title');
            var category = this.getAttribute('data-category');
            var desc = this.getAttribute('data-desc');
            var image = this.getAttribute('data-image');
            var link = this.getAttribute('data-link');
            var client = this.getAttribute('data-client');
            var techs = this.getAttribute('data-techs');

            document.getElementById('modalTitle').textContent = title;
            document.getElementById('modalCategory').textContent = category;
            document.getElementById('modalDesc').textContent = desc;

            var modalImage = document.getElementById('modalImage');
            var imageContainer = document.querySelector('.modal-image-container');
            if (image) {
                modalImage.src = image;
                modalImage.alt = title;
                imageContainer.style.display = 'block';
            } else {
                imageContainer.style.display = 'none';
            }

            var clientContainer = document.getElementById('modalClientContainer');
            if (client) {
                document.getElementById('modalClient').textContent = client;
                clientContainer.style.display = 'block';
            } else {
                clientContainer.style.display = 'none';
            }

            var techsContainer = document.getElementById('modalTechsContainer');
            if (techs) {
                document.getElementById('modalTechs').textContent = techs;
                techsContainer.style.display = 'block';
            } else {
                techsContainer.style.display = 'none';
            }

            var modalLink = document.getElementById('modalLink');
            if (link) {
                modalLink.href = link;
                modalLink.style.display = 'inline-flex';
            } else {
                modalLink.style.display = 'none';
            }

            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });

    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    var closeBtn = modal.querySelector('.modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
    });
}
