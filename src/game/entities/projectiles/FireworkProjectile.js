import * as THREE from 'three';

/**
 * FireworkProjectile - A projectile that shoots up and creates a colorful firework explosion
 */
export class FireworkProjectile {
    constructor(game, position, velocity) {
        console.log('[FireworkProjectile] Constructor called', position, velocity);
        this.game = game;
        this.position = position.clone();
        this.velocity = velocity.clone();

        // Settings
        this.speed = 20.0; // Slightly slower than magic for visual effect
        this.velocity.normalize().multiplyScalar(this.speed);
        
        // Add some upward arc
        this.velocity.y += 5.0;

        this.radius = 0.3;
        this.lifeTime = 0;
        this.maxLifeTime = 3.0; // Seconds before auto-explode
        this.hasExploded = false;
        
        // Firework colors - random vibrant colors
        this.fireworkColors = [
            0xFF0000, // Red
            0x00FF00, // Green
            0x0000FF, // Blue
            0xFFFF00, // Yellow
            0xFF00FF, // Magenta
            0x00FFFF, // Cyan
            0xFFA500, // Orange
            0xFFFFFF, // White
            0xFF1493, // Deep Pink
            0x32CD32, // Lime Green
            0xFFD700, // Gold
            0xFF4500  // OrangeRed
        ];
        this.explosionColor = this.fireworkColors[Math.floor(Math.random() * this.fireworkColors.length)];

        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);

        // Trail particles
        this.trailParticles = [];
        
        // Spark trail
        this.sparkTrail = [];
        
        console.log('[FireworkProjectile] Constructor complete, mesh created:', this.mesh);
    }

    createMesh() {
        const group = new THREE.Group();

        // Main firework body - glowing sphere
        const geometry = new THREE.SphereGeometry(0.15, 8, 8);
        const material = new THREE.MeshBasicMaterial({ 
            color: this.explosionColor
        });
        const sphere = new THREE.Mesh(geometry, material);
        group.add(sphere);

        // Bright point light
        const light = new THREE.PointLight(this.explosionColor, 1.0, 8);
        group.add(light);
        this.light = light;

        return group;
    }

    update(dt) {
        if (this.game.gameState && this.game.gameState.flags.isTimeStopped) {
            return true;
        }
        
        this.lifeTime += dt;

        // If exploded, just manage trails and wait to die
        if (this.hasExploded) {
            this.updateTrailParticles(dt);
            this.updateSparkTrail(dt);
            // If trails are gone, we are truly done
            if (this.trailParticles.length === 0 && this.sparkTrail.length === 0) {
                return false;
            }
            return true;
        }

        if (this.lifeTime > this.maxLifeTime) {
            this.explode(this.position);
            return true;
        }

        // Apply gravity to create arc
        this.velocity.y -= 9.8 * dt; // Gravity

        // Move
        const moveStep = this.velocity.clone().multiplyScalar(dt);
        const nextPos = this.position.clone().add(moveStep);

        // Spawn trails
        this.spawnTrailParticle();
        this.spawnSpark();
        this.updateTrailParticles(dt);
        this.updateSparkTrail(dt);

        // Check Collisions - explode on hit
        if (this.checkCollisions(nextPos)) {
            this.explode(this.position);
            return true;
        }

        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);

        return true;
    }

    spawnTrailParticle() {
        // Smoke trail behind the firework
        const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const mat = new THREE.MeshBasicMaterial({ 
            color: 0x888888, 
            transparent: true, 
            opacity: 0.4 
        });
        const part = new THREE.Mesh(geo, mat);

        part.position.copy(this.position);
        part.position.x += (Math.random() - 0.5) * 0.15;
        part.position.y += (Math.random() - 0.5) * 0.15;
        part.position.z += (Math.random() - 0.5) * 0.15;

        this.game.scene.add(part);

        this.trailParticles.push({
            mesh: part,
            life: 1.5,
            maxLife: 1.5
        });
    }

    spawnSpark() {
        // Bright spark particles
        const geo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
        const mat = new THREE.MeshBasicMaterial({ 
            color: this.explosionColor,
            transparent: true,
            opacity: 0.8
        });
        const spark = new THREE.Mesh(geo, mat);

        spark.position.copy(this.position);
        spark.position.x += (Math.random() - 0.5) * 0.2;
        spark.position.y += (Math.random() - 0.5) * 0.2;
        spark.position.z += (Math.random() - 0.5) * 0.2;

        this.game.scene.add(spark);

        this.sparkTrail.push({
            mesh: spark,
            life: 0.5,
            maxLife: 0.5,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            )
        });
    }

    updateTrailParticles(dt) {
        for (let i = this.trailParticles.length - 1; i >= 0; i--) {
            const p = this.trailParticles[i];
            p.life -= dt;

            const lifeRatio = Math.max(0, p.life / p.maxLife);
            if (p.mesh.material) {
                p.mesh.material.opacity = lifeRatio * 0.4;
            }
            p.mesh.scale.setScalar(lifeRatio);

            if (p.life <= 0) {
                this.game.scene.remove(p.mesh);
                if (p.mesh.geometry) p.mesh.geometry.dispose();
                if (p.mesh.material) p.mesh.material.dispose();
                this.trailParticles.splice(i, 1);
            }
        }
    }

    updateSparkTrail(dt) {
        for (let i = this.sparkTrail.length - 1; i >= 0; i--) {
            const p = this.sparkTrail[i];
            p.life -= dt;

            // Move spark
            p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
            p.velocity.y -= 2.0 * dt; // Gravity on sparks

            const lifeRatio = Math.max(0, p.life / p.maxLife);
            if (p.mesh.material) {
                p.mesh.material.opacity = lifeRatio * 0.8;
            }

            if (p.life <= 0) {
                this.game.scene.remove(p.mesh);
                if (p.mesh.geometry) p.mesh.geometry.dispose();
                if (p.mesh.material) p.mesh.material.dispose();
                this.sparkTrail.splice(i, 1);
            }
        }
    }

    checkCollisions(nextPos) {
        // Block Collision
        const bx = Math.floor(nextPos.x);
        const by = Math.floor(nextPos.y);
        const bz = Math.floor(nextPos.z);

        const block = this.game.getBlock(bx, by, bz);
        if (block && block.type !== 'water') {
            return true;
        }

        // Check if firework went too high (auto-explode at height)
        if (nextPos.y > 100) {
            return true;
        }

        return false;
    }

    explode(pos) {
        if (this.hasExploded) return;
        this.hasExploded = true;
        this.mesh.visible = false;

        console.log("Firework explosion!");

        // Create explosion effect
        this.spawnFireworkExplosion(pos);

        // Flash effect
        this.spawnFlash(pos);
    }

    spawnFireworkExplosion(pos) {
        const explosion = new FireworkExplosion(this.game, pos, this.explosionColor);
        this.game.projectiles.push(explosion);
    }

    spawnFlash(pos) {
        // Bright flash at explosion point
        const flashLight = new THREE.PointLight(this.explosionColor, 3.0, 20);
        flashLight.position.copy(pos);
        this.game.scene.add(flashLight);

        // Remove flash after short time
        setTimeout(() => {
            this.game.scene.remove(flashLight);
        }, 100);
    }
}

