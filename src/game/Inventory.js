/**
 * Inventory UI class - Handles rendering and input events for the inventory.
 * State is managed by InventoryManager.
 */
export class Inventory {
    constructor(game, manager) {
        this.game = game;
        this.manager = manager;

        // UI State
        this.isInventoryOpen = false;
        this.draggedItem = null; // Visual representation of item on cursor
        this.dragElement = document.getElementById('drag-icon');

        // Food nutrition UI values (Visual only)
        this.foodValues = {
            apple: 4,
            bread: 5,
            meat: 8
        };

        this.setupInventoryScreenListeners();
        this.renderHotbar();
    }

    get slots() {
        return this.manager.slots;
    }

    /* --- UI Event Handling --- */

    setupInventoryScreenListeners() {
        const inventoryScreen = document.getElementById('inventory-screen');
        inventoryScreen.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    }

    handleMouseDown(e) {
        if (!this.isInventoryOpen) return;

        const slotEl = e.target.closest('.slot');
        if (!slotEl) return;

        const index = parseInt(slotEl.dataset.index);
        const slot = this.slots[index];

        // LOGIC DELEGATION:
        // We manipulate the manager's slots directly here for specific drag interactions
        // OR we add specific methods to Manager.
        // For now, simpler to manipulate data via Manager's reference.

        if (e.button === 0) { // Left Click
            if (this.draggedItem) {
                // Placing Item
                if (slot.item === null) {
                    // Place into empty
                    this.manager.addItemToSlot(index, this.draggedItem.item, this.draggedItem.count, this.draggedItem.type);
                    this.draggedItem = null;
                } else if (slot.item === this.draggedItem.item) {
                    // Stack
                    const space = 64 - slot.count;
                    const toAdd = Math.min(space, this.draggedItem.count);
                    slot.count += toAdd; // Direct mutation ok for now (ref)
                    this.draggedItem.count -= toAdd;
                    if (this.draggedItem.count <= 0) this.draggedItem = null;
                } else {
                    // Swap
                    const temp = { ...slot };
                    this.manager.addItemToSlot(index, this.draggedItem.item, this.draggedItem.count, this.draggedItem.type);
                    this.draggedItem = temp;
                }
            } else if (slot.item !== null) {
                // Pick up Item
                this.draggedItem = { ...slot };
                this.manager.addItemToSlot(index, null, 0, null); // Clear slot
            }
        } else if (e.button === 2) { // Right Click
            if (this.draggedItem) {
                // Place One
                if (slot.item === null) {
                    this.manager.addItemToSlot(index, this.draggedItem.item, 1, this.draggedItem.type);
                    this.draggedItem.count--;
                    if (this.draggedItem.count <= 0) this.draggedItem = null;
                } else if (slot.item === this.draggedItem.item && slot.count < 64) {
                    slot.count++;
                    this.draggedItem.count--;
                    if (this.draggedItem.count <= 0) this.draggedItem = null;
                }
            } else if (slot.item !== null) {
                // Split Stack (Pick up half)
                const half = Math.ceil(slot.count / 2);
                this.draggedItem = { ...slot, count: half };
                slot.count -= half;
                if (slot.count <= 0) this.manager.addItemToSlot(index, null, 0, null);
            }
        }

        this.renderInventoryScreen();
        this.updateDragIcon(e);
        this.renderHotbar(); // Also update hotbar if needed
    }

    handleMouseMove(e) {
        if (this.draggedItem) {
            this.updateDragIcon(e);
        }
    }

    handleMouseUp(e) {
        // logic unchanged
    }

    updateDragIcon(e) {
        if (this.draggedItem) {
            this.dragElement.classList.remove('hidden');
            this.dragElement.style.left = e.clientX + 'px';
            this.dragElement.style.top = e.clientY + 'px';
            this.dragElement.innerHTML = `
                ${this.getItemIcon(this.draggedItem.item)}
                ${this.draggedItem.count > 1 ? `<span class="item-count">${this.draggedItem.count}</span>` : ''}
            `;
        } else {
            this.dragElement.classList.add('hidden');
        }
    }

    openInventory() {
        this.isInventoryOpen = true;
        this.isCraftingTableOpen = false;
        const screen = document.getElementById('inventory-screen');
        screen.classList.remove('hidden');
        document.exitPointerLock();
        this.renderInventoryScreen();
    }

