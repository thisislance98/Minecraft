import * as THREE from 'three';
import { Animal } from '../Animal.js';

/**
 * Pugasus - A mythical chimera creature with:
 * - Pug's flat face with big eyes
 * - Chihuahua's curled tail
 * - Wiener dog (dachshund) elongated body
 * - Lion's majestic mane
 * - Hooves (like a horse/deer)
 * - Horns (like a goat)
 */
export class Pugasus extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.6;
        this.height = 0.8;
        this.depth = 1.4; // Long like a dachshund
        this.speed = 3.0;
        this.jumpForce = 12; // Can hop around
        this.createBody();
        this.mesh.scale.set(0.9, 0.9, 0.9);
    }

    createBody() {
        // Color palette
        const bodyColor = 0xD4A574; // Tan/fawn (pug-like)
        const maneColor = 0xC17A37; // Golden brown mane
        const hoofColor = 0x2F2F2F; // Dark hooves
        const hornColor = 0x8D6E63; // Brownish horns
        const noseColor = 0x1a1a1a; // Black nose
        const eyeWhite = 0xFFFFFF;
        const eyeBlack = 0x000000;

        const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const maneMat = new THREE.MeshLambertMaterial({ color: maneColor });
        const hoofMat = new THREE.MeshLambertMaterial({ color: hoofColor });
        const hornMat = new THREE.MeshLambertMaterial({ color: hornColor });
        const noseMat = new THREE.MeshLambertMaterial({ color: noseColor });
        const whiteMat = new THREE.MeshLambertMaterial({ color: eyeWhite });
        const blackMat = new THREE.MeshLambertMaterial({ color: eyeBlack });

        // ===== DACHSHUND-STYLE ELONGATED BODY =====
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.45, 1.4);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0.55, 0);
        this.mesh.add(body);

        // ===== PUG-STYLE FLAT FACE =====
        // Head - round and flat-faced like a pug
        const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.35);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.set(0, 0.85, 0.75);
        this.mesh.add(head);

        // Flat pug snout/muzzle
        const snoutGeo = new THREE.BoxGeometry(0.3, 0.2, 0.12);
        const snout = new THREE.Mesh(snoutGeo, bodyMat);
        snout.position.set(0, 0.78, 0.92);
        this.mesh.add(snout);

        // Big black pug nose
        const noseGeo = new THREE.BoxGeometry(0.15, 0.1, 0.08);
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 0.82, 0.98);
        this.mesh.add(nose);

        // Big bulging pug eyes
        const eyeGeo = new THREE.BoxGeometry(0.12, 0.14, 0.08);
        const pupilGeo = new THREE.BoxGeometry(0.08, 0.1, 0.09);

        // Left eye
        const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.14, 0.92, 0.88);
        this.mesh.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.14, 0.92, 0.92);
        this.mesh.add(leftPupil);

        // Right eye
        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.14, 0.92, 0.88);
        this.mesh.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.14, 0.92, 0.92);
        this.mesh.add(rightPupil);

        // ===== LION'S MANE =====
        // Main mane around head
        const maneGeo = new THREE.BoxGeometry(0.7, 0.6, 0.45);
        const mane = new THREE.Mesh(maneGeo, maneMat);
        mane.position.set(0, 0.85, 0.55);
        this.mesh.add(mane);

        // Extra mane fluff on top
        const maneTopGeo = new THREE.BoxGeometry(0.5, 0.25, 0.35);
        const maneTop = new THREE.Mesh(maneTopGeo, maneMat);
        maneTop.position.set(0, 1.1, 0.6);
        this.mesh.add(maneTop);

        // Mane sides (fluffy cheeks)
        const maneSideGeo = new THREE.BoxGeometry(0.15, 0.35, 0.3);
        const maneLeft = new THREE.Mesh(maneSideGeo, maneMat);
        maneLeft.position.set(-0.35, 0.85, 0.6);
        this.mesh.add(maneLeft);

        const maneRight = new THREE.Mesh(maneSideGeo, maneMat);
        maneRight.position.set(0.35, 0.85, 0.6);
        this.mesh.add(maneRight);

        // ===== GOAT-STYLE HORNS =====
        const hornGeo = new THREE.BoxGeometry(0.08, 0.35, 0.08);

        const leftHorn = new THREE.Mesh(hornGeo, hornMat);
        leftHorn.position.set(-0.12, 1.2, 0.65);
        leftHorn.rotation.x = -0.3; // Curved backwards
        leftHorn.rotation.z = -0.15; // Outward angle
        this.mesh.add(leftHorn);

        const rightHorn = new THREE.Mesh(hornGeo, hornMat);
        rightHorn.position.set(0.12, 1.2, 0.65);
        rightHorn.rotation.x = -0.3;
        rightHorn.rotation.z = 0.15;
        this.mesh.add(rightHorn);

        // Horn tips (slightly curved)
        const hornTipGeo = new THREE.BoxGeometry(0.06, 0.15, 0.06);

        const leftHornTip = new THREE.Mesh(hornTipGeo, hornMat);
        leftHornTip.position.set(-0.15, 1.4, 0.55);
        leftHornTip.rotation.x = -0.5;
        leftHornTip.rotation.z = -0.2;
        this.mesh.add(leftHornTip);

        const rightHornTip = new THREE.Mesh(hornTipGeo, hornMat);
        rightHornTip.position.set(0.15, 1.4, 0.55);
        rightHornTip.rotation.x = -0.5;
        rightHornTip.rotation.z = 0.2;
        this.mesh.add(rightHornTip);

        // ===== FLOPPY PUG-STYLE EARS =====
        const earGeo = new THREE.BoxGeometry(0.12, 0.15, 0.08);

        const leftEar = new THREE.Mesh(earGeo, bodyMat);
        leftEar.position.set(-0.22, 1.02, 0.7);
        leftEar.rotation.z = 0.3; // Floppy
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, bodyMat);
        rightEar.position.set(0.22, 1.02, 0.7);
        rightEar.rotation.z = -0.3;
        this.mesh.add(rightEar);

        // ===== CHIHUAHUA-STYLE CURLED TAIL =====
        const tailPivot = new THREE.Group();
        tailPivot.position.set(0, 0.7, -0.7);

        // Tail base
        const tailBaseGeo = new THREE.BoxGeometry(0.1, 0.3, 0.1);
        const tailBase = new THREE.Mesh(tailBaseGeo, bodyMat);
        tailBase.position.set(0, 0.15, 0);
        tailPivot.add(tailBase);

        // Tail curl (curled upward like chihuahua)
        const tailCurlGeo = new THREE.BoxGeometry(0.08, 0.2, 0.08);
        const tailCurl = new THREE.Mesh(tailCurlGeo, bodyMat);
        tailCurl.position.set(0, 0.35, 0.08);
        tailCurl.rotation.x = 0.6;
        tailPivot.add(tailCurl);

        // Tail tip (final curl)
        const tailTipGeo = new THREE.BoxGeometry(0.06, 0.12, 0.06);
        const tailTip = new THREE.Mesh(tailTipGeo, bodyMat);
        tailTip.position.set(0, 0.42, 0.18);
        tailTip.rotation.x = 1.0;
        tailPivot.add(tailTip);

        tailPivot.rotation.x = -0.4; // Angle upward
        this.mesh.add(tailPivot);
        this.tailPivot = tailPivot;

        // ===== HOOVED LEGS (SHORT DACHSHUND LEGS WITH HOOVES) =====
        const legGeo = new THREE.BoxGeometry(0.15, 0.35, 0.15);
        const hoofGeo = new THREE.BoxGeometry(0.12, 0.1, 0.14);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.35, z);

            // Upper leg
            const leg = new THREE.Mesh(legGeo, bodyMat);
            leg.position.set(0, -0.175, 0);
            pivot.add(leg);

            // Hoof at bottom
            const hoof = new THREE.Mesh(hoofGeo, hoofMat);
            hoof.position.set(0, -0.4, 0);
            pivot.add(hoof);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.15, 0.45),  // Front left
            makeLeg(0.15, 0.45),   // Front right
            makeLeg(-0.15, -0.45), // Back left
            makeLeg(0.15, -0.45)   // Back right
        ];
    }

    updateAnimation(dt) {
        super.updateAnimation(dt);

        // Animate tail wagging (chihuahua excited wag)
        if (this.tailPivot) {
            const tailWag = Math.sin(this.animTime * 8) * 0.3;
            this.tailPivot.rotation.z = tailWag;
        }
    }
}
