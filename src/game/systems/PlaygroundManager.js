import { Blocks } from '../core/Blocks.js';
import { SwingEntity } from '../entities/furniture/SwingEntity.js';
import * as THREE from 'three';

export class PlaygroundManager {
    constructor(game) {
        this.game = game;
    }

    spawnPlayground(centerPos) {
        const x = Math.round(centerPos.x);
        const y = Math.round(centerPos.y);
        const z = Math.round(centerPos.z);

        console.log(`[Playground] Spawning at ${x}, ${y}, ${z}`);

        // 1. Tower Base (3x3)
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                // Ground floor
                this.game.setBlock(x + dx, y, z + dz, Blocks.LOG);
                // Floor at y+3
                this.game.setBlock(x + dx, y + 3, z + dz, Blocks.PLANK);
            }
        }

        // Tower Pillars
        for (let dy = 0; dy <= 4; dy++) {
            this.game.setBlock(x - 1, y + dy, z - 1, Blocks.LOG);
            this.game.setBlock(x + 1, y + dy, z - 1, Blocks.LOG);
            this.game.setBlock(x - 1, y + dy, z + 1, Blocks.LOG);
            this.game.setBlock(x + 1, y + dy, z + 1, Blocks.LOG);
        }

        // Roof
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                this.game.setBlock(x + dx, y + 5, z + dz, Blocks.PLANK);
            }
        }

        // 2. Stairs (leading to y+3)
        for (let i = 1; i <= 3; i++) {
            this.game.setBlock(x, y + i, z + 1 + i, Blocks.PLANK);
            // Side rails
            this.game.setBlock(x - 1, y + i, z + 1 + i, Blocks.FENCE);
            this.game.setBlock(x + 1, y + i, z + 1 + i, Blocks.FENCE);
        }

        // 3. Slide (from z-1, y+3 downwards)
        // Red slide blocks
        for (let i = 1; i <= 4; i++) {
            this.game.setBlock(x, y + 3 - (i - 1), z - 1 - i, Blocks.SLIDE_BLOCK);
            // Side borders for the slide
            this.game.setBlock(x - 1, y + 3 - (i - 1) + 1, z - 1 - i, Blocks.PLANK);
            this.game.setBlock(x + 1, y + 3 - (i - 1) + 1, z - 1 - i, Blocks.PLANK);
        }

        // 4. Swing Set (beam extending from tower)
        const beamY = y + 4;
        for (let dx = 2; dx <= 6; dx++) {
            this.game.setBlock(x + dx, beamY, z, Blocks.LOG);
        }
        // Support pillar at the end
        for (let dy = 0; dy < 4; dy++) {
            this.game.setBlock(x + 6, y + dy, z, Blocks.LOG);
        }

        // 5. Spawn Swing Entity
        if (this.game.animals) {
            const swing = new SwingEntity(this.game, x + 4, y + 1, z);
            this.game.animals.push(swing);
            this.game.scene.add(swing.mesh);
        }

        this.game.updateChunks();

        if (this.game.uiManager) {
            this.game.uiManager.addChatMessage('system', 'Playground Spawned! Have fun!');
        }
    }
}
