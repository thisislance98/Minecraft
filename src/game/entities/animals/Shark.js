import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Shark extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.8;
        this.height = 0.6;
        this.depth = 1.6; // Long body
        this.gravity = 0;
        this.avoidsWater = false; // Sharks live in water
        this.createBody();
        this.state = 'walk'; // Using walk state for swimming
    }

    createBody() {
        // Shark Colors
        const skinColor = 0x8899A6; // Greyish Blue
        const bellyColor = 0xE0E0E0; // White belly
        const finColor = 0x778899;

        const mainMat = new THREE.MeshLambertMaterial({ color: skinColor });
        const bellyMat = new THREE.MeshLambertMaterial({ color: bellyColor });
        const finMat = new THREE.MeshLambertMaterial({ color: finColor });

        // Main Body (Upper)
        const bodyGeo = new THREE.BoxGeometry(0.6, 0.4, 1.2);
        const body = new THREE.Mesh(bodyGeo, mainMat);
        body.position.set(0, 0.2, 0);
        this.mesh.add(body);

        // Belly (Lower Body)
        const bellyGeo = new THREE.BoxGeometry(0.55, 0.2, 1.15);
        const belly = new THREE.Mesh(bellyGeo, bellyMat);
        belly.position.set(0, -0.1, 0);
        this.mesh.add(belly);

        // Head (Tapered front if possible, or just a smaller box)
        const headGeo = new THREE.BoxGeometry(0.5, 0.35, 0.4);
        const head = new THREE.Mesh(headGeo, mainMat);
        head.position.set(0, 0.15, 0.8);
        this.mesh.add(head);

        // Tail Section (Moving part)
        const tailGeo = new THREE.BoxGeometry(0.3, 0.3, 0.6);
        const tailGroup = new THREE.Group();
        tailGroup.position.set(0, 0.1, -0.6);

        const tailMesh = new THREE.Mesh(tailGeo, mainMat);
        tailMesh.position.set(0, 0, -0.3); // Offset so rotation pivot is at the body connection
        tailGroup.add(tailMesh);

        // Tail Fin (Vertical)
        const tailFinGeo = new THREE.BoxGeometry(0.1, 0.6, 0.3);
        const tailFin = new THREE.Mesh(tailFinGeo, finMat);
        tailFin.position.set(0, 0.1, -0.6); // End of tail section
        tailGroup.add(tailFin);

        this.mesh.add(tailGroup);
        this.tail = tailGroup;

        // Dorsal Fin (Top)
        const dorsalGeo = new THREE.BoxGeometry(0.1, 0.5, 0.4);
        const dorsalFin = new THREE.Mesh(dorsalGeo, finMat);
        dorsalFin.position.set(0, 0.65, 0);
        dorsalFin.rotation.x = -0.3; // Angle it back slightly
        this.mesh.add(dorsalFin);

        // Side Fins (Pectoral)
        const sideFinGeo = new THREE.BoxGeometry(0.6, 0.1, 0.3);

        const leftFin = new THREE.Mesh(sideFinGeo, finMat);
        leftFin.position.set(-0.4, -0.1, 0.2);
        leftFin.rotation.z = 0.2;
        leftFin.rotation.y = 0.3;
        this.mesh.add(leftFin);

        const rightFin = new THREE.Mesh(sideFinGeo, finMat);
        rightFin.position.set(0.4, -0.1, 0.2);
        rightFin.rotation.z = -0.2;
        rightFin.rotation.y = -0.3;
        this.mesh.add(rightFin);
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
                const speed = 4.0; // Sharks are faster than fish
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
            // Flop logic - sharks are helpless on land
            this.velocity.y -= 30.0 * dt;
            super.updateWalkerPhysics(dt);

            if (this.onGround && Math.random() < 0.05) {
                this.velocity.y = 3;
                this.velocity.x = (Math.random() - 0.5) * 2;
                this.velocity.z = (Math.random() - 0.5) * 2;
            }
        }
    }

    updateAI(dt) {
        // Simple random movement for now, maybe chase player later?
        super.updateAI(dt);
        if (Math.abs(this.moveDirection.y) < 0.01 && this.state === 'walk') {
            this.moveDirection.y = (Math.random() - 0.5) * 0.5;
        }
    }

    updateAnimation(dt) {
        if (this.tail) {
            // Powerful tail swish
            this.tail.rotation.y = Math.sin(performance.now() * 0.003) * 0.5;
        }
    }

    checkBodyCollision(x, y, z) {
        // Ignore water for collisions
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
