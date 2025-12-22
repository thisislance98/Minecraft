import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Dolphin extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.7;
        this.height = 0.5;
        this.depth = 1.4; // Long body
        this.gravity = 0; // Buoyant in water
        this.createBody();
        this.state = 'walk'; // Using walk state for swimming
    }

    createBody() {
        // Dolphin Colors
        const skinColor = 0x607D8B; // Blue Grey
        const bellyColor = 0xE0E0E0; // White belly
        const finColor = 0x546E7A; // Darker fin

        const mainMat = new THREE.MeshLambertMaterial({ color: skinColor });
        const bellyMat = new THREE.MeshLambertMaterial({ color: bellyColor });
        const finMat = new THREE.MeshLambertMaterial({ color: finColor });

        // Main Body
        const bodyGeo = new THREE.BoxGeometry(0.7, 0.4, 1.0);
        const body = new THREE.Mesh(bodyGeo, mainMat);
        body.position.set(0, 0.2, 0.1);
        this.mesh.add(body);

        // Belly
        const bellyGeo = new THREE.BoxGeometry(0.6, 0.2, 0.9);
        const belly = new THREE.Mesh(bellyGeo, bellyMat);
        belly.position.set(0, -0.1, 0.1);
        this.mesh.add(belly);

        // Head (Snout)
        const headGeo = new THREE.BoxGeometry(0.5, 0.35, 0.5);
        const head = new THREE.Mesh(headGeo, mainMat);
        head.position.set(0, 0.15, 0.85);
        this.mesh.add(head);

        // Beak/Nose
        const beakGeo = new THREE.BoxGeometry(0.2, 0.15, 0.3);
        const beak = new THREE.Mesh(beakGeo, bellyMat);
        beak.position.set(0, 0.1, 1.25);
        this.mesh.add(beak);

        // Tail Section (Moving part)
        const tailGeo = new THREE.BoxGeometry(0.3, 0.25, 0.6);
        const tailGroup = new THREE.Group();
        tailGroup.position.set(0, 0.2, -0.4);

        const tailMesh = new THREE.Mesh(tailGeo, mainMat);
        tailMesh.position.set(0, 0, -0.3); // Offset for pivot
        tailGroup.add(tailMesh);

        // Tail Flukes (Horizontal for dolphins/whales)
        const flukeGeo = new THREE.BoxGeometry(0.8, 0.05, 0.3);
        const tailFluke = new THREE.Mesh(flukeGeo, finMat);
        tailFluke.position.set(0, 0, -0.7);
        tailGroup.add(tailFluke);

        this.mesh.add(tailGroup);
        this.tail = tailGroup;

        // Dorsal Fin (Top, Curved look implied)
        const dorsalGeo = new THREE.BoxGeometry(0.1, 0.4, 0.3);
        const dorsalFin = new THREE.Mesh(dorsalGeo, finMat);
        dorsalFin.position.set(0, 0.5, 0.1);
        dorsalFin.rotation.x = -0.4; // Angled back
        this.mesh.add(dorsalFin);

        // Pectoral Fins
        const finGeo = new THREE.BoxGeometry(0.4, 0.05, 0.2);

        const leftFin = new THREE.Mesh(finGeo, finMat);
        leftFin.position.set(-0.45, -0.1, 0.3);
        leftFin.rotation.z = -0.3;
        leftFin.rotation.y = 0.4;
        this.mesh.add(leftFin);

        const rightFin = new THREE.Mesh(finGeo, finMat);
        rightFin.position.set(0.45, -0.1, 0.3);
        rightFin.rotation.z = 0.3;
        rightFin.rotation.y = -0.4;
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
                const speed = 4.5; // Fast swimmers
                this.velocity.x += this.moveDirection.x * speed * dt;
                this.velocity.y += this.moveDirection.y * speed * dt;
                this.velocity.z += this.moveDirection.z * speed * dt;

                // Occasional jump breach
                if (pos.y > this.game.worldGen.seaLevel - 1 && Math.random() < 0.005) {
                    this.velocity.y = 8.0; // Surface jump
                }
            }

            this.position.add(this.velocity.clone().multiplyScalar(dt));

            if (this.checkBodyCollision(this.position.x, this.position.y, this.position.z)) {
                this.position.sub(this.velocity.clone().multiplyScalar(dt));
                this.rotation = Math.random() * Math.PI * 2;
                this.moveDirection.set(Math.sin(this.rotation), (Math.random() - 0.5), Math.cos(this.rotation));
            }

            this.onGround = false;
        } else {
            // Flop logic - dolphins are helpless on land
            this.velocity.y -= 30.0 * dt;
            super.updateWalkerPhysics(dt);

            if (this.onGround && Math.random() < 0.05) {
                this.velocity.y = 4;
                this.velocity.x = (Math.random() - 0.5) * 3;
                this.velocity.z = (Math.random() - 0.5) * 3;
            }
        }
    }

    updateAI(dt) {
        // Simple random movement + Playful behavior
        super.updateAI(dt);
        if (Math.abs(this.moveDirection.y) < 0.01 && this.state === 'walk') {
            this.moveDirection.y = (Math.random() - 0.5) * 0.5;
        }

        // Playful spin if jumping out of water?
        if (!this.onGround && this.position.y > this.game.worldGen.seaLevel) {
            // this.mesh.rotation.z += dt * 5; // Spin? Maybe too glitchy looking
        }
    }

    updateAnimation(dt) {
        if (this.tail) {
            // Dolphin kick (Up and down, but visual rotation is usually X axis for up/down)
            // But we can just use the Y rotation hack or actually rotate X.
            // Let's wag vertical (Rotate X)
            this.tail.rotation.x = Math.sin(performance.now() * 0.005) * 0.4;
        }
    }

    checkBodyCollision(x, y, z) {
        // Reuse Animal/Shark collision logic (ignoring water)
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
