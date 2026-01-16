import { Pathfinder } from './Pathfinder.js';
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

export class Pig extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.7;
        this.height = 0.7;
        this.depth = 1.0;
        this.createBody();
        this.mesh.scale.set(0.75, 0.75, 0.75);
    }

    createBody() {
        // Pig: Pink
        const skinColor = 0xF0ACBC;
        const mat = new THREE.MeshLambertMaterial({ color: skinColor });
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const hoofMat = new THREE.MeshLambertMaterial({ color: 0x5C3A21 }); // Dark brown for hooves
        const darkPinkMat = new THREE.MeshLambertMaterial({ color: 0xD68E9E }); // Darker pink for details

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.8, 0.7, 1.1);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.6, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.9, 0.8);
        this.mesh.add(head);

        // Snout
        const snoutGeo = new THREE.BoxGeometry(0.3, 0.2, 0.1);
        const snout = new THREE.Mesh(snoutGeo, mat);
        snout.position.set(0, 0.8, 1.15);
        this.mesh.add(snout);

        // Nostrils
        const nostrilGeo = new THREE.BoxGeometry(0.05, 0.05, 0.02);
        const leftNostril = new THREE.Mesh(nostrilGeo, blackMat);
        leftNostril.position.set(-0.08, 0.8, 1.205); // Slightly in front of snout
        this.mesh.add(leftNostril);

        const rightNostril = new THREE.Mesh(nostrilGeo, blackMat);
        rightNostril.position.set(0.08, 0.8, 1.205);
        this.mesh.add(rightNostril);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.2, 0.2, 0.05);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.25, 1.15, 0.9);
        leftEar.rotation.z = 0.2; // Tilt out
        leftEar.rotation.x = 0.2; // Tilt forward
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.25, 1.15, 0.9);
        rightEar.rotation.z = -0.2;
        rightEar.rotation.x = 0.2;
        this.mesh.add(rightEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
        const pupilGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);

        // Left Eye
        const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.2, 1.0, 1.1);
        this.mesh.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.2, 1.0, 1.12);
        this.mesh.add(leftPupil);

        // Right Eye
        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.2, 1.0, 1.1);
        this.mesh.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.2, 1.0, 1.12);
        this.mesh.add(rightPupil);

        // Curly Tail
        const tailGroup = new THREE.Group();
        tailGroup.position.set(0, 0.8, -0.55); // Back of body
        this.mesh.add(tailGroup);

        const tailSegGeo = new THREE.BoxGeometry(0.1, 0.1, 0.15);
        // Segment 1 (Base)
        const tail1 = new THREE.Mesh(tailSegGeo, mat);
        tail1.position.set(0, 0, 0);
        tail1.rotation.x = -0.5;
        tailGroup.add(tail1);

        // Segment 2 (Curl up)
        const tail2 = new THREE.Mesh(tailSegGeo, mat);
        tail2.position.set(0, 0.08, -0.1);
        tail2.rotation.x = -1.5;
        tailGroup.add(tail2);

        // Segment 3 (Curl back)
        const tail3 = new THREE.Mesh(tailSegGeo, mat);
        tail3.position.set(0, 0.05, -0.2); // Relative to group
        // A simple spiral approximation is hard with boxes, let's just make a little hook
        // Re-positioning for a simpler hook look
        tail1.position.set(0, 0, 0);
        tail1.rotation.set(0.5, 0, 0);

        tail2.position.set(0, 0.1, -0.05);
        tail2.rotation.set(1.5, 0, 0);

        tail3.position.set(0, 0.05, -0.12);
        tail3.rotation.set(2.5, 0, 0);
        // Just keeping previous add calls, overwriting pos

        // Legs with Hooves
        // Leg Geometry: Top part pink, bottom part hoof
        const legW = 0.25;
        const legH = 0.4;
        const hoofH = 0.1;

        const legGeo = new THREE.BoxGeometry(legW, legH - hoofH, legW);
        const hoofGeo = new THREE.BoxGeometry(legW, hoofH, legW);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.4, z); // Hip position

            // Upper leg
            const legMesh = new THREE.Mesh(legGeo, mat);
            legMesh.position.set(0, -((legH - hoofH) / 2), 0);
            pivot.add(legMesh);

            // Hoof
            const hoofMesh = new THREE.Mesh(hoofGeo, hoofMat);
            hoofMesh.position.set(0, -(legH - hoofH) - (hoofH / 2), 0);
            pivot.add(hoofMesh);

            // Re-center pivot visuals so 0,0,0 is top of leg
            // Total lenth is legH. 
            // legMesh center Y = - (0.3 / 2) = -0.15
            // hoofMesh center Y = -0.3 - 0.05 = -0.35
            // Visuals look correct relative to pivot.

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.25, 0.4),
            makeLeg(0.25, 0.4),
            makeLeg(-0.25, -0.4),
            makeLeg(0.25, -0.4)
        ];
    }
}

export class Horse extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.75;
        this.height = 1.2;
        this.depth = 1.2;
        this.speed = 4.0;
        this.legSwingSpeed = 5; // Slower animation for horses
        this.createBody();
        this.mesh.scale.set(0.75, 0.75, 0.75);
    }

    createBody() {
        // Horse: Brown
        const skinColor = 0xA0522D;
        const mat = new THREE.MeshLambertMaterial({ color: skinColor });
        const darkMat = new THREE.MeshLambertMaterial({ color: 0x4B2510 }); // Hooves/Mane
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF }); // Eyes
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 }); // Pupils

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.9, 0.8, 1.4);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 1.1, 0);
        this.mesh.add(body);

        // Neck/Head
        const neckGeo = new THREE.BoxGeometry(0.4, 0.7, 0.4);
        const neck = new THREE.Mesh(neckGeo, mat);
        neck.position.set(0, 1.5, 0.7);
        neck.rotation.x = Math.PI / 4; // Angled forward
        this.mesh.add(neck);

        const headGeo = new THREE.BoxGeometry(0.55, 0.55, 1.0);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 1.9, 1.15); // Lower and closer to body
        head.rotation.x = Math.PI / 6; // leveling head (nose down)
        this.mesh.add(head);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.12, 0.18, 0.1);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.2, 2.3, 0.85); // Adjusted for new head pos
        leftEar.rotation.x = Math.PI / 6; // Match head tilt
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.2, 2.3, 0.85);
        rightEar.rotation.x = Math.PI / 6;
        this.mesh.add(rightEar);

        // Eyes (on sides of head)
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.12, 0.12);
        const pupilGeo = new THREE.BoxGeometry(0.04, 0.08, 0.08);

        // Left eye
        const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.28, 2.0, 1.35);
        this.mesh.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.31, 2.0, 1.38);
        this.mesh.add(leftPupil);

        // Right eye
        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.28, 2.0, 1.35);
        this.mesh.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.31, 2.0, 1.38);
        this.mesh.add(rightPupil);

        // Mane (along neck and top of head)
        const maneGeo = new THREE.BoxGeometry(0.15, 0.5, 0.25);
        const mane = new THREE.Mesh(maneGeo, darkMat);
        mane.position.set(0, 1.7, 0.65); // Adjusted for shorter neck
        mane.rotation.x = Math.PI / 4;
        this.mesh.add(mane);

        // Mane on top of head
        const headManeGeo = new THREE.BoxGeometry(0.12, 0.2, 0.4);
        const headMane = new THREE.Mesh(headManeGeo, darkMat);
        headMane.position.set(0, 2.25, 1.05); // Adjusted for new head
        this.mesh.add(headMane);

        // Tail (at the back of the body)
        const tailPivot = new THREE.Group();
        tailPivot.position.set(0, 1.3, -0.7);

        const tailGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);
        const tail = new THREE.Mesh(tailGeo, darkMat);
        tail.position.set(0, -0.3, 0);
        tailPivot.add(tail);

        // Tail tip (flowing part)
        const tailTipGeo = new THREE.BoxGeometry(0.12, 0.4, 0.12);
        const tailTip = new THREE.Mesh(tailTipGeo, darkMat);
        tailTip.position.set(0, -0.7, 0);
        tailPivot.add(tailTip);

        tailPivot.rotation.x = 0.3; // Slight angle
        this.mesh.add(tailPivot);
        this.tailPivot = tailPivot;

        // Legs
        const legGeo = new THREE.BoxGeometry(0.3, 0.9, 0.3);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.9, z);
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.45, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.3, 0.5),
            makeLeg(0.3, 0.5),
            makeLeg(-0.3, -0.5),
            makeLeg(0.3, -0.5)
        ];
    }

    updateAnimation(dt) {
        super.updateAnimation(dt);

        // Animate tail swishing
        if (this.tailPivot) {
            const tailSwing = Math.sin(this.animTime * 0.5) * 0.2;
            this.tailPivot.rotation.z = tailSwing;
        }
    }
}

