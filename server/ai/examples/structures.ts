/**
 * Structure Examples for Few-Shot AI
 * Structures use set_blocks or fill_blocks to place blocks in the world
 * Uses semantic search to find the most relevant examples for each request
 */

import { semanticSearchExamples } from '../../services/SemanticSearch';

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
                    blocks.push({ x: baseX + x, y: baseY, z: baseZ + z, id: 'plank' });
                }
            }

            // Walls
            for (let y = 1; y <= height; y++) {
                for (let x = 0; x < width; x++) {
                    // Front and back walls
                    if (!(x === 3 && y <= 2)) { // Leave door opening
                        blocks.push({ x: baseX + x, y: baseY + y, z: baseZ, id: 'plank' });
                    }
                    blocks.push({ x: baseX + x, y: baseY + y, z: baseZ + depth - 1, id: 'plank' });
                }
                for (let z = 1; z < depth - 1; z++) {
                    // Side walls
                    blocks.push({ x: baseX, y: baseY + y, z: baseZ + z, id: 'plank' });
                    blocks.push({ x: baseX + width - 1, y: baseY + y, z: baseZ + z, id: 'plank' });
                }
            }

            // Windows (glass in middle of side walls)
            blocks.push({ x: baseX, y: baseY + 2, z: baseZ + 3, id: 'glass' });
            blocks.push({ x: baseX + width - 1, y: baseY + 2, z: baseZ + 3, id: 'glass' });

            // Roof (sloped using stairs would be complex, use slabs)
            for (let x = -1; x <= width; x++) {
                for (let z = -1; z <= depth; z++) {
                    blocks.push({ x: baseX + x, y: baseY + height + 1, z: baseZ + z, id: 'plank' });
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
        blocks.push({ x: px + x, y: py, z: pz + z, id: 'plank' });
    }
}

// Walls (with door opening at front center)
for (let y = 1; y <= height; y++) {
    for (let x = 0; x < width; x++) {
        if (!(x === 3 && y <= 2)) { // Door opening
            blocks.push({ x: px + x, y: py + y, z: pz, id: 'plank' });
        }
        blocks.push({ x: px + x, y: py + y, z: pz + depth - 1, id: 'plank' });
    }
    for (let z = 1; z < depth - 1; z++) {
        blocks.push({ x: px, y: py + y, z: pz + z, id: 'plank' });
        blocks.push({ x: px + width - 1, y: py + y, z: pz + z, id: 'plank' });
    }
}

// Windows
blocks.push({ x: px, y: py + 2, z: pz + 3, id: 'glass' });
blocks.push({ x: px + width - 1, y: py + 2, z: pz + 3, id: 'glass' });

// Roof
for (let x = -1; x <= width; x++) {
    for (let z = -1; z <= depth; z++) {
        blocks.push({ x: px + x, y: py + height + 1, z: pz + z, id: 'plank' });
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
                    id: isWindow ? 'glass' : 'stone_brick'
                });
            }
            // Floor at bottom and top
            if ((y === 0 || y === height) && dist < radius) {
                blocks.push({ x: px + x, y: py + y, z: pz + z, id: 'stone_brick' });
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
                blocks.push({ x: px + x, y: py + height + 1, z: pz + z, id: 'stone_brick' });
            }
        }
    }
}

return blocks;`
    },
    {
        name: "Sphere",
        description: "A solid or hollow sphere made of blocks - use concrete_COLOR for colored spheres",
        keywords: ["sphere", "ball", "globe", "round", "orb", "dome"],
        code: `// Sphere generation - use concrete_COLOR or wool_COLOR for colors
const cx = Math.floor(playerPosition.x) + 8; // Center position
const cy = Math.floor(playerPosition.y) + 5; // Elevated
const cz = Math.floor(playerPosition.z);
const radius = 5;
const hollow = true; // Set to false for solid
// For colored spheres use: concrete_red, concrete_blue, concrete_green, etc.
// Or wool_red, wool_blue, wool_green, etc.
const blockType = 'concrete_red'; // Change this for different colors!

const blocks = [];

for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
        for (let z = -radius; z <= radius; z++) {
            const dist = Math.sqrt(x * x + y * y + z * z);
            if (hollow) {
                // Shell only (between radius-1 and radius)
                if (dist >= radius - 1 && dist <= radius) {
                    blocks.push({ x: cx + x, y: cy + y, z: cz + z, id: blockType });
                }
            } else {
                // Solid sphere
                if (dist <= radius) {
                    blocks.push({ x: cx + x, y: cy + y, z: cz + z, id: blockType });
                }
            }
        }
    }
}

return blocks;`
    },
    {
        name: "ColoredSphere",
        description: "A red concrete sphere - example of using colored blocks",
        keywords: ["red", "blue", "green", "yellow", "colored", "color"],
        code: `// Red sphere using concrete blocks
