import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Pumpkin extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.6;
        this.height = 0.6;
        this.depth = 0.6;
        this.speed = 2.0;
        this.flyHeight = 4.0;
        this.createBody();
        this.mesh.scale.set(0.8, 0.8, 0.8);

        // Flying state
        this.isFlying = true;
        this.bobOffset = Math.random() * Math.PI * 2;
    }

    createBody() {
        const orangeMat = new THREE.MeshLambertMaterial({ color: 0xFF7518 });
        const greenMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Main Body (Pumpkin shape - slightly wider/deeper than tall)
        // Central block
        const bodyGeo = new THREE.BoxGeometry(0.6, 0.5, 0.6);
        const body = new THREE.Mesh(bodyGeo, orangeMat);
        body.position.set(0, 0.4, 0);
        this.mesh.add(body);

        // Rounded sides (extra blocks to make it look less like a cube)
        // Front/Back protrusions
        const sideGeoFB = new THREE.BoxGeometry(0.5, 0.45, 0.65);
        const sideFB = new THREE.Mesh(sideGeoFB, orangeMat);
        sideFB.position.set(0, 0.4, 0);
        this.mesh.add(sideFB);

        // Left/Right protrusions
        const sideGeoLR = new THREE.BoxGeometry(0.65, 0.45, 0.5);
        const sideLR = new THREE.Mesh(sideGeoLR, orangeMat);
        sideLR.position.set(0, 0.4, 0);
        this.mesh.add(sideLR);

        // Stem
        const stemGeo = new THREE.BoxGeometry(0.1, 0.15, 0.1);
        const stem = new THREE.Mesh(stemGeo, greenMat);
        stem.position.set(0, 0.7, 0);
        // Tilt the stem slightly for realism
        stem.rotation.z = 0.2;
        stem.rotation.x = 0.1;
        this.mesh.add(stem);

        // Tiny White Wings
        const wingGeo = new THREE.BoxGeometry(0.25, 0.02, 0.15);

        this.leftWing = new THREE.Mesh(wingGeo, whiteMat);
        this.leftWing.position.set(-0.4, 0.5, 0);
        this.mesh.add(this.leftWing);

        this.rightWing = new THREE.Mesh(wingGeo, whiteMat);
        this.rightWing.position.set(0.4, 0.5, 0);
        this.mesh.add(this.rightWing);

        // Face (Jack-o-lantern style simple eyes)
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);

        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.15, 0.45, 0.32); // Slightly protruding from main body front
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.15, 0.45, 0.32);
        this.mesh.add(rightEye);
    }

    updatePhysics(dt) {
        const pos = this.position;

        // Flying movement
        this.bobOffset += dt * 3;

        // Move forward in current direction
        // Occasionally change direction
        if (Math.random() < 0.02) {
            this.rotation += (Math.random() - 0.5) * 1.5;
            this.moveDirection.set(Math.sin(this.rotation), 0, Math.cos(this.rotation));
        }

        pos.x += this.moveDirection.x * this.speed * dt;
        pos.z += this.moveDirection.z * this.speed * dt;

        // Bob up and down
        // Try to maintain height above terrain
        const terrainY = this.game.worldGen.getTerrainHeight(pos.x, pos.z);
        const targetY = terrainY + this.flyHeight + Math.sin(this.bobOffset) * 0.5;

        // Smoothly approach target height
        pos.y += (targetY - pos.y) * dt * 2;

        this.onGround = false;
    }

    updateAnimation(dt) {
        this.animTime += dt * 15; // Fast flapping for tiny wings

        const flapAngle = Math.sin(this.animTime) * 0.5;
        this.leftWing.rotation.z = flapAngle;
        this.rightWing.rotation.z = -flapAngle;
    }
}
