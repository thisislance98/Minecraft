import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Bear extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 1.0;
        this.height = 1.4;
        this.depth = 3.8; // Accurate length ~3.75
        this.collisionScale = 1.0; // No shrinking
        this.speed = 3.0;
        this.createBody();
        this.attackTimer = 0;
    }

    createBody() {
        // Bear: Dark Brown
        const furColor = 0x4B3621;
        const muzzleColor = 0x8B7355; // Lighter brown
        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const muzzleMat = new THREE.MeshLambertMaterial({ color: muzzleColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body (Big and bulky)
        const bodyGeo = new THREE.BoxGeometry(1.2, 1.1, 1.8);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 1.1, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.9, 0.8, 0.9);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 1.5, 1.2);
        this.mesh.add(head);

        // Muzzle
        const snoutGeo = new THREE.BoxGeometry(0.4, 0.3, 0.3);
        const snout = new THREE.Mesh(snoutGeo, muzzleMat);
        snout.position.set(0, 1.4, 1.7);
        this.mesh.add(snout);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.15, 0.1, 0.05);
        const nose = new THREE.Mesh(noseGeo, blackMat);
        nose.position.set(0, 1.5, 1.85);
        this.mesh.add(nose);

        // Ears (Rounded)
        const earGeo = new THREE.BoxGeometry(0.2, 0.2, 0.1);
        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.4, 1.9, 1.1);
        this.mesh.add(leftEar);
        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.4, 1.9, 1.1);
        this.mesh.add(rightEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.25, 1.6, 1.65);
        this.mesh.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.25, 1.6, 1.65);
        this.mesh.add(rightEye);

        // Stubby Tail
        const tailGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 1.2, -0.9);
        this.mesh.add(tail);

        // Thick Legs
        const legGeo = new THREE.BoxGeometry(0.4, 0.9, 0.4);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 1.0, z);
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.45, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.4, 0.7),
            makeLeg(0.4, 0.7),
            makeLeg(-0.4, -0.7),
            makeLeg(0.4, -0.7)
        ];
    }
    updateAI(dt) {
        // Bear logic: Wander, but if player is close, ATTACK
        const detectionRange = 15.0;
        const attackRange = 2.0; // Longer reach
        let target = null;

        const player = this.game.player;
        if (player && player.health > 0) {
            const distToPlayer = this.position.distanceTo(player.position);
            if (distToPlayer < detectionRange) {
                target = player;
            }
        }

        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
        }

        if (target) {
            this.state = 'chase';
            // Move towards target
            const dir = new THREE.Vector3().subVectors(target.position, this.position);
            const dist = dir.length();

            if (dist < attackRange) {
                // Attack player
                if (this.attackTimer <= 0) {
                    // BIG DAMAGE
                    target.takeDamage(6, 'Bear'); // 3 hearts

                    // MASSIVE KNOCKBACK
                    const kbDir = dir.clone().normalize();
                    kbDir.y = 0.5; // Upward launch
                    target.knockback(kbDir, 1.2);

                    this.attackTimer = 1.5; // Slower attack speed
                }

                // Stop moving to bite
                this.isMoving = false;

            } else {
                dir.normalize();
                this.moveDirection.copy(dir);
                this.rotation = Math.atan2(dir.x, dir.z);
                this.isMoving = true;

                // Bears are faster when chasing!
                // We use base speed in update(), but we can modify velocity or speed factor here?
                // Actually Animal.js uses this.speed.
                // Bears are usually slow (3.0), maybe boost to 6.0 in chase?
                // For now standard speed (it's scary enough)
            }
        } else {
            // No targets, wander normally
            super.updateAI(dt);
        }
    }
}
