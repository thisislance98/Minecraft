import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Spaceship extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 3.0;
        this.height = 2.0;
        this.depth = 3.0;
        this.speed = 50.0;
        this.gravity = 0;
        this.thrusters = [];
        this.createBody();
    }

    createBody() {
        // Materials
        const hullMat = new THREE.MeshLambertMaterial({ color: 0x445566 });
        const trimMat = new THREE.MeshLambertMaterial({ color: 0x6688aa });
        const glassMat = new THREE.MeshLambertMaterial({ 
            color: 0x88ccff, 
            transparent: true, 
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

        this.bodyGroup = new THREE.Group();
        this.mesh.add(this.bodyGroup);

        // Main Disc Hull
        const mainHull = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 0.6, 12), hullMat);
        mainHull.position.y = 0.5;
        this.bodyGroup.add(mainHull);

        // Top Dome (Cockpit)
        const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
        cockpit.position.y = 0.7;
        this.bodyGroup.add(cockpit);

        // Bottom Plate
        const bottomPlate = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.5, 0.3, 12), trimMat);
        bottomPlate.position.y = 0.1;
        this.bodyGroup.add(bottomPlate);

        // Engine Thrusters
        this.thrusters = [];
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 8), glowMat);
            thruster.position.set(Math.cos(angle) * 1.6, 0, Math.sin(angle) * 1.6);
            this.bodyGroup.add(thruster);
            this.thrusters.push(thruster);
        }

        // Interior visual
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), trimMat);
        seat.position.y = 0.5;
        this.bodyGroup.add(seat);
    }

    updateAI(dt) {
        if (this.bodyGroup) {
            this.bodyGroup.position.y = Math.sin(Date.now() * 0.002) * 0.05;
        }

        if (!this.rider) {
            this.velocity.multiplyScalar(0.98);
            
            const groundY = this.game.getWorldHeight ? this.game.getWorldHeight(this.position.x, this.position.z) : 0;
            if (this.position.y > groundY + 0.5) {
                this.velocity.y -= 5 * dt;
            } else {
                this.velocity.y = 0;
                this.position.y = groundY + 0.5;
            }
        }
    }

    handleRiding(moveForward, moveRight, jump, rotationY, dt) {
        if (!this.rider) return;

        this.rotation = rotationY + Math.PI;
        const cameraPitch = this.game.camera.rotation.x;

        const maxSpeed = 60.0;
        const lookDir = new THREE.Vector3(0, 0, -1);
        lookDir.applyEuler(new THREE.Euler(cameraPitch, rotationY, 0, 'YXZ'));

        const rightDir = new THREE.Vector3(1, 0, 0);
        rightDir.applyEuler(new THREE.Euler(0, rotationY, 0, 'YXZ'));

        const targetVel = new THREE.Vector3(0, 0, 0);

        if (moveForward !== 0) {
            targetVel.addScaledVector(lookDir, moveForward * maxSpeed);
        }
        if (moveRight !== 0) {
            targetVel.addScaledVector(rightDir, moveRight * maxSpeed);
        }

        const input = this.game.inputManager;
        const isCrouching = input && (input.keys['ShiftLeft'] || input.keys['KeyX']);
        
        if (jump) {
            targetVel.y += 20;
        } else if (isCrouching) {
            targetVel.y -= 20;
        }

        this.velocity.lerp(targetVel, dt * 3.0);

        // Visual effects
        const speedFactor = this.velocity.length() / maxSpeed;
        this.thrusters.forEach(t => {
            t.scale.set(1 + speedFactor * 0.5, 1 + speedFactor, 1 + speedFactor * 0.5);
        });

        if (this.bodyGroup) {
            this.bodyGroup.rotation.z = -moveRight * 0.3;
            this.bodyGroup.rotation.x = -this.velocity.y * 0.03;
        }
    }

    updatePhysics(dt) {
        this.position.addScaledVector(this.velocity, dt);

        let groundY = this.game.getWorldHeight ? this.game.getWorldHeight(this.position.x, this.position.z) : 0;
        const minHeight = groundY + 0.5;
        if (this.position.y < minHeight) {
            this.position.y = minHeight;
            if (this.velocity.y < 0) this.velocity.y = 0;
        }
    }
}