export class Chicken extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.5;
        this.height = 0.7;
        this.depth = 0.5;
        this.speed = 1.5;
        this.createBody();
    }

    createBody() {
        // Chicken: White
        const bodyColor = 0xFFFFFF;
        const mat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const redMat = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
        const yellowMat = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.4, 0.4, 0.5);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.4, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.2, 0.3, 0.2);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.7, 0.2);
        this.mesh.add(head);

        // Beak
        const beakGeo = new THREE.BoxGeometry(0.1, 0.05, 0.1);
        const beak = new THREE.Mesh(beakGeo, yellowMat);
        beak.position.set(0, 0.7, 0.35);
        this.mesh.add(beak);

        // Red Thing (Wattle)
        const wattleGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const wattle = new THREE.Mesh(wattleGeo, redMat);
        wattle.position.set(0, 0.6, 0.25);
        this.mesh.add(wattle);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);

        // Left Eye
        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.1, 0.78, 0.22);
        this.mesh.add(leftEye);

        // Right Eye
        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.1, 0.78, 0.22);
        this.mesh.add(rightEye);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.05, 0.3, 0.05);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.3, z);
            const leg = new THREE.Mesh(legGeo, yellowMat);
            leg.position.set(0, -0.15, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.1, 0.1),
            makeLeg(0.1, 0.1)
        ];
    }
}

export class Bunny extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.4;
        this.height = 0.6;
        this.depth = 0.6;
        this.speed = 3.0; // Fast movement when hopping
        this.jumpForce = 15; // Jumps really high
        this.canHop = true; // Bunnies hop up mountains
        this.isCarried = false; // Can be picked up by elephants
        this.createBody();
    }

    createBody() {
        // Bunny: White/Grey
        const furColor = 0xE0E0E0;
        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const earInnerMat = new THREE.MeshLambertMaterial({ color: 0xF0ACBC }); // Pink inside ears
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.4, 0.4, 0.5);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.3, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.5, 0.3);
        this.mesh.add(head);

        // Ears (Long!)
        const earGeo = new THREE.BoxGeometry(0.08, 0.4, 0.05);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.08, 0.8, 0.3);
        leftEar.rotation.z = -0.1;
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.08, 0.8, 0.3);
        rightEar.rotation.z = 0.1;
        this.mesh.add(rightEar);

        // Tail (Small puff)
        const tailGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 0.35, -0.25);
        this.mesh.add(tail);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);

        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.16, 0.55, 0.4);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.16, 0.55, 0.4);
        this.mesh.add(rightEye);

        // Legs (Simplistic for now, maybe hopping animation later)
        const legGeo = new THREE.BoxGeometry(0.1, 0.2, 0.1);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.2, z);
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.1, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.15, 0.15),
            makeLeg(0.15, 0.15),
            makeLeg(-0.15, -0.15),
            makeLeg(0.15, -0.15)
        ];
    }

    updateAI(dt) {
        // Skip AI if being carried
        if (this.isCarried) return;

        // Flee from Wolves
        const fearRange = 10.0;
        let nearestWolf = null;
        let nearestDist = fearRange * fearRange;

        if (this.game.animals) {
            for (const other of this.game.animals) {
                if (other instanceof Wolf) {
                    const distSq = this.position.distanceToSquared(other.position);
                    if (distSq < nearestDist) {
                        nearestDist = distSq;
                        nearestWolf = other;
                    }
                }
            }
        }

        if (nearestWolf) {
            this.state = 'flee';
            this.stateTimer = 1.0; // Flee for at least 1 second

            // Run away from wolf
            const fleeDir = new THREE.Vector3().subVectors(this.position, nearestWolf.position).normalize();
            fleeDir.y = 0; // Keep horizontal
            this.moveDirection.copy(fleeDir);
            this.rotation = Math.atan2(this.moveDirection.x, this.moveDirection.z);
            this.isMoving = true;

            // Panic jumping handled in updatePhysics
        } else {
            super.updateAI(dt);
        }
    }

    updatePhysics(dt) {
        // Skip physics if being carried
        if (this.isCarried) return;

        // Jump when moving (hopping)
        if ((this.state === 'walk' || this.state === 'flee') && this.onGround) {
            this.velocity.y = this.jumpForce;
            this.onGround = false;
        }
        super.updatePhysics(dt);
    }
}

export class Wolf extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.6;
        this.height = 0.8;
        this.depth = 0.8; // Reduced hitbox size (visuals are 1.4 body + tail) to prevent stuck
        this.speed = 5.0; // Fast
        this.createBody();
    }

    createBody() {
        // Wolf: Grey
        const furColor = 0x808080;
        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const noseMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.6, 0.6, 1.4); // Longer body mesh
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.6, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.6);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.9, 0.9); // Moved head forward slightly (0.7 -> 0.9)
        this.mesh.add(head);

        // Snout
        const snoutGeo = new THREE.BoxGeometry(0.25, 0.25, 0.3);
        const snout = new THREE.Mesh(snoutGeo, mat);
        snout.position.set(0, 0.8, 1.3); // Moved snout forward (1.1 -> 1.3)
        this.mesh.add(snout);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 0.9, 1.45); // Moved nose forward (1.25 -> 1.45)
        this.mesh.add(nose);

        // Ears (Pointy)
        const earGeo = new THREE.BoxGeometry(0.15, 0.2, 0.1);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.18, 1.2, 0.85); // Moved ears forward (0.65 -> 0.85)
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.18, 1.2, 0.85); // Moved ears forward (0.65 -> 0.85)
        this.mesh.add(rightEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const pupilGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);

        // Left Eye
        const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.15, 0.95, 1.2); // Moved eyes forward (1.0 -> 1.2)
        this.mesh.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.15, 0.95, 1.23); // Moved pupils forward (1.03 -> 1.23)
        this.mesh.add(leftPupil);

        // Right Eye
        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.15, 0.95, 1.2); // Moved eyes forward (1.0 -> 1.2)
        this.mesh.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.15, 0.95, 1.23); // Moved pupils forward (1.03 -> 1.23)
        this.mesh.add(rightPupil);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.15, 0.15, 1.0); // Longer tail (0.6 -> 1.0)
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 0.7, -0.9); // Moved tail back (-0.6 -> -0.9)
        tail.rotation.x = -0.4;
        this.mesh.add(tail);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.2, 0.5, 0.2);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.5, z);
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.25, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.2, 0.5), // Spread legs a bit more (0.4 -> 0.5)
            makeLeg(0.2, 0.5),
            makeLeg(-0.2, -0.5), // (-0.4 -> -0.5)
            makeLeg(0.2, -0.5)
        ];
    }

    updateAI(dt) {
        // Look for bunnies!
        const detectionRange = 20.0;
        const attackRange = 1.5;
        let target = null;
        let nearestDist = detectionRange * detectionRange;

        if (this.game.animals) {
            for (const animal of this.game.animals) {
                if (animal instanceof Bunny && !animal.isDead) {
                    const distSq = this.position.distanceToSquared(animal.position);
                    if (distSq < nearestDist) {
                        nearestDist = distSq;
                        target = animal;
                    }
                }
            }
        }

        if (target) {
            this.state = 'chase';
            // Move towards bunny
            const dir = new THREE.Vector3().subVectors(target.position, this.position);
            const dist = dir.length();

            if (dist < attackRange) {
                // EAT!
                target.takeDamage(100); // Instakill
                // Remove from game handled by isDead check in main loop usually, 
                // but let's force update now or assume next frame cleans up.
                // We could play a sound or particle here.

                // Stop moving briefly
                this.state = 'idle';
                this.stateTimer = 1.0;
                this.isMoving = false;
            } else {
                dir.normalize();
                this.moveDirection.copy(dir);
                this.rotation = Math.atan2(dir.x, dir.z);
                this.isMoving = true;
            }
        } else {
            // No bunnies, wander normally
            super.updateAI(dt);
        }
    }
}

