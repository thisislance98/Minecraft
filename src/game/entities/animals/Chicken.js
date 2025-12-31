import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Chicken extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.5;
        this.height = 0.7;
        this.depth = 0.5;
        this.speed = 1.5;
        this.createBody();
    }

    createBody() {
        // Chicken: White
        const bodyColor = 0xFFFFFF;
        const mat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const redMat = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
        const yellowMat = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.4, 0.4, 0.5);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.4, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.2, 0.3, 0.2);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.7, 0.2);
        this.mesh.add(head);

        // Beak
        const beakGeo = new THREE.BoxGeometry(0.1, 0.05, 0.1);
        const beak = new THREE.Mesh(beakGeo, yellowMat);
        beak.position.set(0, 0.7, 0.35);
        this.mesh.add(beak);

        // Red Thing (Wattle)
        const wattleGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const wattle = new THREE.Mesh(wattleGeo, redMat);
        wattle.position.set(0, 0.6, 0.25);
        this.mesh.add(wattle);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);

        // Left Eye
        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.1, 0.78, 0.22);
        this.mesh.add(leftEye);

        // Right Eye
        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.1, 0.78, 0.22);
        this.mesh.add(rightEye);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.05, 0.3, 0.05);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.3, z);
            const leg = new THREE.Mesh(legGeo, yellowMat);
            leg.position.set(0, -0.15, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.1, 0.1),
            makeLeg(0.1, 0.1)
        ];
    }
}
