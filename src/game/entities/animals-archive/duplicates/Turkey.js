import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Turkey extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.6;
        this.height = 0.8;
        this.depth = 0.6;
        this.speed = 1.2;
        this.createBody();
    }

    createBody() {
        // Turkey Colors
        const featherColor = 0x3E2723; // Dark Brown
        const wattleColor = 0xD32F2F; // Red
        const beakColor = 0xFFC107; // Amber/Yellow
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const featherMat = new THREE.MeshLambertMaterial({ color: featherColor });
        const wattleMat = new THREE.MeshLambertMaterial({ color: wattleColor });
        const beakMat = new THREE.MeshLambertMaterial({ color: beakColor });

        // Body (Rounder/Larger than chicken)
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.5, 0.6);
        const body = new THREE.Mesh(bodyGeo, featherMat);
        body.position.set(0, 0.5, 0);
        this.mesh.add(body);

        // Neck (Longer)
        const neckGeo = new THREE.BoxGeometry(0.15, 0.3, 0.15);
        const neck = new THREE.Mesh(neckGeo, featherMat);
        neck.position.set(0, 0.8, 0.25);
        this.mesh.add(neck);

        // Head
        const headGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const head = new THREE.Mesh(headGeo, featherMat);
        head.position.set(0, 1.0, 0.25);
        this.mesh.add(head);

        // Beak
        const beakGeo = new THREE.BoxGeometry(0.08, 0.08, 0.1);
        const beak = new THREE.Mesh(beakGeo, beakMat);
        beak.position.set(0, 1.0, 0.38);
        this.mesh.add(beak);

        // Wattle/Snood (Red hanging thing)
        const wattleGeo = new THREE.BoxGeometry(0.05, 0.15, 0.05);
        const wattle = new THREE.Mesh(wattleGeo, wattleMat);
        wattle.position.set(0, 0.95, 0.36);
        this.mesh.add(wattle);

        // Tail Fan (The distinct feature)
        const tailGeo = new THREE.BoxGeometry(0.8, 0.6, 0.1);
        const tail = new THREE.Mesh(tailGeo, featherMat);
        tail.position.set(0, 0.7, -0.3);
        // Tilt it back a bit
        tail.rotation.x = -Math.PI / 6;
        this.mesh.add(tail);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);

        // Left Eye
        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.1, 1.05, 0.3);
        this.mesh.add(leftEye);

        // Right Eye
        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.1, 1.05, 0.3);
        this.mesh.add(rightEye);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.08, 0.4, 0.08);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.4, z);
            const leg = new THREE.Mesh(legGeo, beakMat); // Yellowish legs
            leg.position.set(0, -0.2, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.15, 0.0),
            makeLeg(0.15, 0.0)
        ];
    }
}
