/**
 * SpawnPositionUtils - Utility functions for finding valid spawn positions
 *
 * Handles terrain queries, ground detection, and position validation.
 */

import { Blocks } from '../../core/Blocks.js';
import { Config } from '../../core/Config.js';

// Block types to ignore when finding ground (trees)
const TREE_BLOCKS = [
    Blocks.LEAVES, Blocks.PINE_LEAVES, Blocks.BIRCH_LEAVES,
    Blocks.LOG, Blocks.PINE_LOG, Blocks.BIRCH_LOG,
    Blocks.PINE_WOOD, Blocks.BIRCH_WOOD
];

// Aquatic creature types that can spawn in water
export const AQUATIC_TYPES = ['Fish', 'Turtle', 'Duck', 'Shark', 'Dolphin', 'Starfish'];
export const UNDERWATER_TYPES = ['Fish', 'Shark', 'Dolphin'];

/**
 * Find valid ground level by checking actual blocks
 * @param {Object} game - Game instance
 * @param {number} x - World X coordinate
 * @param {number} y - Expected Y coordinate (hint - should be terrain surface)
 * @param {number} z - World Z coordinate
 * @returns {number|null} - Ground Y position (top of solid block + 1), or null if no ground
 */
export function findGroundLevel(game, x, y, z) {
    const checkX = Math.floor(x);
    const checkZ = Math.floor(z);

    // Get terrain height as reference
    const terrainY = Math.floor(game.worldGen.getTerrainHeight(x, z));

    // Start searching from well above expected ground to handle terrain mismatches
    const startY = Math.max(Math.floor(y) + 10, terrainY + 10);
    const minSearchY = Math.max(terrainY - 30, 1); // Don't go below bedrock area

    // Search downward from high up to find the first solid ground with air above
    for (let checkY = startY; checkY >= minSearchY; checkY--) {
        const block = game.getBlock(checkX, checkY, checkZ);

        if (block && block.type !== 'water') {
            // Ignore tree blocks - don't spawn on trees
            if (TREE_BLOCKS.includes(block.type)) {
                continue;
            }

            // Found solid ground - verify there's air above to stand in
            const blockAbove = game.getBlock(checkX, checkY + 1, checkZ);
            const blockAbove2 = game.getBlock(checkX, checkY + 2, checkZ);

            // Need at least 1 block of air above, and not water
            if (!blockAbove || blockAbove.type === 'air') {
                // Also check that there's not water above
                if (blockAbove && blockAbove.type === 'water') continue;
                if (blockAbove2 && blockAbove2.type === 'water') continue;

                return checkY + 1;
            }
        }
    }

    // No valid ground found (chunk probably not loaded)
    return null;
}

/**
 * Find ground level for alien worlds at a specific Y base
 * @param {Object} game - Game instance
 * @param {number} x - World X coordinate
 * @param {number} z - World Z coordinate
 * @param {number} worldYBase - Base Y coordinate of the world layer
 * @param {string} world - World type (CRYSTAL_WORLD, LAVA_WORLD, MOON)
 * @returns {number} - Spawn Y position
 */
export function findGroundLevelForWorld(game, x, z, worldYBase, world) {
    const checkX = Math.floor(x);
    const checkZ = Math.floor(z);
    const chunkSize = game.chunkSize || Config.WORLD.CHUNK_SIZE;

    // Calculate the world's Y range
    let worldHeight = 8 * chunkSize; // Default world thickness
    if (world === 'CRYSTAL_WORLD') {
        worldHeight = Config.WORLD.CRYSTAL_WORLD_HEIGHT * chunkSize;
    } else if (world === 'LAVA_WORLD') {
        worldHeight = Config.WORLD.LAVA_WORLD_HEIGHT * chunkSize;
    } else if (world === 'MOON') {
        worldHeight = Config.WORLD.MOON_CHUNK_HEIGHT * chunkSize;
    }

    const startY = worldYBase + worldHeight - 1;
    const minY = worldYBase;

    // Search downward from top of world to find solid ground
    for (let checkY = startY; checkY >= minY; checkY--) {
        const block = game.getBlock(checkX, checkY, checkZ);

        if (block && block.type !== 'air' && block.type !== 'water' && block.type !== 'lava') {
            // Found solid ground - check if there's air above
            const blockAbove = game.getBlock(checkX, checkY + 1, checkZ);
            const blockAbove2 = game.getBlock(checkX, checkY + 2, checkZ);

            if (!blockAbove || blockAbove.type === 'air') {
                if (!blockAbove2 || blockAbove2.type === 'air') {
                    return checkY + 1;
                }
            }
        }
    }

    // Fallback: use a reasonable default Y for this world
    return worldYBase + 30;
}

