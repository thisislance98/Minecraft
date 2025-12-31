import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Horse extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.8;
        this.height = 1.4;
        this.depth = 1.6;
        this.speed = 6.0; // Horses are fast
        this.createBody();
    }

    handleRiding(moveForward, moveRight, jump, rotationY, dt) {
        // Apply rotation from player/camera
        this.rotation = rotationY;

        // Move based on input
        const speed = this.speed;
        const moveDir = new THREE.Vector3(moveRight, 0, moveForward);
        moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation);

        this.velocity.x = moveDir.x * speed;
        this.velocity.z = moveDir.z * speed;

        if (jump && this.onGround) {
            this.velocity.y = 7;
            this.onGround = false;
        }
    }

    interact() {
        if (!this.rider) {
            this.game.player.mountEntity(this);
        }
    }

    updatePhysics(dt) {
        // Simple gravity and movement
        this.velocity.y -= 15 * dt; // gravity

        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.position.z += this.velocity.z * dt;

        // Ground collision (simple Y=0 for now or actual world check)
        const groundY = this.game.physicsManager ? this.game.physicsManager.getGroundHeight(this.position.x, this.position.z) : 0;

        if (this.position.y < groundY) {
            this.position.y = groundY;
            this.velocity.y = 0;
            this.onGround = true;
        }

        this.mesh.position.copy(this.position);
    }

    createBody() {
        const brownColor = 0x5D4037; // Brown
        const darkBrown = 0x3E2723;
        const whiteColor = 0xF5F5F5;
        const blackColor = 0x212121;

        const mat = new THREE.MeshLambertMaterial({ color: brownColor });
        const darkMat = new THREE.MeshLambertMaterial({ color: darkBrown });
        const whiteMat = new THREE.MeshLambertMaterial({ color: whiteColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: blackColor });

        // Main Body
        const bodyGeo = new THREE.BoxGeometry(0.8, 0.9, 1.4);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.9, 0);
        this.mesh.add(body);

        // Neck and Head Group
        const neckGroup = new THREE.Group();
        neckGroup.position.set(0, 1.3, 0.5); // Start at front-top of body
        neckGroup.rotation.x = -0.5; // Steeper angle
        this.mesh.add(neckGroup);

        // Neck
        const neckGeo = new THREE.BoxGeometry(0.4, 0.9, 0.4);
        const neck = new THREE.Mesh(neckGeo, mat);
        neck.position.set(0, 0.4, 0); // Offset so pivot is at bottom
        neckGroup.add(neck);

        // Head
        const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.7);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.8, 0.2); // At the top of the neck
        head.rotation.x = 0.5; // Level out the head
        neckGroup.add(head);

        // Snout white patch
        const snoutGeo = new THREE.BoxGeometry(0.25, 0.25, 0.2);
        const snout = new THREE.Mesh(snoutGeo, whiteMat);
        snout.position.set(0, 0.7, 0.55);
        neckGroup.add(snout);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.1, 0.2, 0.05);
        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.15, 1.05, 0.0);
        neckGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.15, 1.05, 0.0);
        neckGroup.add(rightEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.05, 0.1, 0.1);
        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.23, 0.85, 0.25);
        neckGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.23, 0.85, 0.25);
        neckGroup.add(rightEye);

        // Mane (dark brown)
        const maneGeo = new THREE.BoxGeometry(0.15, 0.9, 0.2);
        const mane = new THREE.Mesh(maneGeo, darkMat);
        mane.position.set(0, 0.4, -0.2);
        neckGroup.add(mane);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.15, 0.8, 0.15);
        const tail = new THREE.Mesh(tailGeo, darkMat);
        tail.position.set(0, 1.0, -0.75);
        tail.rotation.x = 0.2;
        this.mesh.add(tail);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.2, 0.9, 0.2);
        const hoofGeo = new THREE.BoxGeometry(0.22, 0.15, 0.22);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.9, z);

            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.45, 0);
            pivot.add(leg);

            const hoof = new THREE.Mesh(hoofGeo, blackMat);
            hoof.position.set(0, -0.9, 0);
            pivot.add(hoof);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.25, 0.5),
            makeLeg(0.25, 0.5),
            makeLeg(-0.25, -0.5),
            makeLeg(0.25, -0.5)
        ];
    }
}
