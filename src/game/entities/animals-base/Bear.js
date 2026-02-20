import { Animal } from './Animal.js';
import * as THREE from 'three';

export class Bear extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 1.0;
        this.height = 1.4;
        this.depth = 1.8;
        this.speed = 3.0;
        this.createBody();
    }

    createBody() {
        // Bear: Dark Brown
        const furColor = 0x4B3621;
        const muzzleColor = 0x8B7355; // Lighter brown
        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const muzzleMat = new THREE.MeshLambertMaterial({ color: muzzleColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body (Big and bulky)
        const bodyGeo = new THREE.BoxGeometry(1.2, 1.1, 1.8);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 1.1, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.9, 0.8, 0.9);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 1.5, 1.2);
        this.mesh.add(head);

        // Muzzle
        const snoutGeo = new THREE.BoxGeometry(0.4, 0.3, 0.3);
        const snout = new THREE.Mesh(snoutGeo, muzzleMat);
        snout.position.set(0, 1.4, 1.7);
        this.mesh.add(snout);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.15, 0.1, 0.05);
        const nose = new THREE.Mesh(noseGeo, blackMat);
        nose.position.set(0, 1.5, 1.85);
        this.mesh.add(nose);

        // Ears (Rounded)
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

        // Stubby Tail
        const tailGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 1.2, -0.9);
        this.mesh.add(tail);

        // Thick Legs
        const legGeo = new THREE.BoxGeometry(0.4, 0.9, 0.4);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 1.0, z);
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.45, 0);
            pivot.add(leg);
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
