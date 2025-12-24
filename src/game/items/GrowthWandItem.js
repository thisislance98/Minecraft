import { Item } from './Item.js';
import * as THREE from 'three';

export class GrowthWandItem extends Item {
    constructor() {
        super('growth_wand', 'Growth Wand');
        this.maxStack = 1;
    }

    onUseDown(game, player) {
        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);

        const spawnPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(1.0));
        const velocity = camDir.clone().multiplyScalar(1.0);

        game.spawnGrowthProjectile(spawnPos, velocity);
        return true;
    }
}
