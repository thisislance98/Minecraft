
import { Item } from './Item.js';
import * as THREE from 'three';

export class GiantTreeWandItem extends Item {
    constructor() {
        super('giant_tree_wand', 'Giant Tree Wand');
        this.maxStack = 1;
        this.isTool = true;
    }

    onUseDown(game, player) {
        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);

        const spawnPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(1.0));
        const velocity = camDir.clone().multiplyScalar(20.0);

        if (game.spawnGiantTreeProjectile) {
            game.spawnGiantTreeProjectile(spawnPos, velocity);
            return true;
        } else {
            console.error("spawnGiantTreeProjectile not defined in game");
            return false;
        }
    }

    onPrimaryDown(game, player) {
        return this.onUseDown(game, player);
    }
}
