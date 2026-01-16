/**
 * Seed data for Merlin's knowledge base
 * Run with: npx tsx server/knowledge/seed.ts
 */

import { addKnowledge, initKnowledgeService } from '../services/KnowledgeService';

const SEED_DATA = [
    // Templates
    {
        category: 'template' as const,
        title: 'Spinning Creature Template',
        content: `class SpinningCreature extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.spinSpeed = 2;
    }
    createBody() {
        const geo = new window.THREE.BoxGeometry(1, 1, 1);
        const mat = new window.THREE.MeshStandardMaterial({ color: 0xff0000 });
        this.mesh = new window.THREE.Mesh(geo, mat);
        this.mesh.position.set(this.x, this.y, this.z);
        this.game.scene.add(this.mesh);
    }
    update(delta) {
        super.update(delta);
        if (this.mesh) this.mesh.rotation.y += this.spinSpeed * delta;
    }
}`,
        tags: ['spinning', 'rotation', 'animation', 'cube']
    },
    {
        category: 'template' as const,
        title: 'Flying Creature Template',
        content: `class FlyingCreature extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.floatOffset = 0;
        this.floatSpeed = 2;
        this.floatAmplitude = 0.5;
    }
    update(delta) {
        super.update(delta);
        this.floatOffset += delta * this.floatSpeed;
        if (this.mesh) {
            this.mesh.position.y = this.y + Math.sin(this.floatOffset) * this.floatAmplitude;
        }
    }
}`,
        tags: ['flying', 'floating', 'hover', 'animation']
    },
    {
        category: 'template' as const,
        title: 'Glowing Creature Template',
        content: `// Use emissive property for glow effect
const mat = new window.THREE.MeshStandardMaterial({
    color: 0x00ff00,
    emissive: 0x00ff00,
    emissiveIntensity: 0.5
});`,
        tags: ['glow', 'emissive', 'light', 'material']
    },

    // Gotchas
    {
        category: 'gotcha' as const,
        title: 'Use window.THREE not THREE',
        content: 'CRITICAL: In dynamic creature code, always use window.THREE instead of THREE directly. The bare THREE reference is not available in the Function constructor scope.',
        tags: ['THREE', 'error', 'scope', 'common']
    },
    {
        category: 'gotcha' as const,
        title: 'Always call super.update(delta)',
        content: 'When overriding update(), always call super.update(delta) first. This handles core animal physics, collision, and state management.',
        tags: ['update', 'super', 'inheritance', 'physics']
    },
    {
        category: 'gotcha' as const,
        title: 'Mesh position vs entity position',
        content: 'The mesh.position is the visual position. The entity x,y,z are the logical position. When moving, update both or use the provided movement methods.',
        tags: ['position', 'mesh', 'movement', 'sync']
    },
    {
        category: 'gotcha' as const,
        title: 'createBody() must add mesh to scene',
        content: 'After creating the mesh in createBody(), you MUST call this.game.scene.add(this.mesh). Otherwise the creature will be invisible.',
        tags: ['createBody', 'scene', 'invisible', 'mesh']
    },

    // How-tos
    {
        category: 'howto' as const,
        title: 'How to make creature follow player',
        content: `In update(delta), get player position and move towards it:
const player = this.game.player;
const dx = player.position.x - this.mesh.position.x;
const dz = player.position.z - this.mesh.position.z;
const dist = Math.sqrt(dx*dx + dz*dz);
if (dist > 3) {
    this.mesh.position.x += (dx/dist) * this.speed * delta;
    this.mesh.position.z += (dz/dist) * this.speed * delta;
}`,
        tags: ['follow', 'player', 'movement', 'AI']
    },
    {
        category: 'howto' as const,
        title: 'How to change creature color dynamically',
        content: `Add a setColor method:
setColor(hexColor) {
    if (this.mesh && this.mesh.material) {
        this.mesh.material.color.setHex(hexColor);
    }
}`,
        tags: ['color', 'material', 'dynamic', 'setColor']
    }
];

async function seed() {
    console.log('Initializing knowledge service...');
    await initKnowledgeService();

    console.log('Seeding knowledge base...');
    for (const entry of SEED_DATA) {
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

seed().catch(console.error);
