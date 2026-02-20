/**
 * EntityManager handles all dynamic ambient entities.
 * It centralizes update loops and culling for performance.
 *
 * NOTE: All ambient creature managers (Birds, Bats, Mosquitoes, Butterflies, Pixies)
 * have been archived. This is now a stub that will be repopulated as creatures are recreated.
 */
export class EntityManager {
    constructor(game) {
        this.game = game;

        // All ambient managers archived — initialize as null
        this.birdManager = null;
        this.batManager = null;
        this.mosquitoManager = null;
        this.butterflyManager = null;
        this.pixieManager = null;
    }

    update(deltaTime, player) {
        // Update any active managers
        if (this.birdManager) this.birdManager.update(deltaTime, player);
        if (this.mosquitoManager) this.mosquitoManager.update(deltaTime, player);
        if (this.butterflyManager) this.butterflyManager.update(deltaTime, player);

        const animals = this.game.animals || [];
        if (this.pixieManager) this.pixieManager.update(deltaTime, player, animals);
        if (this.batManager) this.batManager.update(deltaTime, player, animals);
    }

    clearAll() {
        if (this.birdManager && this.birdManager.clear) this.birdManager.clear();
        if (this.batManager && this.batManager.clear) this.batManager.clear();
        if (this.mosquitoManager && this.mosquitoManager.clear) this.mosquitoManager.clear();
        if (this.butterflyManager && this.butterflyManager.clear) this.butterflyManager.clear();
        if (this.pixieManager && this.pixieManager.clear) this.pixieManager.clear();
    }
}
