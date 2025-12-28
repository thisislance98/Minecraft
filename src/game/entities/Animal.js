import * as THREE from 'three';
import { SeededRandom } from '../../utils/SeededRandom.js';

export class Animal {
    constructor(game, x, y, z, seed) {
        this.game = game;
        this.position = new THREE.Vector3(x, y, z);
        this.data = {}; // Generic storage for persistence

        // Deterministic ID (if not provided, generate one)
        // Format: Type_Seed_X_Z (approx)
        this.seed = seed || Math.random() * 0xffffffff;
        this.id = `${this.constructor.name}_${Math.floor(this.seed)}_${Math.floor(x)}_${Math.floor(z)}`;

        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rng = new SeededRandom(this.seed);
        this.rotation = this.rng.next() * Math.PI * 2;

        // Dimensions (should be overridden)
        this.width = 0.8;
        this.height = 1.0;
        this.depth = 0.8;
        this.collisionScale = 0.8; // Multiplier for effective collision box size

        // Stats
        this.speed = 2.0; // units/sec
        this.gravity = 30.0;

        // State
        this.onGround = false;
        this.isMoving = false;

        // AI
        this.state = 'idle'; // idle, walk, chase, flee
        this.detectionRange = 16.0;
        this.attackRange = 1.5;
        this.attackCooldown = 1.0;
        this.attackTimer = 0;
        this.damage = 1;
        this.isHostile = false;
        this.stateTimer = this.rng.next() * 3 + 1;
        this.moveDirection = new THREE.Vector3();

        // Animation
        this.animTime = 0;
        this.legSwingSpeed = 20;

        // Mesh group
        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.position);

        // Parts for animation (populated in createBody)
        this.legParts = [];

        // Health
        this.health = 3;
        this.maxHealth = 3;
        this.isDead = false;
        this.flashTimer = 0;

        // Movement style - only hoppers (bunnies, frogs) actually hop up mountains
        this.canHop = false;

        // Curve path for smooth step-up (non-hoppers)
        this.isOnCurvePath = false;
        this.curveStart = new THREE.Vector3();
        this.curveEnd = new THREE.Vector3();
        this.curveProgress = 0;
        this.curveSpeed = 3.0; // How fast to traverse the curve (units per second)

        // Knockback
        this.knockbackVelocity = new THREE.Vector3(0, 0, 0);

        // Death animation
        this.isDying = false;
        this.deathTimer = 0;

        // Proximity Flee
        this.fleeOnProximity = false;
        this.fleeRange = 8.0;

        // Stuck detection
        this.lastPosition = new THREE.Vector3().copy(this.position);
        this.stuckTimer = 0;
        this.stuckThreshold = 0.1; // Distance moved within 1s to be considered stuck

