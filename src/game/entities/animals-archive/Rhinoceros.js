import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Rhinoceros extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 1.2;
        this.height = 1.6;
        this.depth = 2.4;
        this.speed = 2.5; // Faster than cow when charging (but normal speed here)
        this.createBody();
    }

    createBody() {
        const greyColor = 0x888899;
        const darkGreyColor = 0x666677;
        const hornColor = 0xEEEEEE;
        const eyeColor = 0x000000;

        const bodyMat = new THREE.MeshLambertMaterial({ color: greyColor });
        const darkMat = new THREE.MeshLambertMaterial({ color: darkGreyColor });
        const hornMat = new THREE.MeshLambertMaterial({ color: hornColor });

        // Body - large chunky block
        const bodyGeo = new THREE.BoxGeometry(1.4, 1.2, 2.2);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 1.2, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.9, 0.9, 1.2);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.set(0, 1.4, 1.6);
        this.mesh.add(head);

        // Big Horn (Front)
        const horn1Geo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
        // Taper it effectively by using a cone? Minecraft uses blocks. 
        // Let's stick to blocks but rotate/position well.
        const horn1 = new THREE.Mesh(horn1Geo, hornMat);
        horn1.position.set(0, 1.9, 2.0); // 1.4(headY) + 0.45(headH/2) approx
        horn1.rotation.x = -0.2;
        this.mesh.add(horn1);

        // Small Horn (Behind first)
        const horn2Geo = new THREE.BoxGeometry(0.15, 0.3, 0.15);
        const horn2 = new THREE.Mesh(horn2Geo, hornMat);
        horn2.position.set(0, 1.9, 1.7);
        horn2.rotation.x = -0.1;
        this.mesh.add(horn2);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.15, 0.2, 0.1);
        const leftEar = new THREE.Mesh(earGeo, darkMat);
        leftEar.position.set(-0.35, 1.8, 1.3);
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, darkMat);
        rightEar.position.set(0.35, 1.8, 1.3);
        this.mesh.add(rightEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const leftEye = new THREE.Mesh(eyeGeo, new THREE.MeshLambertMaterial({ color: eyeColor }));
        leftEye.position.set(-0.46, 1.5, 1.5);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, new THREE.MeshLambertMaterial({ color: eyeColor }));
        rightEye.position.set(0.46, 1.5, 1.5);
        this.mesh.add(rightEye);

        // Legs
        const legW = 0.35;
        const legH = 0.8;
        const legGeo = new THREE.BoxGeometry(legW, legH, legW);
        const hoofGeo = new THREE.BoxGeometry(legW + 0.05, 0.1, legW + 0.05);

        const makeLeg = (x, z) => {
            const group = new THREE.Group();
            group.position.set(x, 0.4, z); // pivot height

            const leg = new THREE.Mesh(legGeo, bodyMat);
            leg.position.set(0, 0, 0); // centered on pivot? No, pivot is top usually.
            // Adjust so pivot is at top of leg
            leg.position.y = -legH / 2 + 0.2; // 

            // Simpler: Pivot is at Y=0.8 (hip). Leg extends down.
            // Let's use the standard way: pivot group at "hip" (y=0.6 relative to ground)
            // But here body is at 1.2, bottom at 0.6.

            const legMesh = new THREE.Mesh(legGeo, bodyMat);
            legMesh.position.y = -legH / 2;
            group.add(legMesh);

            const hoof = new THREE.Mesh(hoofGeo, darkMat);
            hoof.position.y = -legH - 0.05; // Bottom
            // Actually leg center is -legH/2. Bottom is -legH.
            hoof.position.y = -legH + 0.05;
            group.add(hoof);

            this.mesh.add(group);
            return group;
        };

        this.legParts = [
            makeLeg(-0.4, 0.8),  // Front L
            makeLeg(0.4, 0.8),   // Front R
            makeLeg(-0.4, -0.8), // Back L
            makeLeg(0.4, -0.8)   // Back R
        ];
    }
}
