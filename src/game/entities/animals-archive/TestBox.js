import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class TestBox extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
    }

    createBody() {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        const mesh = new THREE.Mesh(geo, mat);
        this.mesh.add(mesh);
    }
}
