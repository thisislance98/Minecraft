
import { WandItem } from '../items/WandItem.js';
import { ShrinkWandItem } from '../items/ShrinkWandItem.js';
import { BowItem } from '../items/BowItem.js';
import { FlyingBroomItem } from '../items/FlyingBroomItem.js';
import { LevitationWandItem } from '../items/LevitationWandItem.js';
import { OmniWandItem } from '../items/OmniWandItem.js';

export class ItemManager {
    constructor(game) {
        this.game = game;
        this.items = new Map();

        this.registerItems();
    }

    registerItems() {
        this.register(new WandItem());
        this.register(new ShrinkWandItem());
        this.register(new BowItem());
        this.register(new FlyingBroomItem());
        this.register(new LevitationWandItem());
        this.register(new OmniWandItem());
    }

    register(item) {
        this.items.set(item.id, item);
    }

    getItem(id) {
        return this.items.get(id);
    }

    handleItemDown(itemId) {
        const item = this.items.get(itemId);
        if (item) {
            return item.onUseDown(this.game, this.game.player);
        }
        return false;
    }

    handleItemUp(itemId) {
        const item = this.items.get(itemId);
        if (item) {
            return item.onUseUp(this.game, this.game.player);
        }
        return false;
    }
}
