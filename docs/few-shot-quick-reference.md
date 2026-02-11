# Few-Shot AI Quick Reference

Quick reference card for developers working with the Few-Shot AI system.

## Component Locations

```
server/
├── ai/
│   ├── few_shot_system.ts      # Core engine (routing, generation, validation)
│   ├── few_shot_prompts.ts     # Prompt templates for each category
│   ├── few_shot_tools.ts       # Tool definitions for LLM routing
│   └── examples/
│       ├── creatures.ts         # Creature examples & keyword matching
│       ├── items.ts             # Item examples & keyword matching
│       └── structures.ts        # Structure examples & available blocks
├── services/
│   └── FewShotSession.ts       # WebSocket handler & message router
└── routes/
    └── ai.ts                    # HTTP test endpoints

src/game/
├── ai/
│   └── TaskManager.js           # Client task queue & context gathering
└── entities/
    └── Agent.js                 # Client tool executor (spawn/build/give)
```

## Message Protocol

### Client → Server

```javascript
// User input
{
  type: 'input',
  text: 'create a fire dragon',
  taskId: 'task_123',
  context: {
    x: 0, y: 64, z: 0,          // Player position
    dirX: 0, dirZ: 1,             // Forward direction
    targetX: 10, targetZ: 0,      // Target position (10 blocks ahead)
    targetGroundY: 64,            // Ground level at target
    worldId: 'world_1'
  }
}

// Change model
{ type: 'set_model', model: 'anthropic/claude-haiku-4.5' }

// Get available models
{ type: 'get_models' }

// Stop generation
{ type: 'interrupt' }

// Tool response (client executed tool)
{ type: 'tool_response', id: 'tool_123', result: { success: true } }
```

### Server → Client

```javascript
// Streamed text response
{ type: 'token', text: 'Creating dragon...', taskId: 'task_123' }

// Processing indicator
{ type: 'thinking', message: 'Generating code...' }

// Generated code display
{ type: 'code', code: '...', language: 'javascript', description: '...' }

// Request completed
{ type: 'complete', taskId: 'task_123' }

// Error occurred
{ type: 'error', message: 'Validation failed' }

// Model changed
{ type: 'model_changed', model: 'anthropic/claude-haiku-4.5' }

// Available models
{ type: 'models_list', models: [...], current: '...' }
```

## Request Flow

```
User → TaskManager → WebSocket → FewShotSession → FewShotAI → OpenRouter → FewShotAI → FewShotSession → WebSocket → TaskManager → Agent → Game
```

**Detailed Steps:**
1. User types request
2. TaskManager creates task, gathers context
3. Send via WebSocket to server
4. FewShotSession routes to FewShotAI
5. FewShotAI routes request (determine tool)
6. FewShotAI generates code (LLM + examples)
7. FewShotAI validates code
8. FewShotSession processes result
9. Stream response to client
10. TaskManager updates UI
11. Agent executes game actions
12. Game updates world state

## Common Operations

### Generate Creature
```javascript
// Client-side
taskManager.createTask('create a fire-breathing dragon', 'creature')

// Server processes:
// 1. Route → create_creature
// 2. Find examples (Dragon, Flying)
// 3. Generate class code
// 4. Validate (extends Animal, has createBody)
// 5. Save to DynamicCreatureService
// 6. Request spawn via client tool
// 7. Client spawns in front of player
```

### Generate Item
```javascript
// Client-side
taskManager.createTask('make a fire sword', 'item')

// Server processes:
// 1. Route → create_item
// 2. Find examples (Sword, Weapon)
// 3. Generate class + SVG icon
// 4. Validate (extends Item, has getMesh)
// 5. Save to DynamicItemService
// 6. Request give via client tool
// 7. Client adds to inventory (hotbar preferred)
```

### Build Structure
```javascript
// Client-side
taskManager.createTask('build a house', 'build')

// Server processes:
// 1. Route → create_structure
// 2. Find examples (House, Building)
// 3. Generate block placement code
// 4. Execute code safely (get blocks array)
// 5. Return blocks to client
// 6. Client places blocks in batches (100 at a time)
```

## Validation Rules

### Creatures
```javascript
✓ Must extend Animal
✓ Must have createBody() method
✓ Must use THREE.js (BoxGeometry, SphereGeometry, etc.)
✓ Must add meshes to this.mesh
✓ No syntax errors
```

### Items
```javascript
✓ Must extend Item or WandItem
✓ Must have getMesh() method
✓ Must call super(id, name) in constructor
✓ No syntax errors
⚠ Auto-fix: Add default getMesh() if missing
```

### Structures
```javascript
✓ Must return array of blocks
✓ Each block must have {x, y, z, id}
✓ Block IDs must be valid (from availableBlocks)
⚠ Skip invalid blocks, continue with valid
⚠ Size limit: 10,000 blocks max for fill operations
```

## Example Selection

### Algorithm
```javascript
findBestExamples(userRequest, count)
├── Extract keywords from request
│   "fire dragon" → ["fire", "dragon", "flying", "creature"]
├── Score each example
│   For each keyword match: score += 1
│   Priority keywords (first 2): score += 0.5 bonus
├── Sort by score (descending)
└── Return top N examples
```

### Adding Examples
```typescript
// server/ai/examples/creatures.ts
export const creatureExamples = [
    {
        name: "FireDragon",
        description: "A fierce fire-breathing dragon that flies",
        keywords: ["dragon", "fire", "flying", "hostile", "large"],
        code: `