    closeInventory() {
        this.isInventoryOpen = false;
        this.isCraftingTableOpen = false;
        const screen = document.getElementById('inventory-screen');
        screen.classList.add('hidden');
        this.game.controls.lock();

        // Return dragged item to inventory
        if (this.draggedItem) {
            this.manager.addItem(this.draggedItem.item, this.draggedItem.count, this.draggedItem.type);
            this.draggedItem = null;
            this.dragElement.classList.add('hidden');
        }

        this.renderHotbar();
    }

    openCraftingTable() {
        this.isInventoryOpen = true;
        this.isCraftingTableOpen = true;
        const screen = document.getElementById('inventory-screen');
        screen.classList.remove('hidden');
        document.exitPointerLock();
        this.renderInventoryScreen();
        // In the future, this might enable a 3x3 grid instead of 2x2
    }

    toggleInventory() {
        if (this.isInventoryOpen) {
            this.closeInventory();
        } else {
            this.openInventory();
        }
    }

    selectSlot(index) {
        if (this.manager.selectSlot(index)) {
            // UI Visual updates
            const slot = this.manager.getSelectedItem();

            // Sync Game State
            if (slot && slot.item) {
                this.game.selectedBlock = slot.item;
            } else {
                this.game.selectedBlock = null;
            }

            this.renderHotbar();

            this.game.player.updateHeldItemVisibility();

            const indicator = document.getElementById('selected-block');
            if (indicator) {
                indicator.textContent = slot && slot.item ? (slot.item.charAt(0).toUpperCase() + slot.item.slice(1)) : '';
            }
        }
    }

    renderHotbar() {
        const hudHotbar = document.getElementById('hotbar');
        if (!hudHotbar) return;
        hudHotbar.innerHTML = '';

        for (let i = 0; i < 9; i++) {
            const slot = this.slots[i];
            const isSelected = i === this.manager.selectedSlot;

            const div = document.createElement('div');
            div.className = `slot ${isSelected ? 'selected' : ''}`;
            div.dataset.index = i;
            div.onclick = () => !this.isInventoryOpen && this.selectSlot(i);

            if (slot.item) {
                const displayName = slot.item.charAt(0).toUpperCase() + slot.item.slice(1);
                div.setAttribute('data-item-name', displayName);

                div.innerHTML = `
                    ${this.getItemIcon(slot.item)}
                    ${slot.count > 1 ? `<span class="slot-count">${slot.count}</span>` : ''}
                `;
            }

            hudHotbar.appendChild(div);
        }
    }

    renderInventoryScreen() {
        // Main Inventory (27 slots: 9-35)
        const mainGrid = document.getElementById('main-inventory-grid');
        mainGrid.innerHTML = '';
        for (let i = 9; i < 36; i++) {
            mainGrid.appendChild(this.createSlotElement(i));
        }

        // Hotbar (9 slots: 0-8)
        const hotbarGrid = document.getElementById('hotbar-inventory-grid');
        hotbarGrid.innerHTML = '';
        for (let i = 0; i < 9; i++) {
            hotbarGrid.appendChild(this.createSlotElement(i));
        }
    }

    createSlotElement(index) {
        const slot = this.slots[index];
        const div = document.createElement('div');
        div.className = 'slot';
        div.dataset.index = index;

        if (slot.item) {
            const displayName = slot.item.charAt(0).toUpperCase() + slot.item.slice(1);
            div.setAttribute('data-item-name', displayName);

            div.innerHTML = `
                ${this.getItemIcon(slot.item)}
                ${slot.count > 1 ? `<span class="slot-count">${slot.count}</span>` : ''}
            `;
        }
        return div;
    }

