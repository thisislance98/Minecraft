import { generateHotbarIcons } from './textures/TextureGenerator.js';
import { VoxelGame } from './game/VoxelGame.jsx';

// Test auto-version: timestamp 18:56
// HMR test change - 12:46
// Initialize the game when the window loads
window.addEventListener('load', () => {
    generateHotbarIcons();
    new VoxelGame();
});

// HMR Update Notifications
if (import.meta.hot) {
    import.meta.hot.on('vite:beforeUpdate', (payload) => {
        const container = document.getElementById('hmr-notifications');
        if (!container) return;

        payload.updates.forEach((update) => {
            // Extract just the filename from the path
            const fullPath = update.acceptedPath || update.path || 'unknown';
            const fileName = fullPath.split('/').slice(-2).join('/'); // e.g., "animals/Sheep.js"

            const notification = document.createElement('div');
            notification.className = 'hmr-notification';
            notification.innerHTML = `<span class="hmr-icon">🔄</span> Updated: <span class="hmr-file">${fileName}</span>`;

            container.appendChild(notification);

            // Remove notification after animation completes
            setTimeout(() => {
                notification.remove();
            }, 4000);
        });
    });
}
