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
                        <h4>🎨 Sky Appearance</h4>
                        <div class="permission-row">
                            <label>Sky Color:</label>
                            <input type="color" id="ws-sky-color" value="#87CEEB">
                        </div>
                        <div class="sky-presets">
                            <button class="preset-btn sky-preset" data-color="#87CEEB" title="Earth Blue">🌍</button>
                            <button class="preset-btn sky-preset" data-color="#FF6B35" title="Sunset Orange">🌅</button>
                            <button class="preset-btn sky-preset" data-color="#050510" title="Space Black">🌌</button>
                            <button class="preset-btn sky-preset" data-color="#1E90FF" title="Bright Blue">☀️</button>
                            <button class="preset-btn sky-preset" data-color="#2D1B4E" title="Purple Night">🔮</button>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h4>⚖️ Physics</h4>
                        <div class="permission-row">
                            <label>Gravity:</label>
                            <input type="range" id="ws-gravity" min="0.1" max="3.0" step="0.1" value="1.0">
                            <span id="ws-gravity-display">Normal (1.0x)</span>
                        </div>
                        <div class="gravity-presets">
                            <button class="preset-btn gravity-preset" data-value="0.3" title="Moon Gravity">🌙 Moon</button>
                            <button class="preset-btn gravity-preset" data-value="1.0" title="Normal Gravity">🌍 Normal</button>
                            <button class="preset-btn gravity-preset" data-value="2.0" title="Heavy Gravity">🪨 Heavy</button>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h4>🦁 Allowed Creatures</h4>
                        <p class="section-desc">Select which creatures can spawn naturally</p>
                        <div class="creature-controls">
                            <button id="ws-creatures-all">Select All</button>
                            <button id="ws-creatures-none">Clear All</button>
                            <input type="text" id="ws-creature-search" placeholder="Search...">
                        </div>
                        <div class="creature-grid" id="ws-creature-grid">
                            <!-- Populated dynamically -->
                        </div>
                    </div>

                    <div class="settings-section">
                        <h4>🏞️ Landscape</h4>
                        <p class="warning-text">⚠️ Changes require world reset to apply</p>
                        <div class="permission-row">
                            <label><input type="checkbox" id="ws-enable-rivers" checked> Enable Rivers</label>
                        </div>
                        <div class="permission-row">
                            <label><input type="checkbox" id="ws-enable-oceans" checked> Enable Oceans</label>
                        </div>
                        <div class="permission-row">
                            <label><input type="checkbox" id="ws-enable-villages" checked> Generate Villages</label>
                        </div>
                        <div class="permission-row">
                            <label>Sea Level:</label>
                            <input type="range" id="ws-sea-level" min="10" max="60" value="30">
                            <span id="ws-sea-level-display">30</span>
                        </div>
                        <div class="permission-row">
                            <label>Terrain Height:</label>
                            <input type="range" id="ws-terrain-scale" min="0.5" max="2.0" step="0.1" value="1.0">
                            <span id="ws-terrain-scale-display">Normal (1.0x)</span>
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

        // Gravity slider
        const gravitySlider = document.getElementById('ws-gravity');
        gravitySlider.addEventListener('input', (e) => {
            this.updateGravityDisplay(parseFloat(e.target.value));
        });

        // Gravity presets
        document.querySelectorAll('.gravity-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const value = parseFloat(e.target.dataset.value);
                gravitySlider.value = value;
                this.updateGravityDisplay(value);
            });
        });

        // Sky color picker
        const skyColorPicker = document.getElementById('ws-sky-color');
        skyColorPicker.addEventListener('input', (e) => {
            // Live preview
            if (this.game.environment) {
                this.game.environment.applySkyColor(e.target.value);
            }
        });

        // Sky color presets
        document.querySelectorAll('.sky-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const color = e.target.dataset.color;
                skyColorPicker.value = color;
                if (this.game.environment) {
                    this.game.environment.applySkyColor(color);
                }
            });
        });

        // Sea level slider
        const seaLevelSlider = document.getElementById('ws-sea-level');
        seaLevelSlider.addEventListener('input', (e) => {
            document.getElementById('ws-sea-level-display').textContent = e.target.value;
        });

        // Terrain scale slider
        const terrainScaleSlider = document.getElementById('ws-terrain-scale');
        terrainScaleSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.updateTerrainScaleDisplay(value);
        });

        // Creature selection controls
        document.getElementById('ws-creatures-all').addEventListener('click', () => {
            this.selectAllCreatures(true);
        });
        document.getElementById('ws-creatures-none').addEventListener('click', () => {
            this.selectAllCreatures(false);
        });
        document.getElementById('ws-creature-search').addEventListener('input', (e) => {
            this.filterCreatures(e.target.value);
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

    updateGravityDisplay(value) {
        const display = document.getElementById('ws-gravity-display');
        let label = 'Normal';
        if (value < 0.5) label = 'Very Low';
        else if (value < 0.8) label = 'Low';
        else if (value < 1.2) label = 'Normal';
        else if (value < 1.8) label = 'High';
        else label = 'Very High';
        display.textContent = `${label} (${value.toFixed(1)}x)`;
    }

    updateTerrainScaleDisplay(value) {
        const display = document.getElementById('ws-terrain-scale-display');
        let label = 'Normal';
        if (value < 0.7) label = 'Flat';
        else if (value < 1.3) label = 'Normal';
        else label = 'Mountainous';
        display.textContent = `${label} (${value.toFixed(1)}x)`;
    }

    populateCreatureGrid() {
        const grid = document.getElementById('ws-creature-grid');
        if (!grid || !this.game.AnimalClasses) return;

        grid.innerHTML = '';

        // Get allowed creatures from world settings
        const allowedCreatures = this.world?.settings?.allowedCreatures;
        const allAllowed = allowedCreatures === null || allowedCreatures === undefined;
        const allowedSet = allAllowed ? null : new Set(allowedCreatures);

        // Sort creature names alphabetically
        const creatureNames = Object.keys(this.game.AnimalClasses).sort();

        for (const name of creatureNames) {
            const item = document.createElement('div');
            item.className = 'creature-item';
            item.dataset.creature = name;

            const isSelected = allAllowed || (allowedSet && allowedSet.has(name));
            if (isSelected) item.classList.add('selected');

            item.innerHTML = `
                <input type="checkbox" ${isSelected ? 'checked' : ''}>
                <span>${name}</span>
            `;

            item.addEventListener('click', () => {
                const checkbox = item.querySelector('input');
                checkbox.checked = !checkbox.checked;
                item.classList.toggle('selected', checkbox.checked);
            });

            grid.appendChild(item);
        }
    }

    selectAllCreatures(select) {
        const grid = document.getElementById('ws-creature-grid');
        if (!grid) return;

        grid.querySelectorAll('.creature-item').forEach(item => {
            const checkbox = item.querySelector('input');
            checkbox.checked = select;
            item.classList.toggle('selected', select);
        });
    }

    filterCreatures(searchText) {
        const grid = document.getElementById('ws-creature-grid');
        if (!grid) return;

        const search = searchText.toLowerCase();
        grid.querySelectorAll('.creature-item').forEach(item => {
            const name = item.dataset.creature.toLowerCase();
            item.style.display = name.includes(search) ? '' : 'none';
        });
    }

    getSelectedCreatures() {
        const grid = document.getElementById('ws-creature-grid');
        if (!grid) return null;

        const selected = [];
        let allSelected = true;
        let noneSelected = true;

        grid.querySelectorAll('.creature-item').forEach(item => {
            const checkbox = item.querySelector('input');
            if (checkbox.checked) {
                selected.push(item.dataset.creature);
                noneSelected = false;
            } else {
                allSelected = false;
            }
        });

        // If all selected, return null (meaning "allow all")
        if (allSelected) return null;
        // If none selected, return empty array
        if (noneSelected) return [];
        // Otherwise return the specific list
        return selected;
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

        // Sky Color
        const skyColor = this.world.customizations?.skyColor || '#87CEEB';
        document.getElementById('ws-sky-color').value = skyColor;

        // Gravity
        const gravity = this.world.customizations?.gravity ?? 1.0;
        document.getElementById('ws-gravity').value = gravity;
        this.updateGravityDisplay(gravity);

        // Landscape Settings
        const landscape = this.world.customizations?.landscapeSettings || {};
        document.getElementById('ws-enable-rivers').checked = landscape.enableRivers !== false;
        document.getElementById('ws-enable-oceans').checked = landscape.enableOceans !== false;
        document.getElementById('ws-enable-villages').checked = landscape.enableVillages !== false;

        const seaLevel = landscape.seaLevel ?? 30;
        document.getElementById('ws-sea-level').value = seaLevel;
        document.getElementById('ws-sea-level-display').textContent = seaLevel;

        const terrainScale = landscape.terrainScale ?? 1.0;
        document.getElementById('ws-terrain-scale').value = terrainScale;
        this.updateTerrainScaleDisplay(terrainScale);

        // Populate creature grid
        this.populateCreatureGrid();

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

            // New settings
            const skyColor = document.getElementById('ws-sky-color').value;
            const gravity = parseFloat(document.getElementById('ws-gravity').value);
            const allowedCreatures = this.getSelectedCreatures();

            // Landscape settings
            const landscapeSettings = {
                enableRivers: document.getElementById('ws-enable-rivers').checked,
                enableOceans: document.getElementById('ws-enable-oceans').checked,
                enableVillages: document.getElementById('ws-enable-villages').checked,
                seaLevel: parseInt(document.getElementById('ws-sea-level').value),
                terrainScale: parseFloat(document.getElementById('ws-terrain-scale').value)
            };

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
                        timeFrozen,
                        allowedCreatures
                    },
                    customizations: {
                        ...this.world.customizations,
                        skyColor,
                        gravity,
                        landscapeSettings
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

            // Apply sky color immediately
            if (this.game.environment && skyColor) {
                this.game.environment.applySkyColor(skyColor);
            }

            // Apply gravity multiplier
            if (this.game && gravity !== undefined) {
                this.game.gravityMultiplier = gravity;
            }

            // Apply creature filter
            if (this.game.spawnManager && allowedCreatures !== undefined) {
                this.game.spawnManager.setAllowedCreatures(allowedCreatures);
            }

            // Broadcast settings change to other players
            if (this.game.socketManager?.socket) {
                this.game.socketManager.socket.emit('world:settings_changed', {
                    worldId: this.world.id,
                    settings: this.world.settings,
                    customizations: this.world.customizations
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

            /* Sky and Gravity Presets */
            .sky-presets, .gravity-presets {
                display: flex;
                gap: 8px;
                margin-top: 8px;
                flex-wrap: wrap;
            }

            .preset-btn {
                padding: 8px 12px;
                background: #333;
                border: 2px solid #444;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                color: #fff;
                transition: border-color 0.2s;
            }

            .preset-btn:hover {
                border-color: #4CAF50;
            }

            /* Creature Grid */
            .creature-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                gap: 6px;
                max-height: 200px;
                overflow-y: auto;
                padding: 10px;
                background: #1a1a1a;
                border: 2px solid #444;
                border-radius: 4px;
            }

            .creature-item {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 6px;
                background: #222;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                border: 1px solid transparent;
                color: #ccc;
            }

            .creature-item:hover {
                background: #2a2a2a;
            }

            .creature-item.selected {
                border-color: #4CAF50;
                background: #1a2a1a;
            }

            .creature-item input[type="checkbox"] {
                margin: 0;
                pointer-events: none;
            }

            .creature-controls {
                display: flex;
                gap: 8px;
                margin-bottom: 10px;
            }

            .creature-controls button {
                padding: 6px 12px;
                background: #333;
                border: 2px solid #444;
                border-radius: 4px;
                color: #fff;
                cursor: pointer;
                font-size: 12px;
            }

            .creature-controls button:hover {
                border-color: #4CAF50;
            }

            .creature-controls input {
                flex: 1;
                padding: 8px;
                background: #222;
                border: 2px solid #444;
                border-radius: 4px;
                color: #fff;
                font-family: inherit;
            }

            .section-desc {
                font-size: 12px;
                color: #888;
                margin: 0 0 10px;
            }

            .warning-text {
                font-size: 12px;
                color: #FFA726;
                margin: 0 0 10px;
            }

            /* Sky Color Picker */
            #ws-sky-color {
                width: 50px;
                height: 30px;
                padding: 0;
                border: 2px solid #444;
                border-radius: 4px;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
    }
}
