
import { Item } from './Item.js';
import * as THREE from 'three';

export class WandItem extends Item {
    constructor(id = 'wand', name = 'Magic Wand') {
        super(id, name);
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

        // Spawn slightly in front of head
        const spawnPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(1.0));
        const velocity = camDir.clone().multiplyScalar(1.0); // Direction for projectile

        game.spawnMagicProjectile(spawnPos, velocity);

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
