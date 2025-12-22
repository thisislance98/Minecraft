import * as THREE from 'three';
import { Animal } from '../Animal.js';
import { Bunny } from './Bunny.js';
import { Mouse } from './Mouse.js';
import { Chicken } from './Chicken.js';

export class Fox extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.5;
        this.height = 0.6;
        this.depth = 1.2;
        this.speed = 4.5;
        this.createBody();
        this.attackTimer = 0;
    }

    createBody() {
        // Fox: Orange-red with white accents
        const furColor = 0xD35400; // Orange-red
        const whiteFur = 0xFFFFFF;
        const blackColor = 0x1A1A1A;
        const darkOrange = 0xA04000;

        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const whiteMat = new THREE.MeshLambertMaterial({ color: whiteFur });
        const blackMat = new THREE.MeshLambertMaterial({ color: blackColor });
        const darkMat = new THREE.MeshLambertMaterial({ color: darkOrange });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.45, 1.0);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.5, 0);
        this.mesh.add(body);

        // Belly (white patch)
        const bellyGeo = new THREE.BoxGeometry(0.4, 0.2, 0.6);
        const belly = new THREE.Mesh(bellyGeo, whiteMat);
        belly.position.set(0, 0.35, 0);
        this.mesh.add(belly);

        // Neck/Chest
        const chestGeo = new THREE.BoxGeometry(0.48, 0.4, 0.3);
        const chest = new THREE.Mesh(chestGeo, mat);
        chest.position.set(0, 0.55, 0.4);
        this.mesh.add(chest);

        // Chest white bib
        const bibGeo = new THREE.BoxGeometry(0.35, 0.3, 0.08);
        const bib = new THREE.Mesh(bibGeo, whiteMat);
        bib.position.set(0, 0.45, 0.55);
        this.mesh.add(bib);

        // Head
        const headGeo = new THREE.BoxGeometry(0.4, 0.35, 0.45);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.75, 0.65);
        this.mesh.add(head);

        // Snout (elongated fox snout)
        const snoutGeo = new THREE.BoxGeometry(0.2, 0.18, 0.35);
        const snout = new THREE.Mesh(snoutGeo, mat);
        snout.position.set(0, 0.68, 0.95);
        this.mesh.add(snout);

        // Snout white marking
        const snoutWhiteGeo = new THREE.BoxGeometry(0.18, 0.1, 0.2);
        const snoutWhite = new THREE.Mesh(snoutWhiteGeo, whiteMat);
        snoutWhite.position.set(0, 0.62, 1.0);
        this.mesh.add(snoutWhite);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.1, 0.08, 0.05);
        const nose = new THREE.Mesh(noseGeo, blackMat);
        nose.position.set(0, 0.72, 1.14);
        this.mesh.add(nose);

        // Ears (triangular, pointed) - normal fox-sized ears
        const earGeo = new THREE.BoxGeometry(0.12, 0.25, 0.08);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.12, 1.0, 0.6);
        leftEar.rotation.z = 0.15;
        this.mesh.add(leftEar);

        // Left ear inner (black)
        const earInnerGeo = new THREE.BoxGeometry(0.08, 0.18, 0.05);
        const leftEarInner = new THREE.Mesh(earInnerGeo, blackMat);
        leftEarInner.position.set(-0.12, 0.97, 0.62);
        this.mesh.add(leftEarInner);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.12, 1.0, 0.6);
        rightEar.rotation.z = -0.15;
        this.mesh.add(rightEar);

        // Right ear inner (black)
        const rightEarInner = new THREE.Mesh(earInnerGeo, blackMat);
        rightEarInner.position.set(0.12, 0.97, 0.62);
        this.mesh.add(rightEarInner);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
        const pupilGeo = new THREE.BoxGeometry(0.04, 0.06, 0.05);

        const leftEye = new THREE.Mesh(eyeGeo, new THREE.MeshLambertMaterial({ color: 0xFFBF00 })); // Amber
        leftEye.position.set(-0.12, 0.8, 0.88);
        this.mesh.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.12, 0.8, 0.91);
        this.mesh.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, new THREE.MeshLambertMaterial({ color: 0xFFBF00 }));
        rightEye.position.set(0.12, 0.8, 0.88);
        this.mesh.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.12, 0.8, 0.91);
        this.mesh.add(rightPupil);

        // Fluffy tail (signature fox tail with white tip)
        const tailGeo = new THREE.BoxGeometry(0.2, 0.22, 0.8);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 0.6, -0.7);
        tail.rotation.x = 0.4;
        this.mesh.add(tail);

        // Tail white tip
        const tailTipGeo = new THREE.BoxGeometry(0.18, 0.2, 0.25);
        const tailTip = new THREE.Mesh(tailTipGeo, whiteMat);
        tailTip.position.set(0, 0.75, -1.05);
        tailTip.rotation.x = 0.4;
        this.mesh.add(tailTip);

        // Legs (black-tipped)
        const legGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
        const pawGeo = new THREE.BoxGeometry(0.15, 0.1, 0.15);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.4, z);

            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.2, 0);
            pivot.add(leg);

            // Black paw
            const paw = new THREE.Mesh(pawGeo, blackMat);
            paw.position.set(0, -0.4, 0);
            pivot.add(paw);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.15, 0.35),
            makeLeg(0.15, 0.35),
            makeLeg(-0.15, -0.35),
            makeLeg(0.15, -0.35)
        ];
    }

    updateAI(dt) {
        // Foxes hunt small prey: bunnies, mice, chickens
        const detectionRange = 15.0;
        const attackRange = 1.2;
        let target = null;
        let nearestDist = detectionRange * detectionRange;

        if (this.game.animals) {
            for (const animal of this.game.animals) {
                // Hunt bunnies, mice, and chickens
                if ((animal instanceof Bunny || animal instanceof Mouse || animal instanceof Chicken) && !animal.isDead) {
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
                // Attack prey
                if (this.attackTimer <= 0) {
                    target.takeDamage(100); // Instakill small prey
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
