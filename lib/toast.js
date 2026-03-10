/**
 * SURFPOP - Toast Notifications
 * Lightweight toast notification system
 */

const Toast = (function() {
    let container = null;

    /**
     * Initialize toast container
     */
    function init() {
        if (container) return;

        container = document.createElement('div');
        container.className = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {Object} options - Optional settings
     * @param {number} options.duration - Duration in ms (default 3000)
     * @param {string} options.type - 'info', 'success', 'warning', 'error' (default 'info')
     */
    function show(message, options = {}) {
        init();

        const duration = options.duration || 3000;
        const type = options.type || 'info';

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            background: rgba(0, 0, 0, 0.85);
            color: #f8fafc;
            padding: 12px 20px;
            border-radius: 12px;
            font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 0.9em;
            max-width: 320px;
            text-align: center;
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            opacity: 0;
            transform: translateY(-10px);
            transition: all 0.3s ease;
            pointer-events: auto;
        `;

        // Type-specific styling
        const typeColors = {
            info: '#38bdf8',
            success: '#22c55e',
            warning: '#f59e0b',
            error: '#ef4444'
        };
        toast.style.borderLeftColor = typeColors[type];
        toast.style.borderLeftWidth = '3px';

        toast.textContent = message;
        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        // Auto-dismiss
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';

            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }

    /**
     * Convenience methods
     */
    function info(message, duration) {
        show(message, { type: 'info', duration });
    }

    function success(message, duration) {
        show(message, { type: 'success', duration });
    }

    function warning(message, duration) {
        show(message, { type: 'warning', duration });
    }

    function error(message, duration) {
        show(message, { type: 'error', duration });
    }

    return {
        show,
        info,
        success,
        warning,
        error
    };
})();
