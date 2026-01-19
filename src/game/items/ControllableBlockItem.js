
import { Item } from './Item.js';
import * as THREE from 'three';

/**
 * ControllableBlockItem - Spawns a controllable block that can be moved with WASD + Space/Shift
 *
 * Controls (after spawning and taking control):
 * - E/Right-click to take/release control
 * - WASD to move horizontally
 * - Space to go up
 * - Shift to go down
 */
export class ControllableBlockItem extends Item {
    constructor() {
        super('control_block', 'Control Block');
        this.maxStack = 64;
        this.isTool = true;
    }

    onUseDown(game, player) {
        // Get target position (where player is looking)
        const target = game.physicsManager.getTargetBlock();

        let spawnX, spawnY, spawnZ;

        if (target) {
            // Spawn on top of the targeted block
            spawnX = target.x + target.normal.x;
            spawnY = target.y + target.normal.y;
            spawnZ = target.z + target.normal.z;
        } else {
            // No target - spawn in front of player
            const forward = new THREE.Vector3(0, 0, -1);
            forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.y);
            forward.y = 0;
            forward.normalize();

            const distance = 5;
            spawnX = Math.floor(player.position.x + forward.x * distance);
            spawnY = Math.floor(player.position.y);
            spawnZ = Math.floor(player.position.z + forward.z * distance);
        }

        // Spawn the controllable block
        const cb = game.spawnControllableBlock(spawnX, spawnY, spawnZ, 'control_block');

        if (cb) {
            if (game.uiManager) {
                game.uiManager.addChatMessage('system', 'Control Block spawned! Press E to take control.');
            }
            return true;
        }

        return false;
    }

    onPrimaryDown(game, player) {
        return this.onUseDown(game, player);
    }
}
