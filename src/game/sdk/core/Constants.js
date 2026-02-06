/**
 * SDK Constants - Centralized configuration values
 *
 * @description All magic numbers and configuration constants for the SDK.
 * Import these instead of hardcoding values in scripts.
 */

// ===== PHYSICS =====

/** @type {number} Default gravity acceleration (units/s²) */
export const GRAVITY = 20;

/** @type {number} Default movement speed (units/s) */
export const DEFAULT_SPEED = 3;

/** @type {number} Default jump height multiplier */
export const JUMP_MULTIPLIER = 5;

/** @type {number} Ground friction multiplier (0-1) */
export const GROUND_FRICTION = 0.9;

/** @type {number} Air friction multiplier (0-1) */
export const AIR_FRICTION = 0.95;

/** @type {number} Water friction multiplier (0-1) */
export const WATER_FRICTION = 0.98;

// ===== AI =====

/** @type {number} Default AI detection range (units) */
export const AI_DETECTION_RANGE = 8;

/** @type {number} Default AI attack range (units) */
export const AI_ATTACK_RANGE = 2;

/** @type {number} Default flee trigger range (units) */
export const AI_FLEE_RANGE = 6;

/** @type {number} Default wander radius from home (units) */
export const AI_WANDER_RADIUS = 10;

/** @type {number} Minimum idle time (seconds) */
export const AI_IDLE_TIME_MIN = 2;

/** @type {number} Maximum idle time (seconds) */
export const AI_IDLE_TIME_MAX = 5;

/** @type {number} Minimum walk time (seconds) */
export const AI_WALK_TIME_MIN = 1;

/** @type {number} Maximum walk time (seconds) */
export const AI_WALK_TIME_MAX = 4;

/** @type {number} Chance to start walking when idle (0-1) */
export const AI_WALK_CHANCE = 0.7;

/** @type {number} Stuck detection threshold (units moved in 1 second) */
export const AI_STUCK_THRESHOLD = 0.1;

// ===== HEALTH =====

/** @type {number} Default max health */
export const DEFAULT_MAX_HEALTH = 20;

/** @type {number} Default damage dealt */
export const DEFAULT_DAMAGE = 5;

/** @type {number} Default invulnerability duration (seconds) */
export const INVULN_DURATION = 0.5;

/** @type {number} Default health regeneration rate (HP/second) */
export const REGEN_RATE = 1;

// ===== PROJECTILES =====

/** @type {number} Default projectile lifetime (seconds) */
export const PROJECTILE_LIFETIME = 3;

/** @type {number} Default projectile damage */
export const PROJECTILE_DAMAGE = 10;

/** @type {number} Default projectile speed (units/s) */
export const PROJECTILE_SPEED = 20;

/** @type {number} Projectile collision radius (units) */
export const PROJECTILE_COLLISION_RADIUS = 1.0;

// ===== SHOOTER =====

/** @type {number} Default cooldown between shots (ms) */
export const SHOOTER_COOLDOWN = 500;

/** @type {number} Projectile spawn offset from shooter (units) */
export const SHOOTER_SPAWN_OFFSET = 1.0;

/** @type {number} Height offset when player shoots (units) */
export const SHOOTER_PLAYER_HEIGHT_OFFSET = 1.5;

// ===== PARTICLES =====

/** @type {number} Default trail particle rate (particles/second) */
export const PARTICLE_TRAIL_RATE = 10;

/** @type {number} Default burst particle count */
export const PARTICLE_BURST_COUNT = 20;

/** @type {number} Trail particle spread */
export const PARTICLE_TRAIL_SPREAD = 0.1;

/** @type {number} Burst particle spread */
export const PARTICLE_BURST_SPREAD = 1.0;

/** @type {number} Trail particle lifetime (seconds) */
export const PARTICLE_TRAIL_LIFETIME = 0.5;

/** @type {number} Burst particle lifetime (seconds) */
export const PARTICLE_BURST_LIFETIME = 1.0;

/** @type {number} Default trail particle size */
export const PARTICLE_TRAIL_SIZE = 0.1;

/** @type {number} Default burst particle size */
export const PARTICLE_BURST_SIZE = 0.15;

// ===== ANIMATION =====

/** @type {number} Default animation speed */
export const ANIMATION_DEFAULT_SPEED = 5;

/** @type {number} Walking animation leg swing angle (radians) */
export const LEG_SWING_ANGLE = 0.5;

/** @type {number} Walking animation speed multiplier */
export const WALK_ANIM_SPEED = 8;

// ===== SPAWN =====

/** @type {number} Default spawn distance from player (units) */
export const SPAWN_DISTANCE_FROM_PLAYER = 8;

/** @type {number} Default spawn height above ground (units) */
export const SPAWN_HEIGHT_OFFSET = 1;

/** @type {number} Fallback spawn Y when no terrain data (units) */
export const SPAWN_FALLBACK_Y = 50;

// ===== COLLISION =====

/** @type {number} Default entity width (units) */
export const DEFAULT_ENTITY_WIDTH = 0.8;

/** @type {number} Default entity height (units) */
export const DEFAULT_ENTITY_HEIGHT = 1.0;

// ===== RENDERING =====

/** @type {number} Damage flash duration (ms) */
export const DAMAGE_FLASH_DURATION = 100;

/** @type {number} Damage flash color (hex) */
export const DAMAGE_FLASH_COLOR = 0xff0000;

// ===== LIMITS =====

/** @type {number} Maximum entities in view query */
export const MAX_VIEW_DISTANCE = 100;

/** @type {number} Maximum blocks in fill operation */
export const MAX_FILL_BLOCKS = 10000;

/** @type {number} Maximum entities per type */
export const MAX_ENTITIES_PER_TYPE = 100;
