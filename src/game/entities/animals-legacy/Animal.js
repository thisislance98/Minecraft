import * as THREE from 'three';

export class Animal {
    constructor(game, x, y, z) {
        this.game = game;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = Math.random() * Math.PI * 2;

        // Dimensions (should be overridden)
        this.width = 0.8;
        this.height = 1.0;
        this.depth = 0.8;

        // Stats
        this.speed = 2.0; // units/sec
        this.gravity = 30.0;

        // State
        this.onGround = false;
        this.isMoving = false;

        // AI
        this.state = 'idle'; // idle, walk
        this.stateTimer = Math.random() * 3 + 1;
        this.moveDirection = new THREE.Vector3();

        // Animation
        this.animTime = 0;
        this.legSwingSpeed = 10;

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

        // Pathfinding
        this.path = [];
        this.currentPathNode = 0;
        this.pathUpdateTimer = 0;
        this.targetBlock = null;

        // Rotation Smoothing
        this.targetRotation = this.rotation;
    }

    takeDamage(amount) {
        if (this.isDead) return;

        this.health -= amount;
        this.flashTimer = 1.0; // Flash red for 1s

        if (this.health <= 0) {
            this.health = 0;
            this.startDeath();
        }
    }

    knockback(direction, force) {
        // direction is a normalized Vector3
        // force is scalar
        this.knockbackVelocity.x = direction.x * force;
        this.knockbackVelocity.z = direction.z * force;
        this.velocity.y = 5; // Little hop
        this.onGround = false;
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

        this.updateAI(dt);
        this.updatePhysics(dt);
        this.updateAnimation(dt);
        this.updateDeath(dt);


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

        // Sync mesh
        this.mesh.position.copy(this.position);

        // Smart Rotation
        if (!this.isDying) {
            // Smooth rotation
            let diff = this.targetRotation - this.rotation;
            // Normalize -PI to PI
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            if (Math.abs(diff) > 0.01) {
                // Check for collision if we rotate
                // Simple heuristic: If close to wall, don't rotate tail into it?
                // Actually, just Rotate
                // speed radians per sec
                const rotSpeed = 4.0;
                if (diff > 0) this.rotation += Math.min(diff, rotSpeed * dt);
                else this.rotation -= Math.min(-diff, rotSpeed * dt);
            } else {
                this.rotation = this.targetRotation;
            }

            this.mesh.rotation.y = this.rotation;
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
        this.stateTimer -= dt;

        if (this.state === 'walk') {
            // Check if reached destination or path finished
            if (this.path.length === 0 || this.currentPathNode >= this.path.length) {
                this.state = 'idle';
                this.stateTimer = Math.random() * 3 + 2;
                this.isMoving = false;
                this.path = [];
                return;
            }

            const targetNode = this.path[this.currentPathNode];
            const targetPos = new THREE.Vector3(targetNode.x + 0.5, targetNode.y, targetNode.z + 0.5);

            // Check distance (ignore Y for arrival check on ladders/stairs logic basically)
            const dx = targetPos.x - this.position.x;
            const dz = targetPos.z - this.position.z;
            const distSq = dx * dx + dz * dz;

            if (distSq < 0.1 * 0.1) {
                // Reached node
                this.currentPathNode++;
                if (this.currentPathNode >= this.path.length) {
                    this.state = 'idle';
                    this.stateTimer = Math.random() * 2 + 1;
                    this.isMoving = false;
                }
            } else {
                // Move towards target
                const angle = Math.atan2(dx, dz);
                this.targetRotation = angle;

                // Smart Rotation: Only update move direction if we are roughly facing the right way? 
                // Or just set move vector.
                this.moveDirection.set(Math.sin(angle), 0, Math.cos(angle));
                this.isMoving = true;
            }

        } else if (this.state === 'idle') {
            if (this.stateTimer <= 0) {
                if (Math.random() < 0.7) {
                    // Try to find a path
                    const range = 8;
                    const rX = Math.floor(this.position.x + (Math.random() - 0.5) * range * 2);
                    const rZ = Math.floor(this.position.z + (Math.random() - 0.5) * range * 2);

                    // Simple "ground" search at target
                    const terrainY = this.game.worldGen.getTerrainHeight(rX, rZ); // Approximate, or trace down
                    // Let pathfinder handle validation, just pick a spot relative to current Y
                    // But we want a valid likely spot.

                    const startY = Math.floor(this.position.y);
                    const rY = startY + Math.floor((Math.random() - 0.5) * 4); // +/- 2 levels

                    const endPos = new THREE.Vector3(rX, rY, rZ);
                    const path = Pathfinder.findPath(this.game, this.position, endPos, 200);

                    if (path && path.length > 0) {
                        this.path = path;
                        this.currentPathNode = 0;
                        this.state = 'walk';
                        this.stateTimer = 10; // Max walk time
                    } else {
                        // Failed, wait a bit
                        this.stateTimer = 1.0;
                    }
                } else {
                    this.stateTimer = Math.random() * 2 + 1;
                }
            }
        }
    }

    updatePhysics(dt) {
        if (this.canHop) {
            this.updateHopperPhysics(dt);
        } else {
            this.updateWalkerPhysics(dt);
        }

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

        if (!this.isDying && (this.state === 'walk' || this.state === 'chase' || this.state === 'flee')) {
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
        if (!this.isDying && (this.state === 'walk' || this.state === 'chase' || this.state === 'flee')) {
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
        const effW = (this.width * cos + this.depth * sin) * 0.8; // 0.8 scale for forgiveness
        const effD = (this.width * sin + this.depth * cos) * 0.8;

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
        } else {
            // Reset legs
            for (const leg of this.legParts) {
                leg.rotation.x = 0;
            }
        }
    }
}
