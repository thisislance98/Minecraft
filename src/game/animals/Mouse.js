import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Mouse extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.2;
        this.height = 0.15;
        this.depth = 0.3;
        this.speed = 6.0; // Fast and skittish
        this.createBody();
        this.mesh.scale.set(0.5, 0.5, 0.5);

        // Mice are very skittish
        this.fleeOnProximity = true;
        this.fleeRange = 8.0;
    }

    createBody() {
        // Mouse: Grey/Brown coloring
        const bodyColor = 0x808080; // Grey
        const earColor = 0xFFB6C1; // Light pink for ears
        const mat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const earMat = new THREE.MeshLambertMaterial({ color: earColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const tailMat = new THREE.MeshLambertMaterial({ color: 0xDDA0DD }); // Pink tail

        // Body (oval-ish)
        const bodyGeo = new THREE.BoxGeometry(0.15, 0.12, 0.25);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.08, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.12, 0.1, 0.12);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.1, 0.15);
        this.mesh.add(head);

        // Snout
        const snoutGeo = new THREE.BoxGeometry(0.06, 0.05, 0.08);
        const snout = new THREE.Mesh(snoutGeo, mat);
        snout.position.set(0, 0.08, 0.23);
        this.mesh.add(snout);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.03, 0.03, 0.02);
        const nose = new THREE.Mesh(noseGeo, blackMat);
        nose.position.set(0, 0.08, 0.28);
        this.mesh.add(nose);

        // Ears (round-ish)
        const earGeo = new THREE.BoxGeometry(0.06, 0.08, 0.02);

        const leftEar = new THREE.Mesh(earGeo, earMat);
        leftEar.position.set(-0.08, 0.18, 0.12);
        leftEar.rotation.y = -0.3;
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, earMat);
        rightEar.position.set(0.08, 0.18, 0.12);
        rightEar.rotation.y = 0.3;
        this.mesh.add(rightEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.03, 0.03, 0.02);

        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.05, 0.12, 0.2);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.05, 0.12, 0.2);
        this.mesh.add(rightEye);

        // Whiskers (small lines)
        const whiskerGeo = new THREE.BoxGeometry(0.08, 0.01, 0.01);

        const leftWhisker1 = new THREE.Mesh(whiskerGeo, blackMat);
        leftWhisker1.position.set(-0.06, 0.08, 0.24);
        leftWhisker1.rotation.z = 0.2;
        this.mesh.add(leftWhisker1);

        const leftWhisker2 = new THREE.Mesh(whiskerGeo, blackMat);
        leftWhisker2.position.set(-0.06, 0.06, 0.24);
        leftWhisker2.rotation.z = -0.2;
        this.mesh.add(leftWhisker2);

        const rightWhisker1 = new THREE.Mesh(whiskerGeo, blackMat);
        rightWhisker1.position.set(0.06, 0.08, 0.24);
        rightWhisker1.rotation.z = -0.2;
        this.mesh.add(rightWhisker1);

        const rightWhisker2 = new THREE.Mesh(whiskerGeo, blackMat);
        rightWhisker2.position.set(0.06, 0.06, 0.24);
        rightWhisker2.rotation.z = 0.2;
        this.mesh.add(rightWhisker2);

        // Tail (long and thin)
        const tailGeo = new THREE.BoxGeometry(0.02, 0.02, 0.3);
        const tail = new THREE.Mesh(tailGeo, tailMat);
        tail.position.set(0, 0.06, -0.25);
        tail.rotation.x = 0.3; // Slight upward curve
        this.mesh.add(tail);

        // Legs (tiny)
        const legGeo = new THREE.BoxGeometry(0.04, 0.06, 0.04);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.05, z);

            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.03, 0);
            pivot.add(leg);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.05, 0.08),  // Front left
            makeLeg(0.05, 0.08),   // Front right
            makeLeg(-0.05, -0.08), // Back left
            makeLeg(0.05, -0.08)   // Back right
        ];
    }
}
