import * as THREE from 'three';

export class WorldParticleSystem {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;

        // Settings
        this.fireflyCount = 200;
        this.leafCount = 300;
        this.genericParticleCount = 1000;
        this.areaSize = 60; // Radius around player

        // Systems
        this.fireflies = null;
        this.leaves = null;
        this.genericParticles = null;

        // Data for animation
        this.fireflyData = []; // { velocity: Vector3, timeOffset: number, active: boolean }
        this.leafData = []; // { velocity: Vector3, swaySpeed: number, swayOffset: number, active: boolean }
        this.genericParticleData = []; // { velocity: Vector3, life: number, maxLife: number, active: boolean }
        this.blockParticleData = []; // { velocity: Vector3, life: number, active: boolean, mesh: THREE.Mesh }
        this.blockParticleCount = 100;

        this.initFireflies();
        this.initLeaves();
        this.initGenericParticles();
        this.initBlockParticles();
    }

    initFireflies() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.fireflyCount * 3);
        const colors = new Float32Array(this.fireflyCount * 3);

        const color = new THREE.Color(0xccff00); // Yellow-Green

        for (let i = 0; i < this.fireflyCount; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = -5000;
            positions[i * 3 + 2] = 0;

            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;

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
            opacity: 0,
            blending: THREE.AdditiveBlending
        });

        this.fireflies = new THREE.Points(geometry, material);
        this.scene.add(this.fireflies);
    }

    initLeaves() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.leafCount * 3);
        const colors = new Float32Array(this.leafCount * 3);

        const color = new THREE.Color(0x228b22);

        for (let i = 0; i < this.leafCount; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = -5000;
            positions[i * 3 + 2] = 0;

            const c = color.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;

            this.leafData.push({
                speed: 0.5 + Math.random() * 1.0,
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

    initGenericParticles() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.genericParticleCount * 3);
        const colors = new Float32Array(this.genericParticleCount * 3);
        const sizes = new Float32Array(this.genericParticleCount);

        for (let i = 0; i < this.genericParticleCount; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = -5000;
            positions[i * 3 + 2] = 0;

            colors[i * 3] = 1;
            colors[i * 3 + 1] = 1;
            colors[i * 3 + 2] = 1;

            sizes[i] = 1.0;

            this.genericParticleData.push({
                velocity: new THREE.Vector3(),
                life: 0,
                maxLife: 0,
                active: false
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        // Note: size attribute requires custom shader material usually, 
        // PointsMaterial uses a single size. We'll use a single size for now to keep it simple
        // or just ignore size per particle for now.

        const material = new THREE.PointsMaterial({
            size: 0.2,
            vertexColors: true,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });

        this.genericParticles = new THREE.Points(geometry, material);
        this.scene.add(this.genericParticles);
    }

    initBlockParticles() {
        // Pool of meshes for block breaking effects
        const geometry = new THREE.BoxGeometry(0.15, 0.15, 0.15);
        // Default material, will be swapped on spawn
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });

        for (let i = 0; i < this.blockParticleCount; i++) {
            const mesh = new THREE.Mesh(geometry, material.clone());
            mesh.visible = false;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);

            this.blockParticleData.push({
                mesh: mesh,
                velocity: new THREE.Vector3(),
                life: 0,
                active: false
            });
        }
    }

    spawnBlockParticles(pos, blockType) {
        if (!blockType || !this.game.blockMaterialIndices[blockType]) return;

        const count = 8; // Particles per block
        let spawned = 0;

        // Get material(s)
        const indices = this.game.blockMaterialIndices[blockType];

        for (let i = 0; i < this.blockParticleCount; i++) {
            if (spawned >= count) break;

            const data = this.blockParticleData[i];
            if (!data.active) {
                data.active = true;
                data.life = 1.0 + Math.random() * 0.5;

                // Position: Center of block + spread
                data.mesh.position.set(
                    pos.x + (Math.random() - 0.5) * 0.8 + 0.5,
                    pos.y + (Math.random() - 0.5) * 0.8 + 0.5,
                    pos.z + (Math.random() - 0.5) * 0.8 + 0.5
                );

                // Velocity: Explode out
                data.velocity.set(
                    (Math.random() - 0.5) * 4.0,
                    Math.random() * 3.0 + 1.0,
                    (Math.random() - 0.5) * 4.0
                );

                // Material
                // Pick random texture from the block's available textures (e.g. grass top vs side)
                const matIdx = indices[Math.floor(Math.random() * indices.length)];
                if (this.game.assetManager.materialArray[matIdx]) {
                    data.mesh.material = this.game.assetManager.materialArray[matIdx];
                    data.mesh.visible = true;
                    // Reset rotation
                    data.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                } else {
                    data.active = false; // validation fail
                    continue;
                }

                spawned++;
            }
        }
    }

    spawn(options = {}) {
        const {
            position = new THREE.Vector3(),
            velocity = new THREE.Vector3(),
            color = 0xffffff,
            life = 1.0,
            size = 0.2
        } = options;

        // Find inactive particle
        for (let i = 0; i < this.genericParticleCount; i++) {
            const data = this.genericParticleData[i];
            if (!data.active) {
                data.active = true;
                data.velocity.copy(velocity);
                data.life = life;
                data.maxLife = life;

                const positions = this.genericParticles.geometry.attributes.position.array;
                positions[i * 3] = position.x;
                positions[i * 3 + 1] = position.y;
                positions[i * 3 + 2] = position.z;
                this.genericParticles.geometry.attributes.position.needsUpdate = true;

                const c = new THREE.Color(color);
                const colors = this.genericParticles.geometry.attributes.color.array;
                colors[i * 3] = c.r;
                colors[i * 3 + 1] = c.g;
                colors[i * 3 + 2] = c.b;
                this.genericParticles.geometry.attributes.color.needsUpdate = true;

                return;
            }
        }
    }

    update(deltaTime, playerPosition) {
        this.updateFireflies(deltaTime, playerPosition);
        this.updateLeaves(deltaTime, playerPosition);
        this.updateGenericParticles(deltaTime);
        this.updateBlockParticles(deltaTime);
    }

    updateBlockParticles(deltaTime) {
        for (let i = 0; i < this.blockParticleCount; i++) {
            const data = this.blockParticleData[i];
            if (!data.active) continue;

            data.life -= deltaTime;
            if (data.life <= 0) {
                data.active = false;
                data.mesh.visible = false;
                continue;
            }

            // Physics
            data.velocity.y -= 9.8 * deltaTime; // Gravity

            data.mesh.position.x += data.velocity.x * deltaTime;
            data.mesh.position.y += data.velocity.y * deltaTime;
            data.mesh.position.z += data.velocity.z * deltaTime;

            data.mesh.rotation.x += data.velocity.z * deltaTime;
            data.mesh.rotation.y += data.velocity.x * deltaTime;

            // Ground collision check
            if (data.mesh.position.y < -100) { // Safety floor
                data.active = false;
                data.mesh.visible = false;
                continue;
            }

            // Simple block collision (optional, can be expensive)
            // Just check floor
            const bx = Math.floor(data.mesh.position.x);
            const by = Math.floor(data.mesh.position.y);
            const bz = Math.floor(data.mesh.position.z);
            const block = this.game.getBlock(bx, by, bz);
            if (block && block.type !== 'air' && block.type !== 'water') {
                // Determine collision depth?
                // Just stop?
                // data.velocity.multiplyScalar(0);
                // Bounce?
                if (data.velocity.y < 0) {
                    data.velocity.y *= -0.5;
                    data.velocity.x *= 0.8;
                    data.velocity.z *= 0.8;
                }
                // Push out
                if (data.velocity.lengthSq() < 0.1) {
                    // settle
                }
            }
        }
    }

    updateGenericParticles(deltaTime) {
        const positions = this.genericParticles.geometry.attributes.position.array;
        const colors = this.genericParticles.geometry.attributes.color.array;

        for (let i = 0; i < this.genericParticleCount; i++) {
            const data = this.genericParticleData[i];
            if (!data.active) continue;

            data.life -= deltaTime;
            if (data.life <= 0) {
                data.active = false;
                positions[i * 3 + 1] = -5000; // Move far away
                continue;
            }

            // Update position
            positions[i * 3] += data.velocity.x * deltaTime;
            positions[i * 3 + 1] += data.velocity.y * deltaTime;
            positions[i * 3 + 2] += data.velocity.z * deltaTime;

            // Fade out
            // Since we use vertex colors, we could fade the color to black?
            // Or use a more complex material. For now let's just keep it simple.
        }

        this.genericParticles.geometry.attributes.position.needsUpdate = true;
    }

    updateFireflies(deltaTime, playerPosition) {
        let targetOpacity = 0;
        if (this.game.environment && this.game.environment.isNight()) {
            targetOpacity = 0.8;
        }

        const currentOpacity = this.fireflies.material.opacity;
        if (Math.abs(currentOpacity - targetOpacity) > 0.01) {
            this.fireflies.material.opacity += (targetOpacity - currentOpacity) * deltaTime * 0.5;
        }

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
                if (Math.random() < 0.05) {
                    const tryX = playerPosition.x + (Math.random() - 0.5) * boxSize;
                    const tryZ = playerPosition.z + (Math.random() - 0.5) * boxSize;
                    const tryY = playerPosition.y + (Math.random() * 10) - 2;

                    const blockBelow = this.game.getBlock(tryX, tryY - 1, tryZ);
                    if (blockBelow && (
                        blockBelow.type.includes('grass') ||
                        blockBelow.type.includes('water') ||
                        blockBelow.type.includes('log') ||
                        blockBelow.type.includes('leaves')
                    )) {
                        const blockAt = this.game.getBlock(tryX, tryY, tryZ);
                        if (!blockAt || blockAt.type === 'air' || blockAt.type === 'water') {
                            x = tryX; y = tryY; z = tryZ;
                            data.active = true;
                        }
                    }
                }
            } else {
                const time = Date.now() * 0.001 + data.timeOffset;
                x += Math.sin(time) * deltaTime * 0.5 + data.velocity.x * deltaTime;
                y += Math.cos(time * 0.7) * deltaTime * 0.5 + data.velocity.y * deltaTime;
                z += Math.sin(time * 0.3) * deltaTime * 0.5 + data.velocity.z * deltaTime;

                const dx = x - playerPosition.x;
                const dy = y - playerPosition.y;
                const dz = z - playerPosition.z;

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
                if (Math.random() < 0.1) {
                    const tryX = playerPosition.x + (Math.random() - 0.5) * boxSize;
                    const tryZ = playerPosition.z + (Math.random() - 0.5) * boxSize;
                    const startY = Math.floor(playerPosition.y);
                    const endY = startY + 20;

                    let foundY = -1;
                    for (let checkY = startY; checkY < endY; checkY++) {
                        const block = this.game.getBlock(tryX, checkY, tryZ);
                        if (block && block.type.includes('leaves')) {
                            foundY = checkY - 0.5;
                            break;
                        }
                    }

                    if (foundY !== -1) {
                        x = tryX; y = foundY; z = tryZ;
                        data.active = true;
                    }
                }
            } else {
                y -= data.speed * deltaTime;
                x += Math.sin(time * data.swaySpeed + data.swayOffset) * deltaTime * 1.0;
                z += Math.cos(time * data.swaySpeed * 0.8 + data.swayOffset) * deltaTime * 0.5;

                const dx = x - playerPosition.x;
                const dy = y - playerPosition.y;
                const dz = z - playerPosition.z;

                if (Math.abs(dx) > halfBox || Math.abs(dz) > halfBox || dy < -10) {
                    data.active = false;
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
