/**
 * SpawnConfig - Configuration data for entity spawning
 *
 * Pure data module - no logic, just spawn tables and configurations.
 * Each entry format: { type: 'ClassName', weight: 0-1, packSize: [min, max], biomes?: ['BIOME1', ...] }
 */

// Biome-specific spawn configurations
export const BIOME_SPAWN_CONFIG = {
    OCEAN: [
        { type: 'Starfish', weight: 0.2, packSize: [3, 8] },
        { type: 'Fish', weight: 0.5, packSize: [3, 7] },
        { type: 'Shark', weight: 0.1, packSize: [1, 2] },
        { type: 'Turtle', weight: 0.2, packSize: [1, 2] },
        { type: 'Dolphin', weight: 0.2, packSize: [3, 6] }
    ],
    BEACH: [
        { type: 'Turtle', weight: 0.3, packSize: [1, 2] },
        { type: 'Duck', weight: 0.3, packSize: [2, 4] },
        { type: 'Flamingo', weight: 0.3, packSize: [2, 5] },
        { type: 'Crocodile', weight: 0.1, packSize: [1, 2] }
    ],
    PLAINS: [
        { type: 'Horse', weight: 0.25, packSize: [3, 6] },
        { type: 'Pig', weight: 0.15, packSize: [2, 4] },
        { type: 'Chicken', weight: 0.15, packSize: [4, 7] },
        { type: 'Bunny', weight: 0.2, packSize: [2, 4] },
        { type: 'Fish', weight: 0.15, packSize: [3, 5] },
        { type: 'Duck', weight: 0.1, packSize: [2, 4] },
        { type: 'Sheep', weight: 0.2, packSize: [3, 5] },
        { type: 'Turkey', weight: 0.1, packSize: [2, 4] },
        { type: 'Mouse', weight: 0.15, packSize: [2, 4] },
        { type: 'Snake', weight: 0.1, packSize: [1, 3] },
        { type: 'Kangaroo', weight: 0.05, packSize: [1, 2] },
        { type: 'Cow', weight: 0.2, packSize: [2, 5] },
        { type: 'Fox', weight: 0.1, packSize: [1, 2] },
        { type: 'FireFox', weight: 0.05, packSize: [1, 1] },
        { type: 'Ladybug', weight: 0.15, packSize: [3, 6] },
        { type: 'Gymnast', weight: 0.05, packSize: [1, 2] },
        { type: 'Raccoon', weight: 0.08, packSize: [1, 2] },
        { type: 'WienerDog', weight: 0.15, packSize: [2, 3] },
        { type: 'GoldenRetriever', weight: 0.2, packSize: [1, 2] },
        { type: 'Cat', weight: 0.1, packSize: [1, 2] },
        { type: 'Hedgehog', weight: 0.1, packSize: [1, 2] },
        { type: 'Bee', weight: 0.15, packSize: [3, 5] },
        { type: 'Butterflies', weight: 0.2, packSize: [4, 8] },
        { type: 'Zebra', weight: 0.15, packSize: [3, 6] },
        { type: 'Ostrich', weight: 0.1, packSize: [2, 4] },
        { type: 'Rhinoceros', weight: 0.05, packSize: [1, 2] },
        { type: 'Eagle', weight: 0.05, packSize: [1, 1] }
    ],
    FOREST: [
        { type: 'Wolf', weight: 0.05, packSize: [2, 4] },
        { type: 'Bear', weight: 0.05, packSize: [1, 2] },
        { type: 'Deer', weight: 0.05, packSize: [2, 4] },
        { type: 'Squirrel', weight: 0.05, packSize: [3, 5] },
        { type: 'Duck', weight: 0.05, packSize: [2, 4] },
        { type: 'Chicken', weight: 0.05, packSize: [4, 7] },
        { type: 'Pig', weight: 0.05, packSize: [2, 4] },
        { type: 'Bunny', weight: 0.05, packSize: [2, 4] },
        { type: 'Lion', weight: 0.05, packSize: [1, 2] },
        { type: 'Tiger', weight: 0.05, packSize: [1, 2] },
        { type: 'Elephant', weight: 0.05, packSize: [1, 2] },
        { type: 'Giraffe', weight: 0.05, packSize: [1, 2] },
        { type: 'Horse', weight: 0.05, packSize: [3, 5] },
        { type: 'Monkey', weight: 0.05, packSize: [3, 5] },
        { type: 'Frog', weight: 0.05, packSize: [2, 4] },
        { type: 'Reindeer', weight: 0.05, packSize: [2, 4] },
        { type: 'Turtle', weight: 0.05, packSize: [1, 2] },
        { type: 'Turkey', weight: 0.1, packSize: [2, 4] },
        { type: 'Mouse', weight: 0.05, packSize: [2, 4] },
        { type: 'Snake', weight: 0.08, packSize: [1, 2] },
        { type: 'Cow', weight: 0.08, packSize: [2, 4] },
        { type: 'Snail', weight: 0.1, packSize: [2, 4] },
        { type: 'Fish', weight: 0.05, packSize: [2, 4] },
        { type: 'Fox', weight: 0.08, packSize: [1, 3] },
        { type: 'Ladybug', weight: 0.1, packSize: [2, 5] },
        { type: 'Toucan', weight: 0.08, packSize: [2, 4] },
        { type: 'Raccoon', weight: 0.08, packSize: [1, 3] },
        { type: 'GoldenRetriever', weight: 0.1, packSize: [1, 2] },
        { type: 'Owl', weight: 0.1, packSize: [1, 2] },
        { type: 'Firefly', weight: 0.2, packSize: [5, 10] },
        { type: 'Bee', weight: 0.15, packSize: [3, 6] },
        { type: 'Butterflies', weight: 0.2, packSize: [4, 8] },
        { type: 'Hedgehog', weight: 0.08, packSize: [1, 2] },
        { type: 'FlyingJellyfish', weight: 0.02, packSize: [1, 2] }
    ],
    JUNGLE: [
        { type: 'Monkey', weight: 0.3, packSize: [3, 6] },
        { type: 'Tiger', weight: 0.15, packSize: [1, 2] },
        { type: 'Frog', weight: 0.3, packSize: [2, 4] },
        { type: 'Fish', weight: 0.15, packSize: [3, 5] },
        { type: 'Turtle', weight: 0.1, packSize: [1, 2] },
        { type: 'Snake', weight: 0.2, packSize: [2, 4] },
        { type: 'Worm', weight: 0.25, packSize: [3, 6] },
        { type: 'Panda', weight: 0.15, packSize: [1, 2] },
        { type: 'Snail', weight: 0.15, packSize: [2, 5] },
        { type: 'Toucan', weight: 0.25, packSize: [3, 5] },
        { type: 'Flamingo', weight: 0.1, packSize: [2, 4] },
        { type: 'Mouse', weight: 0.1, packSize: [2, 3] },
        { type: 'Pangolin', weight: 0.15, packSize: [1, 2] },
        { type: 'Giraffifant', weight: 0.05, packSize: [1, 1] },
        { type: 'Butterflies', weight: 0.3, packSize: [5, 10] },
        { type: 'Hippopotamus', weight: 0.1, packSize: [1, 3] },
        { type: 'Crocodile', weight: 0.1, packSize: [1, 2] }
    ],
    DESERT: [
        { type: 'Bunny', weight: 0.3, packSize: [1, 3] },
        { type: 'Snake', weight: 0.4, packSize: [1, 2] },
        { type: 'Kangaroo', weight: 0.1, packSize: [1, 2] },
        { type: 'Camel', weight: 0.35, packSize: [2, 4] },
        { type: 'FennecFox', weight: 0.25, packSize: [2, 4] },
        { type: 'Mouse', weight: 0.15, packSize: [1, 3] },
        { type: 'Pangolin', weight: 0.2, packSize: [1, 3] },
        { type: 'Zebra', weight: 0.1, packSize: [2, 5] },
        { type: 'Eagle', weight: 0.1, packSize: [1, 1] },
        { type: 'Ostrich', weight: 0.15, packSize: [2, 4] }
    ],
    SNOW: [
        { type: 'Reindeer', weight: 0.3, packSize: [3, 5] },
        { type: 'Bear', weight: 0.15, packSize: [1, 1] },
        { type: 'Wolf', weight: 0.25, packSize: [2, 4] },
        { type: 'Snowman', weight: 0.3, packSize: [1, 3] },
        { type: 'Penguin', weight: 0.4, packSize: [3, 8] },
        { type: 'SantaClaus', weight: 0.1, packSize: [1, 1] },
        { type: 'Snowflake', weight: 0.2, packSize: [1, 3] }
    ],
    MOUNTAIN: [
        { type: 'Reindeer', weight: 0.3, packSize: [2, 4] },
        { type: 'Sheep', weight: 0.4, packSize: [2, 4] },
        { type: 'Goat', weight: 0.3, packSize: [1, 3] },
        { type: 'SantaClaus', weight: 0.05, packSize: [1, 1] },
        { type: 'Eagle', weight: 0.2, packSize: [1, 2] },
        { type: 'Owl', weight: 0.1, packSize: [1, 1] }
    ]
};

