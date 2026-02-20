import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class SuperPlane extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 3.0;
        this.height = 1.5;
        this.depth = 4.0;
        this.speed = 40.0;
        this.gravity = 0;
        this.throttle = 0;
        this.yaw = this.rotation;
        this.pitch = 0;
        this.roll = 0;
        this.createBody();
    }

    createBody() {
        // Materials
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2244aa, roughness: 0.3, metalness: 0.7 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });
        const engineMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.4 });
        const accentMat = new THREE.MeshStandardMaterial({ color: 0xffcc00 });

        this.bodyGroup = new THREE.Group();
        this.mesh.add(this.bodyGroup);

        // HITBOX for easier mounting
        const hitBoxGeo = new THREE.BoxGeometry(4, 3, 5);
        // Raycaster requires visible: true to detect intersection
        const hitBoxMat = new THREE.MeshBasicMaterial({ visible: true, transparent: true, opacity: 0.0, depthWrite: false });
        const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
        hitBox.position.set(0, 1, 0);
        this.mesh.add(hitBox);

        // Fuselage
        const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 3, 4, 8), bodyMat);
        fuselage.rotation.x = Math.PI / 2;
        this.bodyGroup.add(fuselage);

        // Cockpit
        const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
        cockpit.position.set(0, 0.4, 0.5);
        cockpit.scale.set(1, 0.6, 1.5);
        this.bodyGroup.add(cockpit);

        // Main Wings
        const wingGeom = new THREE.BoxGeometry(6, 0.1, 1.5);
        const wing = new THREE.Mesh(wingGeom, wingMat);
        wing.position.set(0, 0, 0);
        this.bodyGroup.add(wing);

        // Wing tips (accents)
        const tipGeom = new THREE.BoxGeometry(0.1, 0.2, 1.6);
        const leftTip = new THREE.Mesh(tipGeom, accentMat);
        leftTip.position.set(-3, 0, 0);
        this.bodyGroup.add(leftTip);
        const rightTip = leftTip.clone();
        rightTip.position.set(3, 0, 0);
        this.bodyGroup.add(rightTip);

        // Tail - Horizontal
        const hTail = new THREE.Mesh(new THREE.BoxGeometry(2, 0.05, 0.8), wingMat);
        hTail.position.set(0, 0, -1.8);
        this.bodyGroup.add(hTail);

        // Tail - Vertical
        const vTail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1, 0.8), bodyMat);
        vTail.position.set(0, 0.5, -1.8);
        this.bodyGroup.add(vTail);

        // Propeller Engine
        const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8), engineMat);
        engine.rotation.x = Math.PI / 2;
        engine.position.set(0, 0, 1.8);
        this.bodyGroup.add(engine);

        this.propGroup = new THREE.Group();
        this.propGroup.position.set(0, 0, 2.1);
        this.bodyGroup.add(this.propGroup);

        const bladeGeom = new THREE.BoxGeometry(2.5, 0.15, 0.05);
        const blade1 = new THREE.Mesh(bladeGeom, engineMat);
        this.propGroup.add(blade1);
        const blade2 = blade1.clone();
        blade2.rotation.z = Math.PI / 2;
        this.propGroup.add(blade2);

        // Landing Gear
        const gearMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const gearGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8);

        const wheelL = new THREE.Mesh(gearGeom, gearMat);
        wheelL.rotation.z = Math.PI / 2;
        wheelL.position.set(-0.8, -0.6, 0.5);
        this.bodyGroup.add(wheelL);

        const wheelR = wheelL.clone();
        wheelR.position.set(0.8, -0.6, 0.5);
        this.bodyGroup.add(wheelR);

        const wheelTail = wheelL.clone();
        wheelTail.scale.set(0.5, 1, 0.5);
        wheelTail.position.set(0, -0.5, -1.5);
        this.bodyGroup.add(wheelTail);
    }

    updateAI(dt) {
        // When not ridden, just apply simple gravity and friction
        this.velocity.x *= 0.95;
        this.velocity.z *= 0.95;

        // Propeller spin if moving (or just idle spin)
        if (this.propGroup) this.propGroup.rotation.z += dt * 2;

        // Gravity when not ridden
        if (!this.rider) {
            // Robust Ground Collision
            // 1. Try generic world height (good for general surface)
            let groundY = this.game.getWorldHeight ? this.game.getWorldHeight(this.position.x, this.position.z) : 0;

            // 2. Block-level check (for caves/floating islands/unloaded chunks)
            const blockX = Math.floor(this.position.x);
            const blockY = Math.floor(this.position.y);
            const blockZ = Math.floor(this.position.z);

            // Check below
            const currentBlock = this.game.getBlock(blockX, blockY, blockZ);
            if (currentBlock && currentBlock.type !== 'air' && currentBlock.type !== 'water') {
                groundY = Math.max(groundY, blockY + 1);
            } else {
                const belowBlock = this.game.getBlock(blockX, blockY - 1, blockZ);
                if (belowBlock && belowBlock.type !== 'air' && belowBlock.type !== 'water') {
                    groundY = Math.max(groundY, blockY); // Top of block below
                }
            }

            if (this.position.y > groundY + 1.0) {
                this.velocity.y -= 9.8 * dt;
            } else {
                this.velocity.y = 0;
                this.position.y = groundY + 1.0;
            }
        }
    }

    handleRiding(moveForward, moveRight, jump, rotationY, dt) {
        if (!this.rider) return;

        // Sync rotation with camera
        this.rotation = rotationY + Math.PI;

        const cameraPitch = this.game.camera.rotation.x;

        // Flight mechanics (Broom-like / Creative Fly)
        const speed = 40.0; // Max speed (superplane is faster)
        const responsiveness = 3.0;

        // Calculate look vector
        const lookDir = new THREE.Vector3(0, 0, -1);
        lookDir.applyEuler(new THREE.Euler(cameraPitch, rotationY, 0, 'YXZ'));

        // Calculate right vector
        const rightDir = new THREE.Vector3(1, 0, 0);
        rightDir.applyEuler(new THREE.Euler(0, rotationY, 0, 'YXZ'));

        const targetVel = new THREE.Vector3(0, 0, 0);

        if (moveForward > 0) {
            this.throttle = Math.min(1.5, this.throttle + dt * 0.5);
        } else if (moveForward < 0) {
            this.throttle = Math.max(-0.5, this.throttle - dt * 0.5);
        }

        // Steering
        if (moveRight !== 0) {
            this.yaw -= moveRight * dt * 2.0;
        }

        // Apply throttle to velocity
        // 1. Get Forward Vector
        const forward = lookDir.clone().normalize();

        // 2. Add Strafe? Usually planes don't strafe well without banking. 
        // Let's stick to forward thrust for the main engine.
        // But map "Right" key to Yaw (turn) above.

        // Target velocity is purely forward based on throttle
        targetVel.copy(forward).multiplyScalar(this.throttle * speed);

        // Allow some strafe for fine adjustments?
        // if (moveRight !== 0) targetVel.addScaledVector(rightDir, moveRight * speed * 0.5);

        // Vertical control
        const isSneaking = this.game.inputManager && this.game.inputManager.actions['SPRINT'];

        if (jump) {
            targetVel.y += 15.0;
        } else if (isSneaking) {
            targetVel.y -= 15.0;
        }

        // Apply acceleration
        this.velocity.lerp(targetVel, dt * responsiveness);

        // Propeller visual
        if (this.propGroup) {
            const throttle = Math.abs(moveForward) + (jump ? 0.5 : 0);
            this.propGroup.rotation.z += dt * (5 + throttle * 60);
        }

        // Banking visuals
        if (this.bodyGroup) {
            this.bodyGroup.rotation.z = -moveRight * 0.4;
            this.bodyGroup.rotation.x = -this.velocity.y * 0.02; // Mild pitch
        }
    }

    updatePhysics(dt) {
        // Apply velocity
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.position.z += this.velocity.z * dt;

        // Ground Collision
        // Robust check again in physics step to catch high-speed landings
        let groundY = this.game.getWorldHeight ? this.game.getWorldHeight(this.position.x, this.position.z) : 0;

        const blockX = Math.floor(this.position.x);
        const blockY = Math.floor(this.position.y);
        const blockZ = Math.floor(this.position.z);

        const currentBlock = this.game.getBlock(blockX, blockY, blockZ);
        if (currentBlock && currentBlock.type !== 'air' && currentBlock.type !== 'water') {
            groundY = Math.max(groundY, blockY + 1);
        } else {
            const belowBlock = this.game.getBlock(blockX, blockY - 1, blockZ);
            if (belowBlock && belowBlock.type !== 'air' && belowBlock.type !== 'water') {
                groundY = Math.max(groundY, blockY);
            }
        }

        const groundThreshold = groundY + 1.0;

        if (this.position.y < groundThreshold) {
            this.position.y = groundThreshold;
            if (this.velocity.y < 0) this.velocity.y = 0;

            // Ground friction
            this.velocity.x *= 0.9;
            this.velocity.z *= 0.9;
        }

        // Ceiling
        if (this.position.y > 300) {
            this.position.y = 300;
            if (this.velocity.y > 0) this.velocity.y = 0;
        }

        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;
    }
}
