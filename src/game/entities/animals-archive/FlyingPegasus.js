import * as THREE from 'three';
import { Pegasus } from './Pegasus.js';

export class FlyingPegasus extends Pegasus {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.gravity = 0;
        this.flying = true;
        this.targetAltitude = y + 10;
        this.flySpeed = 5;
        this.roamRadius = 30;
        
        // Target coordinates for flight
        this.targetX = x;
        this.targetZ = z;
        this.targetAltitude = y + 10;
    }

    updateAI(dt) {
        // Flying AI
        if (this.stateTimer <= 0) {
            this.stateTimer = this.rng.next() * 5 + 5;
            
            // Random target within roam radius
            const angle = this.rng.next() * Math.PI * 2;
            const dist = this.rng.next() * this.roamRadius;
            this.targetX = this.position.x + Math.cos(angle) * dist;
            this.targetZ = this.position.z + Math.sin(angle) * dist;
            
            // Random altitude between 10 and 25
            this.targetAltitude = 15 + (this.rng.next() * 15);
        }

        // Move towards target in 3D
        const target = new THREE.Vector3(this.targetX, this.targetAltitude, this.targetZ);
        const dir = target.clone().sub(this.position);
        const distToTarget = dir.length();

        if (distToTarget > 0.5) {
            dir.normalize();
            
            // Interpolate velocity for smoother movement
            const lerpFactor = 0.05;
            this.velocity.x += (dir.x * this.flySpeed - this.velocity.x) * lerpFactor;
            this.velocity.y += (dir.y * this.flySpeed - this.velocity.y) * lerpFactor;
            this.velocity.z += (dir.z * this.flySpeed - this.velocity.z) * lerpFactor;
            
            this.isMoving = true;
            
            // Look in movement direction
            const targetRotation = Math.atan2(this.velocity.x, this.velocity.z);
            let diff = targetRotation - this.rotation;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.rotation += diff * 0.1;
        } else {
            this.isMoving = false;
            this.velocity.multiplyScalar(0.95);
        }

        this.stateTimer -= dt;
    }

    updatePhysics(dt) {
        // Override physics to use 3D velocity and no gravity
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.position.z += this.velocity.z * dt;

        // Don't fall through the floor
        const floorY = this.game.getWorldHeight ? this.game.getWorldHeight(this.position.x, this.position.z) : 0;
        if (this.position.y < floorY + 1) {
            this.position.y = floorY + 1;
            this.velocity.y = Math.max(0, this.velocity.y);
        }
    }

    updateAnimation(dt) {
        // Ensure wings flap fast while flying
        const originalIsMoving = this.isMoving;
        this.isMoving = true; // Always flapping while in the air
        super.updateAnimation(dt);
        this.isMoving = originalIsMoving;

        // Tilt body based on pitch
        if (this.bodyGroup) {
            const horizontalVel = new THREE.Vector2(this.velocity.x, this.velocity.z).length();
            const pitch = -Math.atan2(this.velocity.y, horizontalVel + 0.1);
            this.bodyGroup.rotation.x = pitch * 0.5;
        }
    }
}
