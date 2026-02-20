import * as THREE from 'three';
import { Animal } from '../Animal.js';

/**
 * FireSalamander - A fire-resistant lizard native to Lava World
 * Quick movements with glowing spots
 */
export class FireSalamander extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.8;
        this.height = 0.4;
        this.depth = 1.5;

        this.speed = 3.5; // Quick lizard
        this.isPassive = true;

        this.glowPhase = Math.random() * Math.PI * 2;

        this.createBody();
    }

    createBody() {
        const skinMat = new THREE.MeshLambertMaterial({ color: 0x441100 });
        const spotMat = new THREE.MeshLambertMaterial({
            color: 0xFF6600,
            emissive: 0xFF3300,
            emissiveIntensity: 0.5
        });
        const eyeMat = new THREE.MeshLambertMaterial({
            color: 0xFFFF00,
            emissive: 0xFFAA00,
            emissiveIntensity: 0.7
        });

        const bodyGroup = new THREE.Group();
        bodyGroup.position.set(0, 0.25, 0);
        this.mesh.add(bodyGroup);
        this.bodyGroup = bodyGroup;

        // Body (long lizard shape)
        const bodyGeo = new THREE.BoxGeometry(0.35, 0.2, 0.8);
        const body = new THREE.Mesh(bodyGeo, skinMat);
        bodyGroup.add(body);

        // Glowing spots on back
        this.spots = [];
        const spotGeo = new THREE.BoxGeometry(0.1, 0.08, 0.1);
        const spotPositions = [
            [0.1, 0.12, -0.2],
            [-0.1, 0.12, 0],
            [0.1, 0.12, 0.2],
            [-0.08, 0.12, 0.35],
        ];
        spotPositions.forEach(pos => {
            const spot = new THREE.Mesh(spotGeo, spotMat);
            spot.position.set(pos[0], pos[1], pos[2]);
            bodyGroup.add(spot);
            this.spots.push(spot);
        });

        // Head
        const headGeo = new THREE.BoxGeometry(0.25, 0.15, 0.25);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 0.05, -0.5);
        bodyGroup.add(head);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.06, 0.04, 0.04);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1, 0.1, -0.6);
        bodyGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1, 0.1, -0.6);
        bodyGroup.add(rightEye);

        // Tail (segmented)
        this.tailSegments = [];
        for (let i = 0; i < 4; i++) {
            const size = 0.15 - i * 0.03;
            const tailGeo = new THREE.BoxGeometry(size, size * 0.6, 0.2);
            const tail = new THREE.Mesh(tailGeo, skinMat);
            tail.position.set(0, 0, 0.5 + i * 0.18);
            bodyGroup.add(tail);
            this.tailSegments.push(tail);
        }

        // Legs
        this.legs = [];
        const legGeo = new THREE.BoxGeometry(0.08, 0.15, 0.08);
        const legPositions = [
            [-0.2, -0.15, -0.25],
            [0.2, -0.15, -0.25],
            [-0.2, -0.15, 0.25],
            [0.2, -0.15, 0.25],
        ];

        legPositions.forEach((pos, i) => {
            const legGroup = new THREE.Group();
            legGroup.position.set(pos[0], pos[1] + 0.1, pos[2]);
            bodyGroup.add(legGroup);

            const leg = new THREE.Mesh(legGeo, skinMat);
            leg.position.set(0, -0.08, 0);
            legGroup.add(leg);
            this.legs.push(legGroup);
        });
    }

    updateAnimation(dt) {
        this.glowPhase += dt * 4.0;

        // Pulse spots
        for (let i = 0; i < this.spots.length; i++) {
            const phase = this.glowPhase + i * 0.5;
            this.spots[i].material.emissiveIntensity = 0.3 + Math.sin(phase) * 0.3;
        }

        // Tail wave
        for (let i = 0; i < this.tailSegments.length; i++) {
            this.tailSegments[i].rotation.y = Math.sin(this.glowPhase * 2 + i * 0.8) * 0.3;
        }

        // Leg movement when walking
        if (this.isMoving) {
            this.animTime += dt * this.legSwingSpeed * 2;
            for (let i = 0; i < this.legs.length; i++) {
                const phase = (i % 2 === 0) ? 0 : Math.PI;
                this.legs[i].rotation.x = Math.sin(this.animTime + phase) * 0.5;
            }
        } else {
            for (let i = 0; i < this.legs.length; i++) {
                this.legs[i].rotation.x = 0;
            }
        }
    }
}
