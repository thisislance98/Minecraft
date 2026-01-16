import { initKnowledgeService, searchKnowledge, addKnowledge, getAllKnowledge } from '../server/services/KnowledgeService';

async function testRetrieval() {
    const query = process.argv[2];
    if (!query) {
        console.error('Usage: npx tsx scripts/test_knowledge.ts <query>');
        process.exit(1);
    }

    console.log(`Searching knowledge for: "${query}"...`);

    // Initialize (loads from local seed/db)
    await initKnowledgeService();

    // Manually add entries to simulate DB content (based on ACTUAL codebase patterns)
    const manualEntries = [
        // GLOW / EMISSIVE (from Firefly.js)
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

        // FLYING / FLOATING (from Firefly.js)
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
        // Random flight direction
        if (!this.targetDir || Math.random() < 0.05) {
            this.targetDir = new window.THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 1,
                (Math.random() - 0.5) * 2
            ).normalize();
        }
        // Apply velocity with sinusoidal bob
        this.velocity.y = (this.targetDir.y * this.speed) + Math.sin(this.floatPhase) * 0.5;
    }
    
    updatePhysics(dt) {
        // Override to DISABLE gravity - let updateAI control position
    }
}`,
            tags: ['flying', 'float', 'hover', 'fly', 'air', 'bird', 'flight', 'gravity']
        },

        // FOLLOW PLAYER (from Merlin.js)
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
        // Move towards player
        const angle = Math.atan2(dx, dz);
        this.rotation = angle;
        this.moveDirection.set(Math.sin(angle), 0, Math.cos(angle));
        this.isMoving = true;
    } else {
        // Close enough, stop and face player
        this.isMoving = false;
        this.rotation = Math.atan2(dx, dz);
    }
}`,
            tags: ['follow', 'player', 'pet', 'companion', 'chase', 'move', 'AI']
        },

        // TELEPORT (from Merlin.js)
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
    
    // Teleport behind player
    this.position.x = player.position.x - dir.x * this.followDistance;
    this.position.y = player.position.y + 1;
    this.position.z = player.position.z - dir.z * this.followDistance;
    
    // Spawn visual particles
    this.spawnTeleportParticles();
}

spawnTeleportParticles() {
    const particleMat = new window.THREE.MeshBasicMaterial({ 
        color: 0x00ffff, transparent: true, opacity: 0.8 
    });
    for (let i = 0; i < 10; i++) {
        const p = new window.THREE.Mesh(
            new window.THREE.BoxGeometry(0.1, 0.1, 0.1), 
            particleMat.clone()
        );
        p.position.copy(this.position);
        p.position.x += (Math.random() - 0.5) * 2;
        this.game.scene.add(p);
        // Animate out over 1 second...
    }
}`,
            tags: ['teleport', 'warp', 'blink', 'flash', 'instant', 'move', 'particles']
        },

        // EXPLOSION (from MagicProjectile.js)
        {
            category: 'template',
            title: 'Explosion Template',
            content: `// From MagicProjectile.js - Explosion with area damage
explode(pos) {
    if (this.hasExploded) return;
    this.hasExploded = true;
    
    // Remove visual mesh
    this.game.scene.remove(this.mesh);
    
    // Spawn explosion particles
    const explosionColor = 0xFF4400;
    for (let i = 0; i < 20; i++) {
        const p = new window.THREE.Mesh(
            new window.THREE.SphereGeometry(0.2),
            new window.THREE.MeshBasicMaterial({ color: explosionColor })
        );
        p.position.copy(pos);
        p.velocity = new window.THREE.Vector3(
            (Math.random() - 0.5) * 10,
            Math.random() * 5,
            (Math.random() - 0.5) * 10
        );
        this.game.scene.add(p);
    }
    
    // Area damage to nearby entities
    const radius = 5.0;
    for (const entity of this.game.entities) {
        if (entity.position.distanceTo(pos) < radius) {
            entity.takeDamage(10, this);
        }
    }
}`,
            tags: ['explosion', 'explode', 'boom', 'damage', 'area', 'aoe', 'blast', 'bomb']
        },

        // INVISIBILITY ITEM
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

        // PROJECTILE (from MagicProjectile.js)
        {
            category: 'template',
            title: 'Projectile Template',
            content: `// From MagicProjectile.js - Basic projectile with collision
