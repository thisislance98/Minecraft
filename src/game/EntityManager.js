import { BirdManager } from './Birds.js';
import { BatManager } from './Bats.js';
import { MosquitoManager } from './Mosquitoes.js';
import { ButterflyManager } from './Butterflies.js';
import { PixieManager } from './Pixies.js';

/**
 * EntityManager handles all dynamic ambient entities.
 * It centralizes update loops and culling for performance.
 */
export class EntityManager {
    constructor(game) {
        this.game = game;

        // Initialize sub-managers
        // Counts could be moved to config later
        this.birdManager = new BirdManager(game, 5);
        this.batManager = new BatManager(game, 8);
        this.mosquitoManager = new MosquitoManager(game, 5);
        this.butterflyManager = new ButterflyManager(game, 10);
        this.pixieManager = new PixieManager(game, 5);

        // Future: Move this.game.animals handling here?
        // For now, keep critical game-play animals in VoxelGame or SpawManager, 
        // focus on ambient effects here.
    }


    update(deltaTime, player) {
        // Update all managers
        this.birdManager.update(deltaTime, player);
        this.mosquitoManager.update(deltaTime, player);
        this.butterflyManager.update(deltaTime, player);

        // Pixies need access to animals for hunting
        if (this.game.animals) {
            this.pixieManager.update(deltaTime, player, this.game.animals);
        } else {
            this.pixieManager.update(deltaTime, player, []);
        }

        // Bat manager needs access to animals list for interaction? (Checking legacy code)
        // VoxelGame.jsx: this.batManager.update(deltaTime, this.player, this.animals);
        if (this.game.animals) {
            this.batManager.update(deltaTime, player, this.game.animals);
        } else {
            this.batManager.update(deltaTime, player, []);
        }
    }
}

