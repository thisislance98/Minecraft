import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Frog extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.4;
        this.height = 0.3;
        this.depth = 0.4;
        this.speed = 2.0;
        this.jumpForce = 8;
        this.canHop = true; // Frogs hop up mountains
        this.avoidsWater = false; // Frogs are amphibians
        this.createBody();
    }

    createBody() {
        // Frog: Green
        const skinColor = 0x4CAF50;
        const mat = new THREE.MeshLambertMaterial({ color: skinColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.4, 0.2, 0.4);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.15, 0);
        this.mesh.add(body);

        // Eyes (On top)
        const eyeBumpGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);

        const leftEyeBump = new THREE.Mesh(eyeBumpGeo, mat);
        leftEyeBump.position.set(-0.12, 0.25, 0.1);
        this.mesh.add(leftEyeBump);

        const rightEyeBump = new THREE.Mesh(eyeBumpGeo, mat);
        rightEyeBump.position.set(0.12, 0.25, 0.1);
        this.mesh.add(rightEyeBump);

        // Pupils
        const pupilGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.12, 0.28, 0.15);
        this.mesh.add(leftPupil);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.12, 0.28, 0.15);
        this.mesh.add(rightPupil);

        // Legs (visual only)
        const legGeo = new THREE.BoxGeometry(0.1, 0.1, 0.2);

        // Back Legs
        const leftBackLeg = new THREE.Mesh(legGeo, mat);
        leftBackLeg.position.set(-0.2, 0.1, -0.15);
        leftBackLeg.rotation.y = 0.5;
        this.mesh.add(leftBackLeg);

        const rightBackLeg = new THREE.Mesh(legGeo, mat);
        rightBackLeg.position.set(0.2, 0.1, -0.15);
        rightBackLeg.rotation.y = -0.5;
        this.mesh.add(rightBackLeg);

        // Front Legs
        const frontLegGeo = new THREE.BoxGeometry(0.1, 0.2, 0.1);
        const leftFront = new THREE.Mesh(frontLegGeo, mat);
        leftFront.position.set(-0.15, 0.1, 0.15);
        this.mesh.add(leftFront);

        const rightFront = new THREE.Mesh(frontLegGeo, mat);
        rightFront.position.set(0.15, 0.1, 0.15);
        this.mesh.add(rightFront);

        this.legParts = [];
    }

    updatePhysics(dt) {
        if (this.state === 'walk' && this.onGround) {
            this.velocity.y = this.jumpForce;
            this.onGround = false;
        }
        super.updatePhysics(dt);
    }
}
