import { Item } from './Item.js';

export class RideWandItem extends Item {
    constructor() {
        super('ride_wand', 'Ride Wand');
        this.maxStack = 1;
        this.isTool = true;
    }

    onUseDown(game, player) {
        const hitAnimal = game.physicsManager.getHitAnimal();
        if (hitAnimal) {
            player.mountEntity(hitAnimal);

            // Trigger arm swing animation
            if (player.swingArm) {
                player.swingArm();
            }
            return true;
        }
        return false;
    }

    onPrimaryDown(game, player) {
        return this.onUseDown(game, player);
    }
}
