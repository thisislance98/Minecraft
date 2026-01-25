
import { addKnowledge, initKnowledgeService } from '../services/KnowledgeService';

type KnowledgeCategory = 'template' | 'gotcha' | 'howto' | 'error' | 'example';

const EXPANDED_DATA: Array<{
    category: KnowledgeCategory;
    title: string;
    content: string;
    tags: string[];
}> = [
    // WAND ITEM PROJECTILE TEMPLATE - Lightning style with particles and block destruction
    {
        category: 'template' as const,
        title: 'Wand Item Projectile Template',
        content: `// ========================================
// COMPLETE WAND ITEM WITH PROJECTILE GUIDE
// ========================================
// This template shows how to create:
// 1. The Wand Item class (with inventory icon and 3D hand mesh)
// 2. The Projectile class that shoots LIGHTNING BOLTS
// 3. Particle explosions and block destruction on impact

// ==========================================
// PART 1: THE WAND ITEM CLASS
// ==========================================
class MyWandItem extends Item {
    constructor() {
        super('lightning_wand', 'Lightning Wand');
        this.maxStack = 1;
        this.isTool = true;
        this.cooldown = 500;        // Milliseconds between shots
        this.lastUseTime = 0;
        this.damage = 15;
        this.blastRadius = 2;       // Block destruction radius

        // INVENTORY ICON (SVG string)
        this.icon = \`<svg viewBox="0 0 24 24">
            <rect x="10" y="10" width="4" height="12" fill="#4B0082" rx="1"/>
            <circle cx="12" cy="6" r="4" fill="#FFD700"/>
            <path d="M10,4 L14,8 L11,7 L13,12 L9,8 L12,9 Z" fill="#00FFFF"/>
        </svg>\`;
    }

    onUseDown(game, player) {
        const now = Date.now();
        if (now - this.lastUseTime < this.cooldown) return false;
        this.lastUseTime = now;

        const camDir = new window.THREE.Vector3();
        game.camera.getWorldDirection(camDir);
        const spawnPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(1.5));

        // Create lightning projectile
        const projectile = new LightningBoltProjectile(game, spawnPos, camDir, this.damage, this.blastRadius);
        game.projectiles = game.projectiles || [];
        game.projectiles.push(projectile);
        game.scene.add(projectile.mesh);

        if (player.swingArm) player.swingArm();
        return true;
    }

    onPrimaryDown(game, player) {
        return this.onUseDown(game, player);
    }

    // 3D model shown in player's hand
    getMesh() {
        const group = new window.THREE.Group();

        // Handle
        const handle = new window.THREE.Mesh(
            new window.THREE.CylinderGeometry(0.04, 0.06, 0.6, 8),
            new window.THREE.MeshLambertMaterial({ color: 0x4B0082 })
        );
        handle.position.y = -0.15;
        group.add(handle);

        // Crystal tip
        const crystal = new window.THREE.Mesh(
            new window.THREE.OctahedronGeometry(0.1, 0),
            new window.THREE.MeshStandardMaterial({
                color: 0xFFD700,
                emissive: 0xFFAA00,
                emissiveIntensity: 0.4
            })
        );
        crystal.position.y = 0.25;
        group.add(crystal);

        return group;
    }
}

// ==========================================
// PART 2: LIGHTNING BOLT PROJECTILE
// ==========================================
// Creates a jagged lightning bolt visual (like weather system)
// On hit: particle explosion + block destruction

class LightningBoltProjectile {
    constructor(game, position, direction, damage = 15, blastRadius = 2) {
        this.game = game;
        this.position = position.clone();
        this.direction = direction.clone().normalize();
        this.velocity = this.direction.clone().multiplyScalar(40); // Fast!
        this.damage = damage;
        this.blastRadius = blastRadius;
        this.lifeTime = 0;
        this.maxLifeTime = 3.0;

        // Create lightning bolt mesh
        this.mesh = this.createLightningMesh();
        this.mesh.position.copy(this.position);

        // Trail effect - store previous positions
        this.trail = [];
        this.trailMesh = null;
    }

    createLightningMesh() {
        const group = new window.THREE.Group();

        // Core energy ball
        const coreGeo = new window.THREE.SphereGeometry(0.2, 8, 8);
        const coreMat = new window.THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.9
        });
        const core = new window.THREE.Mesh(coreGeo, coreMat);
        group.add(core);

        // Electric glow ring
        const ringGeo = new window.THREE.RingGeometry(0.25, 0.35, 6);
        const ringMat = new window.THREE.MeshBasicMaterial({
            color: 0x00FFFF,
            transparent: true,
            opacity: 0.7,
            side: window.THREE.DoubleSide
        });
        const ring = new window.THREE.Mesh(ringGeo, ringMat);
        group.add(ring);

        // Second ring perpendicular
        const ring2 = ring.clone();
        ring2.rotation.x = Math.PI / 2;
        group.add(ring2);

        return group;
    }

    update(dt) {
        this.lifeTime += dt;
        if (this.lifeTime > this.maxLifeTime) {
            this.dispose();
            return false;
        }

        // Animate rings rotation
        if (this.mesh.children[1]) this.mesh.children[1].rotation.z += dt * 10;
        if (this.mesh.children[2]) this.mesh.children[2].rotation.y += dt * 8;

        // Flicker effect
        if (this.mesh.children[0]) {
            this.mesh.children[0].material.opacity = 0.7 + Math.sin(this.lifeTime * 30) * 0.3;
        }

        // Move
        const moveStep = this.velocity.clone().multiplyScalar(dt);
        const nextPos = this.position.clone().add(moveStep);

        // Update trail (jagged lightning effect behind projectile)
        this.updateTrail(nextPos);

        // Check collisions
        const hitPos = this.checkCollisions(nextPos);
        if (hitPos) {
            this.onHit(hitPos);
            this.dispose();
            return false;
        }

        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);
        return true;
    }

    updateTrail(newPos) {
        // Add current position to trail with jitter
        this.trail.push({
            pos: this.position.clone().add(new window.THREE.Vector3(
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3
            )),
            age: 0
        });

        // Remove old trail mesh
        if (this.trailMesh) {
            this.game.scene.remove(this.trailMesh);
            this.trailMesh.geometry.dispose();
            this.trailMesh.material.dispose();
        }

        // Keep only recent trail points
        this.trail = this.trail.filter(t => t.age < 0.15);
        this.trail.forEach(t => t.age += 0.016);

        // Create new trail mesh (jagged lightning line)
        if (this.trail.length > 1) {
            const points = this.trail.map(t => t.pos);
            points.push(newPos);

            const geometry = new window.THREE.BufferGeometry().setFromPoints(points);
            const material = new window.THREE.LineBasicMaterial({
                color: 0x88FFFF,
                transparent: true,
                opacity: 0.8
            });
            this.trailMesh = new window.THREE.Line(geometry, material);
            this.game.scene.add(this.trailMesh);
        }
    }

    checkCollisions(nextPos) {
        // Block collision
        const bx = Math.floor(nextPos.x);
        const by = Math.floor(nextPos.y);
        const bz = Math.floor(nextPos.z);

        const block = this.game.getBlock ? this.game.getBlock(bx, by, bz) : null;
        if (block && block.type && block.type !== 'air' && block.type !== 'water') {
            return nextPos.clone();
        }

        // Animal/creature collision
        if (this.game.animals) {
            for (const animal of this.game.animals) {
                if (!animal.position) continue;
                const dist = animal.position.distanceTo(nextPos);
                if (dist < 1.5) {
                    if (animal.takeDamage) animal.takeDamage(this.damage);
                    // Knockback
                    if (animal.velocity) {
                        const knockDir = this.direction.clone().multiplyScalar(5);
                        animal.velocity.add(knockDir);
                    }
                    return nextPos.clone();
                }
            }
        }

        return null;
    }

    onHit(hitPos) {
        // 1. Create particle explosion
        this.createExplosionParticles(hitPos);

        // 2. Create lightning strike visual (like weather system)
        this.createLightningStrike(hitPos);

        // 3. Destroy blocks in radius
        this.destroyBlocks(hitPos);

        // 4. Screen flash effect
        this.createFlashEffect(hitPos);
    }

    createExplosionParticles(pos) {
        // Use game's particle system if available
        if (this.game.worldParticleSystem && this.game.worldParticleSystem.spawn) {
            const colors = [0xFFFFFF, 0x00FFFF, 0xFFFF00, 0x88FFFF];
            for (let i = 0; i < 30; i++) {
                const vel = new window.THREE.Vector3(
                    (Math.random() - 0.5) * 8,
                    Math.random() * 6 + 2,
                    (Math.random() - 0.5) * 8
                );
                this.game.worldParticleSystem.spawn({
                    position: pos.clone(),
                    velocity: vel,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    life: 0.5 + Math.random() * 0.5
                });
            }
        }
    }

    createLightningStrike(pos) {
        // Create jagged lightning bolt from sky to hit point (like weather system)
        const startY = pos.y + 20;
        const points = [];

        let currentX = pos.x;
        let currentY = startY;
        let currentZ = pos.z;

        points.push(new window.THREE.Vector3(currentX, currentY, currentZ));

        // Create jagged path down to hit point
        while (currentY > pos.y) {
            currentY -= (Math.random() * 3 + 1);
            currentX += (Math.random() - 0.5) * 2;
            currentZ += (Math.random() - 0.5) * 2;
            points.push(new window.THREE.Vector3(currentX, Math.max(currentY, pos.y), currentZ));
        }

        // Ensure we end at hit point
        points.push(pos.clone());

        const geometry = new window.THREE.BufferGeometry().setFromPoints(points);
        const material = new window.THREE.LineBasicMaterial({
            color: 0xFFFFFF,
            linewidth: 2
        });
        const bolt = new window.THREE.Line(geometry, material);
        this.game.scene.add(bolt);

        // Create a thicker glow bolt
        const glowMat = new window.THREE.LineBasicMaterial({
            color: 0x00FFFF,
            transparent: true,
            opacity: 0.5
        });
        const glowBolt = new window.THREE.Line(geometry.clone(), glowMat);
        this.game.scene.add(glowBolt);

        // Remove after flash
        setTimeout(() => {
            this.game.scene.remove(bolt);
            this.game.scene.remove(glowBolt);
            geometry.dispose();
            material.dispose();
            glowMat.dispose();
        }, 150);
    }

    destroyBlocks(hitPos) {
        const cx = Math.floor(hitPos.x);
        const cy = Math.floor(hitPos.y);
        const cz = Math.floor(hitPos.z);
        const r = this.blastRadius;

        // Destroy blocks in sphere radius
        for (let x = -r; x <= r; x++) {
            for (let y = -r; y <= r; y++) {
                for (let z = -r; z <= r; z++) {
                    if (x*x + y*y + z*z <= r*r) {
                        const bx = cx + x;
                        const by = cy + y;
                        const bz = cz + z;

                        const block = this.game.getBlock ? this.game.getBlock(bx, by, bz) : null;
                        if (block && block.type && block.type !== 'air' && block.type !== 'water' && block.type !== 'bedrock') {
                            // Spawn block particles before destroying
                            if (this.game.worldParticleSystem && this.game.worldParticleSystem.spawnBlockParticles) {
                                this.game.worldParticleSystem.spawnBlockParticles({ x: bx, y: by, z: bz }, block.type);
                            }
                            // Remove the block
                            if (this.game.setBlock) {
                                this.game.setBlock(bx, by, bz, null);
                            }
                        }
                    }
                }
            }
        }
    }

    createFlashEffect(pos) {
        // Bright flash sphere
        const flashGeo = new window.THREE.SphereGeometry(3, 8, 8);
        const flashMat = new window.THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.8
        });
        const flash = new window.THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(pos);
        this.game.scene.add(flash);

        // Fade out
        let opacity = 0.8;
        const fadeOut = () => {
            opacity -= 0.05;
            if (opacity > 0) {
                flash.material.opacity = opacity;
                flash.scale.multiplyScalar(1.1);
                requestAnimationFrame(fadeOut);
            } else {
                this.game.scene.remove(flash);
                flashGeo.dispose();
                flashMat.dispose();
            }
        };
        fadeOut();
    }

    dispose() {
        this.game.scene.remove(this.mesh);
        this.mesh.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });

        // Clean up trail
        if (this.trailMesh) {
            this.game.scene.remove(this.trailMesh);
            this.trailMesh.geometry.dispose();
            this.trailMesh.material.dispose();
        }
    }
}`,
        tags: ['wand', 'projectile', 'shoot', 'magic', 'spell', 'cast', 'item', 'weapon', 'staff', 'rod', 'lightning', 'bolt', 'thunder', 'electric', 'explosion', 'particles', 'destroy', 'blocks', 'blast', 'icon', 'inventory', 'hand', 'mesh']
    },

    // FEAR SPELL TEMPLATE - Makes creatures flee from player
    {
        category: 'template',
        title: 'Fear Spell Wand Template',
        content: `// ========================================
// FEAR SPELL WAND - MAKES CREATURES FLEE
// ========================================
// This template shows how to create a wand that:
// 1. Emits a fear wave/aura around the player
// 2. Makes ALL creatures in range flee for 30 seconds
// 3. Includes spooky visual effects (dark wave, skull particles)

// ==========================================
// PART 1: THE FEAR WAND ITEM CLASS
// ==========================================
class FearWandItem extends Item {
    constructor() {
        super('fear_wand', 'Fear Wand');
        this.maxStack = 1;
        this.isTool = true;
        this.cooldown = 5000;       // 5 second cooldown (powerful spell)
        this.lastUseTime = 0;
        this.fearRadius = 20;       // Affects creatures within 20 blocks
        this.fearDuration = 30.0;   // Creatures flee for 30 seconds

        // INVENTORY ICON - Spooky skull wand
        this.icon = \\\`<svg viewBox="0 0 24 24">
            <rect x="10" y="12" width="4" height="10" fill="#2D1B4E" rx="1"/>
            <circle cx="12" cy="7" r="5" fill="#E8E8E8"/>
            <circle cx="10" cy="6" r="1.2" fill="#1a1a1a"/>
            <circle cx="14" cy="6" r="1.2" fill="#1a1a1a"/>
            <path d="M10,9 Q12,11 14,9" stroke="#1a1a1a" fill="none" stroke-width="0.8"/>
            <path d="M7,7 L5,5 M17,7 L19,5" stroke="#9B59B6" stroke-width="0.5"/>
        </svg>\\\`;
    }

    onUseDown(game, player) {
        const now = Date.now();
        if (now - this.lastUseTime < this.cooldown) return false;
        this.lastUseTime = now;

        // Create the fear wave effect
        const fearWave = new FearWaveEffect(game, player.position.clone(), this.fearRadius, this.fearDuration);
        game.projectiles = game.projectiles || [];
        game.projectiles.push(fearWave);
        game.scene.add(fearWave.mesh);

        // Apply fear to all creatures in range
        this.applyFearToCreatures(game, player);

        if (player.swingArm) player.swingArm();
        return true;
    }

    onPrimaryDown(game, player) {
        return this.onUseDown(game, player);
    }

    applyFearToCreatures(game, player) {
        if (!game.animals) return;

        const playerPos = player.position.clone();
        let affectedCount = 0;

        for (const animal of game.animals) {
            if (!animal.position) continue;
            if (animal === game.merlin) continue; // Don't scare Merlin!
            if (animal.isDead || animal.isDying) continue;

            const dist = animal.position.distanceTo(playerPos);
            if (dist <= this.fearRadius) {
                // Apply extended fear effect
                this.applyFearEffect(animal, player, this.fearDuration);
                affectedCount++;

                // Visual indicator on each affected creature
                this.spawnFearParticlesOnCreature(game, animal);
            }
        }

        console.log(\\\`[FearWand] Affected \\\${affectedCount} creatures for \\\${this.fearDuration}s\\\`);
    }

    applyFearEffect(animal, player, duration) {
        // Set the animal to flee state
        animal.state = 'flee';
        animal.stateTimer = duration;  // 30 seconds of fleeing!
        animal.isMoving = true;
        animal.fleeTarget = player;

        // Store original flee settings to restore later
        if (!animal._originalFleeOnProximity) {
            animal._originalFleeOnProximity = animal.fleeOnProximity;
            animal._originalFleeRange = animal.fleeRange;
        }

        // Temporarily boost flee behavior
        animal.fleeOnProximity = true;
        animal.fleeRange = 50; // Extended flee range while feared

        // Set up restoration after fear ends
        setTimeout(() => {
            if (animal && !animal.isDead) {
                // Restore original settings
                if (animal._originalFleeOnProximity !== undefined) {
                    animal.fleeOnProximity = animal._originalFleeOnProximity;
                    animal.fleeRange = animal._originalFleeRange;
                    delete animal._originalFleeOnProximity;
                    delete animal._originalFleeRange;
                }
            }
        }, duration * 1000);
    }

    spawnFearParticlesOnCreature(game, animal) {
        if (!game.worldParticleSystem || !game.worldParticleSystem.spawn) return;

        // Dark purple/black fear particles around the creature
        const colors = [0x4B0082, 0x2D1B4E, 0x1a1a1a, 0x9B59B6];
        for (let i = 0; i < 8; i++) {
            const vel = new window.THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 3 + 1,
                (Math.random() - 0.5) * 2
            );
            game.worldParticleSystem.spawn({
                position: animal.position.clone().add(new window.THREE.Vector3(0, 1, 0)),
                velocity: vel,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1.0 + Math.random() * 0.5
            });
        }
    }

    // 3D model shown in player's hand - Skull-topped wand
    getMesh() {
        const group = new window.THREE.Group();

        // Dark handle
        const handle = new window.THREE.Mesh(
            new window.THREE.CylinderGeometry(0.03, 0.05, 0.5, 8),
            new window.THREE.MeshLambertMaterial({ color: 0x2D1B4E })
        );
        handle.position.y = -0.1;
        group.add(handle);

        // Skull head (simplified)
        const skull = new window.THREE.Mesh(
            new window.THREE.SphereGeometry(0.1, 8, 8),
            new window.THREE.MeshStandardMaterial({
                color: 0xE8E8E8,
                emissive: 0x4B0082,
                emissiveIntensity: 0.2
            })
        );
        skull.position.y = 0.2;
        skull.scale.set(1, 0.9, 0.8);
        group.add(skull);

        // Eye sockets (dark spheres)
        const eyeMat = new window.THREE.MeshBasicMaterial({ color: 0x000000 });
        const leftEye = new window.THREE.Mesh(new window.THREE.SphereGeometry(0.025, 6, 6), eyeMat);
        leftEye.position.set(-0.035, 0.22, 0.07);
        group.add(leftEye);

        const rightEye = new window.THREE.Mesh(new window.THREE.SphereGeometry(0.025, 6, 6), eyeMat);
        rightEye.position.set(0.035, 0.22, 0.07);
        group.add(rightEye);

        return group;
    }
}

// ==========================================
// PART 2: FEAR WAVE VISUAL EFFECT
// ==========================================
// Expanding dark ring that pulses outward from the player

class FearWaveEffect {
    constructor(game, position, maxRadius, fearDuration) {
        this.game = game;
        this.position = position.clone();
        this.maxRadius = maxRadius;
        this.fearDuration = fearDuration;
        this.lifeTime = 0;
        this.maxLifeTime = 1.5; // Visual effect lasts 1.5 seconds
        this.currentRadius = 0;

        // Create the expanding ring mesh
        this.mesh = this.createWaveMesh();
        this.mesh.position.copy(this.position);
        this.mesh.position.y += 0.5; // Slightly above ground

        // Spawn initial burst particles
        this.spawnBurstParticles();
    }

    createWaveMesh() {
        const group = new window.THREE.Group();

        // Main dark ring
        const ringGeo = new window.THREE.RingGeometry(0.5, 1.5, 32);
        const ringMat = new window.THREE.MeshBasicMaterial({
            color: 0x4B0082,
            transparent: true,
            opacity: 0.7,
            side: window.THREE.DoubleSide
        });
        this.ring = new window.THREE.Mesh(ringGeo, ringMat);
        this.ring.rotation.x = -Math.PI / 2; // Lay flat
        group.add(this.ring);

        // Secondary inner ring (lighter purple)
        const innerRingGeo = new window.THREE.RingGeometry(0.2, 0.8, 32);
        const innerRingMat = new window.THREE.MeshBasicMaterial({
            color: 0x9B59B6,
            transparent: true,
            opacity: 0.5,
            side: window.THREE.DoubleSide
        });
        this.innerRing = new window.THREE.Mesh(innerRingGeo, innerRingMat);
        this.innerRing.rotation.x = -Math.PI / 2;
        this.innerRing.position.y = 0.1;
        group.add(this.innerRing);

        // Dark vertical pillar of energy
        const pillarGeo = new window.THREE.CylinderGeometry(0.3, 0.3, 3, 8, 1, true);
        const pillarMat = new window.THREE.MeshBasicMaterial({
            color: 0x2D1B4E,
            transparent: true,
            opacity: 0.4,
            side: window.THREE.DoubleSide
        });
        this.pillar = new window.THREE.Mesh(pillarGeo, pillarMat);
        this.pillar.position.y = 1.5;
        group.add(this.pillar);

        return group;
    }

    spawnBurstParticles() {
        if (!this.game.worldParticleSystem || !this.game.worldParticleSystem.spawn) return;

        // Outward burst of dark particles
        const colors = [0x4B0082, 0x2D1B4E, 0x1a1a1a, 0x9B59B6, 0x6B3FA0];
        for (let i = 0; i < 40; i++) {
            const angle = (i / 40) * Math.PI * 2;
            const speed = 5 + Math.random() * 5;
            const vel = new window.THREE.Vector3(
                Math.cos(angle) * speed,
                Math.random() * 3,
                Math.sin(angle) * speed
            );
            this.game.worldParticleSystem.spawn({
                position: this.position.clone().add(new window.THREE.Vector3(0, 1, 0)),
                velocity: vel,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 0.8 + Math.random() * 0.5
            });
        }

        // Upward spiral particles
        for (let i = 0; i < 20; i++) {
            const vel = new window.THREE.Vector3(
                (Math.random() - 0.5) * 2,
                5 + Math.random() * 5,
                (Math.random() - 0.5) * 2
            );
            this.game.worldParticleSystem.spawn({
                position: this.position.clone(),
                velocity: vel,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1.0 + Math.random() * 0.5
            });
        }
    }

    update(dt) {
        this.lifeTime += dt;
        if (this.lifeTime > this.maxLifeTime) {
            this.dispose();
            return false;
        }

        const progress = this.lifeTime / this.maxLifeTime;

        // Expand the rings outward
        this.currentRadius = progress * this.maxRadius;
        const scale = 1 + progress * (this.maxRadius / 2);
        this.ring.scale.set(scale, scale, 1);
        this.innerRing.scale.set(scale * 0.8, scale * 0.8, 1);

        // Fade out
        const fadeOut = 1 - progress;
        this.ring.material.opacity = 0.7 * fadeOut;
        this.innerRing.material.opacity = 0.5 * fadeOut;
        this.pillar.material.opacity = 0.4 * fadeOut;

        // Pillar rises and expands
        this.pillar.scale.y = 1 + progress * 2;
        this.pillar.scale.x = 1 + progress * 3;
        this.pillar.scale.z = 1 + progress * 3;
        this.pillar.position.y = 1.5 + progress * 2;

        // Spawn trailing particles periodically
        if (Math.random() < 0.3) {
            this.spawnTrailParticle();
        }

        return true;
    }

    spawnTrailParticle() {
        if (!this.game.worldParticleSystem || !this.game.worldParticleSystem.spawn) return;

        const angle = Math.random() * Math.PI * 2;
        const radius = this.currentRadius * Math.random();
        const pos = this.position.clone().add(new window.THREE.Vector3(
            Math.cos(angle) * radius,
            Math.random() * 2,
            Math.sin(angle) * radius
        ));

        this.game.worldParticleSystem.spawn({
            position: pos,
            velocity: new window.THREE.Vector3(0, 2, 0),
            color: 0x4B0082,
            life: 0.5
        });
    }

    dispose() {
        this.game.scene.remove(this.mesh);
        this.mesh.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}

// ==========================================
// USAGE NOTES
// ==========================================
// - Register the item: game.dynamicItemRegistry.registerItem('fear_wand', FearWandItem);
// - Give to player: game.giveItem('fear_wand');
// - The fear effect:
//   * Sets animal.state = 'flee' for 30 seconds
//   * Sets animal.fleeTarget = player
//   * Temporarily boosts fleeRange to 50 blocks
//   * Original flee settings restore after duration
// - Works on all animals EXCEPT Merlin
// - 5 second cooldown between uses`,
        tags: ['wand', 'fear', 'flee', 'scare', 'repel', 'creature', 'animal', 'spell', 'magic', 'aura', 'wave', 'effect', 'crowd', 'control', 'run', 'away', 'escape', 'duration', 'timed', 'status', 'debuff']
    }
];

async function seedExpanded() {
    console.log('Initializing knowledge service...');
    await initKnowledgeService();

    console.log('Seeding expanded knowledge...');
    for (const entry of EXPANDED_DATA) {
        const result = await addKnowledge(entry);
        if (result.success) {
            console.log(`  ✓ Added: ${entry.title}`);
        } else {
            console.log(`  ✗ Failed: ${entry.title} - ${result.error}`);
        }
    }

    console.log('Done!');
    process.exit(0);
}

seedExpanded().catch(console.error);
