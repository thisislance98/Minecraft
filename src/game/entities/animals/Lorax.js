import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Lorax extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.8;
        this.height = 1.2;
        this.depth = 0.8;
        this.speed = 2.0; // Not too fast
        this.createBody();
    }

    createBody() {
        // Lorax colors
        const bodyColor = 0xFFA500; // Orange/Yellowish
        const facialHairColor = 0xFFD700; // Yellowish Moustache/Eyebrows - wait, prompt said "green eyebrows and a beard"
        // Prompt check: "yellow creature who has green eyebrows and a beard" -> implies green beard too? 
        // "green eyebrows and a beard" -> "green (eyebrows and a beard)" or "green eyebrows" and "a (normal) beard"?
        // Most interpretations of "Lorax" are yellow moustache/eyebrows. 
        // BUT the prompt explicitly says "green eyebrows and a beard". 
        // I will follow the prompt explicitly: Green eyebrows, Green beard. Yellow body.

        const promptBodyColor = 0xFFFF00; // Yellow
        const promptHairColor = 0x00FF00; // Green

        const mat = new THREE.MeshLambertMaterial({ color: promptBodyColor });
        const hairMat = new THREE.MeshLambertMaterial({ color: promptHairColor });
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const pupilMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body (Stout, oval-ish)
        const bodyGeo = new THREE.CapsuleGeometry(0.4, 0.6, 4, 8);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.9, 0);
        this.mesh.add(body);

        // Head is kind of integrated, but let's add a head shape on top to define it more
        // Actually capsule covers it well.

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.12, 8, 8);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.15, 1.25, 0.35);
        body.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.15, 1.25, 0.35);
        body.add(rightEye);

        // Pupils
        const pupilGeo = new THREE.SphereGeometry(0.05, 8, 8);
        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(0, 0, 0.1);
        leftEye.add(leftPupil);

        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(0, 0, 0.1);
        rightEye.add(rightPupil);

        // Eyebrows (Green per prompt)
        const browGeo = new THREE.BoxGeometry(0.25, 0.08, 0.05);
        const leftBrow = new THREE.Mesh(browGeo, hairMat);
        leftBrow.position.set(-0.15, 0.15, 0);
        leftEye.add(leftBrow);
        leftBrow.rotation.z = 0.2;

        const rightBrow = new THREE.Mesh(browGeo, hairMat);
        rightBrow.position.set(0.15, 0.15, 0);
        rightEye.add(rightBrow);
        rightBrow.rotation.z = -0.2;

        // Beard (Green per prompt)
        // Big bushy beard
        const beardGeo = new THREE.BoxGeometry(0.6, 0.4, 0.2);
        // Make it a bit irregular if we can, or just a box for now.
        // Let's use a group of boxes for fluffiness
        const beardGroup = new THREE.Group();
        beardGroup.position.set(0, 1.0, 0.4);
        this.mesh.add(beardGroup);

        const beardCenter = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), hairMat);
        beardGroup.add(beardCenter);

        const beardL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.1), hairMat);
        beardL.position.set(-0.25, -0.05, -0.05);
        beardL.rotation.z = 0.2;
        beardGroup.add(beardL);

        const beardR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.1), hairMat);
        beardR.position.set(0.25, -0.05, -0.05);
        beardR.rotation.z = -0.2;
        beardGroup.add(beardR);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15);
        const leftArm = new THREE.Mesh(armGeo, mat);
        leftArm.position.set(-0.45, 1.0, 0);
        leftArm.rotation.z = 0.2;
        this.mesh.add(leftArm);

        const rightArm = new THREE.Mesh(armGeo, mat);
        rightArm.position.set(0.45, 1.0, 0);
        rightArm.rotation.z = -0.2;
        this.mesh.add(rightArm);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);

        const legL = new THREE.Mesh(legGeo, mat);
        legL.position.set(-0.15, 0.2, 0);

        const legR = new THREE.Mesh(legGeo, mat);
        legR.position.set(0.15, 0.2, 0);

        // Pivot groups for animation
        const leftLegGroup = new THREE.Group();
        leftLegGroup.add(legL);
        this.mesh.add(leftLegGroup);

        const rightLegGroup = new THREE.Group();
        rightLegGroup.add(legR);
        this.mesh.add(rightLegGroup);

        this.legParts = [leftLegGroup, rightLegGroup];
    }
}
