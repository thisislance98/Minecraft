
import { Item } from './Item.js';
import * as THREE from 'three';

export class GiantWandItem extends Item {
    constructor() {
        super('giant_wand', 'Giant Wand');
        this.maxStack = 1;
        this.isTool = true;
        this.lastFireTime = 0;
        this.fireCooldown = 1000; // 1 second cooldown between shots to prevent spam
    }

    onUseDown(game, player) {
        // Cooldown check to prevent spamming
        const now = performance.now();
        if (now - this.lastFireTime < this.fireCooldown) {
            return false;
        }
        this.lastFireTime = now;
        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);

        const spawnPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(1.0));

        // Pass direction/velocity
        const velocity = camDir.clone().multiplyScalar(1.0); // Projectile logic handles speed

        game.spawnGiantProjectile(spawnPos, velocity);

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
