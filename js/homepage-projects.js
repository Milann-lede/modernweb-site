function getProjectTypeLabel(projectType) {
    var labels = {
        site_vitrine: 'Site Vitrine',
        ecommerce: 'E-commerce',
        portfolio: 'Portfolio',
        gaming: 'Site Gaming',
        application: 'Application Web',
        immobilier: 'Immobilier',
        autre: 'Projet Web'
    };
    return labels[projectType] || 'Projet';
}

function renderHomeProjectCard(project) {
    var themeClass = project.theme && project.theme !== 'default' ? 'project-' + project.theme : '';
    var projectTypeLabel = getProjectTypeLabel(project.project_type);
    var projectId = project.id || Math.random().toString(36).substr(2, 9);

    var imageHtml = project.cover_image
        ? '<img src="' + project.cover_image + '" alt="' + project.title + '" width="600" height="400" loading="lazy">'
        : '<div class="project-placeholder"><i class="fas fa-image" aria-hidden="true"></i></div>';

    var linkHtml = project.link
        ? '<a href="' + project.link + '" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">Découvrir</a>'
        : '<span class="btn btn-primary btn-sm disabled">Bientôt</span>';

    var moreInfoHtml = project.description
        ? '<button type="button" class="btn btn-outline btn-sm btn-more-info"' +
          ' data-title="' + project.title + '"' +
          ' data-category="' + projectTypeLabel + '"' +
          ' data-desc="' + project.description + '"' +
          ' data-image="' + (project.cover_image || '') + '"' +
          ' data-link="' + (project.link || '') + '"' +
          ' data-client="' + (project.client_name || '') + '"' +
          ' data-techs="' + (project.technologies ? project.technologies.join(', ') : '') + '">' +
          '<i class="fas fa-info-circle" aria-hidden="true"></i> Plus d\'infos</button>'
        : '';

    return '<article class="project-card-home ' + themeClass + '" data-project-id="' + projectId + '">' +
        '<div class="project-image">' + imageHtml + '</div>' +
        '<div class="project-info">' +
            '<span class="project-category">' + projectTypeLabel + '</span>' +
            '<h3 class="project-title project-title-large">' + project.title + '</h3>' +
            '<p class="project-desc">' + (project.short_desc || '') + '</p>' +
            '<div class="project-actions home-project-actions">' + linkHtml + moreInfoHtml + '</div>' +
        '</div>' +
    '</article>';
}

function initProjectModal() {
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

document.addEventListener('DOMContentLoaded', async function () {
    var grid = document.getElementById('featuredProjectsGrid');
    var loader = document.getElementById('featuredProjectsLoader');

    if (!grid) return;

    if (typeof ProjectsService === 'undefined') {
        console.error('ProjectsService non disponible');
        if (loader) loader.innerHTML = '<p>Erreur de chargement des services</p>';
        return;
    }

    try {
        var projects = await ProjectsService.getFeaturedProjects();

        if (loader) loader.remove();

        if (!projects || projects.length === 0) {
            grid.innerHTML = '<div class="text-center col-span-full"><p>Projets à venir...</p></div>';
            return;
        }

        projects.slice(0, 10).forEach(function (project) {
            grid.innerHTML += renderHomeProjectCard(project);
        });

        initProjectModal();

        var cards = Array.from(grid.querySelectorAll('article'));
        var totalCards = cards.length;
        var currentIndex = 0;
        var autoScrollTimer = null;
        var isTouching = false;
        var isMobile = function () { return window.innerWidth <= 768; };

        var dotsContainer = document.createElement('div');
        dotsContainer.className = 'carousel-dots';
        cards.forEach(function (_, i) {
            var dot = document.createElement('button');
            dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', 'Projet ' + (i + 1));
            dot.addEventListener('click', function () { goToSlide(i); });
            dotsContainer.appendChild(dot);
        });
        grid.parentNode.appendChild(dotsContainer);

        function updateDots() {
            dotsContainer.querySelectorAll('.carousel-dot').forEach(function (dot, i) {
                dot.classList.toggle('active', i === currentIndex);
            });
        }

        function goToSlide(index) {
            currentIndex = index;
            if (isMobile()) {
                var target = cards[index];
                if (target) {
                    grid.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
                }
            } else {
                var cardWidth = cards[0].offsetWidth + parseFloat(getComputedStyle(grid).gap || 0);
                grid.scrollTo({ left: cardWidth * index, behavior: 'smooth' });
            }
            updateDots();
        }

        function nextSlide() {
            currentIndex = (currentIndex + 1) % totalCards;
            goToSlide(currentIndex);
        }

        var scrollTimeout;
        grid.addEventListener('scroll', function () {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(function () {
                if (!isMobile()) return;
                var center = grid.scrollLeft + grid.offsetWidth / 2;
                var closestIndex = 0;
                var closestDist = Infinity;
                cards.forEach(function (card, i) {
                    var cardCenter = card.offsetLeft + card.offsetWidth / 2;
                    var dist = Math.abs(center - cardCenter);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestIndex = i;
                    }
                });
                currentIndex = closestIndex;
                updateDots();
            }, 100);
        }, { passive: true });

        function startAutoScroll() {
            stopAutoScroll();
            autoScrollTimer = setInterval(function () {
                if (!isTouching) nextSlide();
            }, 5000);
        }

        function stopAutoScroll() {
            if (autoScrollTimer) clearInterval(autoScrollTimer);
        }

        startAutoScroll();

        grid.addEventListener('mouseenter', stopAutoScroll);
        grid.addEventListener('mouseleave', startAutoScroll);

        grid.addEventListener('touchstart', function () {
            isTouching = true;
            stopAutoScroll();
        }, { passive: true });

        grid.addEventListener('touchend', function () {
            isTouching = false;
            setTimeout(startAutoScroll, 500);
        }, { passive: true });

    } catch (err) {
        console.error('Erreur chargement projets:', err);
        if (loader) loader.innerHTML = '<p>Chargement...</p>';
    }
});
