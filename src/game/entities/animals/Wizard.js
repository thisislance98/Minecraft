import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Wizard extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.6;
        this.height = 1.8;
        this.depth = 0.6;
        this.speed = 0.8;

        this.createBody();
        // Slightly taller scale
        this.mesh.scale.set(1.0, 1.0, 1.0);
    }

    createBody() {
        // Material Palette
        const matRobe = new THREE.MeshLambertMaterial({ color: 0x1E3A8A }); // Dark Blue
        const matHat = new THREE.MeshLambertMaterial({ color: 0x1E3A8A }); // Matching Blue
        const matSkin = new THREE.MeshLambertMaterial({ color: 0xFFCCAA }); // Skin
        const matBeard = new THREE.MeshLambertMaterial({ color: 0xDDDDDD }); // Grey/White beard
        const matStaff = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown wood
        const matGem = new THREE.MeshLambertMaterial({ color: 0x00FFFF, emissive: 0x004444 }); // Glowing cyan gem

        // -- Body Group --
        this.bodyGroup = new THREE.Group();
        this.mesh.add(this.bodyGroup);

        // Robe (Body) - slightly tapered cylinder
        const robeGeo = new THREE.CylinderGeometry(0.3, 0.45, 1.0, 8);
        const robe = new THREE.Mesh(robeGeo, matRobe);
        robe.position.set(0, 0.9, 0);
        this.bodyGroup.add(robe);

        // -- Head Group --
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.4, 0);
        this.mesh.add(headGroup);

        // Head
        const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
        const head = new THREE.Mesh(headGeo, matSkin);
        head.position.set(0, 0.175, 0);
        headGroup.add(head);

        // Beard
        const beardGeo = new THREE.BoxGeometry(0.35, 0.3, 0.1);
        const beard = new THREE.Mesh(beardGeo, matBeard);
        beard.position.set(0, 0.05, 0.18);
        headGroup.add(beard);

        // Hat (Pointed)
        const hatBrimGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.05, 8);
        const hatBrim = new THREE.Mesh(hatBrimGeo, matHat);
        hatBrim.position.set(0, 0.4, 0);
        headGroup.add(hatBrim);

        const hatConeGeo = new THREE.ConeGeometry(0.25, 0.6, 8);
        const hatCone = new THREE.Mesh(hatConeGeo, matHat);
        hatCone.position.set(0, 0.7, 0);
        headGroup.add(hatCone);

        // -- Limbs --
        this.legParts = [];

        // Arms
        const armGeo = new THREE.BoxGeometry(0.12, 0.6, 0.12);

        // Right Arm (Holds Staff)
        const rightArmGroup = new THREE.Group();
        rightArmGroup.position.set(0.35, 1.3, 0);
        const rightArm = new THREE.Mesh(armGeo, matRobe);
        rightArm.position.set(0, -0.3, 0);
        rightArmGroup.add(rightArm);

        // Hand
        const handGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const hand = new THREE.Mesh(handGeo, matSkin);
        hand.position.set(0, -0.65, 0);
        rightArmGroup.add(hand);

        // Staff
        const staffGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6);
        const staff = new THREE.Mesh(staffGeo, matStaff);
        staff.rotation.x = Math.PI / 12; // Slight tilt
        staff.position.set(0, -0.4, 0.2); // Hold in front
        rightArmGroup.add(staff);

        const gemGeo = new THREE.IcosahedronGeometry(0.08, 0);
        const gem = new THREE.Mesh(gemGeo, matGem);
        gem.position.set(0, 0.35, 0.2); // Top of staff
        rightArmGroup.add(gem);

        this.mesh.add(rightArmGroup);

        // Left Arm (Empty)
        const leftArmGroup = new THREE.Group();
        leftArmGroup.position.set(-0.35, 1.3, 0);
        const leftArm = new THREE.Mesh(armGeo, matRobe);
        leftArm.position.set(0, -0.3, 0);
        leftArmGroup.add(leftArm);
        const leftHand = new THREE.Mesh(handGeo, matSkin);
        leftHand.position.set(0, -0.65, 0);
        leftArmGroup.add(leftHand);
        this.mesh.add(leftArmGroup);


        // Legs (Under robe, but visible when walking)
        const legGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15);
        const createLeg = (x) => {
            const grp = new THREE.Group();
            grp.position.set(x, 0.5, 0);
            const leg = new THREE.Mesh(legGeo, matRobe); // Pants matching robe? Or darker?
            leg.position.set(0, -0.25, 0);
            grp.add(leg);
            return grp;
        };

        const rightLeg = createLeg(0.15);
        const leftLeg = createLeg(-0.15);
        this.mesh.add(rightLeg);
        this.mesh.add(leftLeg);

        // Animation parts: RightArm, LeftArm, RightLeg, LeftLeg
        this.legParts.push(rightArmGroup);
        this.legParts.push(leftArmGroup);
        this.legParts.push(rightLeg);
        this.legParts.push(leftLeg);
    }
}
