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
        this.hasExploded = false;
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

        // If exploded, just manage trails and wait to die
        if (this.hasExploded) {
            this.updateTrailParticles(dt);
            // If trails are gone, we are truly done
            if (this.trailParticles.length === 0) {
                return false;
            }
            return true;
        }

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
            // Don't die yet, stay alive to clear trails
            return true;
        }

        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);

        return true;
    }

    spawnTrailParticle() {
        // Thin smoke trail
        const geo = new THREE.BoxGeometry(0.05, 0.05, 0.05); // Smaller particles
        const mat = new THREE.MeshBasicMaterial({ color: 0xCCCCCC, transparent: true, opacity: 0.6 }); // Light smoke gray/white
        const part = new THREE.Mesh(geo, mat);

        // Random offset - tightly packed for "thin" trail
        part.position.copy(this.position);
        part.position.x += (Math.random() - 0.5) * 0.1;
        part.position.y += (Math.random() - 0.5) * 0.1;
        part.position.z += (Math.random() - 0.5) * 0.1;

        this.game.scene.add(part);

        this.trailParticles.push({
            mesh: part,
            life: 1.0, // Longer life for smoke trail
            maxLife: 1.0
        });
    }

    updateTrailParticles(dt) {
        for (let i = this.trailParticles.length - 1; i >= 0; i--) {
            const p = this.trailParticles[i];
            p.life -= dt;

            // Fade out
            const lifeRatio = Math.max(0, p.life / p.maxLife);
            // Check if material still exists before accessing
            if (p.mesh.material) {
                p.mesh.material.opacity = lifeRatio * 0.6;
            }

            if (p.life <= 0) {
                this.game.scene.remove(p.mesh);
                if (p.mesh.geometry) p.mesh.geometry.dispose();
                if (p.mesh.material) p.mesh.material.dispose();
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

        // Entity Collision (Animals)
        if (this.game.animals) {
            for (const animal of this.game.animals) {
                // Simple bounding sphere check
                // Assume animals have a radius ~1.0
                const distSq = animal.position.distanceToSquared(nextPos);
                if (distSq < 2.0) { // 1.4ish radius
                    return true;
                }
            }
        }

        return false;
    }

    explode(pos) {
        if (this.hasExploded) return;
        this.hasExploded = true;
        this.mesh.visible = false; // Hide the main projectile

        console.log("Magic Hit!");

        // 1. Particle Smoke & Explosion
        this.spawnExplosionParticles(pos);

        // 2. Destroy blocks in area (Sphere of destruction)
        const radius = 2;
        const center = new THREE.Vector3(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));

        for (let x = -radius; x <= radius; x++) {
            for (let y = -radius; y <= radius; y++) {
                for (let z = -radius; z <= radius; z++) {
                    if (x * x + y * y + z * z <= radius * radius) {
                        const tx = center.x + x;
                        const ty = center.y + y;
                        const tz = center.z + z;

                        const existing = this.game.getBlock(tx, ty, tz);
                        // Destroy block if it exists and is not bedrock/water (optional safety)
                        if (existing && existing.type !== 'bedrock') {
                            this.game.setBlock(tx, ty, tz, null);
                        }
                    }
                }
            }
        }

        // 3. Blow up creatures in area
        if (this.game.animals) {
            for (const animal of this.game.animals) {
                if (animal.position.distanceTo(center) <= radius + 2) { // Slightly larger radius for entities
                    // "Blow up" the creature
                    animal.isDead = true;
                    console.log("Creature blown up!");
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
        const particleCount = 150; // Vastly increased for "impressive"
        // Less blocky geometry - Icosahedron is low poly but rounder
        const geometry = new THREE.IcosahedronGeometry(0.5, 0);
        const material = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 1.0 }); // Smoke gray

        for (let i = 0; i < particleCount; i++) {
            const mesh = new THREE.Mesh(geometry, material.clone());
            mesh.position.copy(position);

            // Random velocity - much larger spread
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15 + 5, // Strong upward explosive force
                (Math.random() - 0.5) * 15
            );

            // Color variation - Fire (Yellow/Orange/Red) to Smoke (Gray/Black)
            const rand = Math.random();
            if (rand > 0.8) {
                mesh.material.color.setHex(0xFFFF00); // Yellow
            } else if (rand > 0.6) {
                mesh.material.color.setHex(0xFF4500); // OrangeRed
            } else if (rand > 0.4) {
                mesh.material.color.setHex(0xFF0000); // Red
            } else if (rand > 0.2) {
                mesh.material.color.setHex(0x333333); // Dark Gray/Black
            } else {
                mesh.material.color.setHex(0x888888); // Gray
            }

            // Random scales for variety
            mesh.scale.setScalar(0.5 + Math.random() * 1.5);

            this.particles.push({ mesh, vel });
            this.game.scene.add(mesh);
        }

        this.mesh = new THREE.Group(); // Dummy mesh for logic compatibility
    }

    update(dt) {
        this.age += dt;
        if (this.age > this.maxAge) {
            this.dispose();
            return false;
        }

        const lifeRatio = Math.max(0, 1.0 - (this.age / this.maxAge));

        for (const p of this.particles) {
            p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
            p.vel.y += 2.0 * dt; // Smoke rises?
            p.vel.multiplyScalar(0.95); // Drag

            p.mesh.lookAt(this.game.camera.position);
            p.mesh.scale.multiplyScalar(0.99); // Shrink
            p.mesh.material.opacity = lifeRatio; // Fade out
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
