import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Turtle extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.8;
        this.height = 0.5;
        this.depth = 0.8;
        this.speed = 1.0;
        this.createBody();
    }

    createBody() {
        const shellColor = 0x228B22;
        const skinColor = 0x90EE90;

        const shellMat = new THREE.MeshLambertMaterial({ color: shellColor });
        const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });

        // Shell
        const shellGeo = new THREE.BoxGeometry(0.7, 0.4, 0.8);
        const shell = new THREE.Mesh(shellGeo, shellMat);
        shell.position.set(0, 0.4, 0);
        this.mesh.add(shell);

        // Head
        const headGeo = new THREE.BoxGeometry(0.25, 0.25, 0.3);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 0.5, 0.5);
        this.mesh.add(head);

        // Eyes
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const eyeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.08, 0.55, 0.63);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.08, 0.55, 0.63);
        this.mesh.add(rightEye);

        // Nose
        const noseMat = new THREE.MeshLambertMaterial({ color: 0x1a661a }); // Slightly darker green
        const noseGeo = new THREE.BoxGeometry(0.06, 0.04, 0.02);
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 0.48, 0.65);
        this.mesh.add(nose);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.15, 0.2, 0.15);
        const makeLeg = (x, z) => {
            const l = new THREE.Mesh(legGeo, skinMat);
            l.position.set(x, 0.2, z);
            this.mesh.add(l);
            return l;
        };

        this.legParts = [
            makeLeg(-0.3, 0.35),
            makeLeg(0.3, 0.35),
            makeLeg(-0.3, -0.35),
            makeLeg(0.3, -0.35)
        ];
    }

    updatePhysics(dt) {
        const pos = this.position;
        const block = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));

        if (block && block.type === 'water') {
            this.velocity.y -= 5.0 * dt;
            if (this.velocity.y < -2) this.velocity.y = -2;

            if (this.state === 'walk') {
                this.position.x += this.moveDirection.x * this.speed * dt;
                this.position.z += this.moveDirection.z * this.speed * dt;
            }

            this.position.y += this.velocity.y * dt;

            if (this.checkBodyCollision(this.position.x, this.position.y, this.position.z)) {
                const y = Math.floor(this.position.y);
                if (this.game.getBlock(Math.floor(this.position.x), y, Math.floor(this.position.z))) {
                    this.position.y = y + 1;
                }
            }
        } else {
            super.updateWalkerPhysics(dt);
        }
    }
}
