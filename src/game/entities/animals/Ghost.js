import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Ghost extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.6;
        this.height = 1.2;
        this.depth = 0.6;
        this.speed = 1.5;
        this.floatingOffset = Math.random() * Math.PI * 2;
        this.createBody();
    }

    createBody() {
        const material = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
            emissive: 0xaaaaaa,
            emissiveIntensity: 0.5
        });

        // Main ghost body
        const bodyGeo = new THREE.BoxGeometry(0.6, 0.8, 0.4);
        const body = new THREE.Mesh(bodyGeo, material);
        body.position.y = 0.6;
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const head = new THREE.Mesh(headGeo, material);
        head.position.y = 1.2;
        this.mesh.add(head);

        // Eyes
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8 });
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(0.15, 1.25, 0.25);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(-0.15, 1.25, 0.25);
        this.mesh.add(rightEye);
    }

    updateAI(dt) {
        super.updateAI(dt);
        // Floating animation
        this.floatingOffset += dt * 3;
        const bob = Math.sin(this.floatingOffset) * 0.2;
        this.mesh.children.forEach(child => {
            child.position.y += bob * 0.01;
        });
    }
}
