import * as THREE from 'three';

export class ButterflyManager {
    constructor(game, count = 30) {
        this.game = game;
        this.count = count;
        this.bounds = 20; // Fly closer to player than birds

        // Boid parameters - customized for butterflies (fluttery, erratic)
        this.separationDistance = 2.0;
        this.alignmentDistance = 5.0;
        this.cohesionDistance = 5.0;

        this.separationForce = 2.0;
        this.alignmentForce = 0.5; // Less alignment for chaotic flight
        this.cohesionForce = 0.5;

        this.speedLimit = 3;
        this.speedMin = 1;

        // Physics state
        this.positions = new Float32Array(count * 3);
        this.velocities = new Float32Array(count * 3);

        // Wing animation phase offsets
        this.wingPhases = new Float32Array(count);
        // Random colors for variety
        this.colors = [];

        // Initialize random positions and velocities
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * 20; // Start closer
            const y = Math.random() * 5 + 2;      // Start lower
            const z = (Math.random() - 0.5) * 20;

            this.positions[i * 3] = x;
            this.positions[i * 3 + 1] = y;
            this.positions[i * 3 + 2] = z;

            const vx = (Math.random() - 0.5) * this.speedLimit;
            const vy = (Math.random() - 0.5) * this.speedLimit;
            const vz = (Math.random() - 0.5) * this.speedLimit;

            this.velocities[i * 3] = vx;
            this.velocities[i * 3 + 1] = vy;
            this.velocities[i * 3 + 2] = vz;

            this.wingPhases[i] = Math.random() * Math.PI * 2;

            // Random vibrant colors
            const hue = Math.random();
            const saturation = 0.7 + Math.random() * 0.3;
            const lightness = 0.4 + Math.random() * 0.2;
            this.colors.push(new THREE.Color().setHSL(hue, saturation, lightness));
        }

        // Time tracker for animation
        this.time = 0;

        // Create group
        this.group = new THREE.Group();
        this.butterflies = [];

        for (let i = 0; i < count; i++) {
            const butterfly = this.createButterfly(this.colors[i]);
            this.butterflies.push(butterfly);
            this.group.add(butterfly.group);
        }

