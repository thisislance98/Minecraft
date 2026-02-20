import * as THREE from 'three';
import { Animal } from '../Animal.js';

/**
 * LavaGolem - A bipedal molten rock creature native to Lava World
 * Walks slowly and glows with inner fire
 */
export class LavaGolem extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 1.5;
        this.height = 2.5;
        this.depth = 1.2;

        this.speed = 1.2; // Slow and heavy
        this.isPassive = false;

        this.glowPhase = Math.random() * Math.PI * 2;

        this.createBody();
    }

    createBody() {
        const rockMat = new THREE.MeshLambertMaterial({ color: 0x332211 });
        const lavaMat = new THREE.MeshLambertMaterial({
            color: 0xFF6600,
            emissive: 0xFF3300,
            emissiveIntensity: 0.6
        });
        const eyeMat = new THREE.MeshLambertMaterial({
            color: 0xFFFF00,
            emissive: 0xFFAA00,
            emissiveIntensity: 0.8
        });

        // Body
        const bodyGeo = new THREE.BoxGeometry(1.0, 1.2, 0.8);
        const body = new THREE.Mesh(bodyGeo, rockMat);
        body.position.set(0, 1.8, 0);
        this.mesh.add(body);

        // Lava cracks on body
        const crackGeo = new THREE.BoxGeometry(0.9, 0.15, 0.1);
        const crack1 = new THREE.Mesh(crackGeo, lavaMat);
        crack1.position.set(0, 1.9, 0.4);
        this.mesh.add(crack1);
        this.crack1 = crack1;

        const crack2 = new THREE.Mesh(crackGeo, lavaMat);
        crack2.position.set(0, 1.5, 0.4);
        crack2.rotation.z = 0.2;
        this.mesh.add(crack2);
        this.crack2 = crack2;

        // Head
        const headGeo = new THREE.BoxGeometry(0.8, 0.7, 0.7);
        const head = new THREE.Mesh(headGeo, rockMat);
        head.position.set(0, 2.7, 0);
        this.mesh.add(head);
        this.head = head;

        // Eyes (glowing lava)
        const eyeGeo = new THREE.BoxGeometry(0.15, 0.1, 0.1);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.2, 2.8, 0.35);
        this.mesh.add(leftEye);
        this.leftEye = leftEye;

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.2, 2.8, 0.35);
        this.mesh.add(rightEye);
        this.rightEye = rightEye;

        // Arms
        const armGeo = new THREE.BoxGeometry(0.4, 1.0, 0.4);

        this.leftArm = new THREE.Group();
        this.leftArm.position.set(-0.7, 2.0, 0);
        this.mesh.add(this.leftArm);
        const leftArmMesh = new THREE.Mesh(armGeo, rockMat);
        leftArmMesh.position.set(0, -0.5, 0);
        this.leftArm.add(leftArmMesh);

        this.rightArm = new THREE.Group();
        this.rightArm.position.set(0.7, 2.0, 0);
        this.mesh.add(this.rightArm);
        const rightArmMesh = new THREE.Mesh(armGeo, rockMat);
        rightArmMesh.position.set(0, -0.5, 0);
        this.rightArm.add(rightArmMesh);

        // Fists (lava glowing)
        const fistGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
        const leftFist = new THREE.Mesh(fistGeo, lavaMat);
        leftFist.position.set(0, -1.0, 0);
        this.leftArm.add(leftFist);
        this.leftFist = leftFist;

        const rightFist = new THREE.Mesh(fistGeo, lavaMat);
        rightFist.position.set(0, -1.0, 0);
        this.rightArm.add(rightFist);
        this.rightFist = rightFist;

        // Legs
        const legGeo = new THREE.BoxGeometry(0.4, 0.8, 0.4);

        this.leftLeg = new THREE.Group();
        this.leftLeg.position.set(-0.3, 0.8, 0);
        this.mesh.add(this.leftLeg);
        const leftLegMesh = new THREE.Mesh(legGeo, rockMat);
        leftLegMesh.position.set(0, -0.4, 0);
        this.leftLeg.add(leftLegMesh);

        this.rightLeg = new THREE.Group();
        this.rightLeg.position.set(0.3, 0.8, 0);
        this.mesh.add(this.rightLeg);
        const rightLegMesh = new THREE.Mesh(legGeo, rockMat);
        rightLegMesh.position.set(0, -0.4, 0);
        this.rightLeg.add(rightLegMesh);
    }

    updateAnimation(dt) {
        this.glowPhase += dt * 2.5;

        // Pulse glow on lava parts
        const glowIntensity = 0.4 + Math.sin(this.glowPhase) * 0.3;
        this.crack1.material.emissiveIntensity = glowIntensity;
        this.crack2.material.emissiveIntensity = glowIntensity + 0.1;
        this.leftFist.material.emissiveIntensity = glowIntensity;
        this.rightFist.material.emissiveIntensity = glowIntensity;
        this.leftEye.material.emissiveIntensity = 0.6 + Math.sin(this.glowPhase * 1.5) * 0.3;
        this.rightEye.material.emissiveIntensity = 0.6 + Math.sin(this.glowPhase * 1.5) * 0.3;

        // Walking animation
        if (this.isMoving) {
            this.animTime += dt * this.legSwingSpeed * 0.8;
            const legSwing = Math.sin(this.animTime) * 0.4;
            const armSwing = Math.sin(this.animTime) * 0.3;

            this.leftLeg.rotation.x = legSwing;
            this.rightLeg.rotation.x = -legSwing;
            this.leftArm.rotation.x = -armSwing;
            this.rightArm.rotation.x = armSwing;
        } else {
            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;
            this.leftArm.rotation.x = 0;
            this.rightArm.rotation.x = 0;
        }
    }
}
