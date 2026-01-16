import * as THREE from 'three';
import { Animal } from '../Animal.js';

/**
 * PrismDragon - A small crystalline dragon native to Crystal World
 * Flies and shimmers with prismatic colors
 */
export class PrismDragon extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 2.0;
        this.height = 1.5;
        this.depth = 3.0;

        this.gravity = 0; // Flying creature
        this.speed = 3.0;
        this.isPassive = true;
        this.canFly = true;

        this.flapPhase = Math.random() * Math.PI * 2;

        this.createBody();
    }

    createBody() {
        const crystalMat = new THREE.MeshLambertMaterial({
            color: 0xDD99FF,
            transparent: true,
            opacity: 0.85
        });
        const darkCrystalMat = new THREE.MeshLambertMaterial({ color: 0x8855CC });
        const glowMat = new THREE.MeshLambertMaterial({
            color: 0xFFAAFF,
            emissive: 0xFF88FF,
            emissiveIntensity: 0.4
        });

        const bodyGroup = new THREE.Group();
        bodyGroup.position.set(0, 1.5, 0);
        this.mesh.add(bodyGroup);
        this.bodyGroup = bodyGroup;

        // Body (elongated crystal)
        const bodyGeo = new THREE.BoxGeometry(0.6, 0.5, 1.5);
        const body = new THREE.Mesh(bodyGeo, crystalMat);
        bodyGroup.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.4, 0.35, 0.5);
        const head = new THREE.Mesh(headGeo, crystalMat);
        head.position.set(0, 0.1, -0.9);
        bodyGroup.add(head);

        // Eyes (glowing)
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, glowMat);
        leftEye.position.set(-0.12, 0.15, -1.1);
        bodyGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, glowMat);
        rightEye.position.set(0.12, 0.15, -1.1);
        bodyGroup.add(rightEye);

        // Horns
        const hornGeo = new THREE.BoxGeometry(0.08, 0.25, 0.08);
        const leftHorn = new THREE.Mesh(hornGeo, darkCrystalMat);
        leftHorn.position.set(-0.15, 0.35, -0.8);
        leftHorn.rotation.z = -0.3;
        bodyGroup.add(leftHorn);

        const rightHorn = new THREE.Mesh(hornGeo, darkCrystalMat);
        rightHorn.position.set(0.15, 0.35, -0.8);
        rightHorn.rotation.z = 0.3;
        bodyGroup.add(rightHorn);

        // Tail (segmented crystal tail)
        this.tailSegments = [];
        for (let i = 0; i < 3; i++) {
            const size = 0.3 - i * 0.08;
            const tailGeo = new THREE.BoxGeometry(size, size * 0.8, 0.4);
            const tail = new THREE.Mesh(tailGeo, crystalMat);
            tail.position.set(0, -i * 0.1, 0.9 + i * 0.35);
            bodyGroup.add(tail);
            this.tailSegments.push(tail);
        }

        // Wings (crystal plates)
        this.wings = [];
        const wingGeo = new THREE.BoxGeometry(1.2, 0.05, 0.8);

        const leftWing = new THREE.Mesh(wingGeo, crystalMat);
        leftWing.position.set(-0.8, 0.2, 0);
        leftWing.rotation.z = 0.3;
        bodyGroup.add(leftWing);
        this.wings.push(leftWing);

        const rightWing = new THREE.Mesh(wingGeo, crystalMat);
        rightWing.position.set(0.8, 0.2, 0);
        rightWing.rotation.z = -0.3;
        bodyGroup.add(rightWing);
        this.wings.push(rightWing);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.12, 0.3, 0.12);
        const frontLeftLeg = new THREE.Mesh(legGeo, darkCrystalMat);
        frontLeftLeg.position.set(-0.2, -0.4, -0.4);
        bodyGroup.add(frontLeftLeg);

        const frontRightLeg = new THREE.Mesh(legGeo, darkCrystalMat);
        frontRightLeg.position.set(0.2, -0.4, -0.4);
        bodyGroup.add(frontRightLeg);

        const backLeftLeg = new THREE.Mesh(legGeo, darkCrystalMat);
        backLeftLeg.position.set(-0.2, -0.4, 0.4);
        bodyGroup.add(backLeftLeg);

        const backRightLeg = new THREE.Mesh(legGeo, darkCrystalMat);
        backRightLeg.position.set(0.2, -0.4, 0.4);
        bodyGroup.add(backRightLeg);
    }

    updateAnimation(dt) {
        this.flapPhase += dt * 8.0;

        // Wing flapping
        const flapAngle = Math.sin(this.flapPhase) * 0.5;
        this.wings[0].rotation.z = 0.3 + flapAngle;
        this.wings[1].rotation.z = -0.3 - flapAngle;

        // Tail wave
        for (let i = 0; i < this.tailSegments.length; i++) {
            this.tailSegments[i].rotation.y = Math.sin(this.flapPhase * 0.5 + i * 0.5) * 0.2;
        }

        // Gentle floating bob
        this.bodyGroup.position.y = 1.5 + Math.sin(this.flapPhase * 0.3) * 0.15;
    }

    update(dt) {
        super.update(dt);
        // Flying movement - stay aloft
        if (this.mesh.position.y < 5) {
            this.velocity.y = 2;
        }
    }
}
