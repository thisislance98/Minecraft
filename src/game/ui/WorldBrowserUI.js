/**
 * WorldBrowserUI
 *
 * UI component for browsing, creating, and managing worlds.
 * Shows a list of public worlds and the user's own worlds.
 */

import { auth } from '../../config/firebase-client.js';

export class WorldBrowserUI {
    constructor(game) {
        this.game = game;
        this.user = null;
        this.myWorlds = [];
        this.publicWorlds = [];
        this.isLoading = false;

        // Current world state (for settings tab)
        this.currentWorld = null;
        this.isOwner = false;

        // Create the modal element
        this.createModal();

        // Listen for auth state changes
        auth.onAuthStateChanged((user) => {
            this.user = user;
            this.checkOwnership();
        });

        // Listen for world join events
        window.addEventListener('worldJoined', (e) => {
            this.onWorldJoined(e.detail);
        });

        // Setup button to open world browser
        this.setupWorldButton();
    }

    onWorldJoined(data) {
        this.currentWorld = data.world;
        this.isOwner = data.permissions?.isOwner === true;
        console.log(`[WorldBrowserUI] World joined: ${this.currentWorld?.name}, isOwner: ${this.isOwner}`);
    }

    checkOwnership() {
        if (this.currentWorld && this.user) {
            this.isOwner = this.currentWorld.ownerId === this.user.uid;
        }
    }

