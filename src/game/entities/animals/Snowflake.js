import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Snowflake extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 1.0;
        this.height = 1.0;
        this.depth = 1.0;

        // Low gravity for floating effect
        this.gravity = 5.0; // Normal is 30
        this.speed = 1.5;

        // It can fly/hover? Let's make it walk but floaty.
        // Or actually fly. If I set gravity 0 and move freely...
        // Let's stick to "floaty walker" like a balloon for now to avoid complex flight AI.

        this.createBody();
    }

    createBody() {
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const iceMat = new THREE.MeshLambertMaterial({ color: 0x88CCFF }); // Light blueish

        // -- Snowflake Body (The "Core") --
        // Three intersecting flat boxes to form a 6-pointed star
        const spokeGeo = new THREE.BoxGeometry(1.2, 0.1, 0.1); // Long thin line

        const centerGroup = new THREE.Group();
        centerGroup.position.set(0, 1.0, 0); // Hover center
        this.mesh.add(centerGroup);
        this.centerGroup = centerGroup;

        // Spoke 1 (Horizontal)
        const s1 = new THREE.Mesh(spokeGeo, iceMat);
        centerGroup.add(s1);

        // Spoke 2 (Rotated 60)
        const s2 = new THREE.Mesh(spokeGeo, iceMat);
        s2.rotation.z = Math.PI / 3;
        centerGroup.add(s2);

        // Spoke 3 (Rotated 120)
        const s3 = new THREE.Mesh(spokeGeo, iceMat);
        s3.rotation.z = 2 * Math.PI / 3;
        centerGroup.add(s3);

        // Add hexagonal plate in center for solidity
        const centerPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 6), whiteMat);
        centerPlate.rotation.x = Math.PI / 2;
        centerGroup.add(centerPlate);


        // -- Cat Face (Center) --
        const faceGroup = new THREE.Group();
        faceGroup.position.set(0, 0, 0.1); // Slightly front
        centerGroup.add(faceGroup);

        // Head
        const headGeo = new THREE.BoxGeometry(0.4, 0.35, 0.3);
        const furColor = 0xFFA500; // Orange cat
        const headMat = new THREE.MeshLambertMaterial({ color: furColor });
        const head = new THREE.Mesh(headGeo, headMat);
        faceGroup.add(head);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const leftEar = new THREE.Mesh(earGeo, headMat);
        leftEar.position.set(-0.15, 0.2, 0);
        leftEar.rotation.z = 0.5;
        faceGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, headMat);
        rightEar.position.set(0.15, 0.2, 0);
        rightEar.rotation.z = -0.5;
        faceGroup.add(rightEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0x00FF00 }); // Green eyes
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1, 0.05, 0.15);
        faceGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1, 0.05, 0.15);
        faceGroup.add(rightEye);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
        const noseMat = new THREE.MeshLambertMaterial({ color: 0xFF9999 }); // Pink nose
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, -0.05, 0.16);
        faceGroup.add(nose);

        // Whiskers (Thin black lines)
        const whiskerGeo = new THREE.BoxGeometry(0.25, 0.02, 0.02);
        const whiskerMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const w1 = new THREE.Mesh(whiskerGeo, whiskerMat);
        w1.position.set(0, -0.05, 0.15);
        faceGroup.add(w1);


        // -- Human Arms --
        // Attached to the horizontal spoke of the snowflake?
        // Or just sticking out side of the center?
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xbd8b68 }); // Villager skin

        const armGeo = new THREE.BoxGeometry(0.12, 0.4, 0.12);

        // Right Arm
        const rightArmGroup = new THREE.Group();
        rightArmGroup.position.set(0.6, 0, 0); // End of spoke?
        centerGroup.add(rightArmGroup);

        const rightArm = new THREE.Mesh(armGeo, skinMat);
        rightArm.position.set(0, -0.2, 0); // Hang down
        rightArmGroup.add(rightArm);

        // Left Arm
        const leftArmGroup = new THREE.Group();
        leftArmGroup.position.set(-0.6, 0, 0);
        centerGroup.add(leftArmGroup);

        const leftArm = new THREE.Mesh(armGeo, skinMat);
        leftArm.position.set(0, -0.2, 0);
        leftArmGroup.add(leftArm);

        this.armParts = [rightArmGroup, leftArmGroup]; // For swinging animation
    }

    updateAnimation(dt) {
        // Spin the snowflake slowly?
        // this.centerGroup.rotation.z += dt * 1.0; 

        // Swing arms if moving
        if (this.isMoving) {
            this.animTime += dt * this.legSwingSpeed;

            // Swing arms
            const armAngle = Math.cos(this.animTime) * 0.5;
            this.armParts[0].rotation.x = armAngle;
            this.armParts[1].rotation.x = -armAngle;

            // Bob body
            this.centerGroup.position.y = 1.0 + Math.sin(this.animTime * 2) * 0.1;
        } else {
            // Reset arms
            this.armParts[0].rotation.x = 0;
            this.armParts[1].rotation.x = 0;
            // Idle float
            this.animTime += dt * 2.0;
            this.centerGroup.position.y = 1.0 + Math.sin(this.animTime) * 0.1;
        }
    }
}
