
// Simple mock of InventoryManager to test logic in isolation
// We essentially copy the relevant logic here to test it, or we could import it if we handle ES modules correctly.
// Given node execution, let's try to import the actual file.

import { InventoryManager } from './src/game/systems/InventoryManager.js';

// Mock Game object
const mockGame = {
    itemManager: {
        getItem: () => ({})
    },
    inventory: {
        renderHotbar: () => { },
        renderInventoryScreen: () => { }
    },
    player: {
        updateHeldItemVisibility: () => { }
    }
};

const inventory = new InventoryManager(mockGame);

// Manual setup to clear inventory for test
inventory.slots = new Array(63).fill(null).map(() => ({ item: null, count: 0, type: null }));

console.log("--- TEST START ---");

// Helper to fill main inventory but leave hotbar empty
// Hotbar: 0-8
// Main: 9-62
function setupScenario() {
    // Clear all
    inventory.slots = new Array(63).fill(null).map(() => ({ item: null, count: 0, type: null }));

    // Add item to main inventory (slot 10)
    inventory.addItemToSlot(10, 'dirt', 10, 'block');

    // Hotbar is empty
}

setupScenario();
console.log("Scenario: Dirt in main inventory (slot 10), Hotbar empty.");
console.log("Action: Add 'dirt'.");

// Current behavior expect: Stacks in slot 10
inventory.addItem('dirt', 1, 'block');

if (inventory.slots[0].item === 'dirt') {
    console.log("RESULT: Added to Hotbar slot 0. (New Behavior / Desired)");
} else if (inventory.slots[10].count === 11) {
    console.log("RESULT: Stacked in Main Inventory slot 10. (Old Behavior)");
} else {
    console.log("RESULT: Unknown behavior.");
}

// Check if hotbar full behavior works
console.log("\nScenario: Hotbar full, dirt in main inventory.");
// Fill hotbar
for (let i = 0; i < 9; i++) {
    inventory.addItemToSlot(i, 'stone', 64, 'block');
}
inventory.addItemToSlot(10, 'dirt', 10, 'block'); // reset dirt

inventory.addItem('dirt', 1, 'block');
if (inventory.slots[10].count === 11) {
    console.log("RESULT: correctly stacked in main inventory when hotbar full.");
} else {
    console.log("RESULT: failed to stack in main inventory.");
}

