import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Plane extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 2.0;
        this.height = 1.0;
        this.depth = 3.0;
        this.speed = 30.0;
        this.gravity = 0;
        this.throttle = 0;
        this.createBody();
    }

    createBody() {
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0xDDDDDD });
        const wingMat = new THREE.MeshLambertMaterial({ color: 0xCCCCCC });
        const detailMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const cockpitMat = new THREE.MeshLambertMaterial({ color: 0x88CCFF, transparent: true, opacity: 0.6 });

        this.bodyGroup = new THREE.Group();
        this.mesh.add(this.bodyGroup);

        const fuselage = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 2.8), bodyMat);
        fuselage.position.set(0, 0.4, 0);
        this.bodyGroup.add(fuselage);

        const wings = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.1, 1.2), wingMat);
        wings.position.set(0, 0.4, 0.4);
        this.bodyGroup.add(wings);

        const hTail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.6), wingMat);
        hTail.position.set(0, 0.4, -1.1);
        this.bodyGroup.add(hTail);

        const vTail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 0.6), bodyMat);
        vTail.position.set(0, 0.8, -1.1);
        this.bodyGroup.add(vTail);

        const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.8), cockpitMat);
        cockpit.position.set(0, 0.8, 0.6);
        this.bodyGroup.add(cockpit);

        this.propGroup = new THREE.Group();
        this.propGroup.position.set(0, 0.4, 1.6);
        this.bodyGroup.add(this.propGroup);

        const blade = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.05), detailMat);
        this.propGroup.add(blade);
        const blade2 = blade.clone();
        blade2.rotation.z = Math.PI / 2;
        this.propGroup.add(blade2);
    }

    updateAI(dt) {
        // When not ridden, just apply simple gravity and friction
        this.velocity.x *= 0.95;
        this.velocity.z *= 0.95;

        // Propeller spin if moving (or just idle spin)
        if (this.propGroup) this.propGroup.rotation.z += dt * 2;

        // Gravity when not ridden
        if (!this.rider) {
            const groundY = this.game.getWorldHeight ? this.game.getWorldHeight(this.position.x, this.position.z) : 0;
            if (this.position.y > groundY + 0.5) {
                this.velocity.y -= 9.8 * dt;
            } else {
                this.velocity.y = 0;
                this.position.y = groundY + 0.5;
            }
        }
    }

    handleRiding(moveForward, moveRight, jump, rotationY, dt) {
        if (!this.rider) return;

        // Sync rotation with camera
        this.rotation = rotationY + Math.PI;

        const cameraPitch = this.game.camera.rotation.x;

        // Flight mechanics (Broom-like / Creative Fly)
        // 1. Directional movement based on look
        const speed = 20.0; // Max speed
        const accel = 40.0; // Acceleration

        // Calculate look vector
        const lookDir = new THREE.Vector3(0, 0, -1);
        lookDir.applyEuler(new THREE.Euler(cameraPitch, rotationY, 0, 'YXZ'));

        // Calculate right vector
        const rightDir = new THREE.Vector3(1, 0, 0);
        rightDir.applyEuler(new THREE.Euler(0, rotationY, 0, 'YXZ'));

        const targetVel = new THREE.Vector3(0, 0, 0);

        if (moveForward !== 0) {
            targetVel.addScaledVector(lookDir, moveForward * speed);
        }
        if (moveRight !== 0) {
            targetVel.addScaledVector(rightDir, moveRight * speed);
        }

        // Vertical control (Space/Shift compatible)
        // Note: 'jump' is Space. Crouch/Sprint usually shift.
        const isSneaking = this.game.inputManager && this.game.inputManager.actions['SPRINT']; // Usually Shift

        if (jump) {
            targetVel.y += 10.0;
        } else if (isSneaking) {
            targetVel.y -= 10.0;
        }

        // Apply acceleration towards target velocity (Drag + Thrust combined)
        const lerpFactor = dt * 2.0;
        this.velocity.lerp(targetVel, lerpFactor);

        // Propeller visual
        if (this.propGroup) {
            const throttle = Math.abs(moveForward) + (jump ? 0.5 : 0);
            this.propGroup.rotation.z += dt * (5 + throttle * 40);
        }

        // Banking visuals
        if (this.bodyGroup) {
            // Roll when turning or strafing
            this.bodyGroup.rotation.z = -moveRight * 0.4;
            // Pitch based on vertical velocity? Or Camera pitch?
            // Let's pitch slightly with vertical velocity
            this.bodyGroup.rotation.x = -this.velocity.y * 0.05;
        }
    }

    updatePhysics(dt) {
        // Apply velocity
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.position.z += this.velocity.z * dt;

        // Robust Ground Collision
        // 1. Try generic world height (good for general surface)
        let groundY = this.game.getWorldHeight ? this.game.getWorldHeight(this.position.x, this.position.z) : 0;

        // 2. Block-level check for caves/structures/unloaded chunks
        // Check the block at our feet
        const blockX = Math.floor(this.position.x);
        const blockY = Math.floor(this.position.y);
        const blockZ = Math.floor(this.position.z);

        // If we are inside or slightly below a solid block, push up
        const currentBlock = this.game.getBlock(blockX, blockY, blockZ);
        if (currentBlock && currentBlock.type !== 'air' && currentBlock.type !== 'water') {
            // We are inside a block, push up to its top
            groundY = Math.max(groundY, blockY + 1);
        } else {
            // Check the block directly below
            const belowBlock = this.game.getBlock(blockX, blockY - 1, blockZ);
            if (belowBlock && belowBlock.type !== 'air' && belowBlock.type !== 'water') {
                groundY = Math.max(groundY, blockY); // Top of block below is integer Y
            }
        }

        const groundThreshold = groundY + 0.5; // Half height offset (approx)

        if (this.position.y < groundThreshold) {
            this.position.y = groundThreshold;
            if (this.velocity.y < 0) this.velocity.y = 0;

            // Ground friction
            this.velocity.x *= 0.9;
            this.velocity.z *= 0.9;
        }

        // Ceiling / Sky limit
        if (this.position.y > 250) {
            this.position.y = 250;
            if (this.velocity.y > 0) this.velocity.y = 0;
        }
    }
}
