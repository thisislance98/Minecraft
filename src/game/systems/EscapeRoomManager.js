
import { Blocks } from '../core/Blocks.js';
import { TargetedFloatingBlock } from '../entities/TargetedFloatingBlock.js';
import * as THREE from 'three';

export class EscapeRoomManager {
    constructor(game) {
        this.game = game;
        this.isActive = false;
        this.timer = 0;
        this.timeLimit = 75; // Increased time limit for 3 items
        this.roomCenter = null;
        this.roomRadius = 3;
        this.roomHeight = 4;
        this.generatedBlocks = []; // Track blocks we placed so we can remove them later
        this.targetBlocks = []; // Array of {pos, type, found} for the items
    }

    start(centerPos) {
        if (this.isActive) return;

        this.isActive = true;
        this.timer = this.timeLimit;
        this.roomCenter = centerPos.clone();
        this.generatedBlocks = [];
        this.targetBlocks = [];

        console.log('[EscapeRoom] Started! Escape the room!');

        if (this.game.uiManager) {
            this.game.uiManager.showEscapeRoomUI(true);
            this.game.uiManager.updateEscapeRoomUI(this.timer);
            this.game.uiManager.addChatMessage('system', 'Escape Room Activated! Find the 3 Gem Keys (Gold, Diamond, Emerald)!');
        }

        this.spawnRoom();
    }

    spawnRoom() {
        // Create a hollow box around the center
        const startX = Math.floor(this.roomCenter.x);
        const startY = Math.floor(this.roomCenter.y);
        const startZ = Math.floor(this.roomCenter.z);

        const r = this.roomRadius;
        const h = this.roomHeight;

        let possibleKeySpots = [];

        for (let x = -r; x <= r; x++) {
            for (let y = 0; y <= h; y++) {
                for (let z = -r; z <= r; z++) {
                    // Check if edge (wall/floor/ceiling)
                    const isWall = (Math.abs(x) === r || Math.abs(z) === r);
                    const isFloor = (y === 0);
                    const isCeiling = (y === h);

                    // Don't modify the center block itself (where the trigger likely is)
                    if (x === 0 && y === 0 && z === 0) continue;

                    if (isWall || isFloor || isCeiling) {
                        const targetPos = new THREE.Vector3(startX + x, startY + y, startZ + z);
                        possibleKeySpots.push(targetPos.clone());
                    }
                }
            }
        }

        // Pick three spots for the Gem Keys
        const gemTypes = [Blocks.GOLD_BLOCK, Blocks.DIAMOND_BLOCK, Blocks.EMERALD_BLOCK];
        for (let i = 0; i < 3; i++) {
            const keyIndex = Math.floor(Math.random() * possibleKeySpots.length);
            const pos = possibleKeySpots.splice(keyIndex, 1)[0];
            this.targetBlocks.push({ pos, type: gemTypes[i], found: false });
        }

        // Add a torch at the ceiling center for light
        const ceilingCenter = new THREE.Vector3(startX, startY + h - 1, startZ);
        this.game.setBlock(ceilingCenter.x, ceilingCenter.y, ceilingCenter.z, Blocks.TORCH);
        // Track torch for cleanup
        this.generatedBlocks.push(ceilingCenter);

        // Spawn blocks
        possibleKeySpots.forEach((pos) => {
            let type = Blocks.OBSIDIAN; // Default wall

            // Start from random sky location
            const spawnPos = pos.clone().add(new THREE.Vector3(
                (Math.random() - 0.5) * 20,
                20 + Math.random() * 10,
                (Math.random() - 0.5) * 20
            ));

            const floatingBlock = new TargetedFloatingBlock(this.game, spawnPos, pos, type);
            this.game.targetedFloatingBlocks.push(floatingBlock);
            this.game.scene.add(floatingBlock.mesh);
            this.generatedBlocks.push(pos);
        });

        // Spawn target blocks separately
        this.targetBlocks.forEach(target => {
            const spawnPos = target.pos.clone().add(new THREE.Vector3(0, 20, 0));
            const floatingBlock = new TargetedFloatingBlock(this.game, spawnPos, target.pos, target.type);
            this.game.targetedFloatingBlocks.push(floatingBlock);
            this.game.scene.add(floatingBlock.mesh);
            this.generatedBlocks.push(target.pos);
        });
    }

    update(dt) {
        if (!this.isActive) return;

        this.timer -= dt;

        if (this.game.uiManager) {
            this.game.uiManager.updateEscapeRoomUI(Math.ceil(this.timer));
        }

        if (this.timer <= 0) {
            this.fail();
        }
    }

    handleBlockInteraction(x, y, z) {
        if (!this.isActive) return false;

        // Check if this is one of our target blocks
        const targetIndex = this.targetBlocks.findIndex(t =>
            !t.found &&
            Math.round(x) === Math.round(t.pos.x) &&
            Math.round(y) === Math.round(t.pos.y) &&
            Math.round(z) === Math.round(t.pos.z)
        );

        if (targetIndex !== -1) {
            this.targetBlocks[targetIndex].found = true;
            const foundCount = this.targetBlocks.filter(t => t.found).length;

            if (this.game.uiManager) {
                this.game.uiManager.addChatMessage('system', `Found Key ${foundCount}/3!`);
                this.game.soundManager.playSound('click');
            }

            if (foundCount === 3) {
                this.win();
            }
            return true;
        }

        // Consume interaction for other room blocks
        const isRoomBlock = this.generatedBlocks.some(p =>
            Math.round(p.x) === Math.round(x) &&
            Math.round(p.y) === Math.round(y) &&
            Math.round(p.z) === Math.round(z)
        );

        if (isRoomBlock) {
            return true;
        }

        return false;
    }

    win() {
        console.log('[EscapeRoom] You Won!');
        if (this.game.uiManager) {
            this.game.uiManager.addChatMessage('system', 'CONGRATULATIONS! You found all 3 keys and escaped!');
            this.game.soundManager.playSound('levelup');
        }
        this.end();
    }

    fail() {
        console.log('[EscapeRoom] Time Up!');
        if (this.game.uiManager) {
            this.game.uiManager.addChatMessage('system', 'TIME UP! You failed to collect all keys!');
            this.game.soundManager.playSound('damage');
        }
        this.end();
    }

    end() {
        this.isActive = false;
        if (this.game.uiManager) {
            this.game.uiManager.showEscapeRoomUI(false);
        }

        // Cleanup blocks
        this.cleanupRoom();
    }

    cleanupRoom() {
        // Remove all generated blocks
        this.generatedBlocks.forEach(pos => {
            this.game.setBlock(Math.round(pos.x), Math.round(pos.y), Math.round(pos.z), Blocks.AIR);
        });

        // Also remove the trigger block itself
        if (this.roomCenter) {
            this.game.setBlock(Math.round(this.roomCenter.x), Math.round(this.roomCenter.y), Math.round(this.roomCenter.z), Blocks.AIR);
        }

        this.generatedBlocks = [];
        this.targetBlocks = [];
    }
}
