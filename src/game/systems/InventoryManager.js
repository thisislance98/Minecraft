/**
 * InventoryManager - Handles inventory state and crafting logic.
 * Decoupled from UI.
 */
export class InventoryManager {
    constructor(game) {
        this.game = game;

        // 63 Slots: 0-8 Hotbar, 9-62 Storage (6 rows of 9)
        this.slots = new Array(63).fill(null).map(() => ({ item: null, count: 0, type: null }));
        // Crafting Grid: 9 slots (100-108)
        this.craftingSlots = new Array(9).fill(null).map(() => ({ item: null, count: 0, type: null }));
        // Crafting Result: 1 slot (109)
        this.craftingResult = { item: null, count: 0, type: null };

        this.selectedSlot = 0;

        // Crafting Recipes (Simple list for now)
        // Crafting Recipes (Disabled)
        this.recipes = [];

        // Initial Layout
        this.setupInitialItems();
    }

    setupInitialItems() {
        // 1. Pickaxe
        this.addItemToSlot(0, 'pickaxe', 1, 'tool');
        // 2. Broom
        this.addItemToSlot(1, 'flying_broom', 1, 'flying_broom');
        // 3. Binoculars
        this.addItemToSlot(2, 'binoculars', 1, 'tool');
        // 4. Xbox
        this.addItemToSlot(3, 'xbox', 1, 'xbox');
        // 5. Wand
        this.addItemToSlot(4, 'wand', 1, 'wand');
        // 6. Bow
        this.addItemToSlot(5, 'bow', 1, 'tool');
        // 7. Levitate Wand
        this.addItemToSlot(6, 'levitation_wand', 1, 'wand');
        // 8. Parkour Block
        this.addItemToSlot(7, 'parkour_block', 64, 'block');
        // 9. Empty
        this.slots[8] = { item: null, count: 0, type: null }; // Explicitly clear


        // Add some materials for testing
        // Start filling from main inventory (slot 9+)

        this.addItemToSlot(9, 'wood', 10, 'block');
        this.addItemToSlot(10, 'log', 10, 'block');
        this.addItemToSlot(11, 'ride_wand', 1, 'ride_wand');
        this.addItemToSlot(12, 'capture_wand', 1, 'wand');
        this.addItemToSlot(13, 'trampoline', 64, 'block');
        this.addItemToSlot(14, 'water_bucket', 16, 'water_bucket');
        this.addItemToSlot(15, 'brick', 64, 'block');
        this.addItemToSlot(16, 'glass', 64, 'block');
        this.addItemToSlot(17, 'stick', 10, 'item');

        // ===== NEW BUILDING BLOCKS FOR HOUSES =====
        this.addItemToSlot(18, 'cobblestone', 64, 'block');      // Foundation/walls
        this.addItemToSlot(19, 'roof_tiles', 64, 'block');       // Red clay roof
        this.addItemToSlot(20, 'chimney_brick', 64, 'block');    // Chimneys
        this.addItemToSlot(21, 'window_frame', 64, 'block');     // Windows
        this.addItemToSlot(22, 'fence', 64, 'block');            // Fencing/railings
        this.addItemToSlot(23, 'shingles', 64, 'block');         // Slate roofing
        this.addItemToSlot(24, 'polished_stone', 64, 'block');   // Fancy floors
        this.addItemToSlot(25, 'dark_planks', 64, 'block');      // Dark wood
        this.addItemToSlot(26, 'white_plaster', 64, 'block');    // White walls
        this.addItemToSlot(27, 'terracotta', 64, 'block');       // Decorative clay
        this.addItemToSlot(28, 'thatch', 64, 'block');           // Straw roof
        this.addItemToSlot(29, 'half_timber', 64, 'block');      // Tudor walls
        this.addItemToSlot(30, 'mossy_stone', 64, 'block');      // Weathered stone
        this.addItemToSlot(31, 'iron_bars', 64, 'block');        // Window bars
        this.addItemToSlot(32, 'planks', 64, 'block');           // Regular planks
        this.addItemToSlot(33, 'stone_brick', 64, 'block');      // Stone bricks

        // ===== FURNITURE =====
        this.addItemToSlot(34, 'chair', 10, 'chair');
        this.addItemToSlot(35, 'table', 5, 'table');
        this.addItemToSlot(36, 'couch', 5, 'couch');

        // ===== WEAPONS =====
        this.addItemToSlot(38, 'sword', 1, 'tool');  // Sword moved to inventory
        this.addItemToSlot(39, 'mob_waves_block', 10, 'block');
        this.addItemToSlot(41, 'slime', 64, 'block');
    }

