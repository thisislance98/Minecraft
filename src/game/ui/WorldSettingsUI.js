/**
 * WorldSettingsUI
 *
 * In-game panel for world owners to manage their world settings.
 * Only visible to the world owner.
 */

import { auth } from '../../config/firebase-client.js';

export class WorldSettingsUI {
    constructor(game) {
        this.game = game;
        this.user = null;
        this.world = null;
        this.isOwner = false;
        this.isVisible = false;

        // Listen for auth state
        auth.onAuthStateChanged((user) => {
            this.user = user;
            this.checkOwnership();
        });

        // Listen for world join events
        window.addEventListener('worldJoined', (e) => {
            this.onWorldJoined(e.detail);
        });

        // Create the panel
        this.createPanel();
    }

    onWorldJoined(data) {
        this.world = data.world;
        this.isOwner = data.permissions?.isOwner === true;

        // Show/hide the settings button based on ownership
        const settingsBtn = document.getElementById('world-settings-btn');
        if (settingsBtn) {
            settingsBtn.style.display = this.isOwner ? 'block' : 'none';
        }

        // Update current world indicator
        this.updateWorldIndicator();

        console.log(`[WorldSettingsUI] World joined: ${this.world?.name}, isOwner: ${this.isOwner}`);
    }

    checkOwnership() {
        // Re-check ownership when auth changes
        if (this.world && this.user) {
            this.isOwner = this.world.ownerId === this.user.uid;
            const settingsBtn = document.getElementById('world-settings-btn');
            if (settingsBtn) {
                settingsBtn.style.display = this.isOwner ? 'block' : 'none';
            }
        }
    }

