import { WandItem } from './WandItem.js';
import * as THREE from 'three';

/**
 * FireworkWandItem - A wand that shoots colorful fireworks
 */
export class FireworkWandItem extends WandItem {
    constructor() {
        super();
        this.id = 'firework_wand';
        this.name = 'Firework Wand';
        this.maxStack = 1;
        this.isTool = true;
        this.lastFireTime = 0;
        this.fireCooldown = 500; // 0.5 second cooldown between shots
    }

    onUseDown(game, player) {
        console.log('[FireworkWandItem] onUseDown called');
        
        // Cooldown check to prevent spamming
        const now = performance.now();
        if (now - this.lastFireTime < this.fireCooldown) {
            console.log('[FireworkWandItem] Cooldown active, skipping');
            return false;
        }
        this.lastFireTime = now;

        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);
        console.log('[FireworkWandItem] Camera direction:', camDir);

        // Spawn slightly in front of head
        const spawnPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(1.0));
        const velocity = camDir.clone().multiplyScalar(1.0);
        console.log('[FireworkWandItem] Spawning at:', spawnPos, 'velocity:', velocity);

        try {
            const projectile = game.spawnFireworkProjectile(spawnPos, velocity);
            console.log('[FireworkWandItem] Projectile spawned:', projectile);
        } catch (error) {
            console.error('[FireworkWandItem] Error spawning projectile:', error);
        }

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
