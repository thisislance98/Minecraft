import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Camel extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.9;
        this.height = 2.0;
        this.depth = 1.8;
        this.speed = 3.5; // Camels are decent runners
        this.legSwingSpeed = 6;
        this.createBody();
    }

    createBody() {
        // Camel: Sandy tan color
        const furColor = 0xC4A76C;
        const darkFurColor = 0xA68B4B;
        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const darkMat = new THREE.MeshLambertMaterial({ color: darkFurColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xF5F5F5 });

        // Body (elongated)
        const bodyGeo = new THREE.BoxGeometry(0.8, 0.7, 1.4);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 1.6, 0);
        this.mesh.add(body);

        // Humps (Two humps for Bactrian camel style)
        const humpGeo = new THREE.BoxGeometry(0.5, 0.4, 0.4);

        const frontHump = new THREE.Mesh(humpGeo, mat);
        frontHump.position.set(0, 2.1, 0.35);
        this.mesh.add(frontHump);

        const backHump = new THREE.Mesh(humpGeo, mat);
        backHump.position.set(0, 2.1, -0.35);
        this.mesh.add(backHump);

        // Neck (Long and curved forward)
        const neckGeo = new THREE.BoxGeometry(0.35, 0.8, 0.35);
        const neck = new THREE.Mesh(neckGeo, mat);
        neck.position.set(0, 2.0, 0.8);
        neck.rotation.x = Math.PI / 6; // Angled forward
        this.mesh.add(neck);

        // Head (Long face)
        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.6);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 2.4, 1.2);
        this.mesh.add(head);

        // Snout/Muzzle
        const snoutGeo = new THREE.BoxGeometry(0.3, 0.25, 0.3);
        const snout = new THREE.Mesh(snoutGeo, darkMat);
        snout.position.set(0, 2.3, 1.5);
        this.mesh.add(snout);

        // Nostrils
        const nostrilGeo = new THREE.BoxGeometry(0.08, 0.06, 0.05);

        const leftNostril = new THREE.Mesh(nostrilGeo, blackMat);
        leftNostril.position.set(-0.08, 2.32, 1.65);
        this.mesh.add(leftNostril);

        const rightNostril = new THREE.Mesh(nostrilGeo, blackMat);
        rightNostril.position.set(0.08, 2.32, 1.65);
        this.mesh.add(rightNostril);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.1, 0.08);
        const pupilGeo = new THREE.BoxGeometry(0.05, 0.06, 0.05);

        const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.2, 2.5, 1.25);
        this.mesh.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.23, 2.5, 1.28);
        this.mesh.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.2, 2.5, 1.25);
        this.mesh.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.23, 2.5, 1.28);
        this.mesh.add(rightPupil);

        // Ears (Small and furry)
        const earGeo = new THREE.BoxGeometry(0.12, 0.18, 0.08);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.18, 2.7, 1.1);
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.18, 2.7, 1.1);
        this.mesh.add(rightEar);

        // Tail (Short with tuft)
        const tailPivot = new THREE.Group();
        tailPivot.position.set(0, 1.6, -0.7);

        const tailGeo = new THREE.BoxGeometry(0.12, 0.5, 0.12);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, -0.25, 0);
        tailPivot.add(tail);

        // Tail tuft
        const tuftGeo = new THREE.BoxGeometry(0.15, 0.2, 0.15);
        const tuft = new THREE.Mesh(tuftGeo, darkMat);
        tuft.position.set(0, -0.55, 0);
        tailPivot.add(tuft);

        tailPivot.rotation.x = 0.3;
        this.mesh.add(tailPivot);
        this.tailPivot = tailPivot;

        // Long legs
        const legGeo = new THREE.BoxGeometry(0.25, 1.3, 0.25);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 1.3, z);
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.65, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.25, 0.5),
            makeLeg(0.25, 0.5),
            makeLeg(-0.25, -0.5),
            makeLeg(0.25, -0.5)
        ];
    }

    updateAnimation(dt) {
        super.updateAnimation(dt);

        // Animate tail swishing
        if (this.tailPivot) {
            const tailSwing = Math.sin(this.animTime * 0.5) * 0.15;
            this.tailPivot.rotation.z = tailSwing;
        }
    }
}
