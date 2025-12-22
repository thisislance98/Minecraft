
import { Item } from './Item.js';
import * as THREE from 'three';

export class BowItem extends Item {
    constructor() {
        super('bow', 'Bow');
        this.maxStack = 1;
    }

    onUseDown(game, player) {
        console.log('Drawing bow...');
        // Future: Start draw animation
        return true;
    }

    onUseUp(game, player) {
        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);

        // Spawn slightly in front of head
        const spawnPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(0.5));
        const velocity = camDir.clone().multiplyScalar(2.0);
        velocity.y += 0.1; // Slight arc up

        game.spawnArrow(spawnPos, velocity);
        return true;
    }
}
