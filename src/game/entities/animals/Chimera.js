import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Chimera extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 1.8;
        this.height = 2.2;
        this.depth = 2.5;
        this.speed = 2.5; // Elephant speed
        this.health = 25; // Tougher than elephant
        this.maxHealth = 25;

        // Trunk state (Elephant feature)
        this.trunkState = 'idle';
        this.trunkSegments = [];
        this.trunkTip = null;

        this.createBody();
    }

    createBody() {
        // MATERIALS
        const elephantSkinColor = 0x808080;
        const skinMat = new THREE.MeshLambertMaterial({ color: elephantSkinColor });
        const darkerSkinMat = new THREE.MeshLambertMaterial({ color: 0x606060 });
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const ivoryMat = new THREE.MeshLambertMaterial({ color: 0xFFFFF0 }); // Tusks
        const pinkMat = new THREE.MeshLambertMaterial({ color: 0xF0B0B0 }); // Inner ear

        // Unicorn Horn Material
        const hornMat = new THREE.MeshLambertMaterial({ color: 0xFFD700, emissive: 0x221100 }); // Gold

        // Turkey Tail Materials
        const featherColor = 0x3E2723; // Dark Brown
        const featherMat = new THREE.MeshLambertMaterial({ color: featherColor });
        const wattleColor = 0xD32F2F; // Red
        const wattleMat = new THREE.MeshLambertMaterial({ color: wattleColor });


        // --- ELEPHANT BODY ---
        const bodyGeo = new THREE.BoxGeometry(1.6, 1.4, 2.2);
        const body = new THREE.Mesh(bodyGeo, skinMat);
        body.position.set(0, 1.6, 0);
        this.mesh.add(body);

        // --- ELEPHANT HEAD ---
        const headGeo = new THREE.BoxGeometry(1.0, 1.0, 0.9);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 2.2, 1.4);
        this.mesh.add(head);

        // Forehead bump
        const foreheadGeo = new THREE.BoxGeometry(0.8, 0.4, 0.5);
        const forehead = new THREE.Mesh(foreheadGeo, skinMat);
        forehead.position.set(0, 2.6, 1.3);
        this.mesh.add(forehead);

        // --- UNICORN HORN ---
        // Attach to forehead
        const hornGeo = new THREE.ConeGeometry(0.1, 0.8, 8); // Slightly larger than unicorn's
        const horn = new THREE.Mesh(hornGeo, hornMat);
        // Position on forehead
        horn.position.set(0, 0.4, 0.1);
        horn.rotation.x = -Math.PI / 6; // Point forward/up
        forehead.add(horn);

        // --- ELEPHANT EARS ---
        const earGeo = new THREE.BoxGeometry(0.15, 1.0, 0.8);
        const innerEarGeo = new THREE.BoxGeometry(0.05, 0.8, 0.6);

        // Left Ear
        const leftEarPivot = new THREE.Group();
        leftEarPivot.position.set(-0.5, 2.3, 1.2);
        const leftEar = new THREE.Mesh(earGeo, skinMat);
        leftEar.position.set(-0.4, 0, 0);
        leftEarPivot.add(leftEar);
        const leftInnerEar = new THREE.Mesh(innerEarGeo, pinkMat);
        leftInnerEar.position.set(-0.35, 0, 0);
        leftEarPivot.add(leftInnerEar);
        leftEarPivot.rotation.z = 0.3;
        this.mesh.add(leftEarPivot);
        this.leftEarPivot = leftEarPivot;

        // Right Ear
        const rightEarPivot = new THREE.Group();
        rightEarPivot.position.set(0.5, 2.3, 1.2);
        const rightEar = new THREE.Mesh(earGeo, skinMat);
        rightEar.position.set(0.4, 0, 0);
        rightEarPivot.add(rightEar);
        const rightInnerEar = new THREE.Mesh(innerEarGeo, pinkMat);
        rightInnerEar.position.set(0.35, 0, 0);
        rightEarPivot.add(rightInnerEar);
        rightEarPivot.rotation.z = -0.3;
        this.mesh.add(rightEarPivot);
        this.rightEarPivot = rightEarPivot;

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.15, 0.15, 0.1);
        const pupilGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);

        const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.35, 2.3, 1.85);
        this.mesh.add(leftEye);
        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.35, 2.3, 1.9);
        this.mesh.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.35, 2.3, 1.85);
        this.mesh.add(rightEye);
        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.35, 2.3, 1.9);
        this.mesh.add(rightPupil);

        // --- ELEPHANT TRUNK ---
        this.trunkPivot = new THREE.Group();
        this.trunkPivot.position.set(0, 1.9, 1.85);
        this.mesh.add(this.trunkPivot);

        const trunkSegGeos = [
            new THREE.BoxGeometry(0.35, 0.35, 0.4),
            new THREE.BoxGeometry(0.3, 0.3, 0.4),
            new THREE.BoxGeometry(0.25, 0.25, 0.4),
            new THREE.BoxGeometry(0.2, 0.2, 0.4),
            new THREE.BoxGeometry(0.15, 0.15, 0.35)
        ];

        let prevSegment = this.trunkPivot;
        for (let i = 0; i < 5; i++) {
            const segmentPivot = new THREE.Group();
            const segment = new THREE.Mesh(trunkSegGeos[i], skinMat);
            if (i === 0) segmentPivot.position.set(0, 0, 0.2);
            else segmentPivot.position.set(0, 0, 0.35);
            segment.position.set(0, 0, 0.15);
            segmentPivot.add(segment);
            prevSegment.add(segmentPivot);
            this.trunkSegments.push(segmentPivot);
            prevSegment = segmentPivot;
        }
        this.trunkTip = prevSegment;

        // Tusks
        const tuskGeo = new THREE.BoxGeometry(0.1, 0.1, 0.6);
        const leftTusk = new THREE.Mesh(tuskGeo, ivoryMat);
        leftTusk.position.set(-0.3, 1.8, 2.0);
        leftTusk.rotation.x = 0.3;
        leftTusk.rotation.y = 0.2;
        this.mesh.add(leftTusk);

        const rightTusk = new THREE.Mesh(tuskGeo, ivoryMat);
        rightTusk.position.set(0.3, 1.8, 2.0);
        rightTusk.rotation.x = 0.3;
        rightTusk.rotation.y = -0.2;
        this.mesh.add(rightTusk);

        // --- TURKEY TAIL FANS ---
        const tailPivot = new THREE.Group();
        tailPivot.position.set(0, 1.8, -1.0); // High on back

        // Scale up turkey tail dimensions (~2.5x)
        // Original: 0.8 width, 0.6 height
        // New: 2.0 width, 1.5 height
        const tailGeo = new THREE.BoxGeometry(2.0, 1.5, 0.2);
        const tail = new THREE.Mesh(tailGeo, featherMat);
        tail.position.set(0, 0.0, 0);

        // Turkey tail is tilted back
        tail.rotation.x = -Math.PI / 8;
        tailPivot.add(tail);

        // Add some "feathery" detail or colors?
        // Let's add a few colored bands to make it look like a turkey fan
        const band1Geo = new THREE.BoxGeometry(1.8, 0.2, 0.22);
        const band1 = new THREE.Mesh(band1Geo, wattleMat); // Red band
        band1.position.set(0, 0.5, 0);
        tail.add(band1);

        const band2Geo = new THREE.BoxGeometry(1.4, 0.2, 0.22);
        const band2 = new THREE.Mesh(band2Geo, ivoryMat); // White band
        band2.position.set(0, 0.2, 0);
        tail.add(band2);

        this.mesh.add(tailPivot);
        this.tailPivot = tailPivot;

        // --- ELEPHANT LEGS ---
        const legGeo = new THREE.BoxGeometry(0.5, 1.2, 0.5);
        const footGeo = new THREE.BoxGeometry(0.55, 0.15, 0.55);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 1.2, z);

            const leg = new THREE.Mesh(legGeo, skinMat);
            leg.position.set(0, -0.6, 0);
            pivot.add(leg);

            const foot = new THREE.Mesh(footGeo, darkerSkinMat);
            foot.position.set(0, -1.15, 0);
            pivot.add(foot);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.5, 0.8),
            makeLeg(0.5, 0.8),
            makeLeg(-0.5, -0.8),
            makeLeg(0.5, -0.8)
        ];
    }

    updateAnimation(dt) {
        super.updateAnimation(dt);

        // Ear flapping
        if (this.leftEarPivot && this.rightEarPivot) {
            const earFlap = Math.sin(this.animTime * 0.5) * 0.1;
            this.leftEarPivot.rotation.z = 0.3 + earFlap;
            this.rightEarPivot.rotation.z = -0.3 - earFlap;
        }

        // Tail fan waggle
        if (this.tailPivot) {
            const tailSwing = Math.sin(this.animTime * 0.7) * 0.1;
            this.tailPivot.rotation.y = tailSwing; // Rotate Y for fan waggle
            this.tailPivot.rotation.x = -Math.PI / 8 + Math.sin(this.animTime * 0.3) * 0.05; // Bob up/down slightly
        }

        // Trunk animation
        const baseSwing = Math.sin(this.animTime * 0.8) * 0.1;
        this.trunkPivot.rotation.x = 0.3 + baseSwing * 0.5;
        for (let i = 0; i < this.trunkSegments.length; i++) {
            this.trunkSegments[i].rotation.x = 0.1 + baseSwing * (i * 0.05);
        }
    }
}