class FireDragon extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 2.0;
        this.height = 2.5;
        this.depth = 3.0;
        this.speed = 3.0;
        this.health = 100;
        this.isHostile = true;
        this.damage = 15;
        this.gravity = 0; // Flying
    }

    createBody() {
        // ... THREE.js mesh creation
    }
}
        `
    }
];
```

## Testing

### HTTP Test Endpoints
```bash
# Test generation (no WebSocket needed)
curl -X POST http://localhost:5173/api/ai/fewshot/test \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "create a fire dragon",
    "model": "anthropic/claude-3-haiku"
  }'

# Find matching examples
curl -X POST http://localhost:5173/api/ai/fewshot/examples \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "fire dragon",
    "category": "creature"
  }'

# List available models
curl http://localhost:5173/api/ai/fewshot/models
```

### Debug Logging
```javascript
// Server logs (look for these in console)
[FewShotAI] Processing: "create a dragon" with model claude-3-haiku
[FewShotAI] Routed to tool: create_creature
[FewShotAI] Creature validation failed: [errors]
[FewShotAI] Result: {success: true, type: 'creature', ...}

// Client logs
[TaskManager] Created task task_123: create a dragon
[TaskManager] Starting task task_123
[TaskManager] Sending task to FewShotClient
[TaskManager] Task task_123 completed
[Agent] Executing Client Tool: spawn_creature
[Agent] Creature 'FireDragon' not in registry yet, waiting...
[Agent] Spawned 1 FireDragon
```

## Performance Tips

### Token Optimization
- Each request costs ~2 tokens (minimal)
- Use Haiku for fast/cheap generation
- Use Opus for complex/high-quality
- Cache examples in memory (already done)

### Response Speed
- Streaming enabled (token-by-token)
- Background connection (no blocking)
- Parallel task display (queue system)
- Batch block placement (100 at a time)

### Error Handling
- Auto-repair common issues (e.g., missing getMesh)
- Retry with delay for race conditions (2-3 seconds)
- Skip invalid blocks (don't fail entire structure)
- Clear error messages to user

## Common Issues

### Creature Won't Spawn
```javascript
// Problem: Creature class not registered yet
// Solution: Agent retries for 3 seconds
// Check: [Agent] logs show "waiting for registration"
// Fix: Increase wait time if needed (line 591 in Agent.js)
```

### Item Not in Inventory
```javascript
// Problem: Item not in ItemManager yet
// Solution: Agent retries for 2 seconds
// Check: [Agent] logs show "not found in ItemManager"
// Fix: Increase wait time if needed (line 659 in Agent.js)
```

### Structure at Wrong Height
```javascript
// Problem: Structure placed at player Y instead of ground
// Solution: Use targetGroundY from context
// Check: TaskManager logs show targetGroundY value
// Fix: Ensure worldGen.getTerrainHeight() is working
```

### Validation Fails
```javascript
// Problem: Generated code doesn't meet requirements
// Solution: Auto-repair attempts to fix
// Check: [FewShotAI] logs show validation errors
// Fix: Improve examples or add repair logic
```

## Model Selection

### Recommended Models by Use Case

**Fast & Cheap (Development):**
- `anthropic/claude-haiku-4.5` - Best for testing
- `deepseek/deepseek-chat` - Very cheap, good for code

**Balanced (Production):**
- `anthropic/claude-sonnet-4.5` - Best balance
- `openai/gpt-5.2-codex` - Optimized for code

**High Quality (Complex Tasks):**
- `anthropic/claude-opus-4.6` - Strongest model
- `openai/gpt-5.2-pro` - Most advanced GPT
- `google/gemini-3-pro-preview` - Google flagship

### Changing Models
```javascript
// Client-side (in browser console)
const client = window.fewShotClient;
client.send({ type: 'set_model', model: 'anthropic/claude-haiku-4.5' });

// Or via TaskManager
taskManager.getActiveClient().send({
  type: 'set_model',
  model: 'anthropic/claude-sonnet-4.5'
});
```

## Available Blocks (Structures)

```javascript
// server/ai/examples/structures.ts
export const availableBlocks = [
    'grass', 'dirt', 'stone', 'cobblestone',
    'oak_log', 'oak_planks', 'oak_leaves',
    'glass', 'sand', 'gravel',
    'water', 'lava', 'air',
    'coal_ore', 'iron_ore', 'gold_ore',
    'diamond_ore', 'redstone_ore'
];
```

## Client Tools (Available to AI)

```javascript
// Agent.js - handleToolRequest()
spawn_creature    // Spawn entities in front of player
set_blocks        // Place blocks in world
give_item         // Add items to inventory (prefer hotbar)
teleport_player   // Move player to location
spawn_tree        // Generate trees (oak, birch, pine, etc.)
fill_blocks       // Fill region with blocks (max 10k)
```

## Environment Variables

```bash
# Server (.env)
OPENROUTER_API_KEY=sk-or-...     # Required
FEWSHOT_MODEL=anthropic/claude-3-haiku  # Optional (default)
OPENROUTER_REFERER=http://localhost:5173  # Optional
```

## Quick Checklist

### Before Deploying
- [ ] Examples are high-quality and tested
- [ ] Validation rules cover all requirements
- [ ] Auto-repair handles common errors
- [ ] Error messages are clear to users
- [ ] Logging is comprehensive but not excessive
- [ ] Token usage is optimized
- [ ] Race conditions are handled (retries)
- [ ] Test endpoints work correctly

### Before Adding Examples
- [ ] Code is production-ready
- [ ] Keywords are relevant and specific
- [ ] Description is clear
- [ ] Code follows existing patterns
- [ ] No syntax errors
- [ ] Uses only available APIs
- [ ] Tested in-game

---

**Quick Reference Version:** 1.0
**Last Updated:** 2026-02-09
