import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Giraffifant extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 1.0;
        this.height = 4.5; // Very tall like Giraffe
        this.depth = 1.5;
        this.speed = 3.0;
        this.legSwingSpeed = 3;

        // Trunk animation state
        this.trunkState = 'idle';
        this.trunkSegments = [];
        this.trunkPivot = null;

        this.createBody();
        this.mesh.scale.set(0.9, 0.9, 0.9);
    }

    createBody() {
        // Giraffe Colors
        const skinColor = 0xF4C430; // Saffron/Yellow
        const spotColor = 0x8B4513; // Brown
        const hoofColor = 0x2F2F2F;

        // Lion Mane Color
        const maneColor = 0x8B4513;

        const mat = new THREE.MeshLambertMaterial({ color: skinColor });
        const spotMat = new THREE.MeshLambertMaterial({ color: spotColor });
        const hoofMat = new THREE.MeshLambertMaterial({ color: hoofColor });
        const darkMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const maneMat = new THREE.MeshLambertMaterial({ color: maneColor });

        // Helper to add random spots (from Giraffe)
        const addSpots = (parentMesh, width, height, depth, count) => {
            for (let i = 0; i < count; i++) {
                const sW = width * (0.2 + Math.random() * 0.2);
                const sH = height * (0.2 + Math.random() * 0.2);
                const sD = 0.02;

                const spotGeo = new THREE.BoxGeometry(sW, sH, sD);
                const spot = new THREE.Mesh(spotGeo, spotMat);

                const face = Math.floor(Math.random() * 4);
                let sx = 0, sy = 0, sz = 0;
                let rx = 0, ry = 0, rz = 0;

                if (face === 0) { // Front
                    sx = (Math.random() - 0.5) * width;
                    sy = (Math.random() - 0.5) * height;
                    sz = depth / 2 + 0.01;
                } else if (face === 1) { // Back
                    sx = (Math.random() - 0.5) * width;
                    sy = (Math.random() - 0.5) * height;
                    sz = -depth / 2 - 0.01;
                } else if (face === 2) { // Left
                    sx = -width / 2 - 0.01;
                    sy = (Math.random() - 0.5) * height;
                    sz = (Math.random() - 0.5) * depth;
                    ry = Math.PI / 2;
                } else { // Right
                    sx = width / 2 + 0.01;
                    sy = (Math.random() - 0.5) * height;
                    sz = (Math.random() - 0.5) * depth;
                    ry = Math.PI / 2;
                }

                spot.position.set(sx, sy, sz);
                spot.rotation.y = ry;
                parentMesh.add(spot);
            }
        };

        // --- Giraffe Body Construction ---

        // Body
        const bodyGeo = new THREE.BoxGeometry(1.0, 1.1, 1.4);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 2.2, 0);
        body.rotation.x = -0.1;
        addSpots(body, 1.0, 1.1, 1.4, 8);
        this.mesh.add(body);

        // Neck
        const neckLen = 2.5;
        const neckGeo = new THREE.BoxGeometry(0.5, neckLen, 0.5);
        const neck = new THREE.Mesh(neckGeo, mat);
        neck.position.set(0, 3.5, 0.8);
        neck.rotation.x = 0.2;
        addSpots(neck, 0.5, neckLen, 0.5, 6);
        this.mesh.add(neck);

        // Head
        // Giraffe head position:
        // y: 3.5 + (neckLen/2 * cos(0.2)) = 4.7
        // z: 0.8 + (neckLen/2 * sin(0.2)) = 1.05
        const headX = 0;
        const headY = 4.8;
        const headZ = 1.2;

        const headGeo = new THREE.BoxGeometry(0.5, 0.6, 0.9);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(headX, headY, headZ);
        this.mesh.add(head);

        // --- Lion Mane ---
        // Mane needs to be around the head.
        // Lion mane was 0.8x0.8x0.5, head was 0.6x0.6x0.7
        // Giraffe head is 0.5x0.6x0.9.
        // We need a mane that fits this.
        const maneGeo = new THREE.BoxGeometry(0.8, 0.9, 0.6);
        const mane = new THREE.Mesh(maneGeo, maneMat);
        // Position slightly back on the head
        mane.position.set(headX, headY, headZ - 0.2);
        this.mesh.add(mane);

        // --- Elephant Trunk ---
        // Attach to front of head.
        // Head range in Z is roughly headZ +/- 0.45. Front face is at headZ + 0.45 = 1.65

        this.trunkPivot = new THREE.Group();
        // Position at front bottom of head
        this.trunkPivot.position.set(headX, headY - 0.1, headZ + 0.5);
        this.mesh.add(this.trunkPivot);

        const trunkSegGeos = [
            new THREE.BoxGeometry(0.2, 0.2, 0.3),
            new THREE.BoxGeometry(0.18, 0.18, 0.3),
            new THREE.BoxGeometry(0.15, 0.15, 0.3),
            new THREE.BoxGeometry(0.12, 0.12, 0.3),
            new THREE.BoxGeometry(0.1, 0.1, 0.25)
        ];

        let prevSegment = this.trunkPivot;
        // The trunk extends forward/down
        for (let i = 0; i < 5; i++) {
            const segmentPivot = new THREE.Group();
            const segment = new THREE.Mesh(trunkSegGeos[i], mat);

            if (i === 0) {
                segmentPivot.position.set(0, 0, 0); // Start at pivot
            } else {
                segmentPivot.position.set(0, 0, 0.25); // Extend along local Z
            }

            // Mesh offset so pivot is at base
            segment.position.set(0, 0, 0.12);

            segmentPivot.add(segment);
            prevSegment.add(segmentPivot);

            this.trunkSegments.push(segmentPivot);
            prevSegment = segmentPivot;
        }

        // Initial Trunk Rotation (Hang down)
        this.trunkPivot.rotation.x = 1.0;

        // Ossicones (Giraffe Horns) - keeping them as they are part of "Giraff"
        const ossiGeo = new THREE.BoxGeometry(0.1, 0.25, 0.1);
        const ossi1 = new THREE.Mesh(ossiGeo, spotMat);
        ossi1.position.set(-0.15, headY + 0.4, headZ - 0.1);
        this.mesh.add(ossi1);

        const ossi2 = new THREE.Mesh(ossiGeo, spotMat);
        ossi2.position.set(0.15, headY + 0.4, headZ - 0.1);
        this.mesh.add(ossi2);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, darkMat);
        leftEye.position.set(-0.26, headY + 0.1, headZ + 0.1);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, darkMat);
        rightEye.position.set(0.26, headY + 0.1, headZ + 0.1);
        this.mesh.add(rightEye);

        // Tail (Giraffe Tail)
        const tailGeo = new THREE.BoxGeometry(0.1, 0.8, 0.1);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 2.0, -0.7);
        tail.rotation.z = 0.1;
        this.mesh.add(tail);

        const tailTip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), spotMat);
        tailTip.position.set(0, -0.4, 0);
        tail.add(tailTip);

        // Legs (Giraffe Long Legs)
        const legLen = 2.0;
        const legGeo = new THREE.BoxGeometry(0.3, legLen, 0.3);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 1.8, z);

            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -legLen / 2, 0);
            addSpots(leg, 0.3, legLen, 0.3, 2);
            pivot.add(leg);

            const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.32), hoofMat);
            hoof.position.set(0, -legLen - 0.1, 0);
            pivot.add(hoof);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.35, 0.4),
            makeLeg(0.35, 0.4),
            makeLeg(-0.35, -0.4),
            makeLeg(0.35, -0.4)
        ];
    }

    updateAnimation(dt) {
        super.updateAnimation(dt);
        this.updateTrunkAnimation(dt);
    }

    updateTrunkAnimation(dt) {
        // Idle swaying
        const baseSwing = Math.sin(this.animTime * 0.8) * 0.1;

        // Gentle swaying
        this.trunkPivot.rotation.x = 1.0 + baseSwing * 0.5;

        for (let i = 0; i < this.trunkSegments.length; i++) {
            // Curl slightly
            this.trunkSegments[i].rotation.x = 0.2 + baseSwing * (i * 0.05);
        }
    }
}
