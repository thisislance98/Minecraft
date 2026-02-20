import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Ostrich extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.8;
        this.height = 2.2; // Tall!
        this.depth = 1.0;
        this.speed = 3.5; // Fast!
        this.createBody();
    }

    createBody() {
        const featherColor = 0x111111; // Black (male)
        const featherWhite = 0xEEEEEE; // White tips
        const skinColor = 0xFFC0CB; // Pinkish
        const beakColor = 0xFFA500; // Orange

        const featherMat = new THREE.MeshLambertMaterial({ color: featherColor });
        const whiteMat = new THREE.MeshLambertMaterial({ color: featherWhite });
        const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });
        const beakMat = new THREE.MeshLambertMaterial({ color: beakColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body - Egg shape? Round block.
        const bodyGeo = new THREE.BoxGeometry(0.9, 0.8, 1.1);
        const body = new THREE.Mesh(bodyGeo, featherMat);
        body.position.set(0, 1.4, 0); // High up due to legs
        this.mesh.add(body);

        // Wings (White tips)
        const wingGeo = new THREE.BoxGeometry(0.1, 0.5, 0.7);
        const leftWing = new THREE.Mesh(wingGeo, whiteMat);
        leftWing.position.set(-0.5, 1.4, 0.1);
        this.mesh.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeo, whiteMat);
        rightWing.position.set(0.5, 1.4, 0.1);
        this.mesh.add(rightWing);

        // Neck - Long and thin
        const neckGeo = new THREE.BoxGeometry(0.15, 1.0, 0.15);
        const neck = new THREE.Mesh(neckGeo, skinMat);
        neck.position.set(0, 2.1, 0.4); // Sticking up from front of body
        this.mesh.add(neck);

        // Head
        const headGeo = new THREE.BoxGeometry(0.3, 0.25, 0.4);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 2.65, 0.5);
        this.mesh.add(head);

        // Beak
        const beakGeo = new THREE.BoxGeometry(0.15, 0.08, 0.3);
        const beak = new THREE.Mesh(beakGeo, beakMat);
        beak.position.set(0, 2.62, 0.8);
        this.mesh.add(beak);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.16, 2.68, 0.6);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.16, 2.68, 0.6);
        this.mesh.add(rightEye);

        // Legs - Very long
        const legW = 0.12;
        const legH = 1.4;
        const legGeo = new THREE.BoxGeometry(legW, legH, legW);
        const footGeo = new THREE.BoxGeometry(0.3, 0.1, 0.4);

        const makeLeg = (x, z) => {
            const group = new THREE.Group();
            group.position.set(x, 0.7, z); // Pivot at half leg height basically? 
            // Actually pivot should be at hip.
            // Hip height is body height (1.4). Ground is 0.

            // Let's set group at 1.0
            group.position.set(x, 1.0, z);

            const leg = new THREE.Mesh(legGeo, skinMat);
            leg.position.y = -legH / 2; // Hangs down from 1.0 to 0.3... wait legH is 1.4.
            // If centered at -0.7, top is 0, bottom is -1.4.
            // 1.0 - 1.4 = -0.4. Too low.
            // We want bottom to be 0 at rest.
            // If group Y is 1.0. Leg should go down to -1.0.
            // So leg mesh Y = -0.5. Height 1.0?

            // Let's adjust legH to 1.0 approx.
            // Body Y is 1.4. Bottom of body is 1.0.

            // Re-calc: Leg length 1.0.
            const legMesh = new THREE.Mesh(new THREE.BoxGeometry(legW, 1.0, legW), skinMat);
            legMesh.position.y = -0.5; // Top at 0, Bottom at -1.0.

            group.add(legMesh);

            const foot = new THREE.Mesh(footGeo, skinMat);
            foot.position.set(0, -1.0, 0.1); // Forward foot
            group.add(foot);

            this.mesh.add(group);
            return group;
        };

        this.legParts = [
            makeLeg(-0.25, 0.0),
            makeLeg(0.25, 0.0)
        ];
    }
}
