import { generateHotbarIcons } from './textures/TextureGenerator.js';
import { VoxelGame } from './game/VoxelGame.jsx';
import { SpawnUI } from './game/ui/SpawnUI.js';

// Test auto-version: timestamp 18:56
// HMR test change - 12:46
// Version notification badge logic
function checkVersionBadge() {
    // Don't show badge on localhost
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
        return;
    }

    const versionElement = document.getElementById('version-text');
    const badgeElement = document.getElementById('version-badge');

    if (!versionElement || !badgeElement) return;

    const currentVersion = versionElement.textContent.trim();
    const seenVersionKey = 'seenBuildVersion';
    const seenVersion = localStorage.getItem(seenVersionKey);

    // Show badge if this is a new version
    if (seenVersion !== currentVersion) {
        badgeElement.classList.remove('hidden');

        // Mark as seen immediately so it doesn't show on refresh
        localStorage.setItem(seenVersionKey, currentVersion);

        // Clicking the badge dismisses it (visual only for this session)
        badgeElement.addEventListener('click', () => {
            badgeElement.classList.add('hidden');
        }, { once: true });
    }
}

// Initialize the game when the window loads
window.addEventListener('load', () => {
    generateHotbarIcons();
    const game = new VoxelGame();
    window.__VOXEL_GAME__ = game;
    if (window.merlinClient) {
        window.merlinClient.setGame(game);
    }

    // Check for new version badge
    checkVersionBadge();

    // Initialize Spawn UI
    const spawnUI = new SpawnUI(game);
    window.spawnUI = spawnUI; // For debugging
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
