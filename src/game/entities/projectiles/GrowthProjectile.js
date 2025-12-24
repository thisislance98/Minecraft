import * as THREE from 'three';
import { ShrunkBlock } from '../ShrunkBlock.js';

export class GrowthProjectile {
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

        // Core - Green
        const geometry = new THREE.SphereGeometry(0.2, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0x00FF00 }); // Green
        const sphere = new THREE.Mesh(geometry, material);
        group.add(sphere);

        // Glow
        const light = new THREE.PointLight(0x00FF00, 1, 5);
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
            this.growthEffect(this.position);
            return true;
        }

        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);

        return true;
    }

    spawnTrailParticle() {
        // Greenish trail
        const geo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
        const mat = new THREE.MeshBasicMaterial({ color: 0x90EE90, transparent: true, opacity: 0.6 }); // Light Green
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
            this.hitBlock = { x: bx, y: by, z: bz, type: block.type };
            return true;
        }

        // Entity Collision
        if (this.game.animals) {
            for (const animal of this.game.animals) {
                const distSq = animal.position.distanceToSquared(nextPos);
                const hitboxSize = 2.0 * animal.mesh.scale.x;
                if (distSq < hitboxSize * hitboxSize) {
                    this.hitEntity = animal;
                    return true;
                }
            }
        }

        // Also check ShrunkBlocks
        if (this.game.shrunkBlocks) {
            for (const sb of this.game.shrunkBlocks) {
                const distSq = sb.position.distanceToSquared(nextPos);
                if (distSq < (sb.scale * sb.scale + 0.5)) {
                    this.hitShrunkBlock = sb;
                    return true;
                }
            }
        }

        return false;
    }

    growthEffect(pos) {
        if (this.hasHit) return;
        this.hasHit = true;
        this.mesh.visible = false;

        // Visual Explosion (Green/Yellow)
        this.spawnGrowthParticles(pos);

        // Logic
        if (this.hitEntity) {
            console.log("Growing animal");
            this.hitEntity.mesh.scale.multiplyScalar(2.0);

            // Scale physics dimensions if avail
            if (this.hitEntity.width) this.hitEntity.width *= 2.0;
            if (this.hitEntity.height) this.hitEntity.height *= 2.0;
            if (this.hitEntity.depth) this.hitEntity.depth *= 2.0;

        } else if (this.hitShrunkBlock) {
            // Grow existing ShrunkBlock
            // This is a guess. If shrink(0.7) makes it smaller, shrink(2.0) might make it bigger.
            this.hitShrunkBlock.shrink(2.0);
        } else if (this.hitBlock) {
            // What to do with a normal block? For now, nothing.
            console.log("Growth spell hit a block, no effect.");
        }
    }

    spawnGrowthParticles(pos) {
        const explosion = new GrowthExplosion(this.game, pos);
        this.game.projectiles.push(explosion);
    }
}

class GrowthExplosion {
    constructor(game, position) {
        this.game = game;
        this.age = 0;
        this.maxAge = 1.0;
        this.particles = [];

        // Green/Yellow Colors
        const colors = [0x00FF00, 0xFFFF00, 0xADFF2F, 0xFFFFFF];

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
            p.mesh.scale.setScalar(lifeRatio);
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
