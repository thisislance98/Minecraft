import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class WienerDog extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.5;
        this.height = 0.6; // Low to ground
        this.depth = 1.4; // Long boy
        this.speed = 3.5;
        this.createBody();
    }

    createBody() {
        // Wiener Dog: Brown/Tan
        const furColor = 0x8B4513; // Saddle Brown
        const earColor = 0xD35400; // Fox Orange for ears/tail as requested (or just brown? Request said "fox ears and tail", implies fox looking parts)
        // Actually "fox ears and tail" usually implies the shape, but maybe the color too? 
        // Let's make the dog brown, but the specific fox parts match the fox style (orangeish) or blend them?
        // "wiener dog with fox ears and tail" -> A chimeara. Let's make the ears and tail Orange to highlight them, or just same brown?
        // Usually these requests imply the distinct features. I'll make them Fox Orange to be distinct and cool.
        const foxOrange = 0xD35400;
        const whiteFur = 0xFFFFFF;
        const blackColor = 0x1A1A1A;

        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const foxMat = new THREE.MeshLambertMaterial({ color: foxOrange });
        const whiteMat = new THREE.MeshLambertMaterial({ color: whiteFur });
        const blackMat = new THREE.MeshLambertMaterial({ color: blackColor });

        // Body (Long sausage)
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.4, 1.2);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.4, 0); // Low center
        this.mesh.add(body);

        // Neck
        const neckGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const neck = new THREE.Mesh(neckGeo, mat);
        neck.position.set(0, 0.6, 0.5);
        neck.rotation.x = -0.2;
        this.mesh.add(neck);

        // Head
        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.5);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.8, 0.7);
        this.mesh.add(head);

        // Snout
        const snoutGeo = new THREE.BoxGeometry(0.2, 0.15, 0.3);
        const snout = new THREE.Mesh(snoutGeo, mat);
        snout.position.set(0, 0.75, 1.05);
        this.mesh.add(snout);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
        const nose = new THREE.Mesh(noseGeo, blackMat);
        nose.position.set(0, 0.8, 1.18);
        this.mesh.add(nose);

        // --- FOX EARS ---
        const earGeo = new THREE.BoxGeometry(0.12, 0.25, 0.08);

        const leftEar = new THREE.Mesh(earGeo, foxMat);
        leftEar.position.set(-0.15, 1.05, 0.7);
        leftEar.rotation.z = 0.2;
        this.mesh.add(leftEar);

        // Left ear inner (black)
        const earInnerGeo = new THREE.BoxGeometry(0.08, 0.18, 0.05);
        const leftEarInner = new THREE.Mesh(earInnerGeo, blackMat);
        leftEarInner.position.set(-0.15, 1.02, 0.72);
        leftEarInner.rotation.z = 0.2;
        this.mesh.add(leftEarInner);

        const rightEar = new THREE.Mesh(earGeo, foxMat);
        rightEar.position.set(0.15, 1.05, 0.7);
        rightEar.rotation.z = -0.2;
        this.mesh.add(rightEar);

        // Right ear inner (black)
        const rightEarInner = new THREE.Mesh(earInnerGeo, blackMat);
        rightEarInner.position.set(0.15, 1.02, 0.72);
        rightEarInner.rotation.z = -0.2;
        this.mesh.add(rightEarInner);

        // --- FOX TAIL ---
        // Fluffy tail (signature fox tail with white tip)
        const tailGeo = new THREE.BoxGeometry(0.2, 0.22, 0.8);
        const tail = new THREE.Mesh(tailGeo, foxMat);
        tail.position.set(0, 0.5, -0.8);
        tail.rotation.x = 0.2; // Stick out a bit
        this.mesh.add(tail);

        // Tail white tip
        const tailTipGeo = new THREE.BoxGeometry(0.18, 0.2, 0.25);
        const tailTip = new THREE.Mesh(tailTipGeo, whiteMat);
        tailTip.position.set(0, 0.58, -1.15);
        tailTip.rotation.x = 0.2;
        this.mesh.add(tailTip);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.05);

        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.12, 0.85, 0.95);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.12, 0.85, 0.95);
        this.mesh.add(rightEye);

        // Legs (Short!)
        const legGeo = new THREE.BoxGeometry(0.12, 0.25, 0.12);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.25, z); // Low pivot

            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.12, 0);
            pivot.add(leg);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.15, 0.4),
            makeLeg(0.15, 0.4),
            makeLeg(-0.15, -0.4),
            makeLeg(0.15, -0.4)
        ];
    }
}
