import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Gymnast extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.5;
        this.height = 1.8;
        this.depth = 0.4;
        this.speed = 4.5;
        this.jumpForce = 12;
        this.createBody();

        // Gymnast behavior
        this.performingTrick = false;
        this.currentTrick = null;
        this.trickTimer = 0;
        this.trickCooldown = 0;
        this.tricks = ['cartwheel', 'backflip', 'handstand', 'split', 'somersault'];

        // Animation state
        this.trickProgress = 0;
        this.flipRotation = 0;
        this.cartwheelRotation = 0;
    }

    createBody() {
        // Colorful leotard/uniform colors
        const skinColor = 0xFFDBB4; // Skin tone
        const leotardColor = 0xFF1493; // Hot pink leotard
        const accentColor = 0x00FFFF; // Cyan accents
        const hairColor = 0x4A2F00; // Brown hair

        const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });
        const leotardMat = new THREE.MeshLambertMaterial({ color: leotardColor });
        const accentMat = new THREE.MeshLambertMaterial({ color: accentColor });
        const hairMat = new THREE.MeshLambertMaterial({ color: hairColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });

        // Create a group for the whole body (for full-body rotations during tricks)
        this.bodyGroup = new THREE.Group();
        this.mesh.add(this.bodyGroup);

        // Head
        this.headGroup = new THREE.Group();
        this.headGroup.position.set(0, 1.55, 0);
        this.bodyGroup.add(this.headGroup);

        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const head = new THREE.Mesh(headGeo, skinMat);
        this.headGroup.add(head);

        // Hair (ponytail style)
        const hairGeo = new THREE.BoxGeometry(0.42, 0.25, 0.42);
        const hair = new THREE.Mesh(hairGeo, hairMat);
        hair.position.set(0, 0.15, 0);
        this.headGroup.add(hair);

        // Ponytail
        const ponytailGeo = new THREE.BoxGeometry(0.1, 0.3, 0.1);
        const ponytail = new THREE.Mesh(ponytailGeo, hairMat);
        ponytail.position.set(0, 0.1, -0.25);
        ponytail.rotation.x = 0.5;
        this.headGroup.add(ponytail);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);
        const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.1, 0, 0.21);
        this.headGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.1, 0, 0.21);
        this.headGroup.add(rightEye);

        const pupilGeo = new THREE.BoxGeometry(0.04, 0.04, 0.02);
        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.1, 0, 0.22);
        this.headGroup.add(leftPupil);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.1, 0, 0.22);
        this.headGroup.add(rightPupil);

        // Smile
        const smileGeo = new THREE.BoxGeometry(0.15, 0.03, 0.02);
        const smile = new THREE.Mesh(smileGeo, new THREE.MeshLambertMaterial({ color: 0xCC6666 }));
        smile.position.set(0, -0.1, 0.21);
        this.headGroup.add(smile);

        // Torso (leotard)
        this.torso = new THREE.Group();
        this.torso.position.set(0, 1.1, 0);
        this.bodyGroup.add(this.torso);

        const torsoGeo = new THREE.BoxGeometry(0.45, 0.5, 0.3);
        const torsoMesh = new THREE.Mesh(torsoGeo, leotardMat);
        this.torso.add(torsoMesh);

        // Accent stripe on leotard
        const stripeGeo = new THREE.BoxGeometry(0.46, 0.08, 0.31);
        const stripe1 = new THREE.Mesh(stripeGeo, accentMat);
        stripe1.position.set(0, 0.1, 0);
        this.torso.add(stripe1);

        const stripe2 = new THREE.Mesh(stripeGeo, accentMat);
        stripe2.position.set(0, -0.1, 0);
        this.torso.add(stripe2);

        // Hips/shorts part
        const hipsGeo = new THREE.BoxGeometry(0.4, 0.2, 0.28);
        const hips = new THREE.Mesh(hipsGeo, leotardMat);
        hips.position.set(0, -0.35, 0);
        this.torso.add(hips);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.12, 0.45, 0.12);

        this.leftArm = new THREE.Mesh(armGeo, skinMat);
        this.leftArm.position.set(-0.32, 1.1, 0);
        this.bodyGroup.add(this.leftArm);

        this.rightArm = new THREE.Mesh(armGeo, skinMat);
        this.rightArm.position.set(0.32, 1.1, 0);
        this.bodyGroup.add(this.rightArm);

        // Legs (in leotard  tights)
        const legGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);

        this.leftLeg = new THREE.Mesh(legGeo, skinMat);
        this.leftLeg.position.set(-0.12, 0.4, 0);
        this.bodyGroup.add(this.leftLeg);

        this.rightLeg = new THREE.Mesh(legGeo, skinMat);
        this.rightLeg.position.set(0.12, 0.4, 0);
        this.bodyGroup.add(this.rightLeg);

        // Feet
        const footGeo = new THREE.BoxGeometry(0.12, 0.08, 0.2);

        const leftFoot = new THREE.Mesh(footGeo, whiteMat); // White gym shoes
        leftFoot.position.set(-0.12, 0.08, 0.04);
        this.bodyGroup.add(leftFoot);

        const rightFoot = new THREE.Mesh(footGeo, whiteMat);
        rightFoot.position.set(0.12, 0.08, 0.04);
        this.bodyGroup.add(rightFoot);

        // Store for animation
        this.legParts = [this.leftLeg, this.rightLeg, this.leftArm, this.rightArm];
    }

    updateAI(dt) {
        this.trickCooldown -= dt;

        if (this.performingTrick) {
            this.trickTimer -= dt;
            if (this.trickTimer <= 0) {
                this.finishTrick();
            }
            this.isMoving = false;
            return;
        }

        // Random chance to perform a trick
        if (this.trickCooldown <= 0 && this.onGround && Math.random() < 0.03) {
            this.startTrick();
            return;
        }

        // Normal wandering behavior
        super.updateAI(dt);

        // Occasionally do a little jump while walking
        if (this.isMoving && this.onGround && Math.random() < 0.02) {
            this.velocity.y = this.jumpForce * 0.5;
            this.onGround = false;
        }
    }

    startTrick() {
        this.performingTrick = true;
        this.currentTrick = this.tricks[Math.floor(Math.random() * this.tricks.length)];
        this.trickProgress = 0;
        this.state = 'trick';

        // Set duration based on trick type
        switch (this.currentTrick) {
            case 'cartwheel':
                this.trickTimer = 1.0;
                break;
            case 'backflip':
                this.trickTimer = 0.8;
                this.velocity.y = this.jumpForce * 1.2;
                this.onGround = false;
                break;
            case 'handstand':
                this.trickTimer = 2.5;
                break;
            case 'split':
                this.trickTimer = 2.0;
                break;
            case 'somersault':
                this.trickTimer = 0.6;
                this.velocity.y = this.jumpForce * 0.8;
                this.velocity.z = Math.cos(this.rotation) * 3;
                this.velocity.x = Math.sin(this.rotation) * 3;
                this.onGround = false;
                break;
            default:
                this.trickTimer = 1.0;
        }
    }

    finishTrick() {
        this.performingTrick = false;
        this.currentTrick = null;
        this.trickCooldown = 3 + Math.random() * 5;
        this.trickProgress = 0;
        this.state = 'idle';

        // Reset body rotations
        this.bodyGroup.rotation.set(0, 0, 0);
        this.leftArm.rotation.set(0, 0, 0);
        this.rightArm.rotation.set(0, 0, 0);
        this.leftLeg.rotation.set(0, 0, 0);
        this.rightLeg.rotation.set(0, 0, 0);
    }

    updateAnimation(dt) {
        if (this.performingTrick) {
            this.animateTrick(dt);
        } else {
            // Normal walking animation
            super.updateAnimation(dt);
        }
    }

    animateTrick(dt) {
        this.trickProgress += dt;

        switch (this.currentTrick) {
            case 'cartwheel':
                // Rotate body sideways
                const cartwheelAngle = this.trickProgress * Math.PI * 2;
                this.bodyGroup.rotation.z = cartwheelAngle;
                // Move sideways during cartwheel
                this.position.x += Math.sin(this.rotation + Math.PI / 2) * 2 * dt;
                this.position.z += Math.cos(this.rotation + Math.PI / 2) * 2 * dt;
                // Arms and legs out
                this.leftArm.rotation.z = -Math.PI / 2;
                this.rightArm.rotation.z = Math.PI / 2;
                this.leftLeg.rotation.z = -0.5;
                this.rightLeg.rotation.z = 0.5;
                break;

            case 'backflip':
                // Rotate body backward
                const flipAngle = this.trickProgress * Math.PI * 2.5;
                this.bodyGroup.rotation.x = -flipAngle;
                // Tuck legs
                this.leftLeg.rotation.x = -1.5;
                this.rightLeg.rotation.x = -1.5;
                this.leftArm.rotation.x = -1;
                this.rightArm.rotation.x = -1;
                break;

            case 'handstand':
                // Invert body
                const handstandProgress = Math.min(this.trickProgress * 2, 1);
                this.bodyGroup.rotation.x = Math.PI * handstandProgress;
                // Arms down to support
                this.leftArm.rotation.z = 0.3;
                this.rightArm.rotation.z = -0.3;
                // Legs together and straight up
                this.leftLeg.rotation.x = 0;
                this.rightLeg.rotation.x = 0;
                // Slight sway
                this.bodyGroup.rotation.z = Math.sin(this.trickProgress * 3) * 0.1;
                break;

            case 'split':
                // Legs spread apart
                const splitProgress = Math.min(this.trickProgress, 1);
                this.leftLeg.rotation.z = -splitProgress * 1.5;
                this.rightLeg.rotation.z = splitProgress * 1.5;
                // Lower body
                this.bodyGroup.position.y = -0.4 * splitProgress;
                // Arms up gracefully
                this.leftArm.rotation.z = -2 + splitProgress * 0.5;
                this.rightArm.rotation.z = 2 - splitProgress * 0.5;
                this.leftArm.rotation.x = -0.5;
                this.rightArm.rotation.x = -0.5;
                break;

            case 'somersault':
                // Forward roll in air
                const rollAngle = this.trickProgress * Math.PI * 3;
                this.bodyGroup.rotation.x = rollAngle;
                // Tucked position
                this.leftLeg.rotation.x = -2;
                this.rightLeg.rotation.x = -2;
                this.leftArm.rotation.x = -1;
                this.rightArm.rotation.x = -1;
                break;
        }
    }

    updatePhysics(dt) {
        // Reset body group position after split
        if (!this.performingTrick) {
            this.bodyGroup.position.y = 0;
        }

        super.updatePhysics(dt);
    }
}