        this.game.scene.add(this.group);
    }

    createButterfly(color) {
        const group = new THREE.Group();
        const meshGroup = new THREE.Group();
        group.add(meshGroup);

        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 }); // Dark body
        const wingMaterial = new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide });

        // Body - Tiny
        const bodyGeo = new THREE.BoxGeometry(0.05, 0.05, 0.2);
        const body = new THREE.Mesh(bodyGeo, bodyMaterial);
        meshGroup.add(body);

        // Wings - Large and colorful
        const wingWidth = 0.25;
        const wingHeight = 0.02; // Thin
        const wingSpan = 0.3; // Length along Z

        // Create a wing shape that looks more like a butterfly wing (using two planes or boxes)
        // Simplified: One large plate per side
        const wingGeo = new THREE.BoxGeometry(wingWidth, wingHeight, wingSpan);
        wingGeo.translate(wingWidth / 2, 0, 0); // Pivot at edge

        // Left Wing
        const leftWing = new THREE.Mesh(wingGeo, wingMaterial);
        leftWing.position.set(0, 0.05, 0); // Slightly above body
        meshGroup.add(leftWing);

        // Right Wing
        const rightWing = new THREE.Mesh(wingGeo, wingMaterial);
        rightWing.position.set(0, 0.05, 0);
        // We will rotate this one 180 degrees around Z essentially to mirror it, 
        // but easier to just rotate in update or use negative scale if geometry allows.
        // Actually for flapping we want them separate.
        // Let's mirror geometry for right wing to pivot correctly?
        // Reuse geometry but rotate the mesh PI around Z to flip it to the other side
        rightWing.rotation.z = Math.PI;
        // Adjust position after rotation if needed, but pivot is at 0,0,0 relative to wing mesh translation
        meshGroup.add(rightWing);

        // Rotate whole butterfly to face +Z
        meshGroup.rotation.y = Math.PI / 2;

        // Enable shadows
        group.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        return {
            group,
            leftWing,
            rightWing,
            meshGroup
        };
    }

    update(dt, player) {
        const cx = player.position.x;
        const cy = player.position.y;
        const cz = player.position.z;

        // Random wind/flutter factor
        this.time += dt;

        for (let i = 0; i < this.count; i++) {
            const idx = i * 3;
            let px = this.positions[idx];
            let py = this.positions[idx + 1];
            let pz = this.positions[idx + 2];

            let vx = this.velocities[idx];
            let vy = this.velocities[idx + 1];
            let vz = this.velocities[idx + 2];

            // --- Boids Rules ---
            let sepX = 0, sepY = 0, sepZ = 0;
            let alignX = 0, alignY = 0, alignZ = 0;
            let cohX = 0, cohY = 0, cohZ = 0;
            let neighborCount = 0;

            for (let j = 0; j < this.count; j++) {
                if (i === j) continue;

                const jdx = j * 3;
                const dx = px - this.positions[jdx];
                const dy = py - this.positions[jdx + 1];
                const dz = pz - this.positions[jdx + 2];
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq < this.separationDistance * this.separationDistance) {
                    const dist = Math.sqrt(distSq);
                    const force = (this.separationDistance - dist) / dist;
                    sepX += dx * force;
                    sepY += dy * force;
                    sepZ += dz * force;
                }

                if (distSq < this.alignmentDistance * this.alignmentDistance) {
                    alignX += this.velocities[jdx];
                    alignY += this.velocities[jdx + 1];
                    alignZ += this.velocities[jdx + 2];

                    cohX += this.positions[jdx];
                    cohY += this.positions[jdx + 1];
                    cohZ += this.positions[jdx + 2];
                    neighborCount++;
                }
            }

            if (neighborCount > 0) {
                alignX /= neighborCount;
                alignY /= neighborCount;
                alignZ /= neighborCount;

                cohX /= neighborCount;
                cohY /= neighborCount;
                cohZ /= neighborCount;

                cohX = (cohX - px);
                cohY = (cohY - py);
                cohZ = (cohZ - pz);
            }

            // --- Steering + Flutter ---
            // Add random noise for butterfly erratic movement
            const noiseScale = 50.0;
            const noiseX = Math.sin(this.time * 2 + i) * noiseScale;
            const noiseY = Math.cos(this.time * 3 + i) * noiseScale;
            const noiseZ = Math.sin(this.time * 4 + i) * noiseScale;

            vx += (sepX * this.separationForce + alignX * this.alignmentForce + cohX * this.cohesionForce + noiseX) * dt;
            vy += (sepY * this.separationForce + alignY * this.alignmentForce + cohY * this.cohesionForce + noiseY) * dt;
            vz += (sepZ * this.separationForce + alignZ * this.alignmentForce + cohZ * this.cohesionForce + noiseZ) * dt;

            // --- Bounds / Homing ---
            const distFromCenter = Math.sqrt((px - cx) * (px - cx) + (pz - cz) * (pz - cz));
            if (distFromCenter > this.bounds) {
                const angle = Math.atan2(pz - cz, px - cx);
                vx -= Math.cos(angle) * 10 * dt;
                vz -= Math.sin(angle) * 10 * dt;
            }

            // Height handling - usually lower to ground but varies
            // Target height around player head or flowers (simulated)
            const targetY = cy + 2 + Math.sin(this.time * 0.5 + i) * 1;
            const heightDiff = targetY - py;
            vy += heightDiff * 2.0 * dt;

            // Strong floor avoidance
            if (py < cy + 0.5) {
                vy += 10 * dt;
            }

            // --- Speed Limits ---
            const speedSq = vx * vx + vy * vy + vz * vz;
            const speed = Math.sqrt(speedSq);

            if (speed > this.speedLimit) {
                const ratio = this.speedLimit / speed;
                vx *= ratio;
                vy *= ratio;
                vz *= ratio;
            } else if (speed < this.speedMin) {
                const ratio = this.speedMin / speed;
                vx *= ratio;
                vy *= ratio;
                vz *= ratio;
            }

            // --- Integration ---
            this.velocities[idx] = vx;
            this.velocities[idx + 1] = vy;
            this.velocities[idx + 2] = vz;

            this.positions[idx] += vx * dt;
            this.positions[idx + 1] += vy * dt;
            this.positions[idx + 2] += vz * dt;

            // --- Update Mesh ---
            const butterfly = this.butterflies[i];
            butterfly.group.position.set(
                this.positions[idx],
                this.positions[idx + 1],
                this.positions[idx + 2]
            );

            // Look at velocity
            const targetPos = butterfly.group.position.clone().add(new THREE.Vector3(vx, vy, vz));
            butterfly.group.lookAt(targetPos);

            // --- Wing Flapping ---
            // Faster flapping than birds
            const flapSpeed = 15;
            const wingAngle = Math.sin(this.time * flapSpeed + this.wingPhases[i]) * 1.0; // Large flap angle

            // Left wing rotates up (Z axis relative to wing with applied translation? No, we set pivot at center)
            // Our left wing geometry is translated +X (width/2).
            // We want to rotate around Z axis?
            // "meshGroup" rotates Y to face forward.
            // "leftWing" is added to meshGroup.
            // wings need to flap up and down. Relative to body which is looking +Z (after meshGroup rot).
            // left wing is at +X side. Flapping up means rotating around Z axis.

            butterfly.leftWing.rotation.z = wingAngle;

            // Right wing is already rotated PI around Z.
            // If we rotate it by -wingAngle around Z, does it flap correctly?
            // Initial rot PI. 
            // Flap up: we want tip to go up. 
            butterfly.rightWing.rotation.z = Math.PI - wingAngle;
        }
    }

    clear() {
        this.count = 0;
        if (this.group) {
            this.game.scene.remove(this.group);
            this.group.traverse(obj => {
                if (obj.isMesh) {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                        else obj.material.dispose();
                    }
                }
            });
        }
        this.butterflies = [];
    }
}