class Projectile {
    constructor(game, position, velocity) {
        this.game = game;
        this.position = position.clone();
        this.velocity = velocity.clone().normalize().multiplyScalar(25); // speed
        this.lifeTime = 0;
        this.maxLifeTime = 5.0;
        
        // Create mesh
        const geo = new window.THREE.SphereGeometry(0.2);
        const mat = new window.THREE.MeshBasicMaterial({ color: 0xFF00FF });
        this.mesh = new window.THREE.Mesh(geo, mat);
        this.mesh.position.copy(this.position);
        this.game.scene.add(this.mesh);
    }
    
    update(dt) {
        this.lifeTime += dt;
        if (this.lifeTime > this.maxLifeTime) {
            this.game.scene.remove(this.mesh);
            return false; // Remove projectile
        }
        
        // Move
        this.position.add(this.velocity.clone().multiplyScalar(dt));
        this.mesh.position.copy(this.position);
        
        // Check collision with blocks
        const block = this.game.getBlock(
            Math.floor(this.position.x),
            Math.floor(this.position.y),
            Math.floor(this.position.z)
        );
        if (block && block !== 0) {
            this.onHit();
            return false;
        }
        return true;
    }
    
    onHit() {
        // Override in subclass for explosion, etc.
        this.game.scene.remove(this.mesh);
    }
}`,
            tags: ['projectile', 'shoot', 'fire', 'bullet', 'arrow', 'magic', 'wand', 'bow']
        },

        // HEALING
        {
            category: 'template',
            title: 'Healing Template',
            content: `// Heal player or entity
healEntity(entity, amount) {
    entity.health = Math.min(entity.health + amount, entity.maxHealth);
    
    // Visual feedback - green particles
    const healMat = new window.THREE.MeshBasicMaterial({ 
        color: 0x00FF00, transparent: true, opacity: 0.8 
    });
    for (let i = 0; i < 5; i++) {
        const p = new window.THREE.Mesh(
            new window.THREE.SphereGeometry(0.1), 
            healMat.clone()
        );
        p.position.copy(entity.position);
        p.position.y += Math.random() * 2;
        this.game.scene.add(p);
        // Float up and fade...
    }
    
    this.game.chat('Healed for ' + amount + ' HP!');
}

// For items:
onUseDown(game, player) {
    player.health = Math.min(player.health + 20, player.maxHealth);
    game.chat('Healed!');
}`,
            tags: ['heal', 'health', 'restore', 'potion', 'regenerate', 'hp', 'life']
        }
    ];

    for (const entry of manualEntries) {
        // @ts-ignore
        const result = await addKnowledge(entry);
        console.log(`  Seeded: ${entry.title} - success: ${result.success}`);
    }

    // Check cache state using static import
    const allEntries = getAllKnowledge();
    console.log(`Manual seeding complete. Cache size: ${allEntries.length}`);

    const results = searchKnowledge(query);

    if (results.length === 0) {
        console.log('No matching knowledge found.');
    } else {
        console.log(`Found ${results.length} results:`);
        results.forEach((entry, i) => {
            console.log(`\n--- Result ${i + 1} ---`);
            console.log(`Title: ${entry.title}`);
            console.log(`Category: ${entry.category}`);
            console.log(`Tags: ${entry.tags ? entry.tags.join(', ') : 'none'}`);
            console.log(`Content Snippet:\n${entry.content.substring(0, 200)}...`);
        });
    }
}

testRetrieval().catch(console.error);
