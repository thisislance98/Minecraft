import * as THREE from 'three';
import { Animal } from '../Animal.js';
import { WrenchProjectile } from '../projectiles/WrenchProjectile.js';

export class Robot extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.8;
        this.height = 1.8;
        this.depth = 0.8;

        this.speed = 1.3;
        this.health = 30; // Stronger than average
        this.maxHealth = 30;
        this.damage = 4; // Contact damage

        this.isHostile = true;
        this.attackRange = 10.0; // Ranged attack range
        this.detectionRange = 20.0;

        this.throwCooldown = 3.0;
        this.throwTimer = 0;

        this.createBody();
    }

    createBody() {
        const metalMat = new THREE.MeshLambertMaterial({ color: 0xCCCCCC }); // Silver
        const darkMetalMat = new THREE.MeshLambertMaterial({ color: 0x555555 }); // Dark Grey
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xFF0000 }); // Glowing Red Eyes

        // Torso
        const torsoGeo = new THREE.BoxGeometry(0.6, 0.8, 0.4);
        const torso = new THREE.Mesh(torsoGeo, metalMat);
        torso.position.y = 1.1;
        this.mesh.add(torso);

        // Head
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.5, 0); // Neck pivot
        this.mesh.add(headGroup);

        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const head = new THREE.Mesh(headGeo, metalMat);
        head.position.y = 0.2;
        headGroup.add(head);

        // Eyes (Visor style)
        const visorGeo = new THREE.BoxGeometry(0.3, 0.1, 0.05);
        const visor = new THREE.Mesh(visorGeo, eyeMat);
        visor.position.set(0, 0.2, 0.2);
        headGroup.add(visor);

        // Antenna
        const antStemGeo = new THREE.BoxGeometry(0.02, 0.3, 0.02);
        const antStem = new THREE.Mesh(antStemGeo, darkMetalMat);
        antStem.position.set(0, 0.55, 0);
        headGroup.add(antStem);

        const antBulbGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const antBulb = new THREE.Mesh(antBulbGeo, new THREE.MeshLambertMaterial({ color: 0xFFAA00 }));
        antBulb.position.set(0, 0.7, 0);
        headGroup.add(antBulb);

        // Arms (Jointed look)
        const makeLimb = (x, y, mat) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, y, 0);

            // Upper
            const upperGeo = new THREE.BoxGeometry(0.2, 0.4, 0.2);
            const upper = new THREE.Mesh(upperGeo, mat);
            upper.position.y = -0.2;
            pivot.add(upper);

            // Lower
            const lowerGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
            const lower = new THREE.Mesh(lowerGeo, darkMetalMat);
            lower.position.y = -0.6;
            pivot.add(lower);

            this.mesh.add(pivot);
            return pivot;
        };

        // Legs
        const leftLeg = makeLimb(-0.2, 0.7, metalMat);
        const rightLeg = makeLimb(0.2, 0.7, metalMat);
        this.legParts = [leftLeg, rightLeg];

        // Arms
        const leftArm = makeLimb(-0.45, 1.4, metalMat);
        const rightArm = makeLimb(0.45, 1.4, metalMat); // Throwing arm
        this.armParts = [leftArm, rightArm];

        // Default Pose
        // slightly forward ready
        leftArm.rotation.x = 0.2;
        rightArm.rotation.x = 0.2;
    }

    update(dt) {
        super.update(dt); // Handles physics, movement, common AI

        // Robots are visible day and night
        if (this.mesh && !this.mesh.visible) {
            this.mesh.visible = true;
        }

        if (this.throwTimer > 0) {
            this.throwTimer -= dt;
        }
    }

    updateAI(dt) {
        // Base behavior via super class
        super.updateAI(dt);

        // Custom Ranged Hostile Behavior override
        if (this.isHostile && !this.isDead && !this.isDying) {
            const player = this.game.player;
            const dist = this.position.distanceTo(player.position);

            if (dist < this.detectionRange) {
                this.state = 'chase'; // Using chase state for tracking

                // Face player
                const dir = new THREE.Vector3().subVectors(player.position, this.position);
                dir.y = 0;
                dir.normalize();
                this.rotation = Math.atan2(dir.x, dir.z);

                // Movement Logic
                if (dist > this.attackRange * 1.5) {
                    // Too far, close in
                    this.moveDirection.copy(dir);
                    this.isMoving = true;
                } else if (dist < this.attackRange * 0.5) {
                    // Too close, back up? Or just stand ground?
                    // Back up for better throwing angle
                    this.moveDirection.copy(dir).negate();
                    this.isMoving = true;
                } else {
                    // Ideal range
                    this.isMoving = false;
                }

                // Attack Logic
                if (this.throwTimer <= 0 && dist < this.attackRange * 1.2) {
                    // Line of sight check? Assuming clear for now or simple check
                    this.throwWrench(player);
                    this.throwTimer = this.throwCooldown;
                }

            } else {
                // Lost tracking, revert to idle if was chasing
                if (this.state === 'chase') {
                    this.state = 'idle';
                    this.isMoving = false;
                }
            }
        }
    }

    throwWrench(target) {
        // Calculate velocity
        const startPos = this.position.clone();
        startPos.y += 1.5; // Throw from head/shoulder height

        // Lead the target slightly?
        // Simple ballistic arc for now
        const targetPos = target.position.clone();
        targetPos.y += 0.5; // Aim for body

        const disp = new THREE.Vector3().subVectors(targetPos, startPos);
        const dist = new THREE.Vector3(disp.x, 0, disp.z).length();

        // v^2 = (g * x^2) / (2 * cos^2(theta) * (tan(theta)*x - y))
        // Let's pick a fixed speed and adjust angle? Or fixed angle (45) and adjust speed?
        // Fixed angle 45 deg is easiest for max range, but might be too high arc indoors.
        // Let's try direct shot with some arc.

        const speed = 15.0; // Projectile speed
        const gravity = this.game.gravity;

        // Rough estimation: allow gravity to do its thing
        // Aim slightly higher
        disp.normalize();

        const velocity = disp.multiplyScalar(speed);
        velocity.y += dist * 0.2; // Aim up based on distance

        // Spawn Projectile
        // Spawn Projectile
        const wrench = new WrenchProjectile(this.game, startPos, velocity, this);

        // Manually add to game projectiles and scene since we don't have a generic addProjectile method
        if (this.game.projectiles) {
            this.game.projectiles.push(wrench);
            if (this.game.scene) {
                this.game.scene.add(wrench.mesh);
            }
        }

        // Arm swing animation
        if (this.armParts) {
            // Quick rotate
            this.armParts[1].rotation.x = -Math.PI / 2;
            setTimeout(() => {
                if (this.armParts && this.armParts[1]) this.armParts[1].rotation.x = 0.2;
            }, 300);
        }
    }

    attackPlayer(player) {
        // Melee override if they get too close?
        // Super class has melee logic. We can keep it as backup.
        super.attackPlayer(player);
    }
}
