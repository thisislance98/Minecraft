/**
 * Structure Examples for Few-Shot AI
 * Structures use set_blocks or fill_blocks to place blocks in the world
 */

export const structureExamples = [
    {
        name: "SimpleHouse",
        description: "A basic wooden house with walls, floor, roof, and door",
        keywords: ["house", "home", "building", "shelter", "cabin", "hut", "room"],
        // Returns block placement instructions relative to a position
        generateBlocks: (baseX: number, baseY: number, baseZ: number) => {
            const blocks: Array<{x: number, y: number, z: number, id: string}> = [];
            const width = 7;
            const depth = 7;
            const height = 4;

            // Floor
            for (let x = 0; x < width; x++) {
                for (let z = 0; z < depth; z++) {
                    blocks.push({ x: baseX + x, y: baseY, z: baseZ + z, id: 'oak_planks' });
                }
            }

            // Walls
            for (let y = 1; y <= height; y++) {
                for (let x = 0; x < width; x++) {
                    // Front and back walls
                    if (!(x === 3 && y <= 2)) { // Leave door opening
                        blocks.push({ x: baseX + x, y: baseY + y, z: baseZ, id: 'oak_planks' });
                    }
                    blocks.push({ x: baseX + x, y: baseY + y, z: baseZ + depth - 1, id: 'oak_planks' });
                }
                for (let z = 1; z < depth - 1; z++) {
                    // Side walls
                    blocks.push({ x: baseX, y: baseY + y, z: baseZ + z, id: 'oak_planks' });
                    blocks.push({ x: baseX + width - 1, y: baseY + y, z: baseZ + z, id: 'oak_planks' });
                }
            }

            // Windows (glass in middle of side walls)
            blocks.push({ x: baseX, y: baseY + 2, z: baseZ + 3, id: 'glass' });
            blocks.push({ x: baseX + width - 1, y: baseY + 2, z: baseZ + 3, id: 'glass' });

            // Roof (sloped using stairs would be complex, use slabs)
            for (let x = -1; x <= width; x++) {
                for (let z = -1; z <= depth; z++) {
                    blocks.push({ x: baseX + x, y: baseY + height + 1, z: baseZ + z, id: 'oak_planks' });
                }
            }

            return blocks;
        },
        code: `// House generation - place relative to player
const px = Math.floor(playerPosition.x) + 5; // 5 blocks in front
const py = Math.floor(playerPosition.y);
const pz = Math.floor(playerPosition.z);

const blocks = [];
const width = 7, depth = 7, height = 4;

// Floor
for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
        blocks.push({ x: px + x, y: py, z: pz + z, id: 'oak_planks' });
    }
}

// Walls (with door opening at front center)
for (let y = 1; y <= height; y++) {
    for (let x = 0; x < width; x++) {
        if (!(x === 3 && y <= 2)) { // Door opening
            blocks.push({ x: px + x, y: py + y, z: pz, id: 'oak_planks' });
        }
        blocks.push({ x: px + x, y: py + y, z: pz + depth - 1, id: 'oak_planks' });
    }
    for (let z = 1; z < depth - 1; z++) {
        blocks.push({ x: px, y: py + y, z: pz + z, id: 'oak_planks' });
        blocks.push({ x: px + width - 1, y: py + y, z: pz + z, id: 'oak_planks' });
    }
}

// Windows
blocks.push({ x: px, y: py + 2, z: pz + 3, id: 'glass' });
blocks.push({ x: px + width - 1, y: py + 2, z: pz + 3, id: 'glass' });

// Roof
for (let x = -1; x <= width; x++) {
    for (let z = -1; z <= depth; z++) {
        blocks.push({ x: px + x, y: py + height + 1, z: pz + z, id: 'oak_planks' });
    }
}

return blocks;`
    },
    {
        name: "Tower",
        description: "A tall stone tower with windows",
        keywords: ["tower", "castle", "tall", "fortress", "spire", "lookout"],
        code: `// Tower generation
const px = Math.floor(playerPosition.x) + 5;
const py = Math.floor(playerPosition.y);
const pz = Math.floor(playerPosition.z);

const blocks = [];
const radius = 3;
const height = 12;

// Circular walls
for (let y = 0; y <= height; y++) {
    for (let x = -radius; x <= radius; x++) {
        for (let z = -radius; z <= radius; z++) {
            const dist = Math.sqrt(x * x + z * z);
            // Wall ring (between inner and outer radius)
            if (dist >= radius - 1 && dist <= radius) {
                // Windows every 3 blocks on cardinal directions
                const isWindow = (y % 3 === 2) && (y > 2) && (
                    (x === 0 && Math.abs(z) === radius) ||
                    (z === 0 && Math.abs(x) === radius)
                );
                blocks.push({
                    x: px + x,
                    y: py + y,
                    z: pz + z,
                    id: isWindow ? 'glass' : 'stone_bricks'
                });
            }
            // Floor at bottom and top
            if ((y === 0 || y === height) && dist < radius) {
                blocks.push({ x: px + x, y: py + y, z: pz + z, id: 'stone_bricks' });
            }
        }
    }
}

// Battlements at top
for (let x = -radius - 1; x <= radius + 1; x++) {
    for (let z = -radius - 1; z <= radius + 1; z++) {
        const dist = Math.sqrt(x * x + z * z);
        if (dist >= radius && dist <= radius + 1) {
            // Alternating pattern
            if ((x + z) % 2 === 0) {
                blocks.push({ x: px + x, y: py + height + 1, z: pz + z, id: 'stone_bricks' });
            }
        }
    }
}

return blocks;`
    },
    {
        name: "Sphere",
        description: "A solid or hollow sphere made of blocks",
        keywords: ["sphere", "ball", "globe", "round", "orb", "dome"],
        code: `// Sphere generation
const cx = Math.floor(playerPosition.x) + 8; // Center position
const cy = Math.floor(playerPosition.y) + 5; // Elevated
const cz = Math.floor(playerPosition.z);
const radius = 5;
const hollow = true; // Set to false for solid

const blocks = [];

for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
        for (let z = -radius; z <= radius; z++) {
            const dist = Math.sqrt(x * x + y * y + z * z);
            if (hollow) {
                // Shell only (between radius-1 and radius)
                if (dist >= radius - 1 && dist <= radius) {
                    blocks.push({ x: cx + x, y: cy + y, z: cz + z, id: 'glass' });
                }
            } else {
                // Solid sphere
                if (dist <= radius) {
                    blocks.push({ x: cx + x, y: cy + y, z: cz + z, id: 'stone' });
                }
            }
        }
    }
}

return blocks;`
    },
    {
        name: "Bridge",
        description: "A wooden bridge spanning across",
        keywords: ["bridge", "path", "crossing", "walkway", "span"],
        code: `// Bridge generation
const px = Math.floor(playerPosition.x);
const py = Math.floor(playerPosition.y);
const pz = Math.floor(playerPosition.z) + 2;

const blocks = [];
const length = 15;
const width = 3;

// Main deck
for (let x = 0; x < length; x++) {
    for (let z = 0; z < width; z++) {
        blocks.push({ x: px + x, y: py, z: pz + z, id: 'oak_planks' });
    }
}

// Railings
for (let x = 0; x < length; x++) {
    // Posts every 3 blocks
    if (x % 3 === 0) {
        blocks.push({ x: px + x, y: py + 1, z: pz, id: 'oak_fence' });
        blocks.push({ x: px + x, y: py + 1, z: pz + width - 1, id: 'oak_fence' });
    }
}

// Support pillars at ends
for (let y = -1; y >= -5; y--) {
    blocks.push({ x: px, y: py + y, z: pz + 1, id: 'oak_log' });
    blocks.push({ x: px + length - 1, y: py + y, z: pz + 1, id: 'oak_log' });
}

return blocks;`
    },
    {
        name: "Pyramid",
        description: "A stepped pyramid structure",
        keywords: ["pyramid", "temple", "ancient", "steps", "monument"],
        code: `// Pyramid generation
const px = Math.floor(playerPosition.x) + 5;
const py = Math.floor(playerPosition.y);
const pz = Math.floor(playerPosition.z);

const blocks = [];
const baseSize = 11;
const blockType = 'sandstone';

// Build layer by layer, shrinking each level
for (let y = 0; y < Math.ceil(baseSize / 2); y++) {
    const layerSize = baseSize - (y * 2);
    const offset = y;

    for (let x = 0; x < layerSize; x++) {
        for (let z = 0; z < layerSize; z++) {
            blocks.push({
                x: px + offset + x,
                y: py + y,
                z: pz + offset + z,
                id: blockType
            });
        }
    }
}

return blocks;`
    }
];

