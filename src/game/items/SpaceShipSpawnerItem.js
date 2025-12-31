
import { Item } from './Item.js';
import * as THREE from 'three';

export class SpaceShipSpawnerItem extends Item {
    constructor() {
        super();
        this.id = 'spaceship_spawner';
        this.name = 'Spaceship Spawner';
        this.isTool = true;
    }

    onUseDown(game, player) {
        if (!game.spaceShipManager) {
            game.uiManager.addChatMessage('error', 'SpaceShipManager not found!');
            return false;
        }

        const target = game.physicsManager.getTargetBlock();
        if (target) {
            // Spawn ship centered at target
            console.log('[SpaceShipSpawner] Target found:', target);
            const pos = new THREE.Vector3(target.x, target.y + 1, target.z);
            game.spaceShipManager.spawnShip(pos);
            game.uiManager.addChatMessage('system', 'Spaceship spawned!');
            return true;
        } else {
            console.log('[SpaceShipSpawner] No target block found.');
            game.uiManager.addChatMessage('warning', 'You must target a block to spawn the ship.');
        }
        return false;
    }
}
