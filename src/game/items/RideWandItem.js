import { Item } from './Item.js';

export class RideWandItem extends Item {
    constructor() {
        super('ride_wand', 'Ride Wand');
        this.maxStack = 1;
    }

    onUseDown(game, player) {
        const hitAnimal = game.physicsManager.getHitAnimal();
        if (hitAnimal) {
            player.mountEntity(hitAnimal);
            return true;
        }
        return false;
    }
}
