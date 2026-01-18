
/**
 * Game Configuration
 * Centralized constants for easy balancing and tuning.
 */

export const Config = {
    // World
    WORLD: {
        CHUNK_SIZE: 16,
        RENDER_DISTANCE: 6, // PERFORMANCE: Reduced from 8 for better FPS
        GRAVITY: 0.0032,
        SEA_LEVEL: 30,
        BEDROCK_LEVEL: 0,
        MAX_HEIGHT: 256,
        WORLD_RADIUS_CHUNKS: 48, // Finite world radius (chunks) - doubled for larger world
        MOON_CHUNK_Y_START: 40, // Height (in chunks) where moon generation starts
        MOON_CHUNK_HEIGHT: 8,   // Vertical thickness of Moon chunks range

        // Alien World 1: Crystal World (purple/pink crystalline terrain)
        CRYSTAL_WORLD_Y_START: 50,  // Y chunks 50-58
        CRYSTAL_WORLD_HEIGHT: 8,

        // Alien World 2: Lava World (volcanic terrain)
        LAVA_WORLD_Y_START: 60,     // Y chunks 60-68
        LAVA_WORLD_HEIGHT: 8,

        // Soccer World (Rocket League style arena)
        SOCCER_WORLD_Y_START: 70,   // Y chunks 70-78
        SOCCER_WORLD_HEIGHT: 8
    },

    // Player
    PLAYER: {
        SPEED: 0.08,
        SPRINT_MULTIPLIER: 1.5,
        JUMP_FORCE: 0.15,
        HEIGHT: 1.8,
        WIDTH: 0.6,
        EYE_HEIGHT: 1.6,
        REACH: 5,
        MAX_HEALTH: 20,
        MAX_HUNGER: 20,
        SPAWN_POINT: { x: 32, y: 80, z: 32 }
    },

    // UI
    UI: {
        CROSSHAIR_SIZE: 20,
        DEBUG: true
    },

    // World Gen Probabilities
    GENERATION: {
        ORE_COAL: 0.07,
        ORE_IRON: 0.04,
        ORE_GOLD: 0.015,
        ORE_DIAMOND: 0.005,
        CAVE_THRESHOLD: 0.35,
        ENABLE_RIVERS: true  // Rivers enabled
    }
};
