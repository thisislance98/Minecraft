import * as THREE from 'three';

export class WorldParticleSystem {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;

        // Settings
        this.fireflyCount = 200;
        this.leafCount = 300;
        this.areaSize = 60; // Radius around player

        // Systems
        this.fireflies = null;
        this.leaves = null;

        // Data for animation
        this.fireflyData = []; // { velocity: Vector3, timeOffset: number, active: boolean }
        this.leafData = []; // { velocity: Vector3, swaySpeed: number, swayOffset: number, active: boolean }

        this.initFireflies();
        this.initLeaves();
    }

    initFireflies() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.fireflyCount * 3);
        const colors = new Float32Array(this.fireflyCount * 3);

        const color = new THREE.Color(0xccff00); // Yellow-Green

        for (let i = 0; i < this.fireflyCount; i++) {
            // Start hidden/inactive
            positions[i * 3] = 0;
            positions[i * 3 + 1] = -5000;
            positions[i * 3 + 2] = 0;

            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;

            // Velocity and specialized data
            this.fireflyData.push({
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.5,
                    (Math.random() - 0.5) * 0.5,
                    (Math.random() - 0.5) * 0.5
                ),
                timeOffset: Math.random() * 100,
                active: false
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.2,
            vertexColors: true,
            transparent: true,
            opacity: 0, // Start invisible, fade in at night
            blending: THREE.AdditiveBlending
        });

        this.fireflies = new THREE.Points(geometry, material);
        this.scene.add(this.fireflies);
    }

    initLeaves() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.leafCount * 3);
        const colors = new Float32Array(this.leafCount * 3);

        const color = new THREE.Color(0x228b22); // Forest Green

        for (let i = 0; i < this.leafCount; i++) {
            // Start hidden/inactive
            positions[i * 3] = 0;
            positions[i * 3 + 1] = -5000;
            positions[i * 3 + 2] = 0;

            // Vary color slightly
            const c = color.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;

            this.leafData.push({
                speed: 0.5 + Math.random() * 1.0, // Fall speed
                swaySpeed: 1 + Math.random() * 2,
                swayOffset: Math.random() * Math.PI * 2,
                active: false
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.15,
            vertexColors: true,
            transparent: true,
            opacity: 0.8
        });

        this.leaves = new THREE.Points(geometry, material);
        this.scene.add(this.leaves);
    }

    update(deltaTime, playerPosition) {
        this.updateFireflies(deltaTime, playerPosition);
        this.updateLeaves(deltaTime, playerPosition);
    }

    updateFireflies(deltaTime, playerPosition) {
        // Opacity based on time of day
        let targetOpacity = 0;
        if (this.game.environment && this.game.environment.isNight()) {
            targetOpacity = 0.8;
        }

        // Fade in/out
        const currentOpacity = this.fireflies.material.opacity;
        if (Math.abs(currentOpacity - targetOpacity) > 0.01) {
            this.fireflies.material.opacity += (targetOpacity - currentOpacity) * deltaTime * 0.5;
        }

        // Even if invisible, we update logic so they are ready when it turns dark? 
        // Or minimize updates. Let's minimize, but ensure we spawn some if needed.
        if (targetOpacity < 0.05 && currentOpacity < 0.05) return;

        const positions = this.fireflies.geometry.attributes.position.array;
        const boxSize = this.areaSize;
        const halfBox = boxSize / 2;

        for (let i = 0; i < this.fireflyCount; i++) {
            let x = positions[i * 3];
            let y = positions[i * 3 + 1];
            let z = positions[i * 3 + 2];

            const data = this.fireflyData[i];

            if (!data.active) {
                // Try to spawn (throttle to avoid massive lag spike on first frame)
                if (Math.random() < 0.05) {
                    const tryX = playerPosition.x + (Math.random() - 0.5) * boxSize;
                    const tryZ = playerPosition.z + (Math.random() - 0.5) * boxSize;
                    const tryY = playerPosition.y + (Math.random() * 10) - 2; // -2 to +8 relative to player

                    // Check if valid area: Above Grass or Water
                    // Get block just below the potential spawn point
                    const blockBelow = this.game.getBlock(tryX, tryY - 1, tryZ);

                    if (blockBelow && (
                        blockBelow.type.includes('grass') ||
                        blockBelow.type.includes('water') ||
                        blockBelow.type.includes('log') ||
                        blockBelow.type.includes('leaves')
                    )) {
                        // Also check if spawn point is AIR (don't spawn inside blocks)
                        const blockAt = this.game.getBlock(tryX, tryY, tryZ);
                        if (!blockAt || blockAt.type === 'air' || blockAt.type === 'water') {
                            x = tryX;
                            y = tryY;
                            z = tryZ;
                            data.active = true;
                        }
                    }
                }
            } else {
                // Active update
                const time = Date.now() * 0.001 + data.timeOffset;

                x += Math.sin(time) * deltaTime * 0.5 + data.velocity.x * deltaTime;
                y += Math.cos(time * 0.7) * deltaTime * 0.5 + data.velocity.y * deltaTime;
                z += Math.sin(time * 0.3) * deltaTime * 0.5 + data.velocity.z * deltaTime;

                // Check bounds relative to player
                const dx = x - playerPosition.x;
                const dy = y - playerPosition.y;
                const dz = z - playerPosition.z;

                // If too far, despawn/reset
                if (Math.abs(dx) > halfBox || Math.abs(dz) > halfBox || dy > 20 || dy < -10) {
                    data.active = false;
                    y = -5000;
                }
            }

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
        }

        this.fireflies.geometry.attributes.position.needsUpdate = true;
    }

    updateLeaves(deltaTime, playerPosition) {
        const positions = this.leaves.geometry.attributes.position.array;
        const boxSize = this.areaSize;
        const halfBox = boxSize / 2;
        const time = Date.now() * 0.001;

        for (let i = 0; i < this.leafCount; i++) {
            let x = positions[i * 3];
            let y = positions[i * 3 + 1];
            let z = positions[i * 3 + 2];

            const data = this.leafData[i];

            if (!data.active) {
                // Try to spawn
                // Leaves fall from trees. 
                // We pick a random X/Z, then scan UP from player height to find leaves.
                if (Math.random() < 0.1) {
                    const tryX = playerPosition.x + (Math.random() - 0.5) * boxSize;
                    const tryZ = playerPosition.z + (Math.random() - 0.5) * boxSize;

                    // Raycast UP-ish. Start from player Y to +20
                    const startY = Math.floor(playerPosition.y);
                    const endY = startY + 20;

                    let foundY = -1;
                    // Check blocks in column
                    // We prefer spawning just below the leaves
                    for (let checkY = startY; checkY < endY; checkY++) {
                        const block = this.game.getBlock(tryX, checkY, tryZ);
                        if (block && block.type.includes('leaves')) {
                            // Spawn below this block
                            foundY = checkY - 0.5;
                            // Don't break immediately, maybe there are higher leaves? 
                            // Actually, we want the LOWEST leaves usually, or just any leaves.
                            // If we spawn below the *lowest* leaves, it looks like they fell from them.
                            break;
                        }
                    }

                    if (foundY !== -1) {
                        x = tryX;
                        y = foundY;
                        z = tryZ;
                        data.active = true;
                    }
                }
            } else {
                // Active update
                // Fall down
                y -= data.speed * deltaTime;

                // Wind Sway
                x += Math.sin(time * data.swaySpeed + data.swayOffset) * deltaTime * 1.0;
                z += Math.cos(time * data.swaySpeed * 0.8 + data.swayOffset) * deltaTime * 0.5;

                // Check bounds
                const dx = x - playerPosition.x;
                const dy = y - playerPosition.y;
                const dz = z - playerPosition.z;

                // Check if it hit ground or went too far
                if (Math.abs(dx) > halfBox || Math.abs(dz) > halfBox || dy < -10) {
                    data.active = false; // Reset
                    y = -5000;
                }
            }

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
        }

        this.leaves.geometry.attributes.position.needsUpdate = true;
    }
}
