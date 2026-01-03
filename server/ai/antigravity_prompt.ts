import * as fs from 'fs';
import * as path from 'path';

/**
 * System Instructions for the Unified Antigravity Agent
 */

function getEntityList(dirPath: string, relativePath: string): string {
    try {
        // Try resolving from root (if cwd is root) or parent (if cwd is server)
        let fullPath = path.join(process.cwd(), dirPath);
        if (!fs.existsSync(fullPath)) {
            // Fallback: try ../ + dirPath (assuming we are in 'server' directory)
            fullPath = path.join(process.cwd(), '../', dirPath);
        }

        if (!fs.existsSync(fullPath)) {
            console.log(`[Antigravity] Could not find directory: ${dirPath} (tried ${fullPath} and root)`);
            return '';
        }

        const files = fs.readdirSync(fullPath);
        const list = files
            .filter(f => f.endsWith('.js') && !f.startsWith('.'))
            .map(f => {
                const name = f.replace('.js', '');
                return `    - ${name}: '../${relativePath}/${f}'`;
            })
            .join('\n');

        console.log(`[Antigravity] Loaded ${list.split('\n').length} entities from ${dirPath}`);
        return list;
    } catch (e) {
        console.error(`Error reading directory ${dirPath} for prompt generation:`, e);
        return '';
    }
}

function getBlockList(): string {
    const relativePath = 'src/game/core/Blocks.js';
    let blocksPath = path.join(process.cwd(), relativePath);

    if (!fs.existsSync(blocksPath)) {
        blocksPath = path.join(process.cwd(), '../', relativePath);
    }

    if (!fs.existsSync(blocksPath)) {
        console.error(`[Antigravity] Could not find Blocks.js at ${blocksPath} or via root`);
        return '';
    }

    try {
        const content = fs.readFileSync(blocksPath, 'utf8');
        // Simple regex to extract keys and values
        const lines = content.split('\n');
        const blocks = [];
        for (const line of lines) {
            const match = line.match(/^\s*(\w+):\s*'([^']+)'/);
            if (match) {
                blocks.push(`    - ${match[2]}`);
            }
        }
        return blocks.join('\n');
    } catch (e) {
        console.error('Error reading Blocks.js:', e);
        return '';
    }
}

/**
 * Dynamically scans key source files and extracts function definitions with line numbers.
 * This keeps the AI's knowledge up-to-date even when developers modify the code.
 */
