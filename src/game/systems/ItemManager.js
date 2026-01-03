import { ItemClasses } from '../ItemRegistry.js';
import { AnimalClasses } from '../AnimalRegistry.js';

export class ItemManager {
    constructor(game) {
        this.game = game;
        this.items = new Map();

        // Wait for modules to load if needed, but ItemRegistry is eager loaded
        this.registerItems();
    }

    registerItems() {
        // Auto-register all items from the registry
        for (const [className, ItemClass] of Object.entries(ItemClasses)) {
            // Skip base class
            if (className === 'Item') continue;

            // Skip SpawnEggItem as it needs special handling with arguments
            if (className === 'SpawnEggItem') continue;

            try {
                // Instantiate and register
                this.register(new ItemClass());
            } catch (error) {
                console.warn(`Failed to register item ${className}:`, error);
            }
        }

        // Register Spawn Eggs
        if (ItemClasses.SpawnEggItem) {
            Object.values(AnimalClasses).forEach(AnimalClass => {
                this.register(new ItemClasses.SpawnEggItem(AnimalClass));
            });
        }
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


    handleItemPrimary(itemId) {
        console.log(`[ItemManager] handleItemPrimary called for ${itemId}`);
        const item = this.getItem(itemId);
        if (item) {
            return item.onPrimaryDown(this.game, this.game.player);
        }
        return false;
    }
}
