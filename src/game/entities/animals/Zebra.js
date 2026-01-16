import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Zebra extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.8;
        this.height = 1.2;
        this.depth = 1.6;
        this.speed = 4.0;
        this.legSwingSpeed = 10;
        this.createBody();
        this.mesh.scale.set(0.75, 0.75, 0.75);
    }

    createBody() {
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

        // Body - striped pattern using multiple slices
        const bodyLength = 1.4;
        const sliceCount = 10;
        const sliceLength = bodyLength / sliceCount;

        for (let i = 0; i < sliceCount; i++) {
            const mat = i % 2 === 0 ? whiteMat : blackMat;
            const slice = new THREE.Mesh(
                new THREE.BoxGeometry(0.9, 0.8, sliceLength),
                mat
            );
            slice.position.set(0, 1.1, -bodyLength / 2 + i * sliceLength + sliceLength / 2);
            this.mesh.add(slice);
        }

        // Neck
        const neckGeo = new THREE.BoxGeometry(0.4, 0.7, 0.4);
        const neck = new THREE.Mesh(neckGeo, whiteMat);
        neck.position.set(0, 1.5, 0.7);
        neck.rotation.x = Math.PI / 4;
        this.mesh.add(neck);

        // Head
        const headGeo = new THREE.BoxGeometry(0.55, 0.55, 1.0);
        const head = new THREE.Mesh(headGeo, whiteMat);
        head.position.set(0, 1.9, 1.15);
        head.rotation.x = Math.PI / 6;
        this.mesh.add(head);

        // Muzzle stripe
        const muzzleStripe = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.3), blackMat);
        muzzleStripe.position.set(0, 1.85, 1.4);
        this.mesh.add(muzzleStripe);

        // Ears (black tipped)
        const earGeo = new THREE.BoxGeometry(0.12, 0.25, 0.1);
        const leftEar = new THREE.Mesh(earGeo, whiteMat);
        leftEar.position.set(-0.2, 2.35, 0.85);
        this.mesh.add(leftEar);
        const leftEarTip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.1), blackMat);
        leftEarTip.position.set(-0.2, 2.5, 0.85);
        this.mesh.add(leftEarTip);

        const rightEar = new THREE.Mesh(earGeo, whiteMat);
        rightEar.position.set(0.2, 2.35, 0.85);
        this.mesh.add(rightEar);
        const rightEarTip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.1), blackMat);
        rightEarTip.position.set(0.2, 2.5, 0.85);
        this.mesh.add(rightEarTip);

        // Mane (alternating black stripes)
        for (let i = 0; i < 5; i++) {
            const maneMat = i % 2 === 0 ? blackMat : whiteMat;
            const mane = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.15), maneMat);
            mane.position.set(0, 1.9 - i * 0.12, 0.7 - i * 0.08);
            this.mesh.add(mane);
        }

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.12, 0.12);
        const leftEye = new THREE.Mesh(eyeGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }));
        leftEye.position.set(-0.28, 2.0, 1.35);
        this.mesh.add(leftEye);
        const leftPupil = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.08), new THREE.MeshLambertMaterial({ color: 0x111111 }));
        leftPupil.position.set(-0.31, 2.0, 1.38);
        this.mesh.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }));
        rightEye.position.set(0.28, 2.0, 1.35);
        this.mesh.add(rightEye);
        const rightPupil = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.08), new THREE.MeshLambertMaterial({ color: 0x111111 }));
        rightPupil.position.set(0.31, 2.0, 1.38);
        this.mesh.add(rightPupil);

        // Tail with black tuft
        const tailPivot = new THREE.Group();
        tailPivot.position.set(0, 1.3, -0.7);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), whiteMat);
        tail.position.set(0, -0.25, 0);
        tailPivot.add(tail);
        const tailTuft = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.15), blackMat);
        tailTuft.position.set(0, -0.55, 0);
        tailPivot.add(tailTuft);
        tailPivot.rotation.x = 0.3;
        this.mesh.add(tailPivot);
        this.tailPivot = tailPivot;

        // Legs with stripes
        const legGeo = new THREE.BoxGeometry(0.3, 0.9, 0.3);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.9, z);

            // Main leg (white)
            const leg = new THREE.Mesh(legGeo, whiteMat);
            leg.position.set(0, -0.45, 0);
            pivot.add(leg);

            // Black stripes on leg
            for (let i = 0; i < 3; i++) {
                const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.32), blackMat);
                stripe.position.set(0, -0.2 - i * 0.25, 0);
                pivot.add(stripe);
            }

            // Black hoof
            const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.32), blackMat);
            hoof.position.set(0, -0.9, 0);
            pivot.add(hoof);

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
        if (this.tailPivot) {
            const tailSwing = Math.sin(this.animTime * 0.5) * 0.2;
            this.tailPivot.rotation.z = tailSwing;
        }
    }
}
