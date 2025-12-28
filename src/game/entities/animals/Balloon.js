import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Balloon extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.8;
        this.height = 0.8;
        this.depth = 0.8;
        this.speed = 0;
        this.gravity = 0;
        this.createBody();
        this.mesh.scale.set(1, 1, 1);

        this.fleeOnProximity = false;
        this.isHostile = false;

        // Custom Balloon Properties
        this.color = new THREE.Color(Math.random(), Math.random(), Math.random());
        this.stringLength = 5;

        // Override initial position to float higher
        this.position.y += 5;  // Float above ground

        // Add string
        const stringGeom = new THREE.CylinderGeometry(0.02, 0.02, this.stringLength, 8);
        const stringMat = new THREE.MeshBasicMaterial({ color: 0x888888 });
        this.stringMesh = new THREE.Mesh(stringGeom, stringMat);
        this.stringMesh.position.y = -this.stringLength / 2; // Adjust to start at bottom of balloon
        this.mesh.add(this.stringMesh);
    }

    createBody() {
        // Balloon: Sphere
        const geometry = new THREE.SphereGeometry(0.5, 32, 32);
        const material = new THREE.MeshLambertMaterial({ color: this.color });
        const sphere = new THREE.Mesh(geometry, material);
        this.mesh.add(sphere);
    }

    update(dt) {
        // Gently float upwards
        this.position.y += 0.01 * dt;

        super.update(dt);

        // Optional bobbing effect
        this.mesh.position.y = this.position.y + Math.sin(this.game.lastTime / 500) * 0.1;
    }
}
