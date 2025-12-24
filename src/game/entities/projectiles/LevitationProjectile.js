
import * as THREE from 'three';
import { FloatingBlock } from '../FloatingBlock.js';

export class LevitationProjectile {
    constructor(game, position, velocity) {
        this.game = game;
        this.position = position.clone();
        this.velocity = velocity.clone();

        // Settings
        this.speed = 20.0;
        this.velocity.normalize().multiplyScalar(this.speed);

        this.radius = 0.5;
        this.lifeTime = 0;
        this.maxLifeTime = 5.0;

        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);

        this.trailParticles = [];
        this.hasExploded = false;
    }

    createMesh() {
        const group = new THREE.Group();

        // Core
        const geometry = new THREE.SphereGeometry(0.2, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xFFFF00 }); // Yellow
        const sphere = new THREE.Mesh(geometry, material);
        group.add(sphere);

        // Glow
        const light = new THREE.PointLight(0xFFFF00, 1, 5);
        group.add(light);

        return group;
    }

    update(dt) {
        this.lifeTime += dt;

        if (this.hasExploded) {
            this.updateTrailParticles(dt);
            if (this.trailParticles.length === 0) {
                return false;
            }
            return true;
        }

        if (this.lifeTime > this.maxLifeTime) return false;

        const moveStep = this.velocity.clone().multiplyScalar(dt);
        const nextPos = this.position.clone().add(moveStep);

        this.spawnTrailParticle();
        this.updateTrailParticles(dt);

        if (this.checkCollisions(nextPos)) {
            this.explode(this.position);
            return true;
        }

        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);

        return true;
    }

    spawnTrailParticle() {
        const geo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
        const mat = new THREE.MeshBasicMaterial({ color: 0xFFFFE0, transparent: true, opacity: 0.6 }); // Light Yellow
        const part = new THREE.Mesh(geo, mat);

        part.position.copy(this.position);
        part.position.x += (Math.random() - 0.5) * 0.1;
        part.position.y += (Math.random() - 0.5) * 0.1;
        part.position.z += (Math.random() - 0.5) * 0.1;

        this.game.scene.add(part);

        this.trailParticles.push({
            mesh: part,
            life: 1.0,
            maxLife: 1.0
        });
    }

    updateTrailParticles(dt) {
        for (let i = this.trailParticles.length - 1; i >= 0; i--) {
            const p = this.trailParticles[i];
            p.life -= dt;
            const lifeRatio = Math.max(0, p.life / p.maxLife);
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
        const bx = Math.floor(nextPos.x);
        const by = Math.floor(nextPos.y);
        const bz = Math.floor(nextPos.z);

        const block = this.game.getBlock(bx, by, bz);
        if (block && block.type !== 'air' && block.type !== 'water') {
            return true;
        }

        if (this.game.animals) {
            for (const animal of this.game.animals) {
                if (animal.position.distanceToSquared(nextPos) < 2.0) {
                    return true;
                }
            }
        }

        // Also check drops separately if needed, but usually block hit is fine.
        // If we want to hit a drop in mid air...
        if (this.game.drops) {
            for (const drop of this.game.drops) {
                if (drop.position.distanceToSquared(nextPos) < 1.0) {
                    return true;
                }
            }
        }

        return false;
    }

    explode(pos) {
        if (this.hasExploded) return;
        this.hasExploded = true;
        this.mesh.visible = false;

        console.log("Levitation Hit!");
        this.spawnExplosionParticles(pos);

        const radius = 2.5;
        const center = pos.clone();

        // 1. Animals
        if (this.game.animals) {
            for (const animal of this.game.animals) {
                if (animal.position.distanceTo(center) <= radius + 1) {
                    if (animal.startLevitation) {
                        animal.startLevitation(10.0); // Float for 10 seconds
                    }
                }
            }
        }

        // 2. Drops (Items)
        if (this.game.drops) {
            for (const drop of this.game.drops) {
                if (drop.position.distanceTo(center) <= radius + 1) {
                    if (drop.startLevitation) {
                        drop.startLevitation(10.0);
                    }
                }
            }
        }

        // 3. Blocks
        // Convert blocks in radius to FloatingBlocks
        const bx = Math.floor(center.x);
        const by = Math.floor(center.y);
        const bz = Math.floor(center.z);

        const r = Math.floor(radius);

        for (let x = -r; x <= r; x++) {
            for (let y = -r; y <= r; y++) {
                for (let z = -r; z <= r; z++) {
                    if (x * x + y * y + z * z <= radius * radius) {
                        const tx = bx + x;
                        const ty = by + y;
                        const tz = bz + z;

                        const block = this.game.getBlockWorld(tx, ty, tz);
                        if (block && block !== 'air' && block !== 'water' && block !== 'bedrock') {
                            // Convert!
                            this.game.setBlock(tx, ty, tz, null);

                            const floatBlock = new FloatingBlock(this.game, tx, ty, tz, block);
                            // We need to add this to a list in VoxelGame
                            if (this.game.floatingBlocks) {
                                this.game.floatingBlocks.push(floatBlock);
                                this.game.scene.add(floatBlock.mesh);
                            } else {
                                // Fallback if array not created yet
                                console.warn("game.floatingBlocks not initialized");
                            }
                        }
                    }
                }
            }
        }
    }

    spawnExplosionParticles(pos) {
        // Yellow sparkles
        const particleCount = 20;
        const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const material = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });

        for (let i = 0; i < particleCount; i++) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(pos);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 5
            );

            // Add to scene as simple particle (reuse logic from MagicProjectile if possible, 
            // but for now I'll just add simple fading particles to a specific array in game or locally managed?
            // Since this projectile persists until trails die, I can manage them here.)
            this.trailParticles.push({
                mesh: mesh,
                life: 1.0,
                maxLife: 1.0
            });
            this.game.scene.add(mesh);

            // We need to store velocity somewhere to update it?
            // My updateTrailParticles doesn't update position/velocity, only fades.
            // I should make a better particle system, but for now, static sparkles.
            // Actually, static sparkles are boring.
            // Let's create a temporary LevitationExplosion entity like MagicProjectile had Explosion.
        }

        const explosion = new LevitationExplosion(this.game, pos);
        this.game.projectiles.push(explosion);
    }
}

class LevitationExplosion {
    constructor(game, position) {
        this.game = game;
        this.age = 0;
        this.maxAge = 1.0;
        this.particles = [];

        const particleCount = 50;
        const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const material = new THREE.MeshBasicMaterial({ color: 0xFFFF00, transparent: true });

        for (let i = 0; i < particleCount; i++) {
            const mesh = new THREE.Mesh(geometry, material.clone());
            mesh.position.copy(position);
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                (Math.random()) * 5, // All go up
                (Math.random() - 0.5) * 5
            );
            this.particles.push({ mesh, vel });
            this.game.scene.add(mesh);
        }
    }

    update(dt) {
        this.age += dt;
        if (this.age > this.maxAge) {
            this.dispose();
            return false;
        }

        for (const p of this.particles) {
            p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
            p.mesh.material.opacity = 1.0 - (this.age / this.maxAge);
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
