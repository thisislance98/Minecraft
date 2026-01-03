import * as THREE from 'three';
import { InteractivePlant } from './InteractivePlant.js';

export class HelicopterPlant extends InteractivePlant {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        this.width = 0.8;
        this.height = 1.5;
        this.depth = 0.8;

        this.rotorSpeed = 0;
        this.baseY = y;
        this.isFlying = false;
        this.flyState = 'grounded'; // grounded, takeoff, flying, returning, landing

        this.detectionRange = 3.0;

        this.createBody();
    }

    createBody() {
        // Stalk
        const stalkGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6);
        const greenMat = new THREE.MeshLambertMaterial({ color: 0x4caf50 });
        const stalk = new THREE.Mesh(stalkGeo, greenMat);
        stalk.position.y = 0.5;
        this.mesh.add(stalk);

        // Rotor Head
        this.rotor = new THREE.Group();
        this.rotor.position.y = 1.0;

        // Leaves/Blades
        const bladeGeo = new THREE.BoxGeometry(1.2, 0.02, 0.3);
        const bladeMat = new THREE.MeshLambertMaterial({ color: 0x81c784 }); // Lighter green

        const b1 = new THREE.Mesh(bladeGeo, bladeMat);
        this.rotor.add(b1);

        const b2 = new THREE.Mesh(bladeGeo, bladeMat);
        b2.rotation.y = Math.PI / 2;
        this.rotor.add(b2);

        // Bulb in center
        const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.15),
            new THREE.MeshLambertMaterial({ color: 0xffeb3b }) // Yellow
        );
        this.rotor.add(bulb);

        this.mesh.add(this.rotor);
    }

    onActivate(player) {
        if (this.flyState === 'grounded') {
            this.flyState = 'takeoff';
        }
    }

    onDeactivate() {
        if (this.flyState === 'flying' || this.flyState === 'takeoff') {
            this.flyState = 'returning';
        }
    }

    onUpdateActive(dt) {
        // Managed in updatePhysics primarily
    }

    updatePhysics(dt) {
        // Spin rotor
        if (this.flyState !== 'grounded') {
            this.rotorSpeed = Math.min(this.rotorSpeed + dt * 10, 20);
        } else {
            this.rotorSpeed = Math.max(this.rotorSpeed - dt * 5, 0);
        }

        this.rotor.rotation.y += this.rotorSpeed * dt;

        // Flight Logic
        const flyHeight = 4.0;
        const liftSpeed = 2.0;

        if (this.flyState === 'takeoff') {
            if (this.position.y < this.baseY + flyHeight) {
                this.position.y += liftSpeed * dt;
            } else {
                this.flyState = 'flying';
            }
        } else if (this.flyState === 'returning') {
            // Go higher? Or hover?
        }

        // If deactivated (returning), go down
        if (!this.isActive && this.position.y > this.baseY) {
            this.position.y -= liftSpeed * 0.5 * dt;
            if (this.position.y <= this.baseY) {
                this.position.y = this.baseY;
                this.flyState = 'grounded';
            }
        }

        this.mesh.position.copy(this.position);
    }
}
