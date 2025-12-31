
import { Item } from './Item.js';
import * as THREE from 'three';

export class GiantWandItem extends Item {
    constructor() {
        super('giant_wand', 'Giant Wand');
        this.maxStack = 1;
        this.isTool = true;
    }

    onUseDown(game, player) {
        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);

        const spawnPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(1.0));

        // Pass direction/velocity
        const velocity = camDir.clone().multiplyScalar(1.0); // Projectile logic handles speed

        game.spawnGiantProjectile(spawnPos, velocity);
        return true;
    }

    onPrimaryDown(game, player) {
        return this.onUseDown(game, player);
    }
}
