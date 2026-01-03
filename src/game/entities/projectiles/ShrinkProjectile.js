import * as THREE from 'three';
import { ShrunkBlock } from '../ShrunkBlock.js';

export class ShrinkProjectile {
    constructor(game, position, velocity) {
        this.game = game;
        this.position = position.clone();
        this.velocity = velocity.clone();

        // Settings
        this.speed = 20.0;
        this.velocity.normalize().multiplyScalar(this.speed);

        this.lifeTime = 0;
        this.maxLifeTime = 5.0;

        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);

        this.trailParticles = [];
        this.hasHit = false;
    }

    createMesh() {
        const group = new THREE.Group();

        // Core - Cyan/Blue
        const geometry = new THREE.SphereGeometry(0.2, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0x00FFFF }); // Cyan
        const sphere = new THREE.Mesh(geometry, material);
        group.add(sphere);

        // Glow - PERFORMANCE: Reduced intensity and range
        const light = new THREE.PointLight(0x00FFFF, 0.5, 3);
        group.add(light);

        return group;
    }

    update(dt) {
        this.lifeTime += dt;

        if (this.hasHit) {
            this.updateTrailParticles(dt);
            if (this.trailParticles.length === 0) {
                return false;
            }
            return true;
        }

        if (this.lifeTime > this.maxLifeTime) return false;

        const moveStep = this.velocity.clone().multiplyScalar(dt);
        const nextPos = this.position.clone().add(moveStep);

        // Sparkle Trail
        this.spawnTrailParticle();
        this.updateTrailParticles(dt);

        // Check Collisions
        if (this.checkCollisions(nextPos)) {
            this.shrinkEffect(this.position); // Use current position (close enough) or interpolate?
            return true;
        }

        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);

        return true;
    }

    spawnTrailParticle() {
        // Thin blue trail
        const geo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
        const mat = new THREE.MeshBasicMaterial({ color: 0xADD8E6, transparent: true, opacity: 0.6 }); // Light Blue
        const part = new THREE.Mesh(geo, mat);

        part.position.copy(this.position);
        part.position.x += (Math.random() - 0.5) * 0.1;
        part.position.y += (Math.random() - 0.5) * 0.1;
        part.position.z += (Math.random() - 0.5) * 0.1;

        this.game.scene.add(part);

        this.trailParticles.push({
            mesh: part,
            life: 0.8,
            maxLife: 0.8
        });
    }

    updateTrailParticles(dt) {
        for (let i = this.trailParticles.length - 1; i >= 0; i--) {
            const p = this.trailParticles[i];
            p.life -= dt;
            const lifeRatio = Math.max(0, p.life / p.maxLife);
            if (p.mesh.material) p.mesh.material.opacity = lifeRatio * 0.6;

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
        if (block && block.type !== 'water' && block.type !== 'air') {
            // We hit a block
            // Save hit info?
            this.hitBlock = { x: bx, y: by, z: bz, type: block.type };
            return true;
        }

        // Entity Collision
        if (this.game.animals) {
            for (const animal of this.game.animals) {
                const distSq = animal.position.distanceToSquared(nextPos);
                if (distSq < 2.0) {
                    this.hitEntity = animal;
                    return true;
                }
            }
        }

        // Also check ShrunkBlocks!
        if (this.game.shrunkBlocks) {
            for (const sb of this.game.shrunkBlocks) {
                const distSq = sb.position.distanceToSquared(nextPos);
                // Hitbox depends on scale... approx collision
                if (distSq < (sb.scale * sb.scale + 0.5)) {
                    this.hitShrunkBlock = sb;
                    return true;
                }
            }
        }

        return false;
    }

    shrinkEffect(pos) {
        if (this.hasHit) return;
        this.hasHit = true;
        this.mesh.visible = false;

        // Visual Explosion (Blue/Purple)
        this.spawnShrinkParticles(pos);

        // Logic
        if (this.hitEntity) {
            // Shrink Animal
            console.log("Shrinking animal");
            // Reduce scale
            // If animal has 'scale' scalar or vector? 
            // Usually Three.js Mesh has scale Vector3.
            // We need to check if game logic supports it.
            // Assuming we can just modify mesh scale and physics might need update?
            // Existing physics in Animal.js usually just checks collisions.
            // Let's just scale the mesh.

            // Check if animal has 'scale' property for logic, otherwise use mesh
            // We can scale the whole group
            this.hitEntity.mesh.scale.multiplyScalar(0.7);

            // Scale physics dimensions if avail
            if (this.hitEntity.width) this.hitEntity.width *= 0.7;
            if (this.hitEntity.height) this.hitEntity.height *= 0.7;
            if (this.hitEntity.depth) this.hitEntity.depth *= 0.7;

            // Optional: If too small, disappear?
            if (this.hitEntity.mesh.scale.x < 0.2) {
                this.hitEntity.isDead = true;
                console.log("Animal shrunk to nothingness!");
            }

        } else if (this.hitShrunkBlock) {
            // Shrink existing ShrunkBlock
            this.hitShrunkBlock.shrink(0.7);
        } else if (this.hitBlock) {
            // We hit a voxel block
            const { x, y, z, type } = this.hitBlock;
            if (type === 'bedrock') return; // Cannot shrink bedrock

            // Remove voxel
            this.game.setBlock(x, y, z, null);

            // Spawn ShrunkBlock
            // Position is centered on the block: x+0.5, y+0.5, z+0.5
            // But ShrunkBlock handles its own offset/centering logic?
            // Constructor takes x,y,z. Expected to be center?
            // In ShrunkBlock.js I did: mesh.position.copy(position).
            // When we spawn it, we should pass center.
            const sb = new ShrunkBlock(this.game, x + 0.5, y + 0.5, z + 0.5, type, 0.7);

            if (!this.game.shrunkBlocks) this.game.shrunkBlocks = [];
            this.game.shrunkBlocks.push(sb);
            this.game.scene.add(sb.mesh);
        }
    }

    spawnShrinkParticles(pos) {
        // Visual Explosion (Blue/Purple) managed by ShrinkExplosion
        const explosion = new ShrinkExplosion(this.game, pos);
        this.game.projectiles.push(explosion);
    }
}

// Helper Vector3 extension if not exists
if (!THREE.Vector3.prototype.addRandom) {
    THREE.Vector3.prototype.addRandom = function (s) {
        this.x += (Math.random() - 0.5) * s;
        this.y += (Math.random() - 0.5) * s;
        this.z += (Math.random() - 0.5) * s;
        return this;
    }
}

class ShrinkExplosion {
    constructor(game, position) {
        this.game = game;
        this.age = 0;
        this.maxAge = 1.0;
        this.particles = [];

        // Blue/Purple Colors
        const colors = [0x00FFFF, 0x0000FF, 0xFF00FF, 0xFFFFFF];

        const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);

        for (let i = 0; i < 30; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(position);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4
            );

            this.particles.push({ mesh, vel });
            this.game.scene.add(mesh);
        }

        this.mesh = new THREE.Group(); // Dummy
    }

    update(dt) {
        this.age += dt;
        if (this.age > this.maxAge) {
            this.dispose();
            return false;
        }

        const lifeRatio = 1.0 - (this.age / this.maxAge);

        for (const p of this.particles) {
            p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
            p.mesh.scale.setScalar(lifeRatio); // Shrink particles
            p.mesh.rotation.x += dt * 5;
            p.mesh.rotation.y += dt * 5;
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