    createModal() {
        // Create modal HTML
        const modal = document.createElement('div');
        modal.id = 'world-browser-modal';
        modal.className = 'hidden';
        modal.innerHTML = `
            <div class="world-browser-content">
                <div class="world-browser-header">
                    <h3>🌍 World Browser</h3>
                    <button id="world-browser-close">×</button>
                </div>
                <div class="world-browser-body">
                    <div class="world-browser-tabs">
                        <button class="world-tab active" data-tab="browse">🔍 Browse</button>
                        <button class="world-tab" data-tab="my-worlds">📁 My Worlds</button>
                        <button class="world-tab" data-tab="create">✨ Create</button>
                        <button class="world-tab" data-tab="settings" id="world-tab-settings-btn">⚙️ Settings</button>
                    </div>

                    <div id="world-tab-browse" class="world-tab-content active">
                        <div class="world-search-container">
                            <input type="text" id="world-search" placeholder="Search worlds..." autocomplete="off">
                        </div>
                        <div id="public-worlds-grid" class="worlds-grid">
                            <div class="loading-spinner">Loading worlds...</div>
                        </div>
                    </div>

                    <div id="world-tab-my-worlds" class="world-tab-content">
                        <div id="my-worlds-grid" class="worlds-grid">
                            <div class="no-worlds-message">
                                <p>You haven't created any worlds yet.</p>
                                <button class="create-world-btn">✨ Create Your First World</button>
                            </div>
                        </div>
                    </div>

                    <div id="world-tab-create" class="world-tab-content">
                        <form id="create-world-form" class="create-world-form">
                            <div class="form-group">
                                <label for="world-name">World Name</label>
                                <input type="text" id="world-name" placeholder="My Awesome World" maxlength="50" required>
                            </div>
                            <div class="form-group">
                                <label for="world-description">Description (optional)</label>
                                <textarea id="world-description" placeholder="A magical realm..." maxlength="200"></textarea>
                            </div>
                            <div class="form-group">
                                <label for="world-visibility">Visibility</label>
                                <select id="world-visibility">
                                    <option value="unlisted">🔗 Unlisted (link only)</option>
                                    <option value="public">🌍 Public (everyone can find)</option>
                                    <option value="private">🔒 Private (only you)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="world-seed">Seed (optional)</label>
                                <input type="number" id="world-seed" placeholder="Random if empty">
                            </div>

                            <div class="create-settings-divider">
                                <span>⚙️ World Settings</span>
                            </div>

                            <div class="create-settings-section">
                                <h4>🎨 Sky Appearance</h4>
                                <div class="form-row">
                                    <label>Sky Color:</label>
                                    <input type="color" id="create-sky-color" value="#87CEEB">
                                </div>
                                <div class="sky-presets">
                                    <button type="button" class="preset-btn create-sky-preset" data-color="#87CEEB" title="Earth Blue">🌍</button>
                                    <button type="button" class="preset-btn create-sky-preset" data-color="#FF6B35" title="Sunset Orange">🌅</button>
                                    <button type="button" class="preset-btn create-sky-preset" data-color="#050510" title="Space Black">🌌</button>
                                    <button type="button" class="preset-btn create-sky-preset" data-color="#1E90FF" title="Bright Blue">☀️</button>
                                    <button type="button" class="preset-btn create-sky-preset" data-color="#2D1B4E" title="Purple Night">🔮</button>
                                    <button type="button" class="preset-btn create-sky-preset" data-color="#FFB6C1" title="Pink Sky">🌸</button>
                                </div>
                            </div>

                            <div class="create-settings-section">
                                <h4>⚖️ Physics</h4>
                                <div class="form-row">
                                    <label>Gravity:</label>
                                    <input type="range" id="create-gravity" min="0.1" max="3.0" step="0.1" value="1.0">
                                    <span id="create-gravity-display">Normal (1.0x)</span>
                                </div>
                                <div class="gravity-presets">
                                    <button type="button" class="preset-btn create-gravity-preset" data-value="0.3" title="Moon Gravity">🌙 Moon</button>
                                    <button type="button" class="preset-btn create-gravity-preset" data-value="1.0" title="Normal Gravity">🌍 Normal</button>
                                    <button type="button" class="preset-btn create-gravity-preset" data-value="2.0" title="Heavy Gravity">🪨 Heavy</button>
                                </div>
                            </div>

                            <div class="create-settings-section">
                                <h4>🏞️ Landscape</h4>
                                <div class="form-row checkbox-row">
                                    <label><input type="checkbox" id="create-enable-ocean" checked> Enable Ocean</label>
                                </div>
                                <div class="form-row checkbox-row">
                                    <label><input type="checkbox" id="create-enable-rivers" checked> Enable Rivers</label>
                                </div>
                                <div class="form-row checkbox-row">
                                    <label><input type="checkbox" id="create-enable-villages" checked> Generate Villages</label>
                                </div>
                                <div class="form-row">
                                    <label>Sea Level:</label>
                                    <input type="range" id="create-sea-level" min="10" max="60" value="30">
                                    <span id="create-sea-level-display">30</span>
                                </div>
                                <div class="form-row">
                                    <label>Terrain Height:</label>
                                    <input type="range" id="create-terrain-scale" min="0.5" max="2.0" step="0.1" value="1.0">
                                    <span id="create-terrain-scale-display">Normal (1.0x)</span>
                                </div>
                            </div>

                            <div class="create-settings-section">
                                <h4>🌍 Terrain Biomes</h4>
                                <p class="section-desc">Select which biomes can generate</p>
                                <div class="biome-grid" id="create-biome-grid">
                                    <div class="biome-item selected" data-biome="PLAINS"><input type="checkbox" checked><span>🌾 Plains</span></div>
                                    <div class="biome-item selected" data-biome="FOREST"><input type="checkbox" checked><span>🌲 Forest</span></div>
                                    <div class="biome-item selected" data-biome="DESERT"><input type="checkbox" checked><span>🏜️ Desert</span></div>
                                    <div class="biome-item selected" data-biome="SNOW"><input type="checkbox" checked><span>❄️ Snow</span></div>
                                    <div class="biome-item selected" data-biome="JUNGLE"><input type="checkbox" checked><span>🌴 Jungle</span></div>
                                    <div class="biome-item selected" data-biome="MOUNTAIN"><input type="checkbox" checked><span>⛰️ Mountain</span></div>
                                    <div class="biome-item selected" data-biome="BEACH"><input type="checkbox" checked><span>🏖️ Beach</span></div>
                                    <div class="biome-item selected" data-biome="OCEAN"><input type="checkbox" checked><span>🌊 Ocean</span></div>
                                </div>
                            </div>

                            <div class="create-settings-section">
                                <h4>🦁 Allowed Creatures</h4>
                                <p class="section-desc">Select which creatures can spawn</p>
                                <div class="creature-controls">
                                    <button type="button" id="create-creatures-all">Select All</button>
                                    <button type="button" id="create-creatures-none">Clear All</button>
                                    <input type="text" id="create-creature-search" placeholder="Search...">
                                </div>
                                <div class="creature-grid" id="create-creature-grid">
                                    <!-- Populated dynamically -->
                                </div>
                            </div>

                            <button type="submit" class="create-world-submit">✨ Create World</button>
                        </form>
                    </div>

                    <div id="world-tab-settings" class="world-tab-content">
                        <div id="settings-not-in-world" class="no-worlds-message">
                            <p>Join a world to view and edit its settings.</p>
                        </div>
                        <div id="settings-not-owner" class="no-worlds-message hidden">
                            <p>🔒 Only the world owner can edit settings.</p>
                            <p class="settings-world-name"></p>
                        </div>
                        <div id="settings-content" class="hidden">
                            <div class="world-info-section">
                                <div class="world-name-display">
                                    <span id="wb-world-name">Loading...</span>
                                    <button id="wb-edit-name-btn" title="Edit name">✏️</button>
                                </div>
                                <p id="wb-world-id" class="world-id-text"></p>
                            </div>

                            <div class="settings-section">
                                <h4>📝 Description</h4>
                                <textarea id="wb-description" placeholder="Describe your world..."></textarea>
                            </div>

                            <div class="settings-section">
                                <h4>🔒 Visibility</h4>
                                <div class="visibility-options">
                                    <label class="visibility-option">
                                        <input type="radio" name="wb-visibility" value="public">
                                        <span class="visibility-label">🌍 Public</span>
                                        <span class="visibility-desc">Anyone can find and join</span>
                                    </label>
                                    <label class="visibility-option">
                                        <input type="radio" name="wb-visibility" value="unlisted">
                                        <span class="visibility-label">🔗 Unlisted</span>
                                        <span class="visibility-desc">Only accessible via link</span>
                                    </label>
                                    <label class="visibility-option">
                                        <input type="radio" name="wb-visibility" value="private">
                                        <span class="visibility-label">🔒 Private</span>
                                        <span class="visibility-desc">Only you can access</span>
                                    </label>
                                </div>
                            </div>

                            <div class="settings-section">
                                <h4>🛠️ Permissions</h4>
                                <div class="permission-row">
                                    <label>Building:</label>
                                    <select id="wb-allow-building">
                                        <option value="all">Everyone</option>
                                        <option value="owner">Owner Only</option>
                                        <option value="none">Nobody</option>
                                    </select>
                                </div>
                                <div class="permission-row">
                                    <label>Creature Spawning:</label>
                                    <select id="wb-allow-spawn">
                                        <option value="all">Everyone</option>
                                        <option value="owner">Owner Only</option>
                                        <option value="none">Nobody</option>
                                    </select>
                                </div>
                                <div class="permission-row">
                                    <label>
                                        <input type="checkbox" id="wb-allow-pvp">
                                        Allow PvP Combat
                                    </label>
                                </div>
                            </div>

                            <div class="settings-section">
                                <h4>🌅 Environment</h4>
                                <div class="permission-row">
                                    <label>Time of Day:</label>
                                    <input type="range" id="wb-time-of-day" min="0" max="1" step="0.01" value="0.25">
                                    <span id="wb-time-display">Noon</span>
                                </div>
                                <div class="permission-row">
                                    <label>
                                        <input type="checkbox" id="wb-time-frozen">
                                        Freeze Time
                                    </label>
                                </div>
                            </div>

                            <div class="settings-section">
                                <h4>🎨 Sky Appearance</h4>
                                <div class="permission-row">
                                    <label>Sky Color:</label>
                                    <input type="color" id="wb-sky-color" value="#87CEEB">
                                </div>
                                <div class="sky-presets">
                                    <button type="button" class="preset-btn wb-sky-preset" data-color="#87CEEB" title="Earth Blue">🌍</button>
                                    <button type="button" class="preset-btn wb-sky-preset" data-color="#FF6B35" title="Sunset Orange">🌅</button>
                                    <button type="button" class="preset-btn wb-sky-preset" data-color="#050510" title="Space Black">🌌</button>
                                    <button type="button" class="preset-btn wb-sky-preset" data-color="#1E90FF" title="Bright Blue">☀️</button>
                                    <button type="button" class="preset-btn wb-sky-preset" data-color="#2D1B4E" title="Purple Night">🔮</button>
                                </div>
                            </div>

                            <div class="settings-section">
                                <h4>⚖️ Physics</h4>
                                <div class="permission-row">
                                    <label>Gravity:</label>
                                    <input type="range" id="wb-gravity" min="0.1" max="3.0" step="0.1" value="1.0">
                                    <span id="wb-gravity-display">Normal (1.0x)</span>
                                </div>
                                <div class="gravity-presets">
                                    <button type="button" class="preset-btn wb-gravity-preset" data-value="0.3" title="Moon Gravity">🌙 Moon</button>
                                    <button type="button" class="preset-btn wb-gravity-preset" data-value="1.0" title="Normal Gravity">🌍 Normal</button>
                                    <button type="button" class="preset-btn wb-gravity-preset" data-value="2.0" title="Heavy Gravity">🪨 Heavy</button>
                                </div>
                            </div>

                            <div class="settings-section">
                                <h4>🦁 Allowed Creatures</h4>
                                <p class="section-desc">Select which creatures can spawn in this world</p>
                                <div class="creature-controls">
                                    <button type="button" id="wb-creatures-all">Select All</button>
                                    <button type="button" id="wb-creatures-none">Clear All</button>
                                    <input type="text" id="wb-creature-search" placeholder="Search...">
                                </div>
                                <div class="creature-grid" id="wb-creature-grid">
                                    <!-- Populated dynamically -->
                                </div>
                            </div>

                            <div class="settings-section">
                                <h4>🔗 Share Link</h4>
                                <div class="share-link-row">
                                    <input type="text" id="wb-share-link" readonly>
                                    <button type="button" id="wb-copy-link" title="Copy link">📋</button>
                                </div>
                            </div>

                            <div class="settings-actions">
                                <button type="button" id="wb-save-btn" class="save-btn">💾 Save Changes</button>
                                <button type="button" id="wb-reset-world-btn" class="danger-btn">🗑️ Reset World</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Inject styles
        this.injectStyles();

        // Setup event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Close button
        document.getElementById('world-browser-close').addEventListener('click', () => {
            this.hide();
        });

        // Tab switching
        document.querySelectorAll('.world-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // ========== Create Form Event Listeners ==========
        this.setupCreateFormListeners();

        // Create world form
        document.getElementById('create-world-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createWorld();
        });

        // Create first world button
        document.querySelector('.create-world-btn')?.addEventListener('click', () => {
            this.switchTab('create');
        });

        // Search input
        document.getElementById('world-search').addEventListener('input', (e) => {
            this.filterWorlds(e.target.value);
        });

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !document.getElementById('world-browser-modal').classList.contains('hidden')) {
                this.hide();
            }
        });

        // Close on click outside
        document.getElementById('world-browser-modal').addEventListener('click', (e) => {
            if (e.target.id === 'world-browser-modal') {
                this.hide();
            }
        });
    }

    setupWorldButton() {
        // Add a "Worlds" button to the top-right controls
        const topRightControls = document.getElementById('top-right-controls');
        if (topRightControls) {
            const worldBtn = document.createElement('button');
            worldBtn.id = 'world-btn';
            worldBtn.title = 'World Browser';
            worldBtn.textContent = '🌍';
            worldBtn.addEventListener('click', () => this.show());
            topRightControls.insertBefore(worldBtn, topRightControls.firstChild);
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.world-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.world-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `world-tab-${tabName}`);
        });

        // Load data for the selected tab
        if (tabName === 'browse') {
            this.loadPublicWorlds();
        } else if (tabName === 'my-worlds') {
            this.loadMyWorlds();
        } else if (tabName === 'settings') {
            this.loadSettingsTab();
        } else if (tabName === 'create') {
            this.populateCreateCreatureGrid();
        }
    }

    async show() {
        const modal = document.getElementById('world-browser-modal');
        modal.classList.remove('hidden');

        // Release pointer lock if active
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }

        // Load initial data
        await this.loadPublicWorlds();
    }

    hide() {
        const modal = document.getElementById('world-browser-modal');
        modal.classList.add('hidden');
    }

    async loadPublicWorlds() {
        if (this.isLoading) return;
        this.isLoading = true;

        const grid = document.getElementById('public-worlds-grid');
        grid.innerHTML = '<div class="loading-spinner">Loading worlds...</div>';

        try {
            const serverUrl = this.getServerUrl();
            const response = await fetch(`${serverUrl}/api/worlds?limit=20`);
            const data = await response.json();

            this.publicWorlds = data.worlds || [];
            this.renderWorldsGrid(grid, this.publicWorlds);
        } catch (error) {
            console.error('[WorldBrowserUI] Failed to load public worlds:', error);
            grid.innerHTML = '<div class="error-message">Failed to load worlds. Please try again.</div>';
        } finally {
            this.isLoading = false;
        }
    }

    async loadMyWorlds() {
        if (!this.user) {
            document.getElementById('my-worlds-grid').innerHTML = `
                <div class="no-worlds-message">
                    <p>Sign in to see your worlds.</p>
                    <button class="sign-in-btn" onclick="document.getElementById('auth-btn').click()">👤 Sign In</button>
                </div>
            `;
            return;
        }

        if (this.isLoading) return;
        this.isLoading = true;

        const grid = document.getElementById('my-worlds-grid');
        grid.innerHTML = '<div class="loading-spinner">Loading your worlds...</div>';

        try {
            const serverUrl = this.getServerUrl();
            const token = await this.user.getIdToken();
            const response = await fetch(`${serverUrl}/api/worlds/mine`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            this.myWorlds = data.worlds || [];

            if (this.myWorlds.length === 0) {
                grid.innerHTML = `
                    <div class="no-worlds-message">
                        <p>You haven't created any worlds yet.</p>
                        <button class="create-world-btn">✨ Create Your First World</button>
                    </div>
                `;
                grid.querySelector('.create-world-btn').addEventListener('click', () => {
                    this.switchTab('create');
                });
            } else {
                this.renderWorldsGrid(grid, this.myWorlds, true);
            }
        } catch (error) {
            console.error('[WorldBrowserUI] Failed to load my worlds:', error);
            grid.innerHTML = '<div class="error-message">Failed to load your worlds. Please try again.</div>';
        } finally {
            this.isLoading = false;
        }
    }

    renderWorldsGrid(container, worlds, showControls = false) {
        if (!worlds || worlds.length === 0) {
            container.innerHTML = '<div class="no-worlds-message">No worlds found.</div>';
            return;
        }

        container.innerHTML = worlds.map(world => `
            <div class="world-card" data-world-id="${world.id}">
                <div class="world-thumbnail">
                    ${world.thumbnailUrl ? `<img src="${world.thumbnailUrl}" alt="${world.name}">` : '🌍'}
                </div>
                <div class="world-info">
                    <h4 class="world-name">${this.escapeHtml(world.name)}</h4>
                    <p class="world-owner">by ${this.escapeHtml(world.ownerName)}</p>
                    <p class="world-stats">
                        <span class="player-count">${world.playerCount || 0} online</span>
                        <span class="visit-count">${world.totalVisits || 0} visits</span>
                    </p>
                </div>
                <div class="world-actions">
                    <button class="join-world-btn" data-world-id="${world.id}">Join</button>
                    ${showControls ? `
                        <button class="share-world-btn" data-world-id="${world.id}" title="Copy share link">🔗</button>
                        <button class="delete-world-btn" data-world-id="${world.id}" title="Delete world">🗑️</button>
                    ` : ''}
                </div>
            </div>
        `).join('');

        // Add event listeners
        container.querySelectorAll('.join-world-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const worldId = btn.dataset.worldId;
                this.joinWorld(worldId);
            });
        });

        container.querySelectorAll('.share-world-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const worldId = btn.dataset.worldId;
                this.shareWorld(worldId);
            });
        });

        container.querySelectorAll('.delete-world-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const worldId = btn.dataset.worldId;
                this.deleteWorld(worldId);
            });
        });
    }

    filterWorlds(searchTerm) {
        const term = searchTerm.toLowerCase();
        const filtered = this.publicWorlds.filter(world =>
            world.name.toLowerCase().includes(term) ||
            world.ownerName.toLowerCase().includes(term) ||
            (world.description && world.description.toLowerCase().includes(term))
        );
        this.renderWorldsGrid(document.getElementById('public-worlds-grid'), filtered);
    }

    async createWorld() {
        if (!this.user) {
            alert('Please sign in to create a world.');
            return;
        }

        const name = document.getElementById('world-name').value.trim();
        const description = document.getElementById('world-description').value.trim();
        const visibility = document.getElementById('world-visibility').value;
        const seedInput = document.getElementById('world-seed').value;
        const seed = seedInput ? parseInt(seedInput) : undefined;

        if (!name) {
            alert('Please enter a world name.');
            return;
        }

        // Get customization settings
        const skyColor = document.getElementById('create-sky-color').value;
        const gravity = parseFloat(document.getElementById('create-gravity').value);

        // Get landscape settings
        const landscapeSettings = {
            enableOcean: document.getElementById('create-enable-ocean').checked,
            enableRivers: document.getElementById('create-enable-rivers').checked,
            enableVillages: document.getElementById('create-enable-villages').checked,
            seaLevel: parseInt(document.getElementById('create-sea-level').value),
            terrainScale: parseFloat(document.getElementById('create-terrain-scale').value)
        };

        // Get enabled biomes
        const enabledBiomes = this.getSelectedBiomes();

        // Get allowed creatures
        const allowedCreatures = this.getSelectedCreateCreatures();

        const submitBtn = document.querySelector('.create-world-submit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';

        try {
            const serverUrl = this.getServerUrl();
            const token = await this.user.getIdToken();

            const response = await fetch(`${serverUrl}/api/worlds`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name,
                    description,
                    visibility,
                    seed,
                    settings: {
                        allowedCreatures,
                        enabledBiomes
                    },
                    customizations: {
                        skyColor,
                        gravity,
                        landscapeSettings
                    }
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create world');
            }

            console.log('[WorldBrowserUI] World created:', data.world);

            // Clear form
            document.getElementById('create-world-form').reset();
            // Reset create form to defaults
            this.resetCreateFormDefaults();

            // Show success and switch to my worlds
            alert(`World "${data.world.name}" created successfully!`);
            this.switchTab('my-worlds');

            // Offer to join the new world
            if (confirm('Would you like to join your new world now?')) {
                this.joinWorld(data.world.id);
            }

        } catch (error) {
            console.error('[WorldBrowserUI] Failed to create world:', error);
            alert(`Failed to create world: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '✨ Create World';
        }
    }

    joinWorld(worldId) {
        console.log('[WorldBrowserUI] Joining world:', worldId);

        // Navigate to the world URL
        const newUrl = `/world/${worldId}`;
        window.history.pushState({}, '', newUrl);

        // Close modal
        this.hide();

        // Reload the page to join the new world
        // In a more sophisticated implementation, we could do this without a reload
        window.location.reload();
    }

    async shareWorld(worldId) {
        const shareUrl = `${window.location.origin}/world/${worldId}`;

        try {
            await navigator.clipboard.writeText(shareUrl);
            this.showToast('Share link copied to clipboard!');
        } catch (error) {
            // Fallback for browsers without clipboard API
            prompt('Copy this link to share your world:', shareUrl);
        }
    }

    async deleteWorld(worldId) {
        if (!confirm('Are you sure you want to delete this world? This cannot be undone.')) {
            return;
        }

        try {
            const serverUrl = this.getServerUrl();
            const token = await this.user.getIdToken();

            const response = await fetch(`${serverUrl}/api/worlds/${worldId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete world');
            }

            this.showToast('World deleted successfully.');
            this.loadMyWorlds();

        } catch (error) {
            console.error('[WorldBrowserUI] Failed to delete world:', error);
            alert(`Failed to delete world: ${error.message}`);
        }
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'world-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

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

    // ========== Create Form Methods ==========

    setupCreateFormListeners() {
        // Gravity slider
        const gravitySlider = document.getElementById('create-gravity');
        if (gravitySlider) {
            gravitySlider.addEventListener('input', (e) => {
                this.updateCreateGravityDisplay(parseFloat(e.target.value));
            });
        }

        // Gravity presets
        document.querySelectorAll('.create-gravity-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const value = parseFloat(e.target.dataset.value);
                const slider = document.getElementById('create-gravity');
                if (slider) {
                    slider.value = value;
                    this.updateCreateGravityDisplay(value);
                }
            });
        });

        // Sky color presets
        document.querySelectorAll('.create-sky-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const color = e.target.dataset.color;
                const picker = document.getElementById('create-sky-color');
                if (picker) {
                    picker.value = color;
                }
            });
        });

        // Sea level slider
        const seaLevelSlider = document.getElementById('create-sea-level');
        if (seaLevelSlider) {
            seaLevelSlider.addEventListener('input', (e) => {
                document.getElementById('create-sea-level-display').textContent = e.target.value;
            });
        }

        // Terrain scale slider
        const terrainScaleSlider = document.getElementById('create-terrain-scale');
        if (terrainScaleSlider) {
            terrainScaleSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.updateCreateTerrainScaleDisplay(value);
            });
        }

        // Biome item clicks
        document.querySelectorAll('#create-biome-grid .biome-item').forEach(item => {
            item.addEventListener('click', () => {
                const checkbox = item.querySelector('input');
                checkbox.checked = !checkbox.checked;
                item.classList.toggle('selected', checkbox.checked);
            });
        });

        // Creature selection controls
        const creaturesAllBtn = document.getElementById('create-creatures-all');
        if (creaturesAllBtn) {
            creaturesAllBtn.addEventListener('click', () => {
                this.selectAllCreateCreatures(true);
            });
        }

        const creaturesNoneBtn = document.getElementById('create-creatures-none');
        if (creaturesNoneBtn) {
            creaturesNoneBtn.addEventListener('click', () => {
                this.selectAllCreateCreatures(false);
            });
        }

        const creatureSearch = document.getElementById('create-creature-search');
        if (creatureSearch) {
            creatureSearch.addEventListener('input', (e) => {
                this.filterCreateCreatures(e.target.value);
            });
        }
    }

    updateCreateGravityDisplay(value) {
        const display = document.getElementById('create-gravity-display');
        if (!display) return;

        let label = 'Normal';
        if (value < 0.5) label = 'Very Low';
        else if (value < 0.8) label = 'Low';
        else if (value < 1.2) label = 'Normal';
        else if (value < 1.8) label = 'High';
        else label = 'Very High';
        display.textContent = `${label} (${value.toFixed(1)}x)`;
    }

    updateCreateTerrainScaleDisplay(value) {
        const display = document.getElementById('create-terrain-scale-display');
        if (!display) return;

        let label = 'Normal';
        if (value < 0.7) label = 'Flat';
        else if (value < 1.3) label = 'Normal';
        else label = 'Mountainous';
        display.textContent = `${label} (${value.toFixed(1)}x)`;
    }

    populateCreateCreatureGrid() {
        const grid = document.getElementById('create-creature-grid');
        if (!grid) return;

        // Only populate once
        if (grid.children.length > 0) return;

        // Get creature list from game's AnimalClasses or use a predefined list
        const creatureNames = this.game.AnimalClasses ?
            Object.keys(this.game.AnimalClasses).sort() :
            // Fallback list of common creatures
            ['Bear', 'Bunny', 'Cat', 'Chicken', 'Cow', 'Deer', 'Dog', 'Duck', 'Eagle',
             'Elephant', 'Fish', 'Fox', 'Frog', 'Giraffe', 'Goat', 'Horse', 'Kangaroo',
             'Lion', 'Monkey', 'Owl', 'Penguin', 'Pig', 'Sheep', 'Snake', 'Tiger',
             'Turtle', 'Wolf', 'Zebra'].sort();

        for (const name of creatureNames) {
            // Skip non-creature types
            if (['Animal', 'Vehicle', 'Agent'].includes(name)) continue;

            const item = document.createElement('div');
            item.className = 'creature-item selected';
            item.dataset.creature = name;

            item.innerHTML = `
                <input type="checkbox" checked>
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

    selectAllCreateCreatures(select) {
        const grid = document.getElementById('create-creature-grid');
        if (!grid) return;

        grid.querySelectorAll('.creature-item').forEach(item => {
            const checkbox = item.querySelector('input');
            checkbox.checked = select;
            item.classList.toggle('selected', select);
        });
    }

    filterCreateCreatures(searchText) {
        const grid = document.getElementById('create-creature-grid');
        if (!grid) return;

        const search = searchText.toLowerCase();
        grid.querySelectorAll('.creature-item').forEach(item => {
            const name = item.dataset.creature.toLowerCase();
            item.style.display = name.includes(search) ? '' : 'none';
        });
    }

    getSelectedCreateCreatures() {
        const grid = document.getElementById('create-creature-grid');
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

    getSelectedBiomes() {
        const grid = document.getElementById('create-biome-grid');
        if (!grid) return null;

        const selected = [];
        let allSelected = true;

        grid.querySelectorAll('.biome-item').forEach(item => {
            const checkbox = item.querySelector('input');
            if (checkbox.checked) {
                selected.push(item.dataset.biome);
            } else {
                allSelected = false;
            }
        });

        // If all selected, return null (meaning "all biomes")
        if (allSelected) return null;
        return selected;
    }

    resetCreateFormDefaults() {
        // Reset sky color
        const skyColor = document.getElementById('create-sky-color');
        if (skyColor) skyColor.value = '#87CEEB';

        // Reset gravity
        const gravity = document.getElementById('create-gravity');
        if (gravity) {
            gravity.value = 1.0;
            this.updateCreateGravityDisplay(1.0);
        }

        // Reset landscape settings
        const oceanCheck = document.getElementById('create-enable-ocean');
        if (oceanCheck) oceanCheck.checked = true;

        const riversCheck = document.getElementById('create-enable-rivers');
        if (riversCheck) riversCheck.checked = true;

        const villagesCheck = document.getElementById('create-enable-villages');
        if (villagesCheck) villagesCheck.checked = true;

        const seaLevel = document.getElementById('create-sea-level');
        if (seaLevel) {
            seaLevel.value = 30;
            document.getElementById('create-sea-level-display').textContent = '30';
        }

        const terrainScale = document.getElementById('create-terrain-scale');
        if (terrainScale) {
            terrainScale.value = 1.0;
            this.updateCreateTerrainScaleDisplay(1.0);
        }

        // Reset biomes
        const biomeGrid = document.getElementById('create-biome-grid');
        if (biomeGrid) {
            biomeGrid.querySelectorAll('.biome-item').forEach(item => {
                const checkbox = item.querySelector('input');
                checkbox.checked = true;
                item.classList.add('selected');
            });
        }

        // Reset creatures - select all
        this.selectAllCreateCreatures(true);
    }

    // ========== Settings Tab Methods ==========

    loadSettingsTab() {
        const notInWorld = document.getElementById('settings-not-in-world');
        const notOwner = document.getElementById('settings-not-owner');
        const settingsContent = document.getElementById('settings-content');

        // Check if we're in a world
        if (!this.currentWorld) {
            notInWorld.classList.remove('hidden');
            notOwner.classList.add('hidden');
            settingsContent.classList.add('hidden');
            return;
        }

        // Check if user is the owner
        if (!this.isOwner) {
            notInWorld.classList.add('hidden');
            notOwner.classList.remove('hidden');
            notOwner.querySelector('.settings-world-name').textContent = `Currently in: ${this.currentWorld.name}`;
            settingsContent.classList.add('hidden');
            return;
        }

        // User is owner, show settings
        notInWorld.classList.add('hidden');
        notOwner.classList.add('hidden');
        settingsContent.classList.remove('hidden');

        this.populateSettings();
        this.setupSettingsEventListeners();
    }

    setupSettingsEventListeners() {
        // Only setup once
        if (this._settingsListenersSetup) return;
        this._settingsListenersSetup = true;

        // Time slider
        const timeSlider = document.getElementById('wb-time-of-day');
        if (timeSlider) {
            timeSlider.addEventListener('input', (e) => {
                this.updateTimeDisplay(parseFloat(e.target.value));
            });
        }

        // Gravity slider
        const gravitySlider = document.getElementById('wb-gravity');
        if (gravitySlider) {
            gravitySlider.addEventListener('input', (e) => {
                this.updateGravityDisplay(parseFloat(e.target.value));
            });
        }

        // Gravity presets
        document.querySelectorAll('.wb-gravity-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const value = parseFloat(e.target.dataset.value);
                const slider = document.getElementById('wb-gravity');
                if (slider) {
                    slider.value = value;
                    this.updateGravityDisplay(value);
                }
            });
        });

        // Sky color picker
        const skyColorPicker = document.getElementById('wb-sky-color');
        if (skyColorPicker) {
            skyColorPicker.addEventListener('input', (e) => {
                if (this.game.environment) {
                    this.game.environment.applySkyColor(e.target.value);
                }
            });
        }

        // Sky color presets
        document.querySelectorAll('.wb-sky-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const color = e.target.dataset.color;
                const picker = document.getElementById('wb-sky-color');
                if (picker) {
                    picker.value = color;
                    if (this.game.environment) {
                        this.game.environment.applySkyColor(color);
                    }
                }
            });
        });

        // Copy link button
        const copyLinkBtn = document.getElementById('wb-copy-link');
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', () => {
                const linkInput = document.getElementById('wb-share-link');
                navigator.clipboard.writeText(linkInput.value).then(() => {
                    this.showToast('Link copied!');
                });
            });
        }

        // Save button
        const saveBtn = document.getElementById('wb-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveWorldSettings();
            });
        }

        // Reset world button
        const resetBtn = document.getElementById('wb-reset-world-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetWorld();
            });
        }

        // Edit name button
        const editNameBtn = document.getElementById('wb-edit-name-btn');
        if (editNameBtn) {
            editNameBtn.addEventListener('click', () => {
                this.editWorldName();
            });
        }

        // Creature selection controls
        const creaturesAllBtn = document.getElementById('wb-creatures-all');
        if (creaturesAllBtn) {
            creaturesAllBtn.addEventListener('click', () => {
                this.selectAllSettingsCreatures(true);
            });
        }

        const creaturesNoneBtn = document.getElementById('wb-creatures-none');
        if (creaturesNoneBtn) {
            creaturesNoneBtn.addEventListener('click', () => {
                this.selectAllSettingsCreatures(false);
            });
        }

        const creatureSearch = document.getElementById('wb-creature-search');
        if (creatureSearch) {
            creatureSearch.addEventListener('input', (e) => {
                this.filterSettingsCreatures(e.target.value);
            });
        }
    }

    populateSettings() {
        if (!this.currentWorld) return;

        // World info
        const nameEl = document.getElementById('wb-world-name');
        if (nameEl) nameEl.textContent = this.currentWorld.name;

        const idEl = document.getElementById('wb-world-id');
        if (idEl) idEl.textContent = `ID: ${this.currentWorld.id}`;

        const descEl = document.getElementById('wb-description');
        if (descEl) descEl.value = this.currentWorld.description || '';

        // Visibility
        const visibilityRadio = document.querySelector(`input[name="wb-visibility"][value="${this.currentWorld.visibility}"]`);
        if (visibilityRadio) {
            visibilityRadio.checked = true;
        }

        // Permissions
        const allowBuildingEl = document.getElementById('wb-allow-building');
        if (allowBuildingEl) allowBuildingEl.value = this.currentWorld.settings?.allowBuilding || 'all';

        const allowSpawnEl = document.getElementById('wb-allow-spawn');
        if (allowSpawnEl) allowSpawnEl.value = this.currentWorld.settings?.allowCreatureSpawn || 'all';

        const allowPvPEl = document.getElementById('wb-allow-pvp');
        if (allowPvPEl) allowPvPEl.checked = this.currentWorld.settings?.allowPvP || false;

        // Environment
        const timeOfDay = this.currentWorld.settings?.timeOfDay ?? 0.25;
        const timeSlider = document.getElementById('wb-time-of-day');
        if (timeSlider) {
            timeSlider.value = timeOfDay;
            this.updateTimeDisplay(timeOfDay);
        }

        const timeFrozenEl = document.getElementById('wb-time-frozen');
        if (timeFrozenEl) timeFrozenEl.checked = this.currentWorld.settings?.timeFrozen || false;

        // Sky Color
        const skyColor = this.currentWorld.customizations?.skyColor || '#87CEEB';
        const skyColorEl = document.getElementById('wb-sky-color');
        if (skyColorEl) skyColorEl.value = skyColor;

        // Gravity
        const gravity = this.currentWorld.customizations?.gravity ?? 1.0;
        const gravitySlider = document.getElementById('wb-gravity');
        if (gravitySlider) {
            gravitySlider.value = gravity;
            this.updateGravityDisplay(gravity);
        }

        // Share link
        const shareLinkEl = document.getElementById('wb-share-link');
        if (shareLinkEl) shareLinkEl.value = `${window.location.origin}/world/${this.currentWorld.id}`;

        // Populate creature grid
        this.populateSettingsCreatureGrid();
    }

    updateTimeDisplay(value) {
        const display = document.getElementById('wb-time-display');
        if (!display) return;

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

    updateGravityDisplay(value) {
        const display = document.getElementById('wb-gravity-display');
        if (!display) return;

        let label = 'Normal';
        if (value < 0.5) label = 'Very Low';
        else if (value < 0.8) label = 'Low';
        else if (value < 1.2) label = 'Normal';
        else if (value < 1.8) label = 'High';
        else label = 'Very High';
        display.textContent = `${label} (${value.toFixed(1)}x)`;
    }

    /**
     * Populate the creature grid in the Settings tab
     */
    populateSettingsCreatureGrid() {
        const grid = document.getElementById('wb-creature-grid');
        if (!grid) return;

        // Clear existing content
        grid.innerHTML = '';

        // Get creature list from game's AnimalClasses
        const creatureNames = this.game.AnimalClasses ?
            Object.keys(this.game.AnimalClasses).sort() :
            ['Bear', 'Bunny', 'Cat', 'Chicken', 'Cow', 'Deer', 'Dog', 'Duck', 'Eagle',
             'Elephant', 'Fish', 'Fox', 'Frog', 'Giraffe', 'Goat', 'Horse', 'Kangaroo',
             'Lion', 'Monkey', 'Owl', 'Penguin', 'Pig', 'Sheep', 'Snake', 'Tiger',
             'Turtle', 'Wolf', 'Zebra'].sort();

        // Get currently allowed creatures from world settings
        const allowedCreatures = this.currentWorld?.settings?.allowedCreatures;
        const allowAll = allowedCreatures === null || allowedCreatures === undefined;
        const allowedSet = allowAll ? null : new Set(allowedCreatures);

        for (const name of creatureNames) {
            // Skip non-creature types
            if (['Animal', 'Vehicle', 'Agent'].includes(name)) continue;

            const isSelected = allowAll || (allowedSet && allowedSet.has(name));

            const item = document.createElement('div');
            item.className = `creature-item${isSelected ? ' selected' : ''}`;
            item.dataset.creature = name;

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

    /**
     * Select or deselect all creatures in the Settings tab
     */
    selectAllSettingsCreatures(select) {
        const grid = document.getElementById('wb-creature-grid');
        if (!grid) return;

        grid.querySelectorAll('.creature-item').forEach(item => {
            const checkbox = item.querySelector('input');
            checkbox.checked = select;
            item.classList.toggle('selected', select);
        });
    }

    /**
     * Filter creatures by search text in the Settings tab
     */
    filterSettingsCreatures(searchText) {
        const grid = document.getElementById('wb-creature-grid');
        if (!grid) return;

        const search = searchText.toLowerCase();
        grid.querySelectorAll('.creature-item').forEach(item => {
            const name = item.dataset.creature.toLowerCase();
            item.style.display = name.includes(search) ? '' : 'none';
        });
    }

    /**
     * Get the list of selected creatures in the Settings tab
     * @returns {string[]|null} - Array of selected creature names, or null if all selected
     */
    getSelectedSettingsCreatures() {
        const grid = document.getElementById('wb-creature-grid');
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

    async saveWorldSettings() {
        if (!this.currentWorld || !this.user) return;

        const saveBtn = document.getElementById('wb-save-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            const visibility = document.querySelector('input[name="wb-visibility"]:checked')?.value || 'unlisted';
            const description = document.getElementById('wb-description').value.trim();
            const allowBuilding = document.getElementById('wb-allow-building').value;
            const allowSpawn = document.getElementById('wb-allow-spawn').value;
            const allowPvP = document.getElementById('wb-allow-pvp').checked;
            const timeOfDay = parseFloat(document.getElementById('wb-time-of-day').value);
            const timeFrozen = document.getElementById('wb-time-frozen').checked;
            const skyColor = document.getElementById('wb-sky-color').value;
            const gravity = parseFloat(document.getElementById('wb-gravity').value);
            const allowedCreatures = this.getSelectedSettingsCreatures();

            const serverUrl = this.getServerUrl();
            const token = await this.user.getIdToken();

            const response = await fetch(`${serverUrl}/api/worlds/${this.currentWorld.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    description,
                    visibility,
                    settings: {
                        ...this.currentWorld.settings,
                        allowBuilding,
                        allowCreatureSpawn: allowSpawn,
                        allowPvP,
                        timeOfDay,
                        timeFrozen,
                        allowedCreatures
                    },
                    customizations: {
                        ...this.currentWorld.customizations,
                        skyColor,
                        gravity
                    }
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save settings');
            }

            const data = await response.json();
            this.currentWorld = data.world;

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

            // Apply creature filter and despawn disallowed creatures
            if (this.game.spawnManager) {
                this.game.spawnManager.setAllowedCreatures(allowedCreatures);
                console.log(`[WorldBrowserUI] Applied creature filter:`, allowedCreatures);
            }

            // Broadcast settings change to other players
            if (this.game.socketManager?.socket) {
                this.game.socketManager.socket.emit('world:settings_changed', {
                    worldId: this.currentWorld.id,
                    settings: this.currentWorld.settings,
                    customizations: this.currentWorld.customizations
                });
            }

            this.showToast('Settings saved!');

        } catch (error) {
            console.error('[WorldBrowserUI] Failed to save settings:', error);
            this.showToast(`Failed to save: ${error.message}`);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Save Changes';
        }
    }

    async editWorldName() {
        const currentName = this.currentWorld?.name || '';
        const newName = prompt('Enter new world name:', currentName);

        if (!newName || newName.trim() === currentName) return;

        try {
            const serverUrl = this.getServerUrl();
            const token = await this.user.getIdToken();

            const response = await fetch(`${serverUrl}/api/worlds/${this.currentWorld.id}`, {
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
            this.currentWorld = data.world;

            document.getElementById('wb-world-name').textContent = this.currentWorld.name;
            this.showToast('World name updated!');

        } catch (error) {
            console.error('[WorldBrowserUI] Failed to update name:', error);
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
            if (this.game.socketManager?.socket) {
                this.game.socketManager.socket.emit('world:reset');
                this.showToast('World reset initiated...');
                this.hide();
            }
        } catch (error) {
            console.error('[WorldBrowserUI] Failed to reset world:', error);
            this.showToast('Failed to reset world');
        }
    }

    injectStyles() {
        if (document.getElementById('world-browser-styles')) return;

        const style = document.createElement('style');
        style.id = 'world-browser-styles';
        style.textContent = `
            #world-browser-modal {
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

            #world-browser-modal.hidden {
                display: none;
            }

            .world-browser-content {
                background: linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%);
                border: 3px solid #444;
                border-radius: 8px;
                width: 90%;
                max-width: 800px;
                max-height: 80vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                font-family: 'VT323', monospace;
            }

            .world-browser-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                background: #333;
                border-bottom: 2px solid #444;
            }

            .world-browser-header h3 {
                margin: 0;
                font-size: 24px;
                color: #fff;
            }

            #world-browser-close {
                background: none;
                border: none;
                color: #fff;
                font-size: 28px;
                cursor: pointer;
                padding: 0 5px;
            }

            #world-browser-close:hover {
                color: #ff5555;
            }

            .world-browser-body {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
            }

            .world-browser-tabs {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
            }

            .world-tab {
                flex: 1;
                padding: 12px;
                background: #333;
                border: 2px solid #444;
                border-radius: 4px;
                color: #aaa;
                font-size: 16px;
                cursor: pointer;
                font-family: inherit;
            }

            .world-tab.active {
                background: #4CAF50;
                border-color: #5CBF60;
                color: #fff;
            }

            .world-tab:hover:not(.active) {
                background: #444;
            }

            .world-tab-content {
                display: none;
            }

            .world-tab-content.active {
                display: block;
            }

            .world-search-container {
                margin-bottom: 15px;
            }

            #world-search {
                width: 100%;
                padding: 12px;
                background: #222;
                border: 2px solid #444;
                border-radius: 4px;
                color: #fff;
                font-size: 16px;
                font-family: inherit;
            }

            .worlds-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 15px;
            }

            .world-card {
                background: #333;
                border: 2px solid #444;
                border-radius: 8px;
                overflow: hidden;
                transition: transform 0.2s, border-color 0.2s;
            }

            .world-card:hover {
                transform: translateY(-2px);
                border-color: #4CAF50;
            }

            .world-thumbnail {
                height: 100px;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 48px;
            }

            .world-thumbnail img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .world-info {
                padding: 12px;
            }

            .world-name {
                margin: 0 0 5px;
                font-size: 18px;
                color: #fff;
            }

            .world-owner {
                margin: 0;
                font-size: 14px;
                color: #888;
            }

            .world-stats {
                margin: 8px 0 0;
                font-size: 12px;
                color: #666;
                display: flex;
                gap: 15px;
            }

            .world-actions {
                display: flex;
                padding: 10px;
                gap: 8px;
                border-top: 1px solid #444;
            }

            .join-world-btn {
                flex: 1;
                padding: 8px 16px;
                background: #4CAF50;
                border: none;
                border-radius: 4px;
                color: #fff;
                font-size: 14px;
                cursor: pointer;
                font-family: inherit;
            }

            .join-world-btn:hover {
                background: #5CBF60;
            }

            .share-world-btn, .delete-world-btn {
                padding: 8px 12px;
                background: #444;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }

            .share-world-btn:hover {
                background: #555;
            }

            .delete-world-btn:hover {
                background: #D32F2F;
            }

            .no-worlds-message {
                text-align: center;
                padding: 40px;
                color: #888;
            }

            .no-worlds-message p {
                margin: 0 0 15px;
                font-size: 18px;
            }

            .create-world-form {
                max-width: 500px;
                margin: 0 auto;
            }

            .form-group {
                margin-bottom: 20px;
            }

            .form-group label {
                display: block;
                margin-bottom: 8px;
                color: #fff;
                font-size: 16px;
            }

            .form-group input,
            .form-group textarea,
            .form-group select {
                width: 100%;
                padding: 12px;
                background: #222;
                border: 2px solid #444;
                border-radius: 4px;
                color: #fff;
                font-size: 16px;
                font-family: inherit;
            }

            .form-group textarea {
                height: 80px;
                resize: vertical;
            }

            .create-world-submit {
                width: 100%;
                padding: 15px;
                background: #4CAF50;
                border: none;
                border-radius: 4px;
                color: #fff;
                font-size: 18px;
                cursor: pointer;
                font-family: inherit;
            }

            .create-world-submit:hover:not(:disabled) {
                background: #5CBF60;
            }

            .create-world-submit:disabled {
                background: #666;
                cursor: not-allowed;
            }

            .loading-spinner {
                text-align: center;
                padding: 40px;
                color: #888;
                font-size: 18px;
            }

            .error-message {
                text-align: center;
                padding: 40px;
                color: #ff5555;
                font-size: 16px;
            }

            .world-toast {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                background: rgba(0, 0, 0, 0.9);
                color: #fff;
                padding: 12px 24px;
                border-radius: 4px;
                font-family: 'VT323', monospace;
                font-size: 16px;
                z-index: 10001;
                transition: transform 0.3s ease;
            }

            .world-toast.show {
                transform: translateX(-50%) translateY(0);
            }

            .sign-in-btn, .create-world-btn {
                padding: 12px 24px;
                background: #4CAF50;
                border: none;
                border-radius: 4px;
                color: #fff;
                font-size: 16px;
                cursor: pointer;
                font-family: inherit;
            }

            .sign-in-btn:hover, .create-world-btn:hover {
                background: #5CBF60;
            }

            /* ========== Settings Tab Styles ========== */

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

            #wb-world-name {
                font-size: 24px;
                color: #fff;
            }

            #wb-edit-name-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 16px;
                opacity: 0.7;
            }

            #wb-edit-name-btn:hover {
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

            #wb-description {
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

            #wb-time-display, #wb-gravity-display {
                min-width: 100px;
                text-align: right;
                color: #888;
                font-size: 12px;
            }

            .share-link-row {
                display: flex;
                gap: 8px;
            }

            #wb-share-link {
                flex: 1;
                padding: 10px;
                background: #222;
                border: 2px solid #444;
                border-radius: 4px;
                color: #888;
                font-family: inherit;
                font-size: 12px;
            }

            #wb-copy-link {
                padding: 10px 15px;
                background: #444;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
            }

            #wb-copy-link:hover {
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

            /* Sky Color Picker */
            #wb-sky-color {
                width: 50px;
                height: 30px;
                padding: 0;
                border: 2px solid #444;
                border-radius: 4px;
                cursor: pointer;
            }

            /* Settings tab specific */
            #settings-content {
                max-width: 500px;
                margin: 0 auto;
            }

            .settings-world-name {
                font-size: 14px;
                color: #aaa;
                margin-top: 5px;
            }

            /* ========== Create Form Settings Styles ========== */

            .create-settings-divider {
                text-align: center;
                margin: 25px 0 20px;
                position: relative;
            }

            .create-settings-divider::before {
                content: '';
                position: absolute;
                left: 0;
                right: 0;
                top: 50%;
                height: 1px;
                background: #444;
            }

            .create-settings-divider span {
                background: #222;
                padding: 0 15px;
                position: relative;
                color: #4CAF50;
                font-size: 16px;
            }

            .create-settings-section {
                margin-bottom: 20px;
                padding: 15px;
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 6px;
            }

            .create-settings-section h4 {
                margin: 0 0 12px;
                font-size: 15px;
                color: #4CAF50;
            }

            .form-row {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
            }

            .form-row label {
                color: #ccc;
                font-size: 14px;
                min-width: 100px;
            }

            .form-row input[type="range"] {
                flex: 1;
            }

            .form-row span {
                min-width: 80px;
                text-align: right;
                color: #888;
                font-size: 12px;
            }

            .checkbox-row {
                margin-bottom: 8px;
            }

            .checkbox-row label {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                color: #ccc;
                font-size: 14px;
            }

            .checkbox-row input[type="checkbox"] {
                width: 16px;
                height: 16px;
                cursor: pointer;
            }

            /* Create form sky color */
            #create-sky-color {
                width: 50px;
                height: 30px;
                padding: 0;
                border: 2px solid #444;
                border-radius: 4px;
                cursor: pointer;
            }

            /* Biome Grid */
            .biome-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
                gap: 6px;
                padding: 8px;
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 4px;
            }

            .biome-item {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 8px;
                background: #222;
                border-radius: 4px;
                font-size: 13px;
                cursor: pointer;
                border: 1px solid transparent;
                color: #ccc;
            }

            .biome-item:hover {
                background: #2a2a2a;
            }

            .biome-item.selected {
                border-color: #4CAF50;
                background: #1a2a1a;
            }

            .biome-item input[type="checkbox"] {
                margin: 0;
                pointer-events: none;
            }

            /* Creature Grid for Create Form */
            #create-creature-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                gap: 6px;
                max-height: 180px;
                overflow-y: auto;
                padding: 8px;
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 4px;
            }

            #create-creature-grid .creature-item {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 5px 8px;
                background: #222;
                border-radius: 4px;
                font-size: 11px;
                cursor: pointer;
                border: 1px solid transparent;
                color: #ccc;
            }

            #create-creature-grid .creature-item:hover {
                background: #2a2a2a;
            }

            #create-creature-grid .creature-item.selected {
                border-color: #4CAF50;
                background: #1a2a1a;
            }

            #create-creature-grid .creature-item input[type="checkbox"] {
                margin: 0;
                pointer-events: none;
                width: 12px;
                height: 12px;
            }

            /* Creature controls for create form */
            .creature-controls {
                display: flex;
                gap: 8px;
                margin-bottom: 10px;
            }

            .creature-controls button {
                padding: 6px 12px;
                background: #333;
                border: 1px solid #444;
                border-radius: 4px;
                color: #fff;
                cursor: pointer;
                font-size: 12px;
                font-family: inherit;
            }

            .creature-controls button:hover {
                border-color: #4CAF50;
            }

            .creature-controls input {
                flex: 1;
                padding: 6px 10px;
                background: #222;
                border: 1px solid #444;
                border-radius: 4px;
                color: #fff;
                font-family: inherit;
                font-size: 12px;
            }

            .section-desc {
                font-size: 12px;
                color: #888;
                margin: 0 0 10px;
            }

            /* Creature Grid for Settings Tab */
            #wb-creature-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                gap: 6px;
                max-height: 200px;
                overflow-y: auto;
                padding: 8px;
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 4px;
            }

            #wb-creature-grid .creature-item {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 5px 8px;
                background: #222;
                border-radius: 4px;
                font-size: 11px;
                cursor: pointer;
                border: 1px solid transparent;
                color: #ccc;
            }

            #wb-creature-grid .creature-item:hover {
                background: #2a2a2a;
            }

            #wb-creature-grid .creature-item.selected {
                border-color: #4CAF50;
                background: #1a2a1a;
            }

            #wb-creature-grid .creature-item input[type="checkbox"] {
                margin: 0;
                pointer-events: none;
                width: 12px;
                height: 12px;
            }

            /* Create form scroll styling */
            #world-tab-create {
                max-height: calc(80vh - 150px);
                overflow-y: auto;
            }

            #world-tab-create::-webkit-scrollbar {
                width: 8px;
            }

            #world-tab-create::-webkit-scrollbar-track {
                background: #1a1a1a;
            }

            #world-tab-create::-webkit-scrollbar-thumb {
                background: #444;
                border-radius: 4px;
            }

            #world-tab-create::-webkit-scrollbar-thumb:hover {
                background: #555;
            }
        `;
        document.head.appendChild(style);
    }
}
