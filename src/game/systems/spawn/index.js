/**
 * Spawn System - Module exports
 *
 * This module provides all spawn-related functionality:
 * - SpawnConfig: Configuration data for biome/world spawns
 * - SpawnPositionUtils: Position finding and validation utilities
 * - EntityRegistry: Entity tracking and lookup
 * - CreatureFilterManager: Creature whitelist/blacklist management
 */

// Configuration
export {
    BIOME_SPAWN_CONFIG,
    RARE_SPAWNS,
    HOSTILE_MOBS,
    WORLD_SPAWN_CONFIG,
    MOON_CREATURES,
    SPAWN_LIMITS
} from './SpawnConfig.js';

// Position utilities
export {
    findGroundLevel,
    findGroundLevelForWorld,
    findTreeSpawnPosition,
    calculateSpawnY,
    isAquatic,
    isUnderwater,
    AQUATIC_TYPES,
    UNDERWATER_TYPES
} from './SpawnPositionUtils.js';

// Entity management
export { EntityRegistry } from './EntityRegistry.js';

// Creature filtering
export { CreatureFilterManager } from './CreatureFilterManager.js';
