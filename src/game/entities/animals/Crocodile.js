import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Crocodile extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 1.0;
        this.height = 0.6;
        this.depth = 3.0;
        this.speed = 1.8;
        this.createBody();
    }

    createBody() {
        const skinColor = 0x225522; // Dark Green
        const bellyColor = 0x558855; // Lighter Green
        const scuteColor = 0x113311; // Darker spots/scutes
        const eyeColor = 0xFFFF00; // Yellow eyes

        const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });
        const bellyMat = new THREE.MeshLambertMaterial({ color: bellyColor });
        const scuteMat = new THREE.MeshLambertMaterial({ color: scuteColor });
        const eyeMat = new THREE.MeshLambertMaterial({ color: eyeColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body - Long and low
        const bodyGeo = new THREE.BoxGeometry(0.9, 0.5, 2.0);
        const body = new THREE.Mesh(bodyGeo, skinMat);
        body.position.set(0, 0.5, 0); // Low to ground
        this.mesh.add(body);

        // Belly (a bit thinner/lower)
        const bellyGeo = new THREE.BoxGeometry(0.85, 0.1, 1.9);
        const belly = new THREE.Mesh(bellyGeo, bellyMat);
        belly.position.set(0, 0.25, 0);
        this.mesh.add(belly);

        // Head - Long snout
        const headGeo = new THREE.BoxGeometry(0.7, 0.4, 1.2);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 0.6, 1.5);
        this.mesh.add(head);

        // Snout Tip
        const snoutGeo = new THREE.BoxGeometry(0.5, 0.25, 0.8);
        const snout = new THREE.Mesh(snoutGeo, skinMat);
        snout.position.set(0, 0.5, 2.4);
        this.mesh.add(snout);

        // Eyes (sticking up)
        const eyeBumpGeo = new THREE.BoxGeometry(0.15, 0.15, 0.2);

        const leftEyeBump = new THREE.Mesh(eyeBumpGeo, skinMat);
        leftEyeBump.position.set(-0.25, 0.8, 1.3);
        this.mesh.add(leftEyeBump);

        const rightEyeBump = new THREE.Mesh(eyeBumpGeo, skinMat);
        rightEyeBump.position.set(0.25, 0.8, 1.3);
        this.mesh.add(rightEyeBump);

        // Actual Eyes
        const eyeOrbGeo = new THREE.BoxGeometry(0.05, 0.05, 0.1);
        const leftEye = new THREE.Mesh(eyeOrbGeo, eyeMat);
        leftEye.position.set(-0.33, 0.8, 1.3); // Side facing
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeOrbGeo, eyeMat);
        rightEye.position.set(0.33, 0.8, 1.3);
        this.mesh.add(rightEye);

        // Tail - Long and tapering
        const tailGeo = new THREE.BoxGeometry(0.6, 0.4, 1.5);
        const tail = new THREE.Mesh(tailGeo, skinMat);
        tail.position.set(0, 0.5, -1.6);
        this.mesh.add(tail);

        const tailTipGeo = new THREE.BoxGeometry(0.3, 0.3, 1.0);
        const tailTip = new THREE.Mesh(tailTipGeo, skinMat);
        tailTip.position.set(0, 0.45, -2.8);
        this.mesh.add(tailTip);

        // Spikes/Scutes on back
        const spikeGeo = new THREE.BoxGeometry(0.1, 0.15, 0.1);
        for (let i = 0; i < 5; i++) {
            const spike1 = new THREE.Mesh(spikeGeo, scuteMat);
            spike1.position.set(-0.2, 0.8, 0.8 - i * 0.4);
            this.mesh.add(spike1);

            const spike2 = new THREE.Mesh(spikeGeo, scuteMat);
            spike2.position.set(0.2, 0.8, 0.8 - i * 0.4);
            this.mesh.add(spike2);
        }

        // Legs - Short, splayed
        const legW = 0.25;
        const legH = 0.4;
        const legGeo = new THREE.BoxGeometry(legW, legH, legW);

        const makeLeg = (x, z) => {
            const group = new THREE.Group();
            group.position.set(x, 0.3, z);

            const leg = new THREE.Mesh(legGeo, skinMat);
            leg.position.y = -legH / 2;
            group.add(leg);

            this.mesh.add(group);
            return group;
        };

        this.legParts = [
            makeLeg(-0.6, 0.8),
            makeLeg(0.6, 0.8),
            makeLeg(-0.6, -0.8),
            makeLeg(0.6, -0.8)
        ];
    }
}
