import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Horse extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.8;
        this.height = 1.2;
        this.depth = 1.6;
        this.speed = 5.0; // Slightly faster
        this.legSwingSpeed = 12; // Dynamic movement
        this.createBody();
        this.mesh.scale.set(0.8, 0.8, 0.8);
    }

    createBody() {
        // Horse Colors
        const skinColor = 0x8B4513; // Saddle Brown
        const darkSkinColor = 0x5D2E0C;
        const maneColor = 0x2A1506;
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const hoofMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });
        const darkSkinMat = new THREE.MeshLambertMaterial({ color: darkSkinColor });

        // Main Body
        const bodyGeo = new THREE.BoxGeometry(0.85, 0.9, 1.5);
        const body = new THREE.Mesh(bodyGeo, skinMat);
        body.position.set(0, 1.1, 0);
        this.mesh.add(body);

        // Neck
        const neckPivot = new THREE.Group();
        neckPivot.position.set(0, 1.3, 0.6);
        this.mesh.add(neckPivot);

        const neckGeo = new THREE.BoxGeometry(0.4, 0.9, 0.5);
        const neck = new THREE.Mesh(neckGeo, skinMat);
        neck.position.set(0, 0.35, 0.1);
        neck.rotation.x = -Math.PI / 6;
        neckPivot.add(neck);

        // Head
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 0.8, 0.3);
        neckPivot.add(headGroup);

        const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.6);
        const head = new THREE.Mesh(headGeo, skinMat);
        headGroup.add(head);

        // Muzzle
        const muzzleGeo = new THREE.BoxGeometry(0.35, 0.35, 0.4);
        const muzzle = new THREE.Mesh(muzzleGeo, skinMat);
        muzzle.position.set(0, -0.05, 0.4);
        headGroup.add(muzzle);

        // Blaze (white stripe on face)
        const blazeGeo = new THREE.BoxGeometry(0.12, 0.46, 0.1);
        const blaze = new THREE.Mesh(blazeGeo, whiteMat);
        blaze.position.set(0, 0.05, 0.65);
        headGroup.add(blaze);

        // Nostrils
        const nostrilGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
        const leftNostril = new THREE.Mesh(nostrilGeo, blackMat);
        leftNostril.position.set(-0.1, -0.1, 0.6);
        headGroup.add(leftNostril);

        const rightNostril = new THREE.Mesh(nostrilGeo, blackMat);
        rightNostril.position.set(0.1, -0.1, 0.6);
        headGroup.add(rightNostril);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.1, 0.25, 0.05);
        const leftEar = new THREE.Mesh(earGeo, skinMat);
        leftEar.position.set(-0.15, 0.3, -0.15);
        headGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, skinMat);
        rightEar.position.set(0.15, 0.3, -0.15);
        headGroup.add(rightEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.05, 0.1, 0.1);
        const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.23, 0.1, 0.1);
        headGroup.add(leftEye);

        const leftPupil = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.06), blackMat);
        leftPupil.position.set(-0.25, 0.1, 0.12);
        headGroup.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.23, 0.1, 0.1);
        headGroup.add(rightEye);

        const rightPupil = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.06), blackMat);
        rightPupil.position.set(0.25, 0.1, 0.12);
        headGroup.add(rightPupil);

        // Mane
        const maneGeo = new THREE.BoxGeometry(0.15, 1.0, 0.2);
        const maneMat = new THREE.MeshLambertMaterial({ color: maneColor });
        const mane = new THREE.Mesh(maneGeo, maneMat);
        mane.position.set(0, 0.3, -0.2);
        mane.rotation.x = -Math.PI / 6;
        neckPivot.add(mane);

        const forelockGeo = new THREE.BoxGeometry(0.15, 0.2, 0.3);
        const forelock = new THREE.Mesh(forelockGeo, maneMat);
        forelock.position.set(0, 0.25, 0.1);
        headGroup.add(forelock);

        // Tail
        const tailPivot = new THREE.Group();
        tailPivot.position.set(0, 1.4, -0.75);
        this.mesh.add(tailPivot);

        const tailGeo = new THREE.BoxGeometry(0.15, 0.8, 0.15);
        const tail = new THREE.Mesh(tailGeo, maneMat);
        tail.position.set(0, -0.4, 0);
        tail.rotation.x = 0.2;
        tailPivot.add(tail);
        this.tailPivot = tailPivot;

        // Legs
        const legHeight = 1.0;
        const makeLeg = (x, z, hasSock = false) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 1.0, z);

            // Upper leg
            const upperLegGeo = new THREE.BoxGeometry(0.25, 0.5, 0.25);
            const upperLeg = new THREE.Mesh(upperLegGeo, skinMat);
            upperLeg.position.set(0, -0.25, 0);
            pivot.add(upperLeg);

            // Lower leg
            const lowerLegGeo = new THREE.BoxGeometry(0.2, 0.5, 0.2);
            const lowerLeg = new THREE.Mesh(lowerLegGeo, hasSock ? whiteMat : skinMat);
            lowerLeg.position.set(0, -0.65, 0);
            pivot.add(lowerLeg);

            // Hoof
            const hoofGeo = new THREE.BoxGeometry(0.25, 0.15, 0.25);
            const hoof = new THREE.Mesh(hoofGeo, hoofMat);
            hoof.position.set(0, -0.9, 0);
            pivot.add(hoof);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.3, 0.5, true),  // Front Left with sock
            makeLeg(0.3, 0.5),         // Front Right
            makeLeg(-0.3, -0.5),       // Back Left
            makeLeg(0.3, -0.5, true)   // Back Right with sock
        ];

        this.neckPivot = neckPivot;
        this.headGroup = headGroup;
    }

    updateAnimation(dt) {
        super.updateAnimation(dt);

        const time = this.animTime;

        // Idle head/neck movement
        if (this.neckPivot && this.speed < 0.1) {
            this.neckPivot.rotation.y = Math.sin(time * 0.5) * 0.1;
            this.neckPivot.rotation.x = Math.sin(time * 0.3) * 0.05;
        }

        // Tail swish
        if (this.tailPivot) {
            const swishSpeed = this.isMoving ? 10 : 2;
            const swishAmount = this.isMoving ? 0.4 : 0.2;
            this.tailPivot.rotation.z = Math.sin(time * swishSpeed) * swishAmount;
            this.tailPivot.rotation.x = 0.2 + Math.cos(time * swishSpeed * 0.5) * 0.1;
        }
    }
}
