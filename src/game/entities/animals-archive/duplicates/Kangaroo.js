import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Kangaroo extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.6;
        this.height = 1.8;
        this.depth = 0.8;
        this.speed = 5.0; // Fast when hopping
        this.jumpForce = 12; // Strong jumper
        this.canHop = true; // Kangaroos hop!

        // Unique kangaroo properties
        this.hopCooldown = 0;
        this.hopInterval = 0.6; // Time between hops

        // Flee from predators
        this.fleeOnProximity = true;
        this.fleeRange = 10.0;

        this.createBody();
    }

    createBody() {
        // Kangaroo colors - tan/brown fur
        const furColor = 0xC4A574; // Sandy tan
        const lightFurColor = 0xE0D0B0; // Lighter belly
        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const lightMat = new THREE.MeshLambertMaterial({ color: lightFurColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const noseMat = new THREE.MeshLambertMaterial({ color: 0x4A3728 }); // Dark brown nose

        // Body - Large and slightly angled
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.7, 0.7);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.9, 0);
        body.rotation.x = -0.2; // Slight forward lean
        this.mesh.add(body);

        // Belly (lighter colored front)
        const bellyGeo = new THREE.BoxGeometry(0.35, 0.5, 0.3);
        const belly = new THREE.Mesh(bellyGeo, lightMat);
        belly.position.set(0, 0.85, 0.22);
        this.mesh.add(belly);

        // Pouch detail
        const pouchGeo = new THREE.BoxGeometry(0.25, 0.2, 0.1);
        const pouch = new THREE.Mesh(pouchGeo, lightMat);
        pouch.position.set(0, 0.65, 0.32);
        this.mesh.add(pouch);

        // Head
        const headGeo = new THREE.BoxGeometry(0.35, 0.4, 0.45);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 1.5, 0.35);
        this.mesh.add(head);

        // Snout
        const snoutGeo = new THREE.BoxGeometry(0.2, 0.2, 0.25);
        const snout = new THREE.Mesh(snoutGeo, mat);
        snout.position.set(0, 1.4, 0.65);
        this.mesh.add(snout);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.1, 0.08, 0.05);
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 1.42, 0.78);
        this.mesh.add(nose);

        // Ears (Large and upright - distinctive kangaroo feature)
        const earGeo = new THREE.BoxGeometry(0.1, 0.3, 0.08);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.12, 1.8, 0.35);
        leftEar.rotation.z = -0.15;
        leftEar.rotation.x = -0.1;
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.12, 1.8, 0.35);
        rightEar.rotation.z = 0.15;
        rightEar.rotation.x = -0.1;
        this.mesh.add(rightEar);

        // Inner ears (pink)
        const earInnerMat = new THREE.MeshLambertMaterial({ color: 0xF0ACBC });
        const innerEarGeo = new THREE.BoxGeometry(0.05, 0.2, 0.04);

        const leftInnerEar = new THREE.Mesh(innerEarGeo, earInnerMat);
        leftInnerEar.position.set(-0.12, 1.8, 0.38);
        this.mesh.add(leftInnerEar);

        const rightInnerEar = new THREE.Mesh(innerEarGeo, earInnerMat);
        rightInnerEar.position.set(0.12, 1.8, 0.38);
        this.mesh.add(rightInnerEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.04);

        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.12, 1.55, 0.55);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.12, 1.55, 0.55);
        this.mesh.add(rightEye);

        // Front arms (small, held close to body)
        const armGeo = new THREE.BoxGeometry(0.1, 0.3, 0.1);

        const leftArm = new THREE.Group();
        leftArm.position.set(-0.25, 0.9, 0.2);
        const leftArmMesh = new THREE.Mesh(armGeo, mat);
        leftArmMesh.position.set(0, -0.15, 0);
        leftArm.add(leftArmMesh);
        leftArm.rotation.x = 0.3;
        this.mesh.add(leftArm);

        const rightArm = new THREE.Group();
        rightArm.position.set(0.25, 0.9, 0.2);
        const rightArmMesh = new THREE.Mesh(armGeo, mat);
        rightArmMesh.position.set(0, -0.15, 0);
        rightArm.add(rightArmMesh);
        rightArm.rotation.x = 0.3;
        this.mesh.add(rightArm);

        // Hind legs (Large and powerful - main feature)
        const thighGeo = new THREE.BoxGeometry(0.2, 0.4, 0.25);
        const calfGeo = new THREE.BoxGeometry(0.15, 0.35, 0.18);
        const footGeo = new THREE.BoxGeometry(0.12, 0.1, 0.35);

        // Left hind leg
        const leftLeg = new THREE.Group();
        leftLeg.position.set(-0.2, 0.5, -0.1);

        const leftThigh = new THREE.Mesh(thighGeo, mat);
        leftThigh.position.set(0, -0.1, 0);
        leftLeg.add(leftThigh);

        const leftCalf = new THREE.Mesh(calfGeo, mat);
        leftCalf.position.set(0, -0.4, 0.1);
        leftLeg.add(leftCalf);

        const leftFoot = new THREE.Mesh(footGeo, mat);
        leftFoot.position.set(0, -0.55, 0.15);
        leftLeg.add(leftFoot);

        this.mesh.add(leftLeg);

        // Right hind leg
        const rightLeg = new THREE.Group();
        rightLeg.position.set(0.2, 0.5, -0.1);

        const rightThigh = new THREE.Mesh(thighGeo, mat);
        rightThigh.position.set(0, -0.1, 0);
        rightLeg.add(rightThigh);

        const rightCalf = new THREE.Mesh(calfGeo, mat);
        rightCalf.position.set(0, -0.4, 0.1);
        rightLeg.add(rightCalf);

        const rightFoot = new THREE.Mesh(footGeo, mat);
        rightFoot.position.set(0, -0.55, 0.15);
        rightLeg.add(rightFoot);

        this.mesh.add(rightLeg);

        // Store leg references for animation
        this.legParts = [leftLeg, rightLeg];
        this.armParts = [leftArm, rightArm];

        // Tail (Long and thick - used for balance)
        const tailSegments = [];
        const tailBaseGeo = new THREE.BoxGeometry(0.18, 0.18, 0.3);
        const tailMidGeo = new THREE.BoxGeometry(0.15, 0.15, 0.3);
        const tailTipGeo = new THREE.BoxGeometry(0.12, 0.12, 0.25);

        const tailBase = new THREE.Mesh(tailBaseGeo, mat);
        tailBase.position.set(0, 0.5, -0.4);
        tailBase.rotation.x = 0.4;
        this.mesh.add(tailBase);
        tailSegments.push(tailBase);

        const tailMid = new THREE.Mesh(tailMidGeo, mat);
        tailMid.position.set(0, 0.35, -0.65);
        tailMid.rotation.x = 0.6;
        this.mesh.add(tailMid);
        tailSegments.push(tailMid);

        const tailTip = new THREE.Mesh(tailTipGeo, mat);
        tailTip.position.set(0, 0.15, -0.85);
        tailTip.rotation.x = 0.8;
        this.mesh.add(tailTip);
        tailSegments.push(tailTip);

        this.tailParts = tailSegments;
    }

    updateAnimation(dt) {
        this.animTime += dt;

        // Hopping animation
        if (this.isMoving && !this.onGround) {
            // In-air pose - legs tucked, tail extended
            const hopPhase = Math.sin(this.animTime * 8);

            // Legs tuck up during jump
            if (this.legParts.length >= 2) {
                this.legParts[0].rotation.x = -0.5 + hopPhase * 0.2;
                this.legParts[1].rotation.x = -0.5 + hopPhase * 0.2;
            }

            // Arms tuck in
            if (this.armParts && this.armParts.length >= 2) {
                this.armParts[0].rotation.x = 0.5 + hopPhase * 0.1;
                this.armParts[1].rotation.x = 0.5 + hopPhase * 0.1;
            }

            // Tail waves for balance
            if (this.tailParts) {
                for (let i = 0; i < this.tailParts.length; i++) {
                    this.tailParts[i].rotation.y = Math.sin(this.animTime * 6 + i * 0.3) * 0.15;
                }
            }
        } else if (this.onGround && this.isMoving) {
            // Preparing to jump pose
            if (this.legParts.length >= 2) {
                this.legParts[0].rotation.x = 0.2;
                this.legParts[1].rotation.x = 0.2;
            }
        } else {
            // Idle animation - subtle ear and tail movement
            const idleWave = Math.sin(this.animTime * 2) * 0.1;

            if (this.legParts.length >= 2) {
                this.legParts[0].rotation.x = 0;
                this.legParts[1].rotation.x = 0;
            }

            if (this.tailParts) {
                for (let i = 0; i < this.tailParts.length; i++) {
                    this.tailParts[i].rotation.y = idleWave * (i + 1) * 0.3;
                }
            }
        }
    }

    updatePhysics(dt) {
        // Kangaroo hopping mechanics
        this.hopCooldown -= dt;

        if ((this.state === 'walk' || this.state === 'flee') && this.onGround && this.hopCooldown <= 0) {
            // Perform a hop
            this.velocity.y = this.jumpForce;
            this.onGround = false;
            this.hopCooldown = this.hopInterval;

            // Fleeing kangaroos hop faster and higher
            if (this.state === 'flee') {
                this.velocity.y = this.jumpForce * 1.3;
                this.hopCooldown = this.hopInterval * 0.7;
            }
        }

        super.updatePhysics(dt);
    }
}