export class Frog extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.4;
        this.height = 0.3;
        this.depth = 0.4;
        this.speed = 2.0;
        this.jumpForce = 8;
        this.canHop = true; // Frogs hop up mountains
        this.createBody();
    }

    createBody() {
        // Frog: Green
        const skinColor = 0x4CAF50;
        const mat = new THREE.MeshLambertMaterial({ color: skinColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.4, 0.2, 0.4);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.15, 0);
        this.mesh.add(body);

        // Eyes (On top)
        const eyeBumpGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);

        const leftEyeBump = new THREE.Mesh(eyeBumpGeo, mat);
        leftEyeBump.position.set(-0.12, 0.25, 0.1);
        this.mesh.add(leftEyeBump);

        const rightEyeBump = new THREE.Mesh(eyeBumpGeo, mat);
        rightEyeBump.position.set(0.12, 0.25, 0.1);
        this.mesh.add(rightEyeBump);

        // Pupils
        const pupilGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.12, 0.28, 0.15);
        this.mesh.add(leftPupil);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.12, 0.28, 0.15);
        this.mesh.add(rightPupil);

        // Legs (visual only)
        const legGeo = new THREE.BoxGeometry(0.1, 0.1, 0.2);

        // Back Legs
        const leftBackLeg = new THREE.Mesh(legGeo, mat);
        leftBackLeg.position.set(-0.2, 0.1, -0.15);
        leftBackLeg.rotation.y = 0.5;
        this.mesh.add(leftBackLeg);

        const rightBackLeg = new THREE.Mesh(legGeo, mat);
        rightBackLeg.position.set(0.2, 0.1, -0.15);
        rightBackLeg.rotation.y = -0.5;
        this.mesh.add(rightBackLeg);

        // Front Legs
        const frontLegGeo = new THREE.BoxGeometry(0.1, 0.2, 0.1);
        const leftFront = new THREE.Mesh(frontLegGeo, mat);
        leftFront.position.set(-0.15, 0.1, 0.15);
        this.mesh.add(leftFront);

        const rightFront = new THREE.Mesh(frontLegGeo, mat);
        rightFront.position.set(0.15, 0.1, 0.15);
        this.mesh.add(rightFront);

        this.legParts = [];
    }

    updatePhysics(dt) {
        if (this.state === 'walk' && this.onGround) {
            this.velocity.y = this.jumpForce;
            this.onGround = false;
        }
        super.updatePhysics(dt);
    }
}

