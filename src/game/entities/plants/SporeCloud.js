import * as THREE from 'three';
import { InteractivePlant } from './InteractivePlant.js';

/**
 * SporeCloud - Puffy dandelion that grants slow-fall when touched.
 * Explodes into sparkly spores and then regenerates.
 */
export class SporeCloud extends InteractivePlant {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        this.width = 0.8;
        this.height = 1.2;
        this.depth = 0.8;

        this.detectionRange = 1.5; // Must be close to trigger

        // State
        this.state = 'ready'; // ready, burst, regenerating
        this.burstTimer = 0;
        this.regenTimer = 0;
        this.slowFallDuration = 3.0;

        // Spore particles
        this.spores = [];
        this.maxSpores = 30;

        this.createBody();
    }

    createBody() {
        // Thin stem
        const stemGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.6, 6);
        const stemMat = new THREE.MeshLambertMaterial({ color: 0x8bc34a });
        this.stem = new THREE.Mesh(stemGeo, stemMat);
        this.stem.position.y = 0.3;
        this.mesh.add(this.stem);

        // Puffy dandelion head
        this.puffGroup = new THREE.Group();
        this.puffGroup.position.y = 0.7;

        // Create fluffy spore ball
        this.puffMat = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9
        });

        // Main puff sphere
        const puffGeo = new THREE.SphereGeometry(0.3, 12, 10);
        this.puff = new THREE.Mesh(puffGeo, this.puffMat);
        this.puffGroup.add(this.puff);

        // Add fuzzy tendrils
        const tendrilMat = new THREE.MeshLambertMaterial({
            color: 0xf5f5f5,
            transparent: true,
            opacity: 0.8
        });

        for (let i = 0; i < 20; i++) {
            const tendrilGeo = new THREE.CylinderGeometry(0.01, 0.005, 0.15, 4);
            const tendril = new THREE.Mesh(tendrilGeo, tendrilMat);

            // Distribute on sphere surface
            const phi = Math.acos(2 * this.rng.next() - 1);
            const theta = this.rng.next() * Math.PI * 2;

            tendril.position.set(
                0.25 * Math.sin(phi) * Math.cos(theta),
                0.25 * Math.cos(phi),
                0.25 * Math.sin(phi) * Math.sin(theta)
            );

            // Point outward
            tendril.lookAt(tendril.position.clone().multiplyScalar(2));

            this.puffGroup.add(tendril);
        }

        this.mesh.add(this.puffGroup);

        // Create spore particle pool
        this.sporeGroup = new THREE.Group();
        this.mesh.add(this.sporeGroup);

        const sporeMat = new THREE.MeshBasicMaterial({
            color: 0xffffcc,
            transparent: true
        });

        for (let i = 0; i < this.maxSpores; i++) {
            const sporeGeo = new THREE.SphereGeometry(0.02, 4, 4);
            const spore = new THREE.Mesh(sporeGeo, sporeMat.clone());
            spore.visible = false;
            this.sporeGroup.add(spore);

            this.spores.push({
                mesh: spore,
                velocity: new THREE.Vector3(),
                life: 0
            });
        }
    }

    onActivate(player) {
        if (this.state === 'ready') {
            this.triggerBurst(player);
        }
    }

    triggerBurst(player) {
        this.state = 'burst';
        this.burstTimer = 0;

        // Hide the puff
        this.puffGroup.visible = false;

        // Spawn spores flying outward
        for (const spore of this.spores) {
            spore.mesh.visible = true;
            spore.mesh.position.copy(this.puffGroup.position);

            // Random outward velocity
            spore.velocity.set(
                (Math.random() - 0.5) * 3,
                Math.random() * 2 + 1,
                (Math.random() - 0.5) * 3
            );
            spore.life = 2 + Math.random();
            spore.mesh.material.opacity = 1;
        }

        // Apply slow-fall to player
        if (player) {
            this.applySlowFall(player);
        }
    }

    applySlowFall(player) {
        // Store original gravity and apply slow-fall
        if (!player._originalGravity) {
            player._originalGravity = player.gravity;
        }
        player.gravity = 3;// Very slow fall

        // Set timer to restore
        if (player._slowFallTimeout) {
            clearTimeout(player._slowFallTimeout);
        }
        player._slowFallTimeout = setTimeout(() => {
            if (player._originalGravity) {
                player.gravity = player._originalGravity;
                player._originalGravity = null;
            }
        }, this.slowFallDuration * 1000);

        // Visual feedback (optional message)
        if (this.game.uiManager) {
            this.game.uiManager.addChatMessage('system', '🌸 Slow Fall activated!');
        }
    }

    onUpdateActive(dt) {
        // Most logic in updatePhysics
    }

    updatePhysics(dt) {
        const time = performance.now() / 1000;

        switch (this.state) {
            case 'ready':
                // Gentle float animation
                this.puffGroup.position.y = 0.7 + Math.sin(time * 2) * 0.05;
                this.puffGroup.rotation.y += dt * 0.3;
                break;

            case 'burst':
                this.burstTimer += dt;

                // Update spore particles
                for (const spore of this.spores) {
                    if (spore.life > 0) {
                        spore.life -= dt;
                        spore.velocity.y -= dt * 0.5; // Slow gravity
                        spore.mesh.position.add(spore.velocity.clone().multiplyScalar(dt));
                        spore.mesh.material.opacity = Math.max(0, spore.life / 2);

                        // Sparkle effect
                        spore.mesh.scale.setScalar(0.5 + Math.sin(time * 10 + spore.life) * 0.5);
                    } else {
                        spore.mesh.visible = false;
                    }
                }

                // After spores fade, start regenerating
                if (this.burstTimer > 3) {
                    this.state = 'regenerating';
                    this.regenTimer = 0;
                }
                break;

            case 'regenerating':
                this.regenTimer += dt;

                // Grow back
                const growProgress = Math.min(this.regenTimer / 2, 1);
                this.puffGroup.visible = true;
                this.puffGroup.scale.setScalar(growProgress);
                this.puffMat.opacity = 0.9 * growProgress;

                if (this.regenTimer > 2) {
                    this.state = 'ready';
                    this.puffGroup.scale.setScalar(1);
                    this.puffMat.opacity = 0.9;
                }
                break;
        }

        this.mesh.position.copy(this.position);
    }
}
