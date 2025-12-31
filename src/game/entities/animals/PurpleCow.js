import { Animal } from '../Animal.js';
import * as THREE from 'three';

export class PurpleCow extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.9;
        this.height = 1.3;
        this.depth = 1.6;
        this.createBody();
    }

    createBody() {
        const purpleMat = new THREE.MeshLambertMaterial({ color: 0x800080 });
        const darkPurpleMat = new THREE.MeshLambertMaterial({ color: 0x4B0082 });
        const hornMat = new THREE.MeshLambertMaterial({ color: 0xEEEEEE });
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.4), purpleMat);
        body.position.set(0, 0.7, 0);
        this.mesh.add(body);

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), purpleMat);
        head.position.set(0, 1.1, 0.8);
        this.mesh.add(head);

        // Snout
        const snout = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.2), darkPurpleMat);
        snout.position.set(0, 1.0, 1.15);
        this.mesh.add(snout);

        // Horns
        const leftHorn = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), hornMat);
        leftHorn.position.set(0.25, 1.45, 0.8);
        this.mesh.add(leftHorn);

        const rightHorn = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), hornMat);
        rightHorn.position.set(-0.25, 1.45, 0.8);
        this.mesh.add(rightHorn);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.3, 0.6, 0.3);
        const legPositions = [
            [0.25, 0.3, 0.45],   // Front Right
            [-0.25, 0.3, 0.45],  // Front Left
            [0.25, 0.3, -0.45],  // Back Right
            [-0.25, 0.3, -0.45]  // Back Left
        ];

        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeo, purpleMat);
            leg.position.set(...pos);
            this.mesh.add(leg);
        });
        
        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(0.31, 1.2, 1.0);
        this.mesh.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(-0.31, 1.2, 1.0);
        this.mesh.add(rightEye);
    }
}
