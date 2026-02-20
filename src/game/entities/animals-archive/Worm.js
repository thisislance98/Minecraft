import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Worm extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.15;
        this.height = 0.15;
        this.depth = 0.8;
        this.speed = 1.0;

        // Worm-specific properties
        this.segments = [];
        this.slitherTime = 0;
        this.slitherSpeed = 5;
        this.slitherAmplitude = 0.08;

        this.createBody();
        // Worms are very small
        this.mesh.scale.set(0.5, 0.5, 0.5);

        // Worms are peaceful and move slowly
        this.fleeOnProximity = false;
    }

    createBody() {
        // Worm colors - pinkish/brownish
        const bodyColor = 0xD291BC; // Pinkish-lavender
        const segmentColor = 0xC08081; // Slightly darker pink/brown

        const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const segmentMat = new THREE.MeshLambertMaterial({ color: segmentColor });

        // Create segmented body
        const segmentCount = 10;
        const segmentLength = 0.15;
        const segmentWidth = 0.15;

        for (let i = 0; i < segmentCount; i++) {
            const segmentGroup = new THREE.Group();

            // Main segment
            const isClitellum = i === 3 || i === 4; // The thicker part of a worm
            const widthMultiplier = isClitellum ? 1.3 : 1.0;
            
            const segmentGeo = new THREE.BoxGeometry(
                segmentWidth * widthMultiplier,
                segmentWidth * widthMultiplier,
                segmentLength
            );
            
            const mat = isClitellum ? segmentMat : bodyMat;
            const segment = new THREE.Mesh(segmentGeo, mat);
            segment.position.set(0, segmentWidth / 2, 0);
            segmentGroup.add(segment);

            // Position segment along the body
            segmentGroup.position.set(0, 0, -i * segmentLength + segmentLength * (segmentCount / 2 - 1));

            this.mesh.add(segmentGroup);
            this.segments.push(segmentGroup);
        }

        // Head and Tail are just segments in a worm, but maybe make one end slightly rounder
        const headGeo = new THREE.BoxGeometry(0.12, 0.12, 0.1);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.set(0, 0.06, segmentLength * (segmentCount / 2) + 0.05);
        this.mesh.add(head);
        this.headPart = head;

        // Worms don't have legs
        this.legParts = [];
    }

    updateAnimation(dt) {
        // Slithering/Inchworm animation
        this.slitherTime += dt * this.slitherSpeed;

        // Animate body segments in a wave pattern (sinusoidal but also vertical for inchworm feel)
        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            const phase = i * 0.5;
            
            if (this.isMoving) {
                // Side to side slither
                segment.position.x = Math.sin(this.slitherTime + phase) * this.slitherAmplitude;
                // Vertical "inchworm" hump
                segment.position.y = Math.max(0, Math.cos(this.slitherTime + phase) * this.slitherAmplitude);
            } else {
                // Subtle idle movement
                segment.position.x = Math.sin(this.slitherTime * 0.2 + phase) * this.slitherAmplitude * 0.5;
            }
        }
        
        if (this.headPart && this.isMoving) {
            this.headPart.position.x = Math.sin(this.slitherTime) * this.slitherAmplitude;
        }
    }
}
