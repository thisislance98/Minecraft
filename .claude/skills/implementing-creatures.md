# Skill: Implementing Creatures

## Overview
Creatures (animals/monsters) are AI-generated JavaScript classes that extend `Animal` and are built using THREE.js geometry. They are created via the Merlin AI panel (few-shot system), persisted in Firebase, and dynamically loaded on clients via Socket.IO.

## Architecture

### Full Lifecycle
1. **User Request** - Player types in the Merlin panel (e.g., "make a fire dragon")
2. **Category Resolution** - `FewShotSession` routes to `handleCreateCreature()` via the `creature` category button (or semantic similarity for "custom")
3. **Prompt Building** - `getCreaturePrompt()` in `server/ai/few_shot_prompts.ts` selects best few-shot examples via semantic search
4. **AI Generation** - OpenRouter API call with `create_creature` tool for structured output (className + code)
5. **Validation** - Code validated for: extends Animal, has createBody(), uses THREE.js, adds to this.mesh
6. **Server Storage** - `DynamicCreatureService.saveCreature()` stores in Firebase (`dynamic_creatures` collection or `worlds/{worldId}/creatures`)
7. **Broadcast** - Socket.IO emits `creature_definition` to all clients in scope
8. **Client Registration** - `DynamicCreatureRegistry.registerDynamicCreature()` uses `new Function()` to create the class, registers in `AnimalClasses`
9. **Spawning** - `SpawnManager` spawns the creature using the registered class

### Key Files

| File | Purpose |
|------|---------|
| `server/ai/examples/creatures.ts` | Few-shot example creatures (e.g., VoxelDragon) |
| `server/ai/few_shot_prompts.ts` | `getCreaturePrompt()` - builds the system prompt with examples |
| `server/ai/few_shot_tools.ts` | `getCreatureTools()` - tool schema for structured output |
| `server/ai/few_shot_system.ts` | `FewShotAI.handleCreateCreature()` - main handler |
| `server/services/FewShotSession.ts` | WebSocket handler, saves creature & spawns it |
| `server/services/DynamicCreatureService.ts` | Firebase persistence, caching, broadcasting |
| `src/game/core/DynamicCreatureRegistry.js` | Client-side: evaluates code, registers in AnimalClasses |
| `src/game/core/AnimalRegistry.js` | Central registry of all creature classes (`AnimalClasses`) |
| `src/game/entities/Animal.js` | Base `Animal` class all creatures extend |
| `src/game/systems/SpawnManager.js` | Handles spawning creatures in the world |
| `src/game/systems/EntityManager.js` | Manages active creature instances |

### Creature Class Requirements

A creature class MUST:
- **Extend `Animal`** - `class MyCreature extends Animal { ... }`
- **Have a constructor** calling `super(game, x, y, z, seed)`
- **Implement `createBody()`** - builds the 3D mesh using THREE.js primitives
- **Add meshes to `this.mesh`** - `this.mesh.add(someGroup)`

### Constructor Properties
```javascript
constructor(game, x, y, z, seed) {
    super(game, x, y, z, seed);
    // Physical size
    this.width = 1.0;
    this.height = 1.0;
    this.depth = 1.0;
    // Movement
    this.speed = 2.0;
    // Health
    this.health = 10;
    this.maxHealth = 10;
    // Combat
    this.isHostile = false;
    this.damage = 0;
    this.detectionRange = 15;
    this.attackRange = 2;
    // Behavior
    this.canHop = false;        // Hop movement (bunny-like)
    this.fleeOnProximity = false; // Flee from player
    this.fleeRange = 8;
    this.gravity = 1;           // Set to 0 for flying creatures
}
```

### createBody() Pattern
```javascript
createBody() {
    const body = new THREE.Group();

    // Use BoxGeometry, CylinderGeometry, SphereGeometry (Minecraft-style)
    const bodyGeo = new THREE.BoxGeometry(1.0, 0.8, 1.5);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xFF0000 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = true;
    body.add(bodyMesh);

    // Store references for animation
    this.bodyGroup = body;
    this.mesh.add(body);
}
```

