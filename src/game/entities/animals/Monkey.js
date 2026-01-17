import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Monkey extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.6;
        this.height = 0.8;
        this.depth = 0.6;
        this.speed = 4.5; // Slightly faster
        this.createBody();
        this.mesh.scale.set(0.8, 0.8, 0.8);

        // Tree behavior states
        this.isClimbing = false;
        this.climbDirection = 1; // 1 = up, -1 = down
        this.climbSpeed = 4.0;

        // Tree jumping logic
        this.targetTree = null;
        this.isJumping = false;
        this.jumpCooldown = 0;
        this.scanTimer = 0;
        this.jumpTimer = 0; // Safety timer to prevent infinite jumping

        // Tree dwelling preference
        this.inTree = false;
        this.seekingTree = false;
        this.treeTarget = null;
        this.climbTimer = 0;
        this.preferredHeight = 8 + Math.random() * 6; // Monkeys prefer heights between 8-14 blocks

        // Movement style - allow hopping over 1-block obstacles
        this.canHop = true;
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

    // Check if standing on or near tree blocks
    isInTree() {
        const pos = this.position;
        // Check blocks around and below
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const block = this.game.getBlock(Math.floor(pos.x + dx), Math.floor(pos.y + dy), Math.floor(pos.z + dz));
                    if (this.isTreeBlock(block)) return true;
                }
            }
        }
        return false;
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
                for (let dy = -2; dy < 20; dy++) {
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

    updateAI(dt) {
        if (this.jumpCooldown > 0) this.jumpCooldown -= dt;
        if (this.climbTimer > 0) this.climbTimer -= dt;

        // Update tree status
        this.inTree = this.isInTree();

        // Handle jumping state
        if (this.isJumping) {
            this.jumpTimer += dt;

            // Landing detection: on ground, velocity near zero, or max air time exceeded
            const velocityNearZero = Math.abs(this.velocity.y) < 0.5;
            const maxAirTimeExceeded = this.jumpTimer > 3.0; // Safety: 3 seconds max jump time

            if (this.onGround || (velocityNearZero && this.jumpTimer > 0.5) || maxAirTimeExceeded) {
                this.isJumping = false;
                this.jumpCooldown = 1.0;
                this.jumpTimer = 0;
                this.state = 'idle';
                if (!this.inTree) {
                    this.seekingTree = true;
                }
            }
            return;
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
                this.isClimbing = true;
                this.climbTimer = 2.0;
            } else {
                // Move towards tree
                const dir = this.treeTarget.clone().sub(this.position);
                dir.y = 0;
                dir.normalize();
                this.moveDirection.copy(dir);
                this.rotation = Math.atan2(dir.x, dir.z);
                this.state = 'walk';
                this.isMoving = true;

                // If blocked while seeking tree, try to climb or hop
                this.checkObstacleClimb();
                return;
            }
        }

        // Handle climbing state
        if (this.isClimbing) {
            this.velocity.y = this.climbSpeed * this.climbDirection;
            this.isMoving = true;

            if (this.climbTimer <= 0) {
                this.isClimbing = false;
            }
            return;
        }

        // If in tree, do tree behaviors
        if (this.inTree) {
            this.seekingTree = false;

            // Tree scanning for jumps
            this.scanTimer -= dt;
            if (this.scanTimer <= 0 && this.jumpCooldown <= 0) {
                this.scanTimer = 0.5 + Math.random() * 0.5;
                this.checkForTrees();
            }

            // Get terrain height for relative height calculations
            const terrainY = this.game.worldGen ? this.game.worldGen.getTerrainHeight(this.position.x, this.position.z) : 0;
            const heightAboveTerrain = this.position.y - terrainY;
            const maxHeightAboveTerrain = 15; // Monkeys shouldn't climb more than 15 blocks above terrain

            // Random climbing up/down (with height limit relative to terrain)
            if (!this.isJumping && Math.random() < 0.05 * dt && this.climbTimer <= 0) {
                // Don't start climbing up if already too high above terrain
                if (heightAboveTerrain >= maxHeightAboveTerrain) {
                    this.climbDirection = -1; // Force climb down
                } else if (heightAboveTerrain < this.preferredHeight) {
                    this.climbDirection = 1; // Climb up
                } else if (heightAboveTerrain > this.preferredHeight + 5) {
                    this.climbDirection = -1; // Climb down
                } else {
                    this.climbDirection = Math.random() > 0.5 ? 1 : -1;
                }

                // Only start climbing if direction makes sense
                if (this.climbDirection === 1 && heightAboveTerrain < maxHeightAboveTerrain) {
                    this.isClimbing = true;
                    this.climbTimer = 1 + Math.random() * 2;
                } else if (this.climbDirection === -1) {
                    this.isClimbing = true;
                    this.climbTimer = 1 + Math.random() * 2;
                }
            }
        }

        super.updateAI(dt);
    }

    checkObstacleClimb() {
        // Look ahead to see if we're blocked by a wall
        const lookAhead = 0.8;
        const checkX = this.position.x + Math.sin(this.rotation) * lookAhead;
        const checkZ = this.position.z + Math.cos(this.rotation) * lookAhead;

        // Check blocks at foot, waist, and head level
        const footBlock = this.game.getBlock(Math.floor(checkX), Math.floor(this.position.y), Math.floor(checkZ));
        const waistBlock = this.game.getBlock(Math.floor(checkX), Math.floor(this.position.y + 1), Math.floor(checkZ));

        if (footBlock && footBlock.type !== 'air' && footBlock.type !== 'water') {
            // If it's a solid block, start climbing up it
            this.isClimbing = true;
            this.climbDirection = 1;
            this.climbTimer = 0.5; // Short burst to get over the block
            this.velocity.y = this.climbSpeed;
        }
    }

    checkForTrees() {
        const pos = this.position;
        const terrainY = this.game.worldGen ? this.game.worldGen.getTerrainHeight(pos.x, pos.z) : 0;
        const heightAboveTerrain = pos.y - terrainY;
        const maxHeightAboveTerrain = 15; // Don't jump if already too high above terrain

        // Don't attempt tree jumps if already flying too high above terrain
        if (heightAboveTerrain > maxHeightAboveTerrain) {
            return;
        }

        const currentBlock = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y - 1), Math.floor(pos.z));
        const isSecure = this.isTreeBlock(currentBlock);

        // More likely to jump if securely in a tree
        if (isSecure || Math.random() < 0.3) {
            // Scan for another tree to jump to
            const range = 8; // Reduced range for more controlled jumps
            const attempts = 10;

            for (let i = 0; i < attempts; i++) {
                const tx = pos.x + (Math.random() - 0.5) * range * 2;
                const tz = pos.z + (Math.random() - 0.5) * range * 2;
                // Prefer similar or lower heights - bias towards staying at same level or going down
                const ty = pos.y + (Math.random() * 3) - 2; // Range: -2 to +1

                // Check target height relative to its terrain
                const targetTerrainY = this.game.worldGen ? this.game.worldGen.getTerrainHeight(tx, tz) : 0;
                const targetHeightAboveTerrain = ty - targetTerrainY;

                // Skip targets that are too high above their terrain
                if (targetHeightAboveTerrain > maxHeightAboveTerrain) continue;

                const targetBlock = this.game.getBlock(Math.floor(tx), Math.floor(ty), Math.floor(tz));
                if (this.isTreeBlock(targetBlock)) {
                    // Target found! Calculate jump trajectory
                    const dx = tx - pos.x;
                    const dz = tz - pos.z;
                    const horizontalDist = Math.sqrt(dx * dx + dz * dz);

                    // Calculate Y velocity needed - more conservative arc
                    const heightDiff = ty - pos.y;
                    const arcHeight = Math.max(0.5, horizontalDist * 0.2); // Smaller arc
                    const yVel = Math.min(heightDiff + arcHeight + 1.5, 5); // Cap upward velocity at 5

                    // Horizontal velocity based on distance
                    const horizontalSpeed = Math.min(horizontalDist * 0.5 + 2, 7); // Cap at 7

                    const dir = new THREE.Vector3(dx, 0, dz).normalize();
                    this.velocity.x = dir.x * horizontalSpeed;
                    this.velocity.z = dir.z * horizontalSpeed;
                    this.velocity.y = yVel;

                    this.isJumping = true;
                    this.jumpTimer = 0; // Reset jump timer
                    this.onGround = false;
                    this.rotation = Math.atan2(dx, dz);
                    this.jumpCooldown = 2.0; // Longer cooldown to prevent rapid jumping
                    return;
                }
            }
        }
    }

    updatePhysics(dt) {
        // Use terrain-relative height limits
        const terrainY = this.game.worldGen ? this.game.worldGen.getTerrainHeight(this.position.x, this.position.z) : 0;
        const heightAboveTerrain = this.position.y - terrainY;
        const maxHeightAboveTerrain = 15; // Maximum height above terrain monkeys can reach

        // If climbing, override gravity
        if (this.isClimbing) {
            // Stop climbing up if too high above terrain
            if (heightAboveTerrain >= maxHeightAboveTerrain && this.climbDirection > 0) {
                this.isClimbing = false;
                this.climbDirection = -1; // Force downward next time
            } else {
                // Apply climbing movement directly to position to bypass some physics constraints
                const climbMove = new THREE.Vector3(
                    this.moveDirection.x * this.speed * dt,
                    this.climbSpeed * this.climbDirection * dt,
                    this.moveDirection.z * this.speed * dt
                );
                this.position.add(climbMove);
                this.velocity.y = 0; // Cancel gravity while climbing

                // Still sync mesh
                this.mesh.position.copy(this.position);
                return;
            }
        }

        // Safety check: if too high above terrain, apply extra gravity to bring them down
        if (heightAboveTerrain > maxHeightAboveTerrain) {
            // Force downward if they're too high
            if (this.velocity.y > -3) {
                this.velocity.y = -3; // Gentle but consistent downward velocity
            }
            this.isClimbing = false;
            this.isJumping = false;
        }

        super.updatePhysics(dt);
    }
}
