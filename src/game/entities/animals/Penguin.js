import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Penguin extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.6;
        this.height = 1.0;
        this.depth = 0.6;
        this.speed = 1.5; // Walking speed (slow)
        this.swimSpeed = 4.0; // Fast in water
        this.createBody();
    }

    createBody() {
        // Penguin Colors
        const blackColor = 0x111111;
        const whiteColor = 0xFFFFFF;
        const beakColor = 0xFFA500; // Orange

        const blackMat = new THREE.MeshLambertMaterial({ color: blackColor });
        const whiteMat = new THREE.MeshLambertMaterial({ color: whiteColor });
        const beakMat = new THREE.MeshLambertMaterial({ color: beakColor });

        // Main Body (Oval-ish shape using boxes)
        // Torso
        const torsoGeo = new THREE.BoxGeometry(0.5, 0.7, 0.4);
        const torso = new THREE.Mesh(torsoGeo, blackMat);
        torso.position.set(0, 0.5, 0);
        this.mesh.add(torso);

        // White Belly
        const bellyGeo = new THREE.BoxGeometry(0.35, 0.6, 0.05);
        const belly = new THREE.Mesh(bellyGeo, whiteMat);
        belly.position.set(0, 0.5, 0.21); // Slightly in front
        this.mesh.add(belly);

        // Head
        const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
        const head = new THREE.Mesh(headGeo, blackMat);
        head.position.set(0, 0.95, 0);
        this.mesh.add(head);

        // Beak
        const beakGeo = new THREE.BoxGeometry(0.1, 0.05, 0.2);
        const beak = new THREE.Mesh(beakGeo, beakMat);
        beak.position.set(0, 0.9, 0.25);
        this.mesh.add(beak);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, whiteMat); // White sclera
        leftEye.position.set(-0.1, 1.0, 0.18);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.1, 1.0, 0.18);
        this.mesh.add(rightEye);

        const pupilGeo = new THREE.BoxGeometry(0.02, 0.02, 0.02);
        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.1, 1.0, 0.21);
        this.mesh.add(leftPupil);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.1, 1.0, 0.21);
        this.mesh.add(rightPupil);

        // Flippers (Wings)
        const flipperGeo = new THREE.BoxGeometry(0.1, 0.4, 0.15);
        const leftFlipper = new THREE.Mesh(flipperGeo, blackMat);
        leftFlipper.position.set(-0.3, 0.5, 0);
        leftFlipper.rotation.z = 0.2; // Slightly angled out
        this.mesh.add(leftFlipper);

        const rightFlipper = new THREE.Mesh(flipperGeo, blackMat);
        rightFlipper.position.set(0.3, 0.5, 0);
        rightFlipper.rotation.z = -0.2;
        this.mesh.add(rightFlipper);

        // Feet
        const footGeo = new THREE.BoxGeometry(0.15, 0.1, 0.25);

        const makeFoot = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.1, z);
            const foot = new THREE.Mesh(footGeo, beakMat);
            foot.position.set(0, -0.05, 0.05); // Offset
            pivot.add(foot);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeFoot(-0.15, 0),
            makeFoot(0.15, 0)
        ];
    }
}
