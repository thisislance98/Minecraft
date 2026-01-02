import { Blocks } from '../core/Blocks.js';
import { MazeGenerator } from '../utils/MazeGenerator.js';

/**
 * MazeManager.js
 * Handles the instantiation of mazes in the game world.
 */
export class MazeManager {
    constructor(game) {
        this.game = game;
        this.generator = new MazeGenerator();
    }

    /**
     * Generates a maze around the specified position.
     * @param {Object} centerPos - {x, y, z}
     * @param {number} size - Width/Depth of the maze (odd number preferred)
     */
    generateMaze(centerPos, size = 21, height = 4) {
        console.log("Generating maze at", centerPos);
        const mazeGrid = this.generator.generate(size, size);

        // Ensure there is at least one exit
        mazeGrid[0][1] = 0;

        const startX = Math.floor(centerPos.x) - Math.floor(size / 2);
        const startY = Math.floor(centerPos.y); // Floor level
        const startZ = Math.floor(centerPos.z) - Math.floor(size / 2);

        // Build the maze
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const isWall = mazeGrid[row][col] === 1;

                const worldX = startX + col;
                const worldZ = startZ + row;

                // Floor
                this.game.setBlock(worldX, startY - 1, worldZ, Blocks.BEDROCK, true);

                // Ceiling
                this.game.setBlock(worldX, startY + height, worldZ, Blocks.BEDROCK, true);

                if (isWall) {
                    for (let h = 0; h < height; h++) {
                        this.game.setBlock(worldX, startY + h, worldZ, Blocks.MAZE_BLOCK, true);
                    }
                } else {
                    // Air/Path - Using null rather than Blocks.AIR is more standard for empty space
                    for (let h = 0; h < height; h++) {
                        this.game.setBlock(worldX, startY + h, worldZ, null, true);
                    }

                    // Add torches occasionally?
                    if (this.generator.random() > 0.95) {
                        this.game.setBlock(worldX, startY, worldZ, Blocks.TORCH, true);
                    }
                }
            }
        }

        // Teleport player to center if not already there?
        // Center of maze logic:
        const centerIdx = Math.floor(size / 2);
        if (mazeGrid[centerIdx][centerIdx] === 1) {
            // Force clear center
            for (let h = 0; h < height; h++) {
                this.game.setBlock(startX + centerIdx, startY + h, startZ + centerIdx, null, true);
            }
        }

        // --- STABILITY FIX: Teleport player safely above floor before mesh update ---
        // This ensures they are resting on something once gravity kicks in
        this.game.player.position.y = startY + 1.0;
        this.game.player.velocity.set(0, 0, 0);

        // Batch update meshes once
        this.game.updateChunks();

        if (this.game.uiManager) {
            this.game.uiManager.addChatMessage('system', "Maze Generated!");
        }
    }
}
