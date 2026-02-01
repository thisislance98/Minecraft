/**
 * ProjectileScript - Makes a game object act as a projectile
 */
import * as THREE from 'three';

export const ProjectileScript = {
    type: 'ProjectileScript',

    // Config
    lifetime: 3,          // seconds
    damage: 10,
    gravity: 0,
    destroyOnHit: true,
    piercing: false,

    // State
    velocity: null,
    _age: 0,
    _hitEntities: null,

    Start() {
        this.velocity = this.velocity || new THREE.Vector3(0, 0, -20);
        this._hitEntities = new Set();
    },

    Update() {
        if (!this.velocity) return;

        const dt = Time.deltaTime;

        // Apply gravity
        if (this.gravity) {
            this.velocity.y -= this.gravity * 20 * dt;
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

        // Check against entities
        const entities = game.animals || [];
        for (const entity of entities) {
            if (this._hitEntities.has(entity)) continue;

            const dist = this.transform.position.distanceTo(entity.position);
            if (dist < 1.0) {
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
