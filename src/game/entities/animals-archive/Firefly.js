import { Animal } from '../Animal.js';
import * as THREE from 'three';

export class Firefly extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.2;
        this.height = 0.2;
        this.depth = 0.2;
        this.speed = 1.0;
        this.floatPhase = Math.random() * Math.PI * 2;
        this.createBody();
    }

    createBody() {
        const glowMat = new THREE.MeshStandardMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 2
        });

        const body = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), glowMat);
        this.mesh.add(body);

        // PERFORMANCE FIX: Removed PointLight - emissive material already provides glow
        // PointLights are expensive and accumulate across many Fireflies
        // this.light = new THREE.PointLight(0xffff00, 1.5, 10);
        // this.mesh.add(this.light);
    }

    update(dt) {
        if (this.game.gameState && this.game.gameState.flags.isTimeStopped) {
            this.mesh.position.copy(this.position);
            return;
        }
        dt = Math.min(dt, 0.1);

        this.updateAI(dt);

        // Update damage flash
        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
            this.mesh.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (!child.material.userData) child.material.userData = {};
                    if (!child.material.userData.originalColor) {
                        child.material.userData.originalColor = child.material.color.clone();
                    }
                    if (this.flashTimer > 0) {
                        child.material.color.setHex(0xFF0000);
                    } else {
                        if (child.material.userData.originalColor) {
                            child.material.color.copy(child.material.userData.originalColor);
                        }
                    }
                }
            });
        }

        this.updateAnimation(dt);
        this.updateDeath(dt);

        // Sync mesh
        this.mesh.position.copy(this.position);
        if (!this.isDying) {
            // Face movement direction
            if (this.velocity.lengthSq() > 0.001) {
                this.rotation = Math.atan2(this.velocity.x, this.velocity.z);
            }
            this.mesh.rotation.y = this.rotation;
        }
    }

    updateAI(dt) {
        this.floatPhase += dt * 2;

        // Custom flying movement
        if (!this.targetDir || Math.random() < 0.05) {
            this.targetDir = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 1,
                (Math.random() - 0.5) * 2
            ).normalize();
        }

        this.velocity.x = this.targetDir.x * this.speed;
        this.velocity.y = (this.targetDir.y * this.speed) + Math.sin(this.floatPhase) * 0.5;
        this.velocity.z = this.targetDir.z * this.speed;

        // PERFORMANCE FIX: Light removed, using emissive material for glow
        // if (this.light) {
        //     this.light.intensity = 1.0 + Math.sin(this.floatPhase * 2) * 0.5;
        // }

        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.position.z += this.velocity.z * dt;

        this.mesh.position.copy(this.position);
    }

    updatePhysics(dt) {
        // Override base Animal physics to disable gravity and ground collision
        // This allows the Firefly to fly freely based on updateAI's position updates

        // Optional: Add simple world bounds check or wall collision if desired
        if (this.position.y < -50) this.position.y = 50;
    }
}
