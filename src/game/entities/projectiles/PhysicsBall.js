import * as THREE from 'three';
import { Blocks } from '../../core/Blocks.js';

export class PhysicsBall {
    constructor(game, x, y, z, velocity) {
        this.game = game;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = velocity.clone();

        // Physics Properties
        this.radius = 0.2; // Small ball
        this.gravity = -20.0; // Stronger gravity for snappy feel
        this.restitution = 0.7; // Bounciness (0-1)
        this.drag = 0.99; // Air resistance
        this.friction = 0.95; // Ground rotation/slowdown
        this.isDead = false;

        // Rolling effect
        this.rotationAxis = new THREE.Vector3(1, 0, 0);
        this.rotationAngle = 0;

        // Mesh
        const geometry = new THREE.SphereGeometry(this.radius, 16, 16);
        const material = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            roughness: 0.4,
            metalness: 0.1
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.copy(this.position);

        this.game.scene.add(this.mesh);

        this.lifeTime = 10.0; // Seconds to live
    }

    update(dt) {
        if (this.isDead) return;

        this.lifeTime -= dt;
        if (this.lifeTime <= 0) {
            this.remove();
            return;
        }

        // Apply Gravity
        this.velocity.y += this.gravity * dt;

        // Apply air drag
        this.velocity.multiplyScalar(this.drag);

        // Predict next position
        const nextPos = this.position.clone().add(this.velocity.clone().multiplyScalar(dt));

        // Interaction with World (Simple Continuous Collision Detection)
        // We check if the line from current to next intersects any block

        // 1. Broad Phase: Check block at next position
        // This is a simplified physics implementation:
        // logic:
        // - Raycast/Check path for collision
        // - If collision, reflect velocity and clamp position
        // - If velocity is low and on ground, stop falling

        this.checkCollision(dt);

        // Update Mesh
        this.mesh.position.copy(this.position);

        // Rotate mesh based on velocity (Visual rolling)
        const speed = this.velocity.length();
        if (speed > 0.1) {
            // axis is perpendicular to movement and up
            const moveDir = this.velocity.clone().normalize();
            const up = new THREE.Vector3(0, 1, 0);
            const axis = new THREE.Vector3().crossVectors(up, moveDir).normalize();

            // If moving vertically, this logic breaks, but it's fine for simple balls
            if (axis.lengthSq() > 0.01) {
                const rotSpeed = speed / this.radius;
                this.mesh.rotateOnWorldAxis(axis, rotSpeed * dt);
            }
        }
    }

    checkCollision(dt) {
        // Steps to check collision
        // We will do sub-stepping or simply check separate axes to handle corners better

        const steps = 4; // Check 4 times per frame for fast moving objects
        const stepDt = dt / steps;

        for (let i = 0; i < steps; i++) {
            // Try moving X
            let attempt = this.position.clone();
            attempt.x += this.velocity.x * stepDt;
            if (this.isColliding(attempt)) {
                this.velocity.x *= -this.restitution;
                // Friction when hitting walls?
            } else {
                this.position.x = attempt.x;
            }

            // Try moving Y
            attempt = this.position.clone();
            attempt.y += this.velocity.y * stepDt;
            if (this.isColliding(attempt)) {
                // If velocity is small, snap to surface?
                if (Math.abs(this.velocity.y) < 2.0 && this.velocity.y < 0) {
                    // Stop bouncing if slow
                    this.velocity.y = 0;
                    // Snap to block top?
                    // position is center. radius is 0.2. 
                    // Ground is at floor(y).
                    // We are colliding, so we are inside.
                    // Push out.
                    this.position.y = Math.floor(attempt.y - this.radius) + 1 + this.radius;

                    // Friction applies effectively on ground
                    this.velocity.x *= this.friction;
                    this.velocity.z *= this.friction;
                } else {
                    this.velocity.y *= -this.restitution;
                }
            } else {
                this.position.y = attempt.y;
            }

            // Try moving Z
            attempt = this.position.clone();
            attempt.z += this.velocity.z * stepDt;
            if (this.isColliding(attempt)) {
                this.velocity.z *= -this.restitution;
            } else {
                this.position.z = attempt.z;
            }
        }
    }

    isColliding(pos) {
        // Simple sphere-box check against voxel world
        // Check blocks around the sphere

        const checkRange = Math.ceil(this.radius);
        const centerBlock = {
            x: Math.floor(pos.x),
            y: Math.floor(pos.y),
            z: Math.floor(pos.z)
        };

        for (let dx = -checkRange; dx <= checkRange; dx++) {
            for (let dy = -checkRange; dy <= checkRange; dy++) {
                for (let dz = -checkRange; dz <= checkRange; dz++) {
                    const bx = centerBlock.x + dx;
                    const by = centerBlock.y + dy;
                    const bz = centerBlock.z + dz;

                    const block = this.game.getBlockWorld(bx, by, bz);
                    if (block && block !== Blocks.WATER) {
                        // Check AABB vs Sphere
                        // Box min/max
                        const boxMinX = bx;
                        const boxMaxX = bx + 1;
                        const boxMinY = by;
                        const boxMaxY = by + 1;
                        const boxMinZ = bz;
                        const boxMaxZ = bz + 1;

                        // Closest point on box to sphere center
                        const closestX = Math.max(boxMinX, Math.min(pos.x, boxMaxX));
                        const closestY = Math.max(boxMinY, Math.min(pos.y, boxMaxY));
                        const closestZ = Math.max(boxMinZ, Math.min(pos.z, boxMaxZ));

                        const distanceLx = pos.x - closestX;
                        const distanceLy = pos.y - closestY;
                        const distanceLz = pos.z - closestZ;

                        const distSq = (distanceLx * distanceLx) + (distanceLy * distanceLy) + (distanceLz * distanceLz);

                        if (distSq < (this.radius * this.radius)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    remove() {
        if (this.mesh) {
            this.game.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
        }
        this.isDead = true;
    }
}
