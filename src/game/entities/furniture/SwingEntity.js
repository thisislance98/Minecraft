import * as THREE from 'three';
import { Furniture } from './Furniture.js';

export class SwingEntity extends Furniture {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 1.0;
        this.height = 1.5;
        this.depth = 1.0;

        this.swingAmplitude = 0.4;
        this.swingSpeed = 2.0;
        this.baseRotation = 0;

        // This is important for checkMountCollision
        this.isMountable = true;
    }

    createBody() {
        // Swing seat
        const seatGroup = new THREE.Group();
        this.mesh.add(seatGroup);
        this.seatGroup = seatGroup;

        const seatMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const ropeMat = new THREE.MeshLambertMaterial({ color: 0xCCCCCC });

        // Seat
        const seatGeo = new THREE.BoxGeometry(0.8, 0.05, 0.4);
        const seat = new THREE.Mesh(seatGeo, seatMat);
        seat.position.y = -0.8;
        seatGroup.add(seat);

        // Ropes
        const ropeGeo = new THREE.BoxGeometry(0.02, 1.5, 0.02);
        const ropeL = new THREE.Mesh(ropeGeo, ropeMat);
        ropeL.position.set(-0.35, -0.05, 0);
        seatGroup.add(ropeL);

        const ropeR = new THREE.Mesh(ropeGeo, ropeMat);
        ropeR.position.set(0.35, -0.05, 0);
        seatGroup.add(ropeR);

        // Move the pivot point to the top of the ropes
        seatGroup.position.y = 1.4;
    }

    updatePhysics(dt) {
        // If someone is riding, oscillate the swing
        if (this.rider) {
            const time = performance.now() / 1000;
            this.seatGroup.rotation.x = Math.sin(time * this.swingSpeed) * this.swingAmplitude;

            // Sync rider position to the oscillating seat
            // Seat is at (0, -0.8, 0) relative to seatGroup
            // We need world position of seat
            const seatWorldPos = new THREE.Vector3(0, -0.6, 0);
            seatWorldPos.applyMatrix4(this.seatGroup.matrixWorld);
            this.rider.position.copy(seatWorldPos);
        } else {
            // Decay rotation back to zero
            this.seatGroup.rotation.x *= 0.95;
            if (Math.abs(this.seatGroup.rotation.x) < 0.01) this.seatGroup.rotation.x = 0;
        }

        // Parent physics for gravity/position
        super.updatePhysics(dt);
    }
}
