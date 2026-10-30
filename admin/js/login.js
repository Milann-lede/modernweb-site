

(function () {
    'use strict';

    const form = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const errorBox = document.getElementById('loginError');
    const errorText = document.getElementById('loginErrorText');
    const togglePasswordBtn = document.querySelector('.toggle-password');
    const passwordInput = document.getElementById('password');

    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', function () {
            const isHidden = passwordInput.type === 'password';
            passwordInput.type = isHidden ? 'text' : 'password';
            this.querySelector('i').classList.toggle('fa-eye', !isHidden);
            this.querySelector('i').classList.toggle('fa-eye-slash', isHidden);
        });
    }

    function showError(message) {
        errorText.textContent = message;
        errorBox.hidden = false;
    }

    function hideError() {
        errorBox.hidden = true;
    }

    function setLoading(loading) {
        const btnText = loginBtn.querySelector('.btn-text');
        const btnLoader = loginBtn.querySelector('.btn-loader');
        loginBtn.disabled = loading;
        btnText.hidden = loading;
        btnLoader.hidden = !loading;
    }

    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            hideError();

            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            if (!email || !password) {
                showError('Veuillez remplir tous les champs.');
                return;
            }

            setLoading(true);

            const result = await AdminAuth.login(email, password);

            setLoading(false);

            if (result.success) {
                window.location.href = 'index.html';
            } else {
                showError(result.error || 'Erreur de connexion.');
            }
        });
    }
})();
