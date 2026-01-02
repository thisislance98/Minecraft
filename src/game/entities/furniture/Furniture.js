import * as THREE from 'three';
import { Animal } from '../Animal.js';

/**
 * Base class for all furniture entities.
 * Extends Animal for persistence and basic entity management,
 * but disables AI and movement.
 */
export class Furniture extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        // Disable AI features
        this.speed = 0;
        this.turnSpeed = 0;
        this.fleeOnProximity = false;
        this.isHostile = false;

        // Static object properties
        this.canHop = false;
        this.gravity = 30.0; // Keep gravity so it falls if block below is removed
        this.mass = 1.0;

        // Interaction
        this.health = 1; // Breaks easily
        this.maxHealth = 1;

        // Item to drop when broken (override in subclass)
        this.dropItem = null;

        // Initialize mesh
        this.createBody();
        console.log(`[Furniture] Created body for ${this.constructor.name}`);
    }

    // Override AI to do nothing
    updateAI(dt) {
        // Furniture does not think.
        this.state = 'idle';
        this.isMoving = false;
    }

    // Override movement physics to be mostly static
    // We still want gravity (updatePhysics call in Animal.js handles that via updateWalkerPhysics)
    // But we should ensure we don't accidentally walk.
    updatePhysics(dt) {
        // Apply simple gravity if not on ground
        if (!this.onGround) {
            this.velocity.y -= this.gravity * dt;
            this.position.y += this.velocity.y * dt;

            // Simple ground check
            const groundY = this.game.spawnManager.findGroundLevel(this.position.x, this.position.y, this.position.z);
            if (groundY !== null && this.position.y <= groundY) {
                this.position.y = groundY;
                this.velocity.y = 0;
                this.onGround = true;
            }
        } else {
            this.velocity.y = 0;
        }

        // No horizontal movement
        this.velocity.x = 0;
        this.velocity.z = 0;

        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;
    }

    // Override interaction
    interact(player) {
        if (this.game.uiManager) {
            this.game.uiManager.showXboxUI();
        }
    }

    takeDamage(amount, attacker) {
        // Break instantly
        this.startDeath();

        // Drop item?
        if (this.dropItem && this.game.spawnManager) {
            // Logic to spawn item drop would go here
            // For now, let's just break.
        }

        // Optional: Particles
    }
}
