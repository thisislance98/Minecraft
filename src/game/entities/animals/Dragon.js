import * as THREE from 'three';
import { SeededRandom } from '../../../utils/SeededRandom.js';

export class Dragon {
    constructor(game, x, y, z, seed) {
        this.game = game;
        this.position = new THREE.Vector3(x, y, z);
        this.rng = new SeededRandom(seed || Math.random() * 0xffffffff);
        this.velocity = new THREE.Vector3(
            (this.rng.next() - 0.5) * 10,
            0,
            (this.rng.next() - 0.5) * 10
        );

        // Flight parameters
        this.speed = 12;
        this.targetHeight = y;
        this.minHeight = 20;
        this.maxHeight = 50;
        this.bounds = 100;

        // State
        this.state = 'patrol'; // patrol, hunting, breathing_fire, landing, nesting
        this.target = null;
        this.nestPosition = null;
        this.state = 'patrol'; // patrol, hunting, breathing_fire, landing, nesting
        this.target = null;
        this.nestPosition = null;
        this.stateTimer = 0;

        // Rider
        this.rider = null;
        this.onGround = false;

        // Fire breathing
        this.fireParticles = [];
        this.fireTimer = 0;
        this.isBreathingFire = false;
        this.fireBreathDuration = 2.0;
        this.fireCooldown = 5.0;
        this.fireRange = 15;

        // Animation
        this.animTime = 0;
        this.wingPhase = this.rng.next() * Math.PI * 2;

        // Create the dragon mesh
        this.mesh = new THREE.Group();

        // Inner group for model rotation
        this.model = new THREE.Group();
        this.model.rotation.y = -Math.PI / 2; // Fix model orientation (facing +X, flying +Z)
        this.mesh.add(this.model);

        // Update dimensions for collision
        this.width = 2.0;
        this.height = 2.0;
        this.depth = 5.0; // Long tail

        this.createBody();
        this.mesh.position.copy(this.position);

        // Fire particle group
        this.fireGroup = new THREE.Group();
        this.game.scene.add(this.fireGroup);
    }

