/**
 * Game Constants
 * Shared configuration and magic numbers.
 */

// Biome teleportation search
export const BIOME_SEARCH_MAX_RADIUS = 2000;
export const BIOME_SEARCH_STEP = 50;
export const BIOME_SEARCH_ANGLES = 16; // divisions of 2π

// Creature detection and spawning
export const CREATURE_DETECTION_RADIUS = 150;
export const MAX_SPAWN_COUNT = 10;

// Biome name aliases (for teleportation)
export const BIOME_ALIASES = {
    'desert': 'DESERT',
    'dessert': 'DESERT', // Common typo
    'ocean': 'OCEAN',
    'sea': 'OCEAN',
    'water': 'OCEAN',
    'forest': 'FOREST',
    'woods': 'FOREST',
    'jungle': 'JUNGLE',
    'mountain': 'MOUNTAIN',
    'mountains': 'MOUNTAIN',
    'peak': 'MOUNTAIN',
    'snow': 'SNOW',
    'snowy': 'SNOW',
    'tundra': 'SNOW',
    'arctic': 'SNOW',
    'plains': 'PLAINS',
    'grassland': 'PLAINS'
};

// Creature name aliases
export const CREATURE_ALIASES = {
    'rabbit': 'Bunny',
    'hare': 'Bunny',
    'dog': 'GoldenRetriever',
    'pup': 'GoldenRetriever',
    'puppy': 'GoldenRetriever',
    'bird': 'Toucan',
    'ducky': 'Duck'
};
