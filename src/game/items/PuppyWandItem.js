import { Item } from './Item.js';
import * as THREE from 'three';

/**
 * PuppyWandItem - A magical wand that shoots adorable puppies!
 *
 * When used, fires a cute puppy projectile that flies through the air
 * and lands as a living, tail-wagging puppy in the world.
 */
export class PuppyWandItem extends Item {
    constructor() {
        super('puppy_wand', 'Puppy Wand');
        this.maxStack = 1;
        this.isTool = true;
        this.lastFireTime = 0;
        this.fireCooldown = 500; // 0.5 second cooldown - rapid fire puppies!
    }

    onUseDown(game, player) {
        // Cooldown check
        const now = performance.now();
        if (now - this.lastFireTime < this.fireCooldown) {
            return false;
        }
        this.lastFireTime = now;

        // Get camera direction for shooting
        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);

        // Spawn position slightly in front of camera
        const spawnPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(1.5));

        // Add a slight upward arc for cute puppy trajectory
        const velocity = camDir.clone();
        velocity.y += 0.3; // Arc upward
        velocity.normalize().multiplyScalar(15); // Speed

        // Spawn the puppy projectile
        this.spawnPuppyProjectile(game, spawnPos, velocity);

        // Trigger arm swing animation
        if (player.swingArm) {
            player.swingArm();
        }

        // Play a cute sound effect (bark!) if sound system exists
        if (game.soundManager && game.soundManager.playSound) {
            // Optional: game.soundManager.playSound('puppy_bark');
        }

        return true;
    }

    onPrimaryDown(game, player) {
        return this.onUseDown(game, player);
    }

    spawnPuppyProjectile(game, position, velocity) {
        // Import Puppy class dynamically to avoid circular dependencies
        import('../entities/animals-archive/Puppy.js').then(({ Puppy }) => {
            // Create a puppy projectile that flies through the air
            const projectile = new PuppyProjectile(game, position, velocity, Puppy);

            if (!game.projectiles) game.projectiles = [];
            game.projectiles.push(projectile);
            game.scene.add(projectile.mesh);
        });
    }
}

/**
 * PuppyProjectile - A flying puppy that becomes a real puppy on landing
 */
class PuppyProjectile {
    constructor(game, position, velocity, PuppyClass) {
        this.game = game;
        this.position = position.clone();
        this.velocity = velocity.clone();
        this.PuppyClass = PuppyClass;

        this.lifeTime = 0;
        this.maxLifeTime = 5.0;
        this.hasLanded = false;
        this.gravity = 15.0;

        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);

