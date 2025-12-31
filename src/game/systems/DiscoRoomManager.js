import { Blocks } from '../core/Blocks.js';
import * as THREE from 'three';

export class DiscoRoomManager {
    constructor(game) {
        this.game = game;
    }

    spawnDiscoRoom(centerPos) {
        const x = Math.round(centerPos.x);
        const y = Math.round(centerPos.y);
        const z = Math.round(centerPos.z);

        console.log(`[DiscoRoom] Spawning at ${x}, ${y}, ${z}`);

        const width = 10;
        const height = 6;
        const depth = 10;
        const halfW = width / 2;
        const halfD = depth / 2;

        // 1. Clear area & Build Walls/Ceiling
        for (let dx = -halfW; dx <= halfW; dx++) {
            for (let dy = 0; dy <= height; dy++) {
                for (let dz = -halfD; dz <= halfD; dz++) {
                    const bx = x + dx;
                    const by = y + dy;
                    const bz = z + dz;

                    // Interior air
                    this.game.setBlock(bx, by, bz, Blocks.AIR);
                }
            }
        }

        // Build Shell
        for (let dx = -halfW - 1; dx <= halfW + 1; dx++) {
            for (let dy = -1; dy <= height + 1; dy++) {
                for (let dz = -halfD - 1; dz <= halfD + 1; dz++) {
                    const bx = x + dx;
                    const by = y + dy;
                    const bz = z + dz;

                    // Floor
                    if (dy === -1) {
                        // Checkerboard dance floor
                        if (Math.abs(dx) <= halfW && Math.abs(dz) <= halfD) {
                            if ((Math.abs(dx) + Math.abs(dz)) % 2 === 0) {
                                this.game.setBlock(bx, by, bz, Blocks.OBSIDIAN);
                            } else {
                                this.game.setBlock(bx, by, bz, Blocks.GLASS); // Or glowing block if valid
                            }
                        } else {
                            this.game.setBlock(bx, by, bz, Blocks.STONE);
                        }
                        continue;
                    }

                    // Ceiling
                    if (dy === height) {
                        this.game.setBlock(bx, by, bz, Blocks.OBSIDIAN);
                        continue;
                    }

                    // Walls
                    if (Math.abs(dx) === halfW + 1 || Math.abs(dz) === halfD + 1) {
                        if (dy >= 0 && dy < height) {
                            this.game.setBlock(bx, by, bz, Blocks.OBSIDIAN);
                        }
                    }
                }
            }
        }

        // 2. Disco Ball
        // Center of room
        const cx = x;
        const cz = z;
        const ceilY = y + height - 1; // Just below ceiling

        // Chain
        this.game.setBlock(cx, ceilY, cz, Blocks.IRON_BARS);
        this.game.setBlock(cx, ceilY - 1, cz, Blocks.DISCO_BALL);

        // 3. Entrance (User's side?)
        // Assuming user is outside looking in, clear a door on +Z side
        this.game.setBlock(x, y, z + halfD + 1, Blocks.AIR);
        this.game.setBlock(x, y + 1, z + halfD + 1, Blocks.AIR);


        this.game.updateChunks();

        if (this.game.uiManager) {
            this.game.uiManager.addChatMessage('system', 'Let\'s boogie! Disco Room Spawned!');
        }
    }
}
