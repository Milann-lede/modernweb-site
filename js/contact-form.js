document.addEventListener('DOMContentLoaded', function () {
    if (typeof emailjs === 'undefined' || typeof EMAILJS_CONFIG === 'undefined') return;

    emailjs.init({ publicKey: EMAILJS_CONFIG.CONTACT_PUBLIC_KEY });

    function showToast(message, type) {
        type = type || 'success';
        var existingToast = document.querySelector('.toast-notification');
        if (existingToast) existingToast.remove();

        var toast = document.createElement('div');
        toast.className = 'toast-notification toast-' + type;

        var icon = type === 'success' ? 'fa-check' : 'fa-exclamation-triangle';
        var title = type === 'success' ? 'Message envoyé !' : 'Erreur';

        toast.innerHTML =
            '<div class="toast-icon"><i class="fas ' + icon + '"></i></div>' +
            '<div class="toast-content"><h4>' + title + '</h4><p>' + message + '</p></div>' +
            '<button class="toast-close" aria-label="Fermer"><i class="fas fa-times"></i></button>';

        toast.querySelector('.toast-close').addEventListener('click', function () {
            toast.remove();
        });

        document.body.appendChild(toast);
        setTimeout(function () { toast.classList.add('active'); }, 10);
        setTimeout(function () {
            toast.classList.remove('active');
            setTimeout(function () { toast.remove(); }, 400);
        }, 5000);
    }

    var contactForm = document.getElementById('contact-form');
    if (!contactForm) return;

    contactForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        var submitBtn = this.querySelector('button[type="submit"]');
        var originalBtnContent = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi en cours...';
        submitBtn.disabled = true;

        var formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            subject: document.getElementById('subject').value,
            message: document.getElementById('message').value
        };

        try {
            var templateParams = {
                from_name: formData.name,
                email: formData.email,
                type_demande: formData.subject,
                message: formData.message,
                reply_to: formData.email
            };

            await emailjs.send(
                EMAILJS_CONFIG.CONTACT_SERVICE_ID,
                EMAILJS_CONFIG.CONTACT_TEMPLATE_ID,
                templateParams
            );

            showToast('Votre message a bien été envoyé ! Nous vous répondrons sous 24h.', 'success');
            contactForm.reset();

            try {
                fetch('../api/send-contact.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                }).catch(function () {});
            } catch (_) {}

        } catch (error) {
            console.error('Erreur EmailJS:', error);

            try {
                var controller = new AbortController();
                var timeoutId = setTimeout(function () { controller.abort(); }, 5000);

                var response = await fetch('../api/send-contact.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    var text = await response.text();
                    var data = JSON.parse(text);
                    if (data.success) {
                        showToast('Votre message a bien été envoyé ! Nous vous répondrons sous 24h.', 'success');
                        contactForm.reset();
                        return;
                    }
                }
                throw new Error('PHP fallback failed');
            } catch (phpError) {
                console.error('Erreur PHP fallback:', phpError);

                if (window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === 'localhost' ||
                    window.location.hostname === '') {
                    showToast('Message envoyé (Simulation Locale).', 'success');
                    contactForm.reset();
                } else {
                    showToast("Une erreur est survenue lors de l'envoi. Veuillez réessayer ou nous contacter par email.", 'error');
                }
            }
        } finally {
            submitBtn.innerHTML = originalBtnContent;
            submitBtn.disabled = false;
        }
    });
});
