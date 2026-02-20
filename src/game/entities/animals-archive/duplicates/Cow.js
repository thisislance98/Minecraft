import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Cow extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.9;
        this.height = 1.2;
        this.depth = 1.8;
        this.speed = 2.0; // Slow, plodding movement
        this.createBody();
    }

    createBody() {
        // Cow colors - black and white spotted pattern
        const bodyColor = 0xFFFFFF; // White base
        const spotColor = 0x222222; // Dark spots
        const skinColor = 0xDDBB99; // Tan/beige for muzzle
        const hoofColor = 0x3D3D3D; // Dark grey hooves
        const noseColor = 0x4A3728; // Dark brown nose
        const hornColor = 0xF5F5DC; // Ivory/beige horns

        const whiteMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const spotMat = new THREE.MeshLambertMaterial({ color: spotColor });
        const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });
        const hoofMat = new THREE.MeshLambertMaterial({ color: hoofColor });
        const noseMat = new THREE.MeshLambertMaterial({ color: noseColor });
        const hornMat = new THREE.MeshLambertMaterial({ color: hornColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const pinkMat = new THREE.MeshLambertMaterial({ color: 0xFFB6C1 }); // Pink udder

        // Body - large barrel shape
        const bodyGeo = new THREE.BoxGeometry(0.9, 0.8, 1.4);
        const body = new THREE.Mesh(bodyGeo, whiteMat);
        body.position.set(0, 0.9, 0);
        this.mesh.add(body);

        // Spots on body
        const spot1Geo = new THREE.BoxGeometry(0.3, 0.25, 0.4);
        const spot1 = new THREE.Mesh(spot1Geo, spotMat);
        spot1.position.set(0.35, 1.0, 0.2);
        this.mesh.add(spot1);

        const spot2Geo = new THREE.BoxGeometry(0.25, 0.3, 0.35);
        const spot2 = new THREE.Mesh(spot2Geo, spotMat);
        spot2.position.set(-0.3, 0.85, -0.3);
        this.mesh.add(spot2);

        const spot3Geo = new THREE.BoxGeometry(0.2, 0.2, 0.25);
        const spot3 = new THREE.Mesh(spot3Geo, spotMat);
        spot3.position.set(0.1, 1.15, -0.1);
        this.mesh.add(spot3);

        // Head
        const headGeo = new THREE.BoxGeometry(0.55, 0.55, 0.6);
        const head = new THREE.Mesh(headGeo, whiteMat);
        head.position.set(0, 1.1, 0.9);
        this.mesh.add(head);

        // Spot on head
        const headSpotGeo = new THREE.BoxGeometry(0.15, 0.2, 0.1);
        const headSpot = new THREE.Mesh(headSpotGeo, spotMat);
        headSpot.position.set(-0.15, 1.2, 1.2);
        this.mesh.add(headSpot);

        // Muzzle/Snout
        const muzzleGeo = new THREE.BoxGeometry(0.4, 0.3, 0.2);
        const muzzle = new THREE.Mesh(muzzleGeo, skinMat);
        muzzle.position.set(0, 0.95, 1.25);
        this.mesh.add(muzzle);

        // Nostrils
        const nostrilGeo = new THREE.BoxGeometry(0.06, 0.06, 0.03);
        const leftNostril = new THREE.Mesh(nostrilGeo, noseMat);
        leftNostril.position.set(-0.1, 0.95, 1.36);
        this.mesh.add(leftNostril);

        const rightNostril = new THREE.Mesh(nostrilGeo, noseMat);
        rightNostril.position.set(0.1, 0.95, 1.36);
        this.mesh.add(rightNostril);

        // Horns
        const hornGeo = new THREE.BoxGeometry(0.08, 0.2, 0.08);

        const leftHorn = new THREE.Mesh(hornGeo, hornMat);
        leftHorn.position.set(-0.25, 1.45, 0.85);
        leftHorn.rotation.z = 0.3;
        this.mesh.add(leftHorn);

        const rightHorn = new THREE.Mesh(hornGeo, hornMat);
        rightHorn.position.set(0.25, 1.45, 0.85);
        rightHorn.rotation.z = -0.3;
        this.mesh.add(rightHorn);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.15, 0.1, 0.2);

        const leftEar = new THREE.Mesh(earGeo, whiteMat);
        leftEar.position.set(-0.35, 1.2, 0.8);
        leftEar.rotation.z = 0.3;
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, whiteMat);
        rightEar.position.set(0.35, 1.2, 0.8);
        rightEar.rotation.z = -0.3;
        this.mesh.add(rightEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const pupilGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);

        // Left Eye
        const leftEye = new THREE.Mesh(eyeGeo, new THREE.MeshLambertMaterial({ color: 0xFFFFFF }));
        leftEye.position.set(-0.2, 1.15, 1.2);
        this.mesh.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.2, 1.15, 1.23);
        this.mesh.add(leftPupil);

        // Right Eye
        const rightEye = new THREE.Mesh(eyeGeo, new THREE.MeshLambertMaterial({ color: 0xFFFFFF }));
        rightEye.position.set(0.2, 1.15, 1.2);
        this.mesh.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.2, 1.15, 1.23);
        this.mesh.add(rightPupil);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.08, 0.5, 0.08);
        const tail = new THREE.Mesh(tailGeo, whiteMat);
        tail.position.set(0, 0.7, -0.75);
        tail.rotation.x = 0.3;
        this.mesh.add(tail);

        // Tail tuft
        const tuftGeo = new THREE.BoxGeometry(0.12, 0.15, 0.12);
        const tuft = new THREE.Mesh(tuftGeo, spotMat);
        tuft.position.set(0, 0.45, -0.85);
        this.mesh.add(tuft);

        // Udder
        const udderGeo = new THREE.BoxGeometry(0.3, 0.2, 0.25);
        const udder = new THREE.Mesh(udderGeo, pinkMat);
        udder.position.set(0, 0.4, -0.2);
        this.mesh.add(udder);

        // Legs with hooves
        const legW = 0.2;
        const legH = 0.5;
        const hoofH = 0.1;

        const legGeo = new THREE.BoxGeometry(legW, legH - hoofH, legW);
        const hoofGeo = new THREE.BoxGeometry(legW, hoofH, legW);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.5, z);

            // Upper leg - white with black spot on some
            const legMesh = new THREE.Mesh(legGeo, whiteMat);
            legMesh.position.set(0, -((legH - hoofH) / 2), 0);
            pivot.add(legMesh);

            // Hoof
            const hoofMesh = new THREE.Mesh(hoofGeo, hoofMat);
            hoofMesh.position.set(0, -(legH - hoofH) - (hoofH / 2), 0);
            pivot.add(hoofMesh);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.3, 0.5),   // Front left
            makeLeg(0.3, 0.5),    // Front right
            makeLeg(-0.3, -0.5),  // Back left
            makeLeg(0.3, -0.5)    // Back right
        ];
    }
}