export function findBestStructureExamples(userRequest: string, count: number = 2): typeof structureExamples {
    const request = userRequest.toLowerCase();

    const scored = structureExamples.map(example => {
        let score = 0;
        for (const keyword of example.keywords) {
            if (request.includes(keyword)) {
                score += 10;
            }
        }
        const descWords = example.description.toLowerCase().split(/\s+/);
        for (const word of descWords) {
            if (request.includes(word) && word.length > 3) {
                score += 2;
            }
        }
        return { example, score };
    });

    scored.sort((a, b) => b.score - a.score);

    if (scored[0].score === 0) {
        return [structureExamples[0], structureExamples[2]]; // House and Sphere as defaults
    }

    return scored.slice(0, count).map(s => s.example);
}

// Block types available in the game
export const availableBlocks = [
    'stone', 'cobblestone', 'stone_bricks', 'mossy_stone_bricks',
    'grass', 'dirt', 'sand', 'sandstone', 'gravel',
    'oak_log', 'oak_planks', 'oak_fence', 'birch_log', 'birch_planks',
    'glass', 'glass_pane',
    'brick', 'clay',
    'wool_white', 'wool_red', 'wool_blue', 'wool_green', 'wool_yellow', 'wool_black',
    'iron_block', 'gold_block', 'diamond_block', 'emerald_block',
    'obsidian', 'glowstone', 'lamp',
    'water', 'lava',
    'ice', 'snow',
    'air' // Use to remove blocks
];
