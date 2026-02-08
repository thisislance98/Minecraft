/**
 * Combined seed data for Merlin's knowledge base
 * This file is auto-loaded by KnowledgeService when no database is available
 */

type KnowledgeCategory = 'template' | 'gotcha' | 'howto' | 'error' | 'example';

interface SeedEntry {
    category: KnowledgeCategory;
    title: string;
    content: string;
    tags: string[];
}

export const SEED_DATA: SeedEntry[] = [
    // ========================================
    // BASIC CREATURE TEMPLATES
    // ========================================
    {
        category: 'template',
        title: 'Spinning Creature Template',
        content: `class SpinningCreature extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.spinSpeed = 2;
    }
    createBody() {
        const geo = new window.THREE.BoxGeometry(1, 1, 1);
        const mat = new window.THREE.MeshStandardMaterial({ color: 0xff0000 });
        this.mesh = new window.THREE.Mesh(geo, mat);
        this.mesh.position.set(this.x, this.y, this.z);
        this.game.scene.add(this.mesh);
    }
    update(delta) {
        super.update(delta);
        if (this.mesh) this.mesh.rotation.y += this.spinSpeed * delta;
    }
}`,
        tags: ['spinning', 'rotation', 'animation', 'cube']
    },
    {
        category: 'template',
        title: 'Flying Creature Template',
        content: `class FlyingCreature extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.floatOffset = 0;
        this.floatSpeed = 2;
        this.floatAmplitude = 0.5;
    }
    update(delta) {
        super.update(delta);
        this.floatOffset += delta * this.floatSpeed;
        if (this.mesh) {
            this.mesh.position.y = this.y + Math.sin(this.floatOffset) * this.floatAmplitude;
        }
    }
}`,
        tags: ['flying', 'floating', 'hover', 'animation']
    },
    {
        category: 'template',
        title: 'Glowing Creature Template',
        content: `// Use emissive property for glow effect
const mat = new window.THREE.MeshStandardMaterial({
    color: 0x00ff00,
    emissive: 0x00ff00,
    emissiveIntensity: 0.5
});`,
        tags: ['glow', 'emissive', 'light', 'material']
    },

    // ========================================
    // GOTCHAS
    // ========================================
    {
        category: 'gotcha',
        title: 'Use window.THREE not THREE',
        content: 'CRITICAL: In dynamic creature code, always use window.THREE instead of THREE directly. The bare THREE reference is not available in the Function constructor scope.',
        tags: ['THREE', 'error', 'scope', 'common']
    },
    {
        category: 'gotcha',
        title: 'Always call super.update(delta)',
        content: 'When overriding update(), always call super.update(delta) first. This handles core animal physics, collision, and state management.',
        tags: ['update', 'super', 'inheritance', 'physics']
    },
    {
        category: 'gotcha',
        title: 'Mesh position vs entity position',
        content: 'The mesh.position is the visual position. The entity x,y,z are the logical position. When moving, update both or use the provided movement methods.',
        tags: ['position', 'mesh', 'movement', 'sync']
    },
    {
        category: 'gotcha',
        title: 'createBody() must add mesh to scene',
        content: 'After creating the mesh in createBody(), you MUST call this.game.scene.add(this.mesh). Otherwise the creature will be invisible.',
        tags: ['createBody', 'scene', 'invisible', 'mesh']
    },

    // ========================================
    // HOW-TOS
    // ========================================
    {
        category: 'howto',
        title: 'How to make creature follow player',
        content: `In update(delta), get player position and move towards it:
const player = this.game.player;
const dx = player.position.x - this.mesh.position.x;
const dz = player.position.z - this.mesh.position.z;
const dist = Math.sqrt(dx*dx + dz*dz);
if (dist > 3) {
    this.mesh.position.x += (dx/dist) * this.speed * delta;
    this.mesh.position.z += (dz/dist) * this.speed * delta;
}`,
        tags: ['follow', 'player', 'movement', 'AI']
    },
    {
        category: 'howto',
        title: 'How to change creature color dynamically',
        content: `Add a setColor method:
setColor(hexColor) {
    if (this.mesh && this.mesh.material) {
        this.mesh.material.color.setHex(hexColor);
    }
}`,
        tags: ['color', 'material', 'dynamic', 'setColor']
    },

    // ========================================
    // MUSHROOM HOUSE BUILDING TEMPLATE
    // ========================================
    {
        category: 'template',
        title: 'Mushroom House Building Template',
        content: `// ========================================
// MUSHROOM HOUSE BUILDING TEMPLATE
// ========================================
// This template shows how to build a mushroom house structure
// in front of the player using the set_blocks tool.
//
// The mushroom house has:
// - A tall stem (using log or white_plaster blocks)
// - A red spotted cap (using terracotta/brick for red, white_plaster for spots)
// - A door entrance
// - Optional windows
// - Interior space for the player

// ==========================================
// POSITIONING: BUILD IN FRONT OF PLAYER
// ==========================================
// The context provides:
// - context.position: player's current position {x, y, z}
// - context.rotation: player's facing direction
//
// To build in front of the player:
// 1. Get player position from context
// 2. Calculate forward direction from rotation.y (yaw)
// 3. Offset the build by ~5-8 blocks in that direction
//
// Example calculation:
// const px = Math.floor(context.position.x);
// const py = Math.floor(context.position.y);
// const pz = Math.floor(context.position.z);
// const yaw = context.rotation.y;
// const forwardX = -Math.sin(yaw);
// const forwardZ = -Math.cos(yaw);
// const distance = 6;
// const baseX = Math.floor(px + forwardX * distance);
// const baseZ = Math.floor(pz + forwardZ * distance);
// const baseY = py; // Ground level

// ==========================================
// BLOCK TYPES TO USE
// ==========================================
// Stem: 'log', 'birch_wood', 'white_plaster', or 'plank'
// Cap (red): 'terracotta', 'brick', or any red-ish block
// Spots (white): 'white_plaster', 'snow', or 'sandstone'
// Door area: 'air' to create entrance
// Windows: 'glass'
// Floor: 'plank' or 'dark_planks'

// ==========================================
// MUSHROOM HOUSE STRUCTURE
// ==========================================
// The house is built with these parts:
//
// 1. STEM (hollow cylinder, 3x3 outer, walkable inside)
//    Height: 5-6 blocks
//    Use log or white_plaster for mushroom-like appearance
//
// 2. CAP (dome/sphere shape)
//    Radius: 4-5 blocks
//    Red blocks with white spot pattern
//    Overhangs the stem slightly
//
// 3. DOOR (2 high, 1 wide opening in stem)
//
// 4. INTERIOR (optional floor, maybe a window)

// ==========================================
// EXAMPLE: BUILDING A MUSHROOM HOUSE
// ==========================================
function buildMushroomHouse(context) {
    const blocks = [];

    // Calculate position in front of player
    const px = Math.floor(context.position.x);
    const py = Math.floor(context.position.y);
    const pz = Math.floor(context.position.z);
    const yaw = context.rotation ? context.rotation.y : 0;
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const distance = 7;

    // Base position (center of mushroom)
    const cx = Math.floor(px + forwardX * distance);
    const cz = Math.floor(pz + forwardZ * distance);
    const cy = py; // Ground level

    // Door direction (facing player)
    const doorX = Math.round(forwardX);
    const doorZ = Math.round(forwardZ);

    // ========== STEM (hollow cylinder) ==========
    const stemHeight = 5;
    const stemRadius = 2;

    for (let y = 0; y < stemHeight; y++) {
        for (let dx = -stemRadius; dx <= stemRadius; dx++) {
            for (let dz = -stemRadius; dz <= stemRadius; dz++) {
                const distSq = dx*dx + dz*dz;
                // Outer ring of stem (cylinder wall)
                if (distSq <= stemRadius*stemRadius && distSq > (stemRadius-1)*(stemRadius-1)) {
                    // Check if this is the door position
                    const isDoor = (dx === doorX || dx === -doorX) &&
                                   (dz === doorZ || dz === -doorZ) &&
                                   y < 3 && Math.abs(dx) + Math.abs(dz) === 1;

                    if (!isDoor) {
                        blocks.push({ x: cx + dx, y: cy + y, z: cz + dz, id: 'white_plaster' });
                    }
                }
            }
        }
    }

    // ========== CAP (dome shape) ==========
    const capRadius = 4;
    const capBaseY = cy + stemHeight - 1; // Cap starts at top of stem

    for (let dy = 0; dy <= capRadius; dy++) {
        // Current radius at this height (hemisphere)
        const sliceRadius = Math.sqrt(capRadius*capRadius - dy*dy);

        for (let dx = -capRadius; dx <= capRadius; dx++) {
            for (let dz = -capRadius; dz <= capRadius; dz++) {
                const distSq = dx*dx + dz*dz;

                // Inside the hemisphere slice
                if (distSq <= sliceRadius*sliceRadius) {
                    // Outer shell only (hollow inside)
                    const innerRadius = sliceRadius - 1;
                    const isShell = distSq > innerRadius*innerRadius || dy === 0 || dy >= capRadius - 1;

                    if (isShell) {
                        // Determine if this is a white spot
                        // Spots at regular intervals
                        const isSpot = ((dx + dz) % 3 === 0 && (dx - dz) % 3 === 0 && dy > 0);

                        const blockId = isSpot ? 'white_plaster' : 'terracotta';
                        blocks.push({ x: cx + dx, y: capBaseY + dy, z: cz + dz, id: blockId });
                    }
                }
            }
        }
    }

    // ========== FLOOR ==========
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            blocks.push({ x: cx + dx, y: cy, z: cz + dz, id: 'dark_planks' });
        }
    }

    // ========== WINDOW (opposite door) ==========
    blocks.push({ x: cx - doorX, y: cy + 2, z: cz - doorZ, id: 'glass' });

    return blocks;
}

// ==========================================
// SIMPLIFIED BLOCKS ARRAY FOR set_blocks TOOL
// ==========================================
// When using the set_blocks tool, provide the blocks array directly:
//
// Use tool: set_blocks with blocks parameter containing array like:
// [
//   { "x": 10, "y": 64, "z": 20, "id": "white_plaster" },
//   { "x": 11, "y": 64, "z": 20, "id": "white_plaster" },
//   ...
// ]
//
// The blocks array should be computed based on player position from context.

// ==========================================
// KEY TIPS FOR BUILDING MUSHROOM HOUSES
// ==========================================
// 1. Always calculate position relative to player's position and rotation
// 2. Use context.position for player location
// 3. Use context.rotation.y (yaw) to determine forward direction
// 4. Leave door opening facing the player
// 5. Make stem hollow so player can walk inside
// 6. Cap should overhang the stem for mushroom look
// 7. Add white spots on red cap for classic mushroom appearance
// 8. Consider terrain - may need to check ground height`,
        tags: ['build', 'structure', 'mushroom', 'house', 'home', 'building', 'set_blocks', 'blocks', 'construction', 'shelter', 'dome', 'cap', 'stem', 'red', 'white', 'spots', 'fairy', 'fantasy', 'cute']
    },

    // ========================================
    // WAND ITEM PROJECTILE TEMPLATE
    // ========================================
    {
        category: 'template',
        title: 'Wand Item Projectile Template',
        content: `// COMPLETE WAND ITEM WITH PROJECTILE GUIDE
// This template shows how to create:
// 1. The Wand Item class (with inventory icon and 3D hand mesh)
// 2. The Projectile class that shoots LIGHTNING BOLTS
// 3. Particle explosions and block destruction on impact

class MyWandItem extends Item {
    constructor() {
        super('lightning_wand', 'Lightning Wand');
        this.maxStack = 1;
        this.isTool = true;
        this.cooldown = 500;
        this.lastUseTime = 0;
        this.damage = 15;
        this.blastRadius = 2;

        this.icon = \`<svg viewBox="0 0 24 24">
            <rect x="10" y="10" width="4" height="12" fill="#4B0082" rx="1"/>
            <circle cx="12" cy="6" r="4" fill="#FFD700"/>
        </svg>\`;
    }

    onUseDown(game, player) {
        const now = Date.now();
        if (now - this.lastUseTime < this.cooldown) return false;
        this.lastUseTime = now;

        const camDir = new window.THREE.Vector3();
        game.camera.getWorldDirection(camDir);
        const spawnPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(1.5));

        const projectile = new LightningBoltProjectile(game, spawnPos, camDir, this.damage, this.blastRadius);
        game.projectiles = game.projectiles || [];
        game.projectiles.push(projectile);
        game.scene.add(projectile.mesh);

        if (player.swingArm) player.swingArm();
        return true;
    }

    getMesh() {
        const group = new window.THREE.Group();
        const handle = new window.THREE.Mesh(
            new window.THREE.CylinderGeometry(0.04, 0.06, 0.6, 8),
            new window.THREE.MeshLambertMaterial({ color: 0x4B0082 })
        );
        handle.position.y = -0.15;
        group.add(handle);
        return group;
    }
}`,
        tags: ['wand', 'projectile', 'shoot', 'magic', 'spell', 'cast', 'item', 'weapon', 'staff', 'rod', 'lightning', 'bolt']
    }
];
