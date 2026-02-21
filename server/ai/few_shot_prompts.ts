/**
 * Few-Shot AI Category Prompts
 * Each category has specific rules, examples, and validation requirements
 *
 * No router prompt — routing is done by the UI category buttons + semantic similarity for "custom".
 * Each prompt tells the LLM to use the provided tool to submit its result.
 *
 * Skill files (.claude/skills/) are loaded at startup and injected into prompts
 * to give the LLM full architectural context for each category.
 */

import { availableBlocks } from './examples/structures';
import { UnifiedExample } from './examples/UnifiedExampleIndex';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// SKILL FILE LOADER
// ============================================================

const SKILLS_DIR = path.join(__dirname, '../../.claude/skills');

// Cache loaded skill content (loaded once at startup)
const skillCache: Record<string, string> = {};

function loadSkill(filename: string): string {
    if (skillCache[filename]) return skillCache[filename];

    try {
        const filePath = path.join(SKILLS_DIR, filename);
        const content = fs.readFileSync(filePath, 'utf-8');
        skillCache[filename] = content;
        console.log(`[FewShotPrompts] Loaded skill: ${filename} (${content.length} chars)`);
        return content;
    } catch (e: any) {
        console.warn(`[FewShotPrompts] Could not load skill ${filename}: ${e.message}`);
        return '';
    }
}

// Pre-load all skills at module init
function getCreatureSkill(): string { return loadSkill('implementing-creatures.md'); }
function getFlyingCreatureSkill(): string { return loadSkill('implementing-flying-creatures.md'); }
function getItemSkill(): string { return loadSkill('implementing-items.md'); }
function getStructureSkill(): string { return loadSkill('implementing-structures.md'); }

// ============================================================
// CREATURE CREATION PROMPT
// ============================================================

export function getCreaturePrompt(userRequest: string, context: any, examples: UnifiedExample[] = []) {
    const skill = getCreatureSkill();

    // Detect if the request is for a flying creature
    const flyingKeywords = ['fly', 'flying', 'dragon', 'bird', 'eagle', 'hawk', 'bat', 'butterfly', 'bee', 'phoenix', 'griffin', 'pegasus', 'fairy', 'pixie', 'owl', 'parrot', 'pterodactyl', 'wyvern', 'wings', 'airborne', 'soar', 'hover'];
    const isFlying = flyingKeywords.some(k => userRequest.toLowerCase().includes(k));
    const flyingSkill = isFlying ? getFlyingCreatureSkill() : '';

    return `You are creating a CREATURE for a voxel game. Generate JavaScript code for a new Animal class.

## CRITICAL RULES
1. The class MUST extend Animal
2. MUST have a createBody() method with THREE.js meshes
3. MUST set dimensions: this.width, this.height, this.depth
4. Use only THREE.BoxGeometry, CylinderGeometry, SphereGeometry (Minecraft-style blocks)
5. The creature will be spawned in front of the player automatically
${isFlying ? `6. **FLYING CREATURE DETECTED** — You MUST include flight movement code. Setting gravity=0 alone is NOT enough!
   - Set this.gravity = 0 AND this.flying = true in constructor
   - Initialize flight velocity and waypoint properties
   - Override updatePhysics(dt) to skip ground collision
   - Add 3D movement logic in updateAI(dt) or update(dt) that moves the creature through the air
   - Include height control relative to terrain
   - Include bounds checking so it doesn't fly infinitely far away
   - Add wing flap animation if the creature has wings
   - See the FLYING CREATURE PATTERN section below for the required code` : ''}

## Available Properties (set in constructor)
- this.width, this.height, this.depth - Physical size
- this.speed - Movement speed (default 2.0)
- this.health, this.maxHealth - Health points
- this.isHostile - If true, attacks player
- this.damage - Attack damage
- this.detectionRange - How far it can see player
- this.attackRange - Melee attack range
- this.canHop - If true, hops instead of walks (like bunny)
- this.fleeOnProximity - If true, runs from player
- this.fleeRange - Distance to start fleeing
- this.gravity - Set to 0 for flying creatures

## Available Methods to Override
- createBody() - REQUIRED: Build the 3D mesh using THREE.js
- update(dt) - For custom behaviors (call super.update(dt) first)
- updateAI(dt) - For custom AI (call super.updateAI(dt) for default behavior)
- updatePhysics(dt) - Override for flying creatures to skip gravity/ground collision

## Materials (colors as hex)
- new THREE.MeshLambertMaterial({ color: 0xRRGGBB })
- new THREE.MeshBasicMaterial({ color: 0xRRGGBB }) - For glowing parts

## Common Colors
Red: 0xFF0000, Green: 0x00FF00, Blue: 0x0000FF, Yellow: 0xFFFF00
Orange: 0xFF8800, Purple: 0x8800FF, Pink: 0xFF88FF, Brown: 0x8B4513
White: 0xFFFFFF, Black: 0x000000, Gray: 0x888888
${isFlying && flyingSkill ? `
## FLYING CREATURE PATTERN (MUST FOLLOW)
${flyingSkill}
` : ''}
${skill ? `
## SYSTEM ARCHITECTURE REFERENCE
${skill}
` : ''}
## SIMILAR WORKING EXAMPLES
${examples.map((ex, i) => `
### Example ${i + 1}: ${ex.name}
${ex.description}
\`\`\`javascript
${ex.code}
\`\`\`
`).join('\n')}

