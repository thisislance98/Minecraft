import * as THREE from 'three';
import { Animal } from '../Animal.js';
import { Blocks } from '../../core/Blocks.js';

export class DuneWorm extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        // Dimensions (Giant!)
        this.width = 3.0;
        this.height = 3.0;
        this.depth = 3.0;

        // Massive health
        this.health = 500;
        this.maxHealth = 500;

        this.speed = 8.0; // Fast
        this.turnSpeed = 1.0;

        this.isHostile = true;
        this.damage = 1000; // Instakill

        // State
        this.state = 'roam_underground'; // Start buried
        this.verticalAngle = 0; // Pitch

        // Visuals
        this.bodySegments = [];
        this.segmentCount = 8;
        this.segmentSpacing = 2.5;
        this.createBody();

        // Trail / History for segments to follow
        this.positionHistory = [];
        this.maxHistory = 300; // Increased buffer size for full body bending

        // Pre-fill history to prevent "rigid tail" on spawn
        // We assume the worm spawns straight behind the head along Z
        for (let i = 0; i < this.maxHistory; i++) {
            // Simulated previous positions
            const historyPos = new THREE.Vector3(x, y, z + (i * 0.1)); // 0.1 approx speed/frame? Just need direction.
            // Actually, segments are spaced by 2.5. 
            // If we fill backwards, we ensure segments have something to latch onto.
            // Let's just fill with the current position, or a line.
            // A line is better so they don't bunch up.
            this.positionHistory.push({
                pos: new THREE.Vector3(x, y, z + (i * (this.segmentSpacing / 10))), // Spread out roughly
                rot: 0,
                pitch: 0
            });
        }
    }

    createBody() {
        // Dune color
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xC2B280 }); // Sand color
        const mouthMat = new THREE.MeshLambertMaterial({ color: 0x330000 }); // Dark void

        // HEAD
        const headGeo = new THREE.CylinderGeometry(1.5, 1.5, 3.0, 12);
        headGeo.rotateX(Math.PI / 2); // Point forward
        this.headMesh = new THREE.Mesh(headGeo, skinMat);
        this.mesh.add(this.headMesh);

        // Mouth (Open maw at front)
        const mouthGeo = new THREE.CylinderGeometry(1.2, 0.1, 1.0, 12);
        mouthGeo.rotateX(Math.PI / 2);
        const mouth = new THREE.Mesh(mouthGeo, mouthMat);
        mouth.position.set(0, 0, 1.6); // Stick out front slightly
        // Flip so the cone goes IN
        mouth.rotation.z = Math.PI;
        this.headMesh.add(mouth);

        // SEGMENTS (Independent meshes, not children of this.mesh to avoid rotation inheritance issues?)
        // Actually, for a worm, segments should trail behind. If they are children of this.mesh, they rigidly turn.
        // To make it slither, segments need to be independent meshes in the scene, OR we update their relative pos/rot every frame.
        // Let's make them children but update them manually based on history.

        for (let i = 0; i < this.segmentCount; i++) {
            const scale = 1.0 - (i / this.segmentCount) * 0.6; // Taper tail
            const segGeo = new THREE.CylinderGeometry(1.5 * scale, 1.5 * scale, 2.0, 10);
            segGeo.rotateX(Math.PI / 2);
            const seg = new THREE.Mesh(segGeo, skinMat);
            this.mesh.add(seg);
            this.bodySegments.push(seg);

            // Initial positioning behind head
            seg.position.set(0, 0, -this.segmentSpacing * (i + 1));
        }
    }

    update(dt) {
        if (this.isDead) {
            super.updateDeath(dt);
            return;
        }

        this.updateAI(dt);
        this.updatePhysics(dt);
        this.updateSegments();
        this.checkPlayerCollision();

        // Sync
        this.mesh.position.copy(this.position);

        // Rotate head mesh to match direction
        // this.mesh handles Y rotation (yaw).
        // this.headMesh can handle pitch (X rotation).
        this.headMesh.rotation.x = this.verticalAngle;

        this.checkSync();
    }

    updatePhysics(dt) {
        // Custom Worm Physics: Noclip + Gravity only when free falling

        const pos = this.position;
        const speed = this.speed;

        // Calculate direction vector from Yaw and Pitch
        const cosYaw = Math.cos(this.rotation);
        const sinYaw = Math.sin(this.rotation);
        const cosPitch = Math.cos(this.verticalAngle);
        const sinPitch = Math.sin(this.verticalAngle);

        // Direction:
        // X = sin(yaw) * cos(pitch)
        // Y = sin(pitch)
        // Z = cos(yaw) * cos(pitch)

        const dx = sinYaw * cosPitch * speed * dt;
        const dy = sinPitch * speed * dt;
        const dz = cosYaw * cosPitch * speed * dt;

        // Move
        pos.x += dx;
        pos.y += dy;
        pos.z += dz;

        // TUNNELING: Destroy blocks at head position
        // this.boreTunnel(pos.x, pos.y, pos.z);

        // Gravity?
        // If we are in air (no blocks around), apply gravity to pitch?
        // Or just let the AI steer down.
        // Let's check center block.
        const block = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
        if (!block) { // Air
            // Apply gravity to vertical angle (nose dive)
            this.verticalAngle -= 1.0 * dt;
        }

        // Clamp Pitch
        this.verticalAngle = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.verticalAngle));

        // World Bounds
        if (pos.y < -10) {
            // Force surface
            this.verticalAngle += 2.0 * dt;
        }
    }

    boreTunnel(x, y, z) {
        const radius = 2; // Radius of tunnel
        const r2 = radius * radius;

        const bx = Math.floor(x);
        const by = Math.floor(y);
        const bz = Math.floor(z);

        for (let ix = -radius; ix <= radius; ix++) {
            for (let iy = -radius; iy <= radius; iy++) {
                for (let iz = -radius; iz <= radius; iz++) {
                    if (ix * ix + iy * iy + iz * iz <= r2) {
                        const targetX = bx + ix;
                        const targetY = by + iy;
                        const targetZ = bz + iz;

                        // Don't break Bedrock
                        // Don't break Air
                        const block = this.game.getBlock(targetX, targetY, targetZ);
                        if (block && block !== 'bedrock') { // Assuming logic
                            // setBlock(x, y, z, type) -> null for air
                            this.game.setBlock(targetX, targetY, targetZ, null);
                            // Visual effects? Particles?
                        }
                    }
                }
            }
        }
        this.game.updateBlockCount(); // Batched update?
    }

    updateAI(dt) {
        const player = this.game.player;
        const distToPlayer = this.position.distanceTo(player.position);

        // Check if we're still in desert - don't leave the desert!
        const worldGen = this.game.worldGen;
        if (worldGen) {
            const currentBiome = worldGen.getBiome(this.position.x, this.position.z);
            const playerBiome = worldGen.getBiome(player.position.x, player.position.z);

            // If player is not in desert, don't chase them
            if (playerBiome !== 'DESERT') {
                // Just wander randomly within the desert instead
                this.rotation += (Math.random() - 0.5) * this.turnSpeed * dt;
                return;
            }

            // If we're about to leave the desert, turn back
            if (currentBiome !== 'DESERT') {
                // Turn around - head back towards desert
                this.rotation += Math.PI * dt; // Turn around
                return;
            }
        }

        // Turn towards player
        const dx = player.position.x - this.position.x;
        const dy = player.position.y - this.position.y;
        const dz = player.position.z - this.position.z;

        // Desired Yaw
        const targetYaw = Math.atan2(dx, dz);
        // Desired Pitch
        const horizDist = Math.sqrt(dx * dx + dz * dz);
        const targetPitch = Math.atan2(dy, horizDist);

        // Smooth Turn
        let yawDiff = targetYaw - this.rotation;
        // Normalize angle
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

        this.rotation += Math.sign(yawDiff) * Math.min(Math.abs(yawDiff), this.turnSpeed * dt);

        // Pitch smoothing
        const pitchDiff = targetPitch - this.verticalAngle;
        this.verticalAngle += Math.sign(pitchDiff) * Math.min(Math.abs(pitchDiff), this.turnSpeed * dt);

        // Hunt/Roam logic
        // If very far, maybe dive deep?
        if (distToPlayer > 50) {
            // Dive
            // this.verticalAngle = -Math.PI / 4; 
        }
    }

    updateSegments() {
        // Record history
        this.positionHistory.unshift({
            pos: this.position.clone(),
            rot: this.rotation,
            pitch: this.verticalAngle
        });

        if (this.positionHistory.length > this.maxHistory) {
            this.positionHistory.pop();
        }

        // Update segments to follow the path
        let distAccum = 0;
        let histIndex = 0;

        // We need to traverse history by distance
        // Simplified: Just grab history at interval indices? 
        // Better: Interpolate history.

        // Since speed is variable-ish, better to walk back through history points summing distance.

        // Track previous world position for segments to look at
        // Initially, the "previous" point is the head's current world position
        let prevWorldPos = this.mesh.position.clone();

        for (let i = 0; i < this.bodySegments.length; i++) {
            const seg = this.bodySegments[i];
            const targetDist = (i + 1) * this.segmentSpacing;

            // Find point in history at targetDist
            let currentDist = 0;
            let foundPos = null;

            for (let h = 0; h < this.positionHistory.length - 1; h++) {
                const p1 = this.positionHistory[h].pos;
                const p2 = this.positionHistory[h + 1].pos;
                const d = p1.distanceTo(p2);

                if (currentDist + d >= targetDist) {
                    // Interpolate
                    const remainder = targetDist - currentDist;
                    const alpha = remainder / d;
                    foundPos = new THREE.Vector3().lerpVectors(p1, p2, alpha);
                    break;
                }
                currentDist += d;
            }

            if (foundPos) {
                const localPos = foundPos.clone();
                this.mesh.worldToLocal(localPos);
                seg.position.copy(localPos);

                // Look at the previous point in the chain (World Space)
                seg.lookAt(prevWorldPos);

                // Update prevWorldPos for the next segment to look at
                prevWorldPos = foundPos;

                // Peristalsis Animation (Pulsing)
                // contract/expand based on time and segment index
                // We want a wave traveling down the body.
                const time = Date.now() * 0.003; // Simple time factor
                const wavePhase = i * 0.5;
                const pulse = Math.sin(time - wavePhase);

                // Base scale calculated in createBody was: 1.0 - (i / count) * 0.6
                const baseScale = 1.0 - (i / this.segmentCount) * 0.6;
                // Vary thickness by +/- 10%
                const dynamicScale = baseScale * (1.0 + 0.1 * pulse);

                // Cylinder geometry is rotated X 90, so local Z is length. X and Y are thickness.
                seg.scale.set(dynamicScale, dynamicScale, 1.0);
            }
        }
    }

    checkPlayerCollision() {
        const player = this.game.player;
        const dist = this.position.distanceTo(player.position);
        if (dist < 3.0) { // Mouth radius
            player.takeDamage(this.damage, 'Dune Worm');
            // Eat effect?
            console.log("Player eaten by Dune Worm!");

            // Add knockback to prevent instant double-hit kill loops if not instant kill
            // But damage is 1000, so...
        }
    }
}
