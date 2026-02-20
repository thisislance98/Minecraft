import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Goat extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.8;
        this.height = 1.1; // Taller than sheep
        this.depth = 1.0;

        // Goats are bouncy/climbers
        this.jumpForce = 14; // Higher jump

        this.createBody();
        this.mesh.scale.set(0.85, 0.85, 0.85);
    }

    createBody() {
        // Goat: White/Off-white
        const furColor = 0xF5F5F5;
        const hornColor = 0x8D6E63; // Brownish
        const noseColor = 0x5D4037;

        const furMat = new THREE.MeshLambertMaterial({ color: furColor });
        const hornMat = new THREE.MeshLambertMaterial({ color: hornColor });
        const noseMat = new THREE.MeshLambertMaterial({ color: noseColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.8, 0.8, 1.2);
        const body = new THREE.Mesh(bodyGeo, furMat);
        body.position.set(0, 0.8, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.6); // Slightly elongated
        const head = new THREE.Mesh(headGeo, furMat);
        head.position.set(0, 1.25, 0.8);
        this.mesh.add(head);

        // Nose/Snout area often same color but let's add a darker nose tip
        const noseGeo = new THREE.BoxGeometry(0.2, 0.15, 0.05);
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 1.1, 1.1); // Tip of face
        this.mesh.add(nose);

        // Beard
        const beardGeo = new THREE.BoxGeometry(0.2, 0.25, 0.05);
        const beard = new THREE.Mesh(beardGeo, furMat);
        beard.position.set(0, 0.9, 1.0); // Hanging from chin
        beard.rotation.x = -0.2;
        this.mesh.add(beard);

        // Horns
        const hornGeo = new THREE.BoxGeometry(0.08, 0.4, 0.08);

        const leftHorn = new THREE.Mesh(hornGeo, hornMat);
        leftHorn.position.set(-0.15, 1.6, 0.85);
        leftHorn.rotation.x = -0.3; // Backwards
        this.mesh.add(leftHorn);

        const rightHorn = new THREE.Mesh(hornGeo, hornMat);
        rightHorn.position.set(0.15, 1.6, 0.85);
        rightHorn.rotation.x = -0.3;
        this.mesh.add(rightHorn);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const pupilGeo = new THREE.BoxGeometry(0.05, 0.05, 0.06);

        // Left Eye (Goats have wide eyes on side)
        const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.25, 1.3, 0.95);
        this.mesh.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.25, 1.3, 0.97);
        this.mesh.add(leftPupil);

        // Right Eye
        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.25, 1.3, 0.95);
        this.mesh.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.25, 1.3, 0.97);
        this.mesh.add(rightPupil);


        // Legs
        const legW = 0.2;
        const legH = 0.6;
        const legGeo = new THREE.BoxGeometry(legW, legH, legW);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.6, z);

            const legMesh = new THREE.Mesh(legGeo, furMat);
            legMesh.position.set(0, -legH / 2, 0);
            pivot.add(legMesh);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.25, 0.4),
            makeLeg(0.25, 0.4),
            makeLeg(-0.25, -0.4),
            makeLeg(0.25, -0.4)
        ];
    }
}
