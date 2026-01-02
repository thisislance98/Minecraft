// Verify that blocks were placed near the player
// This checks if the AI actually called set_blocks

const game = window.__VOXEL_GAME__;
if (!game) return { success: false, message: 'Game not found' };

// Get player position
const playerPos = game.player?.position;
if (!playerPos) return { success: false, message: 'Player position not found' };

// Count non-terrain blocks near the player (within 20 block radius)
// These would be blocks placed by the AI
const radius = 20;
let placedBlockCount = 0;
const materialCounts = {};

// Access the world's block data
const world = game.world;
if (!world) return { success: false, message: 'World not found' };

// Scan the area around the player
for (let x = Math.floor(playerPos.x) - radius; x <= Math.floor(playerPos.x) + radius; x++) {
    for (let y = Math.floor(playerPos.y) - 5; y <= Math.floor(playerPos.y) + 15; y++) {
        for (let z = Math.floor(playerPos.z) - radius; z <= Math.floor(playerPos.z) + radius; z++) {
            const block = world.getBlock(x, y, z);
            if (block && block !== 'air') {
                // Check for building materials (not natural terrain)
                const buildingMaterials = ['plank', 'log', 'cobblestone', 'stone_brick', 'glass', 'door', 'thatch', 'wood'];
                const isBuildingBlock = buildingMaterials.some(mat => block.includes(mat));
                if (isBuildingBlock) {
                    placedBlockCount++;
                    materialCounts[block] = (materialCounts[block] || 0) + 1;
                }
            }
        }
    }
}

const materialSummary = Object.entries(materialCounts)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');

if (placedBlockCount > 10) {
    return {
        success: true,
        message: `Found ${placedBlockCount} building blocks: ${materialSummary}`
    };
} else {
    return {
        success: false,
        message: `Only found ${placedBlockCount} building blocks. Expected >10 for a hut. Materials: ${materialSummary || 'none'}`
    };
}
