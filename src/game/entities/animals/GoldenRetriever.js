import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class GoldenRetriever extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.6;
        this.height = 0.9;
        this.depth = 1.2;
        this.speed = 4.0;
        this.createBody();
    }

    createBody() {
        // Golden Retriever: Gold
        const furColor = 0xD4AF37; // Metallic Gold / Goldenrod
        const noseColor = 0x111111;

        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const noseMat = new THREE.MeshLambertMaterial({ color: noseColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.6, 0.6, 1.1);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.6, 0);
        this.mesh.add(body);

        // Neck/Chest fluff
        const neckGeo = new THREE.BoxGeometry(0.5, 0.5, 0.4);
        const neck = new THREE.Mesh(neckGeo, mat);
        neck.position.set(0, 0.75, 0.5);
        this.mesh.add(neck);

        // Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.55, 0.55);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 1.0, 0.75);
        this.mesh.add(head);

        // Snout
        const snoutGeo = new THREE.BoxGeometry(0.3, 0.25, 0.35);
        const snout = new THREE.Mesh(snoutGeo, mat);
        snout.position.set(0, 0.9, 1.15);
        this.mesh.add(snout);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.12, 0.1, 0.05);
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 1.0, 1.33);
        this.mesh.add(nose);

        // Floppy Ears
        const earGeo = new THREE.BoxGeometry(0.1, 0.35, 0.2);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.3, 1.0, 0.75);
        leftEar.rotation.z = 0.1; // Slight angle out
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.3, 1.0, 0.75);
        rightEar.rotation.z = -0.1;
        this.mesh.add(rightEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);

        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.15, 1.1, 1.03);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.15, 1.1, 1.03);
        this.mesh.add(rightEye);

        // Bushy Tail
        const tailGeo = new THREE.BoxGeometry(0.2, 0.2, 0.8);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 0.75, -0.7);
        tail.rotation.x = -0.2; // Slightly down/habitual wag position
        this.mesh.add(tail);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.6, z);

            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.3, 0);
            pivot.add(leg);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.2, 0.35), // Front Left
            makeLeg(0.2, 0.35),  // Front Right
            makeLeg(-0.2, -0.35), // Back Left
            makeLeg(0.2, -0.35)   // Back Right
        ];
    }
}
