import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class SegmentedWorm extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        // Dimensions
        this.width = 0.4;
        this.height = 0.4;
        this.depth = 1.5;
        this.speed = 1.5;

        // Visual properties
        this.bodySegments = [];
        this.segmentCount = 12;
        this.segmentSpacing = 0.25;

        // Movement tracking
        this.positionHistory = [];
        this.maxHistory = 100;

        // Initialize history with current position to prevent initial bunching
        for (let i = 0; i < this.maxHistory; i++) {
            this.positionHistory.push({
                pos: new THREE.Vector3(x, y, z - (i * 0.05)), // Trail behind
                rot: 0
            });
        }

        this.createBody();
    }

    createBody() {
        const mat = new THREE.MeshLambertMaterial({ color: 0xFFB7C5 }); // Pinkish
        const clitellumMat = new THREE.MeshLambertMaterial({ color: 0xE0A6B4 }); // Darker pink

        // Create head (invisible marker for logic, or the first segment)
        // We actually want the head to be the main mesh's visual anchor, but for segmented movement, 
        // the "head" mesh should probably be fixed to the entity local origin, 
        // and the tail segments trail behind.

        const headGeo = new THREE.SphereGeometry(0.2, 8, 8);
        this.headMesh = new THREE.Mesh(headGeo, mat);
        this.headMesh.position.set(0, 0.2, 0);
        this.mesh.add(this.headMesh);

        // Create trailing segments
        for (let i = 0; i < this.segmentCount; i++) {
            // Taper effect: smaller at the end
            const taper = 1.0 - (i / this.segmentCount) * 0.5;
            const radius = 0.15 * taper;

            // The "clitellum" (saddle) is typically near the head segments 3-5
            const isClitellum = (i >= 2 && i <= 4);
            const useMat = isClitellum ? clitellumMat : mat;
            const useRadius = isClitellum ? radius * 1.2 : radius;

            const geo = new THREE.SphereGeometry(useRadius, 8, 8);
            const seg = new THREE.Mesh(geo, useMat);

            // Segments are children of the main mesh group
            // We will manually update their positions relative to the group
            this.mesh.add(seg);
            this.bodySegments.push(seg);

            // Initial placement (behind head)
            seg.position.set(0, 0.2, -this.segmentSpacing * (i + 1));
        }
    }

    update(dt) {
        super.update(dt);
        this.updateSegments(dt);
    }

    updateSegments(dt) {
        // 1. Record History
        // Push logic state (World Position)
        this.positionHistory.unshift({
            pos: this.mesh.position.clone(),
            rot: this.mesh.rotation.y
        });

        // Prune history
        if (this.positionHistory.length > this.maxHistory) {
            this.positionHistory.pop();
        }

        // 2. Update Segment Positions
        let prevWorldPos = this.mesh.position.clone(); // The point the first segment looks at (the head/origin)

        for (let i = 0; i < this.bodySegments.length; i++) {
            const seg = this.bodySegments[i];
            const targetDist = (i + 1) * this.segmentSpacing;

            // Find the point in history that is 'targetDist' away from current head
            // We walk back through history accumulating distance
            let currentDist = 0;
            let foundPos = null;

            // Start searching from head (index 0) backwards
            for (let h = 0; h < this.positionHistory.length - 1; h++) {
                const p1 = this.positionHistory[h].pos;
                const p2 = this.positionHistory[h + 1].pos;
                const d = p1.distanceTo(p2);

                if (currentDist + d >= targetDist) {
                    // Interpolate between p1 and p2
                    const remainder = targetDist - currentDist;
                    const alpha = remainder / d;
                    foundPos = new THREE.Vector3().lerpVectors(p1, p2, alpha);
                    break;
                }
                currentDist += d;
            }

            if (foundPos) {
                // Convert World Position to Local Position for the child mesh
                const localPos = foundPos.clone();
                this.mesh.worldToLocal(localPos);

                // Add a small sinusoudal wiggle for "life"
                const time = Date.now() * 0.005;
                const wiggle = Math.sin(time + i * 0.5) * 0.05 * (this.isMoving ? 1 : 0.2);
                localPos.x += wiggle;

                seg.position.copy(localPos);

                // Optional: Make segment look at the one before it to align smoothly
                // We must do this in world space roughly, or calculate local rotation
                // Simpler approach: Just position it. Spheres don't need rotation.
                // If using cylinders/boxes, we'd need lookAt.
            }
        }
    }
}
