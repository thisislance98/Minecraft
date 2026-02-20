import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Hippopotamus extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 1.3;
        this.height = 1.4;
        this.depth = 2.4;
        this.speed = 2.0;
        this.createBody();
    }

    createBody() {
        const skinColor = 0x5D4C5D; // Purple-greyish
        const bellyColor = 0x7A6B7A; // Lighter belly
        const teethColor = 0xF0F0DD;

        const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });
        const bellyMat = new THREE.MeshLambertMaterial({ color: bellyColor });
        const teethMat = new THREE.MeshLambertMaterial({ color: teethColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body - huge barrel
        const bodyGeo = new THREE.BoxGeometry(1.6, 1.1, 2.4);
        const body = new THREE.Mesh(bodyGeo, skinMat);
        body.position.set(0, 1.0, 0);
        this.mesh.add(body);

        // Head - Big blocky head
        const headGeo = new THREE.BoxGeometry(1.1, 1.0, 1.4);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 1.3, 1.7);
        this.mesh.add(head);

        // Snout/Mouth - Wide
        const snoutGeo = new THREE.BoxGeometry(1.2, 0.5, 0.8);
        const snout = new THREE.Mesh(snoutGeo, bellyMat);
        snout.position.set(0, 0.9, 2.2); // Lower part of head
        this.mesh.add(snout);

        // Teeth
        const toothGeo = new THREE.BoxGeometry(0.1, 0.2, 0.1);
        const leftTooth = new THREE.Mesh(toothGeo, teethMat);
        leftTooth.position.set(-0.4, 0.8, 2.6);
        this.mesh.add(leftTooth);

        const rightTooth = new THREE.Mesh(toothGeo, teethMat);
        rightTooth.position.set(0.4, 0.8, 2.6);
        this.mesh.add(rightTooth);

        // Ears - tiny
        const earGeo = new THREE.BoxGeometry(0.15, 0.15, 0.1);
        const leftEar = new THREE.Mesh(earGeo, skinMat);
        leftEar.position.set(-0.4, 1.85, 1.4);
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, skinMat);
        rightEar.position.set(0.4, 1.85, 1.4);
        this.mesh.add(rightEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.56, 1.6, 1.6);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.56, 1.6, 1.6);
        this.mesh.add(rightEye);

        // Legs - Short and thick
        const legW = 0.4;
        const legH = 0.7;
        const legGeo = new THREE.BoxGeometry(legW, legH, legW);

        const makeLeg = (x, z) => {
            const group = new THREE.Group();
            group.position.set(x, 0.4, z); // Knee height

            const leg = new THREE.Mesh(legGeo, skinMat);
            leg.position.y = -legH / 2;
            group.add(leg);

            this.mesh.add(group);
            return group;
        };

        this.legParts = [
            makeLeg(-0.5, 0.9),
            makeLeg(0.5, 0.9),
            makeLeg(-0.5, -0.9),
            makeLeg(0.5, -0.9)
        ];
    }
}
