import * as THREE from 'three';
import { InteractivePlant } from './InteractivePlant.js';

/**
 * BouncePod - Trampoline plant that launches the player!
 * A rubbery mushroom cap that compresses and bounces.
 */
export class BouncePod extends InteractivePlant {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        this.width = 1.5;
        this.height = 1.0;
        this.depth = 1.5;

        this.detectionRange = 2.5;

        // Bounce state
        this.bounceState = 'idle'; // idle, compressed, launching, recovering
        this.bounceTimer = 0;
        this.cooldownTimer = 0;
        this.compressionAmount = 0;

        // Launch power
        this.launchForce = 25; // Strong upward velocity

        this.createBody();
    }

    createBody() {
        // Stem/Base
        const stemGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.4, 8);
        const stemMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 }); // Brown
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.y = 0.2;
        this.mesh.add(stem);

        // Main bouncy cap
        this.capGroup = new THREE.Group();
        this.capGroup.position.y = 0.4;

        // Create rubbery cap with semi-sphere
        const capGeo = new THREE.SphereGeometry(0.8, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        this.capMat = new THREE.MeshLambertMaterial({
            color: 0xff6b9d, // Pink-ish
            emissive: 0xff6b9d,
            emissiveIntensity: 0.1
        });
        this.cap = new THREE.Mesh(capGeo, this.capMat);
        this.cap.rotation.x = Math.PI; // Flip so dome faces up
        this.cap.position.y = 0.3;
        this.capGroup.add(this.cap);

        // Spots on cap for visual interest
        const spotMat = new THREE.MeshLambertMaterial({ color: 0xffb6c1 }); // Lighter pink
        for (let i = 0; i < 5; i++) {
            const spotGeo = new THREE.CircleGeometry(0.1 + Math.random() * 0.1, 8);
            const spot = new THREE.Mesh(spotGeo, spotMat);
            const angle = (i / 5) * Math.PI * 2 + this.rng.next();
            const r = 0.3 + this.rng.next() * 0.3;
            spot.position.set(
                Math.cos(angle) * r,
                0.35 + this.rng.next() * 0.1,
                Math.sin(angle) * r
            );
            spot.rotation.x = -Math.PI / 2 - 0.3; // Face outward-ish
            spot.rotation.y = angle;
            this.capGroup.add(spot);
        }

        this.mesh.add(this.capGroup);

        // Store original cap Y for animation
        this.baseCapY = 0.4;
    }

    onActivate(player) {
        // Check if player is above us and falling/landing
    }

    onUpdateActive(dt) {
        const player = this.game.player;
        if (!player) return;

        // Check collision with player
        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= dt;
            return;
        }

        // Check if player is on top of us
        const dx = Math.abs(player.position.x - this.position.x);
        const dz = Math.abs(player.position.z - this.position.z);
        const dy = player.position.y - this.position.y;

        // Player must be mostly above us and close
        const isAbove = dy > 0 && dy < 2.5;
        const isOnTop = dx < 0.8 && dz < 0.8 && isAbove;

        // Also check if player jumped on us (velocity-based check removed for simplicity)
        if (isOnTop && this.bounceState === 'idle') {
            this.triggerBounce(player);
        }
    }

    triggerBounce(player) {
        this.bounceState = 'compressed';
        this.bounceTimer = 0;

        // Compress animation will trigger launch after short delay
    }

    updatePhysics(dt) {
        const time = performance.now() / 1000;

        // State machine for bounce animation
        switch (this.bounceState) {
            case 'idle':
                // Gentle wobble when idle
                this.capGroup.scale.y = 1.0 + Math.sin(time * 2) * 0.03;
                this.capGroup.position.y = this.baseCapY;
                break;

            case 'compressed':
                this.bounceTimer += dt;
                // Quick compression
                this.compressionAmount = Math.min(this.bounceTimer * 8, 0.5);
                this.capGroup.scale.y = 1.0 - this.compressionAmount;
                this.capGroup.scale.x = 1.0 + this.compressionAmount * 0.3;
                this.capGroup.scale.z = 1.0 + this.compressionAmount * 0.3;
                this.capGroup.position.y = this.baseCapY - this.compressionAmount * 0.3;

                // After full compression, launch!
                if (this.bounceTimer > 0.15) {
                    this.bounceState = 'launching';
                    this.bounceTimer = 0;

                    // Launch the player!
                    const player = this.game.player;
                    if (player) {
                        player.velocity.y = this.launchForce;
                        player.onGround = false;

                        // Play sound
                        if (this.game.audioManager) {
                            this.game.audioManager.playPop?.();
                        }
                    }
                }
                break;

            case 'launching':
                this.bounceTimer += dt;
                // Quick spring-up overshoot
                const springProgress = this.bounceTimer * 10;
                if (springProgress < 1) {
                    // Overshoot
                    this.capGroup.scale.y = 1.0 + (1 - springProgress) * 0.3;
                    this.capGroup.scale.x = 1.0 - (1 - springProgress) * 0.2;
                    this.capGroup.scale.z = 1.0 - (1 - springProgress) * 0.2;
                } else {
                    this.bounceState = 'recovering';
                    this.bounceTimer = 0;
                }
                break;

            case 'recovering':
                this.bounceTimer += dt;
                // Settle back to normal
                const settleProgress = Math.min(this.bounceTimer * 3, 1);
                this.capGroup.scale.y = 1.0 + (1 - settleProgress) * 0.1 * Math.sin(settleProgress * Math.PI * 3);
                this.capGroup.scale.x = 1.0;
                this.capGroup.scale.z = 1.0;
                this.capGroup.position.y = this.baseCapY;

                if (this.bounceTimer > 0.5) {
                    this.bounceState = 'idle';
                    this.cooldownTimer = 1.5; // Cooldown before next bounce
                }
                break;
        }

        // Glow when ready
        if (this.cooldownTimer > 0) {
            this.capMat.emissiveIntensity = 0.05;
        } else {
            this.capMat.emissiveIntensity = 0.2 + Math.sin(time * 3) * 0.1;
        }

        this.mesh.position.copy(this.position);
    }
}
