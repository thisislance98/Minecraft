import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Giraffe extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 1.0;
        this.height = 4.5; // Very tall
        this.depth = 1.5;
        this.speed = 3.0; // Graceful stride
        this.legSwingSpeed = 3; // Slower leg swing due to size
        this.createBody();
        this.mesh.scale.set(0.9, 0.9, 0.9);
    }

    createBody() {
        // Giraffe: Yellow with Brown Spots
        const skinColor = 0xF4C430; // Saffron/Yellow
        const spotColor = 0x8B4513; // Brown
        const hoofColor = 0x2F2F2F;

        const mat = new THREE.MeshLambertMaterial({ color: skinColor });
        const spotMat = new THREE.MeshLambertMaterial({ color: spotColor });
        const hoofMat = new THREE.MeshLambertMaterial({ color: hoofColor });
        const darkMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

        // Helper to add random spots to a mesh
        const addSpots = (parentMesh, width, height, depth, count) => {
            for (let i = 0; i < count; i++) {
                const sW = width * (0.2 + Math.random() * 0.2);
                const sH = height * (0.2 + Math.random() * 0.2);
                const sD = 0.02; // Thin layer

                const spotGeo = new THREE.BoxGeometry(sW, sH, sD);
                const spot = new THREE.Mesh(spotGeo, spotMat);

                // Pick a random face... simplified: just stick on outside
                const face = Math.floor(Math.random() * 4); // 0=front, 1=back, 2=left, 3=right

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

        // Body: Sloped back
        const bodyGeo = new THREE.BoxGeometry(1.0, 1.1, 1.4);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 2.2, 0); // High up legs
        body.rotation.x = -0.1; // Slope up towards neck
        addSpots(body, 1.0, 1.1, 1.4, 8);
        this.mesh.add(body);

        // Neck (Very Long)
        const neckLen = 2.5;
        const neckGeo = new THREE.BoxGeometry(0.5, neckLen, 0.5);
        const neck = new THREE.Mesh(neckGeo, mat);
        neck.position.set(0, 3.5, 0.8);
        neck.rotation.x = 0.2;
        addSpots(neck, 0.5, neckLen, 0.5, 6);
        this.mesh.add(neck);

        // Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.6, 0.9);
        const head = new THREE.Mesh(headGeo, mat);
        // Neck top position approx:
        // y: 3.5 + (neckLen/2 * cos(0.2)) = 3.5 + 1.25*0.98 = 4.7
        // z: 0.8 + (neckLen/2 * sin(0.2)) = 0.8 + 1.25*0.2 = 1.05
        head.position.set(0, 4.8, 1.2);
        this.mesh.add(head);

        // Ossicones (Horn-like bumps)
        const ossiGeo = new THREE.BoxGeometry(0.1, 0.25, 0.1);
        const ossi1 = new THREE.Mesh(ossiGeo, spotMat); // Brown top
        ossi1.position.set(-0.15, 5.2, 1.1);
        this.mesh.add(ossi1);

        const ossi2 = new THREE.Mesh(ossiGeo, spotMat);
        ossi2.position.set(0.15, 5.2, 1.1);
        this.mesh.add(ossi2);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, darkMat);
        leftEye.position.set(-0.26, 4.9, 1.3);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, darkMat);
        rightEye.position.set(0.26, 4.9, 1.3);
        this.mesh.add(rightEye);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.1, 0.8, 0.1);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 2.0, -0.7);
        tail.rotation.z = 0.1;
        this.mesh.add(tail);

        const tailTip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), spotMat);
        tailTip.position.set(0, -0.4, 0);
        tail.add(tailTip);

        // Legs (Long!)
        const legLen = 2.0;
        const legGeo = new THREE.BoxGeometry(0.3, legLen, 0.3);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 1.8, z); // Hip

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
}
