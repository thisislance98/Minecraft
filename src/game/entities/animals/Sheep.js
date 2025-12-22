import * as THREE from 'three';
import { Animal } from '../Animal.js';

// HMR test - 12:51 - with registry
export class Sheep extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.9;
        this.height = 1.0;
        this.depth = 1.1; // Slightly longer
        this.createBody();
        this.mesh.scale.set(0.9, 0.9, 0.9);
    }

    createBody() {
        // Sheep: White wool, beige skin
        const woolColor = 0xFFFFFF; // White
        const skinColor = 0xE3CFB8; // Beige/Tan

        const woolMat = new THREE.MeshLambertMaterial({ color: woolColor });
        const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const eyeWhiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });

        // Body (Wool)
        const bodyGeo = new THREE.BoxGeometry(0.9, 0.8, 1.3);
        const body = new THREE.Mesh(bodyGeo, woolMat);
        body.position.set(0, 0.8, 0);
        this.mesh.add(body);

        // Head (Skin)
        const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.65);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 1.2, 0.85); // Up and forward
        this.mesh.add(head);

        // Wool on top of head
        const headWoolGeo = new THREE.BoxGeometry(0.65, 0.2, 0.6);
        const headWool = new THREE.Mesh(headWoolGeo, woolMat);
        headWool.position.set(0, 1.5, 0.85);
        this.mesh.add(headWool);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
        const pupilGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);

        // Left Eye
        const leftEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
        leftEye.position.set(-0.30, 1.3, 1.15); // Side of head
        this.mesh.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.30, 1.3, 1.17);
        this.mesh.add(leftPupil);

        // Right Eye
        const rightEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
        rightEye.position.set(0.30, 1.3, 1.15);
        this.mesh.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.30, 1.3, 1.17);
        this.mesh.add(rightPupil);

        // Ears? (Often hidden or small on minecraft sheep, but let's add small bumps)
        // No, let's keep it simple like typical blocky sheep.

        // Legs (Skin)
        const legW = 0.25;
        const legH = 0.55;

        const legGeo = new THREE.BoxGeometry(legW, legH, legW);
        // Maybe some wool at the very top of leg? Simplified to just skin for now or mimic MC where it's skin.

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.55, z); // Hip pivot

            const legMesh = new THREE.Mesh(legGeo, skinMat);
            legMesh.position.set(0, -legH / 2, 0);
            pivot.add(legMesh);

            this.mesh.add(pivot);
            return pivot;
        };

        // Legs positioned
        this.legParts = [
            makeLeg(-0.3, 0.4),  // Front L
            makeLeg(0.3, 0.4),   // Front R
            makeLeg(-0.3, -0.4), // Back L
            makeLeg(0.3, -0.4)   // Back R
        ];
    }
}
