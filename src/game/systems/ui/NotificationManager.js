/**
 * NotificationManager - Handles toast notifications and refresh prompts
 */
export class NotificationManager {
    constructor(game, uiManager) {
        this.game = game;
        this.uiManager = uiManager;
    }

    /**
     * Show a toast notification at the top of the screen
     * @param {string} message - Notification text
     * @param {string} type - One of: 'info', 'success', 'warning', 'error'
     * @param {number} duration - Duration in ms before auto-dismiss (default: 3000)
     */
    showGameNotification(message, type = 'info', duration = 3000) {
        // Log for CLI testing
        console.log('[GAME_NOTIFICATION]', type, message);

        const container = document.getElementById('game-notifications');
        if (!container) {
            console.warn('game-notifications container not found');
            return;
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `game-notification ${type}`;

        // Icon based on type
        const icons = {
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            success: '✅'
        };
        const icon = icons[type] || icons.info;

        notification.innerHTML = `
            <span class="notif-icon">${icon}</span>
            <span class="notif-message">${message}</span>
        `;

        container.appendChild(notification);

        // Auto-dismiss after duration
        setTimeout(() => {
            notification.classList.add('fade-out');
            // Remove after fade animation completes
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, duration);

        return notification;
    }

    /**
     * Show a prominent refresh prompt when changes require browser reload
     */
    showRefreshPrompt() {
        // Remove existing prompt if any
        const existing = document.getElementById('refresh-prompt');
        if (existing) existing.remove();

        const prompt = document.createElement('div');
        prompt.id = 'refresh-prompt';
        prompt.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, rgba(20, 20, 40, 0.95), rgba(40, 20, 60, 0.95));
            border: 2px solid #ff9900;
            border-radius: 16px;
            padding: 30px 40px;
            z-index: 3000;
            text-align: center;
            font-family: 'VT323', monospace;
            box-shadow: 0 0 30px rgba(255, 153, 0, 0.3);
            animation: pulse-glow 2s ease-in-out infinite;
        `;

        prompt.innerHTML = `
            <style>
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 30px rgba(255, 153, 0, 0.3); }
                    50% { box-shadow: 0 0 50px rgba(255, 153, 0, 0.5); }
                }
            </style>
            <div style="font-size: 48px; margin-bottom: 15px;">🔄</div>
            <h2 style="color: #ff9900; margin: 0 0 10px 0; font-size: 28px;">Refresh Required</h2>
            <p style="color: #ccc; margin: 0 0 20px 0; font-size: 18px;">
                Some changes require a browser refresh to take effect.
            </p>
            <button id="refresh-now-btn" style="
                background: linear-gradient(135deg, #ff9900, #ff6600);
                border: none;
                color: white;
                padding: 12px 30px;
                font-size: 20px;
                font-family: 'VT323', monospace;
                border-radius: 8px;
                cursor: pointer;
                margin-right: 10px;
                transition: all 0.2s;
            ">Refresh Now</button>
            <button id="refresh-later-btn" style="
                background: transparent;
                border: 1px solid #666;
                color: #aaa;
                padding: 12px 20px;
                font-size: 18px;
                font-family: 'VT323', monospace;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
            ">Later</button>
        `;

        document.body.appendChild(prompt);

        // Button handlers
        document.getElementById('refresh-now-btn').onclick = () => {
            window.location.reload();
        };

        document.getElementById('refresh-later-btn').onclick = () => {
            prompt.remove();
        };

        // Auto-dismiss after 30 seconds
        setTimeout(() => {
            if (document.getElementById('refresh-prompt')) {
                prompt.remove();
            }
        }, 30000);
    }

    cleanup() {
        // Remove any active notifications
        const container = document.getElementById('game-notifications');
        if (container) {
            container.innerHTML = '';
        }

        // Remove refresh prompt if shown
        const prompt = document.getElementById('refresh-prompt');
        if (prompt) prompt.remove();
    }
}
