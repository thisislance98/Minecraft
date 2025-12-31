---
description: How to create a new item or wand
---

# Workflow: Create New Item

This guide details how to create new items, specifically "Wands" which are the primary interactive items in this codebase.

## 1. Create the Item File
Create a new file in `src/game/items/[ItemName].js`.
The class should extend `Item` (or `WandItem` if available, otherwise base `Item`).

**Template:**
```javascript
import { Item } from './Item.js';

export class [ItemName] extends Item {
    constructor() {
        super('[item_id]', '[Item Name]'); 
        // id should be lowercase snake_case
        // Name is display name
    }

    /**
     * Handle Right-Click (Use)
     */
    onUseDown(game, player) {
        console.log('Used [ItemName]');
        
        // Example: Play sound
        // game.soundManager.playSound('magic_spell', player.position);
        
        // Example: Spawn something
        // game.spawnManager.spawnEntity(...)
        
        return true; // Return true if handled (prevents default block placement)
    }
}
```

## 2. Register the Item
You MUST register the new item in `src/game/ItemRegistry.js` (or wherever `ItemRegistry` is located, often `src/game/ItemRegistry.js`).

1.  **Import**: Add `import { [ItemName] } from './items/[ItemName].js';`
2.  **Export**: Add `[ItemName]` to the exported list.
3.  **Instantiate**: Ensure an instance is added to the game's item list or `ItemRegistry` map if applicable.

## 3. Give to Player
To test, you usually need to add it to the player's inventory or hotbar.
Check `src/game/entities/Player.js` or `Inventory.js` where initial items are granted.
Or use the Debug Console to grant it.

## 4. Verify
1.  Open game.
2.  Ensure item appears in hotbar/inventory.
3.  Select item.
4.  Right-click to trigger `onUseDown`.
