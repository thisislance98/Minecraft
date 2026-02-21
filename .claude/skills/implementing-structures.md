# Skill: Implementing Structures (Buildings / Minigames)

## Overview
Structures are AI-generated JavaScript code that produces an array of block placements `{x, y, z, id}`. They are built in front of the player by placing individual blocks in the voxel world. The system can create houses, towers, bridges, pixel art, arenas, and any other block-based structure.

## Architecture

### Full Lifecycle
1. **User Request** - Player types in the Merlin panel (e.g., "build a castle")
2. **Category Resolution** - Routed to `handleCreateStructure()` via the `build` category button or semantic similarity
3. **Prompt Building** - `getStructurePrompt()` in `server/ai/few_shot_prompts.ts` selects best examples and includes available block types
4. **AI Generation** - OpenRouter API call with `create_structure` tool for structured output (code string)
5. **Code Execution** - Server executes the code in a sandboxed `new Function()` with `playerPosition` context
6. **Block Placement** - Resulting blocks array is sent to client via `set_blocks` tool in batches of 100
7. **World Update** - Client places blocks in the voxel world

### Key Files

| File | Purpose |
|------|---------|
| `server/ai/examples/structures.ts` | Few-shot examples (SimpleHouse, Tower, Sphere, Bridge, Pyramid, ColoredSphere) |
| `server/ai/few_shot_prompts.ts` | `getStructurePrompt()` - builds prompt with block types & examples |
| `server/ai/few_shot_tools.ts` | `getStructureTools()` - tool schema for structured output |
| `server/ai/few_shot_system.ts` | `FewShotAI.handleCreateStructure()` + `executeStructureCode()` |
| `server/services/FewShotSession.ts` | WebSocket handler, places blocks in batches |
| `src/world/StructureGenerator.js` | Client-side static structure generation (different from AI system) |

## Structure Code Pattern

The AI generates JavaScript that:
1. Uses `playerPosition` (a `{x, y, z}` object) to position relative to player
2. Creates a `blocks` array of `{x, y, z, id}` objects
3. Returns the blocks array

```javascript
// Structure: Castle
const px = Math.floor(playerPosition.x) + 5;  // 5 blocks in front
const py = Math.floor(playerPosition.y);        // Ground level
const pz = Math.floor(playerPosition.z);

const blocks = [];

// Floor
for (let x = 0; x < 10; x++) {
    for (let z = 0; z < 10; z++) {
        blocks.push({ x: px + x, y: py, z: pz + z, id: 'stone_brick' });
    }
}

// Walls
for (let y = 1; y <= 5; y++) {
    for (let x = 0; x < 10; x++) {
        blocks.push({ x: px + x, y: py + y, z: pz, id: 'stone_brick' });
        blocks.push({ x: px + x, y: py + y, z: pz + 9, id: 'stone_brick' });
    }
}

return blocks;
```

## Available Block Types

### Basic
`stone`, `cobblestone`, `stone_brick`, `mossy_stone`, `grass`, `dirt`, `sand`, `sandstone`, `gravel`, `clay`

### Wood
`log`, `plank`, `fence`, `birch_wood`, `pine_wood`, `dark_oak_wood`

### Transparent
`glass`

### Building
`brick`

### Wool (colored - for patterns/art)
`wool_white`, `wool_red`, `wool_orange`, `wool_yellow`, `wool_green`, `wool_blue`, `wool_purple`, `wool_pink`, `wool_black`, `wool_gray`, `wool_brown`, `wool_cyan`

### Concrete (smoother colored blocks)
`concrete_white`, `concrete_red`, `concrete_orange`, `concrete_yellow`, `concrete_green`, `concrete_blue`, `concrete_purple`, `concrete_pink`, `concrete_black`, `concrete_gray`, `concrete_brown`, `concrete_cyan`

### Special
`gold_block`, `diamond_block`, `obsidian`, `glowstone`, `water`, `snow`

### Removal
`air` - Use to remove/clear blocks

## Building Tips

- **Floor**: Place at `py` (player Y level)
- **Walls**: Build upward from `py + 1`
- **Doors**: Leave openings 3 blocks high, 1-2 wide
- **Windows**: Use `glass` blocks in walls
- **Hollow interiors**: Use `air` blocks or only place outer shell
- **Circular shapes**: Use `Math.sqrt(x*x + z*z) <= radius` distance check
- **Spheres**: Use `Math.sqrt(x*x + y*y + z*z)` for 3D distance
- **Hollow shells**: Check `dist >= radius - 1 && dist <= radius`
- **Colored structures**: Use `concrete_COLOR` or `wool_COLOR`
- **Spiral stairs**: Use `sin/cos` in a loop with incrementing y

## Structure Examples