// Rare spawns (can occur in any biome, or biome-restricted)
export const RARE_SPAWNS = [
    { type: 'Elephant', weight: 0.02, packSize: [1, 2] },
    { type: 'Giraffe', weight: 0.02, packSize: [1, 2] },
    { type: 'Lion', weight: 0.02, packSize: [1, 2], biomes: ['PLAINS', 'DESERT'] },
    { type: 'Pugasus', weight: 0.03, packSize: [1, 2] },
    { type: 'Pegasus', weight: 0.03, packSize: [1, 2], biomes: ['PLAINS', 'MOUNTAIN', 'SNOW'] },
    { type: 'Unicorn', weight: 0.02, packSize: [1, 2], biomes: ['PLAINS', 'FOREST'] },
    { type: 'MagicalCreature', weight: 0.03, packSize: [1, 2], biomes: ['PLAINS', 'FOREST', 'JUNGLE'] },
    { type: 'TRex', weight: 0.02, packSize: [1, 1], biomes: ['JUNGLE', 'FOREST', 'PLAINS'] },
    { type: 'Dragon', weight: 0.02, packSize: [1, 1], biomes: ['MOUNTAIN', 'SNOW', 'PLAINS', 'DESERT'] },
    { type: 'Pumpkin', weight: 0.05, packSize: [3, 5], biomes: ['FOREST', 'PLAINS'] },
    { type: 'Lorax', weight: 0.1, packSize: [1, 1], biomes: ['FOREST'] },
    { type: 'Snowflake', weight: 0.05, packSize: [1, 2], biomes: ['SNOW', 'MOUNTAIN'] },
    { type: 'Chimera', weight: 0.03, packSize: [1, 1], biomes: ['PLAINS', 'JUNGLE', 'FOREST'] },
    { type: 'WienerDog', weight: 0.05, packSize: [1, 2], biomes: ['PLAINS', 'FOREST', 'DESERT'] },
    { type: 'GoldenRetriever', weight: 0.05, packSize: [1, 2], biomes: ['PLAINS', 'FOREST'] },
    { type: 'DuneWorm', weight: 0.05, packSize: [1, 1], biomes: ['DESERT'] },
    // Interactive Plants (Avatar-like)
    { type: 'HelicopterPlant', weight: 0.15, packSize: [3, 6], biomes: ['PLAINS', 'FOREST', 'JUNGLE'] },
    { type: 'ShyPlant', weight: 0.15, packSize: [4, 8], biomes: ['PLAINS', 'FOREST', 'JUNGLE'] },
    { type: 'CrystalPlant', weight: 0.1, packSize: [2, 5], biomes: ['MOUNTAIN', 'SNOW', 'DESERT'] },
    { type: 'HummingBlossom', weight: 0.12, packSize: [2, 4], biomes: ['PLAINS', 'FOREST', 'JUNGLE'] },
    { type: 'BouncePod', weight: 0.10, packSize: [2, 5], biomes: ['FOREST', 'JUNGLE'] },
    { type: 'MimicVine', weight: 0.10, packSize: [3, 6], biomes: ['JUNGLE', 'FOREST'] },
    { type: 'SporeCloud', weight: 0.12, packSize: [3, 5], biomes: ['PLAINS', 'FOREST', 'MOUNTAIN'] },
    { type: 'SnapTrap', weight: 0.08, packSize: [1, 3], biomes: ['JUNGLE', 'FOREST'] },
    { type: 'TigerBear', weight: 0.02, packSize: [1, 1], biomes: ['FOREST', 'MOUNTAIN'] },
    { type: 'PurpleCow', weight: 0.02, packSize: [2, 4], biomes: ['PLAINS'] },
    { type: 'FlyingPig', weight: 0.02, packSize: [1, 1], biomes: ['PLAINS', 'MOUNTAIN'] },
    { type: 'Rhinoceros', weight: 0.03, packSize: [1, 2], biomes: ['PLAINS', 'DESERT'] },
    { type: 'Hippopotamus', weight: 0.03, packSize: [1, 3], biomes: ['JUNGLE', 'PLAINS'] }
];

