import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class MythicalVillager extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.8;
        this.height = 2.0;
        this.depth = 0.8;

        this.createBody();
        this.mesh.scale.set(1.0, 1.0, 1.0);

        this.speed = 1.2;
        this.health = 30;
    }

    createBody() {
        // Material definitions
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xbd8b68 }); // Villager skin
        const robeMat = new THREE.MeshLambertMaterial({ color: 0x5c3c92 }); // Royal purple robe
        const pantsMat = new THREE.MeshLambertMaterial({ color: 0x222222 }); // Dark legs
        const featherMat = new THREE.MeshLambertMaterial({ color: 0x111111 }); // Crow black
        const maneMat = new THREE.MeshLambertMaterial({ color: 0xd4a017 }); // Golden lion mane
        const hornMat = new THREE.MeshLambertMaterial({ color: 0xdddddd }); // Bone white
        const hoofMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a }); // Dark hoof

        // -- Head Group --
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.5, 0);
        this.mesh.add(headGroup);
        this.headGroup = headGroup;

        // Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const headMesh = new THREE.Mesh(headGeo, skinMat);
        headMesh.position.set(0, 0.25, 0);
        headGroup.add(headMesh);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.1, 0.15, 0.1);
        const noseMesh = new THREE.Mesh(noseGeo, skinMat);
        noseMesh.position.set(0, 0.15, 0.3);
        headGroup.add(noseMesh);

        // Eyes
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const pupilMat = new THREE.MeshLambertMaterial({ color: 0x330000 }); // Reddish tint pupil
        const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
        const pupilGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.15, 0.25, 0.26);
        headGroup.add(leftEye);
        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(-0.15, 0.25, 0.28);
        headGroup.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.15, 0.25, 0.26);
        headGroup.add(rightEye);
        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(0.15, 0.25, 0.28);
        headGroup.add(rightPupil);

        // -- Mane (Lion) --
        const maneGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const maneMesh = new THREE.Mesh(maneGeo, maneMat);
        maneMesh.position.set(0, 0.25, -0.05); // Slightly behind head center
        // Checkered/Fluffy appearance hack: scale slightly
        headGroup.add(maneMesh);

        // Front mane bib
        const maneBibGeo = new THREE.BoxGeometry(0.55, 0.4, 0.2);
        const maneBib = new THREE.Mesh(maneBibGeo, maneMat);
        maneBib.position.set(0, -0.2, 0.25);
        headGroup.add(maneBib);

        // -- Horns (Goat) --
        const hornGeo = new THREE.BoxGeometry(0.1, 0.35, 0.1);

        const leftHorn = new THREE.Mesh(hornGeo, hornMat);
        leftHorn.position.set(-0.2, 0.65, 0);
        leftHorn.rotation.z = Math.PI / 8;
        leftHorn.rotation.x = -Math.PI / 8;
        headGroup.add(leftHorn);

        const rightHorn = new THREE.Mesh(hornGeo, hornMat);
        rightHorn.position.set(0.2, 0.65, 0);
        rightHorn.rotation.z = -Math.PI / 8;
        rightHorn.rotation.x = -Math.PI / 8;
        headGroup.add(rightHorn);

        // -- Ears (Deer) --
        const earGeo = new THREE.BoxGeometry(0.2, 0.25, 0.05);

        const leftEar = new THREE.Mesh(earGeo, skinMat);
        leftEar.position.set(-0.35, 0.4, 0);
        leftEar.rotation.z = -Math.PI / 4;
        headGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, skinMat);
        rightEar.position.set(0.35, 0.4, 0);
        rightEar.rotation.z = Math.PI / 4;
        headGroup.add(rightEar);

        // -- Body --
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.7, 0.3);
        const bodyMesh = new THREE.Mesh(bodyGeo, robeMat);
        bodyMesh.position.set(0, 1.15, 0);
        this.mesh.add(bodyMesh);

        // -- Wings (Crow) --
        this.leftWingGroup = new THREE.Group();
        this.leftWingGroup.position.set(-0.25, 1.4, -0.15);
        this.mesh.add(this.leftWingGroup);

        const wingGeo = new THREE.BoxGeometry(1.2, 0.6, 0.1);
        const leftWing = new THREE.Mesh(wingGeo, featherMat);
        leftWing.position.set(-0.5, 0, 0); // Offset to pivot at shoulder
        this.leftWingGroup.add(leftWing);

        this.rightWingGroup = new THREE.Group();
        this.rightWingGroup.position.set(0.25, 1.4, -0.15);
        this.mesh.add(this.rightWingGroup);

        const rightWing = new THREE.Mesh(wingGeo, featherMat);
        rightWing.position.set(0.5, 0, 0);
        this.rightWingGroup.add(rightWing);

        // -- Tail (Lion) --
        this.tailGroup = new THREE.Group();
        this.tailGroup.position.set(0, 0.9, -0.15);
        this.mesh.add(this.tailGroup);

        const tailBaseGeo = new THREE.BoxGeometry(0.1, 0.6, 0.1);
        const tailBase = new THREE.Mesh(tailBaseGeo, maneMat);
        tailBase.position.set(0, -0.3, -0.1);
        tailBase.rotation.x = Math.PI / 6;
        this.tailGroup.add(tailBase);

        const tailTipGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const tailTip = new THREE.Mesh(tailTipGeo, maneMat); // Tuft matches mane color
        tailTip.position.set(0, -0.6, -0.25);
        this.tailGroup.add(tailTip);

        // -- Limbs --
        this.legParts = [];

        // Arms (Villager style folded or hanging? Let's do hanging for better interaction)
        const armGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);

        const leftArmPivot = new THREE.Group();
        leftArmPivot.position.set(-0.33, 1.4, 0);
        this.mesh.add(leftArmPivot);
        const leftArm = new THREE.Mesh(armGeo, robeMat);
        leftArm.position.set(0, -0.3, 0);
        leftArmPivot.add(leftArm);
        this.legParts.push(leftArmPivot);

        const rightArmPivot = new THREE.Group();
        rightArmPivot.position.set(0.33, 1.4, 0);
        this.mesh.add(rightArmPivot);
        const rightArm = new THREE.Mesh(armGeo, robeMat);
        rightArm.position.set(0, -0.3, 0);
        rightArmPivot.add(rightArm);
        this.legParts.push(rightArmPivot);

        // Legs with Hooves
        const legGeo = new THREE.BoxGeometry(0.2, 0.5, 0.2);
        const hoofGeo = new THREE.BoxGeometry(0.22, 0.15, 0.22);

        // Left Leg
        const leftLegPivot = new THREE.Group();
        leftLegPivot.position.set(-0.15, 0.8, 0);
        this.mesh.add(leftLegPivot);

        const leftLeg = new THREE.Mesh(legGeo, pantsMat);
        leftLeg.position.set(0, -0.25, 0);
        leftLegPivot.add(leftLeg);

        const leftHoof = new THREE.Mesh(hoofGeo, hoofMat);
        leftHoof.position.set(0, -0.55, 0);
        leftLegPivot.add(leftHoof);

        this.legParts.push(leftLegPivot);

        // Right Leg
        const rightLegPivot = new THREE.Group();
        rightLegPivot.position.set(0.15, 0.8, 0);
        this.mesh.add(rightLegPivot);

        const rightLeg = new THREE.Mesh(legGeo, pantsMat);
        rightLeg.position.set(0, -0.25, 0);
        rightLegPivot.add(rightLeg);

        const rightHoof = new THREE.Mesh(hoofGeo, hoofMat);
        rightHoof.position.set(0, -0.55, 0);
        rightLegPivot.add(rightHoof);

        this.legParts.push(rightLegPivot);
    }

    update(dt) {
        super.update(dt);

        // Wing animation
        if (this.leftWingGroup && this.rightWingGroup) {
            const wingSpeed = this.isMoving ? 15 : 2;
            const wingAngle = Math.sin(Date.now() * 0.005 * wingSpeed) * 0.3;
            // Crow wings flap
            this.leftWingGroup.rotation.z = wingAngle + 0.2; // Base offset
            this.rightWingGroup.rotation.z = -wingAngle - 0.2;
        }

        // Tail animation
        if (this.tailGroup) {
            const tailSpeed = this.isMoving ? 10 : 2;
            this.tailGroup.rotation.y = Math.sin(Date.now() * 0.003 * tailSpeed) * 0.2;
        }
    }
}
