/**
 * AIScript - Adds autonomous behavior to a game object
 */
import * as THREE from 'three';

export const AIScript = {
    type: 'AIScript',

    // Config
    behavior: 'passive',   // passive | neutral | hostile | pet
    wander: true,
    wanderRadius: 10,
    detectionRange: 8,
    attackRange: 2,
    fleeRange: 6,

    // State
    _target: null,
    _wanderTarget: null,
    _actionTimer: 0,
    _home: null,

    start(obj) {
        this._home = obj.position.clone();
        this._pickWanderTarget(obj);
    },

    update(obj, dt) {
        const game = obj.game;
        if (!game) return;

        this._actionTimer += dt;

        switch (this.behavior) {
            case 'passive':
                this._updatePassive(obj, dt);
                break;
            case 'neutral':
                this._updateNeutral(obj, dt);
                break;
            case 'hostile':
                this._updateHostile(obj, dt);
                break;
            case 'pet':
                this._updatePet(obj, dt);
                break;
        }
    },

    _updatePassive(obj, dt) {
        // Just wander around
        if (this.wander) {
            this._doWander(obj, dt);
        }

        // Flee from nearby hostiles
        const player = obj.game?.player;
        if (player) {
            const dist = obj.position.distanceTo(player.position);
            if (dist < this.fleeRange) {
                this._fleeFrom(obj, player.position);
            }
        }
    },

    _updateNeutral(obj, dt) {
        // Wander until attacked, then fight back
        if (this._target) {
            this._pursueTarget(obj, dt);
        } else if (this.wander) {
            this._doWander(obj, dt);
        }
    },

    _updateHostile(obj, dt) {
        // Actively seek and attack player
        const player = obj.game?.player;
        if (player) {
            const dist = obj.position.distanceTo(player.position);
            if (dist < this.detectionRange) {
                this._target = player;
                this._pursueTarget(obj, dt);
            } else {
                this._target = null;
                if (this.wander) this._doWander(obj, dt);
            }
        }
    },

    _updatePet(obj, dt) {
        // Follow player
        const player = obj.game?.player;
        if (player) {
            const dist = obj.position.distanceTo(player.position);
            if (dist > 3) {
                this._moveToward(obj, player.position, dt);
            }
        }
    },

    _doWander(obj, dt) {
        if (!this._wanderTarget || this._actionTimer > 3) {
            this._pickWanderTarget(obj);
            this._actionTimer = 0;
        }

        const dist = obj.position.distanceTo(this._wanderTarget);
        if (dist > 0.5) {
            this._moveToward(obj, this._wanderTarget, dt);
        }
    },

    _pickWanderTarget(obj) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * this.wanderRadius;
        const home = this._home || obj.position;

        this._wanderTarget = new THREE.Vector3(
            home.x + Math.cos(angle) * radius,
            obj.position.y,
            home.z + Math.sin(angle) * radius
        );
    },

    _moveToward(obj, target, dt) {
        const physics = obj.getScript('PhysicsScript');
        if (physics) {
            const dir = new THREE.Vector3()
                .subVectors(target, obj.position)
                .normalize();
            dir.y = 0;
            physics.move(dir);

            // Face direction
            if (obj.mesh && dir.lengthSq() > 0.01) {
                obj.mesh.lookAt(target.x, obj.position.y, target.z);
            }
        }
    },

    _fleeFrom(obj, position) {
        const physics = obj.getScript('PhysicsScript');
        if (physics) {
            const dir = new THREE.Vector3()
                .subVectors(obj.position, position)
                .normalize();
            dir.y = 0;
            physics.move(dir);
        }
    },

    _pursueTarget(obj, dt) {
        if (!this._target) return;

        const dist = obj.position.distanceTo(this._target.position);
        if (dist > this.attackRange) {
            this._moveToward(obj, this._target.position, dt);
        } else {
            // Attack!
            if (this._actionTimer > 1) {
                this._actionTimer = 0;
                this._attack(obj);
            }
        }
    },

    _attack(obj) {
        const health = obj.getScript('HealthScript');
        const damage = health?.damage || 5;

        if (this._target?.onHit) {
            this._target.onHit(damage, obj);
        }
    },

    // Called when this entity is hit - neutral becomes hostile
    onHit(obj, damage, attacker) {
        if (this.behavior === 'neutral' && attacker) {
            this._target = attacker;
        }
    }
};

export default AIScript;
