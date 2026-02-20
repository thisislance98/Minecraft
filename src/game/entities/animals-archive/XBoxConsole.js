import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class XBoxConsole extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.5;
        this.height = 1.0;
        this.depth = 0.5;
        this.speed = 0;
    }

    createBody() {
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.9, 0.5);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0x1a1a1a });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.45;
        this.mesh.add(body);
        const topGeo = new THREE.BoxGeometry(0.48, 0.05, 0.48);
        const topMat = new THREE.MeshPhongMaterial({ color: 0x107c10, emissive: 0x107c10, emissiveIntensity: 0.5 });
        const top = new THREE.Mesh(topGeo, topMat);
        top.position.y = 0.9;
        this.mesh.add(top);
    }
    
    updateAI() {
        this.state = 'idle';
        this.isMoving = false;
    }
}
