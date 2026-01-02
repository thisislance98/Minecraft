import { Animal } from '../Animal.js';
import * as THREE from 'three';

export class Starfish extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.6;
        this.height = 0.2;
        this.depth = 0.6;
        this.createBody();
    }

    createBody() {
        const mat = new THREE.MeshLambertMaterial({ color: 0xff69b4 });
        const core = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.4), mat);
        this.mesh.add(core);

        for (let i = 0; i < 5; i++) {
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.6), mat);
            const angle = (i / 5) * Math.PI * 2;
            arm.position.set(Math.sin(angle) * 0.3, 0, Math.cos(angle) * 0.3);
            arm.rotation.y = angle;
            this.mesh.add(arm);
        }
    }
}