    getItemIcon(item) {
        // High-resolution (64x64) stylized SVGs for inventory items
        const svgs = {
            grass: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                            <linearGradient id="grad-grass" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style="stop-color:#79B044" />
                                <stop offset="100%" style="stop-color:#5E9733" />
                            </linearGradient>
                            <linearGradient id="grad-dirt" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style="stop-color:#866043" />
                                <stop offset="100%" style="stop-color:#6D4D36" />
                            </linearGradient>
                        </defs>
                        <rect x="0" y="32" width="64" height="32" fill="url(#grad-dirt)"/>
                        <rect x="0" y="0" width="64" height="32" fill="url(#grad-grass)"/>
                        <rect x="4" y="4" width="8" height="8" fill="#a2d174" opacity="0.3"/>
                        <rect x="48" y="12" width="12" height="12" fill="#4a7a28" opacity="0.3"/>
                        <rect x="12" y="44" width="8" height="8" fill="#5c402d" opacity="0.4"/>
                        <path d="M0 32 L64 32" stroke="#4a7a28" stroke-width="2"/>
                    </svg>`,
            dirt: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                            <linearGradient id="grad-dirt-full" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#866043" />
                                <stop offset="100%" style="stop-color:#5c402d" />
                            </linearGradient>
                        </defs>
                        <rect x="0" y="0" width="64" height="64" rx="4" fill="url(#grad-dirt-full)"/>
                        <rect x="8" y="8" width="16" height="12" fill="#a07a5c" opacity="0.2"/>
                        <rect x="40" y="36" width="12" height="16" fill="#3e2b1e" opacity="0.3"/>
                        <path d="M4 4 L60 4 L60 60 L4 60 Z" fill="none" stroke="#3e2b1e" stroke-width="2" opacity="0.3"/>
                    </svg>`,
            stone: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                            <linearGradient id="grad-stone" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#a0a0a0" />
                                <stop offset="100%" style="stop-color:#666666" />
                            </linearGradient>
                        </defs>
                        <rect x="0" y="0" width="64" height="64" rx="8" fill="url(#grad-stone)"/>
                        <path d="M10 10 L54 10 L54 54 L10 54 Z" fill="none" stroke="white" stroke-width="2" opacity="0.1"/>
                        <rect x="12" y="12" width="20" height="20" fill="white" opacity="0.05"/>
                        <rect x="36" y="36" width="16" height="16" fill="black" opacity="0.1"/>
                    </svg>`,
            wood: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                            <linearGradient id="grad-wood-new" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style="stop-color:#a67c52" />
                                <stop offset="100%" style="stop-color:#6d4d36" />
                            </linearGradient>
                        </defs>
                        <rect x="4" y="4" width="56" height="56" rx="2" fill="url(#grad-wood-new)" stroke="#5c402d" stroke-width="2"/>
                        <line x1="18" y1="4" x2="18" y2="60" stroke="#5c402d" stroke-width="2" opacity="0.4"/>
                        <line x1="32" y1="4" x2="32" y2="60" stroke="#5c402d" stroke-width="2" opacity="0.4"/>
                        <line x1="46" y1="4" x2="46" y2="60" stroke="#5c402d" stroke-width="2" opacity="0.4"/>
                        <path d="M4 20 L 18 20 M18 35 L 32 35 M32 25 L 46 25 M46 45 L 60 45" stroke="#5c402d" stroke-width="2" opacity="0.3"/>
                        <circle cx="10" cy="10" r="1.5" fill="#3e2b1e" opacity="0.2"/>
                        <circle cx="54" cy="54" r="1.5" fill="#3e2b1e" opacity="0.2"/>
                    </svg>`,
            log: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <circle cx="32" cy="32" r="30" fill="#5c402d" stroke="#3e2b1e" stroke-width="2"/>
                        <circle cx="32" cy="32" r="24" fill="#d2b48c"/>
                        <circle cx="32" cy="32" r="18" fill="none" stroke="#c19a6b" stroke-width="3"/>
                        <circle cx="32" cy="32" r="10" fill="none" stroke="#c19a6b" stroke-width="2"/>
                        <path d="M32 8 L32 24 M8 32 L24 32 M32 40 L32 56 M40 32 L56 32" stroke="#ba8d5e" stroke-width="1" opacity="0.5"/>
                    </svg>`,
            leaves: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="4" y="4" width="56" height="56" rx="12" fill="#3A5F0B"/>
                        <circle cx="20" cy="20" r="12" fill="#4B7A0E"/>
                        <circle cx="44" cy="24" r="14" fill="#4B7A0E" opacity="0.8"/>
                        <circle cx="30" cy="44" r="16" fill="#2D4A08"/>
                        <rect x="12" y="12" width="6" height="6" fill="white" opacity="0.1"/>
                        <rect x="40" y="40" width="8" height="8" fill="white" opacity="0.05"/>
                    </svg>`,
            sand: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="2" y="2" width="60" height="60" rx="4" fill="#E6D084"/>
                        <circle cx="15" cy="15" r="2" fill="#d1bc70"/>
                        <circle cx="45" cy="20" r="3" fill="#d1bc70"/>
                        <circle cx="30" cy="40" r="2" fill="#d1bc70"/>
                        <circle cx="50" cy="50" r="4" fill="#d1bc70"/>
                        <path d="M10 50 Q 32 60 54 50" fill="none" stroke="#dcc478" stroke-width="3"/>
                    </svg>`,
            water: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="2" y="2" width="60" height="60" rx="4" fill="#3F76E4"/>
                        <path d="M0 20 Q 16 10 32 20 T 64 20" fill="none" stroke="#5A8CF0" stroke-width="4"/>
                        <path d="M0 44 Q 16 34 32 44 T 64 44" fill="none" stroke="#5A8CF0" stroke-width="4"/>
                        <circle cx="15" cy="15" r="4" fill="white" opacity="0.2"/>
                        <circle cx="50" cy="35" r="3" fill="white" opacity="0.1"/>
                    </svg>`,
            brick: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="2" y="2" width="60" height="60" fill="#94523A"/>
                        <path d="M0 20 L64 20 M0 42 L64 42" stroke="#d9a08c" stroke-width="4"/>
                        <path d="M32 0 L32 20 M16 20 L16 42 M48 20 L48 42 M32 42 L32 64" stroke="#d9a08c" stroke-width="4"/>
                        <rect x="4" y="4" width="24" height="12" fill="white" opacity="0.1"/>
                    </svg>`,
            glass: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="4" y="4" width="56" height="56" rx="8" fill="#A9D3FF" fill-opacity="0.3" stroke="white" stroke-width="2"/>
                        <path d="M15 45 L45 15 M30 45 L45 30" stroke="white" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
                        <path d="M10 20 L20 10" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
                    </svg>`,
            apple: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                            <radialGradient id="grad-apple-new" cx="35%" cy="35%" r="65%">
                                <stop offset="0%" style="stop-color:#ff5e5e" />
                                <stop offset="70%" style="stop-color:#d40000" />
                                <stop offset="100%" style="stop-color:#8b0000" />
                            </radialGradient>
                            <filter id="shadow-apple" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
                                <feOffset dx="1" dy="1" result="offsetblur" />
                                <feComponentTransfer>
                                    <feFuncA type="linear" slope="0.3" />
                                </feComponentTransfer>
                                <feMerge>
                                    <feMergeNode />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        <path d="M32 12 C 20 12 10 20 10 35 C 10 50 20 58 32 58 C 44 58 54 50 54 35 C 54 20 44 12 32 12" fill="url(#grad-apple-new)" filter="url(#shadow-apple)"/>
                        <path d="M32 14 L32 6 Q 32 4 38 4" fill="none" stroke="#5C4033" stroke-width="4" stroke-linecap="round"/>
                        <path d="M32 10 Q 42 2 50 10 Q 42 14 36 10" fill="#4B7A0E" stroke="#2D4A08" stroke-width="1.5"/>
                        <ellipse cx="24" cy="26" rx="6" ry="8" fill="white" opacity="0.4" transform="rotate(-25 24 26)"/>
                    </svg>`,
            bread: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                            <linearGradient id="grad-bread-new" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style="stop-color:#eab676" />
                                <stop offset="50%" style="stop-color:#d2a679" />
                                <stop offset="100%" style="stop-color:#8b5a2b" />
                            </linearGradient>
                        </defs>
                        <path d="M8 42 C 8 22 18 14 32 14 C 46 14 56 22 56 42 L 56 50 C 56 56 48 60 32 60 C 16 60 8 56 8 50 Z" fill="url(#grad-bread-new)" stroke="#5c402d" stroke-width="2.5"/>
                        <path d="M20 24 Q 26 18 32 24" fill="none" stroke="#5c402d" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
                        <path d="M34 24 Q 40 18 46 24" fill="none" stroke="#5c402d" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
                        <path d="M27 34 Q 32 28 37 34" fill="none" stroke="#5c402d" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
                        <rect x="12" y="46" width="40" height="8" rx="4" fill="black" opacity="0.1"/>
                    </svg>`,
            meat: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <path d="M10 40 Q 10 15 35 15 Q 55 15 55 40 Q 55 55 35 55 Q 10 55 10 40" fill="#A52A2A"/>
                        <path d="M10 30 Q 5 30 5 40 Q 5 50 10 50" fill="white"/>
                        <rect x="20" y="25" width="25" height="4" rx="2" fill="#CF3C3C" opacity="0.6" transform="rotate(-20 32 32)"/>
                        <rect x="20" y="35" width="20" height="4" rx="2" fill="#CF3C3C" opacity="0.6" transform="rotate(-20 32 32)"/>
                    </svg>`,
            bow: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <path d="M45 10 Q 60 32 45 54" fill="none" stroke="#8B4513" stroke-width="6" stroke-linecap="round"/>
                        <line x1="45" y1="10" x2="45" y2="54" stroke="#e0e0e0" stroke-width="2"/>
                        <rect x="48" y="28" width="8" height="8" rx="2" fill="#a07040"/>
                        <path d="M44 12 L48 8 M44 52 L48 56" stroke="#5c402d" stroke-width="3"/>
                    </svg>`,
            shovel: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="28" y="20" width="8" height="40" rx="2" fill="#5C4033" stroke="#3e2b1e" stroke-width="2"/>
                        <path d="M22 4 L42 4 L44 24 L32 30 L20 24 Z" fill="#A0A0A0" stroke="#777" stroke-width="2"/>
                        <path d="M25 8 L39 8" stroke="white" stroke-width="2" opacity="0.3"/>
                    </svg>`,
            pickaxe: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                            <linearGradient id="grad-steel" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style="stop-color:#88ffff" />
                                <stop offset="100%" style="stop-color:#00ced1" />
                            </linearGradient>
                        </defs>
                        <path d="M8 8 Q 32 2 56 8 L 56 16 Q 32 10 8 16 Z" fill="url(#grad-steel)" stroke="#008b8b" stroke-width="2"/>
                        <rect x="28" y="14" width="8" height="46" rx="2" fill="#5C4033" stroke="#3e2b1e" stroke-width="2"/>
                        <path d="M28 14 L36 14 L36 22 L28 22 Z" fill="#00ced1"/>
                        <path d="M8 12 L12 12 M52 12 L56 12" stroke="white" stroke-width="2" opacity="0.5"/>
                    </svg>`,
            sword: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                            <linearGradient id="grad-sword-new" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" style="stop-color:#f0f0f0" />
                                <stop offset="50%" style="stop-color:#ffffff" />
                                <stop offset="100%" style="stop-color:#d0d0d0" />
                            </linearGradient>
                        </defs>
                        <path d="M30 4 L34 4 L36 34 L32 40 L28 34 Z" fill="url(#grad-sword-new)" stroke="#777" stroke-width="2"/>
                        <path d="M32 6 L32 36" stroke="#ccc" stroke-width="1.5" opacity="0.7"/>
                        <rect x="22" y="38" width="20" height="4" rx="2" fill="#8B4513" stroke="#5c402d" stroke-width="2"/>
                        <rect x="29" y="42" width="6" height="14" rx="1" fill="#5C4033" stroke="#3e2b1e" stroke-width="2"/>
                        <circle cx="32" cy="58" r="4.5" fill="#8B4513" stroke="#5c402d" stroke-width="2"/>
                        <circle cx="32" cy="58" r="1.5" fill="#CD7F32"/>
                    </svg>`,
            arrow: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <line x1="10" y1="54" x2="54" y2="10" stroke="#5C4033" stroke-width="4" stroke-linecap="round"/>
                        <path d="M54 10 L 40 10 L 54 24 Z" fill="#7B7B7B" stroke="#555" stroke-width="2"/>
                        <path d="M10 54 L 20 60 L 5 60 L 4 45 L 10 54" fill="#D3D3D3" stroke="#b0b0b0" stroke-width="2"/>
                    </svg>`,
            stick: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="28" y="4" width="8" height="56" rx="2" transform="rotate(45 32 32)" fill="#5C4033" stroke="#3e2b1e" stroke-width="2"/>
                        <path d="M15 15 L25 25" stroke="white" stroke-width="2" opacity="0.2" transform="rotate(45 32 32)"/>
                    </svg>`,
            birch_wood: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="4" y="4" width="56" height="56" rx="2" fill="#D1D1D1" stroke="#a0a0a0" stroke-width="2"/>
                        <path d="M8 15 L20 15 M32 35 L50 35 M15 50 L30 50" stroke="#4B3D2B" stroke-width="4" stroke-linecap="round"/>
                        <rect x="30" y="10" width="4" height="4" fill="#4B3D2B" opacity="0.6"/>
                    </svg>`,
            birch_leaves: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="4" y="4" width="56" height="56" rx="12" fill="#6A9023"/>
                        <circle cx="20" cy="20" r="10" fill="#8BB33B"/>
                        <circle cx="44" cy="44" r="12" fill="#4D6B18"/>
                        <circle cx="40" cy="15" r="5" fill="#8BB33B" opacity="0.5"/>
                    </svg>`,
            pine_wood: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="4" y="4" width="56" height="56" rx="2" fill="#3D2B1F" stroke="#251a12" stroke-width="2"/>
                        <path d="M10 4 L10 60 M25 4 L25 60 M40 4 L40 60 M55 4 L55 60" stroke="#4B3526" stroke-width="4"/>
                    </svg>`,
            pine_leaves: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <path d="M32 4 L56 56 L8 56 Z" fill="#1B331B" stroke="#0f1f0f" stroke-width="2"/>
                        <path d="M32 12 L48 48 L16 48 Z" fill="#2D4D2D" opacity="0.6"/>
                        <circle cx="32" cy="30" r="4" fill="white" opacity="0.1"/>
                    </svg>`,
            flower_red: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="30" y="32" width="4" height="32" fill="#5E9733"/>
                        <circle cx="32" cy="24" r="18" fill="#FF0000"/>
                        <circle cx="45" cy="15" r="8" fill="#FF4D4D" opacity="0.8"/>
                        <circle cx="32" cy="24" r="6" fill="#FFFF00"/>
                    </svg>`,
            flower_yellow: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="30" y="32" width="4" height="32" fill="#5E9733"/>
                        <circle cx="32" cy="24" r="18" fill="#FFFF00"/>
                        <circle cx="20" cy="15" r="8" fill="#FFFFAA" opacity="0.8"/>
                        <circle cx="32" cy="24" r="6" fill="#8B4513"/>
                    </svg>`,
            flower_blue: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="30" y="32" width="4" height="32" fill="#5E9733"/>
                        <circle cx="32" cy="24" r="18" fill="#4169E1"/>
                        <circle cx="40" cy="30" r="8" fill="#6B8E23" opacity="0.3"/>
                        <circle cx="32" cy="24" r="6" fill="#FFFFFF"/>
                    </svg>`,
            mushroom_red: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="24" y="40" width="16" height="24" rx="4" fill="#D3D3D3"/>
                        <path d="M4 42 Q 32 4 60 42 Z" fill="#FF0000" stroke="#bf0000" stroke-width="2"/>
                        <circle cx="20" cy="25" r="4" fill="white"/>
                        <circle cx="44" cy="25" r="5" fill="white"/>
                        <circle cx="32" cy="35" r="3" fill="white"/>
                    </svg>`,
            mushroom_brown: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="24" y="40" width="16" height="24" rx="4" fill="#D1BC70"/>
                        <path d="M8 42 Q 32 15 56 42 Z" fill="#8B4513" stroke="#5c402d" stroke-width="2"/>
                        <circle cx="32" cy="25" r="4" fill="#a07040" opacity="0.3"/>
                    </svg>`,
            fern: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <path d="M32 60 Q 32 32 32 4" fill="none" stroke="#2D4A08" stroke-width="4" stroke-linecap="round"/>
                        <path d="M32 50 Q 15 45 5 35 M32 50 Q 49 45 59 35" fill="none" stroke="#3A5F0B" stroke-width="3" stroke-linecap="round"/>
                        <path d="M32 35 Q 18 30 10 20 M32 35 Q 46 30 54 20" fill="none" stroke="#4B7A0E" stroke-width="3" stroke-linecap="round"/>
                    </svg>`,
            dead_bush: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <path d="M32 60 L 45 40 M32 60 L 20 45 M25 45 L 10 35 M40 45 L 55 35" fill="none" stroke="#7B5B3C" stroke-width="4" stroke-linecap="round"/>
                        <path d="M32 60 L 32 20 M32 30 L 50 15 M32 35 L 15 15" fill="none" stroke="#5c402d" stroke-width="3" stroke-linecap="round"/>
                    </svg>`,
            bedrock: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="0" y="0" width="64" height="64" fill="#333333"/>
                        <rect x="10" y="10" width="20" height="20" fill="#1A1A1A" opacity="0.8"/>
                        <rect x="40" y="8" width="12" height="12" fill="#4B4B4B" opacity="0.6"/>
                        <rect x="15" y="45" width="30" height="10" fill="#000" opacity="0.4"/>
                        <path d="M4 4 L60 4 L60 60 L4 60 Z" fill="none" stroke="black" stroke-width="4" opacity="0.5"/>
                    </svg>`,
            snow: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="2" y="2" width="60" height="60" rx="8" fill="#FFFFFF" stroke="#e6e6e6" stroke-width="2"/>
                        <circle cx="20" cy="20" r="4" fill="#f0f0f0"/>
                        <circle cx="45" cy="45" r="6" fill="#f0f0f0"/>
                        <path d="M10 10 L54 54" stroke="#f8f8f8" stroke-width="8" opacity="0.5"/>
                    </svg>`,
            crafting_table: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                            <linearGradient id="grad-crafting-top" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#e1c16e" />
                                <stop offset="100%" style="stop-color:#c4a24d" />
                            </linearGradient>
                        </defs>
                        <rect x="2" y="2" width="60" height="60" fill="#7a553a" stroke="#4a3526" stroke-width="2"/>
                        <rect x="6" y="6" width="52" height="12" fill="url(#grad-crafting-top)" opacity="0.8"/>
                        <path d="M15 15 L25 25 M40 15 L50 25" stroke="#4a3526" stroke-width="3" stroke-linecap="round"/>
                        <rect x="10" y="35" width="15" height="15" fill="#5c402d" opacity="0.5"/>
                        <rect x="39" y="35" width="15" height="15" fill="#5c402d" opacity="0.5"/>
                        <path d="M0 20 L64 20 M0 32 L64 32" stroke="#4a3526" stroke-width="2"/>
                    </svg>`
        };
        return svgs[item] || `<svg viewBox="0 0 64 64" width="100%" height="100%"><rect x="4" y="4" width="56" height="56" rx="8" fill="#7B5B3C" stroke="#3e2b1e" stroke-width="2"/><rect x="16" y="16" width="32" height="32" rx="4" fill="#A0A0A0" stroke="white" stroke-width="2" opacity="0.5"/></svg>`;
    }

    // Logic Delegated to Manager now (kept for compatibility if Player calls them directly on UI?)
    // Player calls game.inventory.useSelectedItem() ?
    // Let's proxy them just in case.

    getSelectedItem() {
        return this.manager.getSelectedItem();
    }

    useSelectedItem() {
        // Food logic needs UI update, so maybe keep high level logic here or call manager?
        // Manager has useSelected() but doesn't handle eating specific logic (Health).
        // Actually InventoryManager.useSelected() just decrements count.
        // Food logic is in Player.js typically? No, Player.eat calls logic.
        // Let's reproduce the previous logic: check if food, if so eat.

        const slot = this.manager.getSelectedItem();
        if (!slot || !slot.item) return false;

        if (slot.type === 'food') {
            // Eating logic was: check hunger, call player.eat, decr count.
            const nutrition = this.foodValues[slot.item] || 4;
            if (this.game.player.hunger < 20) {
                this.game.player.eat(nutrition);
                this.manager.useSelected(); // Decrement
                this.renderHotbar();
                return true;
            }
        }
        return false;
    }

    removeItem(index, count) {
        this.manager.removeItem(index, count);
        this.renderHotbar();
    }

    addItem(item, count, type) {
        const res = this.manager.addItem(item, count, type);
        this.renderHotbar();
        return res;
    }
}
