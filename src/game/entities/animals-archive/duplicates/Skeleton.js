import * as THREE from 'three';
import { Animal } from '../Animal.js';
import { Arrow } from '../Arrow.js';

export class Skeleton extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.6;
        this.height = 1.95;
        this.depth = 0.6;
        this.speed = 1.8;
        this.health = 20;
        this.isHostile = true;
        this.attackRange = 12.0; // Ranged attack
        this.attackCooldown = 2.0;

        this.createBody();
    }

    createBody() {
        const boneMat = new THREE.MeshLambertMaterial({ color: 0xDDDDDD }); // Off-white bones

        // Head Group
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.5, 0);
        this.mesh.add(headGroup);

        const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
        const headMesh = new THREE.Mesh(headGeo, boneMat);
        headMesh.position.set(0, 0.22, 0);
        headGroup.add(headMesh);

        // Eyes (Dark sockets)
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.08, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.12, 0.25, 0.23);
        headGroup.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.12, 0.25, 0.23);
        headGroup.add(rightEye);

        // Mouth socket
        const mouthGeo = new THREE.BoxGeometry(0.2, 0.05, 0.05);
        const mouth = new THREE.Mesh(mouthGeo, eyeMat);
        mouth.position.set(0, 0.1, 0.23);
        headGroup.add(mouth);

        // Body (Ribs/Spine simplified)
        const bodyGeo = new THREE.BoxGeometry(0.4, 0.7, 0.2);
        const bodyMesh = new THREE.Mesh(bodyGeo, boneMat);
        bodyMesh.position.set(0, 1.15, 0);
        this.mesh.add(bodyMesh);

        // Limbs (Thin bones)
        const makeLimb = (x, y, isLeg = false) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, y, 0);
            const h = 0.75;
            const geo = new THREE.BoxGeometry(0.1, h, 0.1);
            const mesh = new THREE.Mesh(geo, boneMat);
            mesh.position.set(0, -h / 2, 0);
            pivot.add(mesh);
            this.mesh.add(pivot);
            return pivot;
        };

        const leftArmPivot = makeLimb(-0.25, 1.4);
        const rightArmPivot = makeLimb(0.25, 1.4);
        const leftLegPivot = makeLimb(-0.12, 0.75, true);
        const rightLegPivot = makeLimb(0.12, 0.75, true);

        this.legParts = [leftLegPivot, rightLegPivot];
        this.armParts = [leftArmPivot, rightArmPivot];

        // Bow
        this.bow = this.createBow();
        rightArmPivot.children[0].add(this.bow);
    }

    createBow() {
        const bowGroup = new THREE.Group();
        const woodMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const handleGeo = new THREE.BoxGeometry(0.04, 0.2, 0.05);
        const handle = new THREE.Mesh(handleGeo, woodMat);
        bowGroup.add(handle);

        const upperGeo = new THREE.BoxGeometry(0.03, 0.3, 0.04);
        const upper = new THREE.Mesh(upperGeo, woodMat);
        upper.position.set(0, 0.2, -0.05);
        upper.rotation.x = -0.4;
        bowGroup.add(upper);

        const lowerGeo = new THREE.BoxGeometry(0.03, 0.3, 0.04);
        const lower = new THREE.Mesh(lowerGeo, woodMat);
        lower.position.set(0, -0.2, -0.05);
        lower.rotation.x = 0.4;
        bowGroup.add(lower);

        bowGroup.position.set(0, -0.4, 0.1);
        bowGroup.rotation.y = -Math.PI / 2;
        return bowGroup;
    }

    attackPlayer(player) {
        // Ranged attack
        const startPos = this.position.clone();
        startPos.y += 1.5; // From bow level

        const targetPos = player.position.clone();
        targetPos.y += 1.0; // Aim for chest

        const dir = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
        const speed = 15;
        const velocity = dir.multiplyScalar(speed);

        const arrow = new Arrow(this.game, startPos, velocity);
        this.game.scene.add(arrow.mesh);
        if (!this.game.projectiles) this.game.projectiles = [];
        this.game.projectiles.push(arrow);

        // Simple arm animation
        this.armParts[0].rotation.x = -Math.PI / 2;
        this.armParts[1].rotation.x = -Math.PI / 2;
    }
}