const cx = Math.floor(playerPosition.x) + 8;
const cy = Math.floor(playerPosition.y) + 5;
const cz = Math.floor(playerPosition.z);
const radius = 5;
// IMPORTANT: Use concrete_COLOR or wool_COLOR for colors
// Available colors: red, blue, green, yellow, orange, purple, pink, black, white, gray, brown, cyan
const blockType = 'concrete_red'; // concrete_blue, concrete_green, wool_red, etc.

const blocks = [];

for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
        for (let z = -radius; z <= radius; z++) {
            const dist = Math.sqrt(x * x + y * y + z * z);
            // Solid sphere
            if (dist <= radius) {
                blocks.push({ x: cx + x, y: cy + y, z: cz + z, id: blockType });
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
        blocks.push({ x: px + x, y: py, z: pz + z, id: 'plank' });
    }
}

// Railings
for (let x = 0; x < length; x++) {
    // Posts every 3 blocks
    if (x % 3 === 0) {
        blocks.push({ x: px + x, y: py + 1, z: pz, id: 'fence' });
        blocks.push({ x: px + x, y: py + 1, z: pz + width - 1, id: 'fence' });
    }
}

// Support pillars at ends
for (let y = -1; y >= -5; y--) {
    blocks.push({ x: px, y: py + y, z: pz + 1, id: 'log' });
    blocks.push({ x: px + length - 1, y: py + y, z: pz + 1, id: 'log' });
}

return blocks;`
    },
    {
        name: "TargetRange",
        description: "An archery or shooting target range with bullseye targets, lanes, and a covered shooting area",
        keywords: ["target", "range", "archery", "shooting", "bullseye", "practice", "bow", "arrow", "aim", "sport"],
        code: `// Target Range generation
const px = Math.floor(playerPosition.x) + 3;
const py = Math.floor(playerPosition.y);
const pz = Math.floor(playerPosition.z) - 6;

const blocks = [];
const length = 20; // Range length (depth)
const width = 13;  // Range width (3 lanes)
const laneWidth = 3;
const wallHeight = 4;

// Floor
for (let x = 0; x < length; x++) {
    for (let z = 0; z < width; z++) {
        // Lane divider lines in different color
        const isLaneLine = (z === laneWidth || z === laneWidth * 2 + 1 || z === width - 1 || z === 0);
        blocks.push({ x: px + x, y: py, z: pz + z, id: isLaneLine ? 'concrete_yellow' : 'stone_brick' });
    }
}

// Side walls
for (let y = 1; y <= wallHeight; y++) {
    for (let x = 0; x < length; x++) {
        blocks.push({ x: px + x, y: py + y, z: pz, id: 'stone_brick' });
        blocks.push({ x: px + x, y: py + y, z: pz + width - 1, id: 'stone_brick' });
    }
}

// Back wall behind targets
for (let y = 1; y <= wallHeight + 1; y++) {
    for (let z = 0; z < width; z++) {
        blocks.push({ x: px + length - 1, y: py + y, z: pz + z, id: 'stone_brick' });
    }
}

// Bullseye targets on the back wall (one per lane)
const targetCenters = [
    { z: pz + Math.floor(laneWidth / 2) + 1 },
    { z: pz + laneWidth + 1 + Math.floor(laneWidth / 2) },
    { z: pz + (laneWidth + 1) * 2 + Math.floor(laneWidth / 2) - 1 }
];
const targetX = px + length - 2;
const targetCenterY = py + 3;

for (const tc of targetCenters) {
    for (let dy = -2; dy <= 2; dy++) {
        for (let dz = -2; dz <= 2; dz++) {
            const dist = Math.sqrt(dy * dy + dz * dz);
            let color;
            if (dist <= 0.5) {
                color = 'concrete_yellow';  // Bullseye center
            } else if (dist <= 1.2) {
                color = 'concrete_red';     // Inner ring
            } else if (dist <= 2.0) {
                color = 'wool_white';       // Middle ring
            } else if (dist <= 2.5) {
                color = 'concrete_blue';    // Outer ring
            } else {
                continue;
            }
            blocks.push({ x: targetX, y: targetCenterY + dy, z: tc.z + dz, id: color });
        }
    }
}

// Covered shooting platform (roof over the near end)
for (let z = 1; z < width - 1; z++) {
    for (let x = 0; x < 4; x++) {
        blocks.push({ x: px + x, y: py + wallHeight + 1, z: pz + z, id: 'dark_oak_wood' });
    }
}

// Support posts for the roof
for (let y = 1; y <= wallHeight; y++) {
    blocks.push({ x: px, y: py + y, z: pz + 1, id: 'fence' });
    blocks.push({ x: px, y: py + y, z: pz + width - 2, id: 'fence' });
    blocks.push({ x: px + 3, y: py + y, z: pz + 1, id: 'fence' });
    blocks.push({ x: px + 3, y: py + y, z: pz + width - 2, id: 'fence' });
}

// Shooting line marker on the ground
for (let z = 1; z < width - 1; z++) {
    blocks.push({ x: px + 3, y: py, z: pz + z, id: 'concrete_red' });
}

// Glowstone lights on ceiling of covered area
blocks.push({ x: px + 1, y: py + wallHeight + 1, z: pz + 3, id: 'glowstone' });
blocks.push({ x: px + 1, y: py + wallHeight + 1, z: pz + width - 4, id: 'glowstone' });

