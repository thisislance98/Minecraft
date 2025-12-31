
import { Item } from './Item.js';
import * as THREE from 'three';

export class TimeStopWandItem extends Item {
    constructor() {
        super('time_stop_wand', 'Time Stop Wand');
        this.maxStack = 1;
        this.isTool = true;
        this.cooldown = 0;
        this.maxCooldown = 15.0; // 15 seconds cooldown
    }

    onUseDown(game, player) {
        if (this.cooldown > 0) return false;

        game.startTimeStop(10.0); // Stop time for 10 seconds
        this.cooldown = this.maxCooldown;

        // Visual/Audio feedback
        if (game.uiManager) {
            game.uiManager.addChatMessage("System", "ZA WARUDO! Time has stopped!", "#00ffff");
        }

        // Particle effect at player position
        if (game.worldParticleSystem) {
            // Spawn some "time" particles
            for (let i = 0; i < 50; i++) {
                const pos = player.position.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * 5,
                    (Math.random() - 0.5) * 5,
                    (Math.random() - 0.5) * 5
                ));
                game.worldParticleSystem.spawn({
                    position: pos,
                    velocity: new THREE.Vector3(0, 0.1, 0),
                    color: 0x00ffff,
                    life: 2.0,
                    size: 0.2
                });
            }
        }

        return true;
    }

    update(dt) {
        if (this.cooldown > 0) {
            this.cooldown -= dt;
        }
    }

    onPrimaryDown(game, player) {
        return this.onUseDown(game, player);
    }
}
