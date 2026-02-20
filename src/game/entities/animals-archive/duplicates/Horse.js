import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Horse extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.8;
        this.height = 1.2;
        this.depth = 1.6;
        this.speed = 4.0;
        this.legSwingSpeed = 10; // Faster animation for horses
        this.createBody();
        this.mesh.scale.set(0.75, 0.75, 0.75);
    }

    createBody() {
        // Horse: Brown
        const skinColor = 0xA0522D;
        const mat = new THREE.MeshLambertMaterial({ color: skinColor });
        const darkMat = new THREE.MeshLambertMaterial({ color: 0x4B2510 }); // Hooves/Mane
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF }); // Eyes
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 }); // Pupils

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.9, 0.8, 1.4);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 1.1, 0);
        this.mesh.add(body);

        // Neck/Head
        const neckGeo = new THREE.BoxGeometry(0.4, 0.7, 0.4);
        const neck = new THREE.Mesh(neckGeo, mat);
        neck.position.set(0, 1.5, 0.7);
        neck.rotation.x = Math.PI / 4; // Angled forward
        this.mesh.add(neck);

        const headGeo = new THREE.BoxGeometry(0.55, 0.55, 1.0);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 1.9, 1.15); // Lower and closer to body
        head.rotation.x = Math.PI / 6; // leveling head (nose down)
        this.mesh.add(head);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.12, 0.18, 0.1);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.2, 2.3, 0.85); // Adjusted for new head pos
        leftEar.rotation.x = Math.PI / 6; // Match head tilt
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.2, 2.3, 0.85);
        rightEar.rotation.x = Math.PI / 6;
        this.mesh.add(rightEar);

        // Eyes (on sides of head)
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.12, 0.12);
        const pupilGeo = new THREE.BoxGeometry(0.04, 0.08, 0.08);

        // Left eye
        const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.28, 2.0, 1.35);
        this.mesh.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.31, 2.0, 1.38);
        this.mesh.add(leftPupil);

        // Right eye
        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.28, 2.0, 1.35);
        this.mesh.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.31, 2.0, 1.38);
        this.mesh.add(rightPupil);

        // Mane (along neck and top of head)
        const maneGeo = new THREE.BoxGeometry(0.15, 0.5, 0.25);
        const mane = new THREE.Mesh(maneGeo, darkMat);
        mane.position.set(0, 1.7, 0.65); // Adjusted for shorter neck
        mane.rotation.x = Math.PI / 4;
        this.mesh.add(mane);

        // Mane on top of head
        const headManeGeo = new THREE.BoxGeometry(0.12, 0.2, 0.4);
        const headMane = new THREE.Mesh(headManeGeo, darkMat);
        headMane.position.set(0, 2.25, 1.05); // Adjusted for new head
        this.mesh.add(headMane);

        // Tail (at the back of the body)
        const tailPivot = new THREE.Group();
        tailPivot.position.set(0, 1.3, -0.7);

        const tailGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);
        const tail = new THREE.Mesh(tailGeo, darkMat);
        tail.position.set(0, -0.3, 0);
        tailPivot.add(tail);

        // Tail tip (flowing part)
        const tailTipGeo = new THREE.BoxGeometry(0.12, 0.4, 0.12);
        const tailTip = new THREE.Mesh(tailTipGeo, darkMat);
        tailTip.position.set(0, -0.7, 0);
        tailPivot.add(tailTip);

        tailPivot.rotation.x = 0.3; // Slight angle
        this.mesh.add(tailPivot);
        this.tailPivot = tailPivot;

        // Legs
        const legGeo = new THREE.BoxGeometry(0.3, 0.9, 0.3);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.9, z);
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.45, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.3, 0.5),
            makeLeg(0.3, 0.5),
            makeLeg(-0.3, -0.5),
            makeLeg(0.3, -0.5)
        ];
    }

    updateAnimation(dt) {
        super.updateAnimation(dt);

        // Animate tail swishing
        if (this.tailPivot) {
            const tailSwing = Math.sin(this.animTime * 0.5) * 0.2;
            this.tailPivot.rotation.z = tailSwing;
        }
    }
}
