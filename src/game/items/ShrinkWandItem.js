
import { Item } from './Item.js';
import * as THREE from 'three';

export class ShrinkWandItem extends Item {
    constructor() {
        super('shrink_wand', 'Shrink Wand');
        this.maxStack = 1;
        this.isTool = true;
    }

    onUseDown(game, player) {
        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);

        const spawnPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(1.0));
        const velocity = camDir.clone().multiplyScalar(1.0);

        game.spawnShrinkProjectile(spawnPos, velocity);

        // Trigger arm swing animation
        if (player.swingArm) {
            player.swingArm();
        }
        return true;
    }

    onPrimaryDown(game, player) {
        return this.onUseDown(game, player);
    }
}
