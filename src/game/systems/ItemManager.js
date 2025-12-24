
import { WandItem } from '../items/WandItem.js';
import { ShrinkWandItem } from '../items/ShrinkWandItem.js';
import { GrowthWandItem } from '../items/GrowthWandItem.js';
import { BowItem } from '../items/BowItem.js';
import { FlyingBroomItem } from '../items/FlyingBroomItem.js';
import { LevitationWandItem } from '../items/LevitationWandItem.js';
import { GiantWandItem } from '../items/GiantWandItem.js';

import { OmniWandItem } from '../items/OmniWandItem.js';
import { RideWandItem } from '../items/RideWandItem.js';
import { CaptureWandItem } from '../items/CaptureWandItem.js';
import { SpawnEggItem } from '../items/SpawnEggItem.js';
import { WaterBucketItem } from '../items/WaterBucketItem.js';
import { AnimalClasses } from '../AnimalRegistry.js';

export class ItemManager {
    constructor(game) {
        this.game = game;
        this.items = new Map();

        this.registerItems();
    }

    registerItems() {
        this.register(new WandItem());
        this.register(new ShrinkWandItem());
        this.register(new GrowthWandItem());
        this.register(new BowItem());
        this.register(new FlyingBroomItem());
        this.register(new LevitationWandItem());
        this.register(new GiantWandItem());

        this.register(new OmniWandItem());
        this.register(new RideWandItem());
        this.register(new CaptureWandItem());
        this.register(new WaterBucketItem());

        // Register Spawn Eggs
        Object.values(AnimalClasses).forEach(AnimalClass => {
            this.register(new SpawnEggItem(AnimalClass));
        });
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
