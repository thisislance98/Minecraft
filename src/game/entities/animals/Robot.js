import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Robot extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.6;
        this.height = 1.2;
        this.depth = 0.5;
        this.speed = 1.5;
        this.createBody();
    }

    createBody() {
        const metalMat = new THREE.MeshLambertMaterial({ color: 0x999999 });
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

        // Torso
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.4), metalMat);
        torso.position.y = 0.6;
        this.mesh.add(torso);

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), metalMat);
        head.position.y = 1.15;
        this.mesh.add(head);

        // Eyes
        const eyeLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), eyeMat);
        eyeLeft.position.set(-0.1, 1.2, 0.2);
        this.mesh.add(eyeLeft);

        const eyeRight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), eyeMat);
        eyeRight.position.set(0.1, 1.2, 0.2);
        this.mesh.add(eyeRight);

        // Legs
        const legGeom = new THREE.BoxGeometry(0.2, 0.4, 0.2);
        const legL = new THREE.Mesh(legGeom, metalMat);
        legL.position.set(-0.15, 0.2, 0);
        this.mesh.add(legL);

        const legR = new THREE.Mesh(legGeom, metalMat);
        legR.position.set(0.15, 0.2, 0);
        this.mesh.add(legR);

        // Arms
        const armGeom = new THREE.BoxGeometry(0.15, 0.5, 0.15);
        const armL = new THREE.Mesh(armGeom, metalMat);
        armL.position.set(-0.4, 0.7, 0);
        this.mesh.add(armL);

        const armR = new THREE.Mesh(armGeom, metalMat);
        armR.position.set(0.4, 0.7, 0);
        this.mesh.add(armR);
    }

    updateAI(dt) {
        super.updateAI(dt);
        // Add robotic jitter or specific logic here if desired
    }
}
