import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Snake extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.3;
        this.height = 0.25;
        this.depth = 1.5;
        this.speed = 2.5;

        // Snake-specific properties
        this.segments = [];
        this.slitherTime = 0;
        this.slitherSpeed = 8;
        this.slitherAmplitude = 0.15;

        this.createBody();
        this.mesh.scale.set(0.7, 0.7, 0.7);

        // Snakes flee from players
        this.fleeOnProximity = true;
        this.fleeRange = 6.0;
    }

    createBody() {
        // Snake colors - green with darker patterns
        const bodyColor = 0x228B22; // Forest green
        const patternColor = 0x006400; // Dark green
        const bellyColor = 0x9ACD32; // Yellow-green for belly
        const eyeColor = 0x000000;
        const tongueColor = 0xFF0000;

        const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const patternMat = new THREE.MeshLambertMaterial({ color: patternColor });
        const bellyMat = new THREE.MeshLambertMaterial({ color: bellyColor });
        const eyeMat = new THREE.MeshLambertMaterial({ color: eyeColor });
        const tongueMat = new THREE.MeshLambertMaterial({ color: tongueColor });

        // Create segmented body for slithering animation
        const segmentCount = 8;
        const segmentLength = 0.2;
        const segmentWidth = 0.2;

        for (let i = 0; i < segmentCount; i++) {
            const segmentGroup = new THREE.Group();

            // Main segment - slightly wider in the middle
            const widthMultiplier = 1 - Math.abs(i - segmentCount / 2) / (segmentCount / 2) * 0.3;
            const segmentGeo = new THREE.BoxGeometry(
                segmentWidth * widthMultiplier,
                0.15,
                segmentLength
            );
            const segment = new THREE.Mesh(segmentGeo, bodyMat);
            segment.position.set(0, 0.1, 0);
            segmentGroup.add(segment);

            // Pattern on top (diamond shapes)
            if (i % 2 === 0 && i > 0 && i < segmentCount - 1) {
                const patternGeo = new THREE.BoxGeometry(
                    segmentWidth * widthMultiplier * 0.6,
                    0.02,
                    segmentLength * 0.5
                );
                const pattern = new THREE.Mesh(patternGeo, patternMat);
                pattern.position.set(0, 0.18, 0);
                segmentGroup.add(pattern);
            }

            // Position segment along the body
            segmentGroup.position.set(0, 0, -i * segmentLength + segmentLength * (segmentCount / 2 - 1));

            this.mesh.add(segmentGroup);
            this.segments.push(segmentGroup);
        }

        // Head (first segment is the head - make it more distinct)
        const headGroup = new THREE.Group();

        // Head shape - triangular/rounded
        const headGeo = new THREE.BoxGeometry(0.22, 0.12, 0.25);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.set(0, 0.1, 0);
        headGroup.add(head);

        // Snout (slightly narrower front)
        const snoutGeo = new THREE.BoxGeometry(0.16, 0.1, 0.12);
        const snout = new THREE.Mesh(snoutGeo, bodyMat);
        snout.position.set(0, 0.09, 0.15);
        headGroup.add(snout);

        // Eyes - positioned on sides of head
        const eyeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1, 0.15, 0.08);
        headGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1, 0.15, 0.08);
        headGroup.add(rightEye);

        // Forked tongue
        const tongueGroup = new THREE.Group();

        const tongueBaseGeo = new THREE.BoxGeometry(0.02, 0.02, 0.15);
        const tongueBase = new THREE.Mesh(tongueBaseGeo, tongueMat);
        tongueBase.position.set(0, 0, 0.1);
        tongueGroup.add(tongueBase);

        // Forked tips
        const forkGeo = new THREE.BoxGeometry(0.015, 0.015, 0.06);

        const leftFork = new THREE.Mesh(forkGeo, tongueMat);
        leftFork.position.set(-0.02, 0, 0.19);
        leftFork.rotation.y = -0.3;
        tongueGroup.add(leftFork);

        const rightFork = new THREE.Mesh(forkGeo, tongueMat);
        rightFork.position.set(0.02, 0, 0.19);
        rightFork.rotation.y = 0.3;
        tongueGroup.add(rightFork);

        tongueGroup.position.set(0, 0.08, 0.2);
        headGroup.add(tongueGroup);
        this.tongueGroup = tongueGroup;

        // Position head at the front
        headGroup.position.set(0, 0, segmentLength * (segmentCount / 2) + 0.1);
        this.mesh.add(headGroup);
        this.headGroup = headGroup;

        // Tail (tapered end)
        const tailGroup = new THREE.Group();

        const tailGeo = new THREE.BoxGeometry(0.1, 0.08, 0.2);
        const tail = new THREE.Mesh(tailGeo, bodyMat);
        tail.position.set(0, 0.06, 0);
        tailGroup.add(tail);

        const tailTipGeo = new THREE.BoxGeometry(0.05, 0.05, 0.15);
        const tailTip = new THREE.Mesh(tailTipGeo, bodyMat);
        tailTip.position.set(0, 0.05, -0.15);
        tailGroup.add(tailTip);

        tailGroup.position.set(0, 0, -segmentLength * (segmentCount / 2) - 0.1);
        this.mesh.add(tailGroup);
        this.tailGroup = tailGroup;

        // Snakes don't have legs, so we leave legParts empty
        this.legParts = [];
    }

    updateAnimation(dt) {
        // Slithering animation - wave motion through body segments
        this.slitherTime += dt * this.slitherSpeed;

        // Animate body segments in a wave pattern
        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            const phase = i * 0.8; // Phase offset for wave
            const wave = Math.sin(this.slitherTime + phase) * this.slitherAmplitude;

            // Only slither when moving
            if (this.isMoving) {
                segment.position.x = wave;
                segment.rotation.y = Math.sin(this.slitherTime + phase) * 0.2;
            } else {
                // Subtle idle movement
                segment.position.x = Math.sin(this.slitherTime * 0.3 + phase) * this.slitherAmplitude * 0.2;
            }
        }

        // Head follows the wave
        if (this.headGroup && this.isMoving) {
            const headWave = Math.sin(this.slitherTime) * this.slitherAmplitude * 0.5;
            this.headGroup.position.x = headWave;
            this.headGroup.rotation.y = Math.sin(this.slitherTime) * 0.15;
        }

        // Tail follows with delay
        if (this.tailGroup && this.isMoving) {
            const tailPhase = this.segments.length * 0.8;
            const tailWave = Math.sin(this.slitherTime + tailPhase) * this.slitherAmplitude;
            this.tailGroup.position.x = tailWave;
            this.tailGroup.rotation.y = Math.sin(this.slitherTime + tailPhase) * 0.25;
        }

        // Tongue flicking animation
        if (this.tongueGroup) {
            const tongueFlick = Math.sin(this.slitherTime * 3) > 0.7;
            this.tongueGroup.visible = tongueFlick || Math.random() < 0.02;
            if (this.tongueGroup.visible) {
                this.tongueGroup.position.z = 0.2 + Math.sin(this.slitherTime * 10) * 0.03;
            }
        }
    }
}
