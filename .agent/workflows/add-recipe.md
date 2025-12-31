---
description: How to add a new crafting recipe
---

# Workflow: Add Crafting Recipe

This guide details how to add new crafting recipes to the game.

## 1. Locate Inventory Manager
Open `src/game/systems/InventoryManager.js`.

## 2. Add Recipe Entry
Find the `this.recipes` array in the `constructor`.
Add a new object to the array.

**Format:**
```javascript
{ 
    result: { item: '[ResultItemID]', count: [Count], type: '[block|item|tool]' }, 
    ingredients: [
        { item: '[IngredientID_1]', count: [Count] },
        { item: '[IngredientID_2]', count: [Count] }
    ] 
}
```

**Example:**
```javascript
// Create a "Super Sword" from 2 Diamonds and 1 Stick
{ 
    result: { item: 'super_sword', count: 1, type: 'tool' }, 
    ingredients: [
        { item: 'diamond', count: 2 },
        { item: 'stick', count: 1 }
    ] 
},
```

## 3. Limits
*   The current system uses **shapeless** crafting (bag of ingredients).
*   It checks if you have *enough* of the items in the grid, regardless of position.
*   Ensure ingredient IDs match `Blocks.js` or registered items.

## 4. Verify
1.  Open game.
2.  Open Crafting Table (Press E or use Table).
3.  Place ingredients in grid.
4.  Check if result appears.
