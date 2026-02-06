/**
 * ShooterScript - Allows a game object to fire projectiles
 *
 * @description Enables entities to fire registered projectiles with configurable
 * speed, spread, and cooldown. Works with VoxelWorld.spawn for SDK projectiles.
 *
 * @example
 * // Create a wand that shoots fireballs
 * obj.attach('shooter', {
 *   projectile: 'fireball',
 *   speed: 25,
 *   spread: 0.5,
 *   cooldown: 300
 * });
 */
import * as THREE from 'three';

/** @type {number} Default projectile speed in units/second */
const DEFAULT_SPEED = 20;
/** @type {number} Default cooldown between shots in milliseconds */
const DEFAULT_COOLDOWN_MS = 500;
/** @type {number} Offset to spawn projectile in front of shooter */
const SPAWN_OFFSET = 1.0;
/** @type {number} Height offset when shooting from player */
const PLAYER_HEIGHT_OFFSET = 1.5;

export const ShooterScript = {
    type: 'ShooterScript',

    // ===== CONFIG =====
    /** @type {string|null} Projectile ID to spawn (must be registered with VoxelWorld) */
    projectile: null,
    /** @type {number} Projectile speed in units/second */
    speed: DEFAULT_SPEED,
    /** @type {number} Random spread amount (0 = perfectly accurate) */
    spread: 0,
    /** @type {number} Cooldown between shots in milliseconds */
    cooldown: DEFAULT_COOLDOWN_MS,

    // ===== STATE =====
    /** @type {number} Timestamp of last fire */
    _lastFireTime: 0,

    /**
     * Called when the script starts
     */
    Start() {
        this._lastFireTime = 0;
    },

    /**
     * Called when the item/object is used by a player
     * @param {Object} player - The player using the object
     * @returns {boolean} Whether the shot was fired
     */
    OnUse(player) {
        return this.Fire(player);
    },

    // ===== PUBLIC METHODS =====

    /**
     * Fire a projectile
     * @param {Object} [shooter] - The entity firing (player or other). If null, fires from this object.
     * @returns {boolean} Whether the shot was fired (false if on cooldown)
     */
    Fire(shooter) {
        const now = Date.now();
        if (now - this._lastFireTime < this.cooldown) {
            return false;
        }
        this._lastFireTime = now;

        const game = this.gameObject.game || window.__VOXEL_GAME__;
        if (!game) {
            console.warn('[ShooterScript] No game reference');
            return false;
        }

        // Get spawn position and direction
        let spawnPos, direction;

        if (shooter?.position) {
            // Shooting from a player/entity
            spawnPos = shooter.position.clone();
            spawnPos.y += PLAYER_HEIGHT_OFFSET;

            if (game.camera) {
                direction = new THREE.Vector3();
                game.camera.getWorldDirection(direction);
            } else {
                direction = new THREE.Vector3(0, 0, -1);
            }
        } else {
            // Shooting from this object
            spawnPos = this.gameObject.position.clone();
            direction = new THREE.Vector3(0, 0, -1);
            if (this.gameObject.mesh) {
                this.gameObject.mesh.getWorldDirection(direction);
            }
        }

        // Move spawn point forward to avoid self-collision
        spawnPos.add(direction.clone().multiplyScalar(SPAWN_OFFSET));

        // Calculate velocity with spread
        const velocity = direction.clone().multiplyScalar(this.speed);
        if (this.spread > 0) {
            velocity.x += (Math.random() - 0.5) * this.spread;
            velocity.y += (Math.random() - 0.5) * this.spread;
            velocity.z += (Math.random() - 0.5) * this.spread;
        }

        // Spawn projectile
        if (window.VoxelWorld?.spawn && this.projectile) {
            window.VoxelWorld.spawn(this.projectile, spawnPos.x, spawnPos.y, spawnPos.z, {
                velocity: velocity
            });
        } else if (game.spawnMagicProjectile) {
            // Fallback to legacy projectile
            game.spawnMagicProjectile(spawnPos, velocity);
        }

        return true;
    },

    /**
     * Check if the shooter can fire (not on cooldown)
     * @returns {boolean} Whether a shot can be fired
     */
    CanFire() {
        return Date.now() - this._lastFireTime >= this.cooldown;
    },

    /**
     * Get remaining cooldown time in milliseconds
     * @returns {number} Milliseconds until next shot is available (0 if ready)
     */
    GetCooldownRemaining() {
        const elapsed = Date.now() - this._lastFireTime;
        return Math.max(0, this.cooldown - elapsed);
    },

    // Aliases for backwards compatibility
    fire(shooter) { return this.Fire(shooter); },
    canFire() { return this.CanFire(); }
};

export default ShooterScript;
