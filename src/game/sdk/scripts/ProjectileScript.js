/**
 * ProjectileScript - Makes a game object act as a projectile
 *
 * @description Handles projectile physics, collision detection, and damage dealing.
 * Checks against both legacy game entities and SDK-spawned entities.
 *
 * @example
 * VoxelWorld.createProjectile('Fireball', {
 *   mesh: [{ type: 'sphere', size: [0.3], color: 0xff4400 }],
 *   damage: 15,
 *   lifetime: 5,
 *   gravity: 0.5
 * }).register();
 */
import * as THREE from 'three';

/** @type {number} Default projectile lifetime in seconds */
const DEFAULT_LIFETIME = 3;
/** @type {number} Default projectile damage */
const DEFAULT_DAMAGE = 10;
/** @type {number} Default projectile velocity (forward) */
const DEFAULT_VELOCITY = -20;
/** @type {number} Gravity multiplier for projectile physics */
const GRAVITY_MULTIPLIER = 20;
/** @type {number} Collision detection radius */
const COLLISION_RADIUS = 1.0;

export const ProjectileScript = {
    type: 'ProjectileScript',

    // ===== CONFIG =====
    /** @type {number} Projectile lifetime in seconds before auto-destroy */
    lifetime: DEFAULT_LIFETIME,
    /** @type {number} Damage dealt on hit */
    damage: DEFAULT_DAMAGE,
    /** @type {number} Gravity multiplier (0 = no gravity, 1 = normal) */
    gravity: 0,
    /** @type {boolean} Whether to destroy on first hit */
    destroyOnHit: true,
    /** @type {boolean} Whether projectile can hit multiple targets */
    piercing: false,

    // ===== STATE =====
    /** @type {THREE.Vector3|null} Current velocity vector */
    velocity: null,
    /** @type {number} Time since spawn in seconds */
    _age: 0,
    /** @type {Set|null} Set of entities already hit (for piercing) */
    _hitEntities: null,

    /**
     * Called when the script starts
     */
    Start() {
        this.velocity = this.velocity || new THREE.Vector3(0, 0, DEFAULT_VELOCITY);
        this._hitEntities = new Set();
    },

    /**
     * Called every frame
     */
    Update() {
        if (!this.velocity) return;

        const dt = Time.deltaTime;

        // Apply gravity
        if (this.gravity) {
            this.velocity.y -= this.gravity * GRAVITY_MULTIPLIER * dt;
        }

        // Move
        this.transform.position.add(this.velocity.clone().multiplyScalar(dt));
        this.gameObject.SyncTransform();

        // Face direction of travel
        if (this.gameObject.mesh && this.velocity.lengthSq() > 0.1) {
            const lookTarget = this.transform.position.clone().add(this.velocity);
            this.gameObject.mesh.lookAt(lookTarget);
        }

        // Age and lifetime
        this._age += dt;
        if (this._age >= this.lifetime) {
            this._Expire();
            return;
        }

        // Check collisions
        this._CheckCollisions();
    },

    _CheckCollisions() {
        const game = this.gameObject.game || window.__VOXEL_GAME__;
        if (!game) return;

        // Collect all entities from both game.animals AND VoxelWorld SDK instances
        const entities = [];

        // Add legacy game animals
        if (game.animals) {
            entities.push(...game.animals);
        }

        // Add SDK-spawned entities from VoxelWorld
        if (window.VoxelWorld?._instances) {
            for (const instance of window.VoxelWorld._instances) {
                // Don't collide with self
                if (instance === this.gameObject) continue;
                // Don't collide with other projectiles
                if (instance.hasScript?.('ProjectileScript')) continue;
                entities.push(instance);
            }
        }

        // Check against all entities
        for (const entity of entities) {
            if (this._hitEntities.has(entity)) continue;

            // Get entity position (handle both SDK GameObjects and legacy entities)
            const entityPos = entity.transform?.position || entity.position;
            if (!entityPos) continue;

            const dist = this.transform.position.distanceTo(entityPos);
            if (dist < COLLISION_RADIUS) {
                this._OnHit(entity);
                if (!this.piercing) return;
            }
        }

        // Check against blocks (simple ground check)
        if (this.transform.position.y <= 0) {
            this._OnHit(null);
        }
    },

    _OnHit(target) {
        console.log(`[ProjectileScript] ${this.gameObject.name} hit ${target?.name || 'ground'}`);

        // Mark as hit
        if (target) {
            this._hitEntities.add(target);
        }

        // Deal damage
        if (target && this.damage > 0) {
            if (target.OnDamage) {
                target.OnDamage(this.damage, this.gameObject);
            } else if (target.onHit) {
                target.onHit(this.damage, this.gameObject);
            } else if (target.takeDamage) {
                target.takeDamage(this.damage);
            }
        }

        // Trigger OnCollisionEnter
        this.gameObject.OnCollisionEnter(target);

        // Destroy if not piercing
        if (this.destroyOnHit && !this.piercing) {
            this.gameObject.Destroy();
        }
    },

    _Expire() {
        console.log(`[ProjectileScript] ${this.gameObject.name} expired`);
        this.gameObject.Destroy();
    },

    // Public methods
    SetVelocity(vel) {
        this.velocity = vel instanceof THREE.Vector3 ? vel : new THREE.Vector3(vel.x, vel.y, vel.z);
    }
};

export default ProjectileScript;
