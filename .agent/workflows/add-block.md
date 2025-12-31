---
description: How to create a new block type
---

# Workflow: Create New Block

This guide details the process of adding a new block type to the game.

## 1. Define Block ID
Add a new entry to `src/game/core/Blocks.js`.
```javascript
export const Blocks = {
    // ...
    MY_NEW_BLOCK: 'my_new_block', // Use snake_case
};
```

## 2. Define Texture Properties
Textures are procedurally generated in `src/textures/TextureGenerator.js`.

1.  **Add Palette**: Add a color palette to the `palettes` object at the top of the file.
    ```javascript
    const palettes = {
        // ...
        my_new_block: ['#FF0000', '#AA0000'], // Example colors
    };
    ```
2.  **Add Generation Logic**: Add a case to the `switch(type)` in `generateTexture`.
    ```javascript
    case 'my_new_block':
        // Custom drawing logic or copy existing pattern
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                ctx.fillStyle = palettes.my_new_block[Math.floor(seededRandom(seed++) * palettes.my_new_block.length)];
                ctx.fillRect(x, y, 1, 1);
            }
        }
        break;
    ```

## 3. Register Material
Register the block in `src/game/core/AssetManager.js`.

1.  **Block Properties**: Add to `this.blockProperties` in the constructor (hardness, etc.).
    ```javascript
    this.blockProperties = {
        // ...
        'my_new_block': { hardness: 1.5 },
    };
    ```
2.  **Load/Register**: In `loadGeneratedTextures()`, generate the material and map it to the block ID.
    ```javascript
    const myMat = this.getOrCreateMat('my_new_block');
    // Map same material to all 6 faces
    this.registerBlockMaterials('my_new_block', myMat);
    
    // OR for custom sides:
    // this.registerBlockMaterials('my_new_block', [side, side, top, bottom, side, side]);
    ```

## 4. Verify
1.  Open the game.
2.  Open Debug Console or use `game.inventory.addItem('my_new_block', 64)` to get the block.
    *   Note: You might need to add it to `SpawnManager` or `StoreUI` to make it accessible normally.
3.  Place the block and verify texture/hardness.
