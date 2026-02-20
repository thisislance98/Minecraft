import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Deer extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.7;
        this.height = 1.3;
        this.depth = 1.0;
        this.speed = 3.5;
        this.createBody();
        this.mesh.scale.set(0.8, 0.8, 0.8);
    }

    createBody() {
        // Deer: Brown with lighter details
        const bodyColor = 0x8B4513; // SaddleBrown
        const mat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const lightMat = new THREE.MeshLambertMaterial({ color: 0xD2B48C }); // Tan for belly/details
        const darkMat = new THREE.MeshLambertMaterial({ color: 0x3E2723 }); // Dark for hooves/eyes
        const antlerMat = new THREE.MeshLambertMaterial({ color: 0xF5DEB3 }); // Wheat/Bone color

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.7, 0.6, 1.0);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 1.0, 0);
        this.mesh.add(body);

        // Chest/Neck base (slightly thicker)
        const chestGeo = new THREE.BoxGeometry(0.72, 0.65, 0.5);
        const chest = new THREE.Mesh(chestGeo, mat);
        chest.position.set(0, 1.02, 0.3);
        this.mesh.add(chest);

        // Neck
        const neckGeo = new THREE.BoxGeometry(0.35, 0.7, 0.35);
        const neck = new THREE.Mesh(neckGeo, mat);
        neck.position.set(0, 1.45, 0.6);
        neck.rotation.x = Math.PI / 8; // Angled forward
        this.mesh.add(neck);

        // Head
        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.7);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 1.85, 0.85);
        this.mesh.add(head);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.25, 0.15, 0.05);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.3, 2.0, 0.7);
        leftEar.rotation.z = 0.3;
        leftEar.rotation.y = -0.3;
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.3, 2.0, 0.7);
        rightEar.rotation.z = -0.3;
        rightEar.rotation.y = 0.3;
        this.mesh.add(rightEar);

        // Antlers (Simple Branching)
        const antlerStemGeo = new THREE.BoxGeometry(0.06, 0.5, 0.06);
        const antlerBranchGeo = new THREE.BoxGeometry(0.05, 0.3, 0.05);

        const makeAntler = (xDir) => {
            const group = new THREE.Group();
            group.position.set(xDir * 0.15, 2.05, 0.8);

            // Main stem
            const stem = new THREE.Mesh(antlerStemGeo, antlerMat);
            stem.rotation.z = xDir * 0.4;
            stem.rotation.x = -0.2;
            group.add(stem);

            // Branch 1 (Forward)
            const b1 = new THREE.Mesh(antlerBranchGeo, antlerMat);
            b1.position.set(xDir * 0.1, 0.2, 0.1);
            b1.rotation.x = Math.PI / 4;
            group.add(b1);

            // Branch 2 (Upish)
            const b2 = new THREE.Mesh(antlerBranchGeo, antlerMat);
            b2.position.set(xDir * 0.2, 0.3, 0);
            b2.rotation.z = xDir * 0.6;
            group.add(b2);

            this.mesh.add(group);
        };

        makeAntler(1);
        makeAntler(-1);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);

        const leftEye = new THREE.Mesh(eyeGeo, darkMat);
        leftEye.position.set(-0.21, 1.9, 0.9);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, darkMat);
        rightEye.position.set(0.21, 1.9, 0.9);
        this.mesh.add(rightEye);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.15, 0.1, 0.05);
        const nose = new THREE.Mesh(noseGeo, darkMat);
        nose.position.set(0, 1.75, 1.21);
        this.mesh.add(nose);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.15, 0.2, 0.1);
        const tail = new THREE.Mesh(tailGeo, lightMat); // White tail
        tail.position.set(0, 1.1, -0.5);
        tail.rotation.x = 0.5;
        this.mesh.add(tail);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.2, 0.9, 0.2);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.9, z);

            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.45, 0);
            pivot.add(leg);

            // Hoof
            const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2), darkMat);
            hoof.position.set(0, -0.9, 0);
            pivot.add(hoof);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.2, 0.35),
            makeLeg(0.2, 0.35),
            makeLeg(-0.2, -0.35),
            makeLeg(0.2, -0.35)
        ];

        this.fleeOnProximity = true;
        this.fleeRange = 12.0;
    }
}
