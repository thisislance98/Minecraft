
// Mock InventoryManager
class MockManager {
    constructor() {
        this.slots = new Array(36).fill(null).map(() => ({ item: null, count: 0, type: null }));
    }

    getSlot(index) {
        return this.slots[index];
    }

    addItemToSlot(index, item, count, type) {
        this.slots[index] = { item, count, type };
    }
}

// Test Context
const manager = new MockManager();
const context = {
    manager: manager,
    draggedItem: null,
    dragStartSlot: null,

    // The method we want to test (pasted from Inventory.js with valid 'this' binding)
    placeItemIntoSlot: function (index, isShift) {
        // Mock method content from Inventory.js
        const slot = this.manager.getSlot(index);
        if (!slot || !this.draggedItem) return;

        if (isShift) {
            // Shift click logic (simplified/omitted as irrelevant to test)
            // We are testing normal swap
        } else {
            // Place All (Normal)
            if (slot.item === null) {
                // Place into empty
                this.manager.addItemToSlot(index, this.draggedItem.item, this.draggedItem.count, this.draggedItem.type);
                this.draggedItem = null;
            } else if (slot.item === this.draggedItem.item) {
                // Stack
                // Omitted for test focus
            } else {
                // Swap - THIS IS THE LOGIC WE CHANGED
                const temp = { ...slot };
                this.manager.addItemToSlot(index, this.draggedItem.item, this.draggedItem.count, this.draggedItem.type);

                // NEW LOGIC
                if (this.dragStartSlot !== null && this.dragStartSlot !== 109) {
                    const startSlot = this.manager.getSlot(this.dragStartSlot);
                    if (!startSlot || !startSlot.item) {
                        this.manager.addItemToSlot(this.dragStartSlot, temp.item, temp.count, temp.type);
                        this.draggedItem = null;
                    } else {
                        this.draggedItem = temp;
                    }
                } else {
                    this.draggedItem = temp;
                }
            }
        }
    }
};

// Test Case 1: Valid Swap
console.log('Test 1: Normal Swap');
// Setup
manager.addItemToSlot(0, 'dirt', 10, 'block'); // Origin
manager.addItemToSlot(1, 'stone', 5, 'block'); // Target
// Simulate Pick up from 0
context.draggedItem = { item: 'dirt', count: 10, type: 'block' };
context.dragStartSlot = 0;
manager.slots[0] = { item: null, count: 0, type: null }; // Cleared from source

// Execute Drop on 1
context.placeItemIntoSlot(1, false);

// Verify
const slot0 = manager.getSlot(0);
const slot1 = manager.getSlot(1);

if (slot1.item === 'dirt' && slot0.item === 'stone' && context.draggedItem === null) {
    console.log('PASS: Items swapped, cursor empty.');
} else {
    console.error('FAIL: ', { slot0, slot1, cursor: context.draggedItem });
}

// Test Case 2: Source Occupied (Logic fallback)
console.log('\nTest 2: Source Occupied (Fallback)');
// Setup
manager.addItemToSlot(0, 'wood', 1, 'block'); // Source got filled by something else?
manager.addItemToSlot(1, 'stone', 5, 'block'); // Target
context.draggedItem = { item: 'dirt', count: 10, type: 'block' }; // We are holding dirt from 0
context.dragStartSlot = 0;

// Execute Drop on 1
context.placeItemIntoSlot(1, false);

// Verify
const slot0_T2 = manager.getSlot(0);
const slot1_T2 = manager.getSlot(1);

if (slot1_T2.item === 'dirt' && slot0_T2.item === 'wood' && context.draggedItem.item === 'stone') {
    console.log('PASS: Target updated, source untouched, cursor holds swapped item.');
} else {
    console.error('FAIL: ', { slot0: slot0_T2, slot1: slot1_T2, cursor: context.draggedItem });
}
