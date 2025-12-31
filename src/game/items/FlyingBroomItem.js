
import { Item } from './Item.js';

export class FlyingBroomItem extends Item {
    constructor() {
        super('flying_broom', 'Flying Broom');
        this.maxStack = 1;
        this.isTool = true;
    }

    onUseDown(game, player) {
        player.toggleFlying();
        return true;
    }
}