export class Elephant extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 1.8;
        this.height = 2.2;
        this.depth = 2.5;
        this.speed = 2.5; // Slow and steady
        this.legSwingSpeed = 3; // Slow walk animation
        this.health = 20; // Very tough
        this.maxHealth = 20;

        // Trunk pickup state
        this.carriedBunny = null;
        this.trunkState = 'idle'; // idle, reaching, carrying
        this.trunkReachProgress = 0;
        this.targetBunny = null;

        // Trunk segments for animation
        this.trunkSegments = [];
        this.trunkTip = null;

        this.createBody();
    }

    createBody() {
        // Elephant: Grey
        const skinColor = 0x808080;
        const mat = new THREE.MeshLambertMaterial({ color: skinColor });
        const darkerMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const ivoryMat = new THREE.MeshLambertMaterial({ color: 0xFFFFF0 }); // Tusks
        const pinkMat = new THREE.MeshLambertMaterial({ color: 0xF0B0B0 }); // Inner ear

        // Body (large barrel shape approximated with box)
        const bodyGeo = new THREE.BoxGeometry(1.6, 1.4, 2.2);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 1.6, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(1.0, 1.0, 0.9);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 2.2, 1.4);
        this.mesh.add(head);

        // Forehead bump
        const foreheadGeo = new THREE.BoxGeometry(0.8, 0.4, 0.5);
        const forehead = new THREE.Mesh(foreheadGeo, mat);
        forehead.position.set(0, 2.6, 1.3);
        this.mesh.add(forehead);

        // Ears (Large floppy ears)
        const earGeo = new THREE.BoxGeometry(0.15, 1.0, 0.8);
        const innerEarGeo = new THREE.BoxGeometry(0.05, 0.8, 0.6);

        // Left Ear
        const leftEarPivot = new THREE.Group();
        leftEarPivot.position.set(-0.5, 2.3, 1.2);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.4, 0, 0);
        leftEarPivot.add(leftEar);

        const leftInnerEar = new THREE.Mesh(innerEarGeo, pinkMat);
        leftInnerEar.position.set(-0.35, 0, 0);
        leftEarPivot.add(leftInnerEar);

        leftEarPivot.rotation.z = 0.3; // Flop outward
        this.mesh.add(leftEarPivot);
        this.leftEarPivot = leftEarPivot;

        // Right Ear
        const rightEarPivot = new THREE.Group();
        rightEarPivot.position.set(0.5, 2.3, 1.2);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.4, 0, 0);
        rightEarPivot.add(rightEar);

        const rightInnerEar = new THREE.Mesh(innerEarGeo, pinkMat);
        rightInnerEar.position.set(0.35, 0, 0);
        rightEarPivot.add(rightInnerEar);

        rightEarPivot.rotation.z = -0.3;
        this.mesh.add(rightEarPivot);
        this.rightEarPivot = rightEarPivot;

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.15, 0.15, 0.1);
        const pupilGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);

        const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.35, 2.3, 1.85);
        this.mesh.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.35, 2.3, 1.9);
        this.mesh.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.35, 2.3, 1.85);
        this.mesh.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.35, 2.3, 1.9);
        this.mesh.add(rightPupil);

        // Trunk (Segmented for animation)
        this.trunkPivot = new THREE.Group();
        this.trunkPivot.position.set(0, 1.9, 1.85);
        this.mesh.add(this.trunkPivot);

        // Trunk segments (5 segments for flexibility)
        const trunkSegGeos = [
            new THREE.BoxGeometry(0.35, 0.35, 0.4),
            new THREE.BoxGeometry(0.3, 0.3, 0.4),
            new THREE.BoxGeometry(0.25, 0.25, 0.4),
            new THREE.BoxGeometry(0.2, 0.2, 0.4),
            new THREE.BoxGeometry(0.15, 0.15, 0.35)
        ];

        let prevSegment = this.trunkPivot;
        for (let i = 0; i < 5; i++) {
            const segmentPivot = new THREE.Group();
            const segment = new THREE.Mesh(trunkSegGeos[i], mat);

            if (i === 0) {
                segmentPivot.position.set(0, 0, 0.2);
            } else {
                segmentPivot.position.set(0, 0, 0.35);
            }

            segment.position.set(0, 0, 0.15);
            segmentPivot.add(segment);
            prevSegment.add(segmentPivot);

            this.trunkSegments.push(segmentPivot);
            prevSegment = segmentPivot;
        }

        // Trunk tip (for grabbing)
        this.trunkTip = prevSegment;

        // Tusks
        const tuskGeo = new THREE.BoxGeometry(0.1, 0.1, 0.6);

        const leftTusk = new THREE.Mesh(tuskGeo, ivoryMat);
        leftTusk.position.set(-0.3, 1.8, 2.0);
        leftTusk.rotation.x = 0.3;
        leftTusk.rotation.y = 0.2;
        this.mesh.add(leftTusk);

        const rightTusk = new THREE.Mesh(tuskGeo, ivoryMat);
        rightTusk.position.set(0.3, 1.8, 2.0);
        rightTusk.rotation.x = 0.3;
        rightTusk.rotation.y = -0.2;
        this.mesh.add(rightTusk);

        // Tail
        const tailPivot = new THREE.Group();
        tailPivot.position.set(0, 1.6, -1.1);

        const tailGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, -0.3, 0);
        tailPivot.add(tail);

        // Tail tuft
        const tuftGeo = new THREE.BoxGeometry(0.2, 0.25, 0.2);
        const tuft = new THREE.Mesh(tuftGeo, darkerMat);
        tuft.position.set(0, -0.65, 0);
        tailPivot.add(tuft);

        tailPivot.rotation.x = 0.3;
        this.mesh.add(tailPivot);
        this.tailPivot = tailPivot;

        // Legs (Thick pillar-like legs)
        const legGeo = new THREE.BoxGeometry(0.5, 1.2, 0.5);
        const footGeo = new THREE.BoxGeometry(0.55, 0.15, 0.55);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 1.2, z);

            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.6, 0);
            pivot.add(leg);

            // Foot/toenails effect
            const foot = new THREE.Mesh(footGeo, darkerMat);
            foot.position.set(0, -1.15, 0);
            pivot.add(foot);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.5, 0.8),  // Front Left
            makeLeg(0.5, 0.8),   // Front Right
            makeLeg(-0.5, -0.8), // Back Left
            makeLeg(0.5, -0.8)   // Back Right
        ];
    }

    updateAI(dt) {
        // If carrying a bunny, just wander happily
        if (this.carriedBunny) {
            // Put down the bunny after a while
            this.carryTimer = (this.carryTimer || 0) + dt;
            if (this.carryTimer > 10) { // Carry for 10 seconds
                this.releaseBunny();
                this.carryTimer = 0;
            }
            super.updateAI(dt);
            return;
        }

        // Look for bunnies to pick up
        const detectionRange = 12.0;
        const pickupRange = 2.5;
        let target = null;
        let nearestDist = detectionRange * detectionRange;

        if (this.game.animals) {
            for (const animal of this.game.animals) {
                if (animal instanceof Bunny && !animal.isDead && !animal.isCarried) {
                    const distSq = this.position.distanceToSquared(animal.position);
                    if (distSq < nearestDist) {
                        nearestDist = distSq;
                        target = animal;
                    }
                }
            }
        }

        if (target) {
            this.targetBunny = target;
            const dir = new THREE.Vector3().subVectors(target.position, this.position);
            const dist = dir.length();

            if (dist < pickupRange) {
                // Close enough to pick up!
                this.trunkState = 'reaching';
                this.state = 'idle';
                this.isMoving = false;
            } else {
                // Walk towards bunny
                this.state = 'chase';
                this.trunkState = 'idle';
                dir.normalize();
                this.moveDirection.copy(dir);
                this.rotation = Math.atan2(dir.x, dir.z);
                this.isMoving = true;
            }
        } else {
            this.targetBunny = null;
            this.trunkState = 'idle';
            super.updateAI(dt);
        }
    }

    updateAnimation(dt) {
        super.updateAnimation(dt);

        // Ear flapping
        if (this.leftEarPivot && this.rightEarPivot) {
            const earFlap = Math.sin(this.animTime * 0.5) * 0.1;
            this.leftEarPivot.rotation.z = 0.3 + earFlap;
            this.rightEarPivot.rotation.z = -0.3 - earFlap;
        }

        // Tail swishing
        if (this.tailPivot) {
            const tailSwing = Math.sin(this.animTime * 0.7) * 0.15;
            this.tailPivot.rotation.z = tailSwing;
        }

        // Trunk animation based on state
        this.updateTrunkAnimation(dt);
    }

    updateTrunkAnimation(dt) {
        const baseSwing = Math.sin(this.animTime * 0.8) * 0.1;

        if (this.trunkState === 'idle') {
            // Gentle swaying
            this.trunkPivot.rotation.x = 0.3 + baseSwing * 0.5; // Slightly down
            for (let i = 0; i < this.trunkSegments.length; i++) {
                this.trunkSegments[i].rotation.x = 0.1 + baseSwing * (i * 0.05);
            }
        } else if (this.trunkState === 'reaching') {
            // Reach forward and down towards bunny
            this.trunkReachProgress += dt * 2; // Take 0.5 seconds to reach

            if (this.trunkReachProgress >= 1) {
                // Pickup complete!
                if (this.targetBunny && !this.targetBunny.isDead && !this.targetBunny.isCarried) {
                    this.pickupBunny(this.targetBunny);
                }
                this.trunkState = 'carrying';
                this.trunkReachProgress = 0;
            } else {
                // Animate reaching down
                const t = this.trunkReachProgress;
                this.trunkPivot.rotation.x = 0.3 + t * 0.8; // Reach down
                for (let i = 0; i < this.trunkSegments.length; i++) {
                    this.trunkSegments[i].rotation.x = 0.1 + t * 0.3;
                }
            }
        } else if (this.trunkState === 'carrying') {
            // Curl trunk up with bunny
            this.trunkPivot.rotation.x = -0.3 + baseSwing * 0.2; // Curl up
            for (let i = 0; i < this.trunkSegments.length; i++) {
                this.trunkSegments[i].rotation.x = -0.4 - (i * 0.1);
            }
        }
    }

    pickupBunny(bunny) {
        if (!bunny || bunny.isDead || bunny.isCarried) return;

        this.carriedBunny = bunny;
        bunny.isCarried = true;

        // Remove bunny from scene (it will be attached to trunk)
        this.game.scene.remove(bunny.mesh);

        // Attach bunny mesh to trunk tip
        bunny.mesh.position.set(0, 0, 0.3);
        bunny.mesh.rotation.set(0, Math.PI, 0); // Face backwards
        bunny.mesh.scale.set(1, 1, 1);
        this.trunkTip.add(bunny.mesh);

        this.trunkState = 'carrying';
    }

    releaseBunny() {
        if (!this.carriedBunny) return;

        const bunny = this.carriedBunny;

        // Detach from trunk
        this.trunkTip.remove(bunny.mesh);

        // Get world position of trunk tip
        const worldPos = new THREE.Vector3();
        this.trunkTip.getWorldPosition(worldPos);

        // Place bunny back in the world
        bunny.mesh.position.set(0, 0, 0);
        bunny.mesh.rotation.set(0, 0, 0);
        bunny.position.copy(worldPos);
        bunny.position.y = this.position.y; // Put on ground level
        bunny.mesh.position.copy(bunny.position);

        bunny.isCarried = false;
        this.game.scene.add(bunny.mesh);

        this.carriedBunny = null;
        this.trunkState = 'idle';
    }

    update(dt) {
        super.update(dt);

        // Update carried bunny position (it's attached to trunk, but we prevent its normal update)
        if (this.carriedBunny) {
            // Bunny doesn't update physics while carried
            this.carriedBunny.onGround = true;
            this.carriedBunny.velocity.set(0, 0, 0);
        }
    }
}

