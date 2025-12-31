
import * as THREE from 'three';
import { FloatingBlock } from './FloatingBlock.js';

export class Tornado {
    constructor(game, position) {
        this.game = game;
        this.position = position.clone();
        this.lifeTime = 0;
        this.maxLifeTime = 15.0; // 15 seconds
        this.radius = 10.0;
        this.height = 20.0;
        this.spinSpeed = 4.0; // Radians per second for spinning
        this.verticalOscillationSpeed = 2.0; // Speed of up/down movement
        this.verticalOscillationAmount = 3.0; // How far up/down entities move

        // Track captured entities with their orbital data
        this.capturedEntities = new Map();
        this.capturedBlocks = [];
        this.hasScannedBlocks = false;

        this.particles = [];
        this.particleSystem = this.createParticleSystem();
        this.game.scene.add(this.particleSystem);
    }

    createParticleSystem() {
        const particleCount = 300;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const material = new THREE.PointsMaterial({
            color: 0xaaaaaa,
            size: 0.4,
            transparent: true,
            opacity: 0.8
        });

        for (let i = 0; i < particleCount; i++) {
            const p = {
                angle: Math.random() * Math.PI * 2,
                radius: Math.random() * this.radius,
                y: Math.random() * this.height,
                speed: 3 + Math.random() * 4,
            };
            this.particles.push(p);
            positions[i * 3] = this.position.x + Math.cos(p.angle) * p.radius;
            positions[i * 3 + 1] = this.position.y + p.y;
            positions[i * 3 + 2] = this.position.z + Math.sin(p.angle) * p.radius;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        return new THREE.Points(geometry, material);
    }

    update(dt) {
        if (this.game.gameState && this.game.gameState.flags.isTimeStopped) {
            return true;
        }
        this.lifeTime += dt;
        if (this.lifeTime > this.maxLifeTime) {
            this.game.scene.remove(this.particleSystem);
            this.particleSystem.geometry.dispose();
            this.particleSystem.material.dispose();
            // Release captured blocks
            this.releaseCapturedBlocks();
            return false; // Signal to remove from game
        }

        // Capture blocks on first update
        if (!this.hasScannedBlocks) {
            this.captureNearbyBlocks();
            this.hasScannedBlocks = true;
        }

        // Update particle positions to create swirling effect
        const positions = this.particleSystem.geometry.attributes.position.array;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.angle += p.speed * dt;
            p.y = (p.y + dt * 6) % this.height;

            // Funnel shape - radius increases with height
            const radiusFactor = 0.3 + (p.y / this.height) * 0.7;
            positions[i * 3] = this.position.x + Math.cos(p.angle) * p.radius * radiusFactor;
            positions[i * 3 + 1] = this.position.y + p.y;
            positions[i * 3 + 2] = this.position.z + Math.sin(p.angle) * p.radius * radiusFactor;
        }
        this.particleSystem.geometry.attributes.position.needsUpdate = true;

        // Update captured blocks (spinning around tornado)
        this.updateCapturedBlocks(dt);

        // Affect nearby entities (spin them around)
        this.applySpinningForces(dt);

        return true;
    }

    captureNearbyBlocks() {
        const centerX = Math.floor(this.position.x);
        const centerY = Math.floor(this.position.y);
        const centerZ = Math.floor(this.position.z);
        const captureRadius = Math.floor(this.radius * 0.6);
        const captureHeight = Math.floor(this.height * 0.4);

        for (let x = -captureRadius; x <= captureRadius; x++) {
            for (let z = -captureRadius; z <= captureRadius; z++) {
                for (let y = 0; y <= captureHeight; y++) {
                    const dist = Math.sqrt(x * x + z * z);
                    if (dist > captureRadius) continue;

                    const bx = centerX + x;
                    const by = centerY + y;
                    const bz = centerZ + z;

                    const block = this.game.worldManager.getBlock(bx, by, bz);
                    if (block && block !== 'air' && block !== 'water' && block !== 'bedrock') {
                        // Remove block from world
                        this.game.worldManager.setBlock(bx, by, bz, 'air');

                        // Create floating block for tornado
                        const floatBlock = new FloatingBlock(this.game, bx, by, bz, block);
                        this.game.floatingBlocks.push(floatBlock);

                        // Track it for spinning
                        const angle = Math.atan2(z, x);
                        const orbitRadius = dist + 1;
                        const orbitHeight = y + Math.random() * 2;

                        this.capturedBlocks.push({
                            block: floatBlock,
                            angle: angle,
                            orbitRadius: orbitRadius,
                            baseHeight: orbitHeight,
                            phaseOffset: Math.random() * Math.PI * 2,
                            spinSpeed: this.spinSpeed * (0.8 + Math.random() * 0.4)
                        });
                    }
                }
            }
        }
    }

