import * as THREE from 'three';

export class BatManager {
    constructor(game, count = 20) {
        this.game = game;
        this.count = count;
        this.bounds = 15; // Hunt within this radius of player (Reduced from 40)

        // Boid parameters
        this.separationDistance = 3.0;
        this.alignmentDistance = 8.0;
        this.cohesionDistance = 8.0;

        this.separationForce = 2.0;
        this.alignmentForce = 0.8;
        this.cohesionForce = 1.0;

        // TUNED: Slower speed
        this.speedLimit = 6;
        this.speedMin = 2;

        // Physics state
        this.positions = new Float32Array(count * 3);
        this.velocities = new Float32Array(count * 3);

        // Cooldowns for biting
        this.biteCooldowns = new Float32Array(count);

        // Wing animation phase offsets
        this.wingPhases = new Float32Array(count);

        // Initialize random positions and velocities
        for (let i = 0; i < count; i++) {
            // Spawn around player but high up or in caves (simulated by random start)
            // For now, spawn in air around player similar to birds but lower
            const x = (Math.random() - 0.5) * 60 + 32;
            const y = Math.random() * 20 + 30;
            const z = (Math.random() - 0.5) * 60 + 32;

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
            this.biteCooldowns[i] = Math.random() * 15;
        }

        // Time tracker for animation
        this.time = 0;

        // Create bat group
        this.batGroup = new THREE.Group();
        this.bats = [];

        for (let i = 0; i < count; i++) {
            const bat = this.createBat();
            this.bats.push(bat);
            this.batGroup.add(bat.group);
        }

        this.game.scene.add(this.batGroup);
    }

