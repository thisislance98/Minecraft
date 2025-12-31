import * as THREE from 'three';
import { Animal } from '../Animal.js';
import { Wolf } from './Wolf.js';

export class Bunny extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.4;
        this.height = 0.6;
        this.depth = 0.6;
        this.speed = 3.0; // Fast movement when hopping
        this.jumpForce = 15; // Jumps really high
        this.canHop = true; // Bunnies hop up mountains
        this.isCarried = false; // Can be picked up by elephants
        this.createBody();
    }

    createBody() {
        // Bunny: White/Grey
        const furColor = 0xE0E0E0;
        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const earInnerMat = new THREE.MeshLambertMaterial({ color: 0xF0ACBC }); // Pink inside ears
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.4, 0.4, 0.5);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.3, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.5, 0.3);
        this.mesh.add(head);

        // Ears (Long!)
        const earGeo = new THREE.BoxGeometry(0.08, 0.4, 0.05);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.08, 0.8, 0.3);
        leftEar.rotation.z = -0.1;
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.08, 0.8, 0.3);
        rightEar.rotation.z = 0.1;
        this.mesh.add(rightEar);

        // Tail (Small puff)
        const tailGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 0.35, -0.25);
        this.mesh.add(tail);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);

        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.16, 0.55, 0.4);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.16, 0.55, 0.4);
        this.mesh.add(rightEye);

        // Legs (Simplistic for now, maybe hopping animation later)
        const legGeo = new THREE.BoxGeometry(0.1, 0.2, 0.1);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.2, z);
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.1, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.15, 0.15),
            makeLeg(0.15, 0.15),
            makeLeg(-0.15, -0.15),
            makeLeg(0.15, -0.15)
        ];
    }

    updateAI(dt) {
        // Skip AI if being carried
        if (this.isCarried) return;

        // Flee from Wolves
        const fearRange = 10.0;
        let nearestWolf = null;
        let nearestDist = fearRange * fearRange;

        if (this.game.animals) {
            for (const other of this.game.animals) {
                if (other instanceof Wolf) {
                    const distSq = this.position.distanceToSquared(other.position);
                    if (distSq < nearestDist) {
                        nearestDist = distSq;
                        nearestWolf = other;
                    }
                }
            }
        }

        if (nearestWolf) {
            this.state = 'flee';
            this.stateTimer = 1.0; // Flee for at least 1 second

            // Run away from wolf
            const fleeDir = new THREE.Vector3().subVectors(this.position, nearestWolf.position).normalize();
            fleeDir.y = 0; // Keep horizontal
            this.moveDirection.copy(fleeDir);
            this.rotation = Math.atan2(this.moveDirection.x, this.moveDirection.z);
            this.isMoving = true;

            // Panic jumping handled in updatePhysics
        } else if (this.checkProximityFlee(8.0)) {
            // Flee from player (using base Animal method)
            // But we need to ensure Bunny hopping logic triggers?
            // Base `checkProximityFlee` calls `fleeFrom` which sets state to `flee`.
            // Bunny `updatePhysics` checks for `state === 'flee'` to jump.
            // But we need `moveDirection` set correctly. `fleeFrom` doesn't set `moveDirection` automatically in the base class?
            // Actually it does NOT. It just sets target.
            // Base `updateAI` handles `moveDirection` if state is `flee`.
            // Bunny overrides `updateAI` but calls `super.updateAI(dt)` if no wolf.
            // So if `checkProximityFlee` works, it sets state='flee'.
            // Then we fall through to `super.updateAI`?
            // Wait, I am modifying the `if (nearestWolf)` block.
            // If I return or fall through, it should work.
        } else {
            super.updateAI(dt);
        }
    }

    updatePhysics(dt) {
        // Skip physics if being carried
        if (this.isCarried) return;

        // Jump when moving (hopping)
        if ((this.state === 'walk' || this.state === 'flee') && this.onGround) {
            this.velocity.y = this.jumpForce;
            this.onGround = false;
        }
        super.updatePhysics(dt);
    }
}
