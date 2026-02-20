import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class TigerBear extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.6;
        this.height = 0.8;
        this.depth = 1.0;
        this.speed = 4.0;
        this.createBody();
        this.mesh.scale.set(0.6, 0.6, 0.6); // Small bear body
    }

    createBody() {
        // TigerBear: Orange with black stripes (tiger colors)
        const furColor = 0xFF8C00; // Dark Orange (tiger)
        const stripeColor = 0x111111; // Dark Gray/Black (tiger stripes)
        const muzzleColor = 0xFFFFFF; // White muzzle
        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const muzzleMat = new THREE.MeshLambertMaterial({ color: muzzleColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: stripeColor });
        const tailMat = new THREE.MeshLambertMaterial({ color: 0xDDA0DD }); // Pink mouse tail

        // Body (bear-shaped but smaller)
        const bodyGeo = new THREE.BoxGeometry(1.2, 1.1, 1.8);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 1.1, 0);
        this.mesh.add(body);

        // Tiger stripes on body
        const makeStripe = (z) => {
            const stripeGeo = new THREE.BoxGeometry(1.22, 1.12, 0.12);
            const stripe = new THREE.Mesh(stripeGeo, blackMat);
            stripe.position.set(0, 1.1, z);
            this.mesh.add(stripe);
        };
        makeStripe(-0.6);
        makeStripe(-0.2);
        makeStripe(0.3);
        makeStripe(0.7);

        // Head
        const headGeo = new THREE.BoxGeometry(0.9, 0.8, 0.9);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 1.5, 1.2);
        this.mesh.add(head);

        // Tiger stripes on head (sides)
        const headStripe1 = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.1, 0.92), blackMat);
        headStripe1.position.set(0, 1.6, 1.2);
        this.mesh.add(headStripe1);

        const headStripe2 = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.1, 0.92), blackMat);
        headStripe2.position.set(0, 1.4, 1.2);
        this.mesh.add(headStripe2);

        // Muzzle (white like tiger)
        const snoutGeo = new THREE.BoxGeometry(0.4, 0.3, 0.3);
        const snout = new THREE.Mesh(snoutGeo, muzzleMat);
        snout.position.set(0, 1.4, 1.7);
        this.mesh.add(snout);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.15, 0.1, 0.05);
        const nose = new THREE.Mesh(noseGeo, blackMat);
        nose.position.set(0, 1.5, 1.85);
        this.mesh.add(nose);

        // Ears (bear-style rounded)
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

        // WHISKERS (from mouse - multiple on each side)
        const whiskerGeo = new THREE.BoxGeometry(0.25, 0.01, 0.01);

        // Left whiskers
        const leftWhisker1 = new THREE.Mesh(whiskerGeo, blackMat);
        leftWhisker1.position.set(-0.45, 1.5, 1.7);
        leftWhisker1.rotation.z = 0.3;
        this.mesh.add(leftWhisker1);

        const leftWhisker2 = new THREE.Mesh(whiskerGeo, blackMat);
        leftWhisker2.position.set(-0.45, 1.42, 1.7);
        leftWhisker2.rotation.z = 0.1;
        this.mesh.add(leftWhisker2);

        const leftWhisker3 = new THREE.Mesh(whiskerGeo, blackMat);
        leftWhisker3.position.set(-0.45, 1.35, 1.7);
        leftWhisker3.rotation.z = -0.1;
        this.mesh.add(leftWhisker3);

        // Right whiskers
        const rightWhisker1 = new THREE.Mesh(whiskerGeo, blackMat);
        rightWhisker1.position.set(0.45, 1.5, 1.7);
        rightWhisker1.rotation.z = -0.3;
        this.mesh.add(rightWhisker1);

        const rightWhisker2 = new THREE.Mesh(whiskerGeo, blackMat);
        rightWhisker2.position.set(0.45, 1.42, 1.7);
        rightWhisker2.rotation.z = -0.1;
        this.mesh.add(rightWhisker2);

        const rightWhisker3 = new THREE.Mesh(whiskerGeo, blackMat);
        rightWhisker3.position.set(0.45, 1.35, 1.7);
        rightWhisker3.rotation.z = 0.1;
        this.mesh.add(rightWhisker3);

        // MOUSE TAIL (long and thin, pink)
        const tailGeo = new THREE.BoxGeometry(0.03, 0.03, 0.8);
        const tail = new THREE.Mesh(tailGeo, tailMat);
        tail.position.set(0, 1.1, -1.2);
        tail.rotation.x = 0.4; // Slight upward curve like mouse
        this.mesh.add(tail);

        // Thick Legs (bear-style with tiger stripes)
        const legGeo = new THREE.BoxGeometry(0.4, 0.9, 0.4);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 1.0, z);

            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.45, 0);
            pivot.add(leg);

            // Add stripe to leg
            const legStripe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.15, 0.42), blackMat);
            legStripe.position.set(0, -0.25, 0);
            pivot.add(legStripe);

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
