import * as THREE from 'three';

export class BirdManager {
    constructor(game, count = 50) {
        this.game = game;
        this.count = count;
        this.bounds = 80; // Fly within this radius of player

        // Boid parameters
        this.separationDistance = 15.0;
        this.alignmentDistance = 30.0;
        this.cohesionDistance = 30.0;

        this.separationForce = 2.0;
        this.alignmentForce = 1.0;
        this.cohesionForce = 1.0;

        this.speedLimit = 8;
        this.speedMin = 4;

        // Physics state
        this.positions = new Float32Array(count * 3);
        this.velocities = new Float32Array(count * 3);

        // Wing animation phase offsets (so birds don't all flap in sync)
        this.wingPhases = new Float32Array(count);

        // Initialize random positions and velocities
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * 100 + 35;
            const y = Math.random() * 30 + 30; // High in sky
            const z = (Math.random() - 0.5) * 100 + 35;

            this.positions[i * 3] = x;
            this.positions[i * 3 + 1] = y;
            this.positions[i * 3 + 2] = z;

            const vx = (Math.random() - 0.5) * this.speedLimit;
            const vy = (Math.random() - 0.5) * this.speedLimit * 0.5; // Less vertical movement
            const vz = (Math.random() - 0.5) * this.speedLimit;

            this.velocities[i * 3] = vx;
            this.velocities[i * 3 + 1] = vy;
            this.velocities[i * 3 + 2] = vz;

            // Random starting phase for wing animation
            this.wingPhases[i] = Math.random() * Math.PI * 2;
        }

        // Time tracker for animation
        this.time = 0;

        // Create bird group with bodies and wings
        this.birdGroup = new THREE.Group();
        this.birds = [];

        for (let i = 0; i < count; i++) {
            const bird = this.createBird();
            this.birds.push(bird);
            this.birdGroup.add(bird.group);
        }

        this.game.scene.add(this.birdGroup);

