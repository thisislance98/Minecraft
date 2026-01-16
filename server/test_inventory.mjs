
import { InventoryManager } from '../src/game/systems/InventoryManager.js';

// Mock Game object
const mockGame = {
    itemManager: {
        getItem: () => null
    }
};

const inv = new InventoryManager(mockGame);

// Clear hotbar for testing (setupInitialItems fills it)
for (let i = 0; i < 9; i++) {
    inv.slots[i] = { item: null, count: 0, type: null };
}

// Case 1: Add new item, should go to Hotbar Slot 0
inv.addItem('dirt', 1);
if (inv.slots[0].item === 'dirt') {
    console.log('PASS: Item went to hotbar slot 0');
} else {
    console.log('FAIL: Item did not go to hotbar slot 0. Slot 0:', inv.slots[0]);
}

// Case 2: Fill hotbar, then add item to inventory, then clear a hotbar slot, and add item.
// Setup: Hotbar full of stone.
for (let i = 0; i < 9; i++) {
    inv.slots[i] = { item: 'stone', count: 64, type: 'block' };
}

// Add dirt -> should go to slot 9 (Main Inventory)
inv.addItem('dirt', 1);
if (inv.slots[9].item === 'dirt') {
    console.log('PASS: Item went to inventory slot 9 when hotbar full');
} else {
    console.log('FAIL: Item did not go to inventory slot 9. Slot 9:', inv.slots[9]);
}

// Clear Hotbar Slot 5
inv.slots[5] = { item: null, count: 0, type: null };

// Add dirt -> Should fill Hotbar Slot 5 (Priority 2) before Stacking in Inventory Slot 9 (Priority 3)??
// Wait, Priority 1 is Stack Hotbar. Priority 2 is Fill Hotbar. Priority 3 is Stack Inventory.
// If I collect 'dirt', and I have 'dirt' in Slot 9.
// Priority 1: Stack Hotbar (Fail, no dirt in hotbar)
// Priority 2: Fill Hotbar (Slot 5 is empty) -> SHOULD GO HERE.
// Priority 3: Stack Inventory (Slot 9 has dirt) -> Should NOT reach here if Priority 2 handles it.

inv.addItem('dirt', 1);

if (inv.slots[5].item === 'dirt') {
    console.log('PASS: Item filled empty hotbar slot 5 instead of stacking in inventory');
} else {
    console.log('FAIL: Item did NOT fill hotbar slot 5. It likely stacked in inventory.');
    console.log('Slot 5:', inv.slots[5]);
    console.log('Slot 9:', inv.slots[9]);
}

// Case 3: Undefined Slot - The suspected bug
// Force a slot to be undefined (simulating bad state)
inv.slots[6] = { item: undefined, count: 0, type: null }; // or just partial object

inv.addItem('stone', 1);
if (inv.slots[6].item === 'stone') {
    console.log('PASS: Item filled "undefined" item slot 6');
} else {
    console.log('FAIL: Item did NOT fill "undefined" item slot 6. It likely ignored it.');
    console.log('Slot 6:', inv.slots[6]);
}