    createPanel() {
        // Add settings button to top-right controls
        const topRightControls = document.getElementById('top-right-controls');
        if (topRightControls) {
            const settingsBtn = document.createElement('button');
            settingsBtn.id = 'world-settings-btn';
            settingsBtn.title = 'World Settings (Owner)';
            settingsBtn.textContent = '🔧';
            settingsBtn.style.display = 'none'; // Hidden by default
            settingsBtn.addEventListener('click', () => this.toggle());

            // Insert after the world browser button
            const worldBtn = document.getElementById('world-btn');
            if (worldBtn && worldBtn.nextSibling) {
                topRightControls.insertBefore(settingsBtn, worldBtn.nextSibling);
            } else {
                topRightControls.insertBefore(settingsBtn, topRightControls.firstChild);
            }
        }

        // Create the settings panel
        const panel = document.createElement('div');
        panel.id = 'world-settings-panel';
        panel.className = 'hidden';
        panel.innerHTML = `
            <div class="world-settings-content">
                <div class="world-settings-header">
                    <h3>🔧 World Settings</h3>
                    <button id="world-settings-close">×</button>
                </div>
                <div class="world-settings-body">
                    <div class="world-info-section">
                        <div class="world-name-display">
                            <span id="ws-world-name">Loading...</span>
                            <button id="ws-edit-name-btn" title="Edit name">✏️</button>
                        </div>
                        <p id="ws-world-id" class="world-id-text"></p>
                    </div>

                    <div class="settings-section">
                        <h4>📝 Description</h4>
                        <textarea id="ws-description" placeholder="Describe your world..."></textarea>
                    </div>

                    <div class="settings-section">
                        <h4>🔒 Visibility</h4>
                        <div class="visibility-options">
                            <label class="visibility-option">
                                <input type="radio" name="ws-visibility" value="public">
                                <span class="visibility-label">🌍 Public</span>
                                <span class="visibility-desc">Anyone can find and join</span>
                            </label>
                            <label class="visibility-option">
                                <input type="radio" name="ws-visibility" value="unlisted">
                                <span class="visibility-label">🔗 Unlisted</span>
                                <span class="visibility-desc">Only accessible via link</span>
                            </label>
                            <label class="visibility-option">
                                <input type="radio" name="ws-visibility" value="private">
                                <span class="visibility-label">🔒 Private</span>
                                <span class="visibility-desc">Only you can access</span>
                            </label>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h4>🛠️ Permissions</h4>
                        <div class="permission-row">
                            <label>Building:</label>
                            <select id="ws-allow-building">
                                <option value="all">Everyone</option>
                                <option value="owner">Owner Only</option>
                                <option value="none">Nobody</option>
                            </select>
                        </div>
                        <div class="permission-row">
                            <label>Creature Spawning:</label>
                            <select id="ws-allow-spawn">
                                <option value="all">Everyone</option>
                                <option value="owner">Owner Only</option>
                                <option value="none">Nobody</option>
                            </select>
                        </div>
                        <div class="permission-row">
                            <label>
                                <input type="checkbox" id="ws-allow-pvp">
                                Allow PvP Combat
                            </label>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h4>🌅 Environment</h4>
                        <div class="permission-row">
                            <label>Time of Day:</label>
                            <input type="range" id="ws-time-of-day" min="0" max="1" step="0.01" value="0.25">
                            <span id="ws-time-display">Noon</span>
                        </div>
                        <div class="permission-row">
                            <label>
                                <input type="checkbox" id="ws-time-frozen">
                                Freeze Time
                            </label>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h4>🔗 Share Link</h4>
                        <div class="share-link-row">
                            <input type="text" id="ws-share-link" readonly>
                            <button id="ws-copy-link" title="Copy link">📋</button>
                        </div>
                    </div>

                    <div class="settings-actions">
                        <button id="ws-save-btn" class="save-btn">💾 Save Changes</button>
                        <button id="ws-reset-world-btn" class="danger-btn">🗑️ Reset World</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        // Inject styles
        this.injectStyles();

        // Setup event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Close button
        document.getElementById('world-settings-close').addEventListener('click', () => {
            this.hide();
        });

        // Time slider
        const timeSlider = document.getElementById('ws-time-of-day');
        timeSlider.addEventListener('input', (e) => {
            this.updateTimeDisplay(parseFloat(e.target.value));
        });

        // Copy link button
        document.getElementById('ws-copy-link').addEventListener('click', () => {
            const linkInput = document.getElementById('ws-share-link');
            navigator.clipboard.writeText(linkInput.value).then(() => {
                this.showToast('Link copied!');
            });
        });

        // Save button
        document.getElementById('ws-save-btn').addEventListener('click', () => {
            this.saveSettings();
        });

        // Reset world button
        document.getElementById('ws-reset-world-btn').addEventListener('click', () => {
            this.resetWorld();
        });

        // Edit name button
        document.getElementById('ws-edit-name-btn').addEventListener('click', () => {
            this.editWorldName();
        });

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });

        // Close on click outside
        document.getElementById('world-settings-panel').addEventListener('click', (e) => {
            if (e.target.id === 'world-settings-panel') {
                this.hide();
            }
        });
    }

    updateWorldIndicator() {
        // Update the world name in the debug panel or create a new indicator
        let indicator = document.getElementById('current-world-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'current-world-indicator';
            document.body.appendChild(indicator);
        }

        if (this.world) {
            indicator.innerHTML = `
                <span class="world-icon">🌍</span>
                <span class="world-name">${this.escapeHtml(this.world.name)}</span>
                ${this.isOwner ? '<span class="owner-badge">Owner</span>' : ''}
            `;
            indicator.classList.remove('hidden');
        } else {
            indicator.classList.add('hidden');
        }
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    show() {
        if (!this.isOwner) {
            this.showToast('Only the world owner can access settings.');
            return;
        }

        const panel = document.getElementById('world-settings-panel');
        panel.classList.remove('hidden');
        this.isVisible = true;

        // Release pointer lock
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }

        // Populate current settings
        this.populateSettings();
    }

    hide() {
        const panel = document.getElementById('world-settings-panel');
        panel.classList.add('hidden');
        this.isVisible = false;
    }

    populateSettings() {
        if (!this.world) return;

        // World info
        document.getElementById('ws-world-name').textContent = this.world.name;
        document.getElementById('ws-world-id').textContent = `ID: ${this.world.id}`;
        document.getElementById('ws-description').value = this.world.description || '';

        // Visibility
        const visibilityRadio = document.querySelector(`input[name="ws-visibility"][value="${this.world.visibility}"]`);
        if (visibilityRadio) {
            visibilityRadio.checked = true;
        }

        // Permissions
        document.getElementById('ws-allow-building').value = this.world.settings?.allowBuilding || 'all';
        document.getElementById('ws-allow-spawn').value = this.world.settings?.allowCreatureSpawn || 'all';
        document.getElementById('ws-allow-pvp').checked = this.world.settings?.allowPvP || false;

        // Environment
        const timeOfDay = this.world.settings?.timeOfDay ?? 0.25;
        document.getElementById('ws-time-of-day').value = timeOfDay;
        this.updateTimeDisplay(timeOfDay);
        document.getElementById('ws-time-frozen').checked = this.world.settings?.timeFrozen || false;

        // Share link
        document.getElementById('ws-share-link').value = `${window.location.origin}/world/${this.world.id}`;
    }

    updateTimeDisplay(value) {
        const display = document.getElementById('ws-time-display');
        // Convert 0-1 to time of day
        const hour = Math.floor(value * 24);
        const minute = Math.floor((value * 24 - hour) * 60);

        let timeStr;
        if (value < 0.25) {
            timeStr = 'Night';
        } else if (value < 0.35) {
            timeStr = 'Dawn';
        } else if (value < 0.45) {
            timeStr = 'Morning';
        } else if (value < 0.55) {
            timeStr = 'Noon';
        } else if (value < 0.65) {
            timeStr = 'Afternoon';
        } else if (value < 0.75) {
            timeStr = 'Evening';
        } else if (value < 0.85) {
            timeStr = 'Dusk';
        } else {
            timeStr = 'Night';
        }

        display.textContent = `${timeStr} (${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')})`;
    }

    async saveSettings() {
        if (!this.world || !this.user) return;

        const saveBtn = document.getElementById('ws-save-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            const visibility = document.querySelector('input[name="ws-visibility"]:checked')?.value || 'unlisted';
            const description = document.getElementById('ws-description').value.trim();
            const allowBuilding = document.getElementById('ws-allow-building').value;
            const allowSpawn = document.getElementById('ws-allow-spawn').value;
            const allowPvP = document.getElementById('ws-allow-pvp').checked;
            const timeOfDay = parseFloat(document.getElementById('ws-time-of-day').value);
            const timeFrozen = document.getElementById('ws-time-frozen').checked;

            const serverUrl = this.getServerUrl();
            const token = await this.user.getIdToken();

            const response = await fetch(`${serverUrl}/api/worlds/${this.world.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    description,
                    visibility,
                    settings: {
                        ...this.world.settings,
                        allowBuilding,
                        allowCreatureSpawn: allowSpawn,
                        allowPvP,
                        timeOfDay,
                        timeFrozen
                    }
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save settings');
            }

            const data = await response.json();
            this.world = data.world;

            // Apply time change immediately
            if (this.game.environment) {
                this.game.environment.setTimeOfDay(timeOfDay);
            }

            // Broadcast settings change to other players
            if (this.game.socketManager?.socket) {
                this.game.socketManager.socket.emit('world:settings_changed', {
                    worldId: this.world.id,
                    settings: this.world.settings
                });
            }

            this.showToast('Settings saved!');

        } catch (error) {
            console.error('[WorldSettingsUI] Failed to save settings:', error);
            this.showToast(`Failed to save: ${error.message}`);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Save Changes';
        }
    }

    async editWorldName() {
        const currentName = this.world?.name || '';
        const newName = prompt('Enter new world name:', currentName);

        if (!newName || newName.trim() === currentName) return;

        try {
            const serverUrl = this.getServerUrl();
            const token = await this.user.getIdToken();

            const response = await fetch(`${serverUrl}/api/worlds/${this.world.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newName.trim() })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update name');
            }

            const data = await response.json();
            this.world = data.world;

            document.getElementById('ws-world-name').textContent = this.world.name;
            this.updateWorldIndicator();
            this.showToast('World name updated!');

        } catch (error) {
            console.error('[WorldSettingsUI] Failed to update name:', error);
            this.showToast(`Failed to update: ${error.message}`);
        }
    }

    async resetWorld() {
        if (!confirm('Are you sure you want to reset this world?\n\nThis will delete all blocks, creatures, and signs. This cannot be undone!')) {
            return;
        }

        if (!confirm('This is your FINAL WARNING.\n\nAll world content will be permanently deleted. Continue?')) {
            return;
        }

        try {
            // Use the existing world:reset socket event
            if (this.game.socketManager?.socket) {
                this.game.socketManager.socket.emit('world:reset');
                this.showToast('World reset initiated...');
                this.hide();
            }
        } catch (error) {
            console.error('[WorldSettingsUI] Failed to reset world:', error);
            this.showToast('Failed to reset world');
        }
    }

    showToast(message) {
        // Reuse toast from WorldBrowserUI or create simple one
        const existingToast = document.querySelector('.world-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = 'world-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    getServerUrl() {
        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        return import.meta.env.VITE_SERVER_URL || (isDev ? 'http://localhost:2567' : window.location.origin);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    injectStyles() {
        if (document.getElementById('world-settings-styles')) return;

        const style = document.createElement('style');
        style.id = 'world-settings-styles';
        style.textContent = `
            #world-settings-panel {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            #world-settings-panel.hidden {
                display: none;
            }

            .world-settings-content {
                background: linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%);
                border: 3px solid #444;
                border-radius: 8px;
                width: 90%;
                max-width: 500px;
                max-height: 85vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                font-family: 'VT323', monospace;
            }

            .world-settings-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                background: #333;
                border-bottom: 2px solid #444;
            }

            .world-settings-header h3 {
                margin: 0;
                font-size: 22px;
                color: #fff;
            }

            #world-settings-close {
                background: none;
                border: none;
                color: #fff;
                font-size: 28px;
                cursor: pointer;
            }

            .world-settings-body {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
            }

            .world-info-section {
                text-align: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid #444;
            }

            .world-name-display {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
            }

            #ws-world-name {
                font-size: 24px;
                color: #fff;
            }

            #ws-edit-name-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 16px;
                opacity: 0.7;
            }

            #ws-edit-name-btn:hover {
                opacity: 1;
            }

            .world-id-text {
                font-size: 12px;
                color: #666;
                margin: 5px 0 0;
            }

            .settings-section {
                margin-bottom: 20px;
            }

            .settings-section h4 {
                margin: 0 0 10px;
                font-size: 16px;
                color: #4CAF50;
            }

            #ws-description {
                width: 100%;
                height: 60px;
                padding: 10px;
                background: #222;
                border: 2px solid #444;
                border-radius: 4px;
                color: #fff;
                font-family: inherit;
                font-size: 14px;
                resize: vertical;
            }

            .visibility-options {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .visibility-option {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px;
                background: #222;
                border: 2px solid #444;
                border-radius: 4px;
                cursor: pointer;
            }

            .visibility-option:hover {
                border-color: #555;
            }

            .visibility-option input:checked + .visibility-label {
                color: #4CAF50;
            }

            .visibility-label {
                font-size: 16px;
                color: #fff;
                min-width: 100px;
            }

            .visibility-desc {
                font-size: 12px;
                color: #888;
            }

            .permission-row {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
            }

            .permission-row label {
                color: #fff;
                font-size: 14px;
                flex: 1;
            }

            .permission-row select {
                padding: 8px;
                background: #222;
                border: 2px solid #444;
                border-radius: 4px;
                color: #fff;
                font-family: inherit;
            }

            .permission-row input[type="range"] {
                flex: 1;
                margin: 0 10px;
            }

            #ws-time-display {
                min-width: 100px;
                text-align: right;
                color: #888;
                font-size: 12px;
            }

            .share-link-row {
                display: flex;
                gap: 8px;
            }

            #ws-share-link {
                flex: 1;
                padding: 10px;
                background: #222;
                border: 2px solid #444;
                border-radius: 4px;
                color: #888;
                font-family: inherit;
                font-size: 12px;
            }

            #ws-copy-link {
                padding: 10px 15px;
                background: #444;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
            }

            #ws-copy-link:hover {
                background: #555;
            }

            .settings-actions {
                display: flex;
                gap: 10px;
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px solid #444;
            }

            .save-btn {
                flex: 1;
                padding: 12px;
                background: #4CAF50;
                border: none;
                border-radius: 4px;
                color: #fff;
                font-size: 16px;
                cursor: pointer;
                font-family: inherit;
            }

            .save-btn:hover:not(:disabled) {
                background: #5CBF60;
            }

            .save-btn:disabled {
                background: #666;
                cursor: not-allowed;
            }

            .danger-btn {
                padding: 12px;
                background: #D32F2F;
                border: none;
                border-radius: 4px;
                color: #fff;
                font-size: 16px;
                cursor: pointer;
                font-family: inherit;
            }

            .danger-btn:hover {
                background: #E53935;
            }

            /* Current World Indicator */
            #current-world-indicator {
                position: fixed;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.7);
                padding: 8px 16px;
                border-radius: 20px;
                font-family: 'VT323', monospace;
                font-size: 16px;
                color: #fff;
                display: flex;
                align-items: center;
                gap: 8px;
                z-index: 100;
            }

            #current-world-indicator.hidden {
                display: none;
            }

            #current-world-indicator .world-icon {
                font-size: 18px;
            }

            #current-world-indicator .owner-badge {
                background: #4CAF50;
                padding: 2px 8px;
                border-radius: 10px;
                font-size: 12px;
            }
        `;
        document.head.appendChild(style);
    }
}
