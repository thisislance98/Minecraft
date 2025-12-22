import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Toucan extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.5;
        this.height = 0.6;
        this.depth = 0.4;
        this.speed = 3.0;
        this.jumpForce = 10;
        this.createBody();
        this.mesh.scale.set(0.7, 0.7, 0.7);

        // Flying behavior
        this.isFlying = false;
        this.flyTimer = 0;
        this.flapSpeed = 0;
        this.targetHeight = 0;
        this.perchTimer = 0;
        this.inTree = false;

        // Toucan likes to perch in trees
        this.preferredHeight = 6 + Math.random() * 8;
    }

    createBody() {
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const yellowMat = new THREE.MeshLambertMaterial({ color: 0xFFD700 }); // Golden yellow
        const orangeMat = new THREE.MeshLambertMaterial({ color: 0xFF6B00 }); // Orange
        const redMat = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
        const greenMat = new THREE.MeshLambertMaterial({ color: 0x00AA00 });
        const blueMat = new THREE.MeshLambertMaterial({ color: 0x0066FF });

        // Body (black, plump)
        const bodyGeo = new THREE.BoxGeometry(0.4, 0.5, 0.35);
        const body = new THREE.Mesh(bodyGeo, blackMat);
        body.position.set(0, 0.35, 0);
        this.mesh.add(body);

        // White chest
        const chestGeo = new THREE.BoxGeometry(0.38, 0.35, 0.1);
        const chest = new THREE.Mesh(chestGeo, whiteMat);
        chest.position.set(0, 0.3, 0.18);
        this.mesh.add(chest);

        // Yellow border around chest
        const borderGeo = new THREE.BoxGeometry(0.42, 0.04, 0.12);
        const borderTop = new THREE.Mesh(borderGeo, yellowMat);
        borderTop.position.set(0, 0.48, 0.18);
        this.mesh.add(borderTop);

        // Red under-tail feathers
        const tailUnderGeo = new THREE.BoxGeometry(0.25, 0.08, 0.1);
        const tailUnder = new THREE.Mesh(tailUnderGeo, redMat);
        tailUnder.position.set(0, 0.12, -0.1);
        this.mesh.add(tailUnder);

        // Head
        const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.3);
        const head = new THREE.Mesh(headGeo, blackMat);
        head.position.set(0, 0.7, 0.1);
        this.mesh.add(head);

        // White face patch
        const facePatchGeo = new THREE.BoxGeometry(0.3, 0.2, 0.05);
        const facePatch = new THREE.Mesh(facePatchGeo, whiteMat);
        facePatch.position.set(0, 0.65, 0.26);
        this.mesh.add(facePatch);

        // Eyes (blue ring around black pupil)
        const eyeRingGeo = new THREE.BoxGeometry(0.1, 0.1, 0.02);
        const leftEyeRing = new THREE.Mesh(eyeRingGeo, blueMat);
        leftEyeRing.position.set(-0.1, 0.72, 0.27);
        this.mesh.add(leftEyeRing);

        const rightEyeRing = new THREE.Mesh(eyeRingGeo, blueMat);
        rightEyeRing.position.set(0.1, 0.72, 0.27);
        this.mesh.add(rightEyeRing);

        const pupilGeo = new THREE.BoxGeometry(0.05, 0.05, 0.03);
        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.1, 0.72, 0.28);
        this.mesh.add(leftPupil);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.1, 0.72, 0.28);
        this.mesh.add(rightPupil);

        // THE FAMOUS BEAK! (Large, colorful, curved)
        // Beak base (orange)
        const beakBaseGeo = new THREE.BoxGeometry(0.2, 0.2, 0.5);
        const beakBase = new THREE.Mesh(beakBaseGeo, orangeMat);
        beakBase.position.set(0, 0.6, 0.5);
        this.mesh.add(beakBase);

        // Beak tip (yellow-green gradient effect)
        const beakTipGeo = new THREE.BoxGeometry(0.15, 0.15, 0.2);
        const beakTip = new THREE.Mesh(beakTipGeo, yellowMat);
        beakTip.position.set(0, 0.58, 0.72);
        this.mesh.add(beakTip);

        // Beak ridge (darker orange/red)
        const beakRidgeGeo = new THREE.BoxGeometry(0.18, 0.05, 0.45);
        const beakRidge = new THREE.Mesh(beakRidgeGeo, redMat);
        beakRidge.position.set(0, 0.72, 0.5);
        this.mesh.add(beakRidge);

        // Green stripe on beak
        const beakStripeGeo = new THREE.BoxGeometry(0.21, 0.03, 0.3);
        const beakStripe = new THREE.Mesh(beakStripeGeo, greenMat);
        beakStripe.position.set(0, 0.55, 0.5);
        this.mesh.add(beakStripe);

        // Black tip
        const beakBlackGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const beakBlack = new THREE.Mesh(beakBlackGeo, blackMat);
        beakBlack.position.set(0, 0.58, 0.82);
        this.mesh.add(beakBlack);

        // Wings
        const wingGeo = new THREE.BoxGeometry(0.08, 0.35, 0.25);

        this.leftWing = new THREE.Mesh(wingGeo, blackMat);
        this.leftWing.position.set(-0.25, 0.4, 0);
        this.mesh.add(this.leftWing);

        this.rightWing = new THREE.Mesh(wingGeo, blackMat);
        this.rightWing.position.set(0.25, 0.4, 0);
        this.mesh.add(this.rightWing);

        // Tail feathers (black, long)
        const tailGeo = new THREE.BoxGeometry(0.2, 0.08, 0.4);
        const tail = new THREE.Mesh(tailGeo, blackMat);
        tail.position.set(0, 0.35, -0.35);
        tail.rotation.x = -0.2;
        this.mesh.add(tail);

        // Feet (orange/gray)
        const footGeo = new THREE.BoxGeometry(0.08, 0.15, 0.12);
        const grayMat = new THREE.MeshLambertMaterial({ color: 0x555555 });

        const leftFoot = new THREE.Mesh(footGeo, grayMat);
        leftFoot.position.set(-0.1, 0.08, 0.05);
        this.mesh.add(leftFoot);

        const rightFoot = new THREE.Mesh(footGeo, grayMat);
        rightFoot.position.set(0.1, 0.08, 0.05);
        this.mesh.add(rightFoot);

        this.legParts = [this.leftWing, this.rightWing];
    }

    isTreeBlock(block) {
        if (!block) return false;
        return block.type.includes('leaves') || block.type.includes('wood') || block.type.includes('log');
    }

    findNearestTree() {
        const pos = this.position;
        const searchRadius = 20;
        let nearest = null;
        let nearestDist = Infinity;

        for (let dx = -searchRadius; dx <= searchRadius; dx += 3) {
            for (let dz = -searchRadius; dz <= searchRadius; dz += 3) {
                for (let dy = 5; dy < 25; dy++) {
                    const block = this.game.getBlock(
                        Math.floor(pos.x + dx),
                        Math.floor(pos.y + dy),
                        Math.floor(pos.z + dz)
                    );
                    if (block && block.type.includes('leaves')) {
                        const dist = Math.sqrt(dx * dx + dz * dz);
                        if (dist < nearestDist && dist > 2) {
                            nearestDist = dist;
                            nearest = new THREE.Vector3(
                                Math.floor(pos.x + dx) + 0.5,
                                Math.floor(pos.y + dy) + 1,
                                Math.floor(pos.z + dz) + 0.5
                            );
                        }
                        break;
                    }
                }
            }
        }
        return nearest;
    }

    updateAI(dt) {
        this.flyTimer -= dt;
        this.perchTimer -= dt;

        // Check if on tree
        const blockBelow = this.game.getBlock(
            Math.floor(this.position.x),
            Math.floor(this.position.y - 0.5),
            Math.floor(this.position.z)
        );
        this.inTree = this.isTreeBlock(blockBelow);

        if (this.isFlying) {
            // Flying behavior
            if (this.flyTimer <= 0 || this.inTree) {
                this.isFlying = false;
                this.perchTimer = 5 + Math.random() * 10;
            }
            this.isMoving = true;
            this.state = 'fly';
        } else {
            // Perching/idle behavior
            if (this.perchTimer <= 0) {
                // Time to fly!
                this.isFlying = true;
                this.flyTimer = 3 + Math.random() * 5;
                this.targetHeight = this.position.y + 5 + Math.random() * 10;

                // Find a tree to fly to
                const tree = this.findNearestTree();
                if (tree) {
                    const dir = tree.clone().sub(this.position).normalize();
                    this.moveDirection.copy(dir);
                    this.rotation = Math.atan2(dir.x, dir.z);
                } else {
                    // Random direction
                    this.rotation = Math.random() * Math.PI * 2;
                    this.moveDirection.set(
                        Math.sin(this.rotation),
                        0.5,
                        Math.cos(this.rotation)
                    );
                }
            } else {
                // Perching, occasionally look around
                if (Math.random() < 0.01) {
                    this.rotation += (Math.random() - 0.5) * 1;
                }
                this.state = 'idle';
                this.isMoving = false;
            }
        }
    }

    updatePhysics(dt) {
        const pos = this.position;

        if (this.isFlying) {
            // Flying physics
            const speed = this.speed * 1.5;
            pos.x += this.moveDirection.x * speed * dt;
            pos.z += this.moveDirection.z * speed * dt;

            // Gentle ascent/descent to target height
            const heightDiff = this.targetHeight - pos.y;
            pos.y += Math.sign(heightDiff) * Math.min(Math.abs(heightDiff), 3) * dt;

            // Clamp minimum height
            const terrainY = this.game.worldGen.getTerrainHeight(pos.x, pos.z);
            if (pos.y < terrainY + 3) {
                pos.y = terrainY + 3;
            }

            // Apply slight wave motion
            pos.y += Math.sin(this.animTime * 3) * 0.3 * dt;

            this.onGround = false;
        } else {
            // Standard walking/perching physics
            super.updatePhysics(dt);
        }
    }

    updateAnimation(dt) {
        this.animTime += dt * 10;

        if (this.isFlying) {
            // Wing flapping
            const flapAngle = Math.sin(this.animTime * 3) * 0.8;
            this.leftWing.rotation.z = flapAngle;
            this.rightWing.rotation.z = -flapAngle;
        } else {
            // Wings folded
            this.leftWing.rotation.z = 0;
            this.rightWing.rotation.z = 0;
        }
    }
}
