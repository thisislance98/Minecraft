
import { Animal } from '../Animal.js';
import * as THREE from 'three';

export class TestDummy extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.speed = 0;
    }

    createBody() {
        // Simple red box
        const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(this.initPos.x, this.initPos.y, this.initPos.z);

        // Add to scene
        if (this.game.scene) {
            this.game.scene.add(this.mesh);
        }
    }

    update(dt) {
        // Do nothing
    }
}