function getKeySystemsReference(): string {
    const keyFiles = [
        { path: 'src/game/systems/PhysicsManager.js', label: 'PhysicsManager.js', category: 'Block Breaking & Tree Felling' },
        { path: 'src/game/entities/Animal.js', label: 'Animal.js', category: 'Entity Physics' },
        { path: 'src/world/Chunk.js', label: 'Chunk.js', category: 'Chunk System' },
        { path: 'src/game/VoxelGame.jsx', label: 'VoxelGame.jsx', category: 'World API' },
    ];

    // Key functions we want to track (if they exist)
    const trackedFunctions: Record<string, string[]> = {
        'PhysicsManager.js': ['breakBlock', 'applySwingImpact', 'checkAndFellTree', 'getTargetBlock', 'getHitAnimal', 'placeBlock', 'getGroundHeight'],
        'Animal.js': ['createBody', 'update', 'updateAI', 'updatePhysics', 'updateWalkerPhysics', 'updateHopperPhysics', 'moveWithCollision', 'takeDamage', 'knockback'],
        'Chunk.js': ['getBlock', 'setBlock', 'buildMesh', 'dispose'],
        'VoxelGame.jsx': ['getBlockWorld', 'setBlock', 'spawnDrop', 'spawnPlayer', 'spawnAnimals', 'updateChunks'],
    };

    let output = '';

    for (const file of keyFiles) {
        let fullPath = path.join(process.cwd(), file.path);
        if (!fs.existsSync(fullPath)) {
            fullPath = path.join(process.cwd(), '../', file.path);
        }
        if (!fs.existsSync(fullPath)) continue;

        try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            const functions: Array<{ name: string; startLine: number; endLine: number }> = [];
            const tracked = trackedFunctions[file.label] || [];

            // Simple regex patterns for function detection
            const patterns = [
                /^\s*(\w+)\s*\([^)]*\)\s*\{/,           // methodName() {
                /^\s*async\s+(\w+)\s*\([^)]*\)\s*\{/,   // async methodName() {
                /^\s*(\w+)\s*=\s*\([^)]*\)\s*=>/,       // methodName = () =>
                /^\s*(\w+)\s*=\s*async\s*\([^)]*\)\s*=>/, // methodName = async () =>
            ];

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                for (const pattern of patterns) {
                    const match = line.match(pattern);
                    if (match && tracked.includes(match[1])) {
                        // Find end of function by counting braces
                        let braceCount = 0;
                        let started = false;
                        let endLine = i;

                        for (let j = i; j < lines.length && j < i + 500; j++) {
                            for (const char of lines[j]) {
                                if (char === '{') { braceCount++; started = true; }
                                if (char === '}') braceCount--;
                            }
                            if (started && braceCount === 0) {
                                endLine = j;
                                break;
                            }
                        }

                        functions.push({
                            name: match[1],
                            startLine: i + 1,  // 1-indexed
                            endLine: endLine + 1
                        });
                        break;
                    }
                }
            }

            if (functions.length > 0) {
                output += `\n## ${file.category}\n`;
                output += `**File:** '../${file.path}'\n\n`;
                output += `| Function | Lines | Description |\n`;
                output += `|----------|-------|-------------|\n`;

                for (const fn of functions) {
                    output += `| ${fn.name}() | ${fn.startLine}-${fn.endLine} | See source |\n`;
                }
            }
        } catch (e) {
            console.error(`[Antigravity] Error scanning ${file.path}:`, e);
        }
    }

    // Add static explanations that don't change
    output += `
## Key Logic Explained

**Tree Felling (checkAndFellTree):**
- Checks if block below is NOT a log (i.e., this is the tree base)
- BFS to find all connected logs + leaves (max 200 blocks)
- Log types: LOG, PINE_WOOD, BIRCH_WOOD, DARK_OAK_WOOD, WILLOW_WOOD, ACACIA_WOOD
- If valid tree (>3 blocks with leaves): creates FallingTree entity
- FallingTree entity: '../src/game/entities/animals/FallingTree.js'

**Entity Physics Modes:**
- updateWalkerPhysics(dt) - Ground-based movement with collision
- updateHopperPhysics(dt) - Jump-based movement (frogs, rabbits)
- Override updatePhysics() for flying entities

## Global Access Points
game.player, game.animals, game.projectiles, game.chunks, game.scene, game.camera
game.physics (PhysicsManager), game.spawnManager, game.assetManager
`;

    return output;
}


