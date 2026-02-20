import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Tiger extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.8;
        this.height = 1.1;
        this.depth = 1.6;
        this.speed = 4.5;
        this.createBody();
    }

    createBody() {
        // Tiger: Orange with Stripes
        const furColor = 0xFF8C00; // Dark Orange
        const stripeColor = 0x111111; // Dark Gray/Black
        const whiteColor = 0xFFFFFF; // Belly/Jaw

        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const stripeMat = new THREE.MeshLambertMaterial({ color: stripeColor });
        const whiteMat = new THREE.MeshLambertMaterial({ color: whiteColor });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.8, 0.8, 1.6);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.8, 0);
        this.mesh.add(body);

        // Stripes on body (Simulated with thin rings/boxes)
        const makeStripe = (z) => {
            const stripeGeo = new THREE.BoxGeometry(0.82, 0.82, 0.1);
            const stripe = new THREE.Mesh(stripeGeo, stripeMat);
            stripe.position.set(0, 0.8, z);
            this.mesh.add(stripe);
        };
        makeStripe(-0.5);
        makeStripe(0);
        makeStripe(0.5);

        // Head
        const headGeo = new THREE.BoxGeometry(0.7, 0.6, 0.7);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 1.3, 1.0);
        this.mesh.add(head);

        // Muzzle (White)
        const muzzleGeo = new THREE.BoxGeometry(0.35, 0.2, 0.2);
        const muzzle = new THREE.Mesh(muzzleGeo, whiteMat);
        muzzle.position.set(0, 1.15, 1.4);
        this.mesh.add(muzzle);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.1, 0.08, 0.05);
        const nose = new THREE.Mesh(noseGeo, stripeMat);
        nose.position.set(0, 1.25, 1.5);
        this.mesh.add(nose);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.15, 0.15, 0.05);
        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.25, 1.65, 0.9);
        this.mesh.add(leftEar);
        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.25, 1.65, 0.9);
        this.mesh.add(rightEar);

        // Eyes
        // Use small boxes
        const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), whiteMat);
        leftEye.position.set(-0.2, 1.4, 1.35);
        this.mesh.add(leftEye);
        const leftPupil = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.06), stripeMat);
        leftPupil.position.set(-0.2, 1.4, 1.37);
        this.mesh.add(leftPupil);

        const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), whiteMat);
        rightEye.position.set(0.2, 1.4, 1.35);
        this.mesh.add(rightEye);
        const rightPupil = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.06), stripeMat);
        rightPupil.position.set(0.2, 1.4, 1.37);
        this.mesh.add(rightPupil);

        // Tail (Striped)
        const tailGeo = new THREE.BoxGeometry(0.1, 0.1, 1.2);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 0.9, -1.0);
        tail.rotation.x = -0.3;
        this.mesh.add(tail);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.8, z);
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.4, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.3, 0.6),
            makeLeg(0.3, 0.6),
            makeLeg(-0.3, -0.6),
            makeLeg(0.3, -0.6)
        ];
    }
}
