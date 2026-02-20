import * as THREE from 'three';
import { Animal } from '../Animal.js';
import { Mouse } from './Mouse.js';

export class FennecFox extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.35;
        this.height = 0.45;
        this.depth = 0.8;
        this.speed = 5.0; // Fast and nimble
        this.createBody();
        this.attackTimer = 0;
        this.mesh.scale.set(0.85, 0.85, 0.85); // Slightly smaller than regular fox
    }

    createBody() {
        // Fennec Fox: Sandy/cream colored with GIANT ears
        const furColor = 0xF5DEB3; // Wheat/sandy color
        const creamColor = 0xFFFACD; // Light cream
        const pinkInner = 0xFFB6C1; // Light pink for ear insides
        const blackColor = 0x1A1A1A;

        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const creamMat = new THREE.MeshLambertMaterial({ color: creamColor });
        const pinkMat = new THREE.MeshLambertMaterial({ color: pinkInner });
        const blackMat = new THREE.MeshLambertMaterial({ color: blackColor });

        // Body (smaller, compact)
        const bodyGeo = new THREE.BoxGeometry(0.35, 0.35, 0.7);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.4, 0);
        this.mesh.add(body);

        // Belly (cream colored)
        const bellyGeo = new THREE.BoxGeometry(0.3, 0.15, 0.5);
        const belly = new THREE.Mesh(bellyGeo, creamMat);
        belly.position.set(0, 0.28, 0);
        this.mesh.add(belly);

        // Neck/Chest
        const chestGeo = new THREE.BoxGeometry(0.34, 0.3, 0.2);
        const chest = new THREE.Mesh(chestGeo, mat);
        chest.position.set(0, 0.45, 0.35);
        this.mesh.add(chest);

        // Head (rounder, cuter)
        const headGeo = new THREE.BoxGeometry(0.35, 0.32, 0.38);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.65, 0.5);
        this.mesh.add(head);

        // Snout (shorter, cuter)
        const snoutGeo = new THREE.BoxGeometry(0.15, 0.12, 0.2);
        const snout = new THREE.Mesh(snoutGeo, mat);
        snout.position.set(0, 0.58, 0.72);
        this.mesh.add(snout);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.08, 0.06, 0.04);
        const nose = new THREE.Mesh(noseGeo, blackMat);
        nose.position.set(0, 0.6, 0.83);
        this.mesh.add(nose);

        // GIANT EARS - The defining feature of fennec foxes!
        // Ears are almost as big as the head!
        const earGeo = new THREE.BoxGeometry(0.18, 0.55, 0.12); // GIANT!
        const earInnerGeo = new THREE.BoxGeometry(0.12, 0.45, 0.08);

        // Left ear
        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.12, 1.05, 0.45);
        leftEar.rotation.z = 0.15;
        leftEar.rotation.x = -0.1;
        this.mesh.add(leftEar);

        // Left ear inner (pink)
        const leftEarInner = new THREE.Mesh(earInnerGeo, pinkMat);
        leftEarInner.position.set(-0.12, 1.02, 0.48);
        leftEarInner.rotation.z = 0.15;
        leftEarInner.rotation.x = -0.1;
        this.mesh.add(leftEarInner);

        // Right ear
        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.12, 1.05, 0.45);
        rightEar.rotation.z = -0.15;
        rightEar.rotation.x = -0.1;
        this.mesh.add(rightEar);

        // Right ear inner (pink)
        const rightEarInner = new THREE.Mesh(earInnerGeo, pinkMat);
        rightEarInner.position.set(0.12, 1.02, 0.48);
        rightEarInner.rotation.z = -0.15;
        rightEarInner.rotation.x = -0.1;
        this.mesh.add(rightEarInner);

        // Big expressive eyes
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const pupilGeo = new THREE.BoxGeometry(0.06, 0.08, 0.05);

        // Dark, large eyes
        const leftEye = new THREE.Mesh(eyeGeo, new THREE.MeshLambertMaterial({ color: 0x2E1A0B })); // Dark brown
        leftEye.position.set(-0.1, 0.7, 0.7);
        this.mesh.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.1, 0.7, 0.73);
        this.mesh.add(leftPupil);

        // Eye shine
        const shineGeo = new THREE.BoxGeometry(0.02, 0.02, 0.02);
        const shineMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const leftShine = new THREE.Mesh(shineGeo, shineMat);
        leftShine.position.set(-0.08, 0.72, 0.74);
        this.mesh.add(leftShine);

        const rightEye = new THREE.Mesh(eyeGeo, new THREE.MeshLambertMaterial({ color: 0x2E1A0B }));
        rightEye.position.set(0.1, 0.7, 0.7);
        this.mesh.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.1, 0.7, 0.73);
        this.mesh.add(rightPupil);

        const rightShine = new THREE.Mesh(shineGeo, shineMat);
        rightShine.position.set(0.12, 0.72, 0.74);
        this.mesh.add(rightShine);

        // Fluffy tail with dark tip
        const tailGeo = new THREE.BoxGeometry(0.15, 0.18, 0.55);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 0.5, -0.55);
        tail.rotation.x = 0.5;
        this.mesh.add(tail);

        // Tail dark tip
        const tailTipGeo = new THREE.BoxGeometry(0.12, 0.15, 0.15);
        const tailTip = new THREE.Mesh(tailTipGeo, new THREE.MeshLambertMaterial({ color: 0x8B4513 }));
        tailTip.position.set(0, 0.62, -0.8);
        tailTip.rotation.x = 0.5;
        this.mesh.add(tailTip);

        // Small delicate legs
        const legGeo = new THREE.BoxGeometry(0.1, 0.3, 0.1);
        const pawGeo = new THREE.BoxGeometry(0.1, 0.08, 0.12);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.3, z);

            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.15, 0);
            pivot.add(leg);

            // Cream paws
            const paw = new THREE.Mesh(pawGeo, creamMat);
            paw.position.set(0, -0.3, 0);
            pivot.add(paw);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.1, 0.25),
            makeLeg(0.1, 0.25),
            makeLeg(-0.1, -0.25),
            makeLeg(0.1, -0.25)
        ];

        // Fennec foxes are shy and will flee from players
        this.fleeOnProximity = true;
        this.fleeRange = 8.0;
    }

    updateAI(dt) {
        // Fennec foxes are mostly nocturnal hunters, hunt mice
        // But they're shy so check flee first
        const player = this.game.player;
        if (player) {
            const distToPlayer = this.position.distanceTo(player.position);
            if (distToPlayer < this.fleeRange) {
                // Flee from player - they're shy!
                this.state = 'flee';
                const dir = new THREE.Vector3().subVectors(this.position, player.position).normalize();
                this.moveDirection.copy(dir);
                this.rotation = Math.atan2(dir.x, dir.z);
                this.isMoving = true;
                return;
            }
        }

        // Hunt mice when not fleeing
        const detectionRange = 12.0;
        const attackRange = 1.0;
        let target = null;
        let nearestDist = detectionRange * detectionRange;

        if (this.game.animals) {
            for (const animal of this.game.animals) {
                // Fennec foxes mainly hunt mice
                if (animal instanceof Mouse && !animal.isDead) {
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
            const dir = new THREE.Vector3().subVectors(target.position, this.position);
            const dist = dir.length();

            if (dist < attackRange) {
                if (this.attackTimer <= 0) {
                    target.takeDamage(100);
                    this.attackTimer = 0.5;
                }
            } else {
                dir.normalize();
                this.moveDirection.copy(dir);
                this.rotation = Math.atan2(dir.x, dir.z);
                this.isMoving = true;
            }

            if (this.attackTimer > 0) {
                this.attackTimer -= dt;
            }
        } else {
            // No prey, wander normally
            super.updateAI(dt);
        }
    }
}
