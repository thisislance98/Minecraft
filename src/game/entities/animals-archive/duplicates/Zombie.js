import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Zombie extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.6;
        this.height = 1.95;
        this.depth = 0.6;
        this.speed = 1.5;
        this.health = 20;
        this.damage = 3;
        this.isHostile = true;

        this.createBody();
    }

    createBody() {
        const skinMat = new THREE.MeshLambertMaterial({ color: 0x1d7a21 }); // Green skin
        const shirtMat = new THREE.MeshLambertMaterial({ color: 0x00AAAA }); // Cyan shirt
        const pantsMat = new THREE.MeshLambertMaterial({ color: 0x3333AA }); // Indigo pants

        // Head Group
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.5, 0);
        this.mesh.add(headGroup);

        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const headMesh = new THREE.Mesh(headGeo, skinMat);
        headMesh.position.set(0, 0.25, 0);
        headGroup.add(headMesh);

        // Eyes
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.05, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.15, 0.25, 0.26);
        headGroup.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.15, 0.25, 0.26);
        headGroup.add(rightEye);

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.8, 0.3);
        const bodyMesh = new THREE.Mesh(bodyGeo, shirtMat);
        bodyMesh.position.set(0, 1.1, 0);
        this.mesh.add(bodyMesh);

        // Limbs
        const makeLimb = (x, y, mat, isLeg = false) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, y, 0);
            const h = 0.7;
            const geo = new THREE.BoxGeometry(0.2, h, 0.2);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(0, -h / 2, 0);
            pivot.add(mesh);
            this.mesh.add(pivot);
            return pivot;
        };

        const leftArmPivot = makeLimb(-0.35, 1.45, skinMat);
        const rightArmPivot = makeLimb(0.35, 1.45, skinMat);
        const leftLegPivot = makeLimb(-0.15, 0.7, pantsMat, true);
        const rightLegPivot = makeLimb(0.15, 0.7, pantsMat, true);

        // Zombies hold arms forward
        leftArmPivot.rotation.x = -Math.PI / 2;
        rightArmPivot.rotation.x = -Math.PI / 2;

        this.legParts = [leftLegPivot, rightLegPivot];
        this.armParts = [leftArmPivot, rightArmPivot];
    }
}