/**
 * Find a valid tree position for tree-dwelling animals
 * @param {Object} game - Game instance
 * @param {number} baseX - Center X coordinate
 * @param {number} baseZ - Center Z coordinate
 * @param {number} terrainY - Terrain height at position
 * @returns {Object|null} - {x, y, z} spawn position or null if no tree found
 */
export function findTreeSpawnPosition(game, baseX, baseZ, terrainY) {
    const searchRadius = 12;

    // Search in a spiral pattern for tree blocks
    for (let radius = 0; radius <= searchRadius; radius += 2) {
        for (let dx = -radius; dx <= radius; dx += 2) {
            for (let dz = -radius; dz <= radius; dz += 2) {
                const x = Math.floor(baseX + dx);
                const z = Math.floor(baseZ + dz);

                // Search upward from terrain for tree blocks
                for (let dy = 3; dy <= 20; dy++) {
                    const y = Math.floor(terrainY + dy);
                    const block = game.getBlock(x, y, z);

                    if (block && (block.type.includes('leaves') || block.type.includes('wood') || block.type.includes('log'))) {
                        // Check if there's space above for the animal
                        const aboveBlock = game.getBlock(x, y + 1, z);
                        if (!aboveBlock || aboveBlock.type.includes('leaves')) {
                            return { x: x + 0.5, y: y + 1, z: z + 0.5 };
                        }
                    }
                }
            }
        }
    }
    return null; // No tree found
}

/**
 * Calculate spawn position with ground snapping
 * @param {Object} game - Game instance
 * @param {Function} AnimalClass - The animal class to spawn
 * @param {number} x - Target X coordinate
 * @param {number} y - Target Y coordinate (hint)
 * @param {number} z - Target Z coordinate
 * @param {boolean} snapToGround - Whether to snap to ground
 * @returns {number|null} - Final Y position, or null if invalid
 */
export function calculateSpawnY(game, AnimalClass, x, y, z, snapToGround = true) {
    if (!snapToGround) {
        return y;
    }

    const groundY = findGroundLevel(game, x, y, z);
    const terrainY = game.worldGen.getTerrainHeight(x, z);

    if (groundY === null) {
        console.warn(`[SpawnPositionUtils] Failed to find ground for ${AnimalClass.name} at ${x.toFixed(1)}, ${z.toFixed(1)} (terrainY: ${terrainY.toFixed(1)})`);
        return null;
    }

    // Log if there's a big difference between expected and actual ground
    if (Math.abs(groundY - terrainY) > 3) {
        console.log(`[SpawnPositionUtils] ${AnimalClass.name} ground adjusted: terrain=${terrainY.toFixed(1)} -> actual=${groundY}`);
    }

    return groundY;
}

/**
 * Check if a creature type is aquatic
 * @param {string} typeName - The creature type name
 * @returns {boolean}
 */
export function isAquatic(typeName) {
    return AQUATIC_TYPES.includes(typeName);
}

/**
 * Check if a creature should spawn underwater
 * @param {string} typeName - The creature type name
 * @returns {boolean}
 */
export function isUnderwater(typeName) {
    return UNDERWATER_TYPES.includes(typeName);
}
