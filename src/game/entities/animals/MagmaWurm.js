import * as THREE from 'three';
import { Animal } from '../Animal.js';

/**
 * MagmaWurm - A segmented lava worm native to Lava World
 * Moves with undulating motion, similar to DuneWorm but with magma theme
 */
export class MagmaWurm extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 1.0;
        this.height = 0.8;
        this.depth = 4.0;

        this.speed = 1.5;
        this.isPassive = false;

        this.wavePhase = Math.random() * Math.PI * 2;

        this.createBody();
    }

    createBody() {
        const rockMat = new THREE.MeshLambertMaterial({ color: 0x221100 });
        const lavaMat = new THREE.MeshLambertMaterial({
            color: 0xFF4400,
            emissive: 0xFF2200,
            emissiveIntensity: 0.6
        });
        const eyeMat = new THREE.MeshLambertMaterial({
            color: 0xFFFF00,
            emissive: 0xFFAA00,
            emissiveIntensity: 0.8
        });

        // Create segmented body
        this.segments = [];
        const numSegments = 8;

        for (let i = 0; i < numSegments; i++) {
            const segmentGroup = new THREE.Group();
            const size = 0.5 - (i * 0.04); // Tapering

            // Main segment
            const segGeo = new THREE.BoxGeometry(size, size * 0.8, 0.4);
            const isHead = i === 0;
            const segment = new THREE.Mesh(segGeo, rockMat);
            segmentGroup.add(segment);

            // Lava veins on each segment
            if (i > 0) {
                const veinGeo = new THREE.BoxGeometry(size * 0.8, 0.05, 0.1);
                const vein = new THREE.Mesh(veinGeo, lavaMat);
                vein.position.set(0, size * 0.4, 0);
                segmentGroup.add(vein);
                segment.userData.vein = vein;
            }

            // Head features
            if (isHead) {
                // Mandibles
                const mandibleGeo = new THREE.BoxGeometry(0.15, 0.1, 0.2);
                const leftMandible = new THREE.Mesh(mandibleGeo, rockMat);
                leftMandible.position.set(-0.2, -0.1, -0.25);
                leftMandible.rotation.z = 0.3;
                segmentGroup.add(leftMandible);

                const rightMandible = new THREE.Mesh(mandibleGeo, rockMat);
                rightMandible.position.set(0.2, -0.1, -0.25);
                rightMandible.rotation.z = -0.3;
                segmentGroup.add(rightMandible);

                // Eyes
                const eyeGeo = new THREE.BoxGeometry(0.1, 0.08, 0.08);
                const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
                leftEye.position.set(-0.15, 0.2, -0.15);
                segmentGroup.add(leftEye);

                const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
                rightEye.position.set(0.15, 0.2, -0.15);
                segmentGroup.add(rightEye);
            }

            // Position segment
            segmentGroup.position.set(0, 0.5, i * 0.45);
            this.mesh.add(segmentGroup);
            this.segments.push(segmentGroup);
        }

        // Tail spike
        const tailGeo = new THREE.BoxGeometry(0.15, 0.15, 0.3);
        const tail = new THREE.Mesh(tailGeo, lavaMat);
        tail.position.set(0, 0.4, numSegments * 0.45);
        tail.rotation.x = 0.5;
        this.mesh.add(tail);
        this.tailSpike = tail;
    }

    updateAnimation(dt) {
        this.wavePhase += dt * 3.0;

        // Undulating wave motion through segments
        for (let i = 0; i < this.segments.length; i++) {
            const phase = this.wavePhase - i * 0.5;
            const waveY = Math.sin(phase) * 0.15;
            const waveX = Math.cos(phase) * 0.08;

            this.segments[i].position.y = 0.5 + waveY;
            this.segments[i].position.x = waveX;
            this.segments[i].rotation.z = waveX * 0.5;

            // Pulse lava veins
            const segMesh = this.segments[i].children[0];
            if (segMesh.userData.vein) {
                const vein = segMesh.userData.vein;
                vein.material.emissiveIntensity = 0.4 + Math.sin(phase * 1.5) * 0.3;
            }
        }

        // Tail spike glow
        this.tailSpike.material.emissiveIntensity = 0.4 + Math.sin(this.wavePhase * 2) * 0.3;
    }
}