export class Lion extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.8;
        this.height = 1.2;
        this.depth = 1.6;
        this.speed = 4.5;
        this.createBody();
    }

    createBody() {
        // Lion: Gold/Tan
        const furColor = 0xC2B280;
        const maneColor = 0x8B4513;
        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const maneMat = new THREE.MeshLambertMaterial({ color: maneColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.8, 0.8, 1.6);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.8, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.7);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 1.3, 1.0);
        this.mesh.add(head);

        // Mane (Large box around head)
        const maneGeo = new THREE.BoxGeometry(0.8, 0.8, 0.5);
        const mane = new THREE.Mesh(maneGeo, maneMat);
        mane.position.set(0, 1.3, 0.8);
        this.mesh.add(mane);

        // Snout
        const snoutGeo = new THREE.BoxGeometry(0.3, 0.25, 0.3);
        const snout = new THREE.Mesh(snoutGeo, mat);
        snout.position.set(0, 1.2, 1.4);
        this.mesh.add(snout);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const nose = new THREE.Mesh(noseGeo, blackMat);
        nose.position.set(0, 1.3, 1.55);
        this.mesh.add(nose);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.15, 1.4, 1.35);
        this.mesh.add(leftEye);
        const leftPupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.06), blackMat);
        leftPupil.position.set(-0.15, 1.4, 1.38);
        this.mesh.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.15, 1.4, 1.35);
        this.mesh.add(rightEye);
        const rightPupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.06), blackMat);
        rightPupil.position.set(0.15, 1.4, 1.38);
        this.mesh.add(rightPupil);

        // Ear bumps (hidden in mane mostly but visible on top)
        const earGeo = new THREE.BoxGeometry(0.15, 0.15, 0.1);
        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.25, 1.6, 1.0);
        this.mesh.add(leftEar);
        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.25, 1.6, 1.0);
        this.mesh.add(rightEar);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.1, 0.1, 1.0);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 1.0, -0.9);
        tail.rotation.x = -0.5;
        this.mesh.add(tail);

        const tuftGeo = new THREE.BoxGeometry(0.15, 0.15, 0.2);
        const tuft = new THREE.Mesh(tuftGeo, maneMat);
        tuft.position.set(0, 1.4, -1.3);
        this.mesh.add(tuft);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.8, z);
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.4, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.3, 0.6),
            makeLeg(0.3, 0.6),
            makeLeg(-0.3, -0.6),
            makeLeg(0.3, -0.6)
        ];
    }
}

export class Bear extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 1.0;
        this.height = 1.4;
        this.depth = 1.8;
        this.speed = 3.0;
        this.createBody();
    }

    createBody() {
        // Bear: Dark Brown
        const furColor = 0x4B3621;
        const muzzleColor = 0x8B7355; // Lighter brown
        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const muzzleMat = new THREE.MeshLambertMaterial({ color: muzzleColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body (Big and bulky)
        const bodyGeo = new THREE.BoxGeometry(1.2, 1.1, 1.8);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 1.1, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.9, 0.8, 0.9);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 1.5, 1.2);
        this.mesh.add(head);

        // Muzzle
        const snoutGeo = new THREE.BoxGeometry(0.4, 0.3, 0.3);
        const snout = new THREE.Mesh(snoutGeo, muzzleMat);
        snout.position.set(0, 1.4, 1.7);
        this.mesh.add(snout);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.15, 0.1, 0.05);
        const nose = new THREE.Mesh(noseGeo, blackMat);
        nose.position.set(0, 1.5, 1.85);
        this.mesh.add(nose);

        // Ears (Rounded)
        const earGeo = new THREE.BoxGeometry(0.2, 0.2, 0.1);
        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.4, 1.9, 1.1);
        this.mesh.add(leftEar);
        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.4, 1.9, 1.1);
        this.mesh.add(rightEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.25, 1.6, 1.65);
        this.mesh.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.25, 1.6, 1.65);
        this.mesh.add(rightEye);

        // Stubby Tail
        const tailGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 1.2, -0.9);
        this.mesh.add(tail);

        // Thick Legs
        const legGeo = new THREE.BoxGeometry(0.4, 0.9, 0.4);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 1.0, z);
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.45, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.4, 0.7),
            makeLeg(0.4, 0.7),
            makeLeg(-0.4, -0.7),
            makeLeg(0.4, -0.7)
        ];
    }
}

export class Tiger extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.8;
        this.height = 1.1;
        this.depth = 1.6;
        this.speed = 4.5;
        this.createBody();
    }

    createBody() {
        // Tiger: Orange with Stripes
        const furColor = 0xFF8C00; // Dark Orange
        const stripeColor = 0x111111; // Dark Gray/Black
        const whiteColor = 0xFFFFFF; // Belly/Jaw

        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const stripeMat = new THREE.MeshLambertMaterial({ color: stripeColor });
        const whiteMat = new THREE.MeshLambertMaterial({ color: whiteColor });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.8, 0.8, 1.6);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.8, 0);
        this.mesh.add(body);

        // Stripes on body (Simulated with thin rings/boxes)
        const makeStripe = (z) => {
            const stripeGeo = new THREE.BoxGeometry(0.82, 0.82, 0.1);
            const stripe = new THREE.Mesh(stripeGeo, stripeMat);
            stripe.position.set(0, 0.8, z);
            this.mesh.add(stripe);
        };
        makeStripe(-0.5);
        makeStripe(0);
        makeStripe(0.5);

        // Head
        const headGeo = new THREE.BoxGeometry(0.7, 0.6, 0.7);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 1.3, 1.0);
        this.mesh.add(head);

        // Muzzle (White)
        const muzzleGeo = new THREE.BoxGeometry(0.35, 0.2, 0.2);
        const muzzle = new THREE.Mesh(muzzleGeo, whiteMat);
        muzzle.position.set(0, 1.15, 1.4);
        this.mesh.add(muzzle);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.1, 0.08, 0.05);
        const nose = new THREE.Mesh(noseGeo, stripeMat);
        nose.position.set(0, 1.25, 1.5);
        this.mesh.add(nose);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.15, 0.15, 0.05);
        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.25, 1.65, 0.9);
        this.mesh.add(leftEar);
        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.25, 1.65, 0.9);
        this.mesh.add(rightEar);

        // Eyes
        // Use small boxes
        const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), whiteMat);
        leftEye.position.set(-0.2, 1.4, 1.35);
        this.mesh.add(leftEye);
        const leftPupil = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.06), stripeMat);
        leftPupil.position.set(-0.2, 1.4, 1.37);
        this.mesh.add(leftPupil);

        const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), whiteMat);
        rightEye.position.set(0.2, 1.4, 1.35);
        this.mesh.add(rightEye);
        const rightPupil = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.06), stripeMat);
        rightPupil.position.set(0.2, 1.4, 1.37);
        this.mesh.add(rightPupil);

        // Tail (Striped)
        const tailGeo = new THREE.BoxGeometry(0.1, 0.1, 1.2);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 0.9, -1.0);
        tail.rotation.x = -0.3;
        this.mesh.add(tail);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.8, z);
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.4, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.3, 0.6),
            makeLeg(0.3, 0.6),
            makeLeg(-0.3, -0.6),
            makeLeg(0.3, -0.6)
        ];
    }
}

