import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Creeper extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.6;
        this.height = 1.7;
        this.depth = 0.6;
        this.speed = 1.5;
        this.health = 20;
        this.damage = 10; // Explosion damage
        this.isHostile = true;
        this.attackRange = 2.0; // Close range explosion
        this.attackCooldown = 1.5; // Fuse time
        this.isFusing = false;
        this.fuseTimer = 0;
        this.fuseDuration = 1.5;

        this.createBody();
    }

    createBody() {
        const skinMat = new THREE.MeshLambertMaterial({ color: 0x00AA00 }); // Green
        const darkMat = new THREE.MeshLambertMaterial({ color: 0x005500 }); // Darker green spots
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 1.45, 0);
        this.mesh.add(head);

        // Face - sad expression
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.12, 1.5, 0.26);
        this.mesh.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.12, 1.5, 0.26);
        this.mesh.add(rightEye);

        // Frown
        const mouthGeo = new THREE.BoxGeometry(0.2, 0.08, 0.05);
        const mouth = new THREE.Mesh(mouthGeo, blackMat);
        mouth.position.set(0, 1.35, 0.26);
        this.mesh.add(mouth);

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.7, 0.3);
        const body = new THREE.Mesh(bodyGeo, skinMat);
        body.position.set(0, 1.0, 0);
        this.mesh.add(body);

        // Spots
        const spotGeo = new THREE.BoxGeometry(0.15, 0.15, 0.05);
        const spot1 = new THREE.Mesh(spotGeo, darkMat);
        spot1.position.set(-0.1, 1.1, 0.18);
        this.mesh.add(spot1);
        const spot2 = new THREE.Mesh(spotGeo, darkMat);
        spot2.position.set(0.15, 0.9, 0.18);
        this.mesh.add(spot2);

        // Legs (4 short legs)
        const legGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.6, z);
            const leg = new THREE.Mesh(legGeo, skinMat);
            leg.position.set(0, -0.3, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.15, 0.1),
            makeLeg(0.15, 0.1),
            makeLeg(-0.15, -0.1),
            makeLeg(0.15, -0.1)
        ];
    }

    attackPlayer(player) {
        // Start fusing instead of immediate damage
        if (!this.isFusing) {
            this.isFusing = true;
            this.fuseTimer = 0;
            this.isMoving = false; // Stop moving while fusing
        }
    }

    update(dt) {
        super.update(dt);

        // Handle fusing/explosion
        if (this.isFusing) {
            this.fuseTimer += dt;

            // Flash white/green
            const flash = Math.sin(this.fuseTimer * 20) > 0;
            this.mesh.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (!child.material.userData.originalColor) {
                        child.material.userData.originalColor = child.material.color.clone();
                    }
                    if (flash) {
                        child.material.color.setHex(0xFFFFFF);
                    } else {
                        child.material.color.copy(child.material.userData.originalColor);
                    }
                }
            });

            if (this.fuseTimer >= this.fuseDuration) {
                this.explode();
            }
        }
    }

    explode() {
        const player = this.game.player;
        const dist = this.position.distanceTo(player.position);

        // Damage player if close
        if (dist < 4.0) {
            const dmg = Math.max(1, Math.floor(this.damage * (1 - dist / 4.0)));
            player.takeDamage(dmg, 'Creeper Explosion');
            const dir = new THREE.Vector3().subVectors(player.position, this.position).normalize();
            player.knockback(dir, 0.5);
        }

        // Destroy blocks in radius (optional, simple version)
        // For now, just kill the creeper
        this.health = 0;
        this.isDead = true;

        console.log('Creeper exploded!');
    }
}
