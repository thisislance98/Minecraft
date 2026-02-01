/**
 * PhysicsScript - Adds movement physics to a game object
 */
import * as THREE from 'three';

export const PhysicsScript = {
    type: 'PhysicsScript',

    // Config
    mode: 'walking',      // walking | hopping | flying | swimming
    speed: 3,
    gravity: true,
    jumpHeight: 1,

    // State
    velocity: null,
    grounded: false,
    _hopTimer: 0,
    _hopInterval: 1.5,

    start(obj) {
        this.velocity = new THREE.Vector3();
    },

    update(obj, dt) {
        if (!this.velocity) return;

        const game = obj.game;
        if (!game) return;

        switch (this.mode) {
            case 'walking':
                this._updateWalking(obj, dt);
                break;
            case 'hopping':
                this._updateHopping(obj, dt);
                break;
            case 'flying':
                this._updateFlying(obj, dt);
                break;
            case 'swimming':
                this._updateSwimming(obj, dt);
                break;
        }

        // Apply velocity
        obj.position.add(this.velocity.clone().multiplyScalar(dt));

        // Apply gravity
        if (this.gravity && this.mode !== 'flying') {
            this.velocity.y -= 20 * dt;

            // Ground check (simple)
            if (obj.position.y <= 0) {
                obj.position.y = 0;
                this.velocity.y = 0;
                this.grounded = true;
            }
        }

        obj.syncTransform();
    },

    _updateWalking(obj, dt) {
        // Friction
        this.velocity.x *= 0.9;
        this.velocity.z *= 0.9;
    },

    _updateHopping(obj, dt) {
        this._hopTimer += dt;

        if (this.grounded && this._hopTimer >= this._hopInterval) {
            this._hopTimer = 0;
            this.velocity.y = this.jumpHeight * 5;
            this.grounded = false;

            // Random horizontal direction
            const angle = Math.random() * Math.PI * 2;
            this.velocity.x = Math.cos(angle) * this.speed;
            this.velocity.z = Math.sin(angle) * this.speed;
        }
    },

    _updateFlying(obj, dt) {
        // Gentle bobbing
        obj.position.y += Math.sin(Date.now() * 0.002) * 0.01;

        // Friction
        this.velocity.multiplyScalar(0.95);
    },

    _updateSwimming(obj, dt) {
        // Buoyancy
        if (obj.position.y < 0) {
            this.velocity.y += 5 * dt;
        }
        this.velocity.multiplyScalar(0.98);
    },

    // Public methods
    move(direction) {
        this.velocity.x = direction.x * this.speed;
        this.velocity.z = direction.z * this.speed;
    },

    jump() {
        if (this.grounded) {
            this.velocity.y = this.jumpHeight * 5;
            this.grounded = false;
        }
    }
};

export default PhysicsScript;
