import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Pegasus extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.8;
        this.height = 1.2;
        this.depth = 1.6;
        this.speed = 4.5;
        this.legSwingSpeed = 10;
        
        // Group for all body parts to allow floating effect
        this.bodyGroup = new THREE.Group();
        this.mesh.add(this.bodyGroup);

        this.createBody();
        this.mesh.scale.set(0.85, 0.85, 0.85);

        // Flight properties
        this.gravity = 0;
        this.targetAltitude = y + 15;
        this.flySpeed = 5;
        this.targetX = x;
        this.targetZ = z;
    }

    createBody() {
        const skinColor = 0xFFFFFF; 
        const wingColor = 0xF0F8FF; 
        const hoofColor = 0xDAA520; 
        const eyeColor = 0xADD8E6; 
        const pupilColor = 0x00008B; 
        const maneColor = 0xFFFDD0; 

        const mat = new THREE.MeshLambertMaterial({ color: skinColor });
        const wingMat = new THREE.MeshLambertMaterial({ color: wingColor, transparent: true, opacity: 0.9 });
        const hoofMat = new THREE.MeshLambertMaterial({ color: hoofColor });
        const eyeMat = new THREE.MeshLambertMaterial({ color: eyeColor });
        const pupilMat = new THREE.MeshLambertMaterial({ color: pupilColor });
        const maneMat = new THREE.MeshLambertMaterial({ color: maneColor });

        const bodyGeo = new THREE.BoxGeometry(0.9, 0.8, 1.4);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 1.1, 0);
        this.bodyGroup.add(body);

        const neckGeo = new THREE.BoxGeometry(0.4, 0.8, 0.4);
        const neck = new THREE.Mesh(neckGeo, mat);
        neck.position.set(0, 1.6, 0.7);
        neck.rotation.x = Math.PI / 4;
        this.bodyGroup.add(neck);

        const headGeo = new THREE.BoxGeometry(0.55, 0.55, 1.0);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 2.0, 1.2);
        head.rotation.x = Math.PI / 8;
        this.bodyGroup.add(head);

        const earGeo = new THREE.BoxGeometry(0.12, 0.22, 0.1);
        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.2, 2.4, 0.9);
        leftEar.rotation.x = Math.PI / 8;
        this.bodyGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.2, 2.4, 0.9);
        rightEar.rotation.x = Math.PI / 8;
        this.bodyGroup.add(rightEar);

        const eyeGeo = new THREE.BoxGeometry(0.1, 0.14, 0.14);
        const pupilGeo = new THREE.BoxGeometry(0.05, 0.09, 0.09);

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.28, 2.1, 1.4);
        this.bodyGroup.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(-0.31, 2.1, 1.45);
        this.bodyGroup.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.28, 2.1, 1.4);
        this.bodyGroup.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(0.31, 2.1, 1.45);
        this.bodyGroup.add(rightPupil);

        const maneGeo = new THREE.BoxGeometry(0.15, 0.6, 0.3);
        const mane = new THREE.Mesh(maneGeo, maneMat);
        mane.position.set(0, 1.8, 0.6);
        mane.rotation.x = Math.PI / 4;
        this.bodyGroup.add(mane);

        const headManeGeo = new THREE.BoxGeometry(0.12, 0.25, 0.45);
        const headMane = new THREE.Mesh(headManeGeo, maneMat);
        headMane.position.set(0, 2.35, 1.1);
        this.bodyGroup.add(headMane);

        const tailPivot = new THREE.Group();
        tailPivot.position.set(0, 1.4, -0.7);
        const tailGeo = new THREE.BoxGeometry(0.15, 0.8, 0.2);
        const tail = new THREE.Mesh(tailGeo, maneMat);
        tail.position.set(0, -0.4, 0);
        tailPivot.add(tail);
        tailPivot.rotation.x = 0.4;
        this.bodyGroup.add(tailPivot);
        this.tailPivot = tailPivot;

        const legGeo = new THREE.BoxGeometry(0.3, 0.9, 0.3);
        const hoofPartGeo = new THREE.BoxGeometry(0.32, 0.15, 0.32);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.9, z);
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.45, 0);
            pivot.add(leg);
            const hoof = new THREE.Mesh(hoofPartGeo, hoofMat);
            hoof.position.set(0, -0.85, 0);
            pivot.add(hoof);
            this.bodyGroup.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.3, 0.5),
            makeLeg(0.3, 0.5),
            makeLeg(-0.3, -0.5),
            makeLeg(0.3, -0.5)
        ];

        this.leftWingPivot = new THREE.Group();
        this.leftWingPivot.position.set(-0.45, 1.4, 0);
        this.bodyGroup.add(this.leftWingPivot);

        const wingShape = new THREE.BoxGeometry(1.5, 0.1, 0.8);
        const leftWing = new THREE.Mesh(wingShape, wingMat);
        leftWing.position.set(-0.75, 0, 0);
        this.leftWingPivot.add(leftWing);

        for (let i = 0; i < 3; i++) {
            const feather = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.6), wingMat);
            feather.position.set(-1.0 + i * 0.2, -0.05, -0.2 - i * 0.1);
            feather.rotation.z = -0.2;
            this.leftWingPivot.add(feather);
        }

        this.rightWingPivot = new THREE.Group();
        this.rightWingPivot.position.set(0.45, 1.4, 0);
        this.bodyGroup.add(this.rightWingPivot);

        const rightWing = new THREE.Mesh(wingShape, wingMat);
        rightWing.position.set(0.75, 0, 0);
        this.rightWingPivot.add(rightWing);

        for (let i = 0; i < 3; i++) {
            const feather = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.6), wingMat);
            feather.position.set(1.0 - i * 0.2, -0.05, -0.2 - i * 0.1);
            feather.rotation.z = 0.2;
            this.rightWingPivot.add(feather);
        }
    }

    updateAI(dt) {
        if (this.stateTimer <= 0) {
            this.stateTimer = this.rng.next() * 5 + 5;
            const angle = this.rng.next() * Math.PI * 2;
            const dist = this.rng.next() * 30;
            this.targetX = this.position.x + Math.cos(angle) * dist;
            this.targetZ = this.position.z + Math.sin(angle) * dist;
            this.targetAltitude = 15 + (this.rng.next() * 15);
        }

        const target = new THREE.Vector3(this.targetX, this.targetAltitude, this.targetZ);
        const dir = target.clone().sub(this.position);
        const distToTarget = dir.length();

        if (distToTarget > 0.5) {
            dir.normalize();
            const lerpFactor = 0.05;
            this.velocity.x += (dir.x * this.flySpeed - this.velocity.x) * lerpFactor;
            this.velocity.y += (dir.y * this.flySpeed - this.velocity.y) * lerpFactor;
            this.velocity.z += (dir.z * this.flySpeed - this.velocity.z) * lerpFactor;
            this.isMoving = true;
            
            const targetRotation = Math.atan2(this.velocity.x, this.velocity.z);
            let diff = targetRotation - this.rotation;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.rotation += diff * 0.1;
        } else {
            this.isMoving = false;
            this.velocity.multiplyScalar(0.95);
        }

        this.stateTimer -= dt;
    }

    updatePhysics(dt) {
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.position.z += this.velocity.z * dt;

        const floorY = this.game.getWorldHeight ? this.game.getWorldHeight(this.position.x, this.position.z) : 0;
        if (this.position.y < floorY + 1) {
            this.position.y = floorY + 1;
            this.velocity.y = Math.max(0, this.velocity.y);
        }
    }

    updateAnimation(dt) {
        super.updateAnimation(dt);

        if (this.tailPivot) {
            this.tailPivot.rotation.z = Math.sin(this.animTime * 0.5) * 0.2;
        }

        if (this.leftWingPivot && this.rightWingPivot) {
            const flapSpeed = 10;
            const flapAngle = Math.sin(this.animTime * flapSpeed) * 0.4;
            this.leftWingPivot.rotation.z = flapAngle;
            this.rightWingPivot.rotation.z = -flapAngle;
            this.bodyGroup.position.y = Math.abs(Math.sin(this.animTime * flapSpeed)) * 0.2;
        }

        if (this.bodyGroup) {
            const horizontalVel = new THREE.Vector2(this.velocity.x, this.velocity.z).length();
            const pitch = -Math.atan2(this.velocity.y, horizontalVel + 0.1);
            this.bodyGroup.rotation.x = pitch * 0.5;
        }
        
        // Tuck legs slightly when flying
        this.legParts.forEach((leg, i) => {
            leg.rotation.x = 0.5;
        });
    }
}