### Optional Overrides
- `update(dt)` - Custom per-frame behavior (call `super.update(dt)` first)
- `updateAI(dt)` - Custom AI behavior (call `super.updateAI(dt)` for defaults)
- `updatePhysics(dt)` - Override for flying creatures (skip gravity/ground collision)

### Flying Creatures
For any creature that flies (dragons, birds, bats, etc.), you **MUST read** `.claude/skills/implementing-flying-creatures.md`. Setting `this.gravity = 0` alone is NOT enough — flying creatures need custom flight movement code in `update()` and a `updatePhysics()` override. Without this, the creature will just sit on the ground.

### Helper Method Pattern (from VoxelDragon example)
```javascript
// Shorthand for creating colored boxes
V(w, h, d, c, e, ei) {
    const mat = new THREE.MeshStandardMaterial({
        color: c, roughness: 0.65, metalness: 0.15,
        emissive: e || 0, emissiveIntensity: ei || 0
    });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true;
    return m;
}
```

## Adding a New Few-Shot Example

Edit `server/ai/examples/creatures.ts`:

```typescript
export const creatureExamples = [
    {
        name: "MyCreature",
        description: "Description for semantic matching",
        keywords: ["keyword1", "keyword2", ...],
        code: `class MyCreature extends Animal {
            // ... full class code
        }`
    },
    // ... existing examples
];
```

The `keywords` and `description` fields are used by `SemanticSearch` to find the best matching examples for a user's request.

## Server-Side Validation

`DynamicCreatureService.validateCreatureCode()` checks:
1. Code contains `class ${name}`
2. Code contains `extends Animal`
3. Code contains `constructor`
4. Code contains `createBody`
5. No dangerous patterns: `eval(`, `fetch(`, `require(`, `import(`, `__proto__`, etc.

`FewShotAI.validateCreatureCode()` additionally checks:
1. Uses `THREE.` for mesh creation
2. Adds to `this.mesh`
3. No JavaScript syntax errors (via `new Function()` test)

## Scoping

- **Global creatures** (`worldId = 'global'`) - Available in all worlds, stored in `dynamic_creatures` Firebase collection
- **World-scoped creatures** (`worldId = specific`) - Only in that world, stored in `worlds/{worldId}/creatures`

## Multiplayer Sync

### What IS Automatically Broadcast to All Players

| Event | Mechanism | Persisted? |
|-------|-----------|-----------|
| **Creature definition** (class code) | Socket.IO `creature_definition` to all clients | Yes (Firebase) |
| **Creature spawn** (entity instance) | `SpawnManager.createAnimal()` → Socket.IO `entity:spawn` | Yes (Firebase) |
| **Creature position/state updates** | `Animal.checkSync()` → Socket.IO `entity:update` (periodic) | Yes |
| **Creature despawn** (edit/replace) | `FewShotClient.handleDespawnCreatures()` → Socket.IO `entity:remove` | Yes (removed from Firebase) |

### Late-Joining Players

When a new player joins a world, they automatically receive:
1. **Creature definitions** via `creatures_initial` event (from `DynamicCreatureService.sendCreaturesToSocket()`)
2. **Persisted entity instances** via `entities:initial` event (from `worldPersistence.getEntities()`)

This means late-joining players CAN see previously created creatures — both the class definition and any spawned instances.

### No Action Needed for Creatures

Creature creation is **fully multiplayer-compatible** out of the box. The `SpawnManager.createAnimal()` method automatically broadcasts the spawn via Socket.IO, and `Animal.checkSync()` handles ongoing position sync.

## Testing

Test via the Merlin panel in-game, or use the test CLI:
```bash
cd ai-test-cli && node tests/test_merlin_panel.cjs
```

Or test via curl to the WebSocket endpoint on port 2567.
