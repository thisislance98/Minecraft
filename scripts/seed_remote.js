
import { AntigravityClient } from '../ai-test-cli/src/client.js';

const EXPANDED_DATA = [
    {
        category: 'template',
        title: 'Advanced Particle Entity Template',
        content: `class ParticleEntity extends Animal {
    constructor(game, position) {
        this.game = game;
        this.position = position.clone();
        this.lifeTime = 0;
        this.maxLifeTime = 10.0;
        this.particles = [];
        this.particleSystem = this.createParticleSystem();
        this.game.scene.add(this.particleSystem);
    }
    createParticleSystem() {
        const count = 200;
        const geometry = new window.THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const material = new window.THREE.PointsMaterial({ color: 0x88CCFF, size: 0.5, transparent: true, opacity: 0.8 });
        for (let i = 0; i < count; i++) {
            this.particles.push({ angle: Math.random() * Math.PI * 2, radius: 2 + Math.random() * 3, y: Math.random() * 5, speed: 1 + Math.random() });
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
            return false;
        }
        const positions = this.particleSystem.geometry.attributes.position.array;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.angle += p.speed * dt;
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
    {
        category: 'template',
        title: 'Interactive Tool Item Template',
        content: `class CustomToolItem extends Item {
    constructor() {
        super('custom_tool_jetpack', 'Jetpack');
        this.maxStack = 1;
        this.isTool = true;
    }
    onUseDown(game, player) {
        game.chat('Lift off!');
        if (player.velocity) player.velocity.y += 15;
        return true;
    }
}`,
        tags: ['item', 'tool', 'interaction', 'custom_item', 'click', 'jetpack']
    }
];

async function seedRemote() {
    const client = new AntigravityClient();
    try {
        console.log('Connecting to server...');
        await client.connect();

        console.log('Seeding knowledge via tool calls...');
        for (const entry of EXPANDED_DATA) {
            // We use specific prompt to force the tool call
            const prompt = `Add this knowledge to your database: Title: "${entry.title}", Category: "${entry.category}", Tags: ${entry.tags.join(',')}. Content: \`\`\`${entry.content}\`\`\``;

            console.log(`Sending: ${entry.title}`);
            // We can't directly verify success easily without listening to tool outputs, 
            // but we'll fire and forget for this script with a slight delay.
            client.sendPrompt(prompt);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log('Done!');
        client.disconnect();
        process.exit(0);
    } catch (e) {
        console.error('Failed:', e);
        process.exit(1);
    }
}

seedRemote();