export class Deer extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.7;
        this.height = 1.3;
        this.depth = 1.0;
        this.speed = 3.5;
        this.createBody();
        this.mesh.scale.set(0.8, 0.8, 0.8);
    }

    createBody() {
        // Deer: Brown with lighter details
        const bodyColor = 0x8B4513; // SaddleBrown
        const mat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const lightMat = new THREE.MeshLambertMaterial({ color: 0xD2B48C }); // Tan for belly/details
        const darkMat = new THREE.MeshLambertMaterial({ color: 0x3E2723 }); // Dark for hooves/eyes
        const antlerMat = new THREE.MeshLambertMaterial({ color: 0xF5DEB3 }); // Wheat/Bone color

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.7, 0.6, 1.0);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 1.0, 0);
        this.mesh.add(body);

        // Chest/Neck base (slightly thicker)
        const chestGeo = new THREE.BoxGeometry(0.72, 0.65, 0.5);
        const chest = new THREE.Mesh(chestGeo, mat);
        chest.position.set(0, 1.02, 0.3);
        this.mesh.add(chest);

        // Neck
        const neckGeo = new THREE.BoxGeometry(0.35, 0.7, 0.35);
        const neck = new THREE.Mesh(neckGeo, mat);
        neck.position.set(0, 1.45, 0.6);
        neck.rotation.x = Math.PI / 8; // Angled forward
        this.mesh.add(neck);

        // Head
        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.7);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 1.85, 0.85);
        this.mesh.add(head);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.25, 0.15, 0.05);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.3, 2.0, 0.7);
        leftEar.rotation.z = 0.3;
        leftEar.rotation.y = -0.3;
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.3, 2.0, 0.7);
        rightEar.rotation.z = -0.3;
        rightEar.rotation.y = 0.3;
        this.mesh.add(rightEar);

        // Antlers (Simple Branching)
        const antlerStemGeo = new THREE.BoxGeometry(0.06, 0.5, 0.06);
        const antlerBranchGeo = new THREE.BoxGeometry(0.05, 0.3, 0.05);

        const makeAntler = (xDir) => {
            const group = new THREE.Group();
            group.position.set(xDir * 0.15, 2.05, 0.8);

            // Main stem
            const stem = new THREE.Mesh(antlerStemGeo, antlerMat);
            stem.rotation.z = xDir * 0.4;
            stem.rotation.x = -0.2;
            group.add(stem);

            // Branch 1 (Forward)
            const b1 = new THREE.Mesh(antlerBranchGeo, antlerMat);
            b1.position.set(xDir * 0.1, 0.2, 0.1);
            b1.rotation.x = Math.PI / 4;
            group.add(b1);

            // Branch 2 (Upish)
            const b2 = new THREE.Mesh(antlerBranchGeo, antlerMat);
            b2.position.set(xDir * 0.2, 0.3, 0);
            b2.rotation.z = xDir * 0.6;
            group.add(b2);

            this.mesh.add(group);
        };

        makeAntler(1);
        makeAntler(-1);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);

        const leftEye = new THREE.Mesh(eyeGeo, darkMat);
        leftEye.position.set(-0.21, 1.9, 0.9);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, darkMat);
        rightEye.position.set(0.21, 1.9, 0.9);
        this.mesh.add(rightEye);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.15, 0.1, 0.05);
        const nose = new THREE.Mesh(noseGeo, darkMat);
        nose.position.set(0, 1.75, 1.21);
        this.mesh.add(nose);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.15, 0.2, 0.1);
        const tail = new THREE.Mesh(tailGeo, lightMat); // White tail
        tail.position.set(0, 1.1, -0.5);
        tail.rotation.x = 0.5;
        this.mesh.add(tail);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.2, 0.9, 0.2);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.9, z);

            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.45, 0);
            pivot.add(leg);

            // Hoof
            const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2), darkMat);
            hoof.position.set(0, -0.9, 0);
            pivot.add(hoof);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.2, 0.35),
            makeLeg(0.2, 0.35),
            makeLeg(-0.2, -0.35),
            makeLeg(0.2, -0.35)
        ];
    }
}

export class Giraffe extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 1.0;
        this.height = 4.5; // Very tall
        this.depth = 1.2;
        this.speed = 3.0; // Graceful stride
        this.legSwingSpeed = 3; // Slower leg swing due to size
        this.createBody();
        this.mesh.scale.set(0.9, 0.9, 0.9);
    }

    createBody() {
        // Giraffe: Yellow with Brown Spots
        const skinColor = 0xF4C430; // Saffron/Yellow
        const spotColor = 0x8B4513; // Brown
        const hoofColor = 0x2F2F2F;

        const mat = new THREE.MeshLambertMaterial({ color: skinColor });
        const spotMat = new THREE.MeshLambertMaterial({ color: spotColor });
        const hoofMat = new THREE.MeshLambertMaterial({ color: hoofColor });
        const darkMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

        // Helper to add random spots to a mesh
        const addSpots = (parentMesh, width, height, depth, count) => {
            for (let i = 0; i < count; i++) {
                const sW = width * (0.2 + Math.random() * 0.2);
                const sH = height * (0.2 + Math.random() * 0.2);
                const sD = 0.02; // Thin layer

                const spotGeo = new THREE.BoxGeometry(sW, sH, sD);
                const spot = new THREE.Mesh(spotGeo, spotMat);

                // Pick a random face... simplified: just stick on outside
                const face = Math.floor(Math.random() * 4); // 0=front, 1=back, 2=left, 3=right

                let sx = 0, sy = 0, sz = 0;
                let rx = 0, ry = 0, rz = 0;

                if (face === 0) { // Front
                    sx = (Math.random() - 0.5) * width;
                    sy = (Math.random() - 0.5) * height;
                    sz = depth / 2 + 0.01;
                } else if (face === 1) { // Back
                    sx = (Math.random() - 0.5) * width;
                    sy = (Math.random() - 0.5) * height;
                    sz = -depth / 2 - 0.01;
                } else if (face === 2) { // Left
                    sx = -width / 2 - 0.01;
                    sy = (Math.random() - 0.5) * height;
                    sz = (Math.random() - 0.5) * depth;
                    ry = Math.PI / 2;
                } else { // Right
                    sx = width / 2 + 0.01;
                    sy = (Math.random() - 0.5) * height;
                    sz = (Math.random() - 0.5) * depth;
                    ry = Math.PI / 2;
                }

                spot.position.set(sx, sy, sz);
                spot.rotation.y = ry;
                parentMesh.add(spot);
            }
        };

        // Body: Sloped back
        const bodyGeo = new THREE.BoxGeometry(1.0, 1.1, 1.4);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 2.2, 0); // High up legs
        body.rotation.x = -0.1; // Slope up towards neck
        addSpots(body, 1.0, 1.1, 1.4, 8);
        this.mesh.add(body);

        // Neck (Very Long)
        const neckLen = 2.5;
        const neckGeo = new THREE.BoxGeometry(0.5, neckLen, 0.5);
        const neck = new THREE.Mesh(neckGeo, mat);
        neck.position.set(0, 3.5, 0.8);
        neck.rotation.x = 0.2;
        addSpots(neck, 0.5, neckLen, 0.5, 6);
        this.mesh.add(neck);

        // Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.6, 0.9);
        const head = new THREE.Mesh(headGeo, mat);
        // Neck top position approx:
        // y: 3.5 + (neckLen/2 * cos(0.2)) = 3.5 + 1.25*0.98 = 4.7
        // z: 0.8 + (neckLen/2 * sin(0.2)) = 0.8 + 1.25*0.2 = 1.05
        head.position.set(0, 4.8, 1.2);
        this.mesh.add(head);

        // Ossicones (Horn-like bumps)
        const ossiGeo = new THREE.BoxGeometry(0.1, 0.25, 0.1);
        const ossi1 = new THREE.Mesh(ossiGeo, spotMat); // Brown top
        ossi1.position.set(-0.15, 5.2, 1.1);
        this.mesh.add(ossi1);

        const ossi2 = new THREE.Mesh(ossiGeo, spotMat);
        ossi2.position.set(0.15, 5.2, 1.1);
        this.mesh.add(ossi2);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, darkMat);
        leftEye.position.set(-0.26, 4.9, 1.3);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, darkMat);
        rightEye.position.set(0.26, 4.9, 1.3);
        this.mesh.add(rightEye);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.1, 0.8, 0.1);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 2.0, -0.7);
        tail.rotation.z = 0.1;
        this.mesh.add(tail);

        const tailTip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), spotMat);
        tailTip.position.set(0, -0.4, 0);
        tail.add(tailTip);

        // Legs (Long!)
        const legLen = 2.0;
        const legGeo = new THREE.BoxGeometry(0.3, legLen, 0.3);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 1.8, z); // Hip

            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -legLen / 2, 0);
            addSpots(leg, 0.3, legLen, 0.3, 2);
            pivot.add(leg);

            const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.32), hoofMat);
            hoof.position.set(0, -legLen - 0.1, 0);
            pivot.add(hoof);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.35, 0.4),
            makeLeg(0.35, 0.4),
            makeLeg(-0.35, -0.4),
            makeLeg(0.35, -0.4)
        ];
    }
}

