/**
 * SpawnConfig - Configuration data for entity spawning
 *
 * Pure data module - no logic, just spawn tables and configurations.
 * Each entry format: { type: 'ClassName', weight: 0-1, packSize: [min, max], biomes?: ['BIOME1', ...] }
 *
 * NOTE: Birds, Butterflies, Mosquitoes are BoidManager-based (not Animal subclasses)
 * and must be instantiated separately, not via SpawnManager.
 */

// Biome-specific spawn configurations
export const BIOME_SPAWN_CONFIG = {
    OCEAN: [
        { type: 'Fish', weight: 0.6, packSize: [2, 5] }
    ],
    BEACH: [
        { type: 'Bunny', weight: 0.3, packSize: [2, 4] },
        { type: 'Fox', weight: 0.3, packSize: [1, 2] }
    ],
    PLAINS: [
        { type: 'Cow', weight: 0.25, packSize: [2, 4] },
        { type: 'Pig', weight: 0.25, packSize: [2, 4] },
        { type: 'Chicken', weight: 0.3, packSize: [2, 5] },
        { type: 'Deer', weight: 0.15, packSize: [1, 3] },
        { type: 'Bee', weight: 0.15, packSize: [1, 1] },
        { type: 'Eagle', weight: 0.1, packSize: [1, 2] },
        { type: 'Dragon', weight: 0.05, packSize: [1, 1] },
        { type: 'BouncePod', weight: 0.1, packSize: [1, 2] },
        { type: 'HummingBlossom', weight: 0.1, packSize: [1, 2] }
    ],
    FOREST: [
        { type: 'Deer', weight: 0.3, packSize: [1, 3] },
        { type: 'Fox', weight: 0.25, packSize: [1, 2] },
        { type: 'Bunny', weight: 0.25, packSize: [2, 4] },
        { type: 'Bear', weight: 0.1, packSize: [1, 2] },
        { type: 'Firefly', weight: 0.2, packSize: [1, 1] },
        { type: 'Eagle', weight: 0.1, packSize: [1, 2] },
        { type: 'Dragon', weight: 0.05, packSize: [1, 1] },
        { type: 'ShyPlant', weight: 0.15, packSize: [1, 3] },
        { type: 'SnapTrap', weight: 0.1, packSize: [1, 2] },
        { type: 'SporeCloud', weight: 0.1, packSize: [1, 2] },
        { type: 'MimicVine', weight: 0.1, packSize: [1, 2] }
    ],
    JUNGLE: [
        { type: 'Eagle', weight: 0.25, packSize: [1, 2] },
        { type: 'Elephant', weight: 0.2, packSize: [1, 2] },
        { type: 'Bee', weight: 0.2, packSize: [1, 1] },
        { type: 'SnapTrap', weight: 0.15, packSize: [1, 3] },
        { type: 'MimicVine', weight: 0.15, packSize: [1, 2] },
        { type: 'SporeCloud', weight: 0.1, packSize: [1, 2] },
        { type: 'HummingBlossom', weight: 0.1, packSize: [1, 2] },
        { type: 'HelicopterPlant', weight: 0.1, packSize: [1, 1] }
    ],
    DESERT: [
        { type: 'Eagle', weight: 0.4, packSize: [1, 2] },
        { type: 'Fox', weight: 0.15, packSize: [1, 1] }
    ],
    SNOW: [
        { type: 'Bunny', weight: 0.3, packSize: [2, 4] },
        { type: 'Fox', weight: 0.2, packSize: [1, 2] },
        { type: 'Bear', weight: 0.1, packSize: [1, 1] },
        { type: 'Deer', weight: 0.2, packSize: [1, 3] }
    ],
    MOUNTAIN: [
        { type: 'Eagle', weight: 0.4, packSize: [1, 2] },
        { type: 'Bear', weight: 0.15, packSize: [1, 1] },
        { type: 'Fox', weight: 0.15, packSize: [1, 2] },
        { type: 'Dragon', weight: 0.1, packSize: [1, 1] },
        { type: 'CrystalPlant', weight: 0.15, packSize: [1, 3] }
    ]
};

// Rare spawns (can occur in any biome, or biome-restricted)
export const RARE_SPAWNS = [
    { type: 'Villager', weight: 0.05, packSize: [1, 3], biomes: ['PLAINS', 'FOREST'] },
    { type: 'Elephant', weight: 0.03, packSize: [1, 2], biomes: ['PLAINS', 'JUNGLE'] }
];

// Hostile mobs (night-time spawns)
export const HOSTILE_MOBS = [];

// Alien World spawn configurations
export const WORLD_SPAWN_CONFIG = {
    CRYSTAL_WORLD: [],
    LAVA_WORLD: []
};

// Moon world special creatures
export const MOON_CREATURES = [];

// Spawn limits
export const SPAWN_LIMITS = {
    MAX_ANIMALS: 200,
    CHUNK_SIZE: 16,
    SPAWN_RADIUS: 3 // chunks
};