    createBat() {
        const group = new THREE.Group();
        const meshGroup = new THREE.Group();
        group.add(meshGroup);

        const material = new THREE.MeshLambertMaterial({ color: 0x1a1a1a }); // Dark Grey/Black

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.3, 0.25, 0.4);
        const body = new THREE.Mesh(bodyGeo, material);
        meshGroup.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const head = new THREE.Mesh(headGeo, material);
        head.position.set(0, 0.05, 0.25); // Forward
        meshGroup.add(head);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.05, 0.1, 0.05);

        const leftEar = new THREE.Mesh(earGeo, material);
        leftEar.position.set(0.08, 0.15, 0.25);
        meshGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, material);
        rightEar.position.set(-0.08, 0.15, 0.25);
        meshGroup.add(rightEar);

        // Wings
        const wingSpan = 0.6;
        const wingWidth = 0.35;
        const wingThickness = 0.02;

        const wingGeo = new THREE.BoxGeometry(wingSpan, wingThickness, wingWidth);
        wingGeo.translate(wingSpan / 2, 0, 0); // Pivot at body

        const leftWing = new THREE.Mesh(wingGeo, material);
        leftWing.position.set(0.15, 0.1, 0);
        meshGroup.add(leftWing);

        const rightWingGeo = wingGeo.clone();
        rightWingGeo.scale(-1, 1, 1); // Mirror
        const rightWing = new THREE.Mesh(rightWingGeo, material);
        rightWing.position.set(-0.15, 0.1, 0);
        meshGroup.add(rightWing);

        // Rotate so +Z is forward for simplified physics logic
        // Current model: 
        // Body length is Z (0.4). Head is at Z=0.25. 
        // So model faces +Z. Correct.

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

    update(dt, player, animals) {
        // Collect potential targets
        const targets = [];
        if (player) {
            // Player is no longer a target
            // targets.push({ pos: player.position, type: 'player', entity: player }); 
        }

        // Removed animal targeting to prevent them from wiping out livestock

        // Default center of flight (player) if no targets
        const cx = player.position.x;
        const cy = player.position.y + 1.2;
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
                alignX /= neighborCount; alignY /= neighborCount; alignZ /= neighborCount;
                cohX /= neighborCount; cohY /= neighborCount; cohZ /= neighborCount;
                cohX = (cohX - px); cohY = (cohY - py); cohZ = (cohZ - pz);
            }

            // --- Steering ---
            vx += (sepX * this.separationForce + alignX * this.alignmentForce + cohX * this.cohesionForce) * dt;
            vy += (sepY * this.separationForce + alignY * this.alignmentForce + cohY * this.cohesionForce) * dt;
            vz += (sepZ * this.separationForce + alignZ * this.alignmentForce + cohZ * this.cohesionForce) * dt;

            // --- Find Nearest Target ---
            let closestDistSq = Infinity;
            let target = null;

            for (const t of targets) {
                const distSq = (px - t.pos.x) ** 2 + (py - t.pos.y) ** 2 + (pz - t.pos.z) ** 2;
                if (distSq < closestDistSq && distSq < this.bounds * this.bounds) {
                    closestDistSq = distSq;
                    target = t;
                }
            }

            // --- Attraction/Attack ---
            if (target) {
                const tx = target.pos.x;
                const ty = target.pos.y + (target.type === 'player' ? 1.2 : 0.5); // Aim for head/body center
                const tz = target.pos.z;

                // TUNED: Less aggressive chase
                const factor = 1.5 * dt;
                vx += (tx - px) * factor;
                vy += (ty - py) * factor;
                vz += (tz - pz) * factor;

                // --- Biting ---
                if (closestDistSq < 1.0 && this.biteCooldowns[i] <= 0) {
                    // Attack!
                    target.entity.takeDamage(1);
                    console.log(`Bat attacked ${target.type}!`);
                    this.biteCooldowns[i] = 10.0 + Math.random() * 10.0;

                    // TUNED: Gentler swoop away
                    vx = -vx * 1.0;
                    vy = Math.abs(vy) + 5; // Fly up quickly
                    vz = -vz * 1.0;
                }
            } else {
                // If no targets, just roam/boid but stay roughly in area
                const distFromCenter = Math.sqrt((px - cx) ** 2 + (pz - cz) ** 2);
                if (distFromCenter > this.bounds) {
                    const angle = Math.atan2(pz - cz, px - cx);
                    vx -= Math.cos(angle) * 2 * dt;
                    vz -= Math.sin(angle) * 2 * dt;
                } else {
                    // Slight wander
                    const angle = this.time + i; // simplistic deterministic noise
                    vx += Math.cos(angle) * 1 * dt;
                    vz += Math.sin(angle) * 1 * dt;
                }
            }

            // --- Speed Limits ---
            const speedSq = vx * vx + vy * vy + vz * vz;
            const speed = Math.sqrt(speedSq);

            if (speed > this.speedLimit) {
                const ratio = this.speedLimit / speed;
                vx *= ratio; vy *= ratio; vz *= ratio;
            } else if (speed < this.speedMin) {
                const ratio = this.speedMin / speed;
                vx *= ratio; vy *= ratio; vz *= ratio;
            }

            // Avoid ground
            if (py < cy - 2) { // Try to stay just below/at eye level or above
                vy += 8 * dt;
            }
            if (py < -30) { // Hard floor check just in case
                vy += 20 * dt;
            }

            // --- Integrate ---
            this.velocities[idx] = vx;
            this.velocities[idx + 1] = vy;
            this.velocities[idx + 2] = vz;

            this.positions[idx] += vx * dt;
            this.positions[idx + 1] += vy * dt;
            this.positions[idx + 2] += vz * dt;

            // --- Transform ---
            const bat = this.bats[i];
            bat.group.position.set(
                this.positions[idx],
                this.positions[idx + 1],
                this.positions[idx + 2]
            );

            const targetPos = bat.group.position.clone().add(new THREE.Vector3(vx, vy, vz));
            bat.group.lookAt(targetPos);

            // --- Animation ---
            // Flapping
            const flapSpeed = 15;
            const wingAngle = Math.sin(this.time * flapSpeed + this.wingPhases[i]) * 0.7;

            // Flap around Z axis (roll) relative to body for proper bat wing motion
            bat.leftWing.rotation.z = -wingAngle;
            bat.rightWing.rotation.z = wingAngle;
        }

        this.time += dt;
    }

    clear() {
        this.count = 0;
        if (this.batGroup) {
            this.game.scene.remove(this.batGroup);
            this.batGroup.traverse(obj => {
                if (obj.isMesh) {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                        else obj.material.dispose();
                    }
                }
            });
        }
        this.bats = [];
    }
}