export class Fish extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.4;
        this.height = 0.3;
        this.depth = 0.6;
        this.gravity = 0;
        this.createBody();
        this.mesh.scale.set(0.6, 0.6, 0.6);
        this.state = 'walk'; // Using walk state for swimming
    }

    createBody() {
        const bodyColor = 0xFFA500; // Orange
        const finColor = 0xFFFFFF; // White

        const mat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const finMat = new THREE.MeshLambertMaterial({ color: finColor });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.2, 0.4, 0.6);
        const body = new THREE.Mesh(bodyGeo, mat);
        this.mesh.add(body);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.05, 0.3, 0.3);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 0, -0.4);
        tail.rotation.y = 0.2;
        this.mesh.add(tail);

        // Fins
        const finGeo = new THREE.BoxGeometry(0.3, 0.1, 0.2);
        const leftFin = new THREE.Mesh(finGeo, finMat);
        leftFin.position.set(-0.2, 0, 0.1);
        this.mesh.add(leftFin);

        const rightFin = new THREE.Mesh(finGeo, finMat);
        rightFin.position.set(0.2, 0, 0.1);
        this.mesh.add(rightFin);

        this.tail = tail;
    }

    updatePhysics(dt) {
        // Check for water
        const pos = this.position;
        const block = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
        const inWater = block && block.type === 'water';

        if (inWater) {
            // 3D Swimming
            this.velocity.y *= 0.9;
            this.velocity.x *= 0.9;
            this.velocity.z *= 0.9;

            if (this.state === 'walk') {
                const speed = 2.0;
                this.velocity.x += this.moveDirection.x * speed * dt;
                this.velocity.y += this.moveDirection.y * speed * dt;
                this.velocity.z += this.moveDirection.z * speed * dt;
            }

            this.position.add(this.velocity.clone().multiplyScalar(dt));

            if (this.checkBodyCollision(this.position.x, this.position.y, this.position.z)) {
                this.position.sub(this.velocity.clone().multiplyScalar(dt));
                this.rotation = Math.random() * Math.PI * 2;
                this.moveDirection.set(Math.sin(this.rotation), (Math.random() - 0.5), Math.cos(this.rotation));
            }

            this.onGround = false;
        } else {
            // Flop logic
            this.velocity.y -= 30.0 * dt;
            super.updateWalkerPhysics(dt);

            if (this.onGround && Math.random() < 0.05) {
                this.velocity.y = 5;
                this.velocity.x = (Math.random() - 0.5) * 5;
                this.velocity.z = (Math.random() - 0.5) * 5;
            }
        }
    }

    updateAI(dt) {
        super.updateAI(dt);
        if (Math.abs(this.moveDirection.y) < 0.01 && this.state === 'walk') {
            this.moveDirection.y = (Math.random() - 0.5) * 0.5;
        }
    }

    updateAnimation(dt) {
        if (this.tail) {
            // Basic tail wag
            this.tail.rotation.y = Math.sin(performance.now() * 0.01) * 0.4;
        }
    }
}

export class Turtle extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.8;
        this.height = 0.5;
        this.depth = 0.8;
        this.speed = 1.0;
        this.createBody();
    }

    createBody() {
        const shellColor = 0x228B22;
        const skinColor = 0x90EE90;

        const shellMat = new THREE.MeshLambertMaterial({ color: shellColor });
        const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });

        // Shell
        const shellGeo = new THREE.BoxGeometry(0.7, 0.4, 0.8);
        const shell = new THREE.Mesh(shellGeo, shellMat);
        shell.position.set(0, 0.4, 0);
        this.mesh.add(shell);

        // Head
        const headGeo = new THREE.BoxGeometry(0.25, 0.25, 0.3);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 0.5, 0.5);
        this.mesh.add(head);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.15, 0.2, 0.15);
        const makeLeg = (x, z) => {
            const l = new THREE.Mesh(legGeo, skinMat);
            l.position.set(x, 0.2, z);
            this.mesh.add(l);
            return l;
        };

        this.legParts = [
            makeLeg(-0.3, 0.35),
            makeLeg(0.3, 0.35),
            makeLeg(-0.3, -0.35),
            makeLeg(0.3, -0.35)
        ];
    }

    updatePhysics(dt) {
        const pos = this.position;
        const block = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));

        if (block && block.type === 'water') {
            this.velocity.y -= 5.0 * dt;
            if (this.velocity.y < -2) this.velocity.y = -2;

            if (this.state === 'walk') {
                this.position.x += this.moveDirection.x * this.speed * dt;
                this.position.z += this.moveDirection.z * this.speed * dt;
            }

            this.position.y += this.velocity.y * dt;

            if (this.checkBodyCollision(this.position.x, this.position.y, this.position.z)) {
                const y = Math.floor(this.position.y);
                if (this.game.getBlock(Math.floor(this.position.x), y, Math.floor(this.position.z))) {
                    this.position.y = y + 1;
                }
            }
        } else {
            super.updateWalkerPhysics(dt);
        }
    }
}

export class Duck extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.5;
        this.height = 0.6;
        this.depth = 0.6;
        this.speed = 2.5;
        this.createBody();
    }

    createBody() {
        // Mallard
        const bodyColor = 0x8B4513;
        const headColor = 0x006400;
        const beakColor = 0xFFD700;

        const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const headMat = new THREE.MeshLambertMaterial({ color: headColor });
        const beakMat = new THREE.MeshLambertMaterial({ color: beakColor });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.4, 0.3, 0.6);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0.3, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.2, 0.25, 0.2);
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(0, 0.6, 0.25);
        this.mesh.add(head);

        // Beak
        const beakGeo = new THREE.BoxGeometry(0.1, 0.05, 0.15);
        const beak = new THREE.Mesh(beakGeo, beakMat);
        beak.position.set(0, 0.58, 0.4);
        this.mesh.add(beak);

        // Wings
        const wingGeo = new THREE.BoxGeometry(0.1, 0.2, 0.4);
        const leftWing = new THREE.Mesh(wingGeo, bodyMat);
        leftWing.position.set(-0.22, 0.35, 0);
        this.mesh.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeo, bodyMat);
        rightWing.position.set(0.22, 0.35, 0);
        this.mesh.add(rightWing);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.05, 0.2, 0.05);
        const lLeg = new THREE.Mesh(legGeo, beakMat);
        lLeg.position.set(-0.1, 0.1, 0);
        this.mesh.add(lLeg);

        const rLeg = new THREE.Mesh(legGeo, beakMat);
        rLeg.position.set(0.1, 0.1, 0);
        this.mesh.add(rLeg);

        this.legParts = [lLeg, rLeg];
    }

    updatePhysics(dt) {
        const pos = this.position;
        // Check for water
        const block = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
        const blockBelow = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y - 0.5), Math.floor(pos.z));

        const inWater = (block && block.type === 'water');
        const onWater = (blockBelow && blockBelow.type === 'water');

        if (inWater || onWater) {
            const targetY = Math.floor(pos.y) + 0.8;

            if (inWater) {
                this.velocity.y += 15.0 * dt; // Buoyancy
            } else {
                if (pos.y > targetY) {
                    this.velocity.y -= 10.0 * dt;
                } else {
                    this.velocity.y += 5.0 * dt;
                }
            }

            this.velocity.y *= 0.8;

            if (this.state === 'walk') {
                this.position.x += this.moveDirection.x * this.speed * dt;
                this.position.z += this.moveDirection.z * this.speed * dt;
            }
            this.position.y += this.velocity.y * dt;

            // Simple collision to prevent going through walls while swimming
            if (this.checkSolid(pos.x, pos.y + 0.5, pos.z)) {
                this.velocity.x *= -1;
                this.velocity.z *= -1;
                this.moveDirection.x *= -1;
                this.moveDirection.z *= -1;
            }

        } else {
            super.updateWalkerPhysics(dt);
        }
    }
}

