import { generateHotbarIcons } from './textures/TextureGenerator.js';
import { VoxelGame } from './game/VoxelGame.jsx';
import { SpawnUI } from './game/ui/SpawnUI.js';
import { WorldBrowserUI } from './game/ui/WorldBrowserUI.js';

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

    // Initialize World Browser UI
    const worldBrowserUI = new WorldBrowserUI(game);
    window.worldBrowserUI = worldBrowserUI; // For debugging

    // Merlin Voice Introduction (One-time)
    const introKey = 'merlin_voice_intro_seen';
    if (!localStorage.getItem(introKey)) {
        let introInProgress = false;

        const tryPlayIntro = async () => {
            // Prevent concurrent attempts or if already seen
            if (introInProgress || localStorage.getItem(introKey)) return;

            if (window.merlinClient) {
                introInProgress = true;
                console.log('[Merlin] Attempting to play voice introduction...');

                // Pass false to speak() to indicate this is a system-initiated message (if we wanted to distinguish)
                const success = await window.merlinClient.speak("Hello! I am Merlin, your AI assistant. I can help you build and explore. Just press T to chat, or click the microphone to speak to me.");

                if (success) {
                    console.log('[Merlin] Voice intro success, saving state.');
                    localStorage.setItem(introKey, 'true');
                    // Remove listeners immediately on success
                    window.removeEventListener('click', onInteraction);
                    window.removeEventListener('keydown', onInteraction);
                } else {
                    console.log('[Merlin] Voice intro failed (likely autoplay blocked), will retry on next interaction.');
                    introInProgress = false; // Reset to allow retry
                }
            }
        };

        // Try immediately after a delay (works if user already clicked)
        setTimeout(() => {
            tryPlayIntro();
        }, 3000);

        // Also add a listener for the first interaction to guarantee it plays if the timer failed
        const onInteraction = () => {
            tryPlayIntro();
        };

        window.addEventListener('click', onInteraction);
        window.addEventListener('keydown', onInteraction);
    }
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