return blocks;`
    },
    {
        name: "FarmPlot",
        description: "A fenced farm plot with farmland rows, water irrigation channel, wheat and carrot crops, and hay bale decorations",
        keywords: ["farm", "garden", "crop", "wheat", "field", "agriculture", "harvest", "plant", "farming", "crops", "carrot", "hay"],
        code: `// Farm Plot generation - fenced crop field with irrigation
const px = Math.floor(playerPosition.x) + 5;
const py = Math.floor(playerPosition.y);
const pz = Math.floor(playerPosition.z) - 4;

const blocks = [];
const plotW = 11;
const plotD = 9;

// Farmland base with water channel in the middle
for (let x = 0; x < plotW; x++) {
    for (let z = 0; z < plotD; z++) {
        if (z === 4) {
            // Water irrigation channel
            blocks.push({ x: px + x, y: py - 1, z: pz + z, id: 'water' });
        } else {
            blocks.push({ x: px + x, y: py - 1, z: pz + z, id: 'farmland' });
        }
    }
}

// Plant crops in alternating rows
const cropTypes = ['wheat', 'carrots'];
for (let x = 1; x < plotW - 1; x++) {
    let rowIdx = 0;
    for (let z = 0; z < plotD; z++) {
        if (z === 4) continue; // Skip water channel
        const crop = cropTypes[rowIdx % 2];
        blocks.push({ x: px + x, y: py, z: pz + z, id: crop });
        rowIdx++;
    }
}

// Fence border
for (let x = -1; x <= plotW; x++) {
    blocks.push({ x: px + x, y: py, z: pz - 1, id: 'fence' });
    blocks.push({ x: px + x, y: py, z: pz + plotD, id: 'fence' });
}
for (let z = 0; z < plotD; z++) {
    blocks.push({ x: px - 1, y: py, z: pz + z, id: 'fence' });
    blocks.push({ x: px + plotW, y: py, z: pz + z, id: 'fence' });
}

// Gate openings
blocks.push({ x: px + Math.floor(plotW / 2), y: py, z: pz - 1, id: 'air' });

// Hay bales at corners
blocks.push({ x: px, y: py, z: pz - 1, id: 'hay_bale' });
blocks.push({ x: px + plotW - 1, y: py, z: pz - 1, id: 'hay_bale' });
blocks.push({ x: px, y: py, z: pz + plotD, id: 'hay_bale' });
blocks.push({ x: px + plotW - 1, y: py, z: pz + plotD, id: 'hay_bale' });

// Pumpkins at ends for decoration
blocks.push({ x: px + 2, y: py, z: pz + plotD, id: 'pumpkin' });
blocks.push({ x: px + plotW - 3, y: py, z: pz + plotD, id: 'pumpkin' });

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

/**
 * Find the best matching structure examples using semantic search
 * @param userRequest - The user's structure creation request
 * @param count - Number of examples to return (default 2)
 * @returns Promise resolving to array of best matching examples
 */
export async function findBestStructureExamples(userRequest: string, count: number = 2): Promise<typeof structureExamples> {
    if (structureExamples.length === 0) {
        return [];
    }

    try {
        const results = await semanticSearchExamples(userRequest, structureExamples, count);

        // If no good semantic matches, return defaults
        if (results.length === 0) {
            console.log(`[StructureExamples] No semantic matches, returning defaults`);
            return [structureExamples[0], structureExamples[2]]; // House and Sphere as defaults
        }

        return results.map(r => r.example);
    } catch (error) {
        console.error('[StructureExamples] Semantic search failed, returning defaults:', error);
        return [structureExamples[0], structureExamples[2]];
    }
}

// Block types available in the game (must match src/game/core/Blocks.js)
export const availableBlocks = [
    // Basic blocks
    'stone', 'cobblestone', 'stone_brick', 'mossy_stone',
    'grass', 'dirt', 'sand', 'sandstone', 'gravel', 'clay',
    // Wood
    'log', 'plank', 'fence', 'birch_wood', 'pine_wood', 'dark_oak_wood',
    // Transparent
    'glass',
    // Building
    'brick',
    // Wool (colored blocks - use these for colored structures!)
    'wool_white', 'wool_red', 'wool_orange', 'wool_yellow', 'wool_green',
    'wool_blue', 'wool_purple', 'wool_pink', 'wool_black', 'wool_gray',
    'wool_brown', 'wool_cyan',
    // Concrete (smoother colored blocks)
    'concrete_white', 'concrete_red', 'concrete_orange', 'concrete_yellow',
    'concrete_green', 'concrete_blue', 'concrete_purple', 'concrete_pink',
    'concrete_black', 'concrete_gray', 'concrete_brown', 'concrete_cyan',
    // Farming
    'farmland', 'wheat', 'carrots', 'hay_bale', 'pumpkin',
    // Special
    'gold_block', 'diamond_block',
    'obsidian', 'glowstone',
    'water', 'snow',
    'air' // Use to remove blocks
];
