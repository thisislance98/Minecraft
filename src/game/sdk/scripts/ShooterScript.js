/**
 * ShooterScript - Allows a game object to fire projectiles
 */
import * as THREE from 'three';

export const ShooterScript = {
    type: 'ShooterScript',

    // Config
    projectile: null,     // Projectile ID to spawn
    speed: 20,
    spread: 0,
    cooldown: 500,        // ms between shots

    // State
    _lastFireTime: 0,

    start(obj) {
        // Nothing to initialize
    },

    onUse(obj, player) {
        return this.fire(player);
    },

    // Public methods
    fire(shooter) {
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

        if (shooter && shooter.position) {
            // Shooting from a player/entity
            spawnPos = shooter.position.clone();
            spawnPos.y += 1.5;

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

        // Move spawn point forward
        spawnPos.add(direction.clone().multiplyScalar(1.0));

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

    canFire() {
        return Date.now() - this._lastFireTime >= this.cooldown;
    }
};

export default ShooterScript;
