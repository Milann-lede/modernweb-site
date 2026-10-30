

const Toast = (function () {
    'use strict';

    const container = document.getElementById('toastContainer');
    const DURATION = 5000; // Durée par défaut (5s)
    const ERROR_DURATION = 15000; // Durée pour les erreurs (15s)

    
    function show(type, title, message = '') {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${icons[type]} toast-icon"></i>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(toast);

        toast.querySelector('.toast-close').addEventListener('click', () => {
            removeToast(toast);
        });

        const duration = type === 'error' ? ERROR_DURATION : DURATION;
        setTimeout(() => {
            removeToast(toast);
        }, duration);
    }

    
    function removeToast(toast) {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    function success(title, message) { show('success', title, message); }
    function error(title, message) { show('error', title, message); }
    function warning(title, message) { show('warning', title, message); }
    function info(title, message) { show('info', title, message); }

    return { show, success, error, warning, info };
})();

const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

window.Toast = Toast;
