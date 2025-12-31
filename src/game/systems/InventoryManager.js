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
        this.recipes = [
            { result: { item: 'wood', count: 4, type: 'block' }, ingredients: [{ item: 'log', count: 1 }] },
            { result: { item: 'stick', count: 4, type: 'item' }, ingredients: [{ item: 'wood', count: 2 }] },
            { result: { item: 'crafting_table', count: 1, type: 'block' }, ingredients: [{ item: 'wood', count: 4 }] },
            { result: { item: 'planks', count: 4, type: 'block' }, ingredients: [{ item: 'log', count: 1 }] },
            { result: { item: 'pickaxe', count: 1, type: 'tool' }, ingredients: [{ item: 'stick', count: 2 }, { item: 'wood', count: 3 }] },
            { result: { item: 'sword', count: 1, type: 'tool' }, ingredients: [{ item: 'stick', count: 1 }, { item: 'wood', count: 2 }] },
            { result: { item: 'shovel', count: 1, type: 'tool' }, ingredients: [{ item: 'stick', count: 2 }, { item: 'wood', count: 1 }] },
            { result: { item: 'bow', count: 1, type: 'tool' }, ingredients: [{ item: 'stick', count: 3 }, { item: 'string', count: 3 }] },
            // New Recipes
            { result: { item: 'furnace', count: 1, type: 'block' }, ingredients: [{ item: 'stone', count: 8 }] },
            { result: { item: 'chest', count: 1, type: 'block' }, ingredients: [{ item: 'wood', count: 8 }] },
            { result: { item: 'door', count: 1, type: 'block' }, ingredients: [{ item: 'wood', count: 6 }] },
            { result: { item: 'ladder', count: 3, type: 'block' }, ingredients: [{ item: 'stick', count: 7 }] },
        ];

        // Initial Layout
        this.setupInitialItems();
    }

    setupInitialItems() {
        this.addItemToSlot(0, 'thruster', 64, 'thruster');
        this.addItemToSlot(37, 'pickaxe', 1, 'tool');
        this.addItemToSlot(1, 'crafting_table', 1, 'block');
        this.addItemToSlot(2, 'bow', 1, 'tool');  // Bow in hotbar
        this.addItemToSlot(3, 'wand', 1, 'wand');
        this.addItemToSlot(4, 'shrink_wand', 1, 'wand');
        this.addItemToSlot(5, 'omni_wand', 1, 'wand');
        this.addItemToSlot(40, 'giant_tree_wand', 1, 'wand');
        this.addItemToSlot(42, 'time_stop_wand', 1, 'wand');

        // Add some materials for testing
        this.addItemToSlot(6, 'time_stop_wand', 1, 'wand');
        this.addItemToSlot(7, 'flying_broom', 1, 'flying_broom');
        this.addItemToSlot(8, 'escape_room_block', 10, 'block');
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

        // 1. Try to stack
        for (let i = 0; i < this.slots.length; i++) {
            const slot = this.slots[i];
            if (slot.item === item && slot.count < 64) {
                const space = 64 - slot.count;
                const toAdd = Math.min(space, remaining);
                slot.count += toAdd;
                remaining -= toAdd;
                if (remaining <= 0) return true;
            }
        }

        // 2. Find empty slots
        for (let i = 0; i < this.slots.length; i++) {
            if (this.slots[i].item === null) {
                this.slots[i] = { item, count: remaining, type };
                return true;
            }
        }

        return false; // Could not fit all
    }

    removeItem(index, count = 1) {
        if (index < 0 || index >= this.slots.length) return;
        const slot = this.slots[index];
        if (!slot.item) return;

        slot.count -= count;
        if (slot.count <= 0) {
            this.slots[index] = { item: null, count: 0, type: null };
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
        // Collect ingredients from grid
        // Currently supporting shapeless (just count items)
        // For distinct patterns we would need to check grid positions.
        // For now, let's implement a simple "bag of ingredients" check.

        const ingredients = new Map();
        for (const slot of this.craftingSlots) {
            if (slot.item) {
                const current = ingredients.get(slot.item) || 0;
                ingredients.set(slot.item, current + slot.count); // Note: Shape based usually counts 1 per slot
            }
        }

        // Simple Shape-Agnostic check:
        // Does the grid contain EXACTLY the ingredients needed? (No extras)
        // AND are they in the grid?
        // Note: Minecraft recipes usually check for 1 unit per slot.
        // So we should check: Do we have the required items in the grid? 
        // We will simplify: Map item -> count of slots containing it.

        const currentItems = {};
        let totalItems = 0;
        for (const slot of this.craftingSlots) {
            if (slot.item) {
                currentItems[slot.item] = (currentItems[slot.item] || 0) + 1; // Count used slots
                totalItems++;
            }
        }

        let bestMatch = null;

        for (const recipe of this.recipes) {
            // fast fail
            let match = true;
            let recipeItemsCount = 0;

            for (const ing of recipe.ingredients) {
                const needed = ing.count;
                const set = currentItems[ing.item] || 0;
                if (set < needed) {
                    match = false;
                    break;
                }
                recipeItemsCount += needed;
            }

            if (match && totalItems === recipeItemsCount) {
                // Perfect match (no extra items)
                bestMatch = recipe;
                break;
            }
        }

        if (bestMatch) {
            this.craftingResult = { ...bestMatch.result };
        } else {
            this.craftingResult = { item: null, count: 0, type: null };
        }
    }

    // Called when user clicks result slot
    craft() {
        const result = this.craftingResult;
        if (!result || !result.item) return null;

        const craftedItem = { ...result };

        // Consume ingredients
        // We need to find the specific items used.
        // Since we did a loose match, we just remove 1 from each slot that matches an ingredient.
        // We must re-find the recipe to be sure which ingredients to remove.
        // Actually, since we only support loose match, we just iterate ingredients and decrement matching slots.

        // Find the recipe again to know what to consume
        // (Optimization: store currentRecipe index in this)

        // Naively consume:
        // This is tricky if multiple recipes use same items. We assume checkRecipe just ran.
        // We have to assume the visual state matches logic.

        // Let's iterate all recipes again to be safe:
        // (Code duplicated from checkRecipe basically)
        const currentItems = {};
        for (const slot of this.craftingSlots) {
            if (slot.item) currentItems[slot.item] = (currentItems[slot.item] || 0) + 1;
        }

        let recipe = null;
        for (const r of this.recipes) {
            let match = true;
            let recipeItemsCount = 0;
            for (const ing of r.ingredients) {
                if ((currentItems[ing.item] || 0) < ing.count) { match = false; break; }
                recipeItemsCount += ing.count;
            }
            // Count total atoms
            let totalGrid = 0;
            this.craftingSlots.forEach(s => { if (s.item) totalGrid++; });

            if (match && totalGrid === recipeItemsCount && r.result.item === result.item) {
                recipe = r;
                break;
            }
        }

        if (!recipe) return null; // Should not happen if UI is synced

        // Consume
        for (const ing of recipe.ingredients) {
            let toRemove = ing.count; // Number of SLOTS to decrement
            for (let i = 0; i < this.craftingSlots.length; i++) {
                if (this.craftingSlots[i].item === ing.item && toRemove > 0) {
                    this.craftingSlots[i].count--;
                    if (this.craftingSlots[i].count <= 0) {
                        this.craftingSlots[i] = { item: null, count: 0, type: null };
                    }
                    toRemove--;
                }
            }
        }

        // Re-check recipe for next craft
        this.checkRecipe();

        return craftedItem;
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
