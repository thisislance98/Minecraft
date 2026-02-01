
import { Item } from './Item.js';
import * as THREE from 'three';

export class TreeWandItem extends Item {
    constructor() {
        super('tree_wand', 'Tree Wand');
        this.maxStack = 1;
        this.isTool = true;
        this.lastFireTime = 0;
        this.fireCooldown = 1500; // 1.5 second cooldown - trees are expensive to generate
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

        // Spawn projectile in front of player and shoot it fast/far
        const spawnPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(2.0));
        const velocity = camDir.clone().multiplyScalar(40.0); // Much faster so it lands far away

        game.spawnGiantTreeProjectile(spawnPos, velocity);

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
