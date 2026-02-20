import { Animal } from '../Animal.js';
import * as THREE from 'three';

export class Dolphin extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 1.0;
        this.height = 0.8;
        this.depth = 2.0;
        this.speed = 3.5;
        this.avoidsWater = false; // Dolphins live in water
        this.createBody();
    }

    createBody() {
        const material = new THREE.MeshLambertMaterial({ color: 0x4da6ff });

        // Main body
        const bodyGeom = new THREE.BoxGeometry(0.7, 0.7, 1.8);
        const body = new THREE.Mesh(bodyGeom, material);
        this.mesh.add(body);

        // Snout
        const snoutGeom = new THREE.BoxGeometry(0.3, 0.2, 0.6);
        const snout = new THREE.Mesh(snoutGeom, material);
        snout.position.set(0, -0.1, 1.0);
        this.mesh.add(snout);

        // Dorsal Fin
        const finGeom = new THREE.BoxGeometry(0.1, 0.4, 0.4);
        const fin = new THREE.Mesh(finGeom, material);
        fin.position.set(0, 0.45, -0.1);
        this.mesh.add(fin);

        // Flukes (Tail)
        const flukesGeom = new THREE.BoxGeometry(1.2, 0.1, 0.6);
        const flukes = new THREE.Mesh(flukesGeom, material);
        flukes.position.set(0, 0, -1.0);
        this.mesh.add(flukes);
        this.flukes = flukes;
    }

    updateAI(dt) {
        super.updateAI(dt);

        // Swimming animation
        if (this.flukes) {
            this.flukes.rotation.x = Math.sin(Date.now() * 0.008) * 0.5;
        }

        // Swimming logic: add some buoyancy when in water
        const block = this.game.getBlock(this.position.x, this.position.y, this.position.z);
        if (block && block.type === 'water') {
            this.velocity.y += 0.01;
            if (this.velocity.y > 0.05) this.velocity.y = 0.05;
        }
    }
}
