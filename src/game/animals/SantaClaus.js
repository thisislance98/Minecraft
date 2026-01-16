import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class SantaClaus extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.8;
        this.height = 1.95;
        this.depth = 0.6;
        this.speed = 1.0;

        this.createBody();
        this.mesh.scale.set(1.1, 1.1, 1.1); // Santa is slightly larger/jollier
    }

    createBody() {
        const matRed = new THREE.MeshLambertMaterial({ color: 0xD42426 }); // Red suit
        const matWhite = new THREE.MeshLambertMaterial({ color: 0xFFFFFF }); // Fur trim/beard
        const matSkin = new THREE.MeshLambertMaterial({ color: 0xFFCCAA }); // Skin
        const matBlack = new THREE.MeshLambertMaterial({ color: 0x111111 }); // Boots/Belt
        const matGold = new THREE.MeshLambertMaterial({ color: 0xFFD700 }); // Belt buckle

        // -- Body Group --
        // Use a group for the whole character to allow scaling/rotation
        this.bodyGroup = new THREE.Group();
        this.mesh.add(this.bodyGroup);

        // Fat Body
        const bodyGeo = new THREE.BoxGeometry(0.7, 0.8, 0.5);
        const body = new THREE.Mesh(bodyGeo, matRed);
        body.position.set(0, 1.1, 0);
        this.mesh.add(body);

        // White fur trim vertical on coat
        const trimGeo = new THREE.BoxGeometry(0.15, 0.8, 0.52);
        const trim = new THREE.Mesh(trimGeo, matWhite);
        trim.position.set(0, 1.1, 0); // Z slightly overlapping body
        this.mesh.add(trim);

        // Belt
        const beltGeo = new THREE.BoxGeometry(0.72, 0.15, 0.52);
        const belt = new THREE.Mesh(beltGeo, matBlack);
        belt.position.set(0, 1.0, 0);
        this.mesh.add(belt);

        const buckleGeo = new THREE.BoxGeometry(0.2, 0.18, 0.54);
        const buckle = new THREE.Mesh(buckleGeo, matGold);
        buckle.position.set(0, 1.0, 0);
        this.mesh.add(buckle);

        // -- Head --
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.5, 0);
        this.mesh.add(headGroup);

        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const head = new THREE.Mesh(headGeo, matSkin);
        head.position.set(0, 0.25, 0); // Center of head relative to neck pivot
        headGroup.add(head);

        // Beard
        const beardGeo = new THREE.BoxGeometry(0.52, 0.4, 0.2);
        const beard = new THREE.Mesh(beardGeo, matWhite);
        beard.position.set(0, 0.1, 0.2);
        headGroup.add(beard);

        // Hat
        const hatBaseGeo = new THREE.BoxGeometry(0.55, 0.15, 0.55);
        const hatBase = new THREE.Mesh(hatBaseGeo, matWhite);
        hatBase.position.set(0, 0.55, 0);
        headGroup.add(hatBase);

        const hatTopGeo = new THREE.BoxGeometry(0.4, 0.3, 0.4);
        const hatTop = new THREE.Mesh(hatTopGeo, matRed);
        hatTop.position.set(0, 0.75, 0);
        headGroup.add(hatTop);

        const pompomGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
        const pompom = new THREE.Mesh(pompomGeo, matWhite);
        pompom.position.set(0, 0.95, 0);
        headGroup.add(pompom);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.15, 0.3, 0.26);
        headGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.15, 0.3, 0.26);
        headGroup.add(rightEye);

        // -- Limbs --
        this.legParts = [];

        // Arms
        const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);

        const makeArm = (x, z) => {
            const group = new THREE.Group();
            group.position.set(x, 1.4, z);
            const arm = new THREE.Mesh(armGeo, matRed);
            arm.position.set(0, -0.35, 0);
            group.add(arm);

            // Mitten/Cuff
            const cuffGeo = new THREE.BoxGeometry(0.22, 0.15, 0.22);
            const cuff = new THREE.Mesh(cuffGeo, matWhite);
            cuff.position.set(0, -0.65, 0);
            group.add(cuff);

            this.mesh.add(group);
            return group;
        };

        this.legParts.push(makeArm(-0.45, 0));
        this.legParts.push(makeArm(0.45, 0));

        // Legs
        const legGeo = new THREE.BoxGeometry(0.22, 0.7, 0.22);

        const makeLeg = (x, z) => {
            const group = new THREE.Group();
            group.position.set(x, 0.7, z); // Hip position

            const leg = new THREE.Mesh(legGeo, matRed);
            leg.position.set(0, -0.35, 0);
            group.add(leg);

            // Boot
            const bootGeo = new THREE.BoxGeometry(0.24, 0.25, 0.24);
            const boot = new THREE.Mesh(bootGeo, matBlack);
            boot.position.set(0, -0.6, 0);
            group.add(boot);

            this.mesh.add(group);
            return group;
        };

        this.legParts.push(makeLeg(-0.2, 0));
        this.legParts.push(makeLeg(0.2, 0));

        // Re-order for standard animation (RightArm, LeftArm, RightLeg, LeftLeg)
        // Actually Animal.js usually expects [RF, LF, RB, LB] for quadrupeds or [LA, RA, LL, RL] for bipeds depending on impl
        // Villager uses [RA, LA, RL, LL].
        // Our order above: LA, RA, LL, RL.
        // Let's swap to match Villager roughly:
        // Villager: RightArm, LeftArm, RightLeg, LeftLeg
        // Ours: LeftArm, RightArm, LeftLeg, RightLeg
        // So swap 0<->1 and 2<->3
        const tmpArm = this.legParts[0]; this.legParts[0] = this.legParts[1]; this.legParts[1] = tmpArm;
        const tmpLeg = this.legParts[2]; this.legParts[2] = this.legParts[3]; this.legParts[3] = tmpLeg;
    }
}