    // --- Slot Accessors for Crafting ---
    // Crafting Slots: 100-108
    // Result Slot: 109

    getSlot(index) {
        if (index >= 0 && index < 63) return this.slots[index];
        if (index >= 100 && index < 109) return this.craftingSlots[index - 100];
        if (index === 109) return this.craftingResult;
        return null;
    }

    setSlot(index, slotData) {
        if (index >= 0 && index < 63) {
            this.slots[index] = slotData;
        } else if (index >= 100 && index < 109) {
            this.craftingSlots[index - 100] = slotData;
            this.checkRecipe(); // Check for valid recipe on change
        } else if (index === 109) {
            this.craftingResult = slotData;
        }
    }

    addItemToSlot(index, item, count, type) {
        if (index >= 0 && index < this.slots.length) {
            this.slots[index] = { item, count, type };
        } else if (index >= 100 && index < 109) {
            this.craftingSlots[index - 100] = { item, count, type };
            this.checkRecipe();
        }
    }

    // --- Core Actions ---

    selectSlot(index) {
        if (index >= 0 && index < 9) {
            // Deselect previous
            const prevSlot = this.slots[this.selectedSlot];
            if (prevSlot && prevSlot.item) {
                const prevItemInstance = this.game.itemManager.getItem(prevSlot.item);
                if (prevItemInstance && prevItemInstance.onDeselect) {
                    prevItemInstance.onDeselect(this.game, this.game.player);
                }
            }

            this.selectedSlot = index;

            // Select new
            const newSlot = this.slots[this.selectedSlot];
            if (newSlot && newSlot.item) {
                const newItemInstance = this.game.itemManager.getItem(newSlot.item);
                if (newItemInstance && newItemInstance.onSelect) {
                    newItemInstance.onSelect(this.game, this.game.player);
                }
            }

            return true;
        }
        return false;
    }

    getSelectedItem() {
        return this.slots[this.selectedSlot];
    }

    // Returns true if item was successfully added (fully or partially)
    // For now, simpler: true if fully added, false if full?
    // Let's implement robust "add remainder" logic if needed, but standard stack logic is fine.
    addItem(item, count, type = 'block') {
        let remaining = count;

        // Helper to trigger UI update
        const triggerUIUpdate = () => {
            if (this.game.inventory) {
                this.game.inventory.renderHotbar();
                this.game.inventory.renderInventoryScreen();
            }
            if (this.game.player) {
                this.game.player.updateHeldItemVisibility();
            }
        };

        // Priority 1: Stack in Hotbar (Slots 0-8)
        for (let i = 0; i < 9; i++) {
            const slot = this.slots[i];
            if (slot.item === item && slot.count < 64) {
                const space = 64 - slot.count;
                const toAdd = Math.min(space, remaining);
                slot.count += toAdd;
                remaining -= toAdd;
                if (remaining <= 0) {
                    triggerUIUpdate();
                    return true;
                }
            }
        }

        // Priority 2: Fill Empty Hotbar Slots (Slots 0-8)
        for (let i = 0; i < 9; i++) {
            if (!this.slots[i].item) {
                // If we have more than 64, we fill this slot and continue
                const toAdd = Math.min(64, remaining);
                this.slots[i] = { item, count: toAdd, type };
                remaining -= toAdd;
                if (remaining <= 0) {
                    triggerUIUpdate();
                    return true;
                }
            }
        }

        // Priority 3: Stack in Main Inventory (Slots 9-62)
        for (let i = 9; i < this.slots.length; i++) {
            const slot = this.slots[i];
            if (slot.item === item && slot.count < 64) {
                const space = 64 - slot.count;
                const toAdd = Math.min(space, remaining);
                slot.count += toAdd;
                remaining -= toAdd;
                if (remaining <= 0) {
                    triggerUIUpdate();
                    return true;
                }
            }
        }

        // Priority 4: Fill Empty Main Inventory Slots (Slots 9-62)
        for (let i = 9; i < this.slots.length; i++) {
            if (!this.slots[i].item) {
                const toAdd = Math.min(64, remaining);
                this.slots[i] = { item, count: toAdd, type };
                remaining -= toAdd;
                if (remaining <= 0) {
                    triggerUIUpdate();
                    return true;
                }
            }
        }

        if (remaining < count) {
            // Trigger UI update if any item was added (partial add)
            triggerUIUpdate();
            return true;
        }
        return false;
    }

