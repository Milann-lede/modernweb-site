

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('qcm-modal');
    const startBtn = document.getElementById('start-quiz-btn');
    const closeBtn = document.querySelector('.close-modal');
    const container = document.getElementById('qcm-container');

    const questions = [
        {
            id: 'goal',
            question: "Quel est l'objectif principal de votre futur site ?",
            options: [
                { value: 'vitrine', label: 'Présenter mon activité et mes services' },
                { value: 'ecommerce', label: 'Vendre des produits en ligne' },
                { value: 'portfolio', label: 'Montrer mes réalisations (Book/Portfolio)' },
                { value: 'rdv', label: 'Prendre des rendez-vous en ligne' }
            ]
        },
        {
            id: 'design',
            question: "Avez-vous déjà une identité visuelle (Logo, couleurs) ?",
            options: [
                { value: 'yes', label: 'Oui, j\'ai tout ce qu\'il faut' },
                { value: 'partial', label: 'J\'ai un logo mais pas de charte graphique' },
                { value: 'no', label: 'Non, il faut tout créer' }
            ]
        },
        {
            id: 'deadline',
            question: "Pour quand souhaitez-vous que le site soit en ligne ?",
            options: [
                { value: 'urgent', label: 'Le plus tôt possible (Urgent)' },
                { value: 'month', label: 'Dans le mois à venir' },
                { value: 'flexible', label: 'Je n\'ai pas de date précise' }
            ]
        }
    ];

    let currentStepIndex = 0;
    let userAnswers = {};

    if (startBtn) {
        startBtn.addEventListener('click', () => {
            currentStepIndex = 0;
            userAnswers = {};
            renderStep(currentStepIndex);
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    
    function closeModal() {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    }

    
    function renderStep(index) {
        if (index >= questions.length) {
            showResult();
            return;
        }

        const q = questions[index];
        const stepHtml = `
            <div class="qcm-step active">
                <h3>Question ${index + 1}/${questions.length}</h3>
                <h4 style="margin-top:0.5rem; margin-bottom:1.5rem;">${q.question}</h4>
                <div class="qcm-options">
                    ${q.options.map(opt => `
                        <button class="qcm-option" data-value="${opt.value}">
                            ${opt.label}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        container.innerHTML = stepHtml;

        container.querySelectorAll('.qcm-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.dataset.value;
                userAnswers[q.id] = val;
                currentStepIndex++;
                renderStep(currentStepIndex);
            });
        });
    }

    
    function showResult() {
        let title = "Solution Recommandée";
        let desc = "";

        if (userAnswers.goal === 'ecommerce') {
            title = "Site E-commerce";
            desc = "Pour vendre vos produits, nous vous recommandons une solution e-commerce robuste (comme Shopify ou une solution sur mesure) optimisée pour la conversion.";
        } else if (userAnswers.goal === 'rdv') {
            title = "Site Vitrine avec Prise de RDV";
            desc = "Un site vitrine élégant intégrant un module de réservation automatique pour simplifier votre gestion.";
        } else if (userAnswers.goal === 'portfolio') {
            title = "Portfolio Interactif";
            desc = "Un site axé sur le visuel pour mettre en valeur vos créations avec des galeries dynamiques.";
        } else {
            title = "Site Vitrine Premium";
            desc = "La solution idéale pour présenter votre entreprise, vos valeurs et attirer de nouveaux clients.";
        }

        if (userAnswers.design === 'no') {
            desc += "<br><br><strong>Note :</strong> Nous pourrons également nous charger de la création complète de votre identité visuelle.";
        }

        const resultHtml = `
            <div class="qcm-result qcm-step active">
                <i class="fas fa-check-circle" style="font-size: 4rem; color: var(--primary); margin-bottom: 1rem;"></i>
                <h3 style="margin-bottom: 1rem;">${title}</h3>
                <p style="color: var(--text-light); margin-bottom: 2rem; line-height: 1.6;">${desc}</p>
                <a href="pages/contact.html?subject=Devis_${title.replace(/\s+/g, '_')}" class="btn btn-primary">
                    Demander un devis pour ce projet
                </a>
                <br>
                <button class="btn btn-outline" style="margin-top: 1rem; border:none;" onclick="location.reload()">Recommencer</button>
            </div>
        `;
        container.innerHTML = resultHtml;
    }
});