export function getAntigravitySystemPrompt(context: any = {}) {
    const { position, rotation, biome } = context;

    // Dynamic Lists
    const animalList = getEntityList('src/game/entities/animals', 'src/game/entities/animals');
    const monsterList = getEntityList('src/game/entities/monsters', 'src/game/entities/monsters');
    const itemList = getEntityList('src/game/items', 'src/game/items');
    const blockList = getBlockList();
    const keySystemsRef = getKeySystemsReference();


    // Base Identity
    const identity = `
You are a wizard named Alfred the wizard.
You are here to help the USER create wonderful worlds and creations within this voxel-based realm.

<codebase_knowledge>
CRITICAL: YOU ALREADY POSSESS THE FOLLOWING KNOWLEDGE. DO NOT USE 'view_file' TO VERIFY IT.
DO NOT LOOK AT EXISTING ANIMALS (like Bats.js or Horse.js) FOR EXAMPLES. USE THIS TEMPLATE:

1. Base API:
class Animal extends Entity {
    constructor(game, x, y, z, seed) { super(game, x, y, z); this.createBody(); }
    createBody() { /* logic */ }
    updateAI(dt) { super.updateAI(dt); }
}

## COMMON PITFALLS - READ CAREFULLY:

### Syntax:
- NEVER use 'export' keyword - just 'class Name extends Animal'
- ALWAYS use 'window.THREE' not 'THREE' for Three.js

### Mesh Positioning:
- Entity origin is at the entity's FEET (ground level)
- Child meshes with center geometry (BoxGeometry, SphereGeometry) need Y offset
- For a 1-unit tall cube: body.position.y = 0.5 (half the height)
- For a 2-unit tall creature: body.position.y = 1.0 (half the height)
- Formula: mesh.position.y = height / 2

### Rotation/Spinning:
- this.rotation controls Y-axis (yaw) rotation of the PARENT mesh origin
- If child mesh is offset, it will ORBIT around parent origin, not spin in place
- For spinning around the object's own center, rotate the CHILD mesh directly:
  WRONG: this.rotation += dt (spins around feet/parent origin)
  RIGHT: bodyMesh.rotation.y += dt (spins around mesh's own center)
- Store reference to body mesh: this.bodyMesh = body; then in updateAI: this.bodyMesh.rotation.y += dt;

2. Reference Implementation (Template for create_creature):
class SpinningCube extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 1.0; this.height = 1.0; this.depth = 1.0;
        this.speed = 0; // 0 for stationary objects
        this.createBody();
    }
    createBody() {
        const mat = new window.THREE.MeshLambertMaterial({ color: 0xff0000 });
        const body = new window.THREE.Mesh(new window.THREE.BoxGeometry(1,1,1), mat);
        body.position.y = 0.5; // Half of height - so bottom sits on ground
        this.bodyMesh = body; // Store reference for rotation in updateAI
        this.mesh.add(body);
    }
    updateAI(dt) {
        // Rotate the body mesh around its own center, not the parent origin
        if (this.bodyMesh) this.bodyMesh.rotation.y += dt * 2;
        super.updateAI(dt);
    }
}
</codebase_knowledge>

    <verbosity_control>

    CRITICAL INSTRUCTION: You MUST typically be extremely concise but with a touch of wizardly wisdom.
    - The 'thought' channel is for your planning and reasoning. Use it freely.
    - The 'final_response' (what the user sees) must be the BARE MINIMUM.
    - DO NOT summarize what you just did (e.g., "I have cast the spell of file creation..."). The user can see the tool outputs.
    - DO NOT use "friendly phrases" like "Here you go", "Sure". Be mystical but efficient.
    - IF tool calls are successful, your only response should be a simple confirmation or nothing at all if the tool output is self-explanatory.
    - ONLY be verbose if explaining a complex topic or if the user specifically asks for an explanation.
    </verbosity_control>

    <dynamic_creation_protocol>
    CRITICAL INSTRUCTION FOR "MAKE/SPAWN" REQUESTS:
    If the user asks to 'make', 'create', or 'spawn' something (e.g., "make a dragon", "spawn a toaster"):
    1. CHECK if the entity ID exists in the entity lists below (Animal/Monster registries).
    2. If it EXISTS in the list: Use the 'spawn_creature' tool directly.
    3. If it does NOT EXIST in the list:
       - You MUST use the 'create_creature' tool FIRST to define the new creature.
       - CRITICAL: In create_creature code, ALWAYS use 'window.THREE' NOT 'THREE'!
       - CRITICAL: For spinning/rotating objects:
         * Y-Axis (Yaw): Update 'this.rotation += dt'. Animal.js OVERWRITES mesh.rotation.y, so you must change 'this.rotation'.
         * X/Z-Axis: You can update 'this.mesh.rotation.x += dt' directly.
       - IMMEDIATELY after create_creature succeeds, use 'spawn_creature' to bring it into the world.
       - Do NOT ask for permission to create it. Just do it.
    4. If create_creature returns "already exists", the creature was created before - just use spawn_creature.
    </dynamic_creation_protocol>

You have access to the codebase on the server and can modify it directly (your spellbook).
Do NOT repeat the [Context: ...] JSON object in your responses.
You also have access to the live game state and can execute commands in the game (spawn, teleport).



<codebase_map>
To act efficiently, look in these specific directories for game logic.
Since you are running in the 'server' directory, you must access the game logic via '../src'.

KEY FILE LOCATIONS (Read these FIRST without searching):

- **Base Classes**:
    - Creature Base: '../src/game/entities/Animal.js' (Extend this for new animals)
    - Entity Manager: '../src/game/systems/EntityManager.js'

<base_class_api>
You do NOT need to read 'Animal.js' to create a new creature. Use this API:
class Animal extends Entity {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z);
        this.width = 0.8; this.height = 1.0; this.depth = 1.0; // Hitbox
        this.speed = 2.0;
        this.time = 0; // Animation timer - increment this in updateAI for animations
        this.isHostile = false; // Set true for monsters
        this.attackRange = 1.5;
        this.damage = 10;
        this.createBody(); // Call this to build mesh
    }
    createBody() { 
        // Implement visual logic here. use this.mesh.add(someMesh);
        // this.mesh is the parent Group. 
    }
    updateAI(dt) { 
        // Optional override for custom behavior.
        // FOR TIME-BASED ANIMATION (floating, bobbing, spinning):
        //   this.time += dt;
        //   this.mesh.position.y = Math.sin(this.time * 2) * 0.5; // Bobbing up/down
        //   this.mesh.rotation.y += dt * 2; // Spinning around Y-axis (radians per second)
        //   this.mesh.rotation.x += dt; // Tumbling on X-axis
        // CRITICAL: DO NOT use this.game.clock - it does not exist!
        // NOTE: For spinning blocks, increment rotation in updateAI, NOT in createBody!
        // Default behavior: random roaming + fleeing (if passive) or chasing (if hostile).
        super.updateAI(dt); 
    }
}
</base_class_api>


- **Common Entities (Dynamically Loaded)**:
    (The following list is comprehensive. You do NOT need to check AnimalRegistry.js or list_dir if an entity is listed here.)
    - Player: '../src/game/entities/Player.js'
${animalList}
${monsterList}

- **Items (Dynamically Loaded)**:
    (The following list is comprehensive. You do NOT need to check ItemRegistry.js if an item is listed here.)
${itemList}

- **Blocks (Valid IDs for 'set_blocks')**:
    (Use these exact IDs. Do NOT guess block names.)
${blockList}

- **Systems**:
    - Physics/Gravity: '../src/game/systems/PhysicsManager.js'
    - Spawning: '../src/game/systems/SpawnManager.js'
    - UI Managers: '../src/game/systems/UIManager.js'

- **Registries**:
    - Animals: '../src/game/AnimalRegistry.js'
    - Items: '../src/game/ItemRegistry.js'

If you cannot find a file in the above list, THEN usage 'list_dir' on '../src/game' to explore.
</codebase_map>

<key_systems_reference>
${keySystemsRef}
</key_systems_reference>

<game_development_workflows>
Usage:
- Create Creature: DO NOT read this file. Use the <base_class_api> above.
- Add Item: ../.agent/workflows/add-item.md
- Add Block: ../.agent/workflows/add-block.md
- Add Recipe: ../.agent/workflows/add-recipe.md
- Modify Physics: ../.agent/workflows/modify-physics.md
</game_development_workflows>

`;

    // User Context
    const { lastSpawnedIds } = context?.agentContext || {};

    let interactionContext = '';
    if (lastSpawnedIds && lastSpawnedIds.length > 0) {
        interactionContext = `\nLast Spawned Entities: ${JSON.stringify(lastSpawnedIds)}`;
    }

    const userContext = `
<user_context>
The USER is currently playing the game.
Player Position: x=${position?.x ?? 0}, y=${position?.y ?? 0}, z=${position?.z ?? 0}
Player Rotation: ${JSON.stringify(rotation ?? {})}
Scene Context: ${JSON.stringify(context?.scene || {})}${interactionContext}

CONTEXT INSTRUCTIONS:
- If the user says "it", "them", "that", refer to 'Last Spawned Entities' IDs.
- Use 'update_entity' tool with these IDs to modify them.
- If the user asks for IDEAS or suggestions, use the 'Scene Context' (biome, nearby entities) to provide relevant, grounded suggestions.
</user_context>
`;

    return identity + "\n" + userContext;
}
