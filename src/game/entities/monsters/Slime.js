import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Slime extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.8;
        this.height = 0.8;
        this.depth = 0.8;
        this.speed = 1.5;
        this.health = 10;
        this.damage = 1;
        this.isHostile = true;
        this.canHop = true;
        this.jumpTimer = 0;

        this.createBody();
    }

    createBody() {
        // Outer body - Translucent green
        const outerMat = new THREE.MeshLambertMaterial({
            color: 0x00FF00,
            transparent: true,
            opacity: 0.6
        });
        const outerGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const outer = new THREE.Mesh(outerGeo, outerMat);
        outer.position.set(0, 0.4, 0);
        this.mesh.add(outer);

        // Inner core - Solid darker green
        const innerMat = new THREE.MeshLambertMaterial({ color: 0x00AA00 });
        const innerGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const inner = new THREE.Mesh(innerGeo, innerMat);
        inner.position.set(0, 0.4, 0);
        this.mesh.add(inner);

        // Eyes
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.2, 0.5, 0.4);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.2, 0.5, 0.4);
        this.mesh.add(rightEye);
    }

    updateAI(dt) {
        if (this.isDead || this.isDying) return;

        this.stateTimer -= dt;

        // Target player
        const player = this.game.player;
        const dist = this.position.distanceTo(player.position);

        if (dist < this.detectionRange) {
            this.state = 'chase';
            // Update rotation to face player
            const dir = new THREE.Vector3().subVectors(player.position, this.position);
            this.rotation = Math.atan2(dir.x, dir.z);
        } else if (this.stateTimer <= 0) {
            // Idle/Wander
            const rand = this.rng.next();
            if (rand < 0.5) {
                this.state = 'walk';
                this.rotation += (this.rng.next() - 0.5) * Math.PI;
            } else {
                this.state = 'idle';
            }
            this.stateTimer = this.rng.next() * 3 + 2;
        }

        // Slime jump movement
        if (this.onGround) {
            this.jumpTimer -= dt;
            if (this.jumpTimer <= 0 && (this.state === 'walk' || this.state === 'chase')) {
                // Jump!
                this.velocity.y = 4.0;
                this.onGround = false;
                this.jumpTimer = 0.8 + this.rng.next() * 0.5;

                // Move forward
                const moveSpeed = this.state === 'chase' ? this.speed * 1.5 : this.speed;
                this.velocity.x = Math.sin(this.rotation) * moveSpeed;
                this.velocity.z = Math.cos(this.rotation) * moveSpeed;
            } else {
                // Friction
                this.velocity.x *= 0.9;
                this.velocity.z *= 0.9;
            }
        }

        // Damage player on contact
        if (dist < 1.0 && this.attackTimer <= 0) {
            player.takeDamage(this.damage, 'Slime');
            this.attackTimer = this.attackCooldown;

            // Knockback player
            const knockDir = new THREE.Vector3().subVectors(player.position, this.position).normalize();
            player.knockback(knockDir, 0.5);
        }

        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
        }
    }
}
