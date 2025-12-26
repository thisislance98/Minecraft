import {
    WandItem,
    ShrinkWandItem,
    GrowthWandItem,
    BowItem,
    FlyingBroomItem,
    LevitationWandItem,
    GiantWandItem,
    WizardTowerWandItem,
    OmniWandItem,
    RideWandItem,
    CaptureWandItem,
    SpawnEggItem,
    WaterBucketItem
} from '../ItemRegistry.js';
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
        this.register(new WizardTowerWandItem());

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
