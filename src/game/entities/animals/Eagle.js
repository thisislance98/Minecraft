import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Eagle extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.5;
        this.height = 0.4;
        this.depth = 0.8;
        this.speed = 3.0;
        this.flying = true; // Add flying state
        this.altitude = 10; // Initial altitude
        this.flySpeed = 5; // Flying speed
        this.roamRadius = 20; // Roaming radius
        this.createBody();
        this.mesh.scale.set(1, 1, 1);
        this.gravity = 0; // No gravity
    }

    createBody() {
        // Eagle: Brown/White with yellow beak/feet
        const brown = 0x8B4513;   // Saddle Brown
        const white = 0xFFFFFF;   // White
        const yellow = 0xFFFF00;  // Yellow

        const matBrown = new THREE.MeshLambertMaterial({ color: brown });
        const matWhite = new THREE.MeshLambertMaterial({ color: white });
        const matYellow = new THREE.MeshLambertMaterial({ color: yellow });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.3, 0.8);
        const body = new THREE.Mesh(bodyGeo, matBrown);
        body.position.set(0, 0.2, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const head = new THREE.Mesh(headGeo, matWhite);
        head.position.set(0, 0.4, 0.4);
        this.mesh.add(head);

        // Beak
        const beakGeo = new THREE.BoxGeometry(0.1, 0.1, 0.2);
        const beak = new THREE.Mesh(beakGeo, matYellow);
        beak.position.set(0, 0.35, 0.55);
        this.mesh.add(beak);

        // Wings
        const wingGeo = new THREE.BoxGeometry(0.1, 0.2, 0.6);

        const leftWing = new THREE.Mesh(wingGeo, matBrown);
        leftWing.position.set(-0.3, 0.2, 0);
        leftWing.rotation.y = Math.PI / 4;
        this.mesh.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeo, matBrown);
        rightWing.position.set(0.3, 0.2, 0);
        rightWing.rotation.y = -Math.PI / 4;
        this.mesh.add(rightWing);

        // Feet
        const footGeo = new THREE.BoxGeometry(0.1, 0.1, 0.2);
        const leftFoot = new THREE.Mesh(footGeo, matYellow);
        leftFoot.position.set(-0.2, 0, -0.3);
        this.mesh.add(leftFoot);

        const rightFoot = new THREE.Mesh(footGeo, matYellow);
        rightFoot.position.set(0.2, 0, -0.3);
        this.mesh.add(rightFoot);

        this.legParts = [leftFoot, rightFoot];
    }

    updateAI(dt) {
        // Basic flying AI: roam within a radius
        if (this.flying) {
            if (this.stateTimer <= 0) {
                this.stateTimer = this.rng.next() * 5 + 5; // New target every 5-10 seconds
                this.targetAltitude = 10 + (this.rng.next() - 0.5) * 10; // Random altitude
                const angle = this.rng.next() * Math.PI * 2; // Random direction
                this.targetX = this.position.x + Math.cos(angle) * this.roamRadius;
                this.targetZ = this.position.z + Math.sin(angle) * this.roamRadius;
            }

            // Move towards target
            const dx = this.targetX - this.position.x;
            const dz = this.targetZ - this.position.z;
            const dy = this.targetAltitude - this.position.y;

            this.moveDirection.set(dx, dy, dz).normalize();
            this.position.add(this.moveDirection.multiplyScalar(this.flySpeed * dt));
        }
    }

    updatePhysics(dt) {
        if (this.flying) {
            this.updateAI(dt);
        } else {
            super.updatePhysics(dt);
        }
    }
}