## USER REQUEST
"${userRequest}"

## YOUR TASK
Generate a complete class that:
1. Has a unique, descriptive PascalCase name (e.g., FireDragon, CuteSlime)
2. Sets appropriate dimensions and stats
3. Has a createBody() method with detailed THREE.js mesh construction
4. Follows the patterns shown in the examples

Use the **create_creature** tool to submit your result. Pass the className and the full class code.`;
}

// ============================================================
// ITEM CREATION PROMPT
// ============================================================

export function getItemPrompt(userRequest: string, context: any, examples: UnifiedExample[] = []) {
    const skill = getItemSkill();

    return `You are creating an ITEM for a voxel game. Generate JavaScript code for a new Item class.

## CRITICAL RULES - MUST FOLLOW ALL
1. The class MUST extend Item (or WandItem for shooting items)
2. MUST have getMesh() method returning a THREE.Object3D
3. MUST have an SVG icon (viewBox="0 0 64 64") for inventory display
4. The item will be added to player's inventory automatically

## Item Class Structure
\`\`\`javascript
class MyItem extends Item {
    constructor() {
        super('item_id', 'Item Name'); // id and display name
        this.maxStack = 1;  // Max stack size (1 for tools, 16/64 for consumables)
        this.isTool = true; // true for usable items
    }

    // Called on right-click
    onUseDown(game, player) {
        // Your action code
        return true; // Return true if action was handled
    }

    // Called on left-click (optional)
    onPrimaryDown(game, player) {
        return false;
    }

    // REQUIRED: 3D model for preview/dropping
    getMesh() {
        const group = new THREE.Group();
        // Add meshes to group
        return group;
    }
}
\`\`\`

## For Wands/Shooting Items - Extend WandItem
\`\`\`javascript
class MyWand extends WandItem {
    constructor() {
        super('my_wand', 'My Wand');
        this.fireCooldown = 500; // ms between shots
    }
    // WandItem already handles projectile spawning
}
\`\`\`

## Available game APIs
- game.camera.position - Player camera position
- game.camera.getWorldDirection(vector) - Get look direction
- game.spawnMagicProjectile(pos, velocity) - Spawn magic projectile
- game.animals - Array of all creatures
- player.swingArm() - Play arm swing animation
- player.health, player.maxHealth - Player health
- game.inventoryManager.removeItem(slot, count) - Remove items

## SVG Icon Requirements
- viewBox="0 0 64 64"
- Simple shapes: rect, circle, ellipse, polygon, path
- Colors should match the 3D mesh
- Keep it recognizable at small sizes
${skill ? `
## SYSTEM ARCHITECTURE REFERENCE
${skill}
` : ''}
## SIMILAR WORKING EXAMPLES
${examples.map((ex, i) => `
### Example ${i + 1}: ${ex.name}
${ex.description}
\`\`\`javascript
${ex.code}
\`\`\`
${ex.icon ? `SVG Icon:
\`\`\`svg
${ex.icon}
\`\`\`` : ''}
`).join('\n')}

## USER REQUEST
"${userRequest}"

## YOUR TASK
Generate a complete Item class with getMesh() method AND an SVG icon string.

Use the **create_item** tool to submit your result. Pass className, code, and icon.`;
}

