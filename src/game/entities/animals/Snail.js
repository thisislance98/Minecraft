import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Snail extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.4;
        this.height = 0.4;
        this.depth = 0.5;
        this.speed = 0.3; // Snails are very slow!
        this.legSwingSpeed = 2; // Slow movement animation
        this.createBody();
        this.mesh.scale.set(0.8, 0.8, 0.8);
    }

    createBody() {
        // Snail colors
        const shellColor = 0xD2691E; // Brown shell
        const shellSpiralColor = 0x8B4513; // Darker spiral
        const bodyColor = 0xB8A090; // Pale tan/grey body
        const eyeStalkColor = 0x9A8070;

        const shellMat = new THREE.MeshLambertMaterial({ color: shellColor });
        const spiralMat = new THREE.MeshLambertMaterial({ color: shellSpiralColor });
        const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const eyeStalkMat = new THREE.MeshLambertMaterial({ color: eyeStalkColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

        // Body (Foot - elongated slug-like)
        const footGeo = new THREE.BoxGeometry(0.25, 0.12, 0.5);
        const foot = new THREE.Mesh(footGeo, bodyMat);
        foot.position.set(0, 0.08, 0);
        this.mesh.add(foot);

        // Shell base (Spiral shell on top)
        const shellBaseGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
        const shellBase = new THREE.Mesh(shellBaseGeo, shellMat);
        shellBase.position.set(0, 0.3, -0.05);
        this.mesh.add(shellBase);

        // Shell spiral detail (inner coil)
        const spiralGeo = new THREE.BoxGeometry(0.2, 0.25, 0.2);
        const spiral = new THREE.Mesh(spiralGeo, spiralMat);
        spiral.position.set(0, 0.35, -0.05);
        this.mesh.add(spiral);

        // Shell top
        const shellTopGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
        const shellTop = new THREE.Mesh(shellTopGeo, shellColor);
        shellTop.position.set(0, 0.5, -0.05);
        this.mesh.add(shellTop);

        // Head section (front of body)
        const headGeo = new THREE.BoxGeometry(0.18, 0.15, 0.12);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.set(0, 0.12, 0.28);
        this.mesh.add(head);

        // Eye stalks (tentacles)
        const eyeStalkGeo = new THREE.BoxGeometry(0.04, 0.2, 0.04);

        // Left eye stalk
        const leftStalkPivot = new THREE.Group();
        leftStalkPivot.position.set(-0.06, 0.18, 0.3);

        const leftStalk = new THREE.Mesh(eyeStalkGeo, eyeStalkMat);
        leftStalk.position.set(0, 0.1, 0);
        leftStalkPivot.add(leftStalk);

        // Left eye (on top of stalk)
        const eyeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(0, 0.22, 0);
        leftStalkPivot.add(leftEye);

        leftStalkPivot.rotation.x = -0.2; // Slight forward tilt
        this.mesh.add(leftStalkPivot);
        this.leftStalkPivot = leftStalkPivot;

        // Right eye stalk
        const rightStalkPivot = new THREE.Group();
        rightStalkPivot.position.set(0.06, 0.18, 0.3);

        const rightStalk = new THREE.Mesh(eyeStalkGeo, eyeStalkMat);
        rightStalk.position.set(0, 0.1, 0);
        rightStalkPivot.add(rightStalk);

        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0, 0.22, 0);
        rightStalkPivot.add(rightEye);

        rightStalkPivot.rotation.x = -0.2;
        this.mesh.add(rightStalkPivot);
        this.rightStalkPivot = rightStalkPivot;

        // Lower tentacles (feelers)
        const feelerGeo = new THREE.BoxGeometry(0.03, 0.08, 0.03);

        const leftFeeler = new THREE.Mesh(feelerGeo, eyeStalkMat);
        leftFeeler.position.set(-0.05, 0.08, 0.35);
        leftFeeler.rotation.x = -0.4;
        this.mesh.add(leftFeeler);

        const rightFeeler = new THREE.Mesh(feelerGeo, eyeStalkMat);
        rightFeeler.position.set(0.05, 0.08, 0.35);
        rightFeeler.rotation.x = -0.4;
        this.mesh.add(rightFeeler);

        // Snails don't have visible legs, so we use an empty array
        this.legParts = [];
    }

    updateAnimation(dt) {
        // Skip parent leg animation since snails don't have legs
        this.animTime += dt;

        // Animate eye stalks swaying gently
        if (this.leftStalkPivot && this.rightStalkPivot) {
            const sway = Math.sin(this.animTime * 2) * 0.15;
            this.leftStalkPivot.rotation.z = sway;
            this.rightStalkPivot.rotation.z = -sway;

            // Slight forward/back motion
            const bob = Math.sin(this.animTime * 1.5) * 0.1;
            this.leftStalkPivot.rotation.x = -0.2 + bob;
            this.rightStalkPivot.rotation.x = -0.2 + bob;
        }

        // Subtle body undulation for movement
        if (this.isMoving) {
            const bodyWave = Math.sin(this.animTime * 4) * 0.02;
            this.mesh.position.y = bodyWave;
        }
    }

    // Override physics to make snail movement smooth and ground-hugging
    updatePhysics(dt) {
        super.updateWalkerPhysics(dt);
    }
}
