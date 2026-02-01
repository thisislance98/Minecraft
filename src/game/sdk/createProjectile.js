/**
 * createProjectile - Simplified projectile creation
 */
import * as THREE from 'three';
import { buildMesh } from './core/MeshBuilder.js';

// Registry
export const projectiles = new Map();

/**
 * Create a projectile
 * @param {Object} config
 * @param {string} config.id - Required: snake_case id
 * @param {Array} config.mesh - Array of mesh parts
 * @param {number} config.speed - Projectile speed
 * @param {number} config.gravity - Gravity (0 = none)
 * @param {number} config.lifetime - Seconds before expire
 * @param {number} config.damage - Damage on hit
 * @param {Object} config.particles - { trail, color, count }
 * @param {Function} config.onHit - Called on impact
 * @param {Function} config.onUpdate - Called every frame
 */
export function createProjectile(config) {
    if (!config.id) throw new Error('Projectile requires id');

    const ProjectileClass = class {
        constructor(game, position, velocity) {
            this.game = game;
            this.id = `${config.id}_${Date.now()}`;

            this.position = position.clone();
            this.velocity = velocity.clone();

            // Apply speed
            const speed = config.speed || 20;
            this.velocity.normalize().multiplyScalar(speed);

            // Physics
            this.gravity = config.gravity !== undefined ? config.gravity : 0.5;
            this.lifetime = config.lifetime || 3;
            this.age = 0;

            // State
            this.isAlive = true;
            this.damage = config.damage || 0;

            // Create mesh
            if (config.mesh && config.mesh.length > 0) {
                this.mesh = buildMesh(config.mesh);
            } else {
                // Default glowing sphere
                const geo = new THREE.SphereGeometry(0.15, 12, 12);
                const mat = new THREE.MeshStandardMaterial({
                    color: config.color || 0xff4500,
                    emissive: config.color || 0xff4500,
                    emissiveIntensity: 0.8
                });
                this.mesh = new THREE.Mesh(geo, mat);
            }

            this.mesh.position.copy(this.position);
            this._config = config;
            this._lastTrailTime = 0;
        }

        update(dt) {
            if (!this.isAlive) return false;

            this.age += dt;
            if (this.age >= this.lifetime) {
                this.destroy();
                return false;
            }

            // Gravity
            if (this.gravity > 0) {
                this.velocity.y -= this.gravity * 9.8 * dt;
            }

            // Move
            const nextPos = this.position.clone().add(
                this.velocity.clone().multiplyScalar(dt)
            );

            // Check collisions
            if (this._checkCollisions(nextPos)) {
                return false;
            }

            this.position.copy(nextPos);
            this.mesh.position.copy(this.position);

            // Trail particles
            if (config.particles?.trail) {
                this._emitTrail();
            }

            // Custom update
            if (config.onUpdate) {
                config.onUpdate.call(this, dt);
            }

            return true;
        }

        _checkCollisions(nextPos) {
            // Block collision
            const bx = Math.floor(nextPos.x);
            const by = Math.floor(nextPos.y);
            const bz = Math.floor(nextPos.z);

            const block = this.game.world?.getBlock(bx, by, bz);
            if (block && block !== 'air' && block !== 'water') {
                this._onHit(nextPos, { type: 'block', block });
                return true;
            }

            // Entity collision
            if (this.game.animals) {
                for (const animal of this.game.animals) {
                    if (animal.isDead) continue;
                    const dist = nextPos.distanceTo(animal.position);
                    if (dist < (animal.width || 0.5) + 0.3) {
                        if (this.damage > 0 && animal.takeDamage) {
                            animal.takeDamage(this.damage);
                        }
                        this._onHit(nextPos, { type: 'entity', entity: animal });
                        return true;
                    }
                }
            }

            return false;
        }

        _onHit(position, hit) {
            this.isAlive = false;

            if (config.onHit) {
                config.onHit.call(this, position, hit);
            }

            this._explode(position);
        }

        _explode(position) {
            // Particles
            if (this.game.particleSystem && config.particles) {
                const count = config.particles.count || 10;
                const color = config.particles.color || config.color || 0xff4500;

                for (let i = 0; i < count; i++) {
                    this.game.particleSystem.emit({
                        position: position.clone(),
                        velocity: new THREE.Vector3(
                            (Math.random() - 0.5) * 6,
                            Math.random() * 4,
                            (Math.random() - 0.5) * 6
                        ),
                        color,
                        size: 0.1,
                        lifetime: 0.8,
                        gravity: 0.5
                    });
                }
            }

            // Remove mesh
            if (this.mesh.parent) {
                this.mesh.parent.remove(this.mesh);
            }
        }

        _emitTrail() {
            const now = performance.now();
            if (now - this._lastTrailTime < 50) return;
            this._lastTrailTime = now;

            if (this.game.particleSystem) {
                const color = config.particles?.color || config.color || 0xff4500;
                this.game.particleSystem.emit({
                    position: this.position.clone(),
                    velocity: new THREE.Vector3(0, 0, 0),
                    color,
                    size: 0.08,
                    lifetime: 0.3,
                    gravity: 0
                });
            }
        }

        destroy() {
            this.isAlive = false;
            if (this.mesh.parent) {
                this.mesh.parent.remove(this.mesh);
            }
        }
    };

    // Store
    projectiles.set(config.id, { class: ProjectileClass, config });

    console.log(`[SDK] Created projectile: ${config.id}`);
    return ProjectileClass;
}

/**
 * Spawn a projectile
 */
export function spawnProjectile(game, id, position, velocity) {
    const data = projectiles.get(id);
    if (!data) {
        console.error(`[SDK] Projectile not found: ${id}`);
        return null;
    }

    const proj = new data.class(game, position, velocity);

    if (!game.projectiles) game.projectiles = [];
    game.projectiles.push(proj);

    if (game.scene) {
        game.scene.add(proj.mesh);
    }

    return proj;
}

export default { createProjectile, projectiles, spawnProjectile };
