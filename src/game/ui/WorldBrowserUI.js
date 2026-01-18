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

        // Create the modal element
        this.createModal();

        // Listen for auth state changes
        auth.onAuthStateChanged((user) => {
            this.user = user;
        });

        // Setup button to open world browser
        this.setupWorldButton();
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
                            <button type="submit" class="create-world-submit">Create World</button>
                        </form>
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
                    seed
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create world');
            }

            console.log('[WorldBrowserUI] World created:', data.world);

            // Clear form
            document.getElementById('create-world-form').reset();

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
            submitBtn.textContent = 'Create World';
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
        `;
        document.head.appendChild(style);
    }
}
