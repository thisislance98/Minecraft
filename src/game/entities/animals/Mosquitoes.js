import * as THREE from 'three';

export class MosquitoManager {
    constructor(game, count = 30) {
        this.game = game;
        this.count = count;
        this.lastGlobalBiteTime = 0;
        this.lastGlobalBiteTime = 0;
        this.bounds = 60; // Stay broadly around player, but not too tight

        // Boid parameters
        this.separationDistance = 2.0;
        this.alignmentDistance = 5.0;
        this.cohesionDistance = 5.0;

        this.separationForce = 1.5;
        this.alignmentForce = 0.5;
        this.cohesionForce = 0.8;

        this.speedLimit = 6;
        this.speedMin = 2;

        // Physics state
        this.positions = new Float32Array(count * 3);
        this.velocities = new Float32Array(count * 3);

        // Cooldowns for biting
        this.biteCooldowns = new Float32Array(count);

        // Wing animation phase offsets
        this.wingPhases = new Float32Array(count);

        // Individual target offsets around player
        this.targetOffsets = new Float32Array(count * 3);
        this.nextOffsetTime = new Float32Array(count);

        // Initialize random positions and velocities
        for (let i = 0; i < count; i++) {
            // Spread out spawn significantly
            const x = (Math.random() - 0.5) * 100 + 32;
            const y = Math.random() * 20 + 70;
            const z = (Math.random() - 0.5) * 100 + 32;

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
            this.biteCooldowns[i] = Math.random() * 5; // Random start delay

            // Initialize random target offset
            this.updateTargetOffset(i);
        }

        // Time tracker for animation
        this.time = 0;

        // Create mosquito group
        this.mosquitoGroup = new THREE.Group();
        this.mosquitoes = [];

        for (let i = 0; i < count; i++) {
            const mosquito = this.createMosquito();
            this.mosquitoes.push(mosquito);
            this.mosquitoGroup.add(mosquito.group);
        }

        this.game.scene.add(this.mosquitoGroup);
    }

    updateTargetOffset(i) {
        // Pick a random point around the player to hover near
        // Range: +/- 10-15 units horizontal, +/- 5 units vertical
        this.targetOffsets[i * 3] = (Math.random() - 0.5) * 30;
        this.targetOffsets[i * 3 + 1] = Math.random() * 5; // Positive offset only (0 to 5 above head)
        this.targetOffsets[i * 3 + 2] = (Math.random() - 0.5) * 30;

        // Pick next time to change target (5-10 seconds)
        this.nextOffsetTime[i] = this.time + 5 + Math.random() * 5;
    }

