import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class YellowDuck extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.6;
        this.height = 0.8;
        this.depth = 0.8;
        this.speed = 1.5;
        this.createBody();
        this.mesh.scale.set(0.75, 0.75, 0.75);
    }

    createBody() {
        const bodyColor = 0xFFFF00; // Yellow
        const beakColor = 0xFF8C00; // Dark Orange
        const footColor = 0xFFA500; // Orange

        const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const beakMat = new THREE.MeshLambertMaterial({ color: beakColor });
        const footMat = new THREE.MeshLambertMaterial({ color: footColor });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.6, 0.4, 0.6);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0.6, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.set(0, 0.9, 0);
        this.mesh.add(head);

        // Beak
        const beakGeo = new THREE.BoxGeometry(0.1, 0.2, 0.4);
        const beak = new THREE.Mesh(beakGeo, beakMat);
        beak.position.set(0, 0.8, 0.4);
        this.mesh.add(beak);

        // Eyes
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 }); // Black
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.12, 0.95, 0.18);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.12, 0.95, 0.18);
        this.mesh.add(rightEye);

        // Feet
        const footGeo = new THREE.BoxGeometry(0.1, 0.1, 0.3);

        const leftFoot = new THREE.Mesh(footGeo, footMat);
        leftFoot.position.set(-0.2, 0.2, 0);
        leftFoot.rotation.x = Math.PI / 4; // Angled
        this.mesh.add(leftFoot);

        const rightFoot = new THREE.Mesh(footGeo, footMat);
        rightFoot.position.set(0.2, 0.2, 0);
        rightFoot.rotation.x = Math.PI / 4; // Angled
        this.mesh.add(rightFoot);

        this.legParts = [leftFoot, rightFoot];
    }
}
