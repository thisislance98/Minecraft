/**
 * Inventory UI class - Handles rendering and input events for the inventory.
 * State is managed by InventoryManager.
 */
import { RecipeBook } from './RecipeBook.js';

export class Inventory {
    constructor(game, manager) {
        this.game = game;
        this.manager = manager;

        // UI State
        this.isInventoryOpen = false;
        this.draggedItem = null; // Visual representation of item on cursor
        this.dragStartSlot = null;
        this.isDragging = false;
        this.dragElement = document.getElementById('drag-icon');

        // Food nutrition UI values (Visual only)
        this.foodValues = {
            apple: 4,
            bread: 5,
            meat: 8,
            chocolate_bar: 6
        };

        this.setupInventoryScreenListeners();

        // Initialize Recipe Book
        this.recipeBook = new RecipeBook(game, manager, this);

        this.renderHotbar();
    }

    get slots() {
        return this.manager.slots;
    }

    get craftingSlots() {
        return this.manager.craftingSlots;
    }

    get craftingResult() {
        return this.manager.craftingResult;
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

        // Close if clicked on background overlay
        if (e.target.id === 'inventory-screen') {
            this.closeInventory();
            return;
        }

        const slotEl = e.target.closest('.slot');
        if (!slotEl) return;

        const index = parseInt(slotEl.dataset.index);
        // Supports normal slots (0-35) and crafting (100+)
        const slot = this.manager.getSlot(index);

        if (!slot && index !== 109) return;
        if (!slot && index !== 109) return; // Paranoia check

        // Special case: Clicked Result Slot (109)
        if (index === 109) {
            this.handleResultClick(e);
            this.renderInventoryScreen();
            this.updateDragIcon(e);
            return;
        }

        if (e.button === 0) { // Left Click
            if (this.draggedItem) {
                // Placing Item
                this.placeItemIntoSlot(index, e.shiftKey);
                this.isDragging = false; // We treated this as a click action
            } else if (slot.item !== null) {
                // Picking up Item
                if (e.shiftKey) {
                    // Split Stack (Pick up half)
                    const half = Math.ceil(slot.count / 2);
                    this.draggedItem = { ...slot, count: half };
                    slot.count -= half;
                    if (slot.count <= 0) this.manager.addItemToSlot(index, null, 0, null);
                } else {
                    // Pick up All
                    this.draggedItem = { ...slot };
                    this.manager.addItemToSlot(index, null, 0, null); // Clear slot
                }

                // Start Drag
                this.dragStartSlot = index;
                this.isDragging = true;
            }
        }

        this.renderInventoryScreen();
        this.updateDragIcon(e);
        this.renderHotbar(); // Also update hotbar if needed
    }

    handleResultClick(e) {
        if (!this.manager.craftingResult || !this.manager.craftingResult.item) return;

        // Perform Craft
        if (e.button === 0) { // Left Click
            if (!this.draggedItem) {
                // Pick up crafted item
                const result = this.manager.craft();
                if (result) {
                    this.draggedItem = result;
                    // Start Drag from Result Slot
                    this.dragStartSlot = 109;
                    this.isDragging = true;
                }
            } else {
                // If we already holding item, can we stack?
                if (this.draggedItem.item === this.manager.craftingResult.item) {
                    // Try to craft and stack
                    // Check stack limit (64)
                    if (this.draggedItem.count + this.manager.craftingResult.count <= 64) {
                        const result = this.manager.craft();
                        if (result) {
                            this.draggedItem.count += result.count;
                            // We don't really drag here as we are filling up existing stack.
                            // But usually you click repeatedly. Dragging doesn't apply to "filling stack".
                            this.isDragging = false;
                        }
                    }
                }
            }
        }
    }


    handleMouseMove(e) {
        if (this.draggedItem) {
            this.updateDragIcon(e);
        }
    }

    handleMouseUp(e) {
        if (!this.isInventoryOpen) return;

        // If we are dragging an item and release over a different slot
        if (this.isDragging && this.draggedItem) {
            const slotEl = e.target.closest('.slot');
            if (slotEl) {
                const index = parseInt(slotEl.dataset.index);
                // Drop if valid slot and not the start slot (unless start slot was Result, then drop is allowed on others)
                // Also prevent dropping ONTO Result slot (109)
                if (index !== this.dragStartSlot && index !== 109) {
                    this.placeItemIntoSlot(index, e.shiftKey);
                    this.renderInventoryScreen();
                    this.renderHotbar();
                    this.updateDragIcon(e);
                }
            }
        }

        // Reset Drag State
        this.isDragging = false;
        this.dragStartSlot = null;
    }

    placeItemIntoSlot(index, isShift) {
        const slot = this.manager.getSlot(index);
        if (!slot || !this.draggedItem) return;

        if (isShift) {
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
            // If dragging, we might want to continue holding if items remain?
            // "placeItemIntoSlot" modifies draggedItem.
            // If we drag (place one) over multiple slots, we need draggedItem to persist.
            // My implementation checks draggedItem count.
        } else {
            // Place All (Normal)
            if (slot.item === null) {
                // Place into empty
                this.manager.addItemToSlot(index, this.draggedItem.item, this.draggedItem.count, this.draggedItem.type);
                this.draggedItem = null;
            } else if (slot.item === this.draggedItem.item) {
                // Stack
                const space = 64 - slot.count;
                const toAdd = Math.min(space, this.draggedItem.count);
                slot.count += toAdd; // Direct mutation ok
                this.draggedItem.count -= toAdd;
                if (this.draggedItem.count <= 0) this.draggedItem = null;
            } else {
                // Swap
                const temp = { ...slot };
                this.manager.addItemToSlot(index, this.draggedItem.item, this.draggedItem.count, this.draggedItem.type);

                // Attempt to return swapped item to source slot
                // Only if source was not the crafting result slot (109) and we are dragging (dragStartSlot is valid)
                if (this.dragStartSlot !== null && this.dragStartSlot !== 109) {
                    const startSlot = this.manager.getSlot(this.dragStartSlot);
                    // If start slot is empty, we can perform a clean swap
                    if (!startSlot || !startSlot.item) {
                        this.manager.addItemToSlot(this.dragStartSlot, temp.item, temp.count, temp.type);
                        this.draggedItem = null; // Swap complete, clear cursor
                    } else {
                        // Start slot occupied, must hold item on cursor
                        this.draggedItem = temp;
                    }
                } else {
                    // Invalid source (e.g. from result slot), hold item on cursor
                    this.draggedItem = temp;
                }
            }
        }
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

        // Return items from crafting grid to inventory
        this.manager.returnCraftingItems();

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
            }

