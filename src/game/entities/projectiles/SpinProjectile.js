
import * as THREE from 'three';

export class SpinProjectile {
    constructor(game, position, velocity) {
        this.game = game;
        this.position = position.clone();
        this.velocity = velocity.clone();

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

        // Core - a swirling spiral look
        const geometry = new THREE.TorusGeometry(0.2, 0.05, 8, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0x00FFFF }); // Cyan
        const torus = new THREE.Mesh(geometry, material);
        group.add(torus);

        const coreGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
        const core = new THREE.Mesh(coreGeo, coreMat);
        group.add(core);

        // Glow
        const light = new THREE.PointLight(0x00FFFF, 0.8, 4);
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

        // Spin the mesh
        this.mesh.rotation.z += dt * 10;
        this.mesh.rotation.y += dt * 5;

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
        const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const mat = new THREE.MeshBasicMaterial({ color: 0xE0FFFF, transparent: true, opacity: 0.6 }); 
        const part = new THREE.Mesh(geo, mat);

        part.position.copy(this.position);
        part.position.x += (Math.random() - 0.5) * 0.2;
        part.position.y += (Math.random() - 0.5) * 0.2;
        part.position.z += (Math.random() - 0.5) * 0.2;
        
        part.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

        this.game.scene.add(part);

        this.trailParticles.push({
            mesh: part,
            life: 0.8,
            maxLife: 0.8,
            rotVel: new THREE.Vector3(Math.random() * 5, Math.random() * 5, Math.random() * 5)
        });
    }

    updateTrailParticles(dt) {
        for (let i = this.trailParticles.length - 1; i >= 0; i--) {
            const p = this.trailParticles[i];
            p.life -= dt;
            
            p.mesh.rotation.x += p.rotVel.x * dt;
            p.mesh.rotation.y += p.rotVel.y * dt;
            p.mesh.rotation.z += p.rotVel.z * dt;
            
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

        console.log("Spin Hit!");
        this.spawnExplosionParticles(pos);

        const radius = 3.0;
        const center = pos.clone();

        // 1. Animals
        if (this.game.animals) {
            for (const animal of this.game.animals) {
                if (animal.position.distanceTo(center) <= radius + 1) {
                    this.applySpinToEntity(animal);
                }
            }
        }
        
        // 2. Player (if not this player? No, let's hit player too)
        if (this.game.player && this.game.player.position.distanceTo(center) <= radius) {
             this.applySpinToEntity(this.game.player);
        }

        // 3. Blocks
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
                            // We don't have a SpinningBlock yet, but we can make it a floating block that spins
                            this.game.setBlock(tx, ty, tz, null);
                            
                            // I'll need to modify FloatingBlock or create a SpinBlock
                            // For now, let's just make it a FloatingBlock and I'll add spin logic to it later or use a custom one.
                            if (this.game.spawnSpinningBlock) {
                                this.game.spawnSpinningBlock(tx, ty, tz, block);
                            }
                        }
                    }
                }
            }
        }
    }

    applySpinToEntity(entity) {
        // Add spin property to entity
        entity.spinVelocity = (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 20);
        entity.spinTimer = 5.0; // Spin for 5 seconds
        
        // Ensure update method handles spin
        if (!entity._spinPatched) {
            const originalUpdate = entity.update.bind(entity);
            entity.update = (dt) => {
                originalUpdate(dt);
                if (entity.spinTimer > 0) {
                    entity.spinTimer -= dt;
                    entity.rotation += entity.spinVelocity * dt;
                    // If it's a player, we might need to update mesh rotation specifically
                    if (entity.mesh) {
                        entity.mesh.rotation.y = entity.rotation;
                    }
                    
                    if (entity.spinTimer <= 0) {
                        entity.spinVelocity = 0;
                    }
                }
            };
            entity._spinPatched = true;
        }
    }

    spawnExplosionParticles(pos) {
        const explosion = new SpinExplosion(this.game, pos);
        this.game.projectiles.push(explosion);
    }
}

class SpinExplosion {
    constructor(game, position) {
        this.game = game;
        this.age = 0;
        this.maxAge = 1.0;
        this.particles = [];

        const particleCount = 40;
        const geometry = new THREE.TorusGeometry(0.1, 0.02, 4, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0x00FFFF, transparent: true });

        for (let i = 0; i < particleCount; i++) {
            const mesh = new THREE.Mesh(geometry, material.clone());
            mesh.position.copy(position);
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8
            );
            const rotVel = new THREE.Vector3(
                Math.random() * 10,
                Math.random() * 10,
                Math.random() * 10
            );
            this.particles.push({ mesh, vel, rotVel });
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
            p.mesh.rotation.x += p.rotVel.x * dt;
            p.mesh.rotation.y += p.rotVel.y * dt;
            p.mesh.rotation.z += p.rotVel.z * dt;
            p.mesh.material.opacity = 1.0 - (this.age / this.maxAge);
            p.mesh.scale.setScalar(1.0 - (this.age / this.maxAge) * 0.5);
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
