import { Animal } from './Animal.js';
import * as THREE from 'three';

export class Monkey extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.6;
        this.height = 0.8;
        this.depth = 0.6;
        this.speed = 3.5;
        this.createBody();
        this.mesh.scale.set(0.8, 0.8, 0.8);

        // Tree jumping logic
        this.targetTree = null;
        this.isJumping = false;
        this.jumpCooldown = 0;
        this.scanTimer = 0;
    }

    createBody() {
        const furColor = 0x5C4033; // Dark brown
        const faceColor = 0xD2B48C; // Tan
        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const faceMat = new THREE.MeshLambertMaterial({ color: faceColor });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.6, 0.4);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.5, 0);
        this.mesh.add(body);

        // Head
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 0.9, 0);
        this.mesh.add(headGroup);

        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const head = new THREE.Mesh(headGeo, mat);
        headGroup.add(head);

        const faceGeo = new THREE.BoxGeometry(0.3, 0.25, 0.1);
        const face = new THREE.Mesh(faceGeo, faceMat);
        face.position.set(0, -0.05, 0.21);
        headGroup.add(face);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(0.25, 0, 0);
        headGroup.add(leftEar);
        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(-0.25, 0, 0);
        headGroup.add(rightEar);

        // Tail (Long)
        const tailGeo = new THREE.BoxGeometry(0.1, 0.1, 0.8);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 0.4, -0.4);
        tail.rotation.x = -Math.PI / 4;
        this.mesh.add(tail);

        // Arms/Legs
        const limbGeo = new THREE.BoxGeometry(0.12, 0.5, 0.12);

        const makeLimb = (x, y, z) => {
            const limb = new THREE.Mesh(limbGeo, mat);
            limb.position.set(x, y, z);
            return limb;
        };

        this.legParts = [
            makeLimb(-0.2, 0.2, 0),
            makeLimb(0.2, 0.2, 0)
        ];

        const leftArm = makeLimb(-0.3, 0.6, 0);
        const rightArm = makeLimb(0.3, 0.6, 0);

        this.mesh.add(this.legParts[0]);
        this.mesh.add(this.legParts[1]);
        this.mesh.add(leftArm);
        this.mesh.add(rightArm);

        // Add arms to legParts for animation so they swing too
        this.legParts.push(leftArm);
        this.legParts.push(rightArm);
    }

    updateAI(dt) {
        if (this.jumpCooldown > 0) this.jumpCooldown -= dt;

        if (this.isJumping) {
            // Check if landed
            if (this.onGround || this.velocity.y === 0) {
                this.isJumping = false;
                this.jumpCooldown = 2.0;
                this.state = 'idle';
            }
            return; // Don't wander while jumping
        }

        // Tree detection scan
        this.scanTimer -= dt;
        if (this.scanTimer <= 0 && this.jumpCooldown <= 0) {
            this.scanTimer = 1.0;
            this.checkForTrees();
        }

        super.updateAI(dt);
    }

    checkForTrees() {
        // Only jump if we are high up (in a tree) or on ground near a tree
        // 1. Check if we are currently on/near leaves or wood
        const pos = this.position;
        const currentBlock = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y - 1), Math.floor(pos.z));

        const isSecure = currentBlock && (currentBlock.type.includes('leaves') || currentBlock.type.includes('wood'));

        if (isSecure || Math.random() < 0.1) {
            // We are stable, maybe look for another tree to jump to
            // Scan random nearby blocks
            const range = 8;
            for (let i = 0; i < 5; i++) {
                const tx = pos.x + (Math.random() - 0.5) * range * 2;
                const tz = pos.z + (Math.random() - 0.5) * range * 2;
                // Look for trees higher up or same level
                const ty = pos.y + (Math.random() * 4) - 1;

                const targetBlock = this.game.getBlock(Math.floor(tx), Math.floor(ty), Math.floor(tz));
                if (targetBlock && (targetBlock.type.includes('leaves') || targetBlock.type.includes('wood'))) {
                    // Found a potential tree target
                    this.performJump(new THREE.Vector3(tx, ty + 1.5, tz));
                    return;
                }
            }
        }
    }

    performJump(targetPos) {
        this.isJumping = true;
        this.state = 'jump';
        this.rotation = Math.atan2(targetPos.x - this.position.x, targetPos.z - this.position.z);

        // Calculate physics arc
        // dist
        const dist = this.position.distanceTo(targetPos);
        const time = dist / 10.0; // Speed 10

        // velocity = (dist / time)
        const vel = targetPos.clone().sub(this.position).divideScalar(time);

        // Add gravity compensation: dy = vy * t - 0.5 * g * t^2
        // We want strict arrival, but basic arc is fine.
        // Approx extra Y velocity needed to counter gravity half-time?
        // Let's just give a good hop.
        vel.y = 8.0 + (targetPos.y - this.position.y);

        // Clamp
        if (vel.y > 15) vel.y = 15;

        this.velocity.copy(vel);
        this.moveDirection.copy(vel).normalize();
        this.onGround = false;
    }
}
