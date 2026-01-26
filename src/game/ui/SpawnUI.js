
import { AnimalClasses } from '../AnimalRegistry.js';
import { ItemClasses } from '../ItemRegistry.js';
import { PreviewRenderer } from './PreviewRenderer.js';
import * as THREE from 'three';
import { auth } from '../../config/firebase-client.js';

export class SpawnUI {
    constructor(game) {
        this.game = game;
        this.isOpen = false;
        this.activeTab = 'creature'; // 'creature' or 'item'
        this.previewRenderer = null;

        // Mock game for preview entities to avoid crashing on dependencies
        this.mockGame = {
            isMock: true,
            assetManager: game.assetManager // Pass asset manager if available for textures
        };

        // Cache DOM elements
        this.panel = document.getElementById('spawn-panel');

        if (!this.panel) {
            console.error('SpawnUI: Missing DOM element #spawn-panel');
            return;
        }

        this.init();
    }

    init() {
        // Rebuild DOM structure for Tabs and Layouts
        this.panel.innerHTML = `
            <div class="chat-header">
                <div class="chat-title">SPAWN MENU</div>
                <button id="close-spawn">×</button>
            </div>
            <div class="spawn-body">
                <!-- Top Controls Stack -->
                <div class="spawn-sidebar">
                    <div class="spawn-tabs" style="display: flex; gap: 5px; padding: 10px 10px 0 10px;">
                        <button class="tab-btn active" data-tab="creature" style="flex: 1;">Creatures</button>
                        <button class="tab-btn" data-tab="item" style="flex: 1;">Items</button>
                    </div>
                    
                    <div class="spawn-search-container">
                        <input type="text" id="spawn-search" placeholder="Search..." autocomplete="off">
                    </div>

                    <!-- Small Preview Area (Optional, keeping small) -->
                    <div class="preview-container" style="height: 100px; margin: 0 10px; border: 1px solid #333; position: relative;">
                         <div id="spawn-preview-target" style="width:100%; height:100%;"></div>
                         <div class="preview-label" id="preview-label" style="position: absolute; bottom: 2px; left: 5px; font-size: 10px; color: #888;">Select item</div>
                    </div>
                </div>

                <!-- Grid fills remaining space -->
                <div class="spawn-content" style="flex: 1; overflow: hidden; display: flex; flex-direction: column;">
                    <div id="spawn-grid">
                        <!-- Dynamically generated buttons -->
                    </div>
                </div>
            </div>`;

        // Re-query elements from the new DOM
        this.openBtn = document.getElementById('spawn-btn');
        this.closeBtn = this.panel.querySelector('#close-spawn');
        this.grid = this.panel.querySelector('#spawn-grid');
        this.searchInput = this.panel.querySelector('#spawn-search');
        this.previewTarget = this.panel.querySelector('#spawn-preview-target');
        this.previewLabel = this.panel.querySelector('#preview-label');
        this.tabBtns = this.panel.querySelectorAll('.tab-btn');

        // Initialize Renderer
        if (this.previewTarget) {
            // Wait for panel layout? previewTarget has 100% width/height of container.
            // PreviewRenderer defaults to 200x200, we can pass width/height or it adjusts?
            // Passing 0,0 usually lets renderer size? No PreviewRenderer takes fixed w/h.
            // But we can resize. For now, 200x200 matches the CSS roughly.
            this.previewRenderer = new PreviewRenderer(this.previewTarget, 200, 200);
        }

        // Event Listeners
        if (this.openBtn) {
            this.openBtn.addEventListener('click', () => this.togglePanel());
        }
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closePanel());
        }

        // Tab switching
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });

        // Search listener
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => this.filterList(e.target.value));
            // Prevent game inputs when typing in search
            this.searchInput.addEventListener('keydown', (e) => e.stopPropagation());
        }

        // Initialize list
        this.populateList();

        // Listen for deletion events to refresh UI
        if (this.game.socket) {
            this.game.socket.on('creature_deleted', (data) => {
                console.log('[SpawnUI] Creature deleted event received:', data.name);
                if (AnimalClasses[data.name]) {
                    delete AnimalClasses[data.name];
                    console.log('[SpawnUI] Deleted from AnimalClasses:', data.name);
                } else {
                    console.warn('[SpawnUI] Creature not found in registry:', data.name);
                }
                this.populateList();
            });

            this.game.socket.on('item_deleted', (data) => {
                console.log('[SpawnUI] Item deleted event received:', data.name);
                if (ItemClasses[data.name]) {
                    delete ItemClasses[data.name];
                    console.log('[SpawnUI] Deleted from ItemClasses:', data.name);
                } else {
                    console.warn('[SpawnUI] Item not found in registry:', data.name);
                }
                this.populateList();
            });

            this.game.socket.on('admin:error', (data) => {
                console.error('Admin Action Failed:', data.message);
                alert('Action failed: ' + data.message);
            });
        }
    }

    switchTab(tab) {
        if (this.activeTab === tab) return;
        this.activeTab = tab;

        // Update UI
        this.tabBtns.forEach(btn => {
            if (btn.dataset.tab === tab) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        this.populateList();
        this.updatePreview(null);
    }

    togglePanel() {
        if (this.isOpen) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }

    openPanel() {
        this.isOpen = true;
        this.panel.classList.remove('hidden');

        // Close other menus if manager supports it
        if (this.game.uiManager && typeof this.game.uiManager.closeAllMenus === 'function') {
            this.game.uiManager.closeAllMenus(this);
        }

        // Unlock mouse so user can click
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }

        this.populateList();
        if (this.searchInput) this.searchInput.focus();

        // Start renderer loop if needed
        if (this.previewRenderer && !this.previewRenderer.frameId) {
            this.previewRenderer.animate();
        }
    }

    closePanel() {
        this.isOpen = false;
        this.panel.classList.add('hidden');
        if (this.searchInput) this.searchInput.value = '';
        this.filterList('');

        // Stop renderer loop to save perf when closed
        if (this.previewRenderer && this.previewRenderer.frameId) {
            cancelAnimationFrame(this.previewRenderer.frameId);
            this.previewRenderer.frameId = null;
        }
    }

    populateList() {
        if (!this.grid) return;
        this.grid.innerHTML = '';

        const items = [];
        const source = this.activeTab === 'creature' ? AnimalClasses : ItemClasses;

        Object.keys(source).forEach(key => {
            if (this.activeTab === 'creature') {
                // Filter out base classes or utilities
                if (key !== 'Animal' && !key.includes('Manager')) {
                    items.push({ name: key, label: key });
                }
            } else {
                // Item filters
                if (key !== 'Item' && key !== 'WandItem') {
                    let label = key.replace('Item', '');
                    label = label.replace(/([A-Z])/g, ' $1').trim();
                    items.push({ name: key, label: label });
                }
            }
        });

        items.sort((a, b) => a.label.localeCompare(b.label));

        items.forEach(item => {
            const btn = document.createElement('div');
            btn.className = 'spawn-item-btn';
            btn.textContent = item.label;
            btn.dataset.name = item.label.toLowerCase(); // For search

            btn.onclick = () => this.spawn(item.name);
            btn.onmouseenter = () => this.updatePreview(item.name);

            // Admin Delete Button
            if (this.isAdmin()) {
                const delBtn = document.createElement('button');
                delBtn.textContent = '❌';
                delBtn.className = 'spawn-delete-btn';
                delBtn.title = 'Delete (Admin)';
                delBtn.type = 'button'; // Prevent form submission behavior

                // Use addEventListener for more reliable event handling
                delBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    console.log('[SpawnUI] Delete button clicked for:', item.name, 'type:', this.activeTab);
                    this.deleteItem(item.name, this.activeTab);
                    return false;
                }, true); // Use capture phase

                // Also prevent mousedown from bubbling (in case parent uses mousedown)
                delBtn.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                }, true);

                btn.appendChild(delBtn);
            }


            this.grid.appendChild(btn);
        });
    }

    isAdmin() {
        const user = auth.currentUser;
        return user && user.email === 'thisislance98@gmail.com';
    }

    async deleteItem(name, type) {
        console.log('[SpawnUI] deleteItem called:', { name, type });

        if (!confirm(`Are you sure you want to PERMANENTLY delete ${name}? This cannot be undone.`)) {
            console.log('[SpawnUI] User cancelled deletion');
            return;
        }

        const user = auth.currentUser;
        console.log('[SpawnUI] Current user:', user ? user.email : 'null');

        if (!user) {
            console.error('[SpawnUI] No user logged in, cannot delete');
            alert('You must be logged in as admin to delete items');
            return;
        }

        try {
            console.log('[SpawnUI] Getting ID token...');
            const token = await user.getIdToken();
            console.log('[SpawnUI] Got token, length:', token.length);

            const event = type === 'creature' ? 'admin:delete_creature' : 'admin:delete_item';
            console.log('[SpawnUI] Will emit event:', event, 'with name:', name);

            if (this.game.socket) {
                console.log('[SpawnUI] Socket exists, emitting...');
                this.game.socket.emit(event, { name, token });
                console.log('[SpawnUI] Event emitted successfully');
            } else {
                console.error('[SpawnUI] No socket connection!');
                alert('No server connection');
            }
        } catch (e) {
            console.error('[SpawnUI] Failed to delete:', e);
            alert('Failed to authorize deletion: ' + e.message);
        }
    }

    filterList(query) {
        const term = query.toLowerCase();
        const buttons = this.grid.querySelectorAll('.spawn-item-btn');

        buttons.forEach(btn => {
            const name = btn.dataset.name;
            if (name.includes(term)) {
                btn.style.display = 'flex';
            } else {
                btn.style.display = 'none';
            }
        });
    }

    updatePreview(className) {
        if (!this.previewRenderer) return;

        if (!className) {
            this.previewRenderer.setObject(null);
            if (this.previewLabel) this.previewLabel.textContent = 'Select item';
            return;
        }

        if (this.previewLabel) this.previewLabel.textContent = className;

        try {
            let mesh = null;

            if (this.activeTab === 'creature') {
                const AnimalClass = AnimalClasses[className];
                if (AnimalClass) {
                    // Instantiate mock
                    const entity = new AnimalClass(this.mockGame, 0, 0, 0);
                    // Trigger creation
                    if (entity.createBody) {
                        entity.createBody();
                        // Ensure mesh is valid
                        if (entity.mesh) mesh = entity.mesh;
                    }
                }
            } else {
                const ItemClass = ItemClasses[className];
                if (ItemClass) {
                    const item = new ItemClass();
                    if (item.getMesh) {
                        mesh = item.getMesh();
                    }
                }
            }

            if (mesh) {
                this.previewRenderer.setObject(mesh);
            }
        } catch (e) {
            console.warn(`Failed to generate preview for ${className}`, e);
        }
    }

    spawn(className) {
        console.log(`[SpawnUI] Spawning ${this.activeTab}: ${className}`);

        if (this.activeTab === 'creature') {
            const AnimalClass = AnimalClasses[className];
            console.log(`[SpawnUI] AnimalClass found: ${!!AnimalClass}, spawnManager: ${!!this.game.spawnManager}`);

            if (AnimalClass && this.game.spawnManager) {
                // Use the legacy method which is more reliable
                console.log(`[SpawnUI] Calling spawnCreatureLegacy for ${className}`);
                this.spawnCreatureLegacy(className);

                if (this.game.uiManager) {
                    this.game.uiManager.addChatMessage('system', `Spawned ${className}`);
                }
            } else {
                console.error(`[SpawnUI] Cannot spawn: AnimalClass=${!!AnimalClass}, spawnManager=${!!this.game.spawnManager}`);
            }
        } else {
            // Give Item
            const ItemClass = ItemClasses[className];
            if (ItemClass && this.game.inventory) {
                try {
                    const instance = new ItemClass();
                    const itemId = instance.id;
                    if (itemId) {
                        // Default to tool? or check instance.isTool?
                        // Inventory.addItem(type, count, category)
                        // We might not know category easily without instance.
                        // Let's assume 'tool' if it says Item? Or check `instance.isTool`.
                        const category = instance.isTool ? 'tool' : 'block';
                        // Note: 'block' category implies it's in Blocks.js list usually. 
                        // If it's a wand, it's a tool.

                        this.game.inventory.addItem(itemId, 1, category);

                        if (this.game.uiManager) {
                            this.game.uiManager.addChatMessage('system', `Added ${className} to inventory`);
                        }
                    }
                } catch (e) {
                    console.error('Failed to give item:', e);
                }
            }
        }
    }

    spawnCreatureLegacy(className) {
        console.log(`[SpawnUI] spawnCreatureLegacy called for ${className}`);
        if (this.game.spawnManager) {
            const player = this.game.player;
            if (!player) {
                console.error('[SpawnUI] No player found!');
                return;
            }
            console.log(`[SpawnUI] Player position: ${player.position.x.toFixed(1)}, ${player.position.y.toFixed(1)}, ${player.position.z.toFixed(1)}`);

            const direction = new THREE.Vector3();
            this.game.camera.getWorldDirection(direction);
            console.log(`[SpawnUI] Camera direction: ${direction.x.toFixed(2)}, ${direction.y.toFixed(2)}, ${direction.z.toFixed(2)}`);

            const spawnPos = player.position.clone().add(direction.multiplyScalar(5));
            console.log(`[SpawnUI] Spawn position: ${spawnPos.x.toFixed(1)}, ${spawnPos.y.toFixed(1)}, ${spawnPos.z.toFixed(1)}`);

            const AnimalClass = AnimalClasses[className];
            if (AnimalClass) {
                console.log(`[SpawnUI] Creating ${className} at spawn position (y+2)`);
                const animal = this.game.spawnManager.createAnimal(AnimalClass, spawnPos.x, spawnPos.y + 2, spawnPos.z, false);
                console.log(`[SpawnUI] createAnimal returned:`, animal);
            } else {
                console.error(`[SpawnUI] AnimalClass not found for ${className}`);
            }
        } else {
            console.error('[SpawnUI] No spawnManager!');
        }
    }
}