/**
 * FireworkExplosion - The actual explosion effect with particles
 */
class FireworkExplosion {
    constructor(game, position, color) {
        this.game = game;
        this.position = position.clone();
        this.color = color;
        this.age = 0;
        this.maxAge = 3.0; // Seconds
        this.particles = [];

        // Create explosion particles
        this.createParticles();

        this.mesh = new THREE.Group();
    }

    createParticles() {
        const particleCount = 80; // Lots of particles for beautiful explosion
        
        // Multiple rings for a spherical explosion
        for (let ring = 0; ring < 3; ring++) {
            const ringParticles = Math.floor(particleCount / 3);
            const ringSpeed = 8 + ring * 3; // Different speeds per ring
            
            for (let i = 0; i < ringParticles; i++) {
                const geometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
                
                // Slight color variation
                const colorVariation = Math.random() * 0.2 - 0.1;
                const baseColor = new THREE.Color(this.color);
                baseColor.offsetHSL(colorVariation, 0, 0);
                
                const material = new THREE.MeshBasicMaterial({ 
                    color: baseColor,
                    transparent: true,
                    opacity: 1.0
                });
                
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.copy(this.position);

                // Spherical distribution
                const phi = Math.random() * Math.PI * 2;
                const theta = Math.random() * Math.PI;
                
                const velocity = new THREE.Vector3(
                    Math.sin(theta) * Math.cos(phi),
                    Math.sin(theta) * Math.sin(phi),
                    Math.cos(theta)
                ).multiplyScalar(ringSpeed * (0.8 + Math.random() * 0.4));

                this.particles.push({
                    mesh,
                    velocity,
                    initialVelocity: velocity.clone(),
                    drag: 0.96,
                    gravity: 4.0
                });

                this.game.scene.add(mesh);
            }
        }

        // Add some "trail" particles that fall down like sparkles
        const trailCount = 30;
        for (let i = 0; i < trailCount; i++) {
            const geometry = new THREE.BoxGeometry(0.06, 0.06, 0.06);
            const material = new THREE.MeshBasicMaterial({
                color: 0xFFFFFF,
                transparent: true,
                opacity: 0.9
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(this.position);
            
            // Random direction but biased downward
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                Math.random() * 5, // Upward initially
                (Math.random() - 0.5) * 10
            );
            
            this.particles.push({
                mesh,
                velocity,
                initialVelocity: velocity.clone(),
                drag: 0.98,
                gravity: 8.0,
                isSparkle: true
            });
            
            this.game.scene.add(mesh);
        }
    }

    update(dt) {
        this.age += dt;
        
        if (this.age > this.maxAge) {
            this.dispose();
            return false;
        }

        const lifeRatio = Math.max(0, 1.0 - (this.age / this.maxAge));

        for (const p of this.particles) {
            // Apply gravity
            p.velocity.y -= p.gravity * dt;
            
            // Apply drag
            p.velocity.multiplyScalar(p.drag);
            
            // Move particle
            p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
            
            // Make particles face camera for better visibility
            p.mesh.lookAt(this.game.camera.position);
            
            // Fade out and shrink
            if (p.isSparkle) {
                p.mesh.material.opacity = lifeRatio * 0.9;
                p.mesh.scale.setScalar(0.5 + lifeRatio * 0.5);
            } else {
                p.mesh.material.opacity = lifeRatio;
                p.mesh.scale.setScalar(0.5 + lifeRatio * 0.5);
            }
        }

        return true;
    }

    dispose() {
        for (const p of this.particles) {
            this.game.scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
        }
        this.particles = [];
    }
}