        // Spin animation
        this.spinSpeed = 10;
    }

    createMesh() {
        const group = new THREE.Group();

        // Create a simple cute puppy ball (simplified version while flying)
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0xD4AF37 }); // Golden
        const noseMat = new THREE.MeshLambertMaterial({ color: 0x1A1A1A });
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const tongueMat = new THREE.MeshLambertMaterial({ color: 0xFF6B9D });

        // Body sphere
        const bodyGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);

        // Little ears
        const earGeo = new THREE.BoxGeometry(0.08, 0.12, 0.05);
        const leftEar = new THREE.Mesh(earGeo, bodyMat);
        leftEar.position.set(-0.12, 0.15, 0);
        leftEar.rotation.z = 0.3;
        group.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, bodyMat);
        rightEar.position.set(0.12, 0.15, 0);
        rightEar.rotation.z = -0.3;
        group.add(rightEar);

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.08, 0.05, 0.17);
        group.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.08, 0.05, 0.17);
        group.add(rightEye);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.05, 0.04, 0.03);
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, -0.02, 0.2);
        group.add(nose);

        // Tongue
        const tongueGeo = new THREE.BoxGeometry(0.04, 0.02, 0.06);
        const tongue = new THREE.Mesh(tongueGeo, tongueMat);
        tongue.position.set(0, -0.08, 0.18);
        group.add(tongue);

        // Tiny tail
        const tailGeo = new THREE.BoxGeometry(0.06, 0.06, 0.1);
        const tail = new THREE.Mesh(tailGeo, bodyMat);
        tail.position.set(0, 0.1, -0.2);
        group.add(tail);

        // Add particle trail
        this.createTrailParticles(group);

        return group;
    }

    createTrailParticles(group) {
        // Create sparkle particles behind the puppy
        const particleGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(30 * 3);
        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const particleMat = new THREE.PointsMaterial({
            color: 0xFFD700,
            size: 0.1,
            transparent: true,
            opacity: 0.8
        });

        this.particles = new THREE.Points(particleGeo, particleMat);
        this.particlePositions = [];
        group.add(this.particles);
    }

    update(dt) {
        this.lifeTime += dt;
        if (this.hasLanded) return false;
        if (this.lifeTime > this.maxLifeTime) {
            // Spawn puppy even if max lifetime reached (in mid-air)
            this.spawnPuppy();
            return false;
        }

        // Apply gravity
        this.velocity.y -= this.gravity * dt;

        // Move
        const moveStep = this.velocity.clone().multiplyScalar(dt);
        const nextPos = this.position.clone().add(moveStep);

        // Check for ground collision
        if (this.checkGroundCollision(nextPos)) {
            this.land();
            return false;
        }

        // Check for block collision
        if (this.checkBlockCollision(nextPos)) {
            this.land();
            return false;
        }

        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);

        // Spin the puppy while flying (tumbling through air)
        this.mesh.rotation.x += this.spinSpeed * dt;
        this.mesh.rotation.z += this.spinSpeed * 0.5 * dt;

        // Update trail particles
        this.updateParticles();

        return true;
    }

    updateParticles() {
        // Add current position to trail
        this.particlePositions.unshift(this.position.clone());

        // Keep only last 10 positions
        if (this.particlePositions.length > 10) {
            this.particlePositions.pop();
        }

        // Update particle positions
        const positions = this.particles.geometry.attributes.position.array;
        for (let i = 0; i < this.particlePositions.length; i++) {
            const pos = this.particlePositions[i];
            // Add some random offset for sparkle effect
            positions[i * 3] = pos.x - this.position.x + (Math.random() - 0.5) * 0.2;
            positions[i * 3 + 1] = pos.y - this.position.y + (Math.random() - 0.5) * 0.2;
            positions[i * 3 + 2] = pos.z - this.position.z + (Math.random() - 0.5) * 0.2;
        }
        this.particles.geometry.attributes.position.needsUpdate = true;
    }

    checkGroundCollision(nextPos) {
        // Check if we hit the ground
        const terrainY = this.game.worldGen ?
            this.game.worldGen.getTerrainHeight(nextPos.x, nextPos.z) : 0;

        return nextPos.y <= terrainY + 0.5;
    }

    checkBlockCollision(nextPos) {
        const bx = Math.floor(nextPos.x);
        const by = Math.floor(nextPos.y);
        const bz = Math.floor(nextPos.z);
        const block = this.game.getBlock(bx, by, bz);

        if (block && block.type !== 'air' && block.type !== 'water') {
            return true;
        }
        return false;
    }

    land() {
        if (this.hasLanded) return;
        this.hasLanded = true;
        this.mesh.visible = false;

        this.spawnPuppy();
    }

    spawnPuppy() {
        // Spawn a real puppy at the landing position!
        const spawnY = this.game.worldGen ?
            this.game.worldGen.getTerrainHeight(this.position.x, this.position.z) :
            this.position.y;

        try {
            const puppy = new this.PuppyClass(
                this.game,
                this.position.x,
                spawnY + 0.5,
                this.position.z
            );

            // Add to the game's animal list
            if (this.game.animals) {
                this.game.animals.push(puppy);
                this.game.scene.add(puppy.mesh);
                console.log('[PuppyWand] Spawned a cute puppy!');
            }

            // Create landing particles
            this.createLandingEffect();

        } catch (error) {
            console.error('[PuppyWand] Failed to spawn puppy:', error);
        }
    }

    createLandingEffect() {
        // Create a burst of heart/star particles on landing
        if (this.game.worldParticleSystem) {
            const pos = this.position;
            for (let i = 0; i < 10; i++) {
                const angle = (i / 10) * Math.PI * 2;
                const speed = 2 + Math.random() * 2;
                const vx = Math.cos(angle) * speed;
                const vz = Math.sin(angle) * speed;
                const vy = 3 + Math.random() * 2;

                this.game.worldParticleSystem.emitParticle(
                    pos.x, pos.y + 0.5, pos.z,
                    vx, vy, vz,
                    0xFFD700, // Gold color
                    1.5 // Lifetime
                );
            }
        }
    }
}
