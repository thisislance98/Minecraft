import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class TRex extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 2.0;
        this.height = 5.0;
        this.depth = 6.0;
        this.speed = 4.0;
        this.health = 50;
        this.maxHealth = 50;
        this.damage = 10;
        this.detectionRange = 40;
        this.attackRange = 6;
        this.isHostile = true;
        this.createBody();

        // Scale the model
        this.mesh.scale.set(1.5, 1.5, 1.5);

        // Make T-Rex immune to proximity flee (it's the apex predator!)
        this.fleeOnProximity = false;
    }

    createBody() {
        // Materials
        const skinColor = 0x556B2F; // Dark Olive Green
        const bellyColor = 0x8FBC8F; // Dark Sea Green (lighter belly)
        const toothColor = 0xFFFFFF;
        const clawColor = 0x2F2F2F;

        const mat = new THREE.MeshLambertMaterial({ color: skinColor });
        const bellyMat = new THREE.MeshLambertMaterial({ color: bellyColor });
        const toothMat = new THREE.MeshLambertMaterial({ color: toothColor });
        const clawMat = new THREE.MeshLambertMaterial({ color: clawColor });

        // --- Main Body Group ---
        // Pivot point at feet center? No, Animal.js usually centers at 0,0,0 (feet level) or center of body?
        // Animal.js: this.mesh.position.copy(this.position);
        // And usually animals have feet at Y=0 relative to mesh, or mesh intersects ground?
        // Pig.js body is at Y=0.6, legs go down. Feet at Y ~= 0.
        // So we build from Y=0 upwards.

        // 1. Torso (Horizontal)
        const torsoGeo = new THREE.BoxGeometry(1.4, 1.6, 2.8);
        const torso = new THREE.Mesh(torsoGeo, mat);
        torso.position.set(0, 2.5, 0); // High up
        this.mesh.add(torso);

        // Belly Patch
        const bellyGeo = new THREE.BoxGeometry(1.2, 0.1, 2.0);
        const belly = new THREE.Mesh(bellyGeo, bellyMat);
        belly.position.set(0, 1.71, 0);
        this.mesh.add(belly);

        // 2. Neck (Angled Upwards)
        const neckGeo = new THREE.BoxGeometry(1.0, 1.2, 1.0);
        const neck = new THREE.Mesh(neckGeo, mat);
        neck.position.set(0, 3.2, 1.6); // Up and Forward (+Z)
        neck.rotation.x = -0.4; // Tilt back/up
        this.mesh.add(neck);

        // 3. Head (Blocky T-Rex head)
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 3.8, 2.2);
        this.mesh.add(headGroup);

        // Cranium
        const craniumGeo = new THREE.BoxGeometry(1.1, 1.0, 1.2);
        const cranium = new THREE.Mesh(craniumGeo, mat);
        cranium.position.set(0, 0, 0);
        headGroup.add(cranium);

        // Snout
        const snoutGeo = new THREE.BoxGeometry(0.9, 0.7, 1.0);
        const snout = new THREE.Mesh(snoutGeo, mat);
        snout.position.set(0, -0.1, 1.0); // Forward from cranium
        headGroup.add(snout);

        // Jaw (Lower) - Can articulate?
        const jawGeo = new THREE.BoxGeometry(0.8, 0.3, 1.8);
        const jaw = new THREE.Mesh(jawGeo, bellyMat);
        jaw.position.set(0, -0.6, 0.5);
        jaw.rotation.x = 0.1; // Slightly open
        headGroup.add(jaw);

        // Teeth
        for (let i = -1; i <= 1; i += 2) {
            // Upper teeth
            const toothGeo = new THREE.BoxGeometry(0.05, 0.15, 0.05);
            for (let j = 0; j < 4; j++) {
                const t = new THREE.Mesh(toothGeo, toothMat);
                t.position.set(i * 0.35, -0.45, 0.8 + j * 0.2);
                headGroup.add(t);
            }
        }

        // Eyes
        const eyeColor = 0xFFFF00;
        const eyeMat = new THREE.MeshLambertMaterial({ color: eyeColor });
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(0.56, 0.1, 0.3);
        headGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(-0.56, 0.1, 0.3);
        headGroup.add(rightEye);

        // 4. Tail (Thick and tapering)
        const tailGroup = new THREE.Group();
        tailGroup.position.set(0, 2.8, -1.4); // Back of torso
        this.mesh.add(tailGroup);

        const tailSegments = 4;
        let lastZ = 0;
        let w = 1.2, h = 1.4;

        for (let i = 0; i < tailSegments; i++) {
            const segLen = 1.2;
            const geo = new THREE.BoxGeometry(w, h, segLen);
            const mesh = new THREE.Mesh(geo, mat);
            // Each segment moves back (-Z)
            mesh.position.set(0, 0, lastZ - segLen / 2);
            tailGroup.add(mesh);

            lastZ -= (segLen - 0.1); // Overlap slightly
            w *= 0.8;
            h *= 0.8;
            // Slight curve down?
            // mesh.rotation.x = -0.1 * i;
        }

        // 5. Thighs (Big legs)
        const thighGeo = new THREE.BoxGeometry(0.8, 1.4, 1.0);

        const leftThigh = new THREE.Mesh(thighGeo, mat);
        leftThigh.position.set(0.9, 1.8, -0.5);
        this.mesh.add(leftThigh);

        const rightThigh = new THREE.Mesh(thighGeo, mat);
        rightThigh.position.set(-0.9, 1.8, -0.5);
        this.mesh.add(rightThigh);

        // 6. Lower Legs & Feet
        const shinGeo = new THREE.BoxGeometry(0.5, 1.2, 0.6);
        const footGeo = new THREE.BoxGeometry(0.7, 0.3, 1.0);

        const makeLeg = (x, z) => {
            const group = new THREE.Group();
            group.position.set(x, 1.5, z); // Knee pivot?

            const shin = new THREE.Mesh(shinGeo, mat);
            shin.position.set(0, -0.6, 0.2); // Angled forward?
            // shin.rotation.x = -0.2;
            group.add(shin);

            const foot = new THREE.Mesh(footGeo, mat);
            foot.position.set(0, -1.2, 0.3);
            group.add(foot);

            // Claws
            for (let k = -1; k <= 1; k++) {
                const claw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.2), clawMat);
                claw.position.set(k * 0.2, -1.25, 0.85);
                group.add(claw);
            }

            this.mesh.add(group);
            return group;
        };

        this.legParts = [
            makeLeg(0.9, -0.5),
            makeLeg(-0.9, -0.5)
        ];

        // 7. Tiny Arms
        const armGeo = new THREE.BoxGeometry(0.25, 0.6, 0.25);

        const makeArm = (x) => {
            const arm = new THREE.Mesh(armGeo, mat);
            arm.position.set(x, 2.2, 1.4);
            arm.rotation.x = -0.8; // Point forward/down
            this.mesh.add(arm);

            // Forearm
            const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), mat);
            forearm.position.set(0, -0.3, 0.1);
            forearm.rotation.x = -0.6;
            arm.add(forearm);
        };

        makeArm(0.8);
        makeArm(-0.8);
    }
}
