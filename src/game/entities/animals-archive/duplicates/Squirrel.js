import * as THREE from 'three';
import { Animal } from '../Animal.js';

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

        // Tree jumping logic (similar to Monkey)
        this.targetTree = null;
        this.isJumping = false;
        this.jumpCooldown = 0;
        this.scanTimer = 0;
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

    updateAI(dt) {
        if (this.jumpCooldown > 0) this.jumpCooldown -= dt;

        if (this.isJumping) {
            // Check if landed
            if (this.onGround || this.velocity.y === 0) {
                this.isJumping = false;
                this.jumpCooldown = 1.5; // Faster cooldown than Monkey
                this.state = 'idle';
            }
            return; // Don't wander while jumping
        }

        // Tree detection scan
        this.scanTimer -= dt;
        if (this.scanTimer <= 0 && this.jumpCooldown <= 0) {
            this.scanTimer = 0.8; // Scan more frequently than Monkey
            this.checkForTrees();
        }

        super.updateAI(dt);
    }

    checkForTrees() {
        // Only jump if we are high up (in a tree) or on ground near a tree
        const pos = this.position;
        const currentBlock = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y - 1), Math.floor(pos.z));

        const isSecure = currentBlock && (currentBlock.type.includes('leaves') || currentBlock.type.includes('wood'));

        if (isSecure || Math.random() < 0.15) {
            // We are stable, maybe look for another tree to jump to
            // Squirrels have shorter range than monkeys
            const range = 5;
            for (let i = 0; i < 5; i++) {
                const tx = pos.x + (Math.random() - 0.5) * range * 2;
                const tz = pos.z + (Math.random() - 0.5) * range * 2;
                // Look for trees higher up or same level
                const ty = pos.y + (Math.random() * 3) - 1;

                const targetBlock = this.game.getBlock(Math.floor(tx), Math.floor(ty), Math.floor(tz));
                if (targetBlock && (targetBlock.type.includes('leaves') || targetBlock.type.includes('wood'))) {
                    // Found a potential tree target
                    this.performJump(new THREE.Vector3(tx, ty + 1.0, tz));
                    return;
                }
            }
        }
    }

    performJump(targetPos) {
        this.isJumping = true;
        this.state = 'jump';
        this.rotation = Math.atan2(targetPos.x - this.position.x, targetPos.z - this.position.z);

        // Calculate physics arc (smaller than Monkey)
        const dist = this.position.distanceTo(targetPos);
        const time = dist / 8.0; // Slightly slower than Monkey

        const vel = targetPos.clone().sub(this.position).divideScalar(time);

        // Add gravity compensation
        vel.y = 6.0 + (targetPos.y - this.position.y);

        // Clamp
        if (vel.y > 12) vel.y = 12;

        this.velocity.copy(vel);
        this.moveDirection.copy(vel).normalize();
        this.onGround = false;
    }

    updatePhysics(dt) {
        // If jumping, use hopper-style physics for the arc
        if (this.isJumping) {
            // Apply gravity
            this.velocity.y -= this.gravity * dt;
            this.velocity.y = Math.max(this.velocity.y, -40);

            // Move
            this.position.x += this.velocity.x * dt;
            this.position.y += this.velocity.y * dt;
            this.position.z += this.velocity.z * dt;

            // Check for landing on solid block
            const groundY = this.findGroundY();
            if (this.position.y <= groundY) {
                this.position.y = groundY;
                this.velocity.y = 0;
                this.onGround = true;
            }
            return;
        }

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

            // Move slightly towards the tree to stick
            this.position.x += this.moveDirection.x * dt;
            this.position.z += this.moveDirection.z * dt;

            // Move up
            this.position.y += this.velocity.y * dt;
            this.onGround = false;
            return;
        }

        this.climbing = false;
        super.updateWalkerPhysics(dt);
    }

    findGroundY() {
        const pos = this.position;
        const checkX = Math.floor(pos.x);
        const checkZ = Math.floor(pos.z);

        // Check downward for ground
        for (let y = Math.floor(pos.y); y >= Math.floor(pos.y) - 10; y--) {
            if (this.game.getBlock(checkX, y, checkZ)) {
                return y + 1;
            }
        }
        return -Infinity;
    }
}
