
import * as THREE from 'three';
import { FloatingBlock } from '../FloatingBlock.js';

export class OmniProjectile {
    constructor(game, position, velocity, effects) {
        this.game = game;
        this.position = position.clone();
        this.velocity = velocity.clone();
        this.effects = effects || [];

        // Settings
        this.speed = 25.0;
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
        const material = new THREE.MeshBasicMaterial({ color: 0xFF00FF }); // Magenta for Omni
        const sphere = new THREE.Mesh(geometry, material);
        group.add(sphere);

        // Glow
        const light = new THREE.PointLight(0xFF00FF, 1, 5);
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
        const mat = new THREE.MeshBasicMaterial({ color: 0xFFAAFF, transparent: true, opacity: 0.6 });
        const part = new THREE.Mesh(geo, mat);

        part.position.copy(this.position);
        part.position.x += (Math.random() - 0.5) * 0.1;
        part.position.y += (Math.random() - 0.5) * 0.1;
        part.position.z += (Math.random() - 0.5) * 0.1;

        this.game.scene.add(part);

        this.trailParticles.push({
            mesh: part,
            life: 0.5,
            maxLife: 0.5
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
        return false;
    }

    explode(pos) {
        if (this.hasExploded) return;
        this.hasExploded = true;
        this.mesh.visible = false;

        this.spawnExplosionParticles(pos);

        const radius = 3.0;
        const center = pos.clone();

        // Apply effects to entities in radius
        const properties = {
            radius: radius,
            center: center
        };

        // 1. Animals
        if (this.game.animals) {
            for (const animal of this.game.animals) {
                if (animal.position.distanceTo(center) <= radius + 1) {
                    this.applyEffectsToEntity(animal);
                }
            }
        }

        // 2. Drops
        if (this.game.drops) {
            for (const drop of this.game.drops) {
                if (drop.position.distanceTo(center) <= radius + 1) {
                    this.applyEffectsToEntity(drop);
                }
            }
        }

        // 3. Blocks (If levitation involved, or just damage?)
        // Let's only do block levitation if the spell has levitate
        const hasLevitate = this.effects.some(e => e.type === 'levitate');
        if (hasLevitate) {
            this.levitateBlocks(center, radius);
        }

        // 4. Special Effects (Tornado)
        const hasTornado = this.effects.some(e => e.type === 'tornado');
        if (hasTornado) {
            this.game.spawnTornado(center);
        }
    }

    applyEffectsToEntity(entity) {
        this.effects.forEach(effect => {
            if (effect.type === 'levitate') {
                if (entity.startLevitation) entity.startLevitation(effect.duration / 1000); // Effect duration is ms, method usually seconds?
                // SpellSystem used 10000ms. LevitationProjectile used 10.0s. Consistency check needed.
                // Assuming SpellSystem passes ms, but Animal.js expects seconds.
                // Let's convert to seconds here.
            } else if (effect.type === 'damage') {
                if (entity.takeDamage) entity.takeDamage(effect.amount);
            } else if (effect.type === 'push') {
                // Determine push direction from explosion center
                const dir = entity.position.clone().sub(this.position).normalize();
                if (entity.velocity) {
                    entity.velocity.add(dir.multiplyScalar(effect.force || 10));
                }
            }
            // Fire/Burn not implemented on Animal yet? We can add particles or method later.
        });
    }

    levitateBlocks(center, radius) {
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
                            this.game.setBlock(tx, ty, tz, null);
                            const floatBlock = new FloatingBlock(this.game, tx, ty, tz, block);
                            if (this.game.floatingBlocks) {
                                this.game.floatingBlocks.push(floatBlock);
                                this.game.scene.add(floatBlock.mesh);
                            }
                        }
                    }
                }
            }
        }
    }

    spawnExplosionParticles(pos) {
        const particleCount = 20;
        const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const material = new THREE.MeshBasicMaterial({ color: 0xFF00FF });

        for (let i = 0; i < particleCount; i++) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(pos);
            // Simple visual explosion
            this.game.scene.add(mesh);
            this.trailParticles.push({
                mesh: mesh,
                life: 0.5,
                maxLife: 0.5
            });
        }
    }
}