// ============================================================
// STRUCTURE CREATION PROMPT
// ============================================================

export function getStructurePrompt(userRequest: string, context: any, examples: UnifiedExample[] = []) {
    const skill = getStructureSkill();

    return `You are creating a STRUCTURE for a voxel game by placing blocks.

## CRITICAL RULES - YOU MUST FOLLOW THESE
1. ALWAYS generate JavaScript code - NEVER ask questions or give explanations
2. If the request is vague, make creative decisions yourself
3. Position RELATIVE to player (they are at playerPosition)
4. Place structures in FRONT of player (positive X direction from player)
5. Use only available block types
6. DO NOT include any text outside the code block - ONLY return code

## Available Block Types
${availableBlocks.join(', ')}

## Output Format
Return JavaScript code that computes and returns a blocks array:
\`\`\`javascript
// Structure: [Your structure name]
const px = Math.floor(playerPosition.x) + 5; // 5 blocks in front
const py = Math.floor(playerPosition.y);
const pz = Math.floor(playerPosition.z);

const blocks = [];
// ... generate blocks array
// Each block: { x: number, y: number, z: number, id: string }

return blocks;
\`\`\`

## Building Tips
- Start floor at py (player Y level)
- Build walls upward from py + 1
- Leave door openings (3 blocks high, 1-2 wide)
- Add windows with 'glass' blocks
- Use 'air' to create hollow interiors
- For spiral stairs: use a loop with sin/cos to place blocks in a spiral pattern
${skill ? `
## SYSTEM ARCHITECTURE REFERENCE
${skill}
` : ''}
## SIMILAR WORKING EXAMPLES
${examples.map((ex, i) => `
### Example ${i + 1}: ${ex.name}
${ex.description}
\`\`\`javascript
${ex.code}
\`\`\`
`).join('\n')}

## Player Context
Position: (${context.playerPosition?.x?.toFixed(0) || 0}, ${context.playerPosition?.y?.toFixed(0) || 0}, ${context.playerPosition?.z?.toFixed(0) || 0})
Looking Direction: Forward (+Z relative to player)

## USER REQUEST
"${userRequest}"

## YOUR TASK
Generate JavaScript code that creates an array of block placements.
If the request is vague or says "make it up", be creative and build something interesting!
The code will be executed with playerPosition available.

Use the **create_structure** tool to submit your code.`;
}

// ============================================================
// SIMPLE CHAT PROMPT
// ============================================================

export function getChatPrompt(context: any) {
    return `You are Merlin, a friendly wizard assistant in a voxel game.

You can help players:
- Create custom creatures (animals, monsters, pets)
- Create custom items (weapons, tools, potions, wands)
- Build structures (houses, towers, bridges)
- Spawn existing creatures
- Give existing items

Be helpful, friendly, and concise. If they want to create something, guide them to be specific about what they want.

Current player position: (${context.playerPosition?.x?.toFixed(0) || 0}, ${context.playerPosition?.y?.toFixed(0) || 0}, ${context.playerPosition?.z?.toFixed(0) || 0})`;
}