### House Pattern
```javascript
// Walls with door opening
for (let y = 1; y <= height; y++) {
    for (let x = 0; x < width; x++) {
        if (!(x === 3 && y <= 2)) {  // Door opening
            blocks.push({ x: px + x, y: py + y, z: pz, id: 'plank' });
        }
    }
}
```

### Circular Tower Pattern
```javascript
for (let y = 0; y <= height; y++) {
    for (let x = -radius; x <= radius; x++) {
        for (let z = -radius; z <= radius; z++) {
            const dist = Math.sqrt(x * x + z * z);
            if (dist >= radius - 1 && dist <= radius) {
                blocks.push({ x: px + x, y: py + y, z: pz + z, id: 'stone_brick' });
            }
        }
    }
}
```

### Sphere Pattern
```javascript
for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
        for (let z = -radius; z <= radius; z++) {
            const dist = Math.sqrt(x*x + y*y + z*z);
            if (dist >= radius - 1 && dist <= radius) {  // Hollow
                blocks.push({ x: cx+x, y: cy+y, z: cz+z, id: 'concrete_red' });
            }
        }
    }
}
```

### Pyramid Pattern
```javascript
for (let y = 0; y < Math.ceil(baseSize / 2); y++) {
    const layerSize = baseSize - (y * 2);
    const offset = y;
    for (let x = 0; x < layerSize; x++) {
        for (let z = 0; z < layerSize; z++) {
            blocks.push({ x: px+offset+x, y: py+y, z: pz+offset+z, id: 'sandstone' });
        }
    }
}
```

## Execution Context

The generated code runs in a sandboxed `new Function('playerPosition', code)`:
- `playerPosition` is the only injected variable: `{ x: number, y: number, z: number }`
- Actually uses `targetPosition` (ground level in front of player) for correct placement
- Code must `return blocks` at the end
- No access to `game`, `THREE`, or other objects - structures are purely block-based

## Block Placement (Client Side)

Blocks are placed via the `set_blocks` client tool in `FewShotSession`:
```typescript
// Placed in batches of 100 for performance
const batchSize = 100;
for (let i = 0; i < blocks.length; i += batchSize) {
    const batch = blocks.slice(i, i + batchSize);
    await this.executeClientTool('set_blocks', { blocks: batch });
}
```

## Adding New Few-Shot Examples

Edit `server/ai/examples/structures.ts`:

```typescript
export const structureExamples = [
    {
        name: "MyStructure",
        description: "Description for semantic matching",
        keywords: ["keyword1", "keyword2", ...],
        code: `// Structure code
const px = Math.floor(playerPosition.x) + 5;
const py = Math.floor(playerPosition.y);
const pz = Math.floor(playerPosition.z);
const blocks = [];
// ... generate blocks
return blocks;`
    },
    // ... existing examples
];
```

Also update `availableBlocks` array in the same file if new block types are added to the game.

## Minigames / Territory System

There is an experimental Territory system for more complex game modes:

| File | Purpose |
|------|---------|
| `src/game/systems/Territory.js` | Territory definition and boundaries |
| `src/game/systems/TerritoryManager.js` | Manages active territories |
| `src/game/systems/TerritoryVisuals.js` | Visual rendering of territory bounds |
| `src/game/systems/TerritoryCodeLoader.js` | Loads custom code for territory behaviors |

Territories can define bounded areas with custom rules, but this is still experimental. For now, the primary way to create "minigames" is through:
1. **Structures** - Build arenas, obstacle courses, mazes, etc.
2. **Creatures** - Add hostile/friendly NPCs with custom AI
3. **Items** - Create special weapons, power-ups, or game tools
4. Combine all three for a complete game experience

## Structures vs Static StructureGenerator

- **AI Structures** (this system): Generated on-demand via Merlin panel, run on server, blocks sent to client
- **Static StructureGenerator** (`src/world/StructureGenerator.js`): Generates structures during world creation (trees, terrain features). Not used for AI-generated content.

## Multiplayer Sync

### Structures Are Fully Multiplayer-Compatible

Structures are the most multiplayer-friendly category — every block placed is automatically broadcast and persisted:

| Event | Mechanism | Persisted? |
|-------|-----------|-----------|
| **Each block placed** | `game.setBlock()` → Socket.IO `block:change` | Yes (Firebase) |
| **Each block cleared** | `game.setBlock(x,y,z, null)` → Socket.IO `block:change` | Yes (Firebase) |

### Late-Joining Players

When a new player joins, they receive ALL persisted block changes via `blocks:initial` event. This means structures built by Merlin are **permanently visible** to everyone, including players who join later.

### No Action Needed for Structures

The `FewShotClient.handleSetBlocks()` method calls `game.setBlock()` which automatically broadcasts each block change via Socket.IO and persists it in Firebase. No extra multiplayer code is needed.

## Testing

Test via the Merlin panel in-game by selecting the "Build" category:
- "build a house"
- "make a tower"
- "create a red sphere"
- "build a bridge"

Verify blocks are placed correctly relative to player position.
