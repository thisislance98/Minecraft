import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Bee extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        // 1. Set Dimensions
        this.width = 0.4;
        this.height = 0.4;
        this.depth = 0.5;
        this.speed = 3.0; // Faster than ground animals

        // 2. Build the visual mesh
        this.createBody();

        // Flight specific state
        this.hoverOffset = 0;
    }

    createBody() {
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xFFAA00 }); // Orange/Yellow
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0x111111 }); // Black stripes
        const wingMat = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });

        // Main Body (Yellow)
        const bodyGeo = new THREE.BoxGeometry(0.3, 0.3, 0.4);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.5;
        this.mesh.add(body);

        // Stripes (2 Black bands)
        const stripeGeo = new THREE.BoxGeometry(0.32, 0.32, 0.1);
        const stripe1 = new THREE.Mesh(stripeGeo, stripeMat);
        stripe1.position.set(0, 0.5, 0.05);
        this.mesh.add(stripe1);

        const stripe2 = new THREE.Mesh(stripeGeo, stripeMat);
        stripe2.position.set(0, 0.5, -0.1);
        this.mesh.add(stripe2);

        // Wings
        const wingGeo = new THREE.PlaneGeometry(0.4, 0.2);

        this.leftWing = new THREE.Mesh(wingGeo, wingMat);
        this.leftWing.position.set(-0.2, 0.7, 0);
        this.leftWing.rotation.x = -Math.PI / 2;
        this.mesh.add(this.leftWing);

        this.rightWing = new THREE.Mesh(wingGeo, wingMat);
        this.rightWing.position.set(0.2, 0.7, 0);
        this.rightWing.rotation.x = -Math.PI / 2;
        this.mesh.add(this.rightWing);
    }

    updateAI(dt) {
        // Simple random flight
        this.hoverOffset += dt * 10;

        // Change direction occasionally
        if (!this.targetDir || Math.random() < 0.02) {
            this.targetDir = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2, // Allow vertical movement
                (Math.random() - 0.5) * 2
            ).normalize();
        }

        // Apply Velocity
        this.velocity.x = this.targetDir.x * this.speed;
        this.velocity.y = this.targetDir.y * this.speed;
        this.velocity.z = this.targetDir.z * this.speed;

        // Apply position update manually
        this.position.addScaledVector(this.velocity, dt);

        // Bobbing effect
        this.position.y += Math.sin(this.hoverOffset) * 0.01;

        // Face movement
        if (this.velocity.lengthSq() > 0.1) {
            this.rotation = Math.atan2(this.velocity.x, this.velocity.z);
        }

        // Wing flutter
        if (this.leftWing && this.rightWing) {
            this.leftWing.rotation.z = Math.sin(this.hoverOffset * 5) * 0.5;
            this.rightWing.rotation.z = -Math.sin(this.hoverOffset * 5) * 0.5;
        }
    }

    updatePhysics(dt) {
        // OVERRIDE: Disable gravity for flight
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;

        // Simple bound check
        if (this.position.y < 0) {
            this.position.y = 0.5;
            this.targetDir.y = Math.abs(this.targetDir.y); // Bounce up
        }
    }
}