// Hostile mobs
export const HOSTILE_MOBS = [
    { type: 'Zombie', weight: 0.4, packSize: [2, 4] },
    { type: 'Skeleton', weight: 0.25, packSize: [1, 3] },
    { type: 'Creeper', weight: 0.25, packSize: [1, 2] }
];

// Alien World spawn configurations
export const WORLD_SPAWN_CONFIG = {
    CRYSTAL_WORLD: [
        { type: 'CrystalElemental', weight: 0.35, packSize: [1, 2] },
        { type: 'GlowBeetle', weight: 0.40, packSize: [3, 6] },
        { type: 'PrismDragon', weight: 0.15, packSize: [1, 1] }
    ],
    LAVA_WORLD: [
        { type: 'LavaGolem', weight: 0.30, packSize: [1, 2] },
        { type: 'FireSalamander', weight: 0.45, packSize: [2, 4] },
        { type: 'MagmaWurm', weight: 0.20, packSize: [1, 1] }
    ]
};

// Moon world special creatures
export const MOON_CREATURES = ['MoonRabbit', 'LunarMoth', 'StarJelly'];

// Spawn limits
export const SPAWN_LIMITS = {
    MAX_ANIMALS: 200,
    CHUNK_SIZE: 16,
    SPAWN_RADIUS: 3 // chunks
};
