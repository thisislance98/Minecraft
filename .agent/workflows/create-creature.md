---
description: How to create a new creature or animal entity
---

# Workflow: Create New Creature

This guide details the process of adding a new creature/animal to the game.

## 1. Create the Creature File
Create a new file in `src/game/entities/animals/[CreatureName].js`.
The class should extend `Animal` and implement `createBody()`.

**Template:**
```javascript
import * as THREE from 'three';
import { Animal } from '../../Animal.js';

export class [CreatureName] extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        
        // 1. Set Dimensions (Hitbox)
        this.width = 0.8;
        this.height = 1.2;
        this.depth = 1.5;
        
        // 2. Build the visual mesh
        this.createBody();
        
        // 3. Optional: Customize Stats
        this.speed = 2.5;
        this.stateTimer = 0; // Initialize AI timer
    }

    createBody() {
        // Define Materials
        const mainColor = 0x888888; // Grey
        const mat = new THREE.MeshLambertMaterial({ color: mainColor });
        
        // Helper to add parts relative to (0,0,0) which is feet/center
        // Note: The parent `this.mesh` is positioned at entity coordinates.
        
        // Body
        const bodyGeo = new THREE.BoxGeometry(0.8, 0.6, 1.2);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.8, 0); // Lifted up
        this.mesh.add(body);
        
        // Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 1.3, 0.8); // Forward and up
        this.mesh.add(head);
        
        // Add legs, tail, eyes, etc...
    }
}
```

```

### 1.1 Special Case: Flying Entities
If your creature needs to fly (e.g. Birds, Fireflies, Dragons), you **must** override `updatePhysics(dt)` to disable the default gravity logic found in the base `Animal` class.

**Flight Template:**
```javascript
    updateAI(dt) {
         // ... custom movement logic setting this.position ...
    }

    updatePhysics(dt) {
        // Override base Animal physics to disable gravity
        // Leave empty or implement custom collision logic
    }
```

## 2. Register the Creature

You MUST register the new class in `src/game/AnimalRegistry.js` for it to be recognized by the spawning system and HMR.

1.  **Import**: Add `import { [CreatureName] } from './entities/animals/[CreatureName].js';`
2.  **Export**: Add `[CreatureName]` to the named exports list.
3.  **Map**: Add `[CreatureName]` to the `AnimalClasses` object.

## 3. Configure Spawning (Optional)
To make the creature spawn naturally in the world, edit `src/game/systems/SpawnManager.js`.

1.  **Import**: Add `[CreatureName]` to the import list from `../AnimalRegistry.js`.
2.  **Biome Config**: Add an entry to `this.biomeSpawnConfig` for the desired biome(s).
    ```javascript
    // In e.g. PLAINS array:
    { class: [CreatureName], weight: 0.1, packSize: [2, 4] },
    ```
    *   `weight`: Probability logic (relative to other entries in that biome list).
    *   `packSize`: Min/Max count per spawn event.

## 4. Verify
1.  Open the game.
2.  Open the Debug Panel (backtick ` or ~ key).
3.  Use the "Spawn Entity" dropdown to manually spawn your new creature to test its appearance and physics.

## 5. Advanced Movement & Physics
For complex locomotion (e.g., snake-like segmented movement, multi-block vehicles), checks the **Knowledge Base** or reference existing complex entities.

*   **Segmented Movement**: See `src/game/entities/monsters/DuneWorm.js` or `src/game/entities/animals/SegmentedWorm.js` for `positionHistory` implementation.
*   **Knowledge Path**: `knowledge/minecraft_voxel_engine/artifacts/entities/entity_system.md`