    removeItem(index, count = 1) {
        if (index < 0 || index >= this.slots.length) return;
        const slot = this.slots[index];
        if (!slot.item) return;

        slot.count -= count;
        if (slot.count <= 0) {
            this.slots[index] = { item: null, count: 0, type: null };
        }

        // Trigger UI update
        if (this.game.inventory) {
            this.game.inventory.renderHotbar();
            this.game.inventory.renderInventoryScreen();
        }
        if (this.game.player) {
            this.game.player.updateHeldItemVisibility();
        }
    }

    useSelected() {
        const slot = this.slots[this.selectedSlot];
        if (slot && slot.item && slot.count > 0) {
            slot.count--;
            if (slot.count <= 0) {
                this.slots[this.selectedSlot] = { item: null, count: 0, type: null };
            }
            return true;
        }
        return false;
    }

    dropSelected(count = 1) {
        const slot = this.slots[this.selectedSlot];
        if (slot && slot.item && slot.count > 0) {
            const itemToDrop = slot.item;
            slot.count -= count;
            if (slot.count <= 0) {
                this.slots[this.selectedSlot] = { item: null, count: 0, type: null };
            }

            console.log(`Dropped ${count} ${itemToDrop}`);

            // Trigger UI update
            if (this.game.inventory) {
                this.game.inventory.renderHotbar();
                this.game.inventory.renderInventoryScreen();
            }
            if (this.game.player) {
                this.game.player.updateHeldItemVisibility();
            }

            return true;
        }
        return false;
    }

    getItemCount(itemName) {
        let total = 0;
        for (const slot of this.slots) {
            if (slot.item === itemName) total += slot.count;
        }
        return total;
    }

    // --- Slot Manipulation (Drag/Drop support) ---

    // Move from index A to B. Handles swap, stack, etc.
    // Returns status to update UI.
    moveItem(fromIndex, toIndex, count = null) {
        if (fromIndex === toIndex) return;

        const fromSlot = this.getSlot(fromIndex);
        const toSlot = this.getSlot(toIndex);

        if (!fromSlot || !fromSlot.item) return;

        // If count is not specified, move entire stack
        const amount = count || fromSlot.count;

        // Case 1: Target is empty
        if (!toSlot.item) {
            if (amount === fromSlot.count) {
                // Move all
                this.setSlot(toIndex, { ...fromSlot });
                this.setSlot(fromIndex, { item: null, count: 0, type: null });
            } else {
                // Split
                this.setSlot(toIndex, { ...fromSlot, count: amount });
                fromSlot.count -= amount;
            }
            return;
        }

        // Case 2: Target is same item -> Stack
        if (toSlot.item === fromSlot.item) {
            const space = 64 - toSlot.count;
            const toMove = Math.min(amount, space);

            toSlot.count += toMove;
            fromSlot.count -= toMove;

            if (fromSlot.count <= 0) {
                this.setSlot(fromIndex, { item: null, count: 0, type: null });
            }
            return;
        }

        // Case 3: Target is different -> Swap (only if moving full stack)
        if (amount === fromSlot.count) {
            const temp = { ...toSlot };
            this.setSlot(toIndex, { ...fromSlot });
            this.setSlot(fromIndex, temp);
        }
    }

    // --- Crafting Logic ---

    // Check if current crafting grid matches any recipe
    checkRecipe() {
        // Disabled
        this.craftingResult = { item: null, count: 0, type: null };
    }

    // Called when user clicks result slot
    craft() {
        return null;
    }

    // Helper to return crafting items to inventory on close
    returnCraftingItems() {
        for (let i = 0; i < this.craftingSlots.length; i++) {
            const slot = this.craftingSlots[i];
            if (slot.item) {
                this.addItem(slot.item, slot.count, slot.type);
                this.craftingSlots[i] = { item: null, count: 0, type: null };
            }
        }
        this.craftingResult = { item: null, count: 0, type: null };
    }
}
