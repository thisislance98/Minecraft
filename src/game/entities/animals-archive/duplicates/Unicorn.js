import * as THREE from 'three';
import { Horse } from './Horse.js';

export class Unicorn extends Horse {
    constructor(game, x, y, z) {
        super(game, x, y, z);

        // Override body creation or modify materials after super?
        // Horse creates body in constructor. We can rebuild it or modify it.
        // Easiest is to modify the existing mesh materials and add the horn.

        this.modifyForUnicorn();
    }

    modifyForUnicorn() {
        // Unicorn: White body, Rainbow Mane/Tail, Golden Horn

        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const rainbowMat = new THREE.MeshLambertMaterial({ color: 0xFF69B4 }); // Hot pink base, could use vertex colors for real rainbow but this is simple
        const hornMat = new THREE.MeshLambertMaterial({ color: 0xFFD700, emissive: 0x442200 }); // Gold

        // Traverse mesh to swap materials
        // Horse structure is complex, let's just color everything white first then finding specific parts might be hard without references.
        // Instead of complex traversal, let's just re-create the body parts we want to change or just accept the super constructor's geometry and paint over it?
        // Actually `Horse` sets `this.mesh` children.

        // Let's clear the mesh and recreate it with Unicorn colors? 
        // Or simpler: access specific children if we knew their order.
        // Horse adds: Body, Neck, Head, Ears, Eyes, Mane, HeadMane, TailPivot.

        // Let's just create a completely new body to be safe and precise.
        // We will clear the mesh children added by super() and call our own createBody but customized.

        // Remove all children from mesh
        while (this.mesh.children.length > 0) {
            this.mesh.remove(this.mesh.children[0]);
        }

        // Re-implement createBody logic from Horse but with Unicorn materials
        // Copy-paste from Horse.js with modifications

        const bodyMat = whiteMat;
        const maneMat = rainbowMat; // Pink/Rainbow
        const eyeWhiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const pupilMat = new THREE.MeshLambertMaterial({ color: 0x0000FF }); // Blue eyes for unicorn?

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.9, 0.8, 1.4);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 1.1, 0);
        this.mesh.add(body);

        // Neck
        const neckGeo = new THREE.BoxGeometry(0.4, 0.7, 0.4);
        const neck = new THREE.Mesh(neckGeo, bodyMat);
        neck.position.set(0, 1.5, 0.7);
        neck.rotation.x = Math.PI / 4;
        this.mesh.add(neck);

        // Head
        const headGeo = new THREE.BoxGeometry(0.55, 0.55, 1.0);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.set(0, 1.9, 1.15);
        head.rotation.x = Math.PI / 6;
        this.mesh.add(head);

        // -- UNIQUE TO UNICORN: HORN --
        const hornGeo = new THREE.ConeGeometry(0.06, 0.6, 8);
        const horn = new THREE.Mesh(hornGeo, hornMat);
        horn.position.set(0, 0.3, 0.35); // Relative to head center
        horn.rotation.x = -Math.PI / 6; // Point up/forward relative to head
        head.add(horn); // Add to head so it moves with it

        // Ears
        const earGeo = new THREE.BoxGeometry(0.12, 0.18, 0.1);
        const leftEar = new THREE.Mesh(earGeo, bodyMat);
        leftEar.position.set(-0.2, 2.3, 0.85);
        leftEar.rotation.x = Math.PI / 6;
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, bodyMat);
        rightEar.position.set(0.2, 2.3, 0.85);
        rightEar.rotation.x = Math.PI / 6;
        this.mesh.add(rightEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.12, 0.12);
        const pupilGeo = new THREE.BoxGeometry(0.04, 0.08, 0.08);

        const leftEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
        leftEye.position.set(-0.28, 2.0, 1.35);
        this.mesh.add(leftEye);
        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(-0.31, 2.0, 1.38);
        this.mesh.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
        rightEye.position.set(0.28, 2.0, 1.35);
        this.mesh.add(rightEye);
        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(0.31, 2.0, 1.38);
        this.mesh.add(rightPupil);

        // Mane
        const maneGeo = new THREE.BoxGeometry(0.15, 0.5, 0.25);
        const mane = new THREE.Mesh(maneGeo, maneMat);
        mane.position.set(0, 1.7, 0.65);
        mane.rotation.x = Math.PI / 4;
        this.mesh.add(mane);

        const headManeGeo = new THREE.BoxGeometry(0.12, 0.2, 0.4);
        const headMane = new THREE.Mesh(headManeGeo, maneMat);
        headMane.position.set(0, 2.25, 1.05);
        this.mesh.add(headMane);

        // Tail
        const tailPivot = new THREE.Group();
        tailPivot.position.set(0, 1.3, -0.7);
        const tailGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);
        const tail = new THREE.Mesh(tailGeo, maneMat);
        tail.position.set(0, -0.3, 0);
        tailPivot.add(tail);

        // Tail Tip
        const tailTipGeo = new THREE.BoxGeometry(0.12, 0.4, 0.12);
        const tailTip = new THREE.Mesh(tailTipGeo, maneMat); // Same color for now
        tailTip.position.set(0, -0.7, 0);
        tailPivot.add(tailTip);

        tailPivot.rotation.x = 0.3;
        this.mesh.add(tailPivot);
        this.tailPivot = tailPivot;

        // Legs
        const legGeo = new THREE.BoxGeometry(0.3, 0.9, 0.3);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.9, z);
            const leg = new THREE.Mesh(legGeo, bodyMat);
            leg.position.set(0, -0.45, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.3, 0.5),
            makeLeg(0.3, 0.5),
            makeLeg(-0.3, -0.5),
            makeLeg(0.3, -0.5)
        ];
    }
}
