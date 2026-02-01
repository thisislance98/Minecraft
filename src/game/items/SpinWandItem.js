
import { Item } from './Item.js';
import * as THREE from 'three';

export class SpinWandItem extends Item {
    constructor() {
        super('spin_wand', 'Spin Wand');
        this.maxStack = 1;
        this.isTool = true;
        this.lastFireTime = 0;
        this.fireCooldown = 500; // 0.5 second cooldown
    }

    onUseDown(game, player) {
        const now = performance.now();
        if (now - this.lastFireTime < this.fireCooldown) {
            return false;
        }
        this.lastFireTime = now;

        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);

        const spawnPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(1.0));
        
        if (game.spawnSpinProjectile) {
            game.spawnSpinProjectile(spawnPos, camDir);
        } else {
            console.error("game.spawnSpinProjectile not implemented");
        }

        if (player.swingArm) {
            player.swingArm();
        }
        return true;
    }

    onPrimaryDown(game, player) {
        return this.onUseDown(game, player);
    }
}
