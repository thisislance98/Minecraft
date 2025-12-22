import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class TRex extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        // Make it huge
        this.width = 2.0;
        this.height = 4.0;
        this.depth = 4.0;
        this.speed = 3.5; // Big strides but maybe not super fast acceleration? Or scary fast? Let's go with moderate.
        this.createBody();
    }

    createBody() {
        // T-Rex: Green
        const skinColor = 0x4C9A2A; // Forest Green
        const bellyColor = 0x8FBC8F; // Dark Sea Green
        const clawColor = 0x333333; // Dark Grey

        const mat = new THREE.MeshLambertMaterial({ color: skinColor });
        const bellyMat = new THREE.MeshLambertMaterial({ color: bellyColor });
        const clawMat = new THREE.MeshLambertMaterial({ color: clawColor });

        // Main Body (Hips/Torso)
        // Angled slightly up
        const bodyGeo = new THREE.BoxGeometry(1.8, 2.0, 3.5);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 3.5, 0); // High up
        body.rotation.x = -0.2; // Tilt up slightly
        this.mesh.add(body);

        // Neck (thick)
        const neckGeo = new THREE.BoxGeometry(1.2, 1.5, 1.2);
        const neck = new THREE.Mesh(neckGeo, mat);
        neck.position.set(0, 4.8, 1.5);
        neck.rotation.x = -0.4;
        this.mesh.add(neck);

        // Head
        const headGeo = new THREE.BoxGeometry(1.4, 1.5, 2.2);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 5.8, 2.2);
        this.mesh.add(head);

        // Jaw/Mouth (Let's make it look open or distinct)
        const jawGeo = new THREE.BoxGeometry(1.2, 0.4, 1.8);
        const jaw = new THREE.Mesh(jawGeo, bellyMat);
        jaw.position.set(0, 5.2, 2.4);
        jaw.rotation.x = 0.1; // Open mouth slightly
        this.mesh.add(jaw);

        // Eyes
        const eyeColor = 0xFFFF00; // Yellow eyes
        const eyeMat = new THREE.MeshLambertMaterial({ color: eyeColor });
        const pupilMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        const eyeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.1);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.7, 6.0, 2.5);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.7, 6.0, 2.5);
        this.mesh.add(rightEye);

        // Tail (thick base, tapering)
        const tailGeo1 = new THREE.BoxGeometry(1.4, 1.4, 2.5);
        const tail1 = new THREE.Mesh(tailGeo1, mat);
        tail1.position.set(0, 3.0, -2.0);
        tail1.rotation.x = -0.1;
        this.mesh.add(tail1);

        const tailGeo2 = new THREE.BoxGeometry(1.0, 1.0, 2.5);
        const tail2 = new THREE.Mesh(tailGeo2, mat);
        tail2.position.set(0, 2.8, -4.0);
        tail2.rotation.x = -0.05;
        this.mesh.add(tail2);

        // Legs (Huge hind legs)
        const legGeo = new THREE.BoxGeometry(1.0, 2.5, 1.4);

        // Thighs
        const leftThigh = new THREE.Mesh(legGeo, mat);
        leftThigh.position.set(-1.1, 2.5, 0);
        this.mesh.add(leftThigh);

        const rightThigh = new THREE.Mesh(legGeo, mat);
        rightThigh.position.set(1.1, 2.5, 0);
        this.mesh.add(rightThigh);

        // Lower Legs (The parts that move)
        const shinGeo = new THREE.BoxGeometry(0.8, 2.0, 0.8);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 1.5, z); // Pivot at knee
            const shin = new THREE.Mesh(shinGeo, mat);
            shin.position.set(0, -1.0, 0);
            pivot.add(shin);

            // Foot
            const footGeo = new THREE.BoxGeometry(1.0, 0.5, 1.5);
            const foot = new THREE.Mesh(footGeo, clawMat);
            foot.position.set(0, -2.0, 0.5);
            pivot.add(foot);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-1.1, 0.2), // Left
            makeLeg(1.1, 0.2)   // Right
        ];

        // Tiny Arms
        const armGeo = new THREE.BoxGeometry(0.3, 0.8, 0.3);

        const leftArm = new THREE.Mesh(armGeo, mat);
        leftArm.position.set(-1.0, 3.5, 1.5);
        leftArm.rotation.x = -0.5; // Point forward/down
        this.mesh.add(leftArm);

        const rightArm = new THREE.Mesh(armGeo, mat);
        rightArm.position.set(1.0, 3.5, 1.5);
        rightArm.rotation.x = -0.5;
        this.mesh.add(rightArm);
    }
}
