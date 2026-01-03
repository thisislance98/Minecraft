---
description: Quick reference for the Minecraft voxel engine codebase - key files and functions
---

# Codebase Overview

## Directory Structure

```
src/
├── game/
│   ├── VoxelGame.jsx          # Main game class, handles scene, camera, game loop
│   ├── AnimalRegistry.js      # Static registry of all creature classes
│   ├── DynamicCreatureRegistry.js  # Runtime-created creatures from AI
│   ├── ItemRegistry.js        # Static registry of all item classes
│   ├── DynamicItemRegistry.js # Runtime-created items from AI
│   │
│   ├── core/
│   │   ├── Blocks.js          # Block type constants (Blocks.LOG, Blocks.LEAVES, etc.)
│   │   ├── AssetManager.js    # Textures, materials, block properties
│   │   ├── Config.js          # Game constants (gravity, speeds)
│   │   └── GameState.js       # Global game state
│   │
│   ├── systems/
│   │   ├── PhysicsManager.js  # Block breaking, raycasting, tree felling
│   │   ├── InputManager.js    # Keyboard/mouse input handling
│   │   ├── SpawnManager.js    # Entity spawning logic and biome config
│   │   ├── EntityManager.js   # Entity lifecycle management
│   │   ├── InventoryManager.js # Player inventory
│   │   ├── UIManager.js       # All UI panels and HUD
│   │   ├── SoundManager.js    # Audio playback
│   │   ├── Environment.js     # Sky, lighting, day/night cycle
│   │   ├── WeatherSystem.js   # Rain, snow, lightning
│   │   └── WaterSystem.js     # Water flow/propagation
│   │
│   ├── entities/
│   │   ├── Animal.js          # Base class for ALL creatures
│   │   ├── Player.js          # Player entity
│   │   ├── Drop.js            # Dropped item entities
│   │   ├── animals/           # 96+ creature implementations
│   │   │   └── FallingTree.js # Tree falling animation entity
│   │   ├── projectiles/       # Arrow, MagicProjectile, etc.
│   │   └── monsters/          # Hostile mob implementations
│   │
│   ├── items/
│   │   ├── Item.js            # Base item class
│   │   └── [Various]Item.js   # Wands, tools, special items
│   │
│   └── ui/
│       ├── Inventory.js       # Inventory UI
│       └── SpawnUI.js         # Spawn panel UI
│
├── world/
│   ├── Chunk.js               # Block storage and mesh generation (16x16x16)
│   ├── WorldGenerator.js      # Terrain generation orchestrator
│   ├── TerrainGenerator.js    # Height maps, biomes
│   ├── StructureGenerator.js  # Trees, houses, structures
│   └── BiomeManager.js        # Biome definitions
│
└── textures/
    └── TextureGenerator.js    # Procedural texture generation
```

---

## Key Systems Reference

### Block Breaking and Tree Felling
**File:** `src/game/systems/PhysicsManager.js`

| Function | Description |
|----------|-------------|
| `breakBlock()` | Initiates block breaking animation |
| `applySwingImpact()` | Handles damage/break logic when swing hits |
| `checkAndFellTree(x, y, z, logType)` | **Tree felling logic** - BFS to find connected logs/leaves, creates FallingTree entity |
| `getTargetBlock()` | Raycast to find block player is looking at |
| `getHitAnimal()` | Raycast to find animal player is looking at |
| `placeBlock()` | Place block from inventory |

**Tree Felling Logic (lines 361-480):**
- Checks if block below is NOT a log (base of tree)
- BFS to find all connected logs + leaves (max 200 blocks)
- If valid tree (>3 blocks with leaves): creates FallingTree entity
- Otherwise: just drops the single block

### Chunk and Block System
**File:** `src/world/Chunk.js`

| Function | Description |
|----------|-------------|
| `getBlock(lx, ly, lz)` | Get block type at local coords |
| `setBlock(lx, ly, lz, type)` | Set block type at local coords |
| `buildMesh()` | Generate optimized mesh with face culling |

**File:** `src/game/VoxelGame.jsx` (World API)

| Function | Description |
|----------|-------------|
| `getBlockWorld(x, y, z)` | Get block at world coordinates |
| `setBlock(x, y, z, type)` | Set block at world coordinates |
| `spawnDrop(x, y, z, blockType)` | Spawn dropped item entity |
| `updateChunks()` | Rebuild affected chunk meshes |

### Entity System
**File:** `src/game/entities/Animal.js` (Base class)

| Property/Method | Description |
|-----------------|-------------|
| `position` | THREE.Vector3 world position |
| `velocity` | THREE.Vector3 velocity |
| `mesh` | THREE.Group containing visual meshes |
| `width`, `height`, `depth` | Hitbox dimensions |
| `speed` | Movement speed |
| `health` | Current health |
| `createBody()` | Override to build visual mesh |
| `updateAI(dt)` | Override for custom AI behavior |
| `updatePhysics(dt)` | Physics update (override for flying) |
| `update(dt)` | Main update loop |
| `takeDamage(amount, attacker)` | Apply damage |

**Physics Modes in Animal.js:**
- `updateWalkerPhysics(dt)` - Ground-based movement with collision
- `updateHopperPhysics(dt)` - Jump-based movement (frogs, rabbits)
- Override `updatePhysics()` for flying entities

### Block Types
**File:** `src/game/core/Blocks.js`

Common block constants:
```javascript
Blocks.GRASS, Blocks.DIRT, Blocks.STONE
Blocks.LOG, Blocks.LEAVES  // Oak
Blocks.PINE_WOOD, Blocks.PINE_LEAVES
Blocks.BIRCH_WOOD, Blocks.BIRCH_LEAVES
Blocks.DARK_OAK_WOOD, Blocks.DARK_OAK_LEAVES
Blocks.WILLOW_WOOD, Blocks.WILLOW_LEAVES
Blocks.ACACIA_WOOD, Blocks.ACACIA_LEAVES
Blocks.WATER, Blocks.SAND, Blocks.SNOW
```

---

## Common Modification Patterns

### To Modify Block Breaking Behavior
1. Edit `PhysicsManager.applySwingImpact()` for damage/breaking logic
2. Edit `PhysicsManager.checkAndFellTree()` for tree-specific behavior

### To Modify Entity Physics
1. For gravity/movement: Edit `Animal.updateWalkerPhysics()` or `updateHopperPhysics()`
2. For collision: Edit `Animal.moveWithCollision()` or `checkBodyCollision()`
3. For flying: Override `updatePhysics()` in the specific creature class

### To Add New Creature
See workflow: `.agent/workflows/create-creature.md`

### To Add New Block
See workflow: `.agent/workflows/add-block.md`

### To Modify Physics Constants
**File:** `src/game/core/Config.js`
- Gravity, player speed, jump height, etc.

---

## Global Access Points

The game instance exposes everything:
```javascript
// From browser console or within game code:
game.player           // Player entity
game.animals          // Array of all animals
game.projectiles      // Array of all projectiles
game.chunks           // Map of all loaded chunks
game.scene            // THREE.js scene
game.camera           // THREE.js camera
game.physics          // PhysicsManager instance
game.spawnManager     // SpawnManager instance
game.assetManager     // AssetManager instance
```
