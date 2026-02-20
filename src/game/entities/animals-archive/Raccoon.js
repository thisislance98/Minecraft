import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Raccoon extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.5;
        this.height = 0.5;
        this.depth = 1.0;
        this.speed = 3.5;
        this.createBody();
        this.idleTimer = 0;
    }

    createBody() {
        // Raccoon colors
        const greyFur = 0x7F8C8D;
        const blackColor = 0x1A1A1A;
        const whiteColor = 0xFDFEFE;
        const darkGrey = 0x5D6D7E;

        const mat = new THREE.MeshLambertMaterial({ color: greyFur });
        const blackMat = new THREE.MeshLambertMaterial({ color: blackColor });
        const whiteMat = new THREE.MeshLambertMaterial({ color: whiteColor });
        const darkMat = new THREE.MeshLambertMaterial({ color: darkGrey });

        // Body (stout and roundish)
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.45, 0.9);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.45, 0);
        this.mesh.add(body);

        // Belly (lighter grey/white)
        const bellyGeo = new THREE.BoxGeometry(0.4, 0.2, 0.7);
        const belly = new THREE.Mesh(bellyGeo, darkMat);
        belly.position.set(0, 0.35, 0);
        this.mesh.add(belly);

        // Head
        const headGeo = new THREE.BoxGeometry(0.4, 0.35, 0.4);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.65, 0.55);
        this.mesh.add(head);

        // Snout (pointed)
        const snoutGeo = new THREE.BoxGeometry(0.2, 0.15, 0.25);
        const snout = new THREE.Mesh(snoutGeo, whiteMat);
        snout.position.set(0, 0.58, 0.8);
        this.mesh.add(snout);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
        const nose = new THREE.Mesh(noseGeo, blackMat);
        nose.position.set(0, 0.62, 0.93);
        this.mesh.add(nose);

        // Eyes Mask (The "Bandit" Mask)
        const maskGeo = new THREE.BoxGeometry(0.32, 0.12, 0.05);
        const mask = new THREE.Mesh(maskGeo, blackMat);
        mask.position.set(0, 0.7, 0.76);
        this.mesh.add(mask);

        // Ears (small, rounded triangles)
        const earGeo = new THREE.BoxGeometry(0.1, 0.12, 0.05);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.15, 0.85, 0.6);
        leftEar.rotation.z = 0.2;
        this.mesh.add(leftEar);

        const leftEarInner = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.06), whiteMat);
        leftEarInner.position.set(-0.15, 0.85, 0.6);
        leftEarInner.rotation.z = 0.2;
        this.mesh.add(leftEarInner);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.15, 0.85, 0.6);
        rightEar.rotation.z = -0.2;
        this.mesh.add(rightEar);

        const rightEarInner = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.06), whiteMat);
        rightEarInner.position.set(0.15, 0.85, 0.6);
        rightEarInner.rotation.z = -0.2;
        this.mesh.add(rightEarInner);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.05); // Small shiny eyes
        const leftEye = new THREE.Mesh(eyeGeo, blackMat); // Black eyes usually blend into mask, but maybe glint?
        // Let's make eyes slightly separate or just rely on the mask? 
        // Let's perform a trick: white pupil or just black on top of mask?
        // Actually, raccoons have dark eyes in the dark mask. Maybe just the mask is enough, 
        // or add small white reflection specks.
        const glintGeo = new THREE.BoxGeometry(0.02, 0.02, 0.06);
        const leftGlint = new THREE.Mesh(glintGeo, whiteMat);
        leftGlint.position.set(-0.08, 0.72, 0.78);
        this.mesh.add(leftGlint);

        const rightGlint = new THREE.Mesh(glintGeo, whiteMat);
        rightGlint.position.set(0.08, 0.72, 0.78);
        this.mesh.add(rightGlint);

        // Tail (Striped!)
        const tailGeo = new THREE.BoxGeometry(0.18, 0.18, 0.8);
        // We need to make it striped. We can't easily texture map a single box with stripes without textures.
        // We'll construct it from segments.
        const tailGroup = new THREE.Group();
        tailGroup.position.set(0, 0.55, -0.45);
        tailGroup.rotation.x = -0.4;
        this.mesh.add(tailGroup);

        const numSegments = 6;
        const segLen = 0.8 / numSegments;
        for (let i = 0; i < numSegments; i++) {
            const isBlack = i % 2 === 0;
            const segGeo = new THREE.BoxGeometry(0.18, 0.18, segLen);
            const seg = new THREE.Mesh(segGeo, isBlack ? blackMat : mat);
            seg.position.set(0, 0, -i * segLen);
            tailGroup.add(seg);
        }

        // Legs
        const legGeo = new THREE.BoxGeometry(0.12, 0.35, 0.12);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.35, z);
            const leg = new THREE.Mesh(legGeo, blackMat); // Raccoons have dark legs/paws
            leg.position.set(0, -0.175, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.15, 0.3),
            makeLeg(0.15, 0.3),
            makeLeg(-0.15, -0.3),
            makeLeg(0.15, -0.3)
        ];
    }
}
