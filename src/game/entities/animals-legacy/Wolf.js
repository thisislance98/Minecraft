import { Animal } from './Animal.js';
import * as THREE from 'three';

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