        // Levitation
        this.levitationTimer = 0;
    }

    takeDamage(amount, attacker) {
        if (this.isDead) return;

        this.health -= amount;
        this.flashTimer = 1.0; // Flash red for 1s

        if (this.health <= 0) {
            this.health = 0;
            this.startDeath();
        } else {
            // Flee if attacked
            if (attacker) {
                this.fleeFrom(attacker);
            }
        }
    }

    fleeFrom(attacker) {
        // Can't flee if dead or dying
        if (this.isDead || this.isDying) return;

        // Set state to flee
        this.state = 'flee';
        this.stateTimer = 5.0; // Run for 5 seconds
        this.isMoving = true;
        this.fleeTarget = attacker;
    }

    knockback(direction, force) {
        // direction is a normalized Vector3
        // force is scalar
        this.knockbackVelocity.x = direction.x * force;
        this.knockbackVelocity.z = direction.z * force;
        this.velocity.y = 5; // Little hop
        this.onGround = false;
    }

    startLevitation(duration) {
        this.levitationTimer = duration;
        this.onGround = false;
        this.velocity.y = 5.0; // Initial pop
    }

    startDeath() {
        if (this.isDying) return;
        this.isDying = true;
        this.isMoving = false;
        // Play death sound?
    }

    createBody() {
        // To be implemented by subclasses
        const geom = new THREE.BoxGeometry(this.width, this.height, this.depth);
        const mat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        this.mesh.add(new THREE.Mesh(geom, mat));
    }

    update(dt) {
        // Clamp dt to prevent physics explosions (max 0.1s)
        dt = Math.min(dt, 0.1);

        if (this.rider) {
            // Ridden behavior: Input controlled by handleRiding called by Player
            // We still run physics, but AI is disabled
        } else {
            this.updateAI(dt);
        }

        this.updatePhysics(dt);
        this.updateAnimation(dt);
        this.updateDeath(dt);

        // Update Levitation
        if (this.levitationTimer > 0) {
            this.levitationTimer -= dt;
        }


        // Update damage flash
        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
            this.mesh.traverse((child) => {
                if (child.isMesh && child.material) {
                    // Check material userData to handle shared materials correctly
                    if (!child.material.userData) child.material.userData = {};

                    // Save original color if not saved (on the material!)
                    if (!child.material.userData.originalColor) {
                        child.material.userData.originalColor = child.material.color.clone();
                    }

                    // Flash red
                    if (this.flashTimer > 0) {
                        child.material.color.setHex(0xFF0000);
                    } else {
                        // Restore
                        if (child.material.userData.originalColor) {
                            child.material.color.copy(child.material.userData.originalColor);
                        }
                    }
                }
            });
        }

        // Update rider position if mounted
        if (this.rider) {
            // Let player handle its own position relative to us, or we update it here?
            // Usually easier if Player updates itself based on us, or we update rider.
            // Let's let Player update its pos to avoid circular dependency or lag.
        }

        // Sync mesh
        this.mesh.position.copy(this.position);

        // If not dying, use normal rotation. If dying, we might override rotation in updateDeath
        if (!this.isDying) {
            this.mesh.rotation.y = this.rotation;
        }

        // Hostile mobs behavior
        if (this.isHostile && this.game.environment) {
            const isNight = this.game.environment.isNight();
            // We removed the visibility check as requested.
            // We can still suppress AI if we want, but usually if they are there, they should act.
            // For now, let's allow them to move/act if they exist.
        }

        // Persistence / Sync Check
        this.checkSync();
    }

    checkSync() {
        if (!this.game.socketManager || !this.game.socketManager.isConnected()) return;

        // Simple distance check: if we moved significantly, send update
        if (!this.lastSyncPos) this.lastSyncPos = this.position.clone();

        const dist = this.position.distanceTo(this.lastSyncPos);
        if (dist > 1.0) { // Sync every 1 block of movement
            this.game.socketManager.sendEntityUpdate(this.serialize());
            this.lastSyncPos.copy(this.position);
        }
    }

    serialize() {
        return {
            id: this.id,
            type: this.constructor.name,
            x: this.position.x,
            y: this.position.y,
            z: this.position.z,
            seed: this.seed,
            health: this.health,
            state: this.state
        };
    }

    deserialize(data) {
        if (data.x !== undefined) {
            this.position.set(data.x, data.y, data.z);
            this.mesh.position.copy(this.position);
        }
        if (data.health !== undefined) this.health = data.health;
        // Don't override state blindly if we are currently reacting to something, 
        // but for initial load it's fine.
    }

    handleRiding(moveForward, moveRight, jump, rotationY, dt) {
        if (!this.rider) return;

        // Set rotation to match rider (camera)
        // Add PI because the animal models (Horse) face +Z, but camera looks -Z.
        // This aligns the animal with the camera view.
        this.rotation = rotationY + Math.PI;

        // Calculate move direction based on CAMERA rotation (rotationY)
        // We use Player.js style math: Forward is -Z.
        const speed = this.speed * 1.5;

        this.moveDirection.set(0, 0, 0);

        if (moveForward || moveRight) {
            const sin = Math.sin(rotationY);
            const cos = Math.cos(rotationY);

            // Forward/Back (moveForward)
            // Strafe (moveRight)
            // Math matching Player.js:
            // velX = -moveForward * sin + moveRight * cos
            // velZ = -moveForward * cos - moveRight * sin

            const dx = (-moveForward * sin + moveRight * cos);
            const dz = (-moveForward * cos - moveRight * sin);

            this.moveDirection.x = dx;
            this.moveDirection.z = dz;
            this.moveDirection.normalize();
            this.isMoving = true;
        } else {
            this.isMoving = false;
        }

        // Jump
        if (jump && this.onGround) {
            this.velocity.y = this.jumpForce || 10;
            this.onGround = false;
        }
    }

    updateDeath(dt) {
        if (!this.isDying) return;

        this.deathTimer += dt;

        // Fall over animation (rotate Z)
        // Target 90 degrees (PI/2)
        const targetRot = Math.PI / 2;
        const currentRot = this.mesh.rotation.z;

        if (currentRot < targetRot) {
            this.mesh.rotation.z += dt * 5; // Rotation speed
            if (this.mesh.rotation.z > targetRot) this.mesh.rotation.z = targetRot;
        }

        // Fade out or just wait
        if (this.deathTimer > 2.0) {
            this.isDead = true; // Actual removal
        }
    }

    updateAI(dt) {
        // Hostile mobs sleep during the day
        if (this.isHostile && this.game.environment && !this.game.environment.isNight()) {
            this.state = 'idle';
            this.isMoving = false;
            return;
        }

        this.stateTimer -= dt;

        if (this.state === 'flee') {
            if (this.stateTimer <= 0) {
                // Stop fleeing
                this.state = 'idle';
                this.stateTimer = this.rng.next() * 2 + 1;
                this.isMoving = false;
                this.fleeTarget = null;
            } else {
                // Move away from target
                if (this.fleeTarget) {
                    const dir = new THREE.Vector3().subVectors(this.position, this.fleeTarget.position);
                    dir.y = 0; // Keep horizontal
                    dir.normalize();

                    // Check if flee direction is blocked
                    if (this.checkObstacleAhead(dir, 1.5)) {
                        // Find alternate direction
                        const altDir = this.findBestDirection(dir);
                        if (altDir) {
                            dir.copy(altDir);
                        }
                    }

                    // Update direction and rotation
                    this.moveDirection.copy(dir);
                    this.rotation = Math.atan2(dir.x, dir.z);
                    this.isMoving = true;
                } else {
                    // Lost target? Just keep running in current direction
                    // Or stop
                    this.state = 'idle';
                }
            }
            return; // Skip normal wander logic
        }

        // Check proximity flee
        if (this.fleeOnProximity && this.checkProximityFlee(this.fleeRange)) {
            return; // Switched to flee
        }

        // Stuck Detection
        if (this.isMoving && !this.isOnCurvePath) {
            this.stuckTimer += dt;
            if (this.stuckTimer >= 1.0) {
                const distMoved = this.position.distanceTo(this.lastPosition);
                if (distMoved < this.stuckThreshold) {
                    // We are stuck! Force a new direction
                    const dir = this.findBestDirection(null);
                    if (dir) {
                        this.moveDirection.copy(dir);
                        this.rotation = Math.atan2(dir.x, dir.z);
                    } else {
                        // All directions blocked, just idle
                        this.state = 'idle';
                        this.isMoving = false;
                        this.stateTimer = this.rng.next() * 2 + 1;
                    }
                }
                this.lastPosition.copy(this.position);
                this.stuckTimer = 0;
            }
        } else {
            this.stuckTimer = 0;
            this.lastPosition.copy(this.position);
        }

        // While walking, check for obstacles ahead
        if (this.state === 'walk' && this.isMoving) {
            const checkDist = this.speed * 0.8; // Predict ahead based on speed
            if (this.checkObstacleAhead(this.moveDirection, Math.max(checkDist, 1.2))) {
                // Obstacle detected! Try to find a new direction
                const newDir = this.findBestDirection(null);
                if (newDir) {
                    this.moveDirection.copy(newDir);
                    this.rotation = Math.atan2(newDir.x, newDir.z);
                } else {
                    // No good direction, stop and idle
                    this.state = 'idle';
                    this.stateTimer = this.rng.next() * 2 + 1;
                    this.isMoving = false;
                }
            }
        }

        if (this.stateTimer <= 0) {
            // Change state
            if (this.state === 'walk') {
                this.state = 'idle';
                this.stateTimer = this.rng.next() * 3 + 2;
                this.isMoving = false;
            } else {
                // Switch to walk
                if (this.rng.next() < 0.7) {
                    this.state = 'walk';
                    this.stateTimer = this.rng.next() * 4 + 1;

                    // Pick a smart direction (avoid obstacles)
                    const smartDir = this.findBestDirection(null);
                    if (smartDir) {
                        this.moveDirection.copy(smartDir);
                        this.rotation = Math.atan2(smartDir.x, smartDir.z);
                        this.isMoving = true;
                    } else {
                        // No clear path, try random anyway
                        this.rotation = this.rng.next() * Math.PI * 2;
                        this.moveDirection.set(Math.sin(this.rotation), 0, Math.cos(this.rotation));
                        this.isMoving = true;
                    }
                } else {
                    // Stay idle longer
                    this.stateTimer = this.rng.next() * 2 + 1;
                    this.isMoving = false;
                }
            }
        }

        // Hostile AI Logic
        if (this.isHostile && this.state !== 'flee' && !this.isDying) {
            const player = this.game.player;
            const distToPlayer = this.position.distanceTo(player.position);

            if (distToPlayer < this.detectionRange) {
                this.state = 'chase';

                // Direction to player
                const dir = new THREE.Vector3().subVectors(player.position, this.position);
                dir.y = 0;
                dir.normalize();

                this.rotation = Math.atan2(dir.x, dir.z);

                // Calculate minimum distance to prevent overlapping with player
                const minDistance = this.attackRange * 0.8;

                // Only move if we're farther than minimum distance
                if (distToPlayer > minDistance) {
                    this.moveDirection.copy(dir);
                    this.isMoving = true;
                } else {
                    // Stop moving when close to player to prevent overlapping
                    this.isMoving = false;
                }

                // Melee Attack
                if (distToPlayer <= this.attackRange) {
                    if (this.attackTimer <= 0) {
                        this.attackPlayer(player);
                        this.attackTimer = this.attackCooldown;
                    }
                }
            } else if (this.state === 'chase') {
                // Lost player
                this.state = 'idle';
                this.stateTimer = 2.0;
                this.isMoving = false;
            }
        }

        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
        }
    }

    attackPlayer(player) {
        // Melee attack
        const dir = new THREE.Vector3().subVectors(player.position, this.position).normalize();
        player.takeDamage(this.damage);
        player.knockback(dir, 0.2);

        // Simple arm swing animation for mobs if they have armParts
        if (this.armParts && this.armParts.length > 0) {
            this.isAttacking = true;
            this.attackAnimTimer = 0.3;
        }
    }

    /**
     * Check if there's an obstacle ahead in the given direction
     * @param {THREE.Vector3} direction - Normalized direction to check
     * @param {number} distance - How far ahead to check
     * @returns {boolean} - True if obstacle detected
     */
    checkObstacleAhead(direction, distance) {
        // Broaden the check to cover the width of the animal
        // We check 3 lines: center, left edge, and right edge
        const hw = this.width / 2 * 0.9;
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);

        // Relative offsets for the "shoulders"
        const offsets = [
            { x: 0, z: 0 }, // Center
            { x: -hw, z: 0 }, // Left side
            { x: hw, z: 0 }   // Right side
        ];

        for (const offset of offsets) {
            // Rotate offset
            const rx = offset.x * cos - offset.z * sin;
            const rz = offset.x * sin + offset.z * cos;

            const startX = this.position.x + rx;
            const startZ = this.position.z + rz;
            const checkX = startX + direction.x * distance;
            const checkZ = startZ + direction.z * distance;
            const baseY = Math.floor(this.position.y);

            // Check if there's a solid block at feet level or body level
            // that we can't step over (more than 1 block high)
            const hasFeetBlock = this.checkSolid(checkX, baseY, checkZ);
            const hasBodyBlock = this.checkSolid(checkX, baseY + 1, checkZ);

            if (hasFeetBlock && hasBodyBlock) {
                return true; // Wall detected
            }

            if (hasFeetBlock && !hasBodyBlock) {
                // Step-up scenario - check if there's headroom
                const hasHeadBlock = this.checkSolid(checkX, baseY + 2, checkZ);
                if (hasHeadBlock) {
                    return true; // No headroom to step up
                }
            } else {
                // Check for cliffs (no ground ahead)
                const hasGroundAhead = this.checkSolid(checkX, baseY - 1, checkZ) ||
                    this.checkSolid(checkX, baseY, checkZ);
                if (!hasGroundAhead) {
                    // Check deeper - is it a 2+ block drop?
                    const hasDeepGround = this.checkSolid(checkX, baseY - 2, checkZ);
                    if (!hasDeepGround) {
                        return true; // Cliff detected, avoid
                    }
                }
            }
        }

        return false;
    }

    /**
     * Find the best direction to walk that avoids obstacles
     * @param {THREE.Vector3|null} preferredDir - Preferred direction (e.g., away from threat)
     * @returns {THREE.Vector3|null} - Best direction or null if all blocked
     */
    findBestDirection(preferredDir) {
        const candidates = [];
        const numDirections = 8;

        // Generate candidate directions (8 directions around)
        for (let i = 0; i < numDirections; i++) {
            const angle = (i / numDirections) * Math.PI * 2;
            const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));

            // Check if this direction is clear
            if (!this.checkObstacleAhead(dir, 1.5)) {
                let score = 1.0;

                // Bonus for directions similar to preferred
                if (preferredDir) {
                    const similarity = dir.dot(preferredDir);
                    score += similarity * 2; // Higher score for similar directions
                }

                // Add some randomness to avoid predictable patterns
                score += this.rng.next() * 0.5;

                candidates.push({ dir, score });
            }
        }

        if (candidates.length === 0) {
            return null; // All directions blocked
        }

        // Sort by score and pick the best
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0].dir.clone();
    }

    updatePhysics(dt) {
        if (this.canHop) {
            this.updateHopperPhysics(dt);
        } else {
            this.updateWalkerPhysics(dt);
        }

        // Apply Levitation Override
        if (this.levitationTimer > 0) {
            this.velocity.y += this.gravity * 1.5 * dt; // Counter gravity + lift
            // Cap upward speed
            if (this.velocity.y > 2.0) this.velocity.y = 2.0;
        }

        // Resolve any remaining overlaps (e.g. from rotation)
        this.resolveCollision(dt);

        // World Bounds (Despawn or turn logic)
        if (this.position.y < -50) {
            this.position.y = 100;
            if (this.velocity.y < 0) this.velocity.y = 0;
        }
    }

    updateWalkerPhysics(dt) {
        // WALKER PHYSICS (Pigs, Horses, etc)
        // Principle: Stick to the ground unless falling significantly. No bouncy physics.
        const pos = this.position;

        // 0. Unstuck Logic (Prevent clipping)
        // Check if our center is inside a solid block
        const bodyBlockX = Math.floor(pos.x);
        const bodyBlockY = Math.floor(pos.y);
        const bodyBlockZ = Math.floor(pos.z);
        if (this.game.getBlock(bodyBlockX, bodyBlockY, bodyBlockZ)) {
            // We are inside a block! Push up to top of it.
            pos.y = bodyBlockY + 1;
            this.velocity.y = 0;
            return; // Critical unstuck, skip rest for this frame
        }

        // 1. Handle Curve Movement (Climbing)
        if (this.isOnCurvePath) {
            this.curveProgress += this.curveSpeed * dt;

            if (this.curveProgress >= 1.0) {
                // Arrived
                this.curveProgress = 1.0;
                this.position.copy(this.curveEnd);
                this.isOnCurvePath = false;
                this.velocity.y = 0;
            } else {
                // Interpolate
                const t = this.curveProgress;
                const smoothT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

                this.position.x = this.curveStart.x + (this.curveEnd.x - this.curveStart.x) * smoothT;
                this.position.z = this.curveStart.z + (this.curveEnd.z - this.curveStart.z) * smoothT;

                // Parabolic Y arc
                const heightDiff = this.curveEnd.y - this.curveStart.y;
                const arcHeight = heightDiff * 0.2;
                const yBase = this.curveStart.y + heightDiff * smoothT;
                const arc = 4 * arcHeight * t * (1 - t);
                this.position.y = yBase + arc;
            }
            return; // Skip other physics while climbing
        }

        // 2. Horizontal Movement
        let dx = 0;
        let dz = 0;

        if (!this.isDying && (this.rider || this.state === 'walk' || this.state === 'chase' || this.state === 'flee')) {
            dx = this.moveDirection.x * this.speed * dt;
            dz = this.moveDirection.z * this.speed * dt;
        }

        // Add knockback
        dx += this.knockbackVelocity.x * dt;
        dz += this.knockbackVelocity.z * dt;

        // Friction
        const friction = 5.0; // Damping factor
        this.knockbackVelocity.x -= this.knockbackVelocity.x * friction * dt;
        this.knockbackVelocity.z -= this.knockbackVelocity.z * friction * dt;

        // Stop if small
        if (Math.abs(this.knockbackVelocity.x) < 0.1) this.knockbackVelocity.x = 0;
        if (Math.abs(this.knockbackVelocity.z) < 0.1) this.knockbackVelocity.z = 0;

        // 3. Move X/Z with Collision (and detect climbing)
        const nextX = pos.x + dx;
        if (!this.checkBodyCollision(nextX, pos.y, pos.z)) {
            pos.x = nextX;
        } else {
            this.attemptClimb(nextX, pos.z);
            if (this.isOnCurvePath) return;
            if (this.state === 'walk') this.stateTimer = 0;
        }

        const nextZ = pos.z + dz;
        if (!this.checkBodyCollision(pos.x, pos.y, nextZ)) {
            pos.z = nextZ;
        } else {
            this.attemptClimb(pos.x, nextZ);
            if (this.isOnCurvePath) return;
            if (this.state === 'walk') this.stateTimer = 0;
        }

        // 4. Vertical Logic (Ground Snapping) with Multi-Point Check
        // To prevent sinking on ledges, we check 5 points: Center + 4 Corners

        const hw = this.width / 2 * 0.8; // Reduce slightly to avoid wall friction
        const hd = this.depth / 2 * 0.8;
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);

        const checkPoints = [
            { x: 0, z: 0 }, // Center
            { x: hw, z: hd },
            { x: -hw, z: hd },
            { x: -hw, z: -hd },
            { x: hw, z: -hd }
        ];

        let highestGroundY = -Infinity;
        const checkBaseY = Math.floor(pos.y + 0.1);

        // Check each point
        for (const pt of checkPoints) {
            // Rotate local point
            const rx = pt.x * cos - pt.z * sin;
            const rz = pt.x * sin + pt.z * cos;

            const checkX = pos.x + rx;
            const checkZ = pos.z + rz;

            // Check downward for this point
            for (let y = checkBaseY; y >= checkBaseY - 2; y--) {
                if (this.checkSolid(checkX, y, checkZ)) {
                    const blockTop = y + 1;
                    if (blockTop > highestGroundY) {
                        highestGroundY = blockTop;
                    }
                    break;
                }
            }
        }

        const groundY = highestGroundY; // Use the highest found ground
        const distToGround = pos.y - groundY;

        if (distToGround >= -0.1 && distToGround < 1.0) {
            // SNAP TO GROUND
            pos.y = groundY;
            this.velocity.y = 0;
            this.onGround = true;
        } else {
            // FALLING
            // Either we are high in the air, or groundY is -Infinity (hole)
            this.onGround = false;
            this.velocity.y -= this.gravity * dt;
            this.velocity.y = Math.max(this.velocity.y, -40);

            // Apply falling
            pos.y += this.velocity.y * dt;

            // Check if we passed through ground
            if (pos.y < groundY) {
                pos.y = groundY;
                this.velocity.y = 0;
                this.onGround = true;
            }
        }
    }

    attemptClimb(targetX, targetZ) {
        // Can we step up?
        // Target block must be solid (wall)
        // Target + 1 must be empty (space to stand)
        // Target + 2 must be empty (headroom)

        const pos = this.position;
        const currentY = Math.floor(pos.y);

        // Wall is at currentY
        if (this.checkSolid(targetX, currentY, targetZ)) {
            // Check space above wall
            if (!this.checkSolid(targetX, currentY + 1, targetZ) &&
                !this.checkSolid(targetX, currentY + 2, targetZ)) {

                // Initiate Curve
                this.isOnCurvePath = true;
                this.curveStart.copy(pos);

                // Target center
                const gx = Math.floor(targetX) + 0.5;
                const gz = Math.floor(targetZ) + 0.5;
                const gy = currentY + 1;

                this.curveEnd.set(gx, gy, gz);
                this.curveProgress = 0;
            }
        }
    }

    updateHopperPhysics(dt) {
        // HOPPER PHYSICS (Bunnies, Frogs)
        // Standard velocity-based physics with jumping

        // Gravity
        this.velocity.y -= this.gravity * dt;
        this.velocity.y = Math.max(this.velocity.y, -40);

        let dx = 0;
        let dz = 0;
        if (!this.isDying && (this.rider || this.state === 'walk' || this.state === 'chase' || this.state === 'flee')) {
            dx = this.moveDirection.x * this.speed * dt;
            dz = this.moveDirection.z * this.speed * dt;
        }

        // Add knockback
        dx += this.knockbackVelocity.x * dt;
        dz += this.knockbackVelocity.z * dt;

        // Friction
        const friction = 5.0;
        this.knockbackVelocity.x -= this.knockbackVelocity.x * friction * dt;
        this.knockbackVelocity.z -= this.knockbackVelocity.z * friction * dt;

        if (Math.abs(this.knockbackVelocity.x) < 0.1) this.knockbackVelocity.x = 0;
        if (Math.abs(this.knockbackVelocity.z) < 0.1) this.knockbackVelocity.z = 0;

        // Use the old robust collision logic for them
        this.moveWithCollision(dx, this.velocity.y * dt, dz);
    }

    moveWithCollision(dx, dy, dz) {
        // This method is now ONLY used by Hoppers
        const pos = this.position;
        let movedUp = false;

        // 1. Resolve Y Axis
        if (dy < 0) {
            // Falling
            const newY = pos.y + dy;
            if (this.checkBodyCollision(pos.x, newY, pos.z)) {
                // Land
                pos.y = Math.floor(newY) + 1;
                this.velocity.y = 0;
                this.onGround = true;
            } else {
                pos.y = newY;
                this.onGround = false;
            }
        } else if (dy > 0) {
            // Jumping
            const newY = pos.y + dy;
            pos.y = newY;
            this.onGround = false;
        } else {
            // Level
            if (!this.checkBodyCollision(pos.x, pos.y - 0.1, pos.z)) {
                this.onGround = false;
            }
        }

        // 2. Resolve X/Z Axis
        const nextX = pos.x + dx;
        if (!this.checkBodyCollision(nextX, pos.y, pos.z)) {
            pos.x = nextX;
        } else {
            // Auto-jump for hoppers
            if (!movedUp && this.onGround && !this.checkBodyCollision(nextX, pos.y + 1.1, pos.z)) {
                pos.x = nextX;
                pos.y += 1.0;
                this.velocity.y = this.jumpForce || 8;
                this.onGround = false;
                movedUp = true;
            } else {
                if (this.state === 'walk') this.stateTimer = 0;
            }
        }

        const nextZ = pos.z + dz;
        if (!this.checkBodyCollision(pos.x, pos.y, nextZ)) {
            pos.z = nextZ;
        } else {
            // Auto-jump for hoppers
            if (!movedUp && this.onGround && !this.checkBodyCollision(pos.x, pos.y + 1.1, nextZ)) {
                pos.z = nextZ;
                pos.y += 1.0;
                this.velocity.y = this.jumpForce || 8;
                this.onGround = false;
                movedUp = true;
            } else {
                if (this.state === 'walk') this.stateTimer = 0;
            }
        }

        // Unstuck for hoppers
        if (this.checkBodyCollision(pos.x, pos.y, pos.z)) {
            const feetBlockY = Math.floor(pos.y);
            if (this.game.getBlock(Math.floor(pos.x), feetBlockY, Math.floor(pos.z))) {
                pos.y = feetBlockY + 1;
                this.velocity.y = 0;
            }
        }
    }

    checkSolid(x, y, z) {
        return !!this.game.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    }

    checkBodyCollision(x, y, z) {
        // Calculate Axis-Aligned Bounding Box (AABB) of the rotated entity
        const cos = Math.abs(Math.cos(this.rotation));
        const sin = Math.abs(Math.sin(this.rotation));

        // Effective width/depth in world axis
        const effW = (this.width * cos + this.depth * sin) * this.collisionScale;
        const effD = (this.width * sin + this.depth * cos) * this.collisionScale;

        const hw = effW / 2;
        const hd = effD / 2;
        const height = this.height;

        const minX = x - hw;
        const maxX = x + hw;
        const minZ = z - hd;
        const maxZ = z + hd;
        const minY = y;
        const maxY = y + height;

        const startBX = Math.floor(minX);
        const endBX = Math.floor(maxX);
        const startBY = Math.floor(minY);
        const endBY = Math.floor(maxY - 0.01);
        const startBZ = Math.floor(minZ);
        const endBZ = Math.floor(maxZ);

        for (let bx = startBX; bx <= endBX; bx++) {
            for (let by = startBY; by <= endBY; by++) {
                for (let bz = startBZ; bz <= endBZ; bz++) {
                    if (this.game.getBlock(bx, by, bz)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    resolveCollision(dt) {
        // Pushes the animal out of blocks if it's intersecting
        const pos = this.position;
        const width = this.width;
        const depth = this.depth;
        const height = this.height;

        // Bounding box corners (rotated)
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);

        const hw = width / 2;
        const hd = depth / 2;

        // 4 corners of the base
        const corners = [
            { x: -hw, z: -hd },
            { x: hw, z: -hd },
            { x: hw, z: hd },
            { x: -hw, z: hd }
        ];

        let collisionVector = new THREE.Vector3();
        let collisionCount = 0;

        for (const c of corners) {
            // Rotate
            const rx = c.x * cos - c.z * sin;
            const rz = c.x * sin + c.z * cos;

            const worldX = pos.x + rx;
            const worldZ = pos.z + rz;

            // Check checking a few points up the height
            for (let h = 0; h < height; h += 0.8) {
                const checkY = pos.y + h;
                const bx = Math.floor(worldX);
                const by = Math.floor(checkY);
                const bz = Math.floor(worldZ);

                if (this.game.getBlock(bx, by, bz)) {
                    // Collision!
                    // Calculate push vector (center of block to point)
                    const blockCenter = new THREE.Vector3(bx + 0.5, by + 0.5, bz + 0.5);
                    const point = new THREE.Vector3(worldX, checkY, worldZ);
                    const push = new THREE.Vector3().subVectors(point, blockCenter);

                    // Ignore Y push for now (gravity handles Y)
                    push.y = 0;
                    push.normalize();

                    collisionVector.add(push);
                    collisionCount++;
                    break; // One collision per corner is enough to register
                }

            }
        }

        if (collisionCount > 0) {
            collisionVector.divideScalar(collisionCount);
            if (collisionVector.lengthSq() > 0.001) {
                collisionVector.normalize();

                // Push out
                const pushSpeed = 2.0;
                this.position.x += collisionVector.x * pushSpeed * dt;
                this.position.z += collisionVector.z * pushSpeed * dt;

                // Also kill velocity into the wall
                // this.velocity.add(collisionVector.multiplyScalar(5 * dt)); 
            }
        }
    }

    updateAnimation(dt) {
        if (this.isMoving) {
            this.animTime += dt * this.legSwingSpeed;
            const angle = Math.sin(this.animTime) * 0.5;

            // Swing legs
            // Assuming legParts array has [frontLeft, frontRight, backLeft, backRight]
            if (this.legParts.length >= 4) {
                this.legParts[0].rotation.x = angle;
                this.legParts[1].rotation.x = -angle;
                this.legParts[2].rotation.x = -angle;
                this.legParts[3].rotation.x = angle;
            } else if (this.legParts.length >= 2) {
                // Chicken (2 legs)
                this.legParts[0].rotation.x = angle;
                this.legParts[1].rotation.x = -angle;
            }

            // Also swing arms if they are not attacking
            if (this.armParts && this.armParts.length >= 2 && !this.isAttacking) {
                // For zombies, they hold arms forward, so we skip normal swing
                if (this.constructor.name !== 'Zombie' && this.constructor.name !== 'Skeleton') {
                    this.armParts[0].rotation.x = -angle;
                    this.armParts[1].rotation.x = angle;
                }
            }
        } else {
            // Reset legs
            for (const leg of this.legParts) {
                leg.rotation.x = 0;
            }
        }

        // Handle attack animation
        if (this.isAttacking) {
            this.attackAnimTimer -= dt;
            if (this.attackAnimTimer <= 0) {
                this.isAttacking = false;
                // Reset arms to default
                if (this.armParts && this.armParts.length >= 2) {
                    if (this.constructor.name === 'Zombie') {
                        this.armParts[0].rotation.x = -Math.PI / 2;
                        this.armParts[1].rotation.x = -Math.PI / 2;
                    } else {
                        this.armParts[0].rotation.x = 0;
                        this.armParts[1].rotation.x = 0;
                    }
                }
            } else {
                // Swing arm forward
                if (this.armParts && this.armParts.length >= 2) {
                    const progress = 1.0 - (this.attackAnimTimer / 0.3);
                    const angle = Math.sin(progress * Math.PI) * -1.0;
                    this.armParts[1].rotation.x = angle; // Right arm
                }
            }
        }
    }
    checkProximityFlee(range) {
        if (!this.game.player || this.game.player.health <= 0) return false;

        const distSq = this.position.distanceToSquared(this.game.player.position);
        if (distSq < range * range) {
            this.fleeFrom(this.game.player);
            return true;
        }
        return false;
    }

    dispose() {
        if (this.mesh) {
            this.mesh.traverse((node) => {
                if (node.isMesh) {
                    if (node.geometry) {
                        node.geometry.dispose();
                    }
                    if (node.material) {
                        if (Array.isArray(node.material)) {
                            node.material.forEach(mat => this.disposeMaterial(mat));
                        } else {
                            this.disposeMaterial(node.material);
                        }
                    }
                }
            });
            // Caller handles removal from scene to avoid index issues
        }

        // Clean up speech bubble texture if it exists (Snowman)
        if (this.speechTexture) {
            this.speechTexture.dispose();
        }
    }

    disposeMaterial(material) {
        if (!material) return;

        material.dispose();

        // Dispose textures map
        if (material.map) material.map.dispose();
        if (material.lightMap) material.lightMap.dispose();
        if (material.bumpMap) material.bumpMap.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.specularMap) material.specularMap.dispose();
        if (material.envMap) material.envMap.dispose();
    }
}