        this.dummy = new THREE.Object3D();
    }

    createBird() {
        const group = new THREE.Group();
        // Inner group to hold the mesh parts, allowing us to rotate the model to face +Z
        const meshGroup = new THREE.Group();
        group.add(meshGroup);

        // Bird body material - dark gray/black for crow-like appearance
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
        const beakMaterial = new THREE.MeshLambertMaterial({ color: 0xffa500 });

        // Body - Blocky
        const bodyGeometry = new THREE.BoxGeometry(0.6, 0.3, 0.35);
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        meshGroup.add(body);

        // Head - Blocky
        const headGeometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
        const head = new THREE.Mesh(headGeometry, bodyMaterial);
        head.position.set(0.4, 0.15, 0); // In front and slightly up
        meshGroup.add(head);

        // Beak - Blocky
        const beakGeometry = new THREE.BoxGeometry(0.15, 0.08, 0.08);
        const beak = new THREE.Mesh(beakGeometry, beakMaterial);
        beak.position.set(0.6, 0.1, 0);
        meshGroup.add(beak);

        // Tail feathers - Blocky
        const tailGeometry = new THREE.BoxGeometry(0.3, 0.05, 0.2);
        const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
        tail.position.set(-0.4, 0.05, 0);
        meshGroup.add(tail);

        // Wings - Blocky
        // Create wing geometry that extends from 0 to +Z
        const wingSpan = 0.4;
        const wingWidth = 0.3;
        const wingThickness = 0.05;

        const wingGeometry = new THREE.BoxGeometry(wingWidth, wingThickness, wingSpan);
        wingGeometry.translate(0, 0, wingSpan / 2); // Shift so it starts at Z=0 and extends to Z=wingSpan

        // Left wing
        const leftWing = new THREE.Mesh(wingGeometry, bodyMaterial);
        // Position at the edge of the body (body width is 0.35, half is 0.175)
        leftWing.position.set(0, 0.1, 0.175);
        meshGroup.add(leftWing);

        // Right wing (mirrored)
        // Clone for independent scaling/geometry state
        const rightWingGeometry = wingGeometry.clone();
        rightWingGeometry.scale(1, 1, -1); // Mirror on Z axis so it extends from 0 to -Z
        const rightWing = new THREE.Mesh(rightWingGeometry, bodyMaterial);
        rightWing.position.set(0, 0.1, -0.175);
        meshGroup.add(rightWing);

        // Rotate parts so the bird (built along X) faces +Z (forward)
        meshGroup.rotation.y = Math.PI / 2;

        return {
            group,
            leftWing,
            rightWing
        };
    }

    update(dt, player) {
        // Center of flight (player position)
        const cx = player.position.x;
        const cy = player.position.y;
        const cz = player.position.z;

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
                // Alignment: steer towards average heading
                alignX /= neighborCount;
                alignY /= neighborCount;
                alignZ /= neighborCount;

                // Cohesion: steer towards average position
                cohX /= neighborCount;
                cohY /= neighborCount;
                cohZ /= neighborCount;

                cohX = (cohX - px);
                cohY = (cohY - py);
                cohZ = (cohZ - pz);
            }

            // --- Steering ---

            // --- Steering ---

            // Weight vertical forces less ensuring flatter flight
            vx += (sepX * this.separationForce + alignX * this.alignmentForce + cohX * this.cohesionForce) * dt;
            vy += (sepY * this.separationForce * 0.5 + alignY * this.alignmentForce * 0.5 + cohY * this.cohesionForce * 0.5) * dt;
            vz += (sepZ * this.separationForce + alignZ * this.alignmentForce + cohZ * this.cohesionForce) * dt;

            // --- Bounds / Homing ---

            // Stay near player
            const distFromCenter = Math.sqrt((px - cx) * (px - cx) + (pz - cz) * (pz - cz));
            if (distFromCenter > this.bounds) {
                const angle = Math.atan2(pz - cz, px - cx);
                // Gently steer back instead of harsh turnaround
                vx -= Math.cos(angle) * 5 * dt;
                vz -= Math.sin(angle) * 5 * dt;
            }

            // Height handling - Soft floor and ceiling
            const targetY = cy + 25;
            const heightDiff = targetY - py;
            // Gentle pull to target height, stronger if too low/high
            vy += heightDiff * 0.5 * dt;

            // Strong floor avoidance
            if (py < cy + 10) {
                vy += 10 * dt;
            }

            // --- Forward Momentum ---
            // Ensure they always have some forward speed in X/Z plane
            const currentSpeedSq = vx * vx + vz * vz;
            if (currentSpeedSq < 0.1) {
                // If stopped, give random horizontal push
                const angle = Math.random() * Math.PI * 2;
                vx += Math.cos(angle) * 2;
                vz += Math.sin(angle) * 2;
            }

            // --- Speed Limit ---
            const speedSq = vx * vx + vy * vy + vz * vz;
            const speed = Math.sqrt(speedSq);

            // Apply min/max speed limits
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

            // Limit vertical velocity component explicitly to prevent steep diving/climbing
            // This forces "forwardish" flight
            if (Math.abs(vy) > this.speedLimit * 0.3) {
                vy = Math.sign(vy) * this.speedLimit * 0.3;
            }

            // --- Integration ---
            this.velocities[idx] = vx;
            this.velocities[idx + 1] = vy;
            this.velocities[idx + 2] = vz;

            this.positions[idx] += vx * dt;
            this.positions[idx + 1] += vy * dt;
            this.positions[idx + 2] += vz * dt;

            // --- Update Bird Group ---
            const bird = this.birds[i];
            bird.group.position.set(
                this.positions[idx],
                this.positions[idx + 1],
                this.positions[idx + 2]
            );

            // Orient to velocity - bird faces direction of travel
            const targetPos = bird.group.position.clone().add(new THREE.Vector3(vx, vy, vz));
            bird.group.lookAt(targetPos);

            // --- Wing Flapping Animation ---
            // Flap frequency increases with speed
            const currentSpeed = Math.sqrt(vx * vx + vy * vy + vz * vz);
            const flapSpeed = 8 + (currentSpeed / this.speedLimit) * 6; // 8-14 Hz based on speed

            const wingAngle = Math.sin(this.time * flapSpeed + this.wingPhases[i]) * 0.6; // ±0.6 radians (~34 degrees)

            // Animate left wing (rotate around X axis to flap up/down)
            bird.leftWing.rotation.x = wingAngle;

            // Animate right wing (opposite direction for symmetric flapping)
            bird.rightWing.rotation.x = -wingAngle;
        }

        // Update time for wing animation
        this.time += dt;
    }
}
