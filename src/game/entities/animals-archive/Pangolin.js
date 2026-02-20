import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Pangolin extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.6;
        this.height = 0.5;
        this.depth = 1.2;
        this.speed = 1.2;
        this.createBody();
    }

    createBody() {
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const scaleMat = new THREE.MeshLambertMaterial({ color: 0x654321 });

        // Main Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.8), bodyMat);
        body.position.y = 0.2;
        body.castShadow = true;
        this.mesh.add(body);

        // Head (pointed)
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.3), bodyMat);
        head.position.set(0, 0.25, 0.5);
        this.mesh.add(head);

        // Snout
        const snout = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.2), bodyMat);
        snout.position.set(0, 0.2, 0.7);
        this.mesh.add(snout);

        // Tail (tapered)
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.6), scaleMat);
        tail.position.set(0, 0.15, -0.6);
        this.mesh.add(tail);

        // Scales
        for (let z = -0.3; z <= 0.3; z += 0.2) {
            const scaleRow = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.15), scaleMat);
            scaleRow.position.set(0, 0.42, z);
            this.mesh.add(scaleRow);
        }

        // Legs
        const legGeo = new THREE.BoxGeometry(0.15, 0.2, 0.15);
        const legPositions = [
            [-0.2, 0.1, 0.3], [0.2, 0.1, 0.3],
            [-0.2, 0.1, -0.3], [0.2, 0.1, -0.3]
        ];

        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeo, bodyMat);
            leg.position.set(...pos);
            this.mesh.add(leg);
        });
    }
}
