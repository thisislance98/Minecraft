import * as THREE from 'three';
import { Animal } from '../Animal.js';
import { Bunny } from './Bunny.js';

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
        leftEarPivot.position.set(-0.5, 2.6, 1.2);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.4, -0.4, 0);
        leftEarPivot.add(leftEar);

        const leftInnerEar = new THREE.Mesh(innerEarGeo, pinkMat);
        leftInnerEar.position.set(-0.35, -0.4, 0);
        leftEarPivot.add(leftInnerEar);

        leftEarPivot.rotation.z = 0.3; // Flop outward
        this.mesh.add(leftEarPivot);
        this.leftEarPivot = leftEarPivot;

        // Right Ear
        const rightEarPivot = new THREE.Group();
        rightEarPivot.position.set(0.5, 2.6, 1.2);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.4, -0.4, 0);
        rightEarPivot.add(rightEar);

        const rightInnerEar = new THREE.Mesh(innerEarGeo, pinkMat);
        rightInnerEar.position.set(0.35, -0.4, 0);
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
