import * as THREE from 'three';

export class MagicProjectile {
    constructor(game, position, velocity) {
        this.game = game;
        this.position = position.clone();
        this.velocity = velocity.clone();

        // Settings
        this.speed = 25.0; // Units per second
        this.velocity.normalize().multiplyScalar(this.speed);

        this.radius = 0.5;
        this.lifeTime = 0;
        this.maxLifeTime = 5.0; // Seconds

        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);

        // Trail particles
        this.trailParticles = [];
    }

    createMesh() {
        const group = new THREE.Group();

        // Core
        const geometry = new THREE.SphereGeometry(0.2, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xFF00FF }); // Magenta
        const sphere = new THREE.Mesh(geometry, material);
        group.add(sphere);

        // Glow
        const light = new THREE.PointLight(0xFF00FF, 1, 5);
        group.add(light);

        return group;
    }

    update(dt) {
        this.lifeTime += dt;
        if (this.lifeTime > this.maxLifeTime) return false;

        // Move
        const moveStep = this.velocity.clone().multiplyScalar(dt);
        const nextPos = this.position.clone().add(moveStep);

        // Sparkle Trail
        this.spawnTrailParticle();
        this.updateTrailParticles(dt);

        // Check Collisions
        if (this.checkCollisions(nextPos)) {
            this.explode(this.position);
            return false;
        }

        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);

        return true;
    }

    spawnTrailParticle() {
        // Simple particle - just a small mesh for now or specific logic
        // We can add them to scene and manage them, or add to a group
        // For simplicity, let's just make small meshes that fade

        const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const mat = new THREE.MeshBasicMaterial({ color: 0xFFFF00, transparent: true, opacity: 1.0 });
        const part = new THREE.Mesh(geo, mat);

        // Random offset
        part.position.copy(this.position);
        part.position.x += (Math.random() - 0.5) * 0.2;
        part.position.y += (Math.random() - 0.5) * 0.2;
        part.position.z += (Math.random() - 0.5) * 0.2;

        this.game.scene.add(part);

        this.trailParticles.push({
            mesh: part,
            life: 0.5 // 0.5 seconds
        });
    }

    updateTrailParticles(dt) {
        for (let i = this.trailParticles.length - 1; i >= 0; i--) {
            const p = this.trailParticles[i];
            p.life -= dt;
            p.mesh.material.opacity = p.life / 0.5;
            p.mesh.scale.setScalar(p.life / 0.5);

            if (p.life <= 0) {
                this.game.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.trailParticles.splice(i, 1);
            }
        }
    }

    checkCollisions(nextPos) {
        // Block Collision
        const bx = Math.floor(nextPos.x);
        const by = Math.floor(nextPos.y);
        const bz = Math.floor(nextPos.z);

        const block = this.game.getBlock(bx, by, bz);
        if (block && block.type !== 'water') { // Ignore water?
            return true;
        }

        // Entity Collision (Animals + Player?)
        // ... (Simplified for now, just blocks primarily as requested "blocks up an area")

        return false;
    }

    explode(pos) {
        console.log("Magic Hit!");

        // 1. Particle Smoke & Explosion
        this.spawnExplosionParticles(pos);

        // 2. Block up area (Sphere of blocks)
        const radius = 2;
        const center = new THREE.Vector3(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));

        for (let x = -radius; x <= radius; x++) {
            for (let y = -radius; y <= radius; y++) {
                for (let z = -radius; z <= radius; z++) {
                    if (x * x + y * y + z * z <= radius * radius) {
                        // Don't replace existing non-air blocks? Or overwrite?
                        // "Blocks up an area" - usually involves filling air.
                        // Let's replace Air and Water.
                        const tx = center.x + x;
                        const ty = center.y + y;
                        const tz = center.z + z;

                        const existing = this.game.getBlock(tx, ty, tz);
                        if (!existing || existing.type === 'water') {
                            // Spawn 'obsidian' or 'stone'
                            // Let's specific 'magic_stone' if we had it, but 'stone' is fine.
                            // Or 'glass' for cool effect?
                            // User said "blocks up", let's use 'cobblestone' or similar if available, else 'stone'.
                            this.game.setBlock(tx, ty, tz, 'stone');
                        }
                    }
                }
            }
        }
    }

    spawnExplosionParticles(pos) {
        const count = 50;
        const color = 0xFF4500; // Orange/Red

        // We'll fire and forget these particles effectively
        // A better way is a centralized particle system, but I'll make a local manager for the explosion
        // Actually, since MagicProjectile is about to die, we need to hand these particles off to the Scene or Game.
        // We can create a simple class 'ExplosionEffect' and add it to game entities? 
        // Or just fire-and-forget logic here with a closure/timeout (risky for references).

        // Safest: Add to game.scene and let a simple update loop handle them.
        // I'll create a standalone helper class inside this file or just methods on an object I push to game.projectiles?
        // No, `game.projectiles` expects `update()` return false to kill.
        // So I can spawn an `Explosion` entity into `game.projectiles`!

        const explosion = new Explosion(this.game, pos);
        this.game.projectiles.push(explosion);
    }
}

class Explosion {
    constructor(game, position) {
        this.game = game;
        this.position = position.clone();
        this.age = 0;
        this.maxAge = 2.0; // Seconds
        this.particles = [];

        // Create particles
        const particleCount = 40;
        const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const material = new THREE.MeshBasicMaterial({ color: 0x888888 }); // Smoke gray

        for (let i = 0; i < particleCount; i++) {
            const mesh = new THREE.Mesh(geometry, material.clone());
            mesh.position.copy(position);

            // Random velocity
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            );

            // Color variation
            if (Math.random() > 0.5) {
                mesh.material.color.setHex(0xFFAA00); // Fire
            }

            this.particles.push({ mesh, vel });
            this.game.scene.add(mesh);
        }

        this.mesh = new THREE.Group(); // Dummy mesh for game logic compatibility if needed
    }

    update(dt) {
        this.age += dt;
        if (this.age > this.maxAge) {
            this.dispose();
            return false;
        }

        for (const p of this.particles) {
            p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
            p.vel.y += 2.0 * dt; // Smoke rises?
            p.vel.multiplyScalar(0.95); // Drag

            p.mesh.lookAt(this.game.camera.position);
            p.mesh.scale.multiplyScalar(0.99); // Shrink
        }

        return true;
    }

    dispose() {
        for (const p of this.particles) {
            this.game.scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
        }
    }
}
