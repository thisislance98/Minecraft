/**
 * HUDManager - Handles FPS, position display, and block count HUD elements
 */
export class HUDManager {
    constructor(game, uiManager) {
        this.game = game;
        this.uiManager = uiManager;

        // Cache DOM elements
        this.fpsElement = document.getElementById('fps');
        this.fpsCounter = document.getElementById('fps-counter');
        this.positionElement = document.getElementById('position');
        this.blockCountElement = document.getElementById('block-count');
        this.remotePlayersListElement = document.getElementById('remote-players-list');

        // FPS tracking
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();

        // Remote player tracking
        this.remotePlayers = new Map(); // id -> { name, pos, rotY }
    }

    /**
     * Update FPS counter (call every frame, updates display once per second)
     */
    updateFPS() {
        this.frameCount++;
        const now = performance.now();

        if (now - this.lastFpsUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = now;

            if (this.fpsElement) {
                this.fpsElement.textContent = this.fps;
            }

            if (this.fpsCounter) {
                this.fpsCounter.classList.remove('low', 'medium');
                if (this.fps < 30) {
                    this.fpsCounter.classList.add('low');
                } else if (this.fps < 50) {
                    this.fpsCounter.classList.add('medium');
                }
            }

            // Auto-disable terrain shadows when FPS drops below 60
            // Only if auto-shadow management is enabled and shadows are currently on
            if (this.game && this.game.autoShadowManagement !== false) {
                if (this.fps < 60 && this.game.terrainShadowsEnabled && !this.game.shadowsAutoDisabled) {
                    console.log(`[Performance] Auto-disabling terrain shadows due to low FPS (${this.fps})`);
                    this.game.toggleTerrainShadows(false);
                    this.game.shadowsAutoDisabled = true;

                    // Update debug panel checkbox if visible
                    const shadowCheck = document.getElementById('dbg-shadows');
                    if (shadowCheck) shadowCheck.checked = false;
                }
            }
        }
    }

    /**
     * Update player position display
     * @param {THREE.Vector3} pos - Player position
     */
    updatePosition(pos) {
        if (this.positionElement) {
            this.positionElement.textContent =
                `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
        }
    }

    /**
     * Update block count display
     * @param {number} count - Number of blocks
     */
    updateBlockCount(count) {
        if (this.blockCountElement) {
            this.blockCountElement.textContent = count;
        }
        if (this.uiManager.debugPanel) {
            this.uiManager.debugPanel.updateStats();
        }
    }

    /**
     * Get current FPS value
     * @returns {number}
     */
    getFPS() {
        return this.fps;
    }

    /**
     * Update network status display
     * @param {string} status - Connection status
     * @param {string} role - Player role (Host/Client)
     * @param {string} roomId - Room/World ID
     */
    updateNetworkStatus(status, role, roomId) {
        const statusEl = document.getElementById('network-status');
        if (statusEl) {
            if (roomId) {
                statusEl.textContent = `${status} (${role}) - ${roomId}`;
            } else {
                statusEl.textContent = status;
            }
        }
    }

    /**
     * Update remote player status in HUD
     * @param {string} id - Player socket ID
     * @param {Object} pos - Player position (or null to remove)
     * @param {number} rotY - Player rotation
     * @param {string} name - Player name
     */
    updateRemotePlayerStatus(id, pos, rotY, name) {
        if (pos === null) {
            // Player left - remove from tracking
            this.remotePlayers.delete(id);
            console.log(`[HUD] Remote player ${name || id} left`);
        } else {
            // Update or add player
            const displayName = name || `Player_${id.substring(0, 4)}`;
            this.remotePlayers.set(id, {
                name: displayName,
                pos: { x: pos.x, y: pos.y, z: pos.z },
                rotY: rotY
            });
            console.log(`[HUD] Remote player ${displayName}: (${pos.x?.toFixed(1)}, ${pos.y?.toFixed(1)}, ${pos.z?.toFixed(1)})`);
        }
        this.renderRemotePlayersList();
    }

    /**
     * Render the remote players list in the debug panel
     */
    renderRemotePlayersList() {
        if (!this.remotePlayersListElement) return;

        if (this.remotePlayers.size === 0) {
            this.remotePlayersListElement.innerHTML = '';
            return;
        }

        let html = '<div class="remote-player-header">Online Players</div>';
        for (const [id, player] of this.remotePlayers) {
            const coords = `${player.pos.x?.toFixed(0)}, ${player.pos.y?.toFixed(0)}, ${player.pos.z?.toFixed(0)}`;
            html += `
                <div class="remote-player" data-player-id="${id}">
                    <span class="player-name">${player.name}</span>
                    <span class="player-coords">${coords}</span>
                </div>
            `;
        }
        this.remotePlayersListElement.innerHTML = html;
    }

    cleanup() {
        // Nothing to clean up
    }
}