export class Squirrel extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.4;
        this.height = 0.4;
        this.depth = 0.6;
        this.speed = 5.0; // Fast
        this.createBody();
        this.mesh.scale.set(0.6, 0.6, 0.6);
        this.climbing = false;
    }

    createBody() {
        // Squirrel: Brown/Grey
        const furColor = 0x8B4513;
        const tailColor = 0xA0522D;
        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const tailMat = new THREE.MeshLambertMaterial({ color: tailColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.4, 0.4, 0.5);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.2, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.35, 0.35);
        this.mesh.add(head);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.2, 0.2, 0.6);
        const tail = new THREE.Mesh(tailGeo, tailMat);
        tail.position.set(0, 0.4, -0.4);
        tail.rotation.x = Math.PI / 3.0; // Angled up
        this.mesh.add(tail);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(0.1, 0.4, 0.5);
        this.mesh.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(-0.1, 0.4, 0.5);
        this.mesh.add(rightEye);
    }

    updatePhysics(dt) {
        // Custom climbing logic
        const pos = this.position;
        const forwardX = pos.x + this.moveDirection.x * 0.5;
        const forwardZ = pos.z + this.moveDirection.z * 0.5;

        // Check block in front
        const blockInFront = this.game.getBlock(Math.floor(forwardX), Math.floor(pos.y), Math.floor(forwardZ));

        // Climb if hitting wood
        if (blockInFront && blockInFront.type.includes('wood')) {
            this.climbing = true;
            this.velocity.y = 4.0; // Climb up
            this.onGround = false;

            // Move slightly towards the tree to stick
            this.position.x += this.moveDirection.x * dt;
            this.position.z += this.moveDirection.z * dt;

            // Move up
            this.position.y += this.velocity.y * dt;
            return;
        }

        this.climbing = false;
        super.updateWalkerPhysics(dt);
    }
}

export class Monkey extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.6;
        this.height = 0.8;
        this.depth = 0.6;
        this.speed = 3.5;
        this.createBody();
        this.mesh.scale.set(0.8, 0.8, 0.8);

        // Tree jumping logic
        this.targetTree = null;
        this.isJumping = false;
        this.jumpCooldown = 0;
        this.scanTimer = 0;
    }

    createBody() {
        const furColor = 0x5C4033; // Dark brown
        const faceColor = 0xD2B48C; // Tan
        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const faceMat = new THREE.MeshLambertMaterial({ color: faceColor });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.6, 0.4);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.5, 0);
        this.mesh.add(body);

        // Head
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 0.9, 0);
        this.mesh.add(headGroup);

        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const head = new THREE.Mesh(headGeo, mat);
        headGroup.add(head);

        const faceGeo = new THREE.BoxGeometry(0.3, 0.25, 0.1);
        const face = new THREE.Mesh(faceGeo, faceMat);
        face.position.set(0, -0.05, 0.21);
        headGroup.add(face);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(0.25, 0, 0);
        headGroup.add(leftEar);
        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(-0.25, 0, 0);
        headGroup.add(rightEar);

        // Tail (Long)
        const tailGeo = new THREE.BoxGeometry(0.1, 0.1, 0.8);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 0.4, -0.4);
        tail.rotation.x = -Math.PI / 4;
        this.mesh.add(tail);

        // Arms/Legs
        const limbGeo = new THREE.BoxGeometry(0.12, 0.5, 0.12);

        const makeLimb = (x, y, z) => {
            const limb = new THREE.Mesh(limbGeo, mat);
            limb.position.set(x, y, z);
            return limb;
        };

        this.legParts = [
            makeLimb(-0.2, 0.2, 0),
            makeLimb(0.2, 0.2, 0)
        ];

        const leftArm = makeLimb(-0.3, 0.6, 0);
        const rightArm = makeLimb(0.3, 0.6, 0);

        this.mesh.add(this.legParts[0]);
        this.mesh.add(this.legParts[1]);
        this.mesh.add(leftArm);
        this.mesh.add(rightArm);

        // Add arms to legParts for animation so they swing too
        this.legParts.push(leftArm);
        this.legParts.push(rightArm);
    }

    updateAI(dt) {
        if (this.jumpCooldown > 0) this.jumpCooldown -= dt;

        if (this.isJumping) {
            // Check if landed
            if (this.onGround || this.velocity.y === 0) {
                this.isJumping = false;
                this.jumpCooldown = 2.0;
                this.state = 'idle';
            }
            return; // Don't wander while jumping
        }

        // Tree detection scan
        this.scanTimer -= dt;
        if (this.scanTimer <= 0 && this.jumpCooldown <= 0) {
            this.scanTimer = 1.0;
            this.checkForTrees();
        }

        super.updateAI(dt);
    }

    checkForTrees() {
        // Only jump if we are high up (in a tree) or on ground near a tree
        // 1. Check if we are currently on/near leaves or wood
        const pos = this.position;
        const currentBlock = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y - 1), Math.floor(pos.z));

        const isSecure = currentBlock && (currentBlock.type.includes('leaves') || currentBlock.type.includes('wood'));

        if (isSecure || Math.random() < 0.1) {
            // We are stable, maybe look for another tree to jump to
            // Scan random nearby blocks
            const range = 8;
            for (let i = 0; i < 5; i++) {
                const tx = pos.x + (Math.random() - 0.5) * range * 2;
                const tz = pos.z + (Math.random() - 0.5) * range * 2;
                // Look for trees higher up or same level
                const ty = pos.y + (Math.random() * 4) - 1;

                const targetBlock = this.game.getBlock(Math.floor(tx), Math.floor(ty), Math.floor(tz));
                if (targetBlock && (targetBlock.type.includes('leaves') || targetBlock.type.includes('wood'))) {
                    // Found a potential tree target
                    this.performJump(new THREE.Vector3(tx, ty + 1.5, tz));
                    return;
                }
            }
        }
    }

    performJump(targetPos) {
        this.isJumping = true;
        this.state = 'jump';
        this.rotation = Math.atan2(targetPos.x - this.position.x, targetPos.z - this.position.z);

        // Calculate physics arc
        // dist
        const dist = this.position.distanceTo(targetPos);
        const time = dist / 10.0; // Speed 10

        // velocity = (dist / time)
        const vel = targetPos.clone().sub(this.position).divideScalar(time);

        // Add gravity compensation: dy = vy * t - 0.5 * g * t^2
        // We want strict arrival, but basic arc is fine.
        // Approx extra Y velocity needed to counter gravity half-time?
        // Let's just give a good hop.
        vel.y = 8.0 + (targetPos.y - this.position.y);

        // Clamp
        if (vel.y > 15) vel.y = 15;

        this.velocity.copy(vel);
        this.moveDirection.copy(vel).normalize();
        this.onGround = false;
    }
}
