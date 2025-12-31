
import { Item } from './Item.js';
import * as THREE from 'three';

export class WandItem extends Item {
    constructor() {
        super('wand', 'Magic Wand');
        this.maxStack = 1;
        this.isTool = true;
    }

    onUseDown(game, player) {
        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);

        // Spawn slightly in front of head
        const spawnPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(1.0));
        const velocity = camDir.clone().multiplyScalar(1.0); // Direction for projectile

        game.spawnMagicProjectile(spawnPos, velocity);
        return true;
    }

    onPrimaryDown(game, player) {
        return this.onUseDown(game, player);
    }
}
