
import { addKnowledge, initKnowledgeService } from '../services/KnowledgeService';

const EXPANDED_DATA = [
    // 1. Advanced Particle Entity Template (Tornado-style)
    {
        category: 'template',
        title: 'Advanced Particle Entity Template',
        content: `class ParticleEntity extends Animal {
    constructor(game, position) {
        // Note: position is a THREE.Vector3 here if spawned manually, or x,y,z if via command
        // This template assumes manual spawning via game.entities.push
        this.game = game;
        this.position = position.clone();
        this.lifeTime = 0;
        this.maxLifeTime = 10.0;
        
        // Create particle system
        this.particles = [];
        this.particleSystem = this.createParticleSystem();
        this.game.scene.add(this.particleSystem);
    }

    createParticleSystem() {
        const count = 200;
        const geometry = new window.THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const material = new window.THREE.PointsMaterial({
            color: 0x88CCFF,
            size: 0.5,
            transparent: true,
            opacity: 0.8
        });

        for (let i = 0; i < count; i++) {
            this.particles.push({
                angle: Math.random() * Math.PI * 2,
                radius: 2 + Math.random() * 3,
                y: Math.random() * 5,
                speed: 1 + Math.random()
            });
            // Initial positions handled in update
        }
        
        geometry.setAttribute('position', new window.THREE.BufferAttribute(positions, 3));
        return new window.THREE.Points(geometry, material);
    }

    update(dt) {
        this.lifeTime += dt;
        if (this.lifeTime > this.maxLifeTime) {
            this.game.scene.remove(this.particleSystem);
            this.particleSystem.geometry.dispose();
            this.particleSystem.material.dispose();
            return false; // Remove from game
        }

        const positions = this.particleSystem.geometry.attributes.position.array;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.angle += p.speed * dt;
            
            // Circular motion
            positions[i * 3] = this.position.x + Math.cos(p.angle) * p.radius;
            positions[i * 3 + 1] = this.position.y + p.y;
            positions[i * 3 + 2] = this.position.z + Math.sin(p.angle) * p.radius;
        }
        this.particleSystem.geometry.attributes.position.needsUpdate = true;
        return true;
    }
}`,
        tags: ['particles', 'storm', 'tornado', 'effect', 'advanced']
    },

    // 2. Interactive Tool Item Template (Broom-style)
    {
        category: 'template',
        title: 'Interactive Tool Item Template',
        content: `// Requires extending Item class
class CustomToolItem extends Item {
    constructor() {
        super('custom_tool_id', 'Display Name'); // ID must be unique
        this.maxStack = 1;
        this.isTool = true;
        
        // Inventory Icon (SVG string)
        // This will be rendered in the inventory slot
        this.icon = \`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.5 4l-8.5 16M6 9h12" />
        </svg>\`;
    }

    // Triggered when player left-clicks with item
    onUseDown(game, player) {
        console.log('Tool used!');
        
        // Example: Apply velocity (Jetpack style)
        if (player.velocity) {
            player.velocity.y += 15;
            game.chat('Lift off!');
        }
        
        return true; // handled
    }
    
    // Optional: Triggered every frame while held
    update(dt, game, player) {
        // Continuous effects
    }
}`,
        tags: ['item', 'tool', 'interaction', 'custom_item', 'click']
    },

    // 3. Explosive Projectile Template
    {
        category: 'template',
        title: 'Explosive Projectile Template',
        content: `class ExplosiveProjectile {
    constructor(game, position, velocity) {
        this.game = game;
        this.position = position.clone();
        this.velocity = velocity.clone();
        this.speed = 20.0;
        this.velocity.normalize().multiplyScalar(this.speed);
        this.lifeTime = 0;
        
        // Visuals
        const geo = new window.THREE.SphereGeometry(0.3);
        const mat = new window.THREE.MeshBasicMaterial({ color: 0xFF00FF });
        this.mesh = new window.THREE.Mesh(geo, mat);
        this.mesh.position.copy(this.position);
        this.game.scene.add(this.mesh); // IMPORTANT: Add to scene manually if not using factory
    }

    update(dt) {
        this.lifeTime += dt;
        if (this.lifeTime > 5.0) {
            this.game.scene.remove(this.mesh);
            return false;
        }

        // Move
        const nextPos = this.position.clone().add(this.velocity.clone().multiplyScalar(dt));
        
        // Simple floor collision check
        if (nextPos.y < this.game.worldManager.getTerrainHeight(nextPos.x, nextPos.z)) {
            this.explode();
            return false; // Destroy projectile
        }

        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);
        return true;
    }

    explode() {
        this.game.scene.remove(this.mesh);
        // Create explosion particles...
        // Destroy nearby blocks...
        console.log('Boom!');
    }
}`,
        tags: ['projectile', 'combat', 'explosion', 'weapon', 'magic']
    },

    // 4. Glowing Creature Template (from Firefly.js)
    {
        category: 'template',
        title: 'Glowing Creature Template',
        content: `// From Firefly.js - Use emissive material for glow effect
const glowMat = new window.THREE.MeshStandardMaterial({
    color: 0xffff00,       // Base color
    emissive: 0xffff00,    // Glow color (same or different)
    emissiveIntensity: 2   // Brightness of glow (0-5 typical)
});
// PERFORMANCE TIP: Avoid PointLights - emissive material already provides glow`,
        tags: ['glow', 'emissive', 'light', 'firefly', 'glowing', 'bright', 'shine']
    },

    // 5. Flying Creature Template (from Firefly.js)
    {
        category: 'template',
        title: 'Flying Creature Template',
        content: `// From Firefly.js - Override updatePhysics to disable gravity
class FlyingCreature extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.floatPhase = Math.random() * Math.PI * 2;
    }
    
    updateAI(dt) {
        this.floatPhase += dt * 2;
        if (!this.targetDir || Math.random() < 0.05) {
            this.targetDir = new window.THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 1,
                (Math.random() - 0.5) * 2
            ).normalize();
        }
        this.velocity.y = (this.targetDir.y * this.speed) + Math.sin(this.floatPhase) * 0.5;
    }
    
    updatePhysics(dt) {
        // Override to DISABLE gravity
    }
}`,
        tags: ['flying', 'float', 'hover', 'fly', 'air', 'bird', 'flight', 'gravity']
    },

    // 6. Follow Player Template (from Merlin.js)
    {
        category: 'template',
        title: 'Follow Player Template',
        content: `// From Merlin.js - Following behavior with distance threshold
updateAI(dt) {
    const player = this.game.player;
    const dx = player.position.x - this.position.x;
    const dz = player.position.z - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist > this.followDistance + 1.0) {
        const angle = Math.atan2(dx, dz);
        this.rotation = angle;
        this.moveDirection.set(Math.sin(angle), 0, Math.cos(angle));
        this.isMoving = true;
    } else {
        this.isMoving = false;
        this.rotation = Math.atan2(dx, dz);
    }
}`,
        tags: ['follow', 'player', 'pet', 'companion', 'chase', 'move', 'AI']
    },

    // 7. Teleport Template (from Merlin.js)
    {
        category: 'template',
        title: 'Teleport Template',
        content: `// From Merlin.js - Teleportation with particle effects
teleportToPlayer() {
    const player = this.game.player;
    const dir = new window.THREE.Vector3();
    this.game.camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    
    this.position.x = player.position.x - dir.x * this.followDistance;
    this.position.y = player.position.y + 1;
    this.position.z = player.position.z - dir.z * this.followDistance;
    
    this.spawnTeleportParticles();
}`,
        tags: ['teleport', 'warp', 'blink', 'flash', 'instant', 'move', 'particles']
    },

    // 8. Healing Template
    {
        category: 'template',
        title: 'Healing Template',
        content: `// Heal player or entity
healEntity(entity, amount) {
    entity.health = Math.min(entity.health + amount, entity.maxHealth);
    this.game.chat('Healed for ' + amount + ' HP!');
}

// For items - onUseDown method:
onUseDown(game, player) {
    player.health = Math.min(player.health + 20, player.maxHealth);
    game.chat('Healed!');
}`,
        tags: ['heal', 'health', 'restore', 'potion', 'regenerate', 'hp', 'life']
    },

    // 9. Invisibility Item Template
    {
        category: 'template',
        title: 'Invisibility Item Template',
        content: `class InvisibilityItem extends Item {
    constructor() {
        super('invis_wand', 'Invisibility Wand');
        this.icon = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="purple" opacity="0.5"/></svg>';
    }
    onUseDown(game, player) {
        player.mesh.visible = false;
        game.chat('You are now invisible!');
        setTimeout(() => { player.mesh.visible = true; }, 5000);
    }
}`,
        tags: ['invisibility', 'invisible', 'hide', 'stealth', 'effect', 'icon', 'svg']
    },

    // 10. GOLD STANDARD: Dragon Body Template (from Dragon.js)
    {
        category: 'template',
        title: 'Dragon Body Template',
        content: `// GOLD STANDARD from Dragon.js - High-quality creature mesh
createBody() {
    const bodyMat = new window.THREE.MeshLambertMaterial({ color: 0x8B0000 }); // Dark red
    const bellyMat = new window.THREE.MeshLambertMaterial({ color: 0xD2691E }); // Contrast belly
    const eyeMat = new window.THREE.MeshLambertMaterial({ color: 0xFFFF00 }); // Yellow eyes
    const pupilMat = new window.THREE.MeshLambertMaterial({ color: 0x000000 });
    const hornMat = new window.THREE.MeshLambertMaterial({ color: 0x2F2F2F }); // Dark gray
    
    // BODY - Main elongated shape
    const bodyGeo = new window.THREE.BoxGeometry(2.5, 1.2, 1.5);
    const body = new window.THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0, 0);
    this.mesh.add(body);
    
    // BELLY - Lighter contrast color underneath
    const bellyGeo = new window.THREE.BoxGeometry(2.0, 0.4, 1.2);
    const belly = new window.THREE.Mesh(bellyGeo, bellyMat);
    belly.position.set(0, -0.5, 0);
    this.mesh.add(belly);
    
    // HEAD with neck connecting to body
    const neckGeo = new window.THREE.BoxGeometry(0.8, 0.8, 1.5);
    const neck = new window.THREE.Mesh(neckGeo, bodyMat);
    neck.position.set(1.4, 0.4, 0);
    neck.rotation.z = Math.PI / 6; // Angled up
    this.mesh.add(neck);
    
    const headGeo = new window.THREE.BoxGeometry(1.2, 0.8, 0.9);
    const head = new window.THREE.Mesh(headGeo, bodyMat);
    head.position.set(2.2, 0.9, 0);
    this.mesh.add(head);
    
    // EYES - White with black pupil
    const eyeGeo = new window.THREE.BoxGeometry(0.2, 0.25, 0.15);
    const leftEye = new window.THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(2.5, 1.1, 0.4);
    this.mesh.add(leftEye);
    
    const pupilGeo = new window.THREE.BoxGeometry(0.1, 0.15, 0.12);
    const leftPupil = new window.THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(2.55, 1.1, 0.45); // Slightly in front of eye
    this.mesh.add(leftPupil);
    
    // Mirror for right eye (same pattern)
}`,
        tags: ['creature', 'dragon', 'mesh', 'body', 'visual', 'design', 'high-quality', 'gold-standard', 'anatomy']
    },

    // 11. GOLD STANDARD: Wing Construction Template (from Dragon.js)
    {
        category: 'template',
        title: 'Wing Construction Template',
        content: `// GOLD STANDARD Wing from Dragon.js - Proper wing structure with bones and membrane
createWing(boneMat) {
    const wing = new window.THREE.Group();
    
    // Wing BONE structure - Use multiple segments
    const upperBoneGeo = new window.THREE.BoxGeometry(0.2, 0.2, 1.5);
    const upperBone = new window.THREE.Mesh(upperBoneGeo, boneMat);
    upperBone.position.set(0, 0, 0);
    wing.add(upperBone);
    
    const lowerBoneGeo = new window.THREE.BoxGeometry(0.15, 0.15, 2.0);
    const lowerBone = new window.THREE.Mesh(lowerBoneGeo, boneMat);
    lowerBone.position.set(-0.5, -0.1, 1.25);
    lowerBone.rotation.x = 0.3; // Angled outward
    wing.add(lowerBone);
    
    // Wing MEMBRANE (skin) - Use PlaneGeometry for flat wing surface
    const membraneGeo = new window.THREE.PlaneGeometry(1.5, 3.0);
    const membraneMat = new window.THREE.MeshLambertMaterial({ 
        color: 0x4a0000, 
        side: window.THREE.DoubleSide, 
        transparent: true, 
        opacity: 0.9 
    });
    const membrane = new window.THREE.Mesh(membraneGeo, membraneMat);
    membrane.position.set(-0.5, 0, 1.0);
    membrane.rotation.x = Math.PI / 2;
    wing.add(membrane);
    
    return wing;
}

// USING THE WING - Position on body and animate
this.leftWing = this.createWing(bodyMat);
this.leftWing.position.set(-0.3, 0.4, 0.75);
this.mesh.add(this.leftWing);

this.rightWing = this.createWing(bodyMat);
this.rightWing.position.set(-0.3, 0.4, -0.75);
this.mesh.add(this.rightWing);

// WING ANIMATION in update():
const flapAngle = Math.sin(this.wingFlapTimer) * 0.5;
this.leftWing.rotation.z = flapAngle + 0.3;
this.rightWing.rotation.z = -flapAngle - 0.3; // Mirror`,
        tags: ['wing', 'wings', 'flying', 'membrane', 'bone', 'dragon', 'bird', 'animation', 'flap']
    },

    // 12. GOLD STANDARD: Pig/Animal Body Template (from Pig.js)
    {
        category: 'template',
        title: 'Quadruped Animal Body Template',
        content: `// GOLD STANDARD from Pig.js - Well-proportioned quadruped animal
createBody() {
    const skinColor = 0xF0ACBC; // Pink
    const mat = new window.THREE.MeshLambertMaterial({ color: skinColor });
    const whiteMat = new window.THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    const blackMat = new window.THREE.MeshLambertMaterial({ color: 0x000000 });
    const hoofMat = new window.THREE.MeshLambertMaterial({ color: 0x5C3A21 }); // Dark brown
    
    // BODY - Main rectangle
    const bodyGeo = new window.THREE.BoxGeometry(0.8, 0.7, 1.1);
    const body = new window.THREE.Mesh(bodyGeo, mat);
    body.position.set(0, 0.6, 0); // Raised to leg height
    this.mesh.add(body);
    
    // HEAD - Positioned in front of body
    const headGeo = new window.THREE.BoxGeometry(0.6, 0.6, 0.6);
    const head = new window.THREE.Mesh(headGeo, mat);
    head.position.set(0, 0.9, 0.8); // Forward of body
    this.mesh.add(head);
    
    // SNOUT
    const snoutGeo = new window.THREE.BoxGeometry(0.3, 0.2, 0.1);
    const snout = new window.THREE.Mesh(snoutGeo, mat);
    snout.position.set(0, 0.8, 1.15);
    this.mesh.add(snout);
    
    // EYES - White background with black pupil
    const eyeGeo = new window.THREE.BoxGeometry(0.12, 0.12, 0.05);
    const pupilGeo = new window.THREE.BoxGeometry(0.06, 0.06, 0.06);
    
    const leftEye = new window.THREE.Mesh(eyeGeo, whiteMat);
    leftEye.position.set(-0.2, 1.0, 1.1);
    this.mesh.add(leftEye);
    
    const leftPupil = new window.THREE.Mesh(pupilGeo, blackMat);
    leftPupil.position.set(-0.2, 1.0, 1.12); // Slightly in front
    this.mesh.add(leftPupil);
    
    // (Mirror for right eye)
    
    // LEGS - Use Groups for animation
    const makeLeg = (x, z) => {
        const pivot = new window.THREE.Group();
        pivot.position.set(x, 0.4, z);
        
        const legGeo = new window.THREE.BoxGeometry(0.25, 0.3, 0.25);
        const legMesh = new window.THREE.Mesh(legGeo, mat);
        legMesh.position.set(0, -0.15, 0);
        pivot.add(legMesh);
        
        const hoofGeo = new window.THREE.BoxGeometry(0.25, 0.1, 0.25);
        const hoofMesh = new window.THREE.Mesh(hoofGeo, hoofMat);
        hoofMesh.position.set(0, -0.35, 0);
        pivot.add(hoofMesh);
        
        this.mesh.add(pivot);
        return pivot;
    };
    
    this.legParts = [
        makeLeg(-0.25, 0.4),  // Front Left
        makeLeg(0.25, 0.4),   // Front Right
        makeLeg(-0.25, -0.4), // Back Left
        makeLeg(0.25, -0.4)   // Back Right
    ];
}`,
        tags: ['creature', 'animal', 'pig', 'dog', 'quadruped', 'legs', 'body', 'visual', 'gold-standard', 'pet']
    },

    // 13. GOLD STANDARD: Creature Proportions Reference
    {
        category: 'template',
        title: 'Creature Proportions Reference',
        content: `// CREATURE PROPORTIONS - Use these scales for natural-looking creatures

// SMALL ANIMAL (dog, cat, rabbit)
this.width = 0.6;
this.height = 0.6;
this.depth = 0.8;
// Body: BoxGeometry(0.5, 0.4, 0.7)
// Head: BoxGeometry(0.35, 0.35, 0.35)
// Legs: BoxGeometry(0.15, 0.25, 0.15)

// MEDIUM ANIMAL (pig, sheep, wolf)
this.width = 0.9;
this.height = 0.9;
this.depth = 1.3;
// Body: BoxGeometry(0.8, 0.7, 1.1)
// Head: BoxGeometry(0.6, 0.6, 0.6)
// Legs: BoxGeometry(0.25, 0.4, 0.25)

// LARGE CREATURE (dragon, horse, cow)
this.width = 2.0;
this.height = 2.0;
this.depth = 5.0;
// Body: BoxGeometry(2.5, 1.2, 1.5)
// Head: BoxGeometry(1.2, 0.8, 0.9)
// Legs: BoxGeometry(0.3, 0.8, 0.3)

// EYE PROPORTIONS - Always include pupils!
// Eye white: 15-20% of head width
// Pupil: 50% of eye size, positioned slightly forward

// COLOR TIPS
// - Use darker shade for belly/underside contrast
// - Hooves/claws should be dark brown (0x5C3A21)
// - Eyes: Yellow (0xFFFF00) or White (0xFFFFFF)
// - Pupils: Black (0x000000)`,
        tags: ['proportions', 'size', 'scale', 'anatomy', 'creature', 'visual', 'design', 'reference']
    },

    // ============ NEW TEMPLATES FROM CODEBASE ANALYSIS ============

    // 1. GLOWING/EMISSIVE CREATURE TEMPLATE (from Firefly.js)
    {
        category: 'template',
        title: 'Glowing Emissive Creature Template',
        content: `// HOW TO MAKE CREATURES GLOW (from Firefly.js)
// Use MeshStandardMaterial with emissive property

createBody() {
    // GLOWING MATERIAL - No PointLight needed (performance!)
    const glowMat = new window.THREE.MeshStandardMaterial({
        color: 0xffff00,           // Base color (yellow)
        emissive: 0xffff00,        // Glow color (same as base)
        emissiveIntensity: 2       // 1-3 is typical range
    });

    const body = new window.THREE.Mesh(
        new window.THREE.SphereGeometry(0.1, 8, 8),  // Sphere looks nice for glowing
        glowMat
    );
    this.mesh.add(body);
}

// TIPS:
// - emissive color can differ from base color for interesting effects
// - emissiveIntensity 1-2 = subtle glow, 3+ = bright
// - SphereGeometry looks better than BoxGeometry for glowing objects
// - AVOID PointLight - expensive performance, use emissive instead`,
        tags: ['glow', 'glowing', 'emissive', 'light', 'bright', 'luminous', 'shine', 'firefly', 'wisp', 'fairy', 'neon']
    },

    // 2. FLOATING/FLYING CREATURE TEMPLATE (from Firefly.js)
    {
        category: 'template',
        title: 'Floating Flying Creature Template',
        content: `// HOW TO MAKE CREATURES FLOAT/FLY (from Firefly.js)
// Override updatePhysics to disable gravity and override updateAI for movement
// INCLUDES: Throttled behavior logging (logs first 5 times, then stops)

createBody() {
    this.floatPhase = Math.random() * Math.PI * 2;  // Random start phase
    this._behaviorLogCount = 0;  // For throttled logging
    // ... mesh creation ...
}

// THROTTLED LOG: Only logs first 5 times, then auto-stops
_logBehavior(action) {
    if (this._behaviorLogCount < 5) {
        console.log(\`[BEHAVIOR] \${this.constructor.name}: \${action}\`);
        this._behaviorLogCount++;
    }
}

updateAI(dt) {
    this.floatPhase += dt * 2;  // Controls bob speed

    // Log floating behavior (throttled)
    this._logBehavior('Floating - Y offset: ' + Math.sin(this.floatPhase).toFixed(2));

    // Random wandering direction
    if (!this.targetDir || Math.random() < 0.05) {
        this.targetDir = new window.THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 1,  // Less vertical variation
            (Math.random() - 0.5) * 2
        ).normalize();
    }

    // Apply velocity with floating bob
    this.velocity.x = this.targetDir.x * this.speed;
    this.velocity.y = (this.targetDir.y * this.speed) + Math.sin(this.floatPhase) * 0.5;  // Sine wave bob!
    this.velocity.z = this.targetDir.z * this.speed;

    // Update position
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;
}

updatePhysics(dt) {
    // OVERRIDE to disable gravity and ground collision
    // No calls to super.updatePhysics or updateWalkerPhysics!
    if (this.position.y < -50) this.position.y = 50;  // World bounds
}`,
        tags: ['fly', 'flying', 'float', 'floating', 'hover', 'air', 'airborne', 'bob', 'soar', 'wing', 'fairy', 'ghost', 'wisp', 'bird']
    },

    // 3. FOLLOW PLAYER PET TEMPLATE (from Wolf.js chase behavior)
    {
        category: 'template',
        title: 'Follow Player Pet Behavior Template',
        content: `// HOW TO MAKE CREATURES FOLLOW THE PLAYER (adapted from Wolf.js)

updateAI(dt) {
    const player = this.game.player;
    if (!player) {
        super.updateAI(dt);  // Wander if no player
        return;
    }

    const followDistance = 3.0;   // Stop this far from player
    const maxRange = 30.0;        // Max distance to follow
    const distSq = this.position.distanceToSquared(player.position);

    if (distSq > maxRange * maxRange) {
        // Too far - teleport near player
        this.position.copy(player.position);
        this.position.x += (Math.random() - 0.5) * 4;
        this.position.z += (Math.random() - 0.5) * 4;
        return;
    }

    if (distSq > followDistance * followDistance) {
        // Move towards player
        const dir = new window.THREE.Vector3().subVectors(player.position, this.position);
        dir.normalize();
        this.moveDirection.copy(dir);
        this.rotation = Math.atan2(dir.x, dir.z);
        this.isMoving = true;
    } else {
        // Close enough - stop and look at player
        this.isMoving = false;
        const dx = player.position.x - this.position.x;
        const dz = player.position.z - this.position.z;
        this.rotation = Math.atan2(dx, dz);
    }
}`,
        tags: ['follow', 'following', 'pet', 'companion', 'loyal', 'chase', 'track', 'player', 'dog', 'cat', 'tame', 'friend']
    },

    // 4. QUADRUPED BODY TEMPLATE (from Wolf.js, Cat.js)
    {
        category: 'template',
        title: 'Quadruped Animal Body Template',
        content: `// COMPLETE QUADRUPED BODY (from Wolf.js, Cat.js)
// Includes: body, head, snout, ears, eyes, tail, 4 legs

createBody() {
    const furColor = 0x808080;  // Main body color
    const mat = new window.THREE.MeshLambertMaterial({ color: furColor });
    const whiteMat = new window.THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    const blackMat = new window.THREE.MeshLambertMaterial({ color: 0x000000 });
    const noseMat = new window.THREE.MeshLambertMaterial({ color: 0x111111 });

    // BODY
    const body = new window.THREE.Mesh(
        new window.THREE.BoxGeometry(0.6, 0.6, 1.4), mat
    );
    body.position.set(0, 0.6, 0);
    this.mesh.add(body);

    // HEAD
    const head = new window.THREE.Mesh(
        new window.THREE.BoxGeometry(0.5, 0.5, 0.6), mat
    );
    head.position.set(0, 0.9, 0.9);
    this.mesh.add(head);

    // SNOUT
    const snout = new window.THREE.Mesh(
        new window.THREE.BoxGeometry(0.25, 0.25, 0.3), mat
    );
    snout.position.set(0, 0.8, 1.3);
    this.mesh.add(snout);

    // NOSE
    const nose = new window.THREE.Mesh(
        new window.THREE.BoxGeometry(0.1, 0.1, 0.05), noseMat
    );
    nose.position.set(0, 0.9, 1.45);
    this.mesh.add(nose);

    // EARS
    const earGeo = new window.THREE.BoxGeometry(0.15, 0.2, 0.1);
    const leftEar = new window.THREE.Mesh(earGeo, mat);
    leftEar.position.set(-0.18, 1.2, 0.85);
    this.mesh.add(leftEar);
    const rightEar = new window.THREE.Mesh(earGeo, mat);
    rightEar.position.set(0.18, 1.2, 0.85);
    this.mesh.add(rightEar);

    // EYES (white + black pupil)
    const eyeGeo = new window.THREE.BoxGeometry(0.1, 0.1, 0.05);
    const pupilGeo = new window.THREE.BoxGeometry(0.05, 0.05, 0.05);

    const leftEye = new window.THREE.Mesh(eyeGeo, whiteMat);
    leftEye.position.set(-0.15, 0.95, 1.2);
    this.mesh.add(leftEye);
    const leftPupil = new window.THREE.Mesh(pupilGeo, blackMat);
    leftPupil.position.set(-0.15, 0.95, 1.23);  // Slightly forward!
    this.mesh.add(leftPupil);

    const rightEye = new window.THREE.Mesh(eyeGeo, whiteMat);
    rightEye.position.set(0.15, 0.95, 1.2);
    this.mesh.add(rightEye);
    const rightPupil = new window.THREE.Mesh(pupilGeo, blackMat);
    rightPupil.position.set(0.15, 0.95, 1.23);
    this.mesh.add(rightPupil);

    // TAIL
    const tail = new window.THREE.Mesh(
        new window.THREE.BoxGeometry(0.15, 0.15, 1.0), mat
    );
    tail.position.set(0, 0.7, -0.9);
    tail.rotation.x = -0.4;
    this.mesh.add(tail);

    // LEGS (with pivots for animation)
    const legGeo = new window.THREE.BoxGeometry(0.2, 0.5, 0.2);
    const makeLeg = (x, z) => {
        const pivot = new window.THREE.Group();
        pivot.position.set(x, 0.5, z);
        const leg = new window.THREE.Mesh(legGeo, mat);
        leg.position.set(0, -0.25, 0);
        pivot.add(leg);
        this.mesh.add(pivot);
        return pivot;
    };

    this.legParts = [
        makeLeg(-0.2, 0.5),   // Front left
        makeLeg(0.2, 0.5),    // Front right
        makeLeg(-0.2, -0.5),  // Back left
        makeLeg(0.2, -0.5)    // Back right
    ];
}`,
        tags: ['quadruped', 'four legs', 'dog', 'cat', 'wolf', 'animal', 'body', 'anatomy', 'legs', 'eyes', 'tail', 'snout', 'ears', 'pet', 'mammal']
    },

    // 5. SWIMMING CREATURE TEMPLATE (from Fish.js)
    {
        category: 'template',
        title: 'Swimming Aquatic Creature Template',
        content: `// HOW TO MAKE SWIMMING CREATURES (from Fish.js)
// Check for water and adjust physics accordingly

constructor(game, x, y, z, seed) {
    super(game, x, y, z, seed);
    this.gravity = 0;  // Disable gravity in constructor
}

updatePhysics(dt) {
    // Check if in water
    const pos = this.position;
    const block = this.game.getBlock(
        Math.floor(pos.x),
        Math.floor(pos.y),
        Math.floor(pos.z)
    );
    const inWater = block && block.type === 'water';

    if (inWater) {
        // 3D Swimming - apply drag
        this.velocity.y *= 0.9;
        this.velocity.x *= 0.9;
        this.velocity.z *= 0.9;

        // Swim in move direction
        const speed = 2.0;
        this.velocity.x += this.moveDirection.x * speed * dt;
        this.velocity.y += this.moveDirection.y * speed * dt;
        this.velocity.z += this.moveDirection.z * speed * dt;

        this.position.add(this.velocity.clone().multiplyScalar(dt));
    } else {
        // Out of water - flop!
        this.velocity.y -= 30.0 * dt;  // Apply gravity
        super.updateWalkerPhysics(dt);

        // Random jump to get back to water
        if (this.onGround && Math.random() < 0.05) {
            this.velocity.y = 5;
            this.velocity.x = (Math.random() - 0.5) * 5;
            this.velocity.z = (Math.random() - 0.5) * 5;
        }
    }
}`,
        tags: ['swim', 'swimming', 'water', 'aquatic', 'fish', 'dolphin', 'ocean', 'sea', 'underwater', 'float', 'dive']
    },

    // 6. HUNTING AI TEMPLATE (from Wolf.js, Cat.js)
    {
        category: 'template',
        title: 'Hunting Chase AI Template',
        content: `// HOW TO MAKE CREATURES HUNT/CHASE (from Wolf.js, Cat.js)

updateAI(dt) {
    const detectionRange = 20.0;  // How far can detect prey
    const attackRange = 1.5;       // Distance to attack
    let target = null;
    let nearestDist = detectionRange * detectionRange;

    // Find nearest target
    if (this.game.animals) {
        for (const animal of this.game.animals) {
            // Replace TargetClass with what you want to hunt (e.g., Bunny, Mouse)
            if (animal.constructor.name === 'Bunny' && !animal.isDead) {
                const distSq = this.position.distanceToSquared(animal.position);
                if (distSq < nearestDist) {
                    nearestDist = distSq;
                    target = animal;
                }
            }
        }
    }

    if (target) {
        this.state = 'chase';
        const dir = new window.THREE.Vector3().subVectors(
            target.position, this.position
        );
        const dist = dir.length();

        if (dist < attackRange) {
            // ATTACK!
            if (this.attackTimer <= 0) {
                target.takeDamage(10);
                this.attackTimer = 1.0;  // Cooldown
            }
        } else {
            // Move towards target
            dir.normalize();
            this.moveDirection.copy(dir);
            this.rotation = Math.atan2(dir.x, dir.z);
            this.isMoving = true;
            this.speed = 5.0;  // Run faster when chasing!
        }
    } else {
        // No targets, wander
        this.speed = 3.0;
        super.updateAI(dt);
    }

    if (this.attackTimer > 0) this.attackTimer -= dt;
}`,
        tags: ['hunt', 'hunting', 'chase', 'chasing', 'predator', 'attack', 'aggressive', 'wolf', 'cat', 'monster', 'enemy', 'hostile']
    },

    // 7. WAND ITEM PROJECTILE TEMPLATE (from LevitationWandItem.js)
    {
        category: 'template',
        title: 'Wand Item Projectile Template',
        content: `// HOW TO CREATE A WAND THAT SHOOTS PROJECTILES (from LevitationWandItem.js)

class MyWandItem {
    constructor() {
        this.id = 'my_wand';
        this.name = 'Magic Wand';
        this.maxStack = 1;
        this.isTool = true;
        
        // SVG ICON (required for inventory display!)
        this.icon = '<svg viewBox="0 0 24 24"><rect x="10" y="2" width="4" height="18" fill="#9333EA" rx="1"/><circle cx="12" cy="4" r="3" fill="#A855F7"/><path d="M8,22 L16,22 L14,18 L10,18 Z" fill="#6B21A8"/></svg>';
    }

    onUseDown(game, player) {
        // Get camera direction
        const camDir = new window.THREE.Vector3();
        game.camera.getWorldDirection(camDir);

        // Spawn position in front of camera
        const spawnPos = game.camera.position.clone()
            .add(camDir.clone().multiplyScalar(1.0));

        // Call game's projectile spawn method
        // Options: spawnProjectile, spawnMagicProjectile, spawnFireball, etc.
        game.spawnMagicProjectile(spawnPos, camDir);

        return true;  // Indicate item was used
    }

    onPrimaryDown(game, player) {
        return this.onUseDown(game, player);
    }
}`,
        tags: ['wand', 'projectile', 'shoot', 'magic', 'spell', 'cast', 'item', 'weapon', 'staff', 'rod', 'fireball', 'shoot']
    },

    // 8. SPAWN EGG RAYCAST ITEM TEMPLATE (from SpawnEggItem.js)
    {
        category: 'template',
        title: 'Raycast Target Item Template',
        content: `// HOW TO CREATE ITEMS THAT TARGET WHERE PLAYER LOOKS (from SpawnEggItem.js)

class MyTargetItem {
    constructor() {
        this.id = 'target_item';
        this.name = 'Target Item';
        this.maxStack = 64;
        
        this.icon = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#22C55E"/><circle cx="12" cy="12" r="6" fill="#16A34A"/><circle cx="12" cy="12" r="2" fill="#052E16"/></svg>';
    }

    onUseDown(game, player) {
        // Create raycast from camera center
        const raycaster = new window.THREE.Raycaster();
        const center = new window.THREE.Vector2(0, 0);
        raycaster.setFromCamera(center, game.camera);

        // Find what player is looking at
        const intersects = raycaster.intersectObjects(game.scene.children, true);

        for (let i = 0; i < intersects.length; i++) {
            const hit = intersects[i];

            // Skip player mesh
            if (hit.object.isPlayer || hit.object === player.mesh) continue;

            if (hit.distance < 100) {
                // hit.point = exact world position
                const pos = hit.point;
                
                // DO SOMETHING AT THIS POSITION
                // Examples:
                // game.spawnManager.createAnimal(AnimalClass, pos.x, pos.y + 0.1, pos.z);
                // game.createExplosion(pos.x, pos.y, pos.z, 3);
                // game.setBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z), BLOCK_TYPE);
                
                return true;  // Consume item
            }
        }
        return false;
    }
}`,
        tags: ['raycast', 'target', 'aim', 'point', 'click', 'spawn', 'place', 'teleport', 'egg', 'item']
    },

    // 9. CREATURE EYE PATTERN (from Wolf.js, Cat.js) 
    {
        category: 'template',
        title: 'Creature Eye Construction Pattern',
        content: `// HOW TO CREATE REALISTIC EYES (from Wolf.js, Cat.js)
// Eyes = white background + black pupil, positioned slightly forward

createEyes() {
    const whiteMat = new window.THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    const blackMat = new window.THREE.MeshLambertMaterial({ color: 0x000000 });
    
    // Eye background (white)
    const eyeGeo = new window.THREE.BoxGeometry(0.1, 0.1, 0.05);
    
    // Pupil (black, smaller)
    const pupilGeo = new window.THREE.BoxGeometry(0.05, 0.05, 0.05);

    // HEAD_Y and HEAD_Z should be where your head mesh is positioned
    const HEAD_Y = 0.95;
    const HEAD_Z = 1.2;
    const EYE_SPACING = 0.15;  // Distance from center

    // Left Eye
    const leftEye = new window.THREE.Mesh(eyeGeo, whiteMat);
    leftEye.position.set(-EYE_SPACING, HEAD_Y, HEAD_Z);
    this.mesh.add(leftEye);

    // Left Pupil (slightly forward!)
    const leftPupil = new window.THREE.Mesh(pupilGeo, blackMat);
    leftPupil.position.set(-EYE_SPACING, HEAD_Y, HEAD_Z + 0.03);
    this.mesh.add(leftPupil);

    // Right Eye
    const rightEye = new window.THREE.Mesh(eyeGeo, whiteMat);
    rightEye.position.set(EYE_SPACING, HEAD_Y, HEAD_Z);
    this.mesh.add(rightEye);

    // Right Pupil
    const rightPupil = new window.THREE.Mesh(pupilGeo, blackMat);
    rightPupil.position.set(EYE_SPACING, HEAD_Y, HEAD_Z + 0.03);
    this.mesh.add(rightPupil);
}

// TIPS:
// - Pupil Z should be slightly MORE than eye Z (in front)
// - Eye size ~0.08-0.12 for medium creatures
// - For colored eyes (cat), use color like 0x2ecc71 instead of white`,
        tags: ['eye', 'eyes', 'pupil', 'face', 'anatomy', 'visual', 'look', 'see', 'creature', 'head']
    },

    // 10. TAIL ANIMATION PATTERN (from Fish.js, Cat.js)
    {
        category: 'template',
        title: 'Tail Wagging Animation Pattern',
        content: `// HOW TO ANIMATE TAILS (from Fish.js, Cat.js)

createBody() {
    // ... other body parts ...
    
    // Create tail and store reference
    const tailGeo = new window.THREE.BoxGeometry(0.1, 0.1, 0.5);
    const mat = new window.THREE.MeshLambertMaterial({ color: 0x808080 });
    this.tail = new window.THREE.Mesh(tailGeo, mat);
    this.tail.position.set(0, 0.5, -0.6);  // Behind body
    this.tail.rotation.x = 0.5;  // Slight angle up
    this.mesh.add(this.tail);
}

updateAnimation(dt) {
    if (this.tail) {
        // Simple sine wave wag
        this.tail.rotation.y = Math.sin(performance.now() * 0.01) * 0.4;
        
        // Or wag based on isMoving state:
        // if (this.isMoving) {
        //     this.tail.rotation.y = Math.sin(performance.now() * 0.02) * 0.6;
        // } else {
        //     this.tail.rotation.y = Math.sin(performance.now() * 0.005) * 0.2;
        // }
    }
}`,
        tags: ['tail', 'wag', 'animation', 'animate', 'move', 'swing', 'sway', 'dog', 'cat', 'creature']
    },

    // 11. POTION/CONSUMABLE ITEM TEMPLATE
    {
        category: 'template',
        title: 'Healing Potion Consumable Template',
        content: `// HOW TO CREATE POTIONS/CONSUMABLES

class HealingPotionItem {
    constructor() {
        this.id = 'healing_potion';
        this.name = 'Healing Potion';
        this.maxStack = 16;
        this.isTool = false;  // Not a tool
        
        // SVG POTION ICON
        this.icon = '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="4" ry="2" fill="#666"/><path d="M8,6 L8,10 L6,20 Q6,22 12,22 Q18,22 18,20 L16,10 L16,6" fill="#EF4444"/><ellipse cx="12" cy="18" rx="5" ry="2" fill="#DC2626" opacity="0.5"/></svg>';
    }

    onUseDown(game, player) {
        // Heal the player
        const healAmount = 20;  // Heal 10 hearts (20 HP)
        
        if (player.health < player.maxHealth) {
            player.health = Math.min(player.health + healAmount, player.maxHealth);
            
            // Optional: Visual/audio feedback
            // game.playSound('potion_drink');
            // game.createParticles(player.position, 'heal');
            
            return true;  // Consume the item
        }
        
        return false;  // Don't consume if already full health
    }
}`,
        tags: ['potion', 'heal', 'health', 'restore', 'consumable', 'drink', 'item', 'recovery', 'medicine', 'elixir']
    },

    // BOUNCING CREATURE TEMPLATE
    {
        category: 'template',
        title: 'Bouncing Hopping Creature Template',
        content: `// HOW TO MAKE CREATURES BOUNCE/HOP (like slimes or frogs)
// Uses jump() periodically with physics gravity for natural bouncing
// INCLUDES: Throttled behavior logging (logs first 5 times, then stops)

createBody() {
    this.bounceTimer = 0;
    this.bounceInterval = 0.8 + Math.random() * 0.4;  // Random bounce timing
    this._behaviorLogCount = 0;  // For throttled logging
    
    // Create a squishy-looking body (spherical or blob shape)
    const bodyGeo = new window.THREE.SphereGeometry(0.5, 16, 16);
    const bodyMat = new window.THREE.MeshLambertMaterial({ color: 0x44FF44 });  // Green slime
    const body = new window.THREE.Mesh(bodyGeo, bodyMat);
    this.mesh.add(body);
    
    // Add eyes
    const eyeGeo = new window.THREE.SphereGeometry(0.1, 8, 8);
    const eyeMat = new window.THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    const leftEye = new window.THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.15, 0.2, 0.4);
    this.mesh.add(leftEye);
    
    const rightEye = new window.THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.15, 0.2, 0.4);
    this.mesh.add(rightEye);
}

// THROTTLED LOG: Only logs first 5 times, then auto-stops
_logBehavior(action) {
    if (this._behaviorLogCount < 5) {
        console.log(\`[BEHAVIOR] \${this.constructor.name}: \${action}\`);
        this._behaviorLogCount++;
    }
}

updateAI(dt) {
    super.updateAI(dt);  // Keep default wander behavior
    
    this.bounceTimer += dt;
    
    if (this.bounceTimer >= this.bounceInterval && this.onGround) {
        // BOUNCE!
        this.jump();
        this.bounceTimer = 0;
        this.bounceInterval = 0.8 + Math.random() * 0.4;  // Randomize next bounce
        
        // Log bouncing behavior (throttled)
        this._logBehavior('BOUNCE! Height: ' + this.position.y.toFixed(2));
    }
    
    // Squish effect when landing
    if (this.onGround && this.mesh) {
        this.mesh.scale.y = 0.8;  // Squished
        this.mesh.scale.x = 1.1;
        this.mesh.scale.z = 1.1;
    } else if (this.mesh) {
        this.mesh.scale.y = 1.1;  // Stretched in air
        this.mesh.scale.x = 0.9;
        this.mesh.scale.z = 0.9;
    }
}`,
        tags: ['bounce', 'bouncing', 'hop', 'hopping', 'jump', 'jumping', 'slime', 'frog', 'spring', 'blob']
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
