/**
 * AIScript - Adds autonomous behavior to a game object
 *
 * Includes smart wandering with obstacle detection, cliff avoidance,
 * water avoidance, and various behavior modes.
 */
import * as THREE from 'three';
import { Blocks } from '../../core/Blocks.js';

export const AIScript = {
    type: 'AIScript',

    // Config - Behavior
    behavior: 'passive',   // passive | neutral | hostile | pet
    detectionRange: 8,
    attackRange: 2,
    fleeRange: 6,

    // Config - Movement
    speed: 2.0,
    wanderRadius: 10,
    idleTimeMin: 2,
    idleTimeMax: 5,
    walkTimeMin: 1,
    walkTimeMax: 4,
    walkChance: 0.7,

    // Config - Avoidance
    avoidsWater: true,
    avoidsCliffs: true,

    // Config - Dimensions (for collision detection)
    width: 0.8,
    height: 1.0,
    depth: 0.8,

    // State
    _target: null,
    _home: null,
    _state: 'idle',        // idle | walk | flee | pursue | follow
    _stateTimer: 0,
    _moveDirection: null,
    _isMoving: false,
    _rotation: 0,

    // Stuck detection
    _lastPosition: null,
    _stuckTimer: 0,
    _stuckThreshold: 0.1,

    Start() {
        this._moveDirection = new THREE.Vector3();
        this._lastPosition = new THREE.Vector3();
        this._home = null;
        this._stateTimer = Math.random() * 2 + 1;
        this._rotation = Math.random() * Math.PI * 2;

        // Get initial position
        const pos = this._getPosition();
        this._lastPosition.copy(pos);
    },

    Update() {
        const dt = window.Time?.deltaTime || 0.016;
        const game = this.gameObject.game;
        if (!game) return;

        // Initialize home position on first update (after mesh is positioned)
        if (!this._home) {
            const pos = this._getPosition();
            if (pos.x !== 0 || pos.y !== 0 || pos.z !== 0) {
                this._home = pos.clone();
            } else {
                return; // Wait for valid position
            }
        }

        // Update state timer
        this._stateTimer -= dt;

        // Behavior-specific updates
        switch (this.behavior) {
            case 'passive':
                this._updatePassive(dt);
                break;
            case 'neutral':
                this._updateNeutral(dt);
                break;
            case 'hostile':
                this._updateHostile(dt);
                break;
            case 'pet':
                this._updatePet(dt);
                break;
        }

        // Stuck detection while moving
        if (this._isMoving) {
            this._updateStuckDetection(dt);
        }

        // Apply movement
        if (this._isMoving) {
            this._applyMovement(dt);
        }
    },

    _getPosition() {
        const physics = this.gameObject.getScript('PhysicsScript');
        if (physics) {
            return physics.getPosition();
        }
        let go = this.gameObject;
        while (go.transform._parent) {
            go = go.transform._parent.gameObject;
        }
        return go.mesh ? go.mesh.position.clone() : new THREE.Vector3();
    },

    // ========== BEHAVIOR MODES ==========

    _updatePassive(dt) {
        // Check flee from player
        const player = this.gameObject.game?.player;
        if (player && this._state !== 'flee') {
            const pos = this._getPosition();
            const dist = pos.distanceTo(player.position);
            if (dist < this.fleeRange) {
                this._startFlee(player);
                return;
            }
        }

        if (this._state === 'flee') {
            this._updateFlee(dt);
        } else {
            this._updateWander(dt);
        }
    },

    _updateNeutral(dt) {
        if (this._target) {
            this._updatePursue(dt);
        } else {
            this._updateWander(dt);
        }
    },

    _updateHostile(dt) {
        const player = this.gameObject.game?.player;
        if (player) {
            const pos = this._getPosition();
            const dist = pos.distanceTo(player.position);
            if (dist < this.detectionRange) {
                this._target = player;
                this._updatePursue(dt);
                return;
            }
        }
        this._target = null;
        this._updateWander(dt);
    },

    _updatePet(dt) {
        const player = this.gameObject.game?.player;
        if (!player) return;

        const pos = this._getPosition();
        const dist = pos.distanceTo(player.position);

        if (dist > 3) {
            this._moveToward(player.position);
            this._isMoving = true;
            this._state = 'follow';
        } else {
            this._isMoving = false;
            this._state = 'idle';
        }
    },

    // ========== WANDER (smart pathfinding) ==========

    _updateWander(dt) {
        // Check obstacles while walking
        if (this._state === 'walk' && this._isMoving) {
            this._checkObstaclesWhileWalking();
        }

        // State transitions
        if (this._stateTimer <= 0) {
            this._changeWanderState();
        }
    },

    _changeWanderState() {
        if (this._state === 'walk') {
            // Switch to idle
            this._state = 'idle';
            this._stateTimer = this.idleTimeMin + Math.random() * (this.idleTimeMax - this.idleTimeMin);
            this._isMoving = false;
        } else {
            // From idle - decide whether to walk
            if (Math.random() < this.walkChance) {
                this._state = 'walk';
                this._stateTimer = this.walkTimeMin + Math.random() * (this.walkTimeMax - this.walkTimeMin);

                const dir = this._findBestDirection(null);
                if (dir) {
                    this._moveDirection.copy(dir);
                    this._rotation = Math.atan2(dir.x, dir.z);
                    this._isMoving = true;
                } else {
                    // All directions blocked, stay idle
                    this._state = 'idle';
                    this._stateTimer = this.idleTimeMin + Math.random() * (this.idleTimeMax - this.idleTimeMin);
                    this._isMoving = false;
                }
            } else {
                this._stateTimer = this.idleTimeMin + Math.random() * (this.idleTimeMax - this.idleTimeMin);
            }
        }
    },

    // ========== FLEE ==========

    _startFlee(target) {
        this._state = 'flee';
        this._stateTimer = 3; // flee duration
        this._target = target;
        this._isMoving = true;
    },

    _updateFlee(dt) {
        if (this._stateTimer <= 0) {
            this._state = 'idle';
            this._stateTimer = this.idleTimeMin + Math.random() * (this.idleTimeMax - this.idleTimeMin);
            this._isMoving = false;
            this._target = null;
            return;
        }

        if (this._target) {
            const pos = this._getPosition();
            const targetPos = this._target.position || this._target;

            const dir = new THREE.Vector3().subVectors(pos, targetPos);
            dir.y = 0;
            dir.normalize();

            // Check if flee direction is blocked
            if (this._checkObstacleAhead(dir, 1.5)) {
                const altDir = this._findBestDirection(dir);
                if (altDir) {
                    dir.copy(altDir);
                }
            }

            this._moveDirection.copy(dir);
            this._rotation = Math.atan2(dir.x, dir.z);
            this._isMoving = true;
        }
    },

    // ========== PURSUE ==========

    _updatePursue(dt) {
        if (!this._target) return;

        const pos = this._getPosition();
        const dist = pos.distanceTo(this._target.position);

        if (dist > this.attackRange) {
            this._moveToward(this._target.position);
            this._isMoving = true;
            this._state = 'pursue';
        } else {
            this._isMoving = false;
            // Attack
            if (this._stateTimer <= 0) {
                this._stateTimer = 1; // attack cooldown
                this._attack();
            }
        }
    },

    _attack() {
        const health = this.gameObject.getScript('HealthScript');
        const damage = health?.damage || 5;

        if (this._target?.onHit) {
            this._target.onHit(damage, this.gameObject);
        }
    },

    // ========== OBSTACLE DETECTION ==========

    _checkObstaclesWhileWalking() {
        const checkDist = Math.max(this.speed * 0.8, 1.2);

        if (this._checkObstacleAhead(this._moveDirection, checkDist)) {
            const newDir = this._findBestDirection(null);
            if (newDir) {
                this._moveDirection.copy(newDir);
                this._rotation = Math.atan2(newDir.x, newDir.z);
            } else {
                this._state = 'idle';
                this._stateTimer = this.idleTimeMin + Math.random() * (this.idleTimeMax - this.idleTimeMin);
                this._isMoving = false;
            }
        }
    },

    _checkObstacleAhead(direction, distance) {
        const game = this.gameObject.game;
        if (!game?.getBlock) return false;

        const pos = this._getPosition();
        const hw = this.width / 2 * 0.9;
        const cos = Math.cos(this._rotation);
        const sin = Math.sin(this._rotation);

        const offsets = [
            { x: 0, z: 0 },
            { x: -hw, z: 0 },
            { x: hw, z: 0 }
        ];

        const stepSize = 0.8;
        const steps = Math.ceil(distance / stepSize);

        for (const offset of offsets) {
            const rx = offset.x * cos - offset.z * sin;
            const rz = offset.x * sin + offset.z * cos;

            const startX = pos.x + rx;
            const startZ = pos.z + rz;
            const baseY = Math.floor(pos.y);

            for (let i = 1; i <= steps; i++) {
                const effectiveDist = Math.min(i * stepSize, distance);
                const checkX = startX + direction.x * effectiveDist;
                const checkZ = startZ + direction.z * effectiveDist;

                // Water avoidance
                if (this.avoidsWater) {
                    if (this._checkWater(checkX, baseY, checkZ) ||
                        this._checkWater(checkX, baseY - 1, checkZ)) {
                        return true;
                    }
                }

                // Wall detection
                const hasFeetBlock = this._checkSolid(checkX, baseY, checkZ);
                const hasBodyBlock = this._checkSolid(checkX, baseY + 1, checkZ);

                if (hasFeetBlock && hasBodyBlock) {
                    return true;
                }

                if (hasFeetBlock && !hasBodyBlock) {
                    const hasHeadBlock = this._checkSolid(checkX, baseY + 2, checkZ);
                    if (hasHeadBlock) {
                        return true;
                    }
                } else if (!hasFeetBlock && this.avoidsCliffs) {
                    const hasGroundAhead = this._checkSolid(checkX, baseY - 1, checkZ) ||
                        this._checkSolid(checkX, baseY, checkZ);

                    if (!hasGroundAhead) {
                        const hasDeepGround = this._checkSolid(checkX, baseY - 2, checkZ);
                        if (!hasDeepGround) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    },

    _findBestDirection(preferredDir) {
        const candidates = [];
        const numDirections = 8;

        for (let i = 0; i < numDirections; i++) {
            const angle = (i / numDirections) * Math.PI * 2;
            const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));

            if (!this._checkObstacleAhead(dir, 1.5)) {
                let score = 1.0;

                if (preferredDir) {
                    const similarity = dir.dot(preferredDir);
                    score += similarity * 2;
                }

                score += Math.random() * 0.5;
                candidates.push({ dir, score });
            }
        }

        if (candidates.length === 0) {
            return null;
        }

        candidates.sort((a, b) => b.score - a.score);
        return candidates[0].dir.clone();
    },

    _checkSolid(x, y, z) {
        const game = this.gameObject.game;
        if (!game?.getBlock) return false;

        const block = game.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        const type = (block && block.type) ? block.type : block;

        return !!type && type !== Blocks.WATER && type !== Blocks.AIR;
    },

    _checkWater(x, y, z) {
        const game = this.gameObject.game;
        if (!game?.getBlock) return false;

        const block = game.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        const type = (block && block.type) ? block.type : block;

        return type === Blocks.WATER;
    },

    // ========== STUCK DETECTION ==========

    _updateStuckDetection(dt) {
        this._stuckTimer += dt;
        if (this._stuckTimer >= 1.0) {
            const pos = this._getPosition();
            const distMoved = pos.distanceTo(this._lastPosition);

            if (distMoved < this._stuckThreshold) {
                const dir = this._findBestDirection(null);
                if (dir) {
                    this._moveDirection.copy(dir);
                    this._rotation = Math.atan2(dir.x, dir.z);
                } else {
                    this._state = 'idle';
                    this._isMoving = false;
                    this._stateTimer = this.idleTimeMin + Math.random() * (this.idleTimeMax - this.idleTimeMin);
                }
            }

            this._lastPosition.copy(pos);
            this._stuckTimer = 0;
        }
    },

    // ========== MOVEMENT ==========

    _moveToward(target) {
        const pos = this._getPosition();
        const dir = new THREE.Vector3().subVectors(target, pos).normalize();
        dir.y = 0;

        // Check for obstacles and find alternate path
        if (this._checkObstacleAhead(dir, 1.5)) {
            const altDir = this._findBestDirection(dir);
            if (altDir) {
                dir.copy(altDir);
            }
        }

        this._moveDirection.copy(dir);
        this._rotation = Math.atan2(dir.x, dir.z);
    },

    _applyMovement(dt) {
        const physics = this.gameObject.getScript('PhysicsScript');
        if (physics) {
            physics.move(this._moveDirection);
        }

        // Rotate root mesh to face direction
        if (this._moveDirection.lengthSq() > 0.01) {
            let go = this.gameObject;
            while (go.transform._parent) {
                go = go.transform._parent.gameObject;
            }
            if (go.mesh) {
                go.mesh.rotation.y = this._rotation;
            }
        }
    },

    // ========== PUBLIC API ==========

    /**
     * Check if currently moving (useful for animations)
     */
    isMoving() {
        return this._isMoving;
    },

    /**
     * Get current state ('idle', 'walk', 'flee', 'pursue', 'follow')
     */
    getState() {
        return this._state;
    },

    /**
     * Get current facing rotation (in radians)
     */
    getRotation() {
        return this._rotation;
    },

    /**
     * Force flee from a target
     */
    fleeFrom(target) {
        this._startFlee(target);
    },

    /**
     * Stop all movement and go idle
     */
    stop() {
        this._state = 'idle';
        this._isMoving = false;
        this._stateTimer = this.idleTimeMin + Math.random() * (this.idleTimeMax - this.idleTimeMin);
    },

    /**
     * Force start walking in a random direction
     */
    startWalk() {
        const dir = this._findBestDirection(null);
        if (dir) {
            this._state = 'walk';
            this._moveDirection.copy(dir);
            this._rotation = Math.atan2(dir.x, dir.z);
            this._isMoving = true;
            this._stateTimer = this.walkTimeMin + Math.random() * (this.walkTimeMax - this.walkTimeMin);
        }
    },

    /**
     * Called when this entity is hit - neutral becomes hostile
     */
    OnDamage(amount, attacker) {
        if (this.behavior === 'neutral' && attacker) {
            this._target = attacker;
        }
    }
};

export default AIScript;
