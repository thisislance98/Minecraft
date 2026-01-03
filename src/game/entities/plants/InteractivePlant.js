import * as THREE from 'three';
import { Animal } from '../Animal.js';

/**
 * InteractivePlant - Base class for reactive flora.
 * Extends Animal for entity management but disables movement/AI by default.
 */
export class InteractivePlant extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        this.speed = 0;
        this.gravity = 0; // Plants don't usually fall, but subclasses can override
        this.isHostile = false;
        this.fleeOnProximity = false;
        this.canHop = false;

        // Interaction Settings
        this.detectionRange = 4.0; // Distance to trigger 'active' state
        this.cooldownTime = 2.0;   // Reset time after activation

        this.isActive = false;
        this.activationTimer = 0;
    }

    // Override Update to disable standard AI
    updateAI(dt) {
        const player = this.game.player;
        if (!player) return;

        const dist = this.position.distanceTo(player.position);

        if (this.isActive) {
            this.updateActive(dt, dist);
        } else {
            if (dist < this.detectionRange) {
                this.activate(player);
            }
        }

        this.updateCooldown(dt);
    }

    updatePhysics(dt) {
        // Default: Do nothing (static). 
        // Subclasses like HelicopterPlant will override this.
        this.mesh.position.copy(this.position);
    }

    activate(player) {
        if (this.isActive) return;
        this.isActive = true;
        this.onActivate(player);
    }

    deactivate() {
        if (!this.isActive) return;
        this.isActive = false;
        this.onDeactivate();
    }

    updateActive(dt, dist) {
        // If player moves far away, maybe reset?
        // Or delegated to subclassLogic
        if (dist > this.detectionRange * 1.5) {
            this.deactivate();
        }

        this.onUpdateActive(dt);
    }

    updateCooldown(dt) {
        if (this.activationTimer > 0) this.activationTimer -= dt;
    }

    // Abstract methods for subclasses
    onActivate(player) { }
    onDeactivate() { }
    onUpdateActive(dt) { }
}
