import { auth } from '../../config/firebase-client.js';

export class DestinationManager {
    constructor(game) {
        this.game = game;
    }

    async createDestination(x, y, z) {
        try {
            const user = auth.currentUser;
            const res = await fetch('/api/destinations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    x, y, z,
                    userId: user ? user.uid : null
                })
            });

            if (!res.ok) throw new Error('Failed to create destination');
            const data = await res.json();
            return data.id;
        } catch (e) {
            console.error('[DestinationManager] Creation failed:', e);
            return null;
        }
    }

    async getDestination(id) {
        try {
            const res = await fetch(`/api/destinations/${id}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.error('[DestinationManager] Fetch failed:', e);
            return null;
        }
    }

    async handleWarp(id) {
        const dest = await this.getDestination(id);
        if (dest && this.game.player) {
            console.log(`[DestinationManager] Warping to: ${dest.x}, ${dest.y}, ${dest.z}`);

            // Wait for chunks to load around target? 
            // For now, just teleport. The game loop handles chunk loading.

            // Warp player
            this.game.player.position.set(dest.x, dest.y + 1, dest.z); // +1 to stand on block
            this.game.player.velocity.set(0, 0, 0);

            // Feedback
            this.game.uiManager.addChatMessage('system', 'Warped to destination!');
        } else {
            console.warn('[DestinationManager] Invalid warp ID or player not ready');
            this.game.uiManager.addChatMessage('system', 'Invalid warp destination.');
        }
    }
}
