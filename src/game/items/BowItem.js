
import { Item } from './Item.js';
import * as THREE from 'three';

/**
 * BowItem - A ranged weapon that shoots arrows.
 * Similar to wands, fires on right-click (onUseDown).
 */
export class BowItem extends Item {
    constructor() {
        super('bow', 'Bow');
        this.maxStack = 1;
        this.isTool = true;
        this.lastFireTime = 0;
        this.fireCooldown = 300; // ms between shots
    }

    /**
     * Called when the player presses the primary button (left-click).
     * Fires an arrow in the direction the player is looking.
     */
    onPrimaryDown(game, player) {
        // Cooldown check to prevent spamming
        const now = performance.now();
        if (now - this.lastFireTime < this.fireCooldown) {
            return false;
        }
        this.lastFireTime = now;

        // Get the direction the camera is facing
        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);

        // Spawn position: slightly in front of the player's head/camera
        const spawnPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(0.5));

        // Arrow velocity: direction * speed - shoots straight
        const arrowSpeed = 0.6; // Slower for realistic projectile physics
        const velocity = camDir.clone().multiplyScalar(arrowSpeed);

        // Spawn the arrow
        game.spawnArrow(spawnPos, velocity);

        // Trigger arm swing animation if available
        if (player.swingArm) {
            player.swingArm();
        }

        return true;
    }
}
