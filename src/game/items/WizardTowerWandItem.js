
import { Item } from './Item.js';
import * as THREE from 'three';

export class WizardTowerWandItem extends Item {
    constructor() {
        super('wizard_tower_wand', 'Wizard Tower Wand');
        this.maxStack = 1;
        this.isTool = true;
    }

    onUseDown(game, player) {
        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);

        const spawnPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(1.0));

        // Pass direction/velocity
        const velocity = camDir.clone().multiplyScalar(1.0); // Projectile logic handles speed

        if (game.spawnWizardTowerProjectile) {
            game.spawnWizardTowerProjectile(spawnPos, velocity);
            return true;
        } else {
            console.error("spawnWizardTowerProjectile not defined in game");
            return false;
        }
    }

    onPrimaryDown(game, player) {
        return this.onUseDown(game, player);
    }
}