            div.innerHTML = `
                <span class="slot-key">${i + 1}</span>
                ${slot.item ? this.getItemIcon(slot.item) : ''}
                ${slot.item && slot.count > 1 ? `<span class="slot-count">${slot.count}</span>` : ''}
            `;

            hudHotbar.appendChild(div);
        }
    }

    renderInventoryScreen() {
        // Main Inventory (27 slots: 9-35)
        const mainGrid = document.getElementById('main-inventory-grid');
        mainGrid.innerHTML = '';
        for (let i = 9; i < 63; i++) {
            // DEBUG: Trace slot creation
            // console.log(`Creating slot ${i}`); 
            mainGrid.appendChild(this.createSlotElement(i));
        }
        console.log(`Rendered inventory slots 9-62. Child count: ${mainGrid.children.length}`);

        // Hotbar (9 slots: 0-8)
        const hotbarGrid = document.getElementById('hotbar-inventory-grid');
        hotbarGrid.innerHTML = '';
        for (let i = 0; i < 9; i++) {
            hotbarGrid.appendChild(this.createSlotElement(i));
        }

        // Crafting Area
        const craftingArea = document.getElementById('crafting-area');
        if (craftingArea) {
            if (this.isCraftingTableOpen) {
                craftingArea.classList.remove('hidden');

                // Crafting Grid (3x3) -> Indices 100-108
                const gridEl = craftingArea.querySelector('.crafting-grid');
                gridEl.innerHTML = '';
                for (let i = 100; i < 109; i++) {
                    gridEl.appendChild(this.createSlotElement(i));
                }

                // Result Slot -> Index 109
                const resultEl = craftingArea.querySelector('.crafting-result-container'); // Wrapper needed maybe?
                // Actually existing CSS has .crafting-result div
                // Let's replace the content of result slot
                if (!resultEl) {
                    // Create if not exists (HTML structure might be static)
                    // But we should inject the slot element into the correct place.
                    // The static HTML in game should have containers.
                }

                // Let's assume the HTML structure has a place for it.
                // We need to find or clear the result container
                // We will rely on DOM structure: .crafting-result is likely a container
                const resultContainer = craftingArea.querySelector('.crafting-result');
                if (resultContainer) {
                    resultContainer.innerHTML = '';
                    resultContainer.appendChild(this.createSlotElement(109));
                }

                // Add Recipe Book Icon if not present
                const resultParent = craftingArea.querySelector('.crafting-result-container');
                if (resultParent && !resultParent.parentNode.querySelector('#recipe-book-icon')) {
                    // Append before or after? After seems good.
                    resultParent.parentNode.appendChild(this.recipeBook.bookIcon);
                }


            } else {
                // 2x2 Crafting not implemented yet, just hide
                craftingArea.classList.add('hidden');
            }
        }
    }

    createSlotElement(index) {
        // Handle crafting indices
        let slot;
        if (index >= 100) {
            slot = this.manager.getSlot(index);
        } else {
            slot = this.slots[index];
        }

        const div = document.createElement('div');
        div.className = 'slot';
        div.dataset.index = index;

        if (index === 109) {
            div.classList.add('result-slot'); // Special styling maybe?
        }

        if (index < 9) {
            div.innerHTML += `<span class="slot-key">${index + 1}</span>`;
        }

        if (slot && slot.item) {
            let displayName = 'Unknown';
            if (typeof slot.item === 'string') {
                displayName = slot.item.charAt(0).toUpperCase() + slot.item.slice(1);
            }
            div.setAttribute('data-item-name', displayName);

            div.innerHTML += `
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
                    </svg>`,
            furnace: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="4" y="4" width="56" height="56" fill="#777" stroke="#333" stroke-width="2"/>
                        <rect x="20" y="40" width="24" height="14" fill="#222"/>
                        <path d="M20 40 Q 32 30 44 40 Z" fill="#FFA500" opacity="0.6"/>
                        <rect x="15" y="15" width="34" height="15" fill="#555" stroke="#333" stroke-width="2"/>
                        <path d="M12 4 L12 60 M52 4 L52 60" stroke="#444" stroke-width="2"/>
                    </svg>`,
            chest: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="4" y="16" width="56" height="40" fill="#a0522d" stroke="#5c402d" stroke-width="2"/>
                        <rect x="4" y="16" width="56" height="12" fill="#8b4513" stroke="#5c402d" stroke-width="2"/>
                        <rect x="26" y="24" width="12" height="8" fill="#c0c0c0" stroke="#888" stroke-width="1"/>
                    </svg>`,
            door: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="16" y="4" width="32" height="56" fill="#8b4513" stroke="#5c402d" stroke-width="2"/>
                        <rect x="22" y="10" width="10" height="18" fill="#5c402d" opacity="0.5"/>
                        <rect x="22" y="34" width="10" height="18" fill="#5c402d" opacity="0.5"/>
                        <circle cx="42" cy="32" r="3" fill="#ffd700"/>
                    </svg>`,
            ladder: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <line x1="20" y1="4" x2="20" y2="60" stroke="#8b4513" stroke-width="4"/>
                        <line x1="44" y1="4" x2="44" y2="60" stroke="#8b4513" stroke-width="4"/>
                        <line x1="20" y1="12" x2="44" y2="12" stroke="#8b4513" stroke-width="4"/>
                        <line x1="20" y1="24" x2="44" y2="24" stroke="#8b4513" stroke-width="4"/>
                        <line x1="20" y1="36" x2="44" y2="36" stroke="#8b4513" stroke-width="4"/>
                        <line x1="20" y1="48" x2="44" y2="48" stroke="#8b4513" stroke-width="4"/>
                    </svg>`,
            wand: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                             <filter id="glow-wand">
                                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>
                        <rect x="28" y="20" width="8" height="40" rx="2" fill="#5C4113" stroke="#3e2b1e" stroke-width="2"/>
                        <circle cx="32" cy="16" r="10" fill="#FF00FF" filter="url(#glow-wand)"/>
                        <circle cx="32" cy="16" r="6" fill="#FFFFFF" opacity="0.5"/>
                    </svg>`,
            levitation_wand: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                             <filter id="glow-levitation-wand">
                                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>
                        <rect x="28" y="20" width="8" height="40" rx="2" fill="#5C4113" stroke="#3e2b1e" stroke-width="2"/>
                        <circle cx="32" cy="16" r="10" fill="#FFFF00" filter="url(#glow-levitation-wand)"/>
                        <circle cx="32" cy="16" r="6" fill="#FFFFFF" opacity="0.5"/>
                    </svg>`,
            shrink_wand: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                             <filter id="glow-shrink-wand">
                                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>
                        <rect x="28" y="20" width="8" height="40" rx="2" fill="#5C4113" stroke="#3e2b1e" stroke-width="2"/>
                        <circle cx="32" cy="16" r="10" fill="#00FFFF" filter="url(#glow-shrink-wand)"/>
                        <circle cx="32" cy="16" r="6" fill="#FFFFFF" opacity="0.5"/>
                    </svg>`,
            chair: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="20" y="32" width="24" height="4" fill="#8B4513" stroke="#5c402d" stroke-width="2"/>
                        <rect x="20" y="36" width="4" height="20" fill="#8B4513" stroke="#5c402d" stroke-width="2"/>
                        <rect x="40" y="36" width="4" height="20" fill="#8B4513" stroke="#5c402d" stroke-width="2"/>
                        <rect x="20" y="12" width="24" height="20" fill="#8B4513" stroke="#5c402d" stroke-width="2"/>
                    </svg>`,
            xbox: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="16" y="8" width="32" height="48" rx="2" fill="#101010" stroke="#000" stroke-width="2"/>
                        <rect x="20" y="8" width="24" height="4" fill="#107C10" opacity="0.8"/>
                        <circle cx="22" cy="18" r="2" fill="white" opacity="0.9"/>
                        <rect x="18" y="24" width="2" height="12" rx="1" fill="#333"/>
                    </svg>`,
            parkour_block: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="4" y="4" width="56" height="56" rx="4" fill="#4B0082" stroke="#800080" stroke-width="3"/>
                        <path d="M10 10 L54 10 L54 54 L10 54 Z" fill="none" stroke="#00FFFF" stroke-width="2" opacity="0.8"/>
                        <path d="M20 32 L32 20 L44 32" fill="none" stroke="#FF00FF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M32 20 L32 44" fill="none" stroke="#FF00FF" stroke-width="4" stroke-linecap="round"/>
                        <circle cx="32" cy="32" r="20" fill="none" stroke="#00FFFF" stroke-width="2" stroke-dasharray="4 4"/>
                    </svg>`,
            disco_room_block: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="4" y="4" width="56" height="56" fill="#222"/>
                        <rect x="4" y="4" width="28" height="28" fill="#FF0000"/>
                        <rect x="32" y="4" width="28" height="28" fill="#00FF00"/>
                        <rect x="4" y="32" width="28" height="28" fill="#0000FF"/>
                        <rect x="32" y="32" width="28" height="28" fill="#FFFF00"/>
                        <rect x="4" y="4" width="56" height="56" fill="none" stroke="white" stroke-width="2"/>
                        <circle cx="32" cy="32" r="8" fill="white" opacity="0.8"/>
                    </svg>`,
            mob_waves_block: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="4" y="4" width="56" height="56" rx="4" fill="#1a1a1a" stroke="#333" stroke-width="2"/>
                        <path d="M10 32 Q 21 12 32 32 T 54 32" fill="none" stroke="#FF0000" stroke-width="4" stroke-linecap="round"/>
                        <circle cx="16" cy="16" r="4" fill="#800000"/>
                        <circle cx="48" cy="16" r="4" fill="#800000"/>
                        <circle cx="16" cy="48" r="4" fill="#800000"/>
                        <circle cx="48" cy="48" r="4" fill="#800000"/>
                        <path d="M25 45 Q 32 38 39 45" fill="none" stroke="#FF0000" stroke-width="2"/>
                    </svg>`,
            playground_block: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="4" y="4" width="56" height="56" rx="4" fill="white" stroke="#ccc" stroke-width="2"/>
                        <rect x="10" y="10" width="22" height="22" fill="#FFD700"/>
                        <rect x="32" y="10" width="22" height="22" fill="#4169E1"/>
                        <rect x="10" y="32" width="22" height="22" fill="#DC143C"/>
                        <rect x="32" y="32" width="22" height="22" fill="#FFD700"/>
                        <path d="M4 32 L60 32 M32 4 L32 60" stroke="#eee" stroke-width="2"/>
                    </svg>`,
            slide_block: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <path d="M10 10 L54 54 L44 54 L10 20 Z" fill="#FF4500" stroke="#CC3700" stroke-width="2"/>
                        <line x1="10" y1="10" x2="10" y2="54" stroke="#888" stroke-width="3"/>
                        <line x1="54" y1="30" x2="54" y2="54" stroke="#888" stroke-width="3"/>
                    </svg>`,
            table: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="12" y="20" width="40" height="4" fill="#5C4033" stroke="#3e2b1e" stroke-width="2"/>
                        <rect x="16" y="24" width="4" height="24" fill="#5C4033" stroke="#3e2b1e" stroke-width="2"/>
                        <rect x="44" y="24" width="4" height="24" fill="#5C4033" stroke="#3e2b1e" stroke-width="2"/>
                    </svg>`,
            couch: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="8" y="32" width="48" height="12" fill="#AA3333" stroke="#882222" stroke-width="2"/>
                        <rect x="8" y="20" width="48" height="12" fill="#AA3333" stroke="#882222" stroke-width="2"/>
                        <rect x="4" y="28" width="8" height="16" fill="#AA3333" stroke="#882222" stroke-width="2"/>
                        <rect x="52" y="28" width="8" height="16" fill="#AA3333" stroke="#882222" stroke-width="2"/>
                        <rect x="10" y="44" width="4" height="4" fill="#5C4033"/>
                        <rect x="50" y="44" width="4" height="4" fill="#5C4033"/>
                    </svg>`,
            omni_wand: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                             <filter id="glow-omni-wand">
                                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                            <linearGradient id="grad-omni" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#ff0000" />
                                <stop offset="20%" style="stop-color:#ff7f00" />
                                <stop offset="40%" style="stop-color:#ffff00" />
                                <stop offset="60%" style="stop-color:#00ff00" />
                                <stop offset="80%" style="stop-color:#0000ff" />
                                <stop offset="100%" style="stop-color:#4b0082" />
                            </linearGradient>
                        </defs>
                        <rect x="26" y="16" width="12" height="44" rx="2" fill="#333" stroke="#111" stroke-width="2"/>
                        <circle cx="32" cy="14" r="12" fill="url(#grad-omni)" filter="url(#glow-omni-wand)"/>
                        <circle cx="32" cy="14" r="8" fill="#FFFFFF" opacity="0.6"/>
                    </svg>`,
            ride_wand: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                             <filter id="glow-ride-wand">
                                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>
                        <rect x="28" y="20" width="8" height="40" rx="2" fill="#5C4113" stroke="#3e2b1e" stroke-width="2"/>
                        <circle cx="32" cy="16" r="10" fill="#8B4513" filter="url(#glow-ride-wand)"/>
                        <circle cx="32" cy="16" r="6" fill="#A0522D" opacity="0.5"/>
                    </svg>`,
            flying_broom: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="28" y="4" width="8" height="30" rx="2" fill="#5C4033" stroke="#3e2b1e" stroke-width="2"/>
                        <path d="M22 34 L42 34 L 50 60 L 14 60 Z" fill="#C19A6B" stroke="#967b56" stroke-width="2"/>
                        <path d="M32 34 L32 60 M26 34 L20 60 M38 34 L44 60" stroke="#967b56" stroke-width="2"/>
                        <rect x="26" y="32" width="12" height="4" fill="#8B4513" rx="1"/>
                    </svg>`,
            water_bucket: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                            <linearGradient id="grad-bucket" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" style="stop-color:#666666" />
                                <stop offset="50%" style="stop-color:#888888" />
                                <stop offset="100%" style="stop-color:#555555" />
                            </linearGradient>
                            <linearGradient id="grad-water-bucket" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style="stop-color:#5A8CF0" />
                                <stop offset="100%" style="stop-color:#2960CC" />
                            </linearGradient>
                        </defs>
                        <path d="M16 16 L12 56 L52 56 L48 16 Z" fill="url(#grad-bucket)" stroke="#444" stroke-width="2"/>
                        <path d="M14 24 L50 24 L52 56 L12 56 Z" fill="url(#grad-water-bucket)"/>
                        <path d="M14 24 Q 32 18 50 24" fill="none" stroke="#7FAEF5" stroke-width="3"/>
                        <path d="M20 8 Q 32 2 44 8" fill="none" stroke="#666" stroke-width="4" stroke-linecap="round"/>
                        <rect x="14" y="14" width="36" height="6" fill="#777" stroke="#444" stroke-width="1"/>
                    </svg>`,
            capture_wand: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                             <filter id="glow-capture-wand">
                                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>
                        <rect x="28" y="20" width="8" height="40" rx="2" fill="#5C4113" stroke="#3e2b1e" stroke-width="2"/>
                        <circle cx="32" cy="16" r="10" fill="#FF6600" filter="url(#glow-capture-wand)"/>
                        <circle cx="32" cy="16" r="6" fill="#FFFFFF" opacity="0.5"/>
                    </svg>`,
            giant_wand: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                             <filter id="glow-giant-wand">
                                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>
                        <rect x="26" y="20" width="12" height="40" rx="3" fill="#444" stroke="#222" stroke-width="2"/>
                        <circle cx="32" cy="16" r="12" fill="#888" filter="url(#glow-giant-wand)"/>
                        <path d="M26 16 L38 16" stroke="#444" stroke-width="4"/>
                        <circle cx="32" cy="16" r="6" fill="#DDD" opacity="0.8"/>
                    </svg>`,
            growth_wand: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                             <filter id="glow-growth-wand">
                                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>
                        <rect x="28" y="20" width="8" height="40" rx="2" fill="#5C4113" stroke="#3e2b1e" stroke-width="2"/>
                        <circle cx="32" cy="16" r="10" fill="#32CD32" filter="url(#glow-growth-wand)"/>
                        <circle cx="32" cy="16" r="6" fill="#90EE90" opacity="0.6"/>
                        <path d="M26 16 Q 32 6 38 16" fill="none" stroke="#228B22" stroke-width="2"/>
                    </svg>`,
            wizard_tower_wand: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                             <filter id="glow-wizard-wand">
                                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>
                        <rect x="28" y="24" width="8" height="36" rx="2" fill="#4B0082" stroke="#2e0050" stroke-width="2"/>
                        <path d="M26 4 L38 4 L42 24 L22 24 Z" fill="#FFD700" stroke="#DAA520" stroke-width="2"/>
                        <circle cx="32" cy="14" r="4" fill="#E6E6FA" filter="url(#glow-wizard-wand)"/>
                        <rect x="30" y="30" width="4" height="20" fill="#9370DB" opacity="0.5"/>
                    </svg>`,

            // ===== NEW BUILDING BLOCK ICONS =====
            cobblestone: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="0" y="0" width="64" height="64" fill="#5a5a5a"/>
                        <rect x="4" y="4" width="18" height="14" rx="4" fill="#777"/>
                        <rect x="26" y="6" width="16" height="12" rx="3" fill="#666"/>
                        <rect x="46" y="2" width="14" height="16" rx="4" fill="#888"/>
                        <rect x="8" y="22" width="22" height="16" rx="4" fill="#555"/>
                        <rect x="34" y="20" width="18" height="14" rx="3" fill="#6a6a6a"/>
                        <rect x="2" y="42" width="16" height="18" rx="4" fill="#7a7a7a"/>
                        <rect x="22" y="44" width="20" height="16" rx="4" fill="#4a4a4a"/>
                        <rect x="46" y="40" width="16" height="20" rx="3" fill="#5f5f5f"/>
                    </svg>`,
            roof_tiles: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="0" y="0" width="64" height="64" fill="#8B0000"/>
                        <rect x="0" y="0" width="16" height="12" fill="#A52A2A"/>
                        <rect x="16" y="0" width="16" height="12" fill="#CD5C5C"/>
                        <rect x="32" y="0" width="16" height="12" fill="#B22222"/>
                        <rect x="48" y="0" width="16" height="12" fill="#A52A2A"/>
                        <rect x="8" y="16" width="16" height="12" fill="#B22222"/>
                        <rect x="24" y="16" width="16" height="12" fill="#A52A2A"/>
                        <rect x="40" y="16" width="16" height="12" fill="#CD5C5C"/>
                        <rect x="0" y="32" width="16" height="12" fill="#CD5C5C"/>
                        <rect x="16" y="32" width="16" height="12" fill="#B22222"/>
                        <rect x="32" y="32" width="16" height="12" fill="#A52A2A"/>
                        <rect x="48" y="32" width="16" height="12" fill="#8B0000"/>
                        <rect x="8" y="48" width="16" height="16" fill="#8B0000"/>
                        <rect x="24" y="48" width="16" height="16" fill="#CD5C5C"/>
                        <rect x="40" y="48" width="16" height="16" fill="#B22222"/>
                        <path d="M0 12 L64 12 M0 28 L64 28 M0 44 L64 44" stroke="#6B0000" stroke-width="2"/>
                    </svg>`,
            chimney_brick: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="0" y="0" width="64" height="64" fill="#3a1a10"/>
                        <path d="M0 16 L64 16 M0 32 L64 32 M0 48 L64 48" stroke="#2a0f08" stroke-width="3"/>
                        <rect x="0" y="2" width="14" height="12" fill="#5a3520"/>
                        <rect x="16" y="2" width="14" height="12" fill="#4a2513"/>
                        <rect x="32" y="2" width="14" height="12" fill="#6a4530"/>
                        <rect x="48" y="2" width="14" height="12" fill="#5a3520"/>
                        <rect x="8" y="18" width="14" height="12" fill="#4a2513"/>
                        <rect x="24" y="18" width="14" height="12" fill="#5a3520"/>
                        <rect x="40" y="18" width="14" height="12" fill="#4a2513"/>
                        <rect x="0" y="34" width="14" height="12" fill="#6a4530"/>
                        <rect x="16" y="34" width="14" height="12" fill="#5a3520"/>
                        <rect x="32" y="34" width="14" height="12" fill="#4a2513"/>
                        <rect x="48" y="34" width="14" height="12" fill="#6a4530"/>
                        <rect x="8" y="50" width="14" height="12" fill="#5a3520"/>
                        <rect x="24" y="50" width="14" height="12" fill="#4a2513"/>
                        <rect x="40" y="50" width="14" height="12" fill="#6a4530"/>
                    </svg>`,
            window_frame: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="2" y="2" width="60" height="60" fill="#5C4033" stroke="#3a2515" stroke-width="3"/>
                        <rect x="6" y="6" width="24" height="24" fill="#a0d8ff" fill-opacity="0.4"/>
                        <rect x="34" y="6" width="24" height="24" fill="#a0d8ff" fill-opacity="0.4"/>
                        <rect x="6" y="34" width="24" height="24" fill="#a0d8ff" fill-opacity="0.4"/>
                        <rect x="34" y="34" width="24" height="24" fill="#a0d8ff" fill-opacity="0.4"/>
                        <path d="M32 6 L32 58 M6 32 L58 32" stroke="#5C4033" stroke-width="4"/>
                        <rect x="8" y="8" width="8" height="8" fill="white" opacity="0.4"/>
                        <rect x="36" y="8" width="8" height="8" fill="white" opacity="0.4"/>
                    </svg>`,
            fence: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="4" y="4" width="10" height="56" fill="#8B4513" stroke="#5c402d" stroke-width="2"/>
                        <rect x="50" y="4" width="10" height="56" fill="#8B4513" stroke="#5c402d" stroke-width="2"/>
                        <rect x="27" y="8" width="10" height="52" fill="#A0522D" stroke="#6b4423" stroke-width="2"/>
                        <rect x="0" y="18" width="64" height="8" fill="#6B4423"/>
                        <rect x="0" y="42" width="64" height="8" fill="#6B4423"/>
                        <path d="M9 4 L9 8 M55 4 L55 8 M32 8 L32 12" stroke="#3e2b1e" stroke-width="2"/>
                    </svg>`,
            shingles: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="0" y="0" width="64" height="64" fill="#2F4F4F"/>
                        <rect x="0" y="0" width="16" height="8" fill="#3a5a5a"/>
                        <rect x="16" y="0" width="16" height="8" fill="#456565"/>
                        <rect x="32" y="0" width="16" height="8" fill="#1a3a3a"/>
                        <rect x="48" y="0" width="16" height="8" fill="#3a5a5a"/>
                        <rect x="8" y="8" width="16" height="8" fill="#1a3a3a"/>
                        <rect x="24" y="8" width="16" height="8" fill="#3a5a5a"/>
                        <rect x="40" y="8" width="16" height="8" fill="#456565"/>
                        <rect x="0" y="16" width="16" height="8" fill="#456565"/>
                        <rect x="16" y="16" width="16" height="8" fill="#1a3a3a"/>
                        <rect x="32" y="16" width="16" height="8" fill="#3a5a5a"/>
                        <rect x="48" y="16" width="16" height="8" fill="#1a3a3a"/>
                        <rect x="8" y="24" width="16" height="8" fill="#456565"/>
                        <rect x="24" y="24" width="16" height="8" fill="#1a3a3a"/>
                        <rect x="40" y="24" width="16" height="8" fill="#3a5a5a"/>
                        <rect x="0" y="32" width="16" height="8" fill="#3a5a5a"/>
                        <rect x="16" y="32" width="16" height="8" fill="#456565"/>
                        <rect x="32" y="32" width="16" height="8" fill="#1a3a3a"/>
                        <rect x="48" y="32" width="16" height="8" fill="#456565"/>
                        <rect x="8" y="40" width="16" height="8" fill="#1a3a3a"/>
                        <rect x="24" y="40" width="16" height="8" fill="#3a5a5a"/>
                        <rect x="40" y="40" width="16" height="8" fill="#456565"/>
                        <rect x="0" y="48" width="16" height="8" fill="#456565"/>
                        <rect x="16" y="48" width="16" height="8" fill="#1a3a3a"/>
                        <rect x="32" y="48" width="16" height="8" fill="#3a5a5a"/>
                        <rect x="48" y="48" width="16" height="8" fill="#1a3a3a"/>
                        <rect x="8" y="56" width="16" height="8" fill="#3a5a5a"/>
                        <rect x="24" y="56" width="16" height="8" fill="#456565"/>
                        <rect x="40" y="56" width="16" height="8" fill="#1a3a3a"/>
                    </svg>`,
            polished_stone: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                            <linearGradient id="grad-polished" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#bababa" />
                                <stop offset="50%" style="stop-color:#9a9a9a" />
                                <stop offset="100%" style="stop-color:#8a8a8a" />
                            </linearGradient>
                        </defs>
                        <rect x="0" y="0" width="64" height="64" fill="url(#grad-polished)"/>
                        <rect x="2" y="2" width="60" height="60" fill="none" stroke="white" stroke-width="2" opacity="0.3"/>
                        <rect x="4" y="4" width="20" height="20" fill="white" opacity="0.15"/>
                        <path d="M10 50 L50 10" stroke="white" stroke-width="2" opacity="0.2"/>
                    </svg>`,
            dark_planks: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="0" y="0" width="64" height="64" fill="#3e2723"/>
                        <path d="M0 16 L64 16 M0 32 L64 32 M0 48 L64 48" stroke="#2c1e18" stroke-width="3"/>
                        <path d="M16 0 L16 16 M32 16 L32 32 M48 32 L48 48 M16 48 L16 64" stroke="#2c1e18" stroke-width="2"/>
                        <rect x="4" y="4" width="8" height="8" fill="#4e342e" opacity="0.5"/>
                        <rect x="40" y="20" width="12" height="8" fill="#4e342e" opacity="0.5"/>
                        <rect x="8" y="36" width="10" height="8" fill="#5d4037" opacity="0.4"/>
                        <rect x="48" y="52" width="8" height="8" fill="#4e342e" opacity="0.5"/>
                    </svg>`,
            white_plaster: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="0" y="0" width="64" height="64" fill="#FAF0E6"/>
                        <rect x="4" y="4" width="12" height="10" fill="#FFFAF0" opacity="0.8"/>
                        <rect x="20" y="8" width="16" height="12" fill="#F5F5DC" opacity="0.7"/>
                        <rect x="42" y="4" width="18" height="14" fill="#FAEBD7" opacity="0.8"/>
                        <rect x="8" y="26" width="20" height="14" fill="#FAEBD7" opacity="0.6"/>
                        <rect x="36" y="24" width="14" height="16" fill="#FFFAF0" opacity="0.7"/>
                        <rect x="4" y="46" width="16" height="14" fill="#F5F5DC" opacity="0.7"/>
                        <rect x="28" y="44" width="18" height="16" fill="#FAF0E6" opacity="0.8"/>
                        <rect x="52" y="48" width="8" height="12" fill="#FAEBD7" opacity="0.6"/>
                    </svg>`,
            terracotta: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="0" y="0" width="64" height="64" fill="#CD853F"/>
                        <rect x="4" y="4" width="16" height="16" fill="#D2691E" opacity="0.7"/>
                        <rect x="24" y="8" width="20" height="12" fill="#B8860B" opacity="0.6"/>
                        <rect x="48" y="4" width="12" height="18" fill="#DEB887" opacity="0.7"/>
                        <rect x="8" y="28" width="24" height="16" fill="#DEB887" opacity="0.5"/>
                        <rect x="38" y="26" width="18" height="14" fill="#CD853F" opacity="0.8"/>
                        <rect x="4" y="48" width="18" height="12" fill="#D2691E" opacity="0.6"/>
                        <rect x="28" y="46" width="16" height="14" fill="#B8860B" opacity="0.7"/>
                        <rect x="50" y="50" width="10" height="10" fill="#DEB887" opacity="0.7"/>
                    </svg>`,
            thatch: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="0" y="0" width="64" height="64" fill="#D4A574"/>
                        <path d="M0 8 L64 8 M0 16 L64 16 M0 24 L64 24 M0 32 L64 32 M0 40 L64 40 M0 48 L64 48 M0 56 L64 56" stroke="#C4956A" stroke-width="2"/>
                        <path d="M4 0 L4 64 M12 0 L12 64 M20 0 L20 64 M28 0 L28 64 M36 0 L36 64 M44 0 L44 64 M52 0 L52 64 M60 0 L60 64" stroke="#E5B584" stroke-width="1" opacity="0.6"/>
                        <rect x="8" y="12" width="12" height="4" fill="#B4854A" opacity="0.5"/>
                        <rect x="36" y="28" width="16" height="4" fill="#B4854A" opacity="0.5"/>
                        <rect x="16" y="44" width="10" height="4" fill="#E5B584" opacity="0.6"/>
                    </svg>`,
            half_timber: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="0" y="0" width="64" height="64" fill="#F5F5DC"/>
                        <rect x="0" y="0" width="64" height="8" fill="#3e2723"/>
                        <rect x="0" y="56" width="64" height="8" fill="#3e2723"/>
                        <rect x="0" y="0" width="8" height="64" fill="#3e2723"/>
                        <rect x="56" y="0" width="8" height="64" fill="#3e2723"/>
                        <path d="M8 8 L56 56" stroke="#4e342e" stroke-width="8"/>
                        <path d="M8 56 L56 8" stroke="#4e342e" stroke-width="8"/>
                        <rect x="28" y="0" width="8" height="64" fill="#4e342e"/>
                        <rect x="0" y="28" width="64" height="8" fill="#4e342e"/>
                    </svg>`,
            mossy_stone: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                            <linearGradient id="grad-mossy" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#777" />
                                <stop offset="100%" style="stop-color:#555" />
                            </linearGradient>
                        </defs>
                        <rect x="0" y="0" width="64" height="64" fill="url(#grad-mossy)"/>
                        <rect x="8" y="8" width="16" height="12" fill="#666"/>
                        <rect x="36" y="4" width="20" height="16" fill="#777"/>
                        <rect x="4" y="28" width="24" height="14" fill="#555"/>
                        <rect x="42" y="32" width="18" height="18" fill="#666"/>
                        <rect x="12" y="48" width="20" height="12" fill="#777"/>
                        <circle cx="12" cy="12" r="6" fill="#3a5a2a" opacity="0.7"/>
                        <circle cx="50" cy="24" r="8" fill="#4a6a3a" opacity="0.6"/>
                        <circle cx="24" cy="52" r="7" fill="#3a5a2a" opacity="0.7"/>
                        <circle cx="52" cy="50" r="5" fill="#4a6a3a" opacity="0.5"/>
                        <rect x="4" y="36" width="8" height="4" fill="#3a5a2a" opacity="0.6"/>
                    </svg>`,
            iron_bars: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="6" y="0" width="6" height="64" fill="#5a5a5a" stroke="#4a4a4a" stroke-width="1"/>
                        <rect x="20" y="0" width="6" height="64" fill="#5a5a5a" stroke="#4a4a4a" stroke-width="1"/>
                        <rect x="38" y="0" width="6" height="64" fill="#5a5a5a" stroke="#4a4a4a" stroke-width="1"/>
                        <rect x="52" y="0" width="6" height="64" fill="#5a5a5a" stroke="#4a4a4a" stroke-width="1"/>
                        <rect x="0" y="12" width="64" height="4" fill="#6a6a6a"/>
                        <rect x="0" y="32" width="64" height="4" fill="#6a6a6a"/>
                        <rect x="0" y="48" width="64" height="4" fill="#6a6a6a"/>
                        <rect x="8" y="2" width="2" height="4" fill="#8a8a8a" opacity="0.6"/>
                        <rect x="22" y="2" width="2" height="4" fill="#8a8a8a" opacity="0.6"/>
                        <rect x="40" y="2" width="2" height="4" fill="#8a8a8a" opacity="0.6"/>
                        <rect x="54" y="2" width="2" height="4" fill="#8a8a8a" opacity="0.6"/>
                    </svg>`,
            planks: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="0" y="0" width="64" height="64" fill="#9a7553"/>
                        <path d="M0 16 L64 16 M0 32 L64 32 M0 48 L64 48" stroke="#6b4423" stroke-width="3"/>
                        <path d="M16 0 L16 16 M48 0 L48 16 M32 16 L32 32 M16 32 L16 48 M48 32 L48 48 M32 48 L32 64" stroke="#6b4423" stroke-width="2"/>
                        <rect x="4" y="4" width="8" height="8" fill="#aa8563" opacity="0.4"/>
                        <rect x="36" y="20" width="10" height="8" fill="#aa8563" opacity="0.4"/>
                        <rect x="8" y="36" width="12" height="8" fill="#8a6543" opacity="0.5"/>
                    </svg>`,
            stone_brick: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="0" y="0" width="64" height="64" fill="#696969"/>
                        <path d="M0 16 L64 16 M0 32 L64 32 M0 48 L64 48" stroke="#555" stroke-width="3"/>
                        <rect x="0" y="2" width="30" height="12" fill="#757575"/>
                        <rect x="34" y="2" width="28" height="12" fill="#575757"/>
                        <rect x="16" y="18" width="30" height="12" fill="#575757"/>
                        <rect x="0" y="18" width="12" height="12" fill="#757575"/>
                        <rect x="50" y="18" width="14" height="12" fill="#757575"/>
                        <rect x="0" y="34" width="28" height="12" fill="#575757"/>
                        <rect x="32" y="34" width="30" height="12" fill="#757575"/>
                        <rect x="14" y="50" width="32" height="12" fill="#757575"/>
                        <rect x="0" y="50" width="10" height="12" fill="#575757"/>
                        <rect x="50" y="50" width="14" height="12" fill="#575757"/>
                    </svg>`,
            trampoline: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="4" y="4" width="56" height="56" fill="#2F4F4F" stroke="#1a3a3a" stroke-width="3"/>
                        <rect x="10" y="10" width="44" height="44" fill="#2E8B57"/>
                        <path d="M10 20 L54 20 M10 32 L54 32 M10 44 L54 44" stroke="#3CB371" stroke-width="2"/>
                        <path d="M20 10 L20 54 M32 10 L32 54 M44 10 L44 54" stroke="#3CB371" stroke-width="2"/>
                        <circle cx="32" cy="32" r="6" fill="white" opacity="0.3"/>
                    </svg>`,
            survival_block: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                            <filter id="glow-survival">
                                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>
                        <rect x="0" y="0" width="64" height="64" fill="#2a1a1a"/>
                        <rect x="0" y="0" width="64" height="4" fill="#ff3333"/>
                        <rect x="0" y="60" width="64" height="4" fill="#ff3333"/>
                        <rect x="0" y="0" width="4" height="64" fill="#ff3333"/>
                        <rect x="60" y="0" width="4" height="64" fill="#ff3333"/>
                        <circle cx="32" cy="24" r="12" fill="#e8e8e8" filter="url(#glow-survival)"/>
                        <rect x="28" y="20" width="3" height="5" fill="#000"/>
                        <rect x="33" y="20" width="3" height="5" fill="#000"/>
                        <rect x="30" y="27" width="1" height="2" fill="#000"/>
                        <rect x="33" y="27" width="1" height="2" fill="#000"/>
                        <rect x="26" y="30" width="12" height="4" fill="#e8e8e8"/>
                        <rect x="29" y="30" width="2" height="4" fill="#000"/>
                        <rect x="33" y="30" width="2" height="4" fill="#000"/>
                        <path d="M24 44 L40 44 L36 52 L28 52 Z" fill="#cc2222"/>
                        <path d="M28 52 L36 52 L40 44" fill="none" stroke="#ff3333" stroke-width="1"/>
                        <rect x="30" y="48" width="4" height="2" fill="#ff6666"/>
                    </svg>`,
            chocolate_bar: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                            <linearGradient id="grad-choco" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#8b4513" />
                                <stop offset="50%" style="stop-color:#5c3317" />
                                <stop offset="100%" style="stop-color:#3e2723" />
                            </linearGradient>
                        </defs>
                        <rect x="12" y="10" width="40" height="44" rx="2" fill="url(#grad-choco)" stroke="#3e2723" stroke-width="2"/>
                        <rect x="12" y="10" width="40" height="44" rx="2" fill="none" class="shine"/>
                        <!-- Chocolate Squares -->
                        <rect x="16" y="14" width="14" height="10" rx="1" fill="#6d3e1e" opacity="0.8"/>
                        <rect x="34" y="14" width="14" height="10" rx="1" fill="#6d3e1e" opacity="0.8"/>
                        
                        <rect x="16" y="28" width="14" height="10" rx="1" fill="#6d3e1e" opacity="0.8"/>
                        <rect x="34" y="28" width="14" height="10" rx="1" fill="#6d3e1e" opacity="0.8"/>
                        
                        <rect x="16" y="42" width="14" height="10" rx="1" fill="#6d3e1e" opacity="0.8"/>
                        <rect x="34" y="42" width="14" height="10" rx="1" fill="#6d3e1e" opacity="0.8"/>
                        
                        <!-- Wrapper at bottom -->
                        <path d="M12 40 L52 35 L52 54 L12 54 Z" fill="#C0C0C0" stroke="#999"/>
                        <path d="M12 40 Q 32 45 52 35" fill="none" stroke="#999" stroke-width="1"/>
                        <text x="32" y="50" font-family="Arial" font-size="8" fill="#333" text-anchor="middle" transform="rotate(-5 32 50)">CHOCO</text>
                    </svg>`,
            escape_room_block: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <defs>
                            <linearGradient id="grad-escape" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#ff4444" />
                                <stop offset="100%" style="stop-color:#990000" />
                            </linearGradient>
                        </defs>
                        <rect x="0" y="0" width="64" height="64" fill="#333" stroke="#ff0000" stroke-width="2"/>
                        <rect x="4" y="4" width="56" height="56" fill="url(#grad-escape)" opacity="0.8"/>
                        <!-- Clock Face -->
                        <circle cx="32" cy="32" r="20" fill="#fff" stroke="#000" stroke-width="2"/>
                        <line x1="32" y1="32" x2="32" y2="18" stroke="#000" stroke-width="2"/>
                        <line x1="32" y1="32" x2="42" y2="32" stroke="#000" stroke-width="2"/>
                        <!-- Keyhole -->
                        <circle cx="32" cy="40" r="3" fill="#000" opacity="0.5"/>
                    </svg>`,
            maze_block: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="0" y="0" width="64" height="64" fill="#444"/>
                        <path d="M10 10 L54 10 L54 54 L10 54 Z" fill="none" stroke="#00ff00" stroke-width="4"/>
                        <path d="M22 22 L22 42 M42 22 L42 42 M22 32 L42 32" stroke="#00ff00" stroke-width="3"/>
                    </svg>`,
            thruster: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="16" y="8" width="32" height="40" rx="4" fill="#888" stroke="#444" stroke-width="2"/>
                        <rect x="20" y="12" width="24" height="8" rx="2" fill="#555"/>
                        <circle cx="32" cy="30" r="8" fill="#333" stroke="#222" stroke-width="2"/>
                        <path d="M22 48 L42 48 L48 60 L16 60 Z" fill="#FFA500" stroke="#CC8400" stroke-width="2"/>
                        <path d="M28 60 L36 60 L32 52 Z" fill="#FFFF00"/>
                    </svg>`,
            physics_ball: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <circle cx="32" cy="32" r="28" fill="#FF4500" stroke="#8B0000" stroke-width="2"/>
                        <circle cx="20" cy="20" r="8" fill="white" opacity="0.4"/>
                        <path d="M10 32 Q 32 54 54 32" fill="none" stroke="#8B0000" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
                    </svg>`,
            sign: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="28" y="32" width="8" height="32" fill="#8B4513" stroke="#5c402d" stroke-width="2"/>
                        <rect x="8" y="8" width="48" height="24" rx="2" fill="#D2B48C" stroke="#8B4513" stroke-width="2"/>
                        <rect x="12" y="12" width="40" height="2" fill="#8B4513" opacity="0.3"/>
                        <rect x="12" y="18" width="40" height="2" fill="#8B4513" opacity="0.3"/>
                        <rect x="12" y="24" width="30" height="2" fill="#8B4513" opacity="0.3"/>
                    </svg>`,
            playground_block: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <rect x="0" y="0" width="32" height="32" fill="#FFD700"/>
                        <rect x="32" y="0" width="32" height="32" fill="#4169E1"/>
                        <rect x="0" y="32" width="32" height="32" fill="#DC143C"/>
                        <rect x="32" y="32" width="32" height="32" fill="#FFD700"/>
                        <rect x="0" y="0" width="64" height="64" fill="none" stroke="#000" stroke-width="2"/>
                    </svg>`,
            slide_block: `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <path d="M8 16 L56 56 L56 64 L8 64 Z" fill="#FF4500" stroke="#cc3700" stroke-width="2"/>
                        <rect x="4" y="16" width="4" height="48" fill="#888"/>
                        <rect x="56" y="48" width="4" height="16" fill="#888"/>
                        <path d="M12 16 L52 48" stroke="#ff7f50" stroke-width="4" stroke-linecap="round"/>
                    </svg>`


        };


        if (svgs[item]) return svgs[item];

        // Dynamic check for Spawn Eggs
        if (typeof item === 'string' && item.endsWith('_spawn_egg')) {
            return `<svg viewBox="0 0 64 64" width="100%" height="100%">
                        <ellipse cx="32" cy="32" rx="24" ry="30" fill="#F0E6D2" stroke="#C0B090" stroke-width="2"/>
                        <circle cx="24" cy="24" r="4" fill="#444" opacity="0.6"/>
                        <circle cx="40" cy="30" r="5" fill="#444" opacity="0.6"/>
                        <circle cx="28" cy="42" r="3" fill="#444" opacity="0.6"/>
                        <circle cx="44" cy="44" r="4" fill="#444" opacity="0.6"/>
                        <circle cx="36" cy="18" r="2" fill="#444" opacity="0.6"/>
                    </svg>`;
        }

        return `<svg viewBox="0 0 64 64" width="100%" height="100%"><rect x="4" y="4" width="56" height="56" rx="8" fill="#7B5B3C" stroke="#3e2b1e" stroke-width="2"/><rect x="16" y="16" width="32" height="32" rx="4" fill="#A0A0A0" stroke="white" stroke-width="2" opacity="0.5"/></svg>`;
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
