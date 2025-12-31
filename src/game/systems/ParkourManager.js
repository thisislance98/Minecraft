import { Blocks } from '../core/Blocks.js';
import * as THREE from 'three';

/**
 * ParkourManager - Handles the parkour mini-game logic with level progression.
 */
export class ParkourManager {
    constructor(game) {
        this.game = game;
        this.isActive = false;
        this.currentLevel = 1;
        this.generatedBlocks = []; // Track blocks we placed for cleanup
        this.platforms = []; // Array of THREE.Vector3 for platform positions
        this.finishPos = null;
        this.startPos = null;
        this.returnPos = new THREE.Vector3();
    }

    /**
     * Start the parkour challenge
     */
    start(triggerPos) {
        if (this.isActive) return;

        this.isActive = true;
        this.currentLevel = 1;
        this.returnPos.copy(this.game.player.position);
        this.generatedBlocks = [];
        this.platforms = [];

        console.log('[Parkour] Started Level 1!');

        if (this.game.uiManager) {
            this.game.uiManager.addChatMessage('system', 'Parkour Challenge Started! Level 1: The Basics');
            if (this.game.soundManager) {
                this.game.soundManager.playSound('click');
            }
        }

        this.generateCourse(new THREE.Vector3(triggerPos.x, triggerPos.y + 20, triggerPos.z));

        // Teleport player to first platform
        this.teleportToStart();

        this.game.updateChunks();
    }

    teleportToStart() {
        if (this.platforms.length > 0) {
            const first = this.platforms[0];
            this.game.player.position.set(first.x, first.y + 1, first.z);
            this.game.player.velocity.set(0, 0, 0);
        }
    }

    /**
     * Generate a series of platforms in the sky
     */
    generateCourse(startPos) {
        // Difficulty scaling based on level
        const platformCount = 10 + (this.currentLevel * 2);
        const platformSize = this.currentLevel === 1 ? 1 : 0; // 0 means 1x1, 1 means 3x3 (dx/dz from -size to size)
        const maxDist = 3 + Math.min(this.currentLevel * 0.5, 3);
        const maxHeightDiff = this.currentLevel === 1 ? 0 : 1;

        let currentPos = startPos.clone();

        for (let i = 0; i < platformCount; i++) {
            // Randomly offset the next platform
            const angle = (Math.random() - 0.5) * Math.PI; // Forward-ish
            const dist = 3 + Math.random() * (maxDist - 3);

            const nextX = currentPos.x + Math.cos(angle) * dist;
            const nextY = currentPos.y + (Math.random() > 0.7 ? maxHeightDiff : 0);
            const nextZ = currentPos.z + Math.sin(angle) * dist;

            currentPos.set(nextX, nextY, nextZ);

            const roundedPos = new THREE.Vector3(
                Math.round(currentPos.x),
                Math.round(currentPos.y),
                Math.round(currentPos.z)
            );

            // Start and End are always bigger
            const size = (i === 0 || i === platformCount - 1) ? 1 : platformSize;

            for (let dx = -size; dx <= size; dx++) {
                for (let dz = -size; dz <= size; dz++) {
                    const px = roundedPos.x + dx;
                    const py = roundedPos.y;
                    const pz = roundedPos.z + dz;

                    let blockType;
                    if (i === 0) {
                        blockType = Blocks.PARKOUR_BLOCK; // Starting block is special
                    } else if (i === platformCount - 1) {
                        blockType = Blocks.GOLD_BLOCK; // Finish
                    } else {
                        blockType = Blocks.PARKOUR_PLATFORM; // Challenge blocks are grey
                    }

                    this.game.setBlock(px, py, pz, blockType, true);
                    this.generatedBlocks.push(new THREE.Vector3(px, py, pz));
                }
            }

            this.platforms.push(roundedPos.clone());

            if (i === platformCount - 1) {
                this.finishPos = roundedPos.clone();
            }
        }

        this.startPos = this.platforms[0].clone();
    }

    /**
     * Update loop called every frame
     */
    update(dt) {
        if (!this.isActive) return;

        const playerPos = this.game.player.position;

        // Fall detection: If player is way below the lowest platform
        let lowestY = this.platforms.reduce((min, p) => Math.min(min, p.y), Infinity);

        if (playerPos.y < lowestY - 5) {
            this.fail();
        }

        // Win detection: If player is standing on the finish platform
        if (this.finishPos && playerPos.distanceTo(this.finishPos) < 2.0) {
            this.win();
        }
    }

    win() {
        if (this.game.uiManager) {
            this.game.uiManager.addChatMessage('system', `Level ${this.currentLevel} Complete!`);
            if (this.game.soundManager) {
                this.game.soundManager.playSound('levelup');
            }
        }

        // Cleanup current level
        this.cleanup();

        // Progress to next level
        this.currentLevel++;

        if (this.currentLevel > 5) {
            this.game.uiManager.addChatMessage('system', 'PARKOUR MASTER! You completed all levels!');
            this.end();
        } else {
            this.game.uiManager.addChatMessage('system', `Starting Level ${this.currentLevel}...`);
            // Generate next level starting from roughly where we are but same altitude logic
            const nextStart = new THREE.Vector3(
                Math.round(this.game.player.position.x),
                Math.round(this.game.player.position.y) + 5,
                Math.round(this.game.player.position.z)
            );
            this.platforms = [];
            this.generatedBlocks = [];
            this.generateCourse(nextStart);
            this.teleportToStart();
            this.game.updateChunks();
        }
    }

    fail() {
        if (this.game.uiManager) {
            this.game.uiManager.addChatMessage('system', `FELL ON LEVEL ${this.currentLevel}! Parkour reset.`);
            if (this.game.soundManager) {
                this.game.soundManager.playSound('damage');
            }
        }
        this.end();
    }

    end() {
        this.isActive = false;

        // Teleport back
        this.game.player.position.copy(this.returnPos);
        this.game.player.velocity.set(0, 0, 0);

        // Cleanup remaining blocks
        setTimeout(() => {
            this.cleanup();
            this.game.updateChunks();
        }, 1500);
    }

    cleanup() {
        this.generatedBlocks.forEach(pos => {
            this.game.setBlock(pos.x, pos.y, pos.z, null, true);
        });
        this.generatedBlocks = [];
    }
}
