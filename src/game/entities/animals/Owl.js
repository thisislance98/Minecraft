import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Owl extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.4;
        this.height = 0.6;
        this.depth = 0.4;
        this.speed = 2.0;

        // Owls are nocturnal - slower during day
        this.isNocturnal = true;

        // Head rotation for the classic owl look
        this.headRotation = 0;
        this.headRotationTarget = 0;
        this.headRotationSpeed = 3.0;

        // Wing flapping
        this.wingFlapPhase = 0;
        this.isFlying = false;

        this.createBody();
        this.mesh.scale.set(0.9, 0.9, 0.9);
    }

    createBody() {
        // Owl colors - brown/tan with white face
        const bodyColor = 0x8B4513; // Saddle brown
        const faceColor = 0xFAF0E6; // Linen (cream/white)
        const eyeColor = 0xFFD700; // Golden yellow
        const pupilColor = 0x111111; // Black
        const beakColor = 0x4A4A4A; // Dark gray
        const featherColor = 0x654321; // Dark brown

        const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const faceMat = new THREE.MeshLambertMaterial({ color: faceColor });
        const eyeMat = new THREE.MeshLambertMaterial({ color: eyeColor });
        const pupilMat = new THREE.MeshLambertMaterial({ color: pupilColor });
        const beakMat = new THREE.MeshLambertMaterial({ color: beakColor });
        const featherMat = new THREE.MeshLambertMaterial({ color: featherColor });

        // Body - round/plump owl body
        const bodyGeo = new THREE.BoxGeometry(0.35, 0.4, 0.3);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0.3, 0);
        this.mesh.add(body);

        // Chest feathers (lighter)
        const chestGeo = new THREE.BoxGeometry(0.28, 0.25, 0.15);
        const chest = new THREE.Mesh(chestGeo, faceMat);
        chest.position.set(0, 0.28, 0.12);
        this.mesh.add(chest);

        // Head group (for rotation)
        this.headGroup = new THREE.Group();
        this.headGroup.position.set(0, 0.65, 0);
        this.mesh.add(this.headGroup);

        // Head
        const headGeo = new THREE.BoxGeometry(0.35, 0.3, 0.3);
        const head = new THREE.Mesh(headGeo, bodyMat);
        this.headGroup.add(head);

        // Face disc (the round white face characteristic of owls)
        const faceDiscGeo = new THREE.BoxGeometry(0.32, 0.28, 0.1);
        const faceDisc = new THREE.Mesh(faceDiscGeo, faceMat);
        faceDisc.position.set(0, 0, 0.12);
        this.headGroup.add(faceDisc);

        // Large eyes (characteristic owl eyes)
        const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.08, 0.03, 0.18);
        this.headGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.08, 0.03, 0.18);
        this.headGroup.add(rightEye);

        // Pupils
        const pupilGeo = new THREE.BoxGeometry(0.06, 0.08, 0.03);

        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(-0.08, 0.03, 0.21);
        this.headGroup.add(leftPupil);

        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(0.08, 0.03, 0.21);
        this.headGroup.add(rightPupil);

        // Beak
        const beakGeo = new THREE.BoxGeometry(0.08, 0.08, 0.1);
        const beak = new THREE.Mesh(beakGeo, beakMat);
        beak.position.set(0, -0.06, 0.18);
        this.headGroup.add(beak);

        // Ear tufts (like a great horned owl)
        const tuftGeo = new THREE.BoxGeometry(0.06, 0.12, 0.06);

        const leftTuft = new THREE.Mesh(tuftGeo, featherMat);
        leftTuft.position.set(-0.12, 0.18, 0);
        leftTuft.rotation.z = 0.2;
        this.headGroup.add(leftTuft);

        const rightTuft = new THREE.Mesh(tuftGeo, featherMat);
        rightTuft.position.set(0.12, 0.18, 0);
        rightTuft.rotation.z = -0.2;
        this.headGroup.add(rightTuft);

        // Wings
        const wingGeo = new THREE.BoxGeometry(0.08, 0.3, 0.25);

        this.leftWingPivot = new THREE.Group();
        this.leftWingPivot.position.set(-0.2, 0.35, 0);
        const leftWing = new THREE.Mesh(wingGeo, featherMat);
        leftWing.position.set(-0.04, -0.05, 0);
        this.leftWingPivot.add(leftWing);
        this.mesh.add(this.leftWingPivot);

        this.rightWingPivot = new THREE.Group();
        this.rightWingPivot.position.set(0.2, 0.35, 0);
        const rightWing = new THREE.Mesh(wingGeo, featherMat);
        rightWing.position.set(0.04, -0.05, 0);
        this.rightWingPivot.add(rightWing);
        this.mesh.add(this.rightWingPivot);

        // Tail feathers
        const tailGeo = new THREE.BoxGeometry(0.2, 0.15, 0.08);
        const tail = new THREE.Mesh(tailGeo, featherMat);
        tail.position.set(0, 0.2, -0.18);
        tail.rotation.x = 0.3;
        this.mesh.add(tail);

        // Feet/Talons
        const footGeo = new THREE.BoxGeometry(0.12, 0.06, 0.15);

        const leftFoot = new THREE.Mesh(footGeo, beakMat);
        leftFoot.position.set(-0.08, 0.03, 0.05);
        this.mesh.add(leftFoot);

        const rightFoot = new THREE.Mesh(footGeo, beakMat);
        rightFoot.position.set(0.08, 0.03, 0.05);
        this.mesh.add(rightFoot);
    }

    updateAI(dt) {
        // Owls occasionally turn their heads to look around
        if (Math.random() < 0.01) {
            // Classic owl head rotation - can turn up to 270 degrees!
            this.headRotationTarget = (Math.random() - 0.5) * Math.PI * 1.5;
        }

        // Nocturnal behavior - more active at night
        if (this.game.dayNightCycle) {
            const isNight = this.game.dayNightCycle.isNight;
            if (isNight) {
                // More active at night
                if (this.state === 'idle' && Math.random() < 0.02) {
                    this.state = 'walk';
                    this.stateTimer = 3 + Math.random() * 3;
                    this.rotation = Math.random() * Math.PI * 2;
                    this.moveDirection.set(Math.sin(this.rotation), 0, Math.cos(this.rotation));
                    this.isMoving = true;
                }
            } else {
                // Mostly idle during day
                if (this.state === 'walk' && Math.random() < 0.05) {
                    this.state = 'idle';
                    this.stateTimer = 5 + Math.random() * 5;
                    this.isMoving = false;
                }
            }
        }

        super.updateAI(dt);
    }

    updateAnimation(dt) {
        super.updateAnimation(dt);

        // Smooth head rotation
        const headDiff = this.headRotationTarget - this.headRotation;
        this.headRotation += headDiff * this.headRotationSpeed * dt;

        if (this.headGroup) {
            this.headGroup.rotation.y = this.headRotation;
        }

        // Wing flapping when moving
        if (this.isMoving && this.leftWingPivot && this.rightWingPivot) {
            this.wingFlapPhase += dt * 8;
            const flapAngle = Math.sin(this.wingFlapPhase) * 0.3;
            this.leftWingPivot.rotation.z = flapAngle;
            this.rightWingPivot.rotation.z = -flapAngle;
        } else {
            // Wings at rest
            if (this.leftWingPivot) this.leftWingPivot.rotation.z = 0;
            if (this.rightWingPivot) this.rightWingPivot.rotation.z = 0;
        }
    }
}
