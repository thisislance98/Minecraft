import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Panda extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 1.0;
        this.height = 1.2;
        this.depth = 1.4;
        this.speed = 1.5; // Pandas are slow and relaxed
        this.createBody();
    }

    createBody() {
        // Panda colors: White body with black patches
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xF5F5F5 });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        const pinkMat = new THREE.MeshLambertMaterial({ color: 0xFFC0CB }); // For nose

        // Body (White, round and chubby)
        const bodyGeo = new THREE.BoxGeometry(1.0, 0.9, 1.2);
        const body = new THREE.Mesh(bodyGeo, whiteMat);
        body.position.set(0, 0.9, 0);
        this.mesh.add(body);

        // Head (White, round)
        const headGeo = new THREE.BoxGeometry(0.8, 0.7, 0.7);
        const head = new THREE.Mesh(headGeo, whiteMat);
        head.position.set(0, 1.5, 0.55);
        this.mesh.add(head);

        // Eye patches (Black circles around eyes - iconic panda look)
        const eyePatchGeo = new THREE.BoxGeometry(0.25, 0.25, 0.1);

        const leftEyePatch = new THREE.Mesh(eyePatchGeo, blackMat);
        leftEyePatch.position.set(-0.2, 1.55, 0.85);
        this.mesh.add(leftEyePatch);

        const rightEyePatch = new THREE.Mesh(eyePatchGeo, blackMat);
        rightEyePatch.position.set(0.2, 1.55, 0.85);
        this.mesh.add(rightEyePatch);

        // Eyes (Small white with black pupils inside patches)
        const eyeWhiteGeo = new THREE.BoxGeometry(0.08, 0.1, 0.05);
        const eyePupilGeo = new THREE.BoxGeometry(0.05, 0.06, 0.05);

        const leftEyeWhite = new THREE.Mesh(eyeWhiteGeo, whiteMat);
        leftEyeWhite.position.set(-0.2, 1.55, 0.92);
        this.mesh.add(leftEyeWhite);

        const leftPupil = new THREE.Mesh(eyePupilGeo, blackMat);
        leftPupil.position.set(-0.2, 1.55, 0.96);
        this.mesh.add(leftPupil);

        const rightEyeWhite = new THREE.Mesh(eyeWhiteGeo, whiteMat);
        rightEyeWhite.position.set(0.2, 1.55, 0.92);
        this.mesh.add(rightEyeWhite);

        const rightPupil = new THREE.Mesh(eyePupilGeo, blackMat);
        rightPupil.position.set(0.2, 1.55, 0.96);
        this.mesh.add(rightPupil);

        // Nose (Pink/black snout)
        const noseGeo = new THREE.BoxGeometry(0.15, 0.1, 0.1);
        const nose = new THREE.Mesh(noseGeo, blackMat);
        nose.position.set(0, 1.4, 0.95);
        this.mesh.add(nose);

        // Ears (Black, round)
        const earGeo = new THREE.BoxGeometry(0.2, 0.2, 0.1);

        const leftEar = new THREE.Mesh(earGeo, blackMat);
        leftEar.position.set(-0.35, 1.85, 0.5);
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, blackMat);
        rightEar.position.set(0.35, 1.85, 0.5);
        this.mesh.add(rightEar);

        // Front legs (Black)
        const frontLegGeo = new THREE.BoxGeometry(0.35, 0.7, 0.35);

        const makeFrontLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.7, z);
            const leg = new THREE.Mesh(frontLegGeo, blackMat);
            leg.position.set(0, -0.35, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        // Back legs (Black)
        const backLegGeo = new THREE.BoxGeometry(0.35, 0.6, 0.35);

        const makeBackLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.6, z);
            const leg = new THREE.Mesh(backLegGeo, blackMat);
            leg.position.set(0, -0.3, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeFrontLeg(-0.35, 0.4),
            makeFrontLeg(0.35, 0.4),
            makeBackLeg(-0.35, -0.4),
            makeBackLeg(0.35, -0.4)
        ];

        // Short stubby tail
        const tailGeo = new THREE.BoxGeometry(0.15, 0.12, 0.1);
        const tail = new THREE.Mesh(tailGeo, whiteMat);
        tail.position.set(0, 0.85, -0.65);
        this.mesh.add(tail);
    }
}