    createMosquito() {
        const group = new THREE.Group();
        const meshGroup = new THREE.Group();
        group.add(meshGroup);

        const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x1a1a1a }); // Dark, almost black
        const wingMaterial = new THREE.MeshBasicMaterial({
            color: 0xcccccc,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });

        // Body - Tiny line/box
        const bodyGeo = new THREE.BoxGeometry(0.05, 0.05, 0.15);
        const body = new THREE.Mesh(bodyGeo, bodyMaterial);
        meshGroup.add(body);

        // Legs (simulated with a cross or just assumed barely visible)
        // Proboscis
        const proboscisGeo = new THREE.BoxGeometry(0.01, 0.01, 0.1);
        const proboscis = new THREE.Mesh(proboscisGeo, bodyMaterial);
        proboscis.position.set(0, 0, 0.12);
        meshGroup.add(proboscis);

        // Wings
        const wingGeo = new THREE.PlaneGeometry(0.15, 0.1);
        wingGeo.translate(0.075, 0, 0); // Pivot at body

        const leftWing = new THREE.Mesh(wingGeo, wingMaterial);
        leftWing.position.set(0.02, 0.03, 0);
        leftWing.rotation.x = -Math.PI / 2;
        meshGroup.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeo, wingMaterial);
        rightWing.position.set(-0.02, 0.03, 0);
        rightWing.rotation.x = -Math.PI / 2;
        rightWing.rotation.z = Math.PI; // Mirror
        meshGroup.add(rightWing);

        // Rotate so it faces +Z (velocity direction)
        meshGroup.rotation.y = Math.PI; // Original models face different? Let's check. 
        // Actually, let's keep it simple: assume model forward is +Z.
        // My body is long on Z (0.15). Proboscis is at +0.12 Z. So +Z is forward.

        return {
            group,
            leftWing,
            rightWing,
            meshGroup
        };
    }

    update(dt, player) {
        const cx = player.position.x;
        const cy = player.position.y + 1.6; // Target head height
        const cz = player.position.z;

        for (let i = 0; i < this.count; i++) {
            const idx = i * 3;
            let px = this.positions[idx];
            let py = this.positions[idx + 1];
            let pz = this.positions[idx + 2];

            let vx = this.velocities[idx];
            let vy = this.velocities[idx + 1];
            let vz = this.velocities[idx + 2];

            // Cooldown update
            if (this.biteCooldowns[i] > 0) {
                this.biteCooldowns[i] -= dt;
            }

            // --- Reduced Boids Rules (Separation REMOVED) ---
            // Flocking removed per user request.
            let sepX = 0, sepY = 0, sepZ = 0;


            // --- Steering ---
            // Only apply separation force. No alignment or cohesion.
            vx += (sepX * this.separationForce) * dt;
            vy += (sepY * this.separationForce) * dt;
            vz += (sepZ * this.separationForce) * dt;

            // --- Attraction to Player ---
            // --- Attraction to Player (Calculated Target) ---
            if (this.time > this.nextOffsetTime[i]) {
                this.updateTargetOffset(i);
            }

            const tx = cx + this.targetOffsets[idx];
            const ty = cy + this.targetOffsets[idx + 1];
            const tz = cz + this.targetOffsets[idx + 2];

            const distToTargetSq = (px - tx) ** 2 + (py - ty) ** 2 + (pz - tz) ** 2;
            const distToTarget = Math.sqrt(distToTargetSq);

            // Check real distance to player for bounds checking
            const distToPlayerSq = (px - cx) ** 2 + (py - cy) ** 2 + (pz - cz) ** 2;
            const distToPlayer = Math.sqrt(distToPlayerSq);

            if (distToPlayer > this.bounds) {
                // Too far! Steer strongly towards player center
                const factor = 1.0 * dt;
                vx += (cx - px) * factor;
                vy += (cy - py) * factor;
                vz += (cz - pz) * factor;
            } else {
                // Wander towards individual target
                const factor = 0.5 * dt; // Gentler attraction
                vx += (tx - px) * factor;
                vy += (ty - py) * factor;
                vz += (tz - pz) * factor;

                // Chaotic movement
                if (Math.random() < 0.05) {
                    vx += (Math.random() - 0.5) * 10 * dt;
                    vy += (Math.random() - 0.5) * 10 * dt;
                    vz += (Math.random() - 0.5) * 10 * dt;
                }
            }

            // --- Block Collision Avoidance ---
            // Check current position for blocks
            const hitBlock = this.game.getBlock(Math.floor(px), Math.floor(py - 0.2), Math.floor(pz)) ||
                this.game.getBlock(Math.floor(px), Math.floor(py + 0.5), Math.floor(pz));

            if (hitBlock) {
                // We are inside a block! 
                // Instead of bouncing, move out gently but firmly towards free space if possible, 
                // or just push up if stuck.
                vy += 10 * dt; // Gentle push up

                // Dampen horizontal movement to stop "bouncing" around inside
                vx *= 0.9;
                vz *= 0.9;
            }

            // Raycast-like avoidance (future position check)
            const lookAhead = 1.0;
            const nextX = px + vx * dt * lookAhead;
            const nextY = py + vy * dt * lookAhead;
            const nextZ = pz + vz * dt * lookAhead;

            if (this.game.getBlock(Math.floor(nextX), Math.floor(nextY), Math.floor(nextZ))) {
                // Impending collision, turn away instead of bouncing

                // Reduce speed
                vx *= 0.5;
                vy *= 0.5;
                vz *= 0.5;

                // Apply a steering force away from the obstacle direction? 
                // Since we don't have a normal, we'll try to steer randomly but *away*.
                // Actually, just stopping or slowing down and picking a new direction is better than "bouncing" (inverting velocity).

                // Add a random push to steer them elsewhere
                vx += (Math.random() - 0.5) * 5 * dt;
                vy += (Math.random() * 0.5 + 0.5) * 5 * dt; // Prefer up slightly
                vz += (Math.random() - 0.5) * 5 * dt;
            }

            // --- Biting ---
            if (distToPlayer < 1.5 && this.biteCooldowns[i] <= 0) {
                // Global cooldown check: only allowing one bite every 2 seconds for the whole swarm
                const now = performance.now() / 1000;
                if (now - this.lastGlobalBiteTime > 2.0) {
                    player.takeDamage(1);
                    console.log("Mosquito bit player!");
                    this.biteCooldowns[i] = 10.0 + Math.random() * 10.0; // 10-20 seconds individual cooldown
                    this.lastGlobalBiteTime = now;

                    // Move away after bite, but don't "bounce" hard
                    // Just drift up and away
                    vx += (Math.random() - 0.5) * 5;
                    vy += 2.0; // Fly up
                    vz += (Math.random() - 0.5) * 5;
                }
            }

            // --- Bounds & Speed Limits ---
            const speedSq = vx * vx + vy * vy + vz * vz;
            const speed = Math.sqrt(speedSq);

            if (speed > this.speedLimit) {
                const ratio = this.speedLimit / speed;
                vx *= ratio; vy *= ratio; vz *= ratio;
            } else if (speed < this.speedMin) {
                const ratio = this.speedMin / speed;
                vx *= ratio; vy *= ratio; vz *= ratio;
            }

            // Simple floor clamp as last resort to prevent infinity fall
            // Also avoid ground generally
            const groundY = player.position.y;
            if (py < groundY + 1.0) {
                vy += 5.0 * dt; // Stronger push up if near player foot level
            }

            if (py < -64) {
                vy += 10 * dt;
            }

            // --- Integrate ---
            this.velocities[idx] = vx;
            this.velocities[idx + 1] = vy;
            this.velocities[idx + 2] = vz;

            this.positions[idx] += vx * dt;
            this.positions[idx + 1] += vy * dt;
            this.positions[idx + 2] += vz * dt;

            // --- Transform ---
            const mosquito = this.mosquitoes[i];
            mosquito.group.position.set(
                this.positions[idx],
                this.positions[idx + 1],
                this.positions[idx + 2]
            );

            const targetPos = mosquito.group.position.clone().add(new THREE.Vector3(vx, vy, vz));
            mosquito.group.lookAt(targetPos);

            // --- Animation ---
            // Very fast wing flapping
            const flapSpeed = 30; // High frequency
            const wingAngle = Math.sin(this.time * flapSpeed + this.wingPhases[i]) * 0.5;

            // Wings flap around Z axis related to body (flat planes rotating up/down)
            // Initial rotation was x = -PI/2 (flat horizontal)
            // We want to rotate around local Y or X to flap.
            // Since they are pivoted, let's rotate around Y

            mosquito.leftWing.rotation.y = wingAngle;
            mosquito.rightWing.rotation.y = -wingAngle;
        }

        this.time += dt;
    }

    clear() {
        this.count = 0;
        if (this.mosquitoGroup) {
            this.game.scene.remove(this.mosquitoGroup);
            this.mosquitoGroup.traverse(obj => {
                if (obj.isMesh) {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                        else obj.material.dispose();
                    }
                }
            });
        }
        this.mosquitoes = [];
    }
}
