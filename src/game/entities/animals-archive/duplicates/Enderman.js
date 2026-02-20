import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Enderman extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.6;
        this.height = 3.0; // Tall
        this.depth = 0.6;
        this.speed = 3.5; // Fast
        this.health = 40; // Tanky
        this.damage = 7; // Strong
        this.isHostile = true;
        this.detectionRange = 24.0;

        this.createBody();
    }

    createBody() {
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const eyesMat = new THREE.MeshLambertMaterial({ color: 0xCC00FF }); // Glowing purple eyes

        // Head
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 2.5, 0);
        this.mesh.add(headGroup);

        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const headMesh = new THREE.Mesh(headGeo, blackMat);
        headMesh.position.set(0, 0.2, 0);
        headGroup.add(headMesh);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.15, 0.05, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, eyesMat);
        leftEye.position.set(-0.1, 0.2, 0.21);
        headGroup.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyesMat);
        rightEye.position.set(0.1, 0.2, 0.21);
        headGroup.add(rightEye);

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.4, 0.8, 0.2);
        const bodyMesh = new THREE.Mesh(bodyGeo, blackMat);
        bodyMesh.position.set(0, 2.1, 0);
        this.mesh.add(bodyMesh);

        // Limbs (Very long)
        const makeLimb = (x, y, isLeg = false) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, y, 0);
            const h = 1.6;
            const geo = new THREE.BoxGeometry(0.12, h, 0.12);
            const mesh = new THREE.Mesh(geo, blackMat);
            mesh.position.set(0, -h / 2, 0);
            pivot.add(mesh);
            this.mesh.add(pivot);
            return pivot;
        };

        const leftArmPivot = makeLimb(-0.25, 2.4);
        const rightArmPivot = makeLimb(0.25, 2.4);
        const leftLegPivot = makeLimb(-0.12, 1.6, true);
        const rightLegPivot = makeLimb(0.12, 1.6, true);

        this.legParts = [leftLegPivot, rightLegPivot];
        this.armParts = [leftArmPivot, rightArmPivot];
    }

    takeDamage(amount, attacker) {
        super.takeDamage(amount, attacker);
        // Teleport on damage
        this.teleport();
    }

    teleport() {
        const range = 10;
        const tx = this.position.x + (Math.random() - 0.5) * range * 2;
        const tz = this.position.z + (Math.random() - 0.5) * range * 2;
        const ty = this.game.worldGen.getTerrainHeight(tx, tz) + 1;

        // Particle effect would be nice, but for now just move
        this.position.set(tx, ty, tz);
        this.velocity.set(0, 0, 0);

        // Face player after teleport
        const dir = new THREE.Vector3().subVectors(this.game.player.position, this.position);
        dir.y = 0;
        dir.normalize();
        this.rotation = Math.atan2(dir.x, dir.z);
    }

    updateAI(dt) {
        super.updateAI(dt);
        // Occasional random teleport if chasing
        if (this.state === 'chase' && Math.random() < 0.005) {
            this.teleport();
        }
    }
}