    createBody() {
        // Dragon materials
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x8B0000 }); // Dark red
        const bellyMat = new THREE.MeshLambertMaterial({ color: 0xD2691E }); // Orange-brown belly
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0xFFFF00 }); // Yellow eyes
        const pupilMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const hornMat = new THREE.MeshLambertMaterial({ color: 0x2F2F2F }); // Dark gray horns
        const wingMembraneMat = new THREE.MeshLambertMaterial({
            color: 0x800000,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });

        // Main body - elongated
        const bodyGeo = new THREE.BoxGeometry(2.5, 1.2, 1.5);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0, 0);
        this.model.add(body);

        // Belly
        const bellyGeo = new THREE.BoxGeometry(2.0, 0.4, 1.2);
        const belly = new THREE.Mesh(bellyGeo, bellyMat);
        belly.position.set(0, -0.5, 0);
        this.model.add(belly);

        // Neck
        const neckGeo = new THREE.BoxGeometry(0.8, 0.8, 1.5);
        const neck = new THREE.Mesh(neckGeo, bodyMat);
        neck.position.set(1.4, 0.4, 0);
        neck.rotation.z = Math.PI / 6;
        this.model.add(neck);

        // Head
        const headGeo = new THREE.BoxGeometry(1.2, 0.8, 0.9);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.set(2.2, 0.9, 0);
        this.model.add(head);
        this.head = head;

        // Snout
        const snoutGeo = new THREE.BoxGeometry(0.8, 0.4, 0.6);
        const snout = new THREE.Mesh(snoutGeo, bodyMat);
        snout.position.set(2.9, 0.75, 0);
        this.model.add(snout);

        // Nostrils
        const nostrilGeo = new THREE.BoxGeometry(0.1, 0.1, 0.15);
        const leftNostril = new THREE.Mesh(nostrilGeo, pupilMat);
        leftNostril.position.set(3.3, 0.8, 0.15);
        this.model.add(leftNostril);

        const rightNostril = new THREE.Mesh(nostrilGeo, pupilMat);
        rightNostril.position.set(3.3, 0.8, -0.15);
        this.model.add(rightNostril);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.2, 0.25, 0.15);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(2.5, 1.1, 0.4);
        this.model.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(2.5, 1.1, -0.4);
        this.model.add(rightEye);

        // Pupils
        const pupilGeo = new THREE.BoxGeometry(0.1, 0.15, 0.12);
        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(2.55, 1.1, 0.45);
        this.model.add(leftPupil);

        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(2.55, 1.1, -0.45);
        this.model.add(rightPupil);

        // Horns
        const hornGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15);
        const leftHorn = new THREE.Mesh(hornGeo, hornMat);
        leftHorn.position.set(2.0, 1.4, 0.35);
        leftHorn.rotation.z = -0.3;
        this.model.add(leftHorn);

        const rightHorn = new THREE.Mesh(hornGeo, hornMat);
        rightHorn.position.set(2.0, 1.4, -0.35);
        rightHorn.rotation.z = -0.3;
        this.model.add(rightHorn);

        // Spines along back
        for (let i = 0; i < 6; i++) {
            const spineGeo = new THREE.BoxGeometry(0.2, 0.3 + (2 - Math.abs(i - 2.5)) * 0.1, 0.15);
            const spine = new THREE.Mesh(spineGeo, hornMat);
            spine.position.set(1.0 - i * 0.5, 0.75, 0);
            this.model.add(spine);
        }

        // Tail
        const tailGroup = new THREE.Group();
        tailGroup.position.set(-1.25, 0, 0);

        for (let i = 0; i < 5; i++) {
            const segGeo = new THREE.BoxGeometry(0.6 - i * 0.08, 0.4 - i * 0.05, 0.4 - i * 0.05);
            const segment = new THREE.Mesh(segGeo, bodyMat);
            segment.position.set(-i * 0.55, i * -0.1, 0);
            tailGroup.add(segment);
        }

        // Tail spike
        const tailSpikeGeo = new THREE.BoxGeometry(0.3, 0.4, 0.2);
        const tailSpike = new THREE.Mesh(tailSpikeGeo, hornMat);
        tailSpike.position.set(-2.6, -0.5, 0);
        tailSpike.rotation.z = 0.5;
        tailGroup.add(tailSpike);

        this.model.add(tailGroup);
        this.tailGroup = tailGroup;

        // Wings
        this.leftWing = this.createWing(bodyMat, wingMembraneMat, 1);
        this.leftWing.position.set(-0.3, 0.4, 0.75);
        this.model.add(this.leftWing);

        this.rightWing = this.createWing(bodyMat, wingMembraneMat, -1);
        this.rightWing.position.set(-0.3, 0.4, -0.75);
        this.model.add(this.rightWing);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.3, 0.8, 0.3);
        const footGeo = new THREE.BoxGeometry(0.4, 0.15, 0.5);
        const clawGeo = new THREE.BoxGeometry(0.1, 0.2, 0.1);

        const makeLeg = (x, z) => {
            const legGroup = new THREE.Group();
            legGroup.position.set(x, -0.5, z);

            const leg = new THREE.Mesh(legGeo, bodyMat);
            leg.position.set(0, -0.4, 0);
            legGroup.add(leg);

            const foot = new THREE.Mesh(footGeo, bodyMat);
            foot.position.set(0.1, -0.85, 0);
            legGroup.add(foot);

            // Claws
            for (let c = -1; c <= 1; c++) {
                const claw = new THREE.Mesh(clawGeo, hornMat);
                claw.position.set(0.3, -0.9, c * 0.15);
                legGroup.add(claw);
            }

            this.model.add(legGroup);
            return legGroup;
        };

        this.leftFrontLeg = makeLeg(0.8, 0.5);
        this.rightFrontLeg = makeLeg(0.8, -0.5);
        this.leftBackLeg = makeLeg(-0.8, 0.5);
        this.rightBackLeg = makeLeg(-0.8, -0.5);
    }

    createWing(boneMat, membraneMat, side) {
        const wing = new THREE.Group();

        // Wing bone structure
        const upperBoneGeo = new THREE.BoxGeometry(0.2, 0.2, 1.5);
        const upperBone = new THREE.Mesh(upperBoneGeo, boneMat);
        upperBone.position.set(0, 0, side * 0.75);
        wing.add(upperBone);

        const lowerBoneGeo = new THREE.BoxGeometry(0.15, 0.15, 2.0);
        const lowerBone = new THREE.Mesh(lowerBoneGeo, boneMat);
        lowerBone.position.set(-0.5, -0.1, side * 1.8);
        lowerBone.rotation.x = side * 0.3;
        wing.add(lowerBone);

        // Wing membrane
        const membraneGeo = new THREE.BoxGeometry(2.0, 0.05, 2.5);
        const membrane = new THREE.Mesh(membraneGeo, membraneMat);
        membrane.position.set(-0.3, -0.1, side * 1.25);
        wing.add(membrane);

        return wing;
    }

    update(dt, player) {
        dt = Math.min(dt, 0.1);

        this.animTime += dt;
        this.stateTimer -= dt;
        this.fireTimer -= dt;

        // Update AI
        if (this.rider) {
            this.updateRidden(dt);
        } else {
            this.updateAI(dt, player);
            this.updateFlight(dt, player);
        }

        // Update fire breathing
        this.updateFire(dt);

        // Update animation
        this.updateAnimation(dt);

        // Sync mesh
        this.mesh.position.copy(this.position);

        // Orient to velocity
        if (this.state !== 'nesting' && this.velocity.lengthSq() > 0.1) {
            const targetPos = this.position.clone().add(this.velocity);
            this.mesh.lookAt(targetPos);
        }

        // Prevent clipping and avoid obstacles
        this.avoidObstacles(dt);
        this.resolveCollision(dt);
    }

    avoidObstacles(dt) {
        // Look ahead
        const lookAheadDist = 15;
        const lookDir = this.velocity.clone().normalize();
        const probePoint = this.position.clone().add(lookDir.multiplyScalar(lookAheadDist));

        // Check a few points ahead
        const bx = Math.floor(probePoint.x);
        const by = Math.floor(probePoint.y);
        const bz = Math.floor(probePoint.z);

        let hit = false;
        // Check simplified 3x3 grid at lookahead point
        for (let startY = by - 2; startY <= by + 2; startY++) {
            const block = this.game.getBlock(bx, startY, bz);
            if (block && block.type !== 'water') {
                hit = true;
                break;
            }
        }

        if (hit) {
            // Obstacle ahead! Steer UP and slightly away
            this.velocity.y += 30 * dt;

            // Also steer sideways if we can
            // Cross product with UP gives a side vector
            const side = new THREE.Vector3().crossVectors(lookDir, new THREE.Vector3(0, 1, 0)).normalize();
            // Randomly pick left or right based on position to avoid getting stuck in loops
            // Using ID or noise would be better, but random is okay for now
            if ((this.position.x + this.position.z) % 20 > 10) {
                this.velocity.add(side.multiplyScalar(10 * dt));
            } else {
                this.velocity.add(side.multiplyScalar(-10 * dt));
            }
        }

        // Ground avoidance (Low altitude check)
        // Check directly below
        let groundY = -1;
        for (let y = Math.floor(this.position.y); y >= Math.max(0, Math.floor(this.position.y) - 10); y--) {
            const block = this.game.getBlock(Math.floor(this.position.x), y, Math.floor(this.position.z));
            if (block && block.type !== 'water') {
                groundY = y;
                break;
            }
        }

        if (groundY > -1) {
            const distToGround = this.position.y - groundY;
            const minAlt = 8;
            if (distToGround < minAlt) {
                // Too low! Pull up!
                const force = (minAlt - distToGround) * 8.0; // Strong upward force
                this.velocity.y += force * dt;
            }
        }
    }

    resolveCollision(dt) {
        // Simple bounding radius check
        const radius = 2.0;
        const center = this.position.clone();
        center.y += 1.0; // Center mass slightly up

        const minX = Math.floor(center.x - radius);
        const maxX = Math.ceil(center.x + radius);
        const minY = Math.floor(center.y - radius);
        const maxY = Math.ceil(center.y + radius);
        const minZ = Math.floor(center.z - radius);
        const maxZ = Math.ceil(center.z + radius);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const block = this.game.getBlock(x, y, z);
                    if (block && block.type !== 'water') { // Ignore water for now
                        // Box collision
                        // AABB vs Sphere approximation
                        // Get closest point on block AABB to sphere center
                        const closestX = Math.max(x, Math.min(center.x, x + 1));
                        const closestY = Math.max(y, Math.min(center.y, y + 1));
                        const closestZ = Math.max(z, Math.min(center.z, z + 1));

                        const distSq = (center.x - closestX) ** 2 +
                            (center.y - closestY) ** 2 +
                            (center.z - closestZ) ** 2;

                        if (distSq < radius * radius && distSq > 0.0001) {
                            const dist = Math.sqrt(distSq);
                            const overlap = radius - dist;

                            // Normal direction
                            const nx = (center.x - closestX) / dist;
                            const ny = (center.y - closestY) / dist;
                            const nz = (center.z - closestZ) / dist;

                            // Push out position
                            this.position.x += nx * overlap;
                            this.position.y += ny * overlap;
                            this.position.z += nz * overlap;

                            // Reflect velocity slightly (bounce/slide)
                            // Component of velocity along normal
                            const vDotN = this.velocity.x * nx + this.velocity.y * ny + this.velocity.z * nz;
                            if (vDotN < 0) {
                                // Remove velocity towards wall
                                this.velocity.x -= vDotN * nx;
                                this.velocity.y -= vDotN * ny;
                                this.velocity.z -= vDotN * nz;

                                // Friction/Damping
                                this.velocity.multiplyScalar(0.9);
                            }
                        }
                    }
                }
            }
        }
    }

    updateAI(dt, player) {
        // Look for prey (any animal)
        if (this.state === 'patrol' && this.stateTimer <= 0) {

            // Chance to look for a tree to land on
            if (this.position.y > 30 && this.rng.next() < 0.2) {
                const treePos = this.findTree();
                if (treePos) {
                    this.nestPosition = treePos;
                    // Aim slightly above the tree
                    this.nestPosition.y += 2.0;
                    this.state = 'landing';
                    console.log('Dragon found a tree to land on!', treePos);
                    return;
                }
            }

            const huntRange = 50;
            let nearestPrey = null;
            let nearestDist = huntRange * huntRange;

            if (this.game.animals) {
                for (const animal of this.game.animals) {
                    if (!animal.isDead) {
                        const distSq = this.position.distanceToSquared(animal.position);
                        if (distSq < nearestDist) {
                            nearestDist = distSq;
                            nearestPrey = animal;
                        }
                    }
                }
            }

            if (nearestPrey && this.rng.next() < 0.3) {
                this.target = nearestPrey;
                this.state = 'hunting';
                this.stateTimer = 10; // Hunt for up to 10 seconds
            } else {
                this.stateTimer = 3; // Check again in 3 seconds
            }
        }

        if (this.state === 'hunting') {
            if (!this.target || this.target.isDead) {
                this.target = null;
                this.state = 'patrol';
                this.stateTimer = 2;
                return;
            }

            const toTarget = new THREE.Vector3().subVectors(this.target.position, this.position);
            const dist = toTarget.length();

            if (dist < this.fireRange && this.fireTimer <= 0) {
                // Breathe fire!
                this.isBreathingFire = true;
                this.fireTimer = this.fireCooldown + this.fireBreathDuration;
                this.stateTimer = this.fireBreathDuration;
                this.state = 'breathing_fire';
            } else if (dist < 3) {
                // Close enough to eat!
                this.eatAnimal(this.target);
                this.target = null;
                this.state = 'patrol';
                this.stateTimer = 5;
            } else {
                // Move towards target
                toTarget.normalize();
                this.velocity.lerp(toTarget.multiplyScalar(this.speed), dt * 2);
            }

            if (this.stateTimer <= 0) {
                // Give up hunt
                this.target = null;
                this.state = 'patrol';
                this.stateTimer = 3;
            }
        }

        if (this.state === 'breathing_fire') {
            if (this.stateTimer <= 0) {
                this.isBreathingFire = false;
                this.state = 'hunting';
                this.stateTimer = 5;
            }
        }

        if (this.state === 'landing') {
            const distToNest = this.position.distanceTo(this.nestPosition);

            // Slow down as we approach
            const approachSpeed = Math.min(this.speed, distToNest);

            const toNest = new THREE.Vector3().subVectors(this.nestPosition, this.position).normalize();
            this.velocity.lerp(toNest.multiplyScalar(approachSpeed), dt * 3);

            if (distToNest < 1.0) {
                this.state = 'nesting';
                this.velocity.set(0, 0, 0);
                this.stateTimer = 10 + this.rng.next() * 20; // Rest for 10-30 seconds
                this.buildNest();
            }
        }

        if (this.state === 'nesting') {
            // Stay put
            this.velocity.set(0, 0, 0);
            this.position.copy(this.nestPosition);

            if (this.stateTimer <= 0) {
                // Take off
                this.state = 'patrol';
                this.velocity.set(0, 5, 0); // Jump up
                this.stateTimer = 5; // Don't look for new trees immediately
            }
        }
    }

    findTree() {
        // Random check for leaves around dragon
        const range = 40;
        const attempts = 10;

        for (let i = 0; i < attempts; i++) {
            const tx = this.position.x + (this.rng.next() - 0.5) * range * 2;
            const tz = this.position.z + (this.rng.next() - 0.5) * range * 2;

            // Scan down from dragon height or max height
            const scanStart = Math.min(this.position.y + 10, 60);

            for (let y = Math.floor(scanStart); y > 10; y--) {
                const block = this.game.getBlock(Math.floor(tx), y, Math.floor(tz));
                if (block) {
                    if (block.type.includes('leaves')) {
                        // Found a tree! Verify clear space above
                        if (!this.game.getBlock(Math.floor(tx), y + 1, Math.floor(tz))) {
                            return new THREE.Vector3(Math.floor(tx) + 0.5, y + 1, Math.floor(tz) + 0.5);
                        }
                    } else {
                        // Hit ground or other block, stop this column
                        break;
                    }
                }
            }
        }
        return null;
    }

    buildNest() {
        // Build a proper nest structure (3x3)
        const bx = Math.floor(this.position.x);
        const by = Math.floor(this.position.y - 1.5); // Block below feet
        const bz = Math.floor(this.position.z);

        console.log(`Dragon building nest at ${bx}, ${by}, ${bz}`);

        // Center - Dirt or Hay-like material
        // We'll use dirt for now, maybe sand for variation
        this.safeSetBlock(bx, by, bz, 'dirt');

        // Rim - Wood to make it look constructed
        // 3x3 ring around center
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (dx === 0 && dz === 0) continue; // Skip center

                // Place wood rim
                const rimX = bx + dx;
                const rimZ = bz + dz;
                this.safeSetBlock(rimX, by, rimZ, 'wood');

                // Clear space above (for wings)
                this.safeSetBlock(rimX, by + 1, rimZ, null);
                this.safeSetBlock(rimX, by + 2, rimZ, null);
            }
        }

        // Clear center air too
        this.safeSetBlock(bx, by + 1, bz, null);
        this.safeSetBlock(bx, by + 2, bz, null);
    }

    safeSetBlock(x, y, z, type) {
        // Helper to avoid replacing bedrock or invalid coordinates
        if (y > 0) {
            this.game.setBlock(x, y, z, type);
        }
    }

    updateFlight(dt, player) {
        if (this.state === 'nesting') return;

        const cx = player.position.x;
        const cz = player.position.z;

        // Patrol behavior - circle around
        if (this.state === 'patrol') {
            // Add some randomness to velocity
            this.velocity.x += (this.rng.next() - 0.5) * 5 * dt;
            this.velocity.z += (this.rng.next() - 0.5) * 5 * dt;

            // Height control
            const targetY = player.position.y + 30;
            const heightDiff = targetY - this.position.y;
            this.velocity.y += heightDiff * 0.5 * dt;

            // Keep above minimum height
            if (this.position.y < this.minHeight) {
                this.velocity.y += 15 * dt;
            }
            if (this.position.y > this.maxHeight) {
                this.velocity.y -= 10 * dt;
            }
        }

        // Landing and Hunting override normal flight height/bounds
        if (this.state !== 'landing' && this.state !== 'hunting') {
            // Stay within bounds of player
            const distFromPlayer = Math.sqrt(
                (this.position.x - cx) ** 2 +
                (this.position.z - cz) ** 2
            );

            if (distFromPlayer > this.bounds) {
                const toPlayer = new THREE.Vector3(
                    cx - this.position.x,
                    0,
                    cz - this.position.z
                ).normalize();
                this.velocity.x += toPlayer.x * 10 * dt;
                this.velocity.z += toPlayer.z * 10 * dt;
            }

            // Limit vertical velocity
            this.velocity.y = Math.max(-5, Math.min(5, this.velocity.y));
        }

        // Speed limits
        const speed = this.velocity.length();
        if (speed > this.speed) {
            this.velocity.multiplyScalar(this.speed / speed);
        } else if (speed < this.speed * 0.5 && this.state !== 'landing') {
            if (speed > 0.1) {
                this.velocity.multiplyScalar((this.speed * 0.5) / speed);
            } else {
                this.velocity.set(this.speed * 0.5, 0, 0);
            }
        }

        // Apply velocity
        this.position.add(this.velocity.clone().multiplyScalar(dt));
    }

    updateFire(dt) {
        if (this.isBreathingFire) {
            // Spawn fire particles
            for (let i = 0; i < 3; i++) {
                this.spawnFireParticle();
            }
        }

        // Update existing particles
        for (let i = this.fireParticles.length - 1; i >= 0; i--) {
            const particle = this.fireParticles[i];
            particle.life -= dt;

            if (particle.life <= 0) {
                this.fireGroup.remove(particle.mesh);
                this.fireParticles.splice(i, 1);
            } else {
                // Move particle
                particle.mesh.position.add(particle.velocity.clone().multiplyScalar(dt));

                // Fade out
                const alpha = particle.life / particle.maxLife;
                particle.mesh.material.opacity = alpha;
                particle.mesh.scale.setScalar(1 + (1 - alpha) * 2);

                // Check collision with animals
                if (this.game.animals) {
                    for (const animal of this.game.animals) {
                        if (animal.isDead) continue;
                        const dist = particle.mesh.position.distanceTo(animal.position);
                        if (dist < 1.5) {
                            animal.takeDamage(1);
                            // If killed, dragon might eat it
                            if (animal.isDead && this.rng.next() < 0.5) {
                                this.target = null;
                                this.state = 'patrol';
                            }
                        }
                    }
                }
            }
        }
    }

    spawnFireParticle() {
        // Get mouth position relative to model, then apply model rotation + mesh rotation
        // Model is rotated -90 Y. 
        // Head is at x=2.9 (snout) relative to model center.

        const mouthOffset = new THREE.Vector3(3.5, 0, 0); // Forward from body center
        mouthOffset.applyMatrix4(this.model.matrix); // Apply model rotation (which is inside mesh)
        mouthOffset.applyQuaternion(this.mesh.quaternion); // Apply mesh rotation

        const mouthPos = this.position.clone().add(mouthOffset);

        // Direction is Mesh forward (since model is fixed relative to mesh -90 deg)
        // Wait, mesh looks at velocity. 
        // Mesh +Z is forward. Model +X is forward.
        // Model is rotated -90 deg Y. So Model +X aligns with Mesh +Z.
        // So we want velocity aligned with Mesh +Z.

        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(this.mesh.quaternion);

        // Random spread
        const spread = 0.5;
        const velocity = forward.clone().multiplyScalar(15);
        velocity.x += (this.rng.next() - 0.5) * spread * 10;
        velocity.y += (this.rng.next() - 0.5) * spread * 5 - 2;
        velocity.z += (this.rng.next() - 0.5) * spread * 10;

        // Create particle mesh
        const size = 0.3 + this.rng.next() * 0.4;
        const geometry = new THREE.BoxGeometry(size, size, size);
        const hue = 0.05 + this.rng.next() * 0.1; // Orange to red
        const color = new THREE.Color().setHSL(hue, 1, 0.5 + this.rng.next() * 0.3);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 1
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(mouthPos);

        this.fireGroup.add(mesh);

        const particle = {
            mesh,
            velocity,
            life: 0.8 + this.rng.next() * 0.4,
            maxLife: 1.2
        };
        particle.maxLife = particle.life;

        this.fireParticles.push(particle);
    }

    eatAnimal(animal) {
        // Instakill
        animal.takeDamage(100);

        // Could add eating animation/sound here
        console.log('Dragon ate an animal!');
    }

    updateAnimation(dt) {
        // Wing flapping
        let flapSpeed = 4;
        let amplitude = 0.6;

        if (this.state === 'landing') {
            flapSpeed = 8; // Flap faster when landing
            amplitude = 0.4;
        } else if (this.state === 'nesting') {
            flapSpeed = 0; // Stop flapping
            amplitude = 0;
            // Fold wings
            if (this.leftWing) this.leftWing.rotation.x = 0;
            if (this.rightWing) this.rightWing.rotation.x = 0;
            // Fold wings back
            if (this.leftWing) this.leftWing.rotation.z = -0.5;
            if (this.rightWing) this.rightWing.rotation.z = 0.5;
        } else {
            // Reset wing fold
            if (this.leftWing) this.leftWing.rotation.z = 0;
            if (this.rightWing) this.rightWing.rotation.z = 0;
        }

        if (this.state !== 'nesting') {
            const wingAngle = Math.sin(this.animTime * flapSpeed + this.wingPhase) * amplitude;
            if (this.leftWing) this.leftWing.rotation.x = wingAngle;
            if (this.rightWing) this.rightWing.rotation.x = -wingAngle;
        }

        // Tail swish
        if (this.tailGroup) {
            const tailSwish = Math.sin(this.animTime * 2) * 0.2;
            this.tailGroup.rotation.y = tailSwish;
        }

        // Leg tucking when flying
        const legAngle = 0.5;
        if (this.state === 'nesting') {
            // Legs down standing
            if (this.leftFrontLeg) this.leftFrontLeg.rotation.x = 0;
            if (this.rightFrontLeg) this.rightFrontLeg.rotation.x = 0;
            if (this.leftBackLeg) this.leftBackLeg.rotation.x = 0;
            if (this.rightBackLeg) this.rightBackLeg.rotation.x = 0;
        } else {
            // Legs tucked
            if (this.leftFrontLeg) this.leftFrontLeg.rotation.x = 0.5;
            if (this.rightFrontLeg) this.rightFrontLeg.rotation.x = 0.5;
            if (this.leftBackLeg) this.leftBackLeg.rotation.x = 0.5;
            if (this.rightBackLeg) this.rightBackLeg.rotation.x = 0.5;
        }

        // Ridden Ground Animation override
        if (this.rider && this.onGround && this.isMoving) {
            const angle = Math.sin(this.animTime * 10) * 0.5;
            if (this.leftFrontLeg) this.leftFrontLeg.rotation.x = angle;
            if (this.rightFrontLeg) this.rightFrontLeg.rotation.x = -angle;
            if (this.leftBackLeg) this.leftBackLeg.rotation.x = -angle;
            if (this.rightBackLeg) this.rightBackLeg.rotation.x = angle;
        }
    }

    handleRiding(moveForward, moveRight, jump, rotationY, dt) {
        if (!this.rider) return;

        // Rotation: Align dragon with camera
        // Dragon model faces +X (rotated inside mesh), Mesh faces velocity usually.
        // When ridden, Mesh should face camera direction.
        // Camera looks -Z (relative to player).
        // If we set Mesh rotation to rotationY + Math.PI, it faces -Z (matching camera).
        this.frameRotation = rotationY + Math.PI;

        // We will smoothly interpolate actual mesh rotation in updateRidden

        this.inputMove = { forward: moveForward, right: moveRight };
        this.inputJump = jump;
    }

    updateRidden(dt) {
        const speed = this.onGround ? 6 : 15; // Walk speed vs Flight speed

        // 1. Rotation
        if (this.frameRotation !== undefined) {
            // Smooth turn
            let rotDiff = this.frameRotation - this.mesh.rotation.y;
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
            this.mesh.rotation.y += rotDiff * dt * 5;
        }

        // 2. Movement Inputs (Relative to Mesh facing)
        const forward = this.inputMove ? this.inputMove.forward : 0;
        const right = this.inputMove ? this.inputMove.right : 0;
        this.isMoving = (Math.abs(forward) > 0.1 || Math.abs(right) > 0.1);

        const cos = Math.cos(this.mesh.rotation.y);
        const sin = Math.sin(this.mesh.rotation.y);

        // Calculate Target Velocity (Horizontal)
        // Forward is +Z in local space for the Mesh (because we aligned it that way)
        // Wait, normally Horse faces +Z. 
        // Dragon Mesh: We usually rotate it to look at velocity.
        // Let's stick to: Inputs map to World X/Z based on rotation.

        let targetVx = 0;
        let targetVz = 0;

        if (this.isMoving) {
            // Forward (moveForward > 0) -> move mesh +Z (which is forward for our rotation logic)
            // Strafe Right (moveRight > 0) -> move mesh -X (Right)

            // Standard orbital controls mapping:
            // forward/back moves along view vector
            // left/right strafes

            // VelX = forward * sin + right * cos  (Check signs)
            // If facing 0 (South, +Z): sin=0, cos=1. 
            // Forward(+1) -> +Z. Correct.
            // Right(+1) -> +X. Correct.

            targetVx = (forward * sin + right * cos) * speed;
            targetVz = (forward * cos - right * sin) * speed;
        }

        // Apply Horizontal Acceleration
        const accel = this.onGround ? 20 : 10;
        this.velocity.x += (targetVx - this.velocity.x) * accel * dt;
        this.velocity.z += (targetVz - this.velocity.z) * accel * dt;

        // 3. Vertical Movement
        if (this.onGround) {
            // Ground Logic
            if (this.inputJump) {
                // Takeoff!
                this.velocity.y = 10;
                this.onGround = false;
                this.inputJump = false; // Consume jump
                console.log("Dragon Takeoff!");
            } else {
                // Gravity handled in updatePhysics/resolve
                // But we need to ensure we stick to ground if not jumping
            }
        } else {
            // Flight Logic
            // Space -> Up, Shift -> Down
            const flySpeed = 10;
            let targetVy = 0;
            if (this.inputJump) targetVy = flySpeed;
            // We don't have direct access to Shift here easily without passing it... 
            // handleRiding passes 'jump' (Space). 
            // Player.js implementation of handleRiding passes keys['Space']
            // We need Shift? Dragon.js doesn't see keys directly.
            // But Player checks Shift for dismount... 
            // If we are in air, Player shouldn't dismount on Shift?
            // Player.js: if (keys['ShiftLeft']) this.dismount();
            // This conflicts with "Shift to fly down".
            // Solution: Player.js riding logic needs to change to ONLY dismount if on ground?
            // Or use another key for down? 
            // Standard creative flight is Shift to go down.
            // Let's assume for now Space=Up. Gravity pulls down.
            // So to go down, just release Space?

            // Let's make it: Space = Fly Up. No Space = Fall slowly (Gliding) / Gravity.
            // To land, just don't press space.

            if (this.inputJump) {
                this.velocity.y += 30 * dt; // Jetpack style
            }

            // Gliding drag
            this.velocity.y -= 10 * dt; // Gravity/Drag
            this.velocity.y = Math.max(-10, Math.min(15, this.velocity.y));
        }

        // Apply physics
        this.position.add(this.velocity.clone().multiplyScalar(dt));

        // Ground Check / Collision
        this.checkGroundCollision(dt);
        this.resolveCollision(dt);
    }

    checkGroundCollision(dt) {
        // Simple raycast down
        const y = this.position.y;

        // Find ground Y below
        let groundY = -Infinity;
        const cx = Math.floor(this.position.x);
        const cz = Math.floor(this.position.z);

        for (let dy = 0; dy < 5; dy++) {
            const checkY = Math.floor(y) - dy;
            if (this.game.getBlock(cx, checkY, cz)) {
                groundY = checkY + 1;
                break;
            }
        }

        const dist = y - groundY;

        if (this.velocity.y <= 0 && dist < 1.0 && dist >= -0.5) {
            // Land
            if (!this.onGround) {
                // Just landed
                this.onGround = true;
                this.velocity.y = 0;
                this.position.y = groundY;
            } else {
                // Stay on ground
                this.position.y = groundY;
                this.velocity.y = 0;
            }
        } else {
            if (dist > 1.5) {
                this.onGround = false;
            }
        }
    }

    dispose() {
        // Clean up fire particles
        for (const particle of this.fireParticles) {
            this.fireGroup.remove(particle.mesh);
            particle.mesh.geometry.dispose();
            particle.mesh.material.dispose();
        }
        this.fireParticles = [];
        this.game.scene.remove(this.fireGroup);
    }
}
