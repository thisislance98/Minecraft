
/**
 * Game Configuration
 * Centralized constants for easy balancing and tuning.
 */

export const Config = {
    // World
    WORLD: {
        CHUNK_SIZE: 16,
        RENDER_DISTANCE: 8,
        GRAVITY: 0.0032,
        SEA_LEVEL: 30,
        BEDROCK_LEVEL: 0,
        MAX_HEIGHT: 256,
        WORLD_RADIUS_CHUNKS: 24, // Finite world radius (chunks)
        MOON_CHUNK_Y_START: 40, // Height (in chunks) where moon generation starts
        MOON_CHUNK_HEIGHT: 8   // Vertical thickness of Moon chunks range
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
        CAVE_THRESHOLD: 0.35
    }
};
