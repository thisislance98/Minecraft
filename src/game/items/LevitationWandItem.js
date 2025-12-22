
import { Item } from './Item.js';
import * as THREE from 'three';

export class LevitationWandItem extends Item {
    constructor() {
        super('levitation_wand', 'Levitation Wand');
        this.maxStack = 1;
    }

    onUseDown(game, player) {
        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);

        const spawnPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(1.0));
        const velocity = camDir.clone().multiplyScalar(20.0); // Pass direct velocity or normalized?
        // MagicProjectile takes vel and normalizes it.
        // Let's pass direction. 
        // Logic in WandItem: const velocity = camDir.clone().multiplyScalar(1.0);

        // Wait, WandItem multiplies by 1.0. MagicProjectile constructor normalizes and multiplies by speed.
        // So passing direction vector is fine.

        game.spawnLevitationProjectile(spawnPos, camDir);
        return true;
    }
}
