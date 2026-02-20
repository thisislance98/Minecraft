import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Fish extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.4;
        this.height = 0.3;
        this.depth = 0.6;
        this.gravity = 0;
        this.createBody();
        this.mesh.scale.set(0.6, 0.6, 0.6);
        this.state = 'walk'; // Using walk state for swimming
    }

    createBody() {
        const bodyColor = 0xFFA500; // Orange
        const finColor = 0xFFFFFF; // White

        const mat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const finMat = new THREE.MeshLambertMaterial({ color: finColor });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.2, 0.4, 0.6);
        const body = new THREE.Mesh(bodyGeo, mat);
        this.mesh.add(body);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.05, 0.3, 0.3);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 0, -0.4);
        tail.rotation.y = 0.2;
        this.mesh.add(tail);

        // Fins
        const finGeo = new THREE.BoxGeometry(0.3, 0.1, 0.2);
        const leftFin = new THREE.Mesh(finGeo, finMat);
        leftFin.position.set(-0.2, 0, 0.1);
        this.mesh.add(leftFin);

        const rightFin = new THREE.Mesh(finGeo, finMat);
        rightFin.position.set(0.2, 0, 0.1);
        this.mesh.add(rightFin);

        this.tail = tail;
    }

    updatePhysics(dt) {
        // Check for water
        const pos = this.position;
        const block = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
        const inWater = block && block.type === 'water';

        if (inWater) {
            // 3D Swimming
            this.velocity.y *= 0.9;
            this.velocity.x *= 0.9;
            this.velocity.z *= 0.9;

            if (this.state === 'walk') {
                const speed = 2.0;
                this.velocity.x += this.moveDirection.x * speed * dt;
                this.velocity.y += this.moveDirection.y * speed * dt;
                this.velocity.z += this.moveDirection.z * speed * dt;
            }

            this.position.add(this.velocity.clone().multiplyScalar(dt));

            if (this.checkBodyCollision(this.position.x, this.position.y, this.position.z)) {
                this.position.sub(this.velocity.clone().multiplyScalar(dt));
                this.rotation = Math.random() * Math.PI * 2;
                this.moveDirection.set(Math.sin(this.rotation), (Math.random() - 0.5), Math.cos(this.rotation));
            }

            this.onGround = false;
        } else {
            // Flop logic
            this.velocity.y -= 30.0 * dt;
            super.updateWalkerPhysics(dt);

            if (this.onGround && Math.random() < 0.05) {
                this.velocity.y = 5;
                this.velocity.x = (Math.random() - 0.5) * 5;
                this.velocity.z = (Math.random() - 0.5) * 5;
            }
        }
    }

    updateAI(dt) {
        super.updateAI(dt);
        if (Math.abs(this.moveDirection.y) < 0.01 && this.state === 'walk') {
            this.moveDirection.y = (Math.random() - 0.5) * 0.5;
        }
    }

    updateAnimation(dt) {
        if (this.tail) {
            // Basic tail wag
            this.tail.rotation.y = Math.sin(performance.now() * 0.01) * 0.4;
        }
    }

    checkBodyCollision(x, y, z) {
        // Copy of Animal.js checkBodyCollision but ignoring water
        const cos = Math.abs(Math.cos(this.rotation));
        const sin = Math.abs(Math.sin(this.rotation));

        const effW = (this.width * cos + this.depth * sin) * this.collisionScale;
        const effD = (this.width * sin + this.depth * cos) * this.collisionScale;

        const hw = effW / 2;
        const hd = effD / 2;
        const height = this.height;

        const minX = x - hw;
        const maxX = x + hw;
        const minZ = z - hd;
        const maxZ = z + hd;
        const minY = y;
        const maxY = y + height;

        const startBX = Math.floor(minX);
        const endBX = Math.floor(maxX);
        const startBY = Math.floor(minY);
        const endBY = Math.floor(maxY - 0.01);
        const startBZ = Math.floor(minZ);
        const endBZ = Math.floor(maxZ);

        for (let bx = startBX; bx <= endBX; bx++) {
            for (let by = startBY; by <= endBY; by++) {
                for (let bz = startBZ; bz <= endBZ; bz++) {
                    const block = this.game.getBlock(bx, by, bz);
                    if (block && block.type !== 'water') {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
