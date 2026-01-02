import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Guy extends Animal {
    constructor(game, x = 0, y = 0, z = 0, seed = null) {
        super(game, x, y, z, seed);
        this.width = 0.6;
        this.height = 1.8;
        this.depth = 0.6;
        this.speed = 2.0;
        this.health = 20;

        this.createBody();
    }

    createBody() {
        // Materials
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xFFCCAA }); // Skin
        const shirtMat = new THREE.MeshLambertMaterial({ color: 0x3366CC }); // Blue shirt
        const pantsMat = new THREE.MeshLambertMaterial({ color: 0x000088 }); // Dark blue pants
        const hairMat = new THREE.MeshLambertMaterial({ color: 0x3B2713 }); // Brown hair

        // -- Head Group --
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.5, 0);
        this.mesh.add(headGroup);

        // Face
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const head = new THREE.Mesh(headGeo, skinMat);
        headGroup.add(head);

        // Hair
        const hairGeo = new THREE.BoxGeometry(0.55, 0.15, 0.55);
        const hair = new THREE.Mesh(hairGeo, hairMat);
        hair.position.set(0, 0.25, 0);
        headGroup.add(hair);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const pupilGeo = new THREE.BoxGeometry(0.04, 0.04, 0.06);
        const pupilMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.12, 0, 0.25);
        headGroup.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(-0.12, 0, 0.25);
        headGroup.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.12, 0, 0.25);
        headGroup.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(0.12, 0, 0.25);
        headGroup.add(rightPupil);

        // -- Body --
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.7, 0.3);
        const body = new THREE.Mesh(bodyGeo, shirtMat);
        body.position.set(0, 0.9, 0);
        this.mesh.add(body);

        // -- Arms --
        const armGeo = new THREE.BoxGeometry(0.18, 0.7, 0.18);

        const leftArmGroup = new THREE.Group();
        leftArmGroup.position.set(-0.35, 1.25, 0);
        this.mesh.add(leftArmGroup);
        const leftArm = new THREE.Mesh(armGeo, shirtMat);
        leftArm.position.set(0, -0.35, 0);
        leftArmGroup.add(leftArm);

        const rightArmGroup = new THREE.Group();
        rightArmGroup.position.set(0.35, 1.25, 0);
        this.mesh.add(rightArmGroup);
        const rightArm = new THREE.Mesh(armGeo, shirtMat);
        rightArm.position.set(0, -0.35, 0);
        rightArmGroup.add(rightArm);

        // -- Legs --
        const legGeo = new THREE.BoxGeometry(0.2, 0.75, 0.2);

        const leftLegGroup = new THREE.Group();
        leftLegGroup.position.set(-0.15, 0.75, 0);
        this.mesh.add(leftLegGroup);
        const leftLeg = new THREE.Mesh(legGeo, pantsMat);
        leftLeg.position.set(0, -0.375, 0);
        leftLegGroup.add(leftLeg);

        const rightLegGroup = new THREE.Group();
        rightLegGroup.position.set(0.15, 0.75, 0);
        this.mesh.add(rightLegGroup);
        const rightLeg = new THREE.Mesh(legGeo, pantsMat);
        rightLeg.position.set(0, -0.375, 0);
        rightLegGroup.add(rightLeg);

        // Animation parts
        this.legParts = [leftLegGroup, rightLegGroup, leftArmGroup, rightArmGroup];
    }
}
