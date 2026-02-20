import { Animal } from './Animal.js';
import * as THREE from 'three';

export class Squirrel extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.4;
        this.height = 0.4;
        this.depth = 0.6;
        this.speed = 5.0; // Fast
        this.createBody();
        this.mesh.scale.set(0.6, 0.6, 0.6);
        this.climbing = false;
    }

    createBody() {
        // Squirrel: Brown/Grey
        const furColor = 0x8B4513;
        const tailColor = 0xA0522D;
        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const tailMat = new THREE.MeshLambertMaterial({ color: tailColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.4, 0.4, 0.5);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.2, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.35, 0.35);
        this.mesh.add(head);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.2, 0.2, 0.6);
        const tail = new THREE.Mesh(tailGeo, tailMat);
        tail.position.set(0, 0.4, -0.4);
        tail.rotation.x = Math.PI / 3.0; // Angled up
        this.mesh.add(tail);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(0.1, 0.4, 0.5);
        this.mesh.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(-0.1, 0.4, 0.5);
        this.mesh.add(rightEye);
    }

    updatePhysics(dt) {
        // Custom climbing logic
        const pos = this.position;
        const forwardX = pos.x + this.moveDirection.x * 0.5;
        const forwardZ = pos.z + this.moveDirection.z * 0.5;

        // Check block in front
        const blockInFront = this.game.getBlock(Math.floor(forwardX), Math.floor(pos.y), Math.floor(forwardZ));

        // Climb if hitting wood
        if (blockInFront && blockInFront.type.includes('wood')) {
            this.climbing = true;
            this.velocity.y = 4.0; // Climb up
            this.onGround = false;

            // Move slightly towards the tree to stick
            this.position.x += this.moveDirection.x * dt;
            this.position.z += this.moveDirection.z * dt;

            // Move up
            this.position.y += this.velocity.y * dt;
            return;
        }

        this.climbing = false;
        super.updateWalkerPhysics(dt);
    }
}
