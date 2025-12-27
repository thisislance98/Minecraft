
import { Item } from './Item.js';
import { Blocks } from '../core/Blocks.js';

export class SignItem extends Item {
    constructor() {
        super('sign', 'Sign');
    }

    onUseDown(game, player) {
        // Find targeted block
        const target = game.physicsManager.getTargetBlock();
        if (!target) return false;

        // Calculate placement position (adjacent to clicked face)
        // target is {x, y, z, normal} where normal is the block face direction
        const placeX = target.x + target.normal.x;
        const placeY = target.y + target.normal.y;
        const placeZ = target.z + target.normal.z;

        // Ensure space is empty (or water/air)
        const currentBlock = game.getBlock(placeX, placeY, placeZ);
        if (currentBlock && currentBlock.type && currentBlock.type !== Blocks.AIR && currentBlock.type !== Blocks.WATER) {
            return false;
        }

        // Place the sign block
        game.setBlock(placeX, placeY, placeZ, Blocks.SIGN);

        // Trigger UI to report text for this new sign
        if (game.uiManager) {
            game.uiManager.showSignInput((text) => {
                if (text) {
                    // Send text update
                    if (game.setSignText) {
                        game.setSignText(placeX, placeY, placeZ, text);
                    }
                }
            });
        }

        return true;
    }
}
