/**
 * InventoryManager - Handles inventory state and crafting logic.
 * Decoupled from UI.
 */
export class InventoryManager {
    constructor(game) {
        this.game = game;

        // 36 Slots: 0-8 Hotbar, 9-35 Storage
        this.slots = new Array(36).fill(null).map(() => ({ item: null, count: 0, type: null }));
        this.selectedSlot = 0;

        // Crafting Recipes (Simple list for now)
        this.recipes = [
            { result: { item: 'wood', count: 4, type: 'block' }, ingredients: [{ item: 'log', count: 1 }] },
            { result: { item: 'stick', count: 4, type: 'item' }, ingredients: [{ item: 'wood', count: 2 }] },
            // Add more later
        ];

        // Initial Layout
        this.setupInitialItems();
    }

    setupInitialItems() {
        this.addItemToSlot(0, 'pickaxe', 1, 'tool');
        this.addItemToSlot(1, 'crafting_table', 1, 'block');
        this.addItemToSlot(2, 'sword', 1, 'tool');
        this.addItemToSlot(3, 'wand', 1, 'wand');
    }

    addItemToSlot(index, item, count, type) {
        if (index >= 0 && index < this.slots.length) {
            this.slots[index] = { item, count, type };
        }
    }

    // --- Core Actions ---

    selectSlot(index) {
        if (index >= 0 && index < 9) {
            this.selectedSlot = index;
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

        const fromSlot = this.slots[fromIndex];
        const toSlot = this.slots[toIndex];

        if (!fromSlot.item) return;

        // If count is not specified, move entire stack
        const amount = count || fromSlot.count;

        // Case 1: Target is empty
        if (!toSlot.item) {
            if (amount === fromSlot.count) {
                // Move all
                this.slots[toIndex] = { ...fromSlot };
                this.slots[fromIndex] = { item: null, count: 0, type: null };
            } else {
                // Split
                this.slots[toIndex] = { ...fromSlot, count: amount };
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
                this.slots[fromIndex] = { item: null, count: 0, type: null };
            }
            return;
        }

        // Case 3: Target is different -> Swap (only if moving full stack)
        if (amount === fromSlot.count) {
            const temp = { ...toSlot };
            this.slots[toIndex] = { ...fromSlot };
            this.slots[fromIndex] = temp;
        }
    }

    // Crafting
    canCraft(recipe) {
        // Check ingredients
        for (const ing of recipe.ingredients) {
            if (this.getItemCount(ing.item) < ing.count) return false;
        }
        return true;
    }

    craft(recipe) {
        if (!this.canCraft(recipe)) return false;

        // Remove ingredients
        for (const ing of recipe.ingredients) {
            let toRemove = ing.count;
            for (let i = 0; i < this.slots.length; i++) {
                if (this.slots[i].item === ing.item) {
                    const take = Math.min(this.slots[i].count, toRemove);
                    this.slots[i].count -= take;
                    toRemove -= take;
                    if (this.slots[i].count <= 0) this.slots[i] = { item: null, count: 0, type: null };
                    if (toRemove <= 0) break;
                }
            }
        }

        // Add result
        this.addItem(recipe.result.item, recipe.result.count, recipe.result.type);
        return true;
    }
}
