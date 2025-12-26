import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Lion extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.9;
        this.height = 1.1;
        this.depth = 1.8;
        this.speed = 3.5;
        this.isHostile = true; // Lions are predators
        this.detectionRange = 12;
        this.attackRange = 1.8;
        this.damage = 1;
        
        this.createBody();
        // Scale it up slightly to feel more majestic
        this.mesh.scale.set(1.1, 1.1, 1.1);
    }

    createBody() {
        // Colors for "better textures" (voxel layering)
        const colors = {
            body: 0xd4a017,     // Golden Lion
            underbelly: 0xeedc82, // Flaxen
            manePrimary: 0x8b4513, // Saddle Brown
            maneSecondary: 0x5d2906, // Darker Brown
            snout: 0xf5deb3,     // Wheat
            nose: 0x222222,      // Charcoal
            eyeWhite: 0xffffff,
            eyePupil: 0x000000,
            paw: 0xc29214        // Darker gold
        };

        const bodyMat = new THREE.MeshLambertMaterial({ color: colors.body });
        const bellyMat = new THREE.MeshLambertMaterial({ color: colors.underbelly });
        const maneMat = new THREE.MeshLambertMaterial({ color: colors.manePrimary });
        const darkManeMat = new THREE.MeshLambertMaterial({ color: colors.maneSecondary });
        const snoutMat = new THREE.MeshLambertMaterial({ color: colors.snout });
        const noseMat = new THREE.MeshLambertMaterial({ color: colors.nose });
        const whiteMat = new THREE.MeshLambertMaterial({ color: colors.eyeWhite });
        const blackMat = new THREE.MeshLambertMaterial({ color: colors.eyePupil });
        const pawMat = new THREE.MeshLambertMaterial({ color: colors.paw });

        // Main Body
        const bodyGeo = new THREE.BoxGeometry(0.8, 0.7, 1.5);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0.75, 0);
        this.mesh.add(body);

        // Underbelly "texture" layer
        const bellyGeo = new THREE.BoxGeometry(0.6, 0.1, 1.2);
        const belly = new THREE.Mesh(bellyGeo, bellyMat);
        belly.position.set(0, 0.4, 0);
        this.mesh.add(belly);

        // MANE - Multi-layered for "texture"
        // Back mane
        const maneBackGeo = new THREE.BoxGeometry(1.1, 1.1, 0.4);
        const maneBack = new THREE.Mesh(maneBackGeo, darkManeMat);
        maneBack.position.set(0, 0.95, 0.55);
        this.mesh.add(maneBack);

        // Front mane (frames the face)
        const maneFrontGeo = new THREE.BoxGeometry(1.0, 1.0, 0.3);
        const maneFront = new THREE.Mesh(maneFrontGeo, maneMat);
        maneFront.position.set(0, 0.9, 0.85);
        this.mesh.add(maneFront);

        // Head
        const headGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.set(0, 0.95, 0.95);
        this.mesh.add(head);

        // Snout
        const snoutGeo = new THREE.BoxGeometry(0.35, 0.3, 0.3);
        const snout = new THREE.Mesh(snoutGeo, snoutMat);
        snout.position.set(0, 0.8, 1.2);
        this.mesh.add(snout);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.12, 0.08, 0.08);
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 0.9, 1.35);
        this.mesh.add(nose);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
        const pupilGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);

        // Left Eye
        const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.18, 1.05, 1.22);
        this.mesh.add(leftEye);
        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.18, 1.05, 1.25);
        this.mesh.add(leftPupil);

        // Right Eye
        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.18, 1.05, 1.22);
        this.mesh.add(rightEye);
        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.18, 1.05, 1.25);
        this.mesh.add(rightPupil);

        // Ears (embedded in mane)
        const earGeo = new THREE.BoxGeometry(0.15, 0.15, 0.1);
        const leftEar = new THREE.Mesh(earGeo, bodyMat);
        leftEar.position.set(-0.3, 1.3, 0.75);
        this.mesh.add(leftEar);
        const rightEar = new THREE.Mesh(earGeo, bodyMat);
        rightEar.position.set(0.3, 1.3, 0.75);
        this.mesh.add(rightEar);

        // Tail
        const tailRoot = new THREE.Group();
        tailRoot.position.set(0, 1.0, -0.75);
        this.mesh.add(tailRoot);

        const tailGeo = new THREE.BoxGeometry(0.1, 0.1, 0.8);
        const tail = new THREE.Mesh(tailGeo, bodyMat);
        tail.position.set(0, -0.2, -0.4);
        tail.rotation.x = -Math.PI / 4;
        tailRoot.add(tail);

        // Tail Tuft
        const tuftGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
        const tuft = new THREE.Mesh(tuftGeo, darkManeMat);
        tuft.position.set(0, -0.5, -0.75);
        tailRoot.add(tuft);
        this.tail = tailRoot;

        // Legs
        const legGeo = new THREE.BoxGeometry(0.25, 0.6, 0.25);
        const pawGeo = new THREE.BoxGeometry(0.28, 0.15, 0.3);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.6, z);
            
            const leg = new THREE.Mesh(legGeo, bodyMat);
            leg.position.set(0, -0.3, 0);
            pivot.add(leg);

            const paw = new THREE.Mesh(pawGeo, pawMat);
            paw.position.set(0, -0.55, 0.03);
            pivot.add(paw);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.3, 0.5),  // Front Left
            makeLeg(0.3, 0.5),   // Front Right
            makeLeg(-0.3, -0.5), // Back Left
            makeLeg(0.3, -0.5)  // Back Right
        ];
    }

    updateAnimation(dt) {
        super.updateAnimation(dt);

        // Tail swish
        if (this.tail) {
            const swish = Math.sin(this.animTime * 0.3) * 0.2;
            this.tail.rotation.y = swish;
        }
    }
}
