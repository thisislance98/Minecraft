import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Hedgehog extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        // Small, pudgy creature
        this.width = 0.4;
        this.height = 0.3;
        this.depth = 0.5;

        // Slow and waddles around
        this.speed = 1.2;
        this.jumpForce = 5;

        this.createBody();
        console.log('[Hedgehog] Created new hedgehog at', x, y, z);
    }

    createBody() {
        // Brown body color
        const bodyColor = 0x8B4513; // Saddle brown
        const spineColor = 0x3D2914; // Dark brown spines
        const bellyColor = 0xD2B48C; // Tan belly
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const pinkMat = new THREE.MeshLambertMaterial({ color: 0xFFB6C1 }); // Pink nose

        const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const spineMat = new THREE.MeshLambertMaterial({ color: spineColor });
        const bellyMat = new THREE.MeshLambertMaterial({ color: bellyColor });

        // Main body (oval-ish)
        const bodyGeo = new THREE.BoxGeometry(0.35, 0.25, 0.45);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0.15, 0);
        this.mesh.add(body);

        // Belly (lighter colored bottom)
        const bellyGeo = new THREE.BoxGeometry(0.3, 0.08, 0.4);
        const belly = new THREE.Mesh(bellyGeo, bellyMat);
        belly.position.set(0, 0.06, 0);
        this.mesh.add(belly);

        // Head (pointed snout)
        const headGeo = new THREE.BoxGeometry(0.2, 0.18, 0.2);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.set(0, 0.18, 0.3);
        this.mesh.add(head);

        // Snout
        const snoutGeo = new THREE.BoxGeometry(0.1, 0.08, 0.1);
        const snout = new THREE.Mesh(snoutGeo, bellyMat);
        snout.position.set(0, 0.14, 0.42);
        this.mesh.add(snout);

        // Nose (pink)
        const noseGeo = new THREE.BoxGeometry(0.05, 0.05, 0.03);
        const nose = new THREE.Mesh(noseGeo, pinkMat);
        nose.position.set(0, 0.14, 0.48);
        this.mesh.add(nose);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.03);
        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.07, 0.22, 0.38);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.07, 0.22, 0.38);
        this.mesh.add(rightEye);

        // Spines on back (multiple small cones/pyramids)
        const spineGeo = new THREE.ConeGeometry(0.03, 0.12, 4);

        // Create grid of spines on the back
        const spinePositions = [
            // Row 1 (back)
            [-0.12, 0.28, -0.15],
            [0, 0.30, -0.15],
            [0.12, 0.28, -0.15],
            // Row 2
            [-0.10, 0.30, -0.05],
            [0.05, 0.32, -0.05],
            [0.10, 0.30, -0.05],
            [-0.05, 0.32, -0.08],
            // Row 3 (middle)
            [-0.08, 0.30, 0.05],
            [0, 0.32, 0.02],
            [0.08, 0.30, 0.05],
            // Row 4 (near head)
            [-0.06, 0.28, 0.12],
            [0.06, 0.28, 0.12],
        ];

        for (const pos of spinePositions) {
            const spine = new THREE.Mesh(spineGeo, spineMat);
            spine.position.set(pos[0], pos[1], pos[2]);
            // Slight random rotation for natural look
            spine.rotation.x = -0.2 + Math.random() * 0.4;
            spine.rotation.z = -0.2 + Math.random() * 0.4;
            this.mesh.add(spine);
        }

        // Small ears
        const earGeo = new THREE.BoxGeometry(0.06, 0.06, 0.03);
        const leftEar = new THREE.Mesh(earGeo, bodyMat);
        leftEar.position.set(-0.08, 0.28, 0.25);
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, bodyMat);
        rightEar.position.set(0.08, 0.28, 0.25);
        this.mesh.add(rightEar);

        // Tiny legs
        const legGeo = new THREE.BoxGeometry(0.06, 0.08, 0.06);
        const makeLeg = (x, z) => {
            const leg = new THREE.Mesh(legGeo, bodyMat);
            leg.position.set(x, 0.04, z);
            this.mesh.add(leg);
            return leg;
        };

        // Four stubby legs
        this.legs = [
            makeLeg(-0.12, 0.15),  // Front left
            makeLeg(0.12, 0.15),   // Front right
            makeLeg(-0.12, -0.15), // Back left
            makeLeg(0.12, -0.15),  // Back right
        ];
    }

    updateAI(dt) {
        // Hedgehogs are peaceful, just wander around slowly
        // Curl up when threatened (freeze in place)
        if (this.checkProximityFlee(4.0)) {
            // When scared, hedgehog curls up (stops moving)
            this.state = 'idle';
            this.isMoving = false;
            this.stateTimer = 2.0; // Stay curled for 2 seconds
            return;
        }

        super.updateAI(dt);
    }
}
