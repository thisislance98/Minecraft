import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Lion extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.8;
        this.height = 1.2;
        this.depth = 1.6;
        this.speed = 4.5;
        this.createBody();
    }

    createBody() {
        // Lion: Gold/Tan
        const furColor = 0xC2B280;
        const maneColor = 0x8B4513;
        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const maneMat = new THREE.MeshLambertMaterial({ color: maneColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.8, 0.8, 1.6);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.8, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.7);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 1.3, 1.0);
        this.mesh.add(head);

        // Mane (Large box around head)
        const maneGeo = new THREE.BoxGeometry(0.8, 0.8, 0.5);
        const mane = new THREE.Mesh(maneGeo, maneMat);
        mane.position.set(0, 1.3, 0.8);
        this.mesh.add(mane);

        // Snout
        const snoutGeo = new THREE.BoxGeometry(0.3, 0.25, 0.3);
        const snout = new THREE.Mesh(snoutGeo, mat);
        snout.position.set(0, 1.2, 1.4);
        this.mesh.add(snout);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const nose = new THREE.Mesh(noseGeo, blackMat);
        nose.position.set(0, 1.3, 1.55);
        this.mesh.add(nose);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.15, 1.4, 1.35);
        this.mesh.add(leftEye);
        const leftPupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.06), blackMat);
        leftPupil.position.set(-0.15, 1.4, 1.38);
        this.mesh.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.15, 1.4, 1.35);
        this.mesh.add(rightEye);
        const rightPupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.06), blackMat);
        rightPupil.position.set(0.15, 1.4, 1.38);
        this.mesh.add(rightPupil);

        // Ear bumps (hidden in mane mostly but visible on top)
        const earGeo = new THREE.BoxGeometry(0.15, 0.15, 0.1);
        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.25, 1.6, 1.0);
        this.mesh.add(leftEar);
        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.25, 1.6, 1.0);
        this.mesh.add(rightEar);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.1, 0.1, 1.0);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 1.0, -0.9);
        tail.rotation.x = -0.5;
        this.mesh.add(tail);

        const tuftGeo = new THREE.BoxGeometry(0.15, 0.15, 0.2);
        const tuft = new THREE.Mesh(tuftGeo, maneMat);
        tuft.position.set(0, 1.4, -1.3);
        this.mesh.add(tuft);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.8, z);
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.4, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.3, 0.6),
            makeLeg(0.3, 0.6),
            makeLeg(-0.3, -0.6),
            makeLeg(0.3, -0.6)
        ];
    }
}
