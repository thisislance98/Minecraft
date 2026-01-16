import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Monkey extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.6;
        this.height = 0.8;
        this.depth = 0.6;
        this.speed = 4.0;
        this.createBody();
        this.mesh.scale.set(0.8, 0.8, 0.8);

        // Tree behavior states
        this.isClimbing = false;
        this.climbDirection = 1; // 1 = up, -1 = down
        this.climbSpeed = 3.5;

        // Tree jumping logic
        this.targetTree = null;
        this.isJumping = false;
        this.jumpCooldown = 0;
        this.scanTimer = 0;

        // Tree dwelling preference
        this.inTree = false;
        this.seekingTree = false;
        this.treeTarget = null;
        this.climbTimer = 0;
        this.preferredHeight = 8 + Math.random() * 6; // Monkeys prefer heights between 8-14 blocks
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

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.02);
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(0.08, 0.05, 0.06);
        face.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(-0.08, 0.05, 0.06);
        face.add(rightEye);

        // Mouth
        const mouthGeo = new THREE.BoxGeometry(0.1, 0.02, 0.02);
        const mouth = new THREE.Mesh(mouthGeo, eyeMat);
        mouth.position.set(0, -0.05, 0.06);
        face.add(mouth);

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

    // Check if a block is part of a tree
    isTreeBlock(block) {
        if (!block) return false;
        return block.type.includes('leaves') || block.type.includes('wood') || block.type.includes('log');
    }

    // Check if standing on tree blocks
    isInTree() {
        const pos = this.position;
        const blockBelow = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y - 0.5), Math.floor(pos.z));
        const blockAt = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
        return this.isTreeBlock(blockBelow) || this.isTreeBlock(blockAt);
    }

    // Find the nearest tree trunk
    findNearestTree() {
        const pos = this.position;
        const searchRadius = 15;
        let nearestDist = Infinity;
        let nearestTree = null;

        for (let dx = -searchRadius; dx <= searchRadius; dx += 2) {
            for (let dz = -searchRadius; dz <= searchRadius; dz += 2) {
                // Search upward for tree trunks
                for (let dy = 0; dy < 20; dy++) {
                    const block = this.game.getBlock(
                        Math.floor(pos.x + dx),
                        Math.floor(pos.y + dy),
                        Math.floor(pos.z + dz)
                    );
                    if (block && (block.type.includes('wood') || block.type.includes('log'))) {
                        const dist = Math.sqrt(dx * dx + dz * dz);
                        if (dist < nearestDist && dist > 1) {
                            nearestDist = dist;
                            nearestTree = new THREE.Vector3(
                                Math.floor(pos.x + dx) + 0.5,
                                Math.floor(pos.y + dy),
                                Math.floor(pos.z + dz) + 0.5
                            );
                        }
                        break;
                    }
                }
            }
        }
        return nearestTree;
    }

    // Find tree height at current position
    getTreeTopHeight() {
        const pos = this.position;
        const checkX = Math.floor(pos.x);
        const checkZ = Math.floor(pos.z);

        for (let y = Math.floor(pos.y); y < pos.y + 30; y++) {
            const block = this.game.getBlock(checkX, y, checkZ);
            if (!block || (!block.type.includes('wood') && !block.type.includes('log') && !block.type.includes('leaves'))) {
                return y - 1;
            }
        }
        return Math.floor(pos.y) + 10;
    }

    updateAI(dt) {
        if (this.jumpCooldown > 0) this.jumpCooldown -= dt;
        if (this.climbTimer > 0) this.climbTimer -= dt;

        // Update tree status
        this.inTree = this.isInTree();

        // Handle jumping state
        if (this.isJumping) {
            if (this.onGround || this.velocity.y === 0) {
                this.isJumping = false;
                this.jumpCooldown = 1.5;
                this.state = 'idle';
                // After landing, check if we're near a tree and should climb
                if (!this.inTree) {
                    this.seekingTree = true;
                }
            }
            return;
        }

        // Handle climbing state
        if (this.isClimbing) {
            this.isMoving = true;
            return; // Physics handles climbing movement
        }

        // If on ground and not in tree, seek a tree to climb
        if (this.onGround && !this.inTree && !this.seekingTree) {
            this.seekingTree = true;
            this.treeTarget = this.findNearestTree();
        }

        // If seeking tree, move towards it
        if (this.seekingTree && this.treeTarget) {
            const dist = this.position.distanceTo(this.treeTarget);
            if (dist < 1.5) {
                // At tree base, start climbing
                this.seekingTree = false;
                this.treeTarget = null;
            } else {
                // Move towards tree
                const dir = this.treeTarget.clone().sub(this.position);
                dir.y = 0;
                dir.normalize();
                this.moveDirection.copy(dir);
                this.rotation = Math.atan2(dir.x, dir.z);
                this.state = 'walk';
                this.isMoving = true;
                return;
            }
        }

        // If in tree, do tree behaviors
        if (this.inTree) {
            this.seekingTree = false;

            // Tree scanning for jumps
            this.scanTimer -= dt;
            if (this.scanTimer <= 0 && this.jumpCooldown <= 0) {
                this.scanTimer = 0.8 + Math.random() * 0.5;
                this.checkForTrees();
            }

            // Random climbing up/down
            if (!this.isJumping && Math.random() < 0.02 * dt && this.climbTimer <= 0) {
                // Randomly decide to climb up or down
                if (this.position.y < this.preferredHeight) {
                    this.climbDirection = 1; // Climb up
                } else if (this.position.y > this.preferredHeight + 5) {
                    this.climbDirection = -1; // Climb down
                } else {
                    this.climbDirection = Math.random() > 0.5 ? 1 : -1;
                }
                this.climbTimer = 1 + Math.random() * 2;
            }
        }

        super.updateAI(dt);
    }

    checkForTrees() {
        const pos = this.position;
        const currentBlock = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y - 1), Math.floor(pos.z));
        const isSecure = this.isTreeBlock(currentBlock);

        // More likely to jump if securely in a tree
        if (isSecure || Math.random() < 0.15) {
            // Scan for another tree to jump to
            const range = 10;
            const attempts = 8;

            for (let i = 0; i < attempts; i++) {
                const tx = pos.x + (Math.random() - 0.5) * range * 2;
                const tz = pos.z + (Math.random() - 0.5) * range * 2;
                // Prefer similar or higher heights
                const ty = pos.y + (Math.random() * 5) - 2;

                const targetBlock = this.game.getBlock(Math.floor(tx), Math.floor(ty), Math.floor(tz));
                if (this.isTreeBlock(targetBlock)) {
                    // Check if there's space to land
                    const aboveBlock = this.game.getBlock(Math.floor(tx), Math.floor(ty) + 1, Math.floor(tz));
                    if (!aboveBlock) {
                        this.performJump(new THREE.Vector3(tx, ty + 1.2, tz));
                        return;
                    }
                }
            }
        }
    }

    performJump(targetPos) {
        this.isJumping = true;
        this.isClimbing = false;
        this.state = 'jump';
        this.rotation = Math.atan2(targetPos.x - this.position.x, targetPos.z - this.position.z);

        const dist = this.position.distanceTo(targetPos);
        const time = Math.max(dist / 12.0, 0.3); // Fast jumps

        const vel = targetPos.clone().sub(this.position).divideScalar(time);

        // Strong vertical component for acrobatic jumps
        vel.y = 10.0 + Math.max(0, targetPos.y - this.position.y) * 0.5;

        // Clamp max velocity
        if (vel.y > 18) vel.y = 18;
        if (vel.length() > 25) vel.normalize().multiplyScalar(25);

        this.velocity.copy(vel);
        this.moveDirection.copy(vel).normalize();
        this.onGround = false;
    }

    updatePhysics(dt) {
        const pos = this.position;

        // Jumping physics (arc through air)
        if (this.isJumping) {
            this.velocity.y -= this.gravity * dt;
            this.velocity.y = Math.max(this.velocity.y, -40);

            pos.x += this.velocity.x * dt;
            pos.y += this.velocity.y * dt;
            pos.z += this.velocity.z * dt;

            // Check for landing on tree blocks first, then ground
            const landingY = this.findTreeLandingY();
            if (landingY !== null && pos.y <= landingY) {
                pos.y = landingY;
                this.velocity.y = 0;
                this.onGround = true;
                this.inTree = true;
            } else {
                const groundY = this.findGroundY();
                if (pos.y <= groundY) {
                    pos.y = groundY;
                    this.velocity.y = 0;
                    this.onGround = true;
                }
            }
            return;
        }

        // If falling (not jumping intentionally), try to grab onto nearby tree blocks
        if (!this.onGround && !this.isClimbing && this.velocity.y < -1) {
            const treeBlock = this.findNearbyTreeBlock();
            if (treeBlock) {
                // Grab onto the tree
                pos.x = treeBlock.x + 0.5;
                pos.z = treeBlock.z + 0.5;
                pos.y = treeBlock.y + 1;
                this.velocity.set(0, 0, 0);
                this.onGround = true;
                this.inTree = true;
                this.isClimbing = false;
                return;
            }
        }

        // Check for climbable surfaces (tree trunks)
        const forwardX = pos.x + this.moveDirection.x * 0.6;
        const forwardZ = pos.z + this.moveDirection.z * 0.6;

        // Check blocks around the monkey for wood
        const checkPositions = [
            { x: pos.x + 0.5, z: pos.z },
            { x: pos.x - 0.5, z: pos.z },
            { x: pos.x, z: pos.z + 0.5 },
            { x: pos.x, z: pos.z - 0.5 }
        ];

        let adjacentWood = null;
        for (const check of checkPositions) {
            const block = this.game.getBlock(Math.floor(check.x), Math.floor(pos.y), Math.floor(check.z));
            if (block && (block.type.includes('wood') || block.type.includes('log'))) {
                adjacentWood = check;
                break;
            }
        }

        // Climbing behavior on tree trunks
        if (adjacentWood && this.climbTimer > 0) {
            this.isClimbing = true;

            // Check if we can continue climbing in the desired direction
            const nextY = Math.floor(pos.y + this.climbDirection);
            const nextBlock = this.game.getBlock(Math.floor(adjacentWood.x), nextY, Math.floor(adjacentWood.z));

            if (nextBlock && (nextBlock.type.includes('wood') || nextBlock.type.includes('log'))) {
                // Can continue climbing
                pos.y += this.climbSpeed * this.climbDirection * dt;

                // Stay close to tree trunk
                const pullX = (Math.floor(adjacentWood.x) + 0.5) - pos.x;
                const pullZ = (Math.floor(adjacentWood.z) + 0.5) - pos.z;
                pos.x += pullX * 0.1 * dt;
                pos.z += pullZ * 0.1 * dt;

                // Face the tree
                this.rotation = Math.atan2(pullX, pullZ);
                this.onGround = false;
                this.velocity.y = 0;
                return;
            } else {
                // Reached top/bottom of trunk - look for leaves or stop
                this.isClimbing = false;
                this.climbTimer = 0;

                // If going up and there are leaves above, hop onto them
                if (this.climbDirection === 1) {
                    const leavesBlock = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y + 1), Math.floor(pos.z));
                    if (leavesBlock && leavesBlock.type.includes('leaves')) {
                        pos.y += 1;
                    }
                }
            }
        }

        // Check for wood in front and start climbing
        const blockInFront = this.game.getBlock(Math.floor(forwardX), Math.floor(pos.y), Math.floor(forwardZ));
        if (blockInFront && (blockInFront.type.includes('wood') || blockInFront.type.includes('log'))) {
            this.isClimbing = true;
            this.climbDirection = 1; // Default climb up
            this.climbTimer = 2 + Math.random() * 3;

            pos.y += this.climbSpeed * dt;
            pos.x += this.moveDirection.x * 0.5 * dt;
            pos.z += this.moveDirection.z * 0.5 * dt;
            this.onGround = false;
            return;
        }

        this.isClimbing = false;
        super.updateWalkerPhysics(dt);
    }

    findGroundY() {
        const pos = this.position;
        const checkX = Math.floor(pos.x);
        const checkZ = Math.floor(pos.z);

        for (let y = Math.floor(pos.y); y >= Math.floor(pos.y) - 20; y--) {
            if (this.game.getBlock(checkX, y, checkZ)) {
                return y + 1;
            }
        }
        return -Infinity;
    }

    // Find tree blocks below current position for landing
    findTreeLandingY() {
        const pos = this.position;
        const checkX = Math.floor(pos.x);
        const checkZ = Math.floor(pos.z);

        for (let y = Math.floor(pos.y); y >= Math.floor(pos.y) - 20; y--) {
            const block = this.game.getBlock(checkX, y, checkZ);
            if (block && (block.type.includes('leaves') || block.type.includes('wood') || block.type.includes('log'))) {
                return y + 1;
            }
        }
        return null;
    }

    // Find nearby tree blocks to grab onto when falling
    findNearbyTreeBlock() {
        const pos = this.position;
        const searchRadius = 2;

        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            for (let dz = -searchRadius; dz <= searchRadius; dz++) {
                for (let dy = -2; dy <= 2; dy++) {
                    const x = Math.floor(pos.x + dx);
                    const y = Math.floor(pos.y + dy);
                    const z = Math.floor(pos.z + dz);

                    const block = this.game.getBlock(x, y, z);
                    if (block && (block.type.includes('leaves') || block.type.includes('wood') || block.type.includes('log'))) {
                        return { x, y, z };
                    }
                }
            }
        }
        return null;
    }

    updateAnimation(dt) {
        if (this.isClimbing) {
            // Climbing animation - arms and legs move alternately
            this.animTime += dt * 15;
            const angle = Math.sin(this.animTime) * 0.6;

            if (this.legParts.length >= 4) {
                this.legParts[0].rotation.x = angle;
                this.legParts[1].rotation.x = -angle;
                this.legParts[2].rotation.x = -angle; // Arms opposite to legs
                this.legParts[3].rotation.x = angle;
            }
        } else {
            super.updateAnimation(dt);
        }
    }
}