    updateCapturedBlocks(dt) {
        for (const captured of this.capturedBlocks) {
            if (!captured.block || !captured.block.mesh) continue;

            // Update angle for spinning
            captured.angle += captured.spinSpeed * dt;

            // Calculate vertical oscillation
            const verticalOffset = Math.sin(this.lifeTime * this.verticalOscillationSpeed + captured.phaseOffset)
                * this.verticalOscillationAmount;

            // Calculate new position (spinning around tornado center)
            const newX = this.position.x + Math.cos(captured.angle) * captured.orbitRadius;
            const newY = this.position.y + captured.baseHeight + verticalOffset;
            const newZ = this.position.z + Math.sin(captured.angle) * captured.orbitRadius;

            // Update the floating block's position
            captured.block.mesh.position.set(newX, newY, newZ);

            // Add some rotation to the block itself
            captured.block.mesh.rotation.y += dt * 3;
            captured.block.mesh.rotation.x += dt * 1.5;

            // Disable the block's normal physics
            captured.block.velocity.set(0, 0, 0);
        }
    }

    releaseCapturedBlocks() {
        for (const captured of this.capturedBlocks) {
            if (!captured.block) continue;

            // Give blocks outward velocity when released
            const angle = captured.angle;
            const releaseSpeed = 8;
            captured.block.velocity.set(
                Math.cos(angle) * releaseSpeed,
                5,
                Math.sin(angle) * releaseSpeed
            );
        }
        this.capturedBlocks = [];
    }

    applySpinningForces(dt) {
        const entitiesToAffect = [...(this.game.animals || []), ...(this.game.drops || [])];
        if (this.game.player) {
            entitiesToAffect.push(this.game.player);
        }

        for (const entity of entitiesToAffect) {
            if (!entity || !entity.position || !entity.velocity) continue;

            const dx = entity.position.x - this.position.x;
            const dz = entity.position.z - this.position.z;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);

            if (horizontalDist < this.radius && horizontalDist > 0.5) {
                const strength = 1 - (horizontalDist / this.radius);

                // Initialize orbital data if not tracked
                if (!this.capturedEntities.has(entity)) {
                    this.capturedEntities.set(entity, {
                        angle: Math.atan2(dz, dx),
                        baseHeight: entity.position.y,
                        phaseOffset: Math.random() * Math.PI * 2
                    });
                }

                const data = this.capturedEntities.get(entity);
                data.angle += this.spinSpeed * dt * strength;

                // Calculate tangential velocity (perpendicular to radial direction)
                const tangentX = -Math.sin(data.angle);
                const tangentZ = Math.cos(data.angle);

                // Apply spinning force
                const spinForce = 25 * strength;
                entity.velocity.x += tangentX * spinForce * dt;
                entity.velocity.z += tangentZ * spinForce * dt;

                // Pull towards optimal orbit radius
                const optimalRadius = this.radius * 0.5;
                const radiusDiff = horizontalDist - optimalRadius;
                const pullForce = radiusDiff * 8 * strength;
                entity.velocity.x -= (dx / horizontalDist) * pullForce * dt;
                entity.velocity.z -= (dz / horizontalDist) * pullForce * dt;

                // Vertical oscillation
                const targetY = this.position.y + this.height * 0.5
                    + Math.sin(this.lifeTime * this.verticalOscillationSpeed + data.phaseOffset)
                    * this.verticalOscillationAmount;
                const yDiff = targetY - entity.position.y;
                entity.velocity.y += yDiff * 5 * dt * strength;

                // Counter gravity
                entity.velocity.y += 15 * dt * strength;
            } else {
                // Remove from tracked if out of range
                this.capturedEntities.delete(entity);
            }
        }
    }
}
