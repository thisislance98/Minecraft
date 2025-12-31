import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Flamingo extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.6;
        this.height = 1.8;
        this.depth = 0.6;

        // Flamingo Pink
        this.color = 0xFC74FD;
        this.beakColor = 0xFFFFFF; // White part
        this.beakTipColor = 0x000000; // Black tip
        this.legColor = 0xF090A0; // Darker pink legs

        this.createBody();
        this.mesh.scale.set(0.8, 0.8, 0.8);
    }

    createBody() {
        const mat = new THREE.MeshLambertMaterial({ color: this.color });
        const legMat = new THREE.MeshLambertMaterial({ color: this.legColor });
        const beakMat = new THREE.MeshLambertMaterial({ color: this.beakColor });
        const beakTipMat = new THREE.MeshLambertMaterial({ color: this.beakTipColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });

        // Dimensions
        const bodyW = 0.5;
        const bodyH = 0.5;
        const bodyL = 0.8;

        // Body (Oval-ish box)
        const bodyGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyL);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 1.2, 0); // High up on legs
        this.mesh.add(body);

        // Wings (Just side panels)
        const wingGeo = new THREE.BoxGeometry(0.1, 0.3, 0.6);
        const leftWing = new THREE.Mesh(wingGeo, mat);
        leftWing.position.set(-bodyW / 2 - 0.05, 1.2, 0);
        this.mesh.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeo, mat);
        rightWing.position.set(bodyW / 2 + 0.05, 1.2, 0);
        this.mesh.add(rightWing);

        // Neck
        // Long curved neck - we'll simulate with 3 segments
        const neckW = 0.15;
        const neckSegGeo = new THREE.BoxGeometry(neckW, 0.5, neckW);

        // Neck 1 (Vertical from body)
        const neck1 = new THREE.Mesh(neckSegGeo, mat);
        neck1.position.set(0, 1.2 + bodyH / 2 + 0.25, 0.3); // Front of body
        this.mesh.add(neck1);

        // Neck 2 (Angled forward/up)
        const neck2 = new THREE.Mesh(neckSegGeo, mat);
        neck2.position.set(0, 1.7 + 0.2, 0.4);
        neck2.rotation.x = -0.5;
        this.mesh.add(neck2);

        // Neck 3 (Head Base)
        const neck3 = new THREE.Mesh(neckSegGeo, mat);
        neck3.position.set(0, 2.0, 0.6);
        neck3.rotation.x = -1.0;
        this.mesh.add(neck3);

        // Head
        const headGeo = new THREE.BoxGeometry(0.25, 0.25, 0.3);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 2.2, 0.7);
        this.mesh.add(head);

        // Beak (Curved down)
        const beakGeo1 = new THREE.BoxGeometry(0.15, 0.1, 0.2);
        const beak1 = new THREE.Mesh(beakGeo1, beakMat);
        beak1.position.set(0, 2.15, 0.95);
        beak1.rotation.x = 0.5;
        this.mesh.add(beak1);

        const beakGeo2 = new THREE.BoxGeometry(0.12, 0.1, 0.15);
        const beak2 = new THREE.Mesh(beakGeo2, beakTipMat);
        beak2.position.set(0, 2.05, 1.0);
        beak2.rotation.x = 1.0;
        this.mesh.add(beak2);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.02);
        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.13, 2.2, 0.75);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.13, 2.2, 0.75);
        this.mesh.add(rightEye);


        // Legs
        // Long thin legs
        const legW = 0.08;
        const legH = 1.2;
        const legGeo = new THREE.BoxGeometry(legW, legH, legW);

        // Left Leg
        const leftLeg = new THREE.Mesh(legGeo, legMat);
        leftLeg.position.set(-0.15, 0.6, 0);
        this.mesh.add(leftLeg);

        // Right Leg
        const rightLeg = new THREE.Mesh(legGeo, legMat);
        rightLeg.position.set(0.15, 0.6, 0);
        this.mesh.add(rightLeg);

        // Feet (Webbed-ish)
        const footGeo = new THREE.BoxGeometry(0.25, 0.05, 0.3);
        const leftFoot = new THREE.Mesh(footGeo, legMat);
        leftFoot.position.set(-0.15, 0.025, 0.05); // Flat on ground
        this.mesh.add(leftFoot);

        const rightFoot = new THREE.Mesh(footGeo, legMat);
        rightFoot.position.set(0.15, 0.025, 0.05);
        this.mesh.add(rightFoot);

        // Animation handles
        this.legParts = [leftLeg, rightLeg];
    }
}
