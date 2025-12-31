import * as THREE from 'three';
import { Animal } from '../Animal.js';

// Profession definitions
const PROFESSIONS = {
    FARMER: {
        name: 'Farmer',
        robeColor: 0x4a3222,    // Brown
        pantsColor: 0x2d5a27,   // Green-ish
        accessory: 'hat',       // Straw hat
        speedMod: 1.0,
        idleTimeMod: 1.0,
        walkTimeMod: 1.0
    },
    BLACKSMITH: {
        name: 'Blacksmith',
        robeColor: 0x1a1a1a,    // Dark gray/black
        pantsColor: 0x333333,
        accessory: 'apron',     // Leather apron
        speedMod: 0.9,
        idleTimeMod: 1.5,       // More stationary
        walkTimeMod: 0.5        // Short walks
    },
    GUARD: {
        name: 'Guard',
        robeColor: 0x8B0000,    // Dark red
        pantsColor: 0x4a4a4a,
        accessory: 'helmet',    // Iron helmet
        speedMod: 1.4,          // Faster
        idleTimeMod: 0.5,       // Less idle
        walkTimeMod: 1.5        // Longer patrols
    },
    LIBRARIAN: {
        name: 'Librarian',
        robeColor: 0xE8E8E8,    // White
        pantsColor: 0x333333,
        accessory: 'glasses',   // Reading glasses
        speedMod: 0.7,          // Slower
        idleTimeMod: 2.0,       // More idle (reading)
        walkTimeMod: 0.5        // Short walks
    }
};

const PHRASES = {
    GREETING: [
        "Hello there!",
        "Nice weather today.",
        "Have you seen my sheep?",
        "Hrmmm.",
        "Good to see you!",
        "Stay safe out there."
    ],
    FARMER: [
        "The crops come in nicely.",
        "It's honest work.",
        "Need some wheat?",
        "Rain would be nice.",
        "Watch out for the crows!"
    ],
    BLACKSMITH: [
        "Iron is strong.",
        "Need a sword repaired?",
        "Hot stuff coming through!",
        "My anvil is heavy.",
        "Clang clang!"
    ],
    GUARD: [
        "Halt!",
        "Keep moving.",
        "I'm watching you.",
        "Safe travels.",
        "No trouble on my watch."
    ],
    LIBRARIAN: [
        "Shhh!",
        "Read any good books lately?",
        "Thinking is hard work.",
        "Knowledge is power.",
        "I am studying ancient texts."
    ]
};

const PROFESSION_KEYS = Object.keys(PROFESSIONS);

export class Villager extends Animal {
    constructor(game, x = 0, y = 0, z = 0, seed = null, professionKey = null) {
        super(game, x, y, z, seed);
        this.width = 0.6;
        this.height = 1.95;
        this.depth = 0.6;

        // Assign random profession if not specified
        let pKey = professionKey;
        if (!pKey) {
            pKey = PROFESSION_KEYS[Math.floor(this.rng.next() * PROFESSION_KEYS.length)];
        }
        this.professionKey = pKey;
        this.profession = PROFESSIONS[this.professionKey];

        this.createBody();
        this.mesh.scale.set(0.9, 0.9, 0.9);

        // Apply profession modifiers
        this.speed = 1.5 * (this.profession.speedMod || 1.0);
        this.health = 20;
        this.idleTimeMod = this.profession.idleTimeMod || 1.0;
        this.walkTimeMod = this.profession.walkTimeMod || 1.0;

        // Guards can chase hostile mobs
        this.isGuard = (this.professionKey === 'GUARD');

        // Social State
        this.socialTimer = this.rng.next() * 10;
        this.socialCooldown = 0;
        this.talkingPartner = null;
    }

    createBody() {
        const prof = this.profession;
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xbd8b68 });
        const robeMat = new THREE.MeshLambertMaterial({ color: prof.robeColor });
        const pantsMat = new THREE.MeshLambertMaterial({ color: prof.pantsColor });

        // Head geometry
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const noseGeo = new THREE.BoxGeometry(0.1, 0.15, 0.1);

        // -- Head Group --
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.5, 0);
        this.mesh.add(headGroup);
        this.headGroup = headGroup;

        const headMesh = new THREE.Mesh(headGeo, skinMat);
        headMesh.position.set(0, 0.25, 0);
        headGroup.add(headMesh);

        // -- Hair (hidden for helmet) --
        if (prof.accessory !== 'helmet') {
            const hairMat = new THREE.MeshLambertMaterial({ color: 0x3B2713 });
            const hairTopGeo = new THREE.BoxGeometry(0.55, 0.1, 0.55);
            const hairTop = new THREE.Mesh(hairTopGeo, hairMat);
            hairTop.position.set(0, 0.5, 0);
            headGroup.add(hairTop);

            const hairBackGeo = new THREE.BoxGeometry(0.55, 0.5, 0.1);
            const hairBack = new THREE.Mesh(hairBackGeo, hairMat);
            hairBack.position.set(0, 0.25, -0.25);
            headGroup.add(hairBack);

            const sideburnGeo = new THREE.BoxGeometry(0.1, 0.2, 0.1);
            const leftSideburn = new THREE.Mesh(sideburnGeo, hairMat);
            leftSideburn.position.set(-0.25, 0.35, 0.1);
            headGroup.add(leftSideburn);

            const rightSideburn = new THREE.Mesh(sideburnGeo, hairMat);
            rightSideburn.position.set(0.25, 0.35, 0.1);
            headGroup.add(rightSideburn);
        }

        // -- Eyes --
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const pupilMat = new THREE.MeshLambertMaterial({ color: 0x00AA00 });
        const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
        const pupilGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.15, 0.25, 0.26);
        headGroup.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(-0.15, 0.25, 0.28);
        headGroup.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.15, 0.25, 0.26);
        headGroup.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(0.15, 0.25, 0.28);
        headGroup.add(rightPupil);

        // Brow
        const browMat = new THREE.MeshLambertMaterial({ color: 0x2A1B0E });
        const browGeo = new THREE.BoxGeometry(0.4, 0.05, 0.05);
        const brow = new THREE.Mesh(browGeo, browMat);
        brow.position.set(0, 0.32, 0.27);
        headGroup.add(brow);

        // Nose
        const noseMesh = new THREE.Mesh(noseGeo, skinMat);
        noseMesh.position.set(0, 0.15, 0.3);
        headGroup.add(noseMesh);

        // Mouth
        const mouthGeo = new THREE.BoxGeometry(0.1, 0.02, 0.05);
        const mouthMat = new THREE.MeshLambertMaterial({ color: 0x2A1B0E });
        const mouth = new THREE.Mesh(mouthGeo, mouthMat);
        mouth.position.set(0, 0.05, 0.26);
        headGroup.add(mouth);

        // -- PROFESSION ACCESSORIES --
        this.addAccessory(headGroup, prof.accessory);

        // -- Body --
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.8, 0.3);
        const bodyMesh = new THREE.Mesh(bodyGeo, robeMat);
        bodyMesh.position.set(0, 1.1, 0);
        this.mesh.add(bodyMesh);

        // Apron for blacksmith
        if (prof.accessory === 'apron') {
            const apronMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const apronGeo = new THREE.BoxGeometry(0.4, 0.6, 0.05);
            const apron = new THREE.Mesh(apronGeo, apronMat);
            apron.position.set(0, 1.0, 0.18);
            this.mesh.add(apron);
        }

        // -- Limbs --
        const makeLimb = (x, y, mat) => {
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

        const leftArmPivot = makeLimb(-0.35, 1.45, robeMat);
        const rightArmPivot = makeLimb(0.35, 1.45, robeMat);
        const leftLegPivot = makeLimb(-0.15, 0.7, pantsMat);
        const rightLegPivot = makeLimb(0.15, 0.7, pantsMat);

        this.legParts = [rightArmPivot, leftArmPivot, rightLegPivot, leftLegPivot];
    }

    addAccessory(headGroup, accessory) {
        switch (accessory) {
            case 'hat': {
                const hatMat = new THREE.MeshLambertMaterial({ color: 0xDAA520 });
                const brimGeo = new THREE.BoxGeometry(0.8, 0.05, 0.8);
                const brim = new THREE.Mesh(brimGeo, hatMat);
                brim.position.set(0, 0.52, 0);
                headGroup.add(brim);
                const topGeo = new THREE.BoxGeometry(0.4, 0.15, 0.4);
                const top = new THREE.Mesh(topGeo, hatMat);
                top.position.set(0, 0.62, 0);
                headGroup.add(top);
                break;
            }
            case 'helmet': {
                const helmetMat = new THREE.MeshLambertMaterial({ color: 0x708090 });
                const helmetGeo = new THREE.BoxGeometry(0.55, 0.35, 0.55);
                const helmet = new THREE.Mesh(helmetGeo, helmetMat);
                helmet.position.set(0, 0.42, 0);
                headGroup.add(helmet);
                const noseGuardGeo = new THREE.BoxGeometry(0.08, 0.2, 0.1);
                const noseGuard = new THREE.Mesh(noseGuardGeo, helmetMat);
                noseGuard.position.set(0, 0.3, 0.3);
                headGroup.add(noseGuard);
                break;
            }
            case 'glasses': {
                const glassesMat = new THREE.MeshLambertMaterial({ color: 0x2F2F2F });
                const frameGeo = new THREE.BoxGeometry(0.45, 0.1, 0.05);
                const frame = new THREE.Mesh(frameGeo, glassesMat);
                frame.position.set(0, 0.25, 0.26);
                headGroup.add(frame);
                break;
            }
        }
    }

    updateAI(dt) {
        // We use the base updateAI if it exists, or provide basic roaming
        // since we found super.updateAI might be risky if it's missing.
        // But in this codebase, Animal usually has some roaming logic.
        
        // Let's implement basic roaming directly to be safe.
        if (!this.stateTimer || this.stateTimer <= 0) {
            this.stateTimer = (2 + this.rng.next() * 5) * (this.idleTimeMod || 1.0);
            this.state = this.rng.next() < 0.5 ? 'idle' : 'walk';
            if (this.state === 'walk') {
                this.rotation = this.rng.next() * Math.PI * 2;
                this.moveDirection.set(Math.sin(this.rotation), 0, Math.cos(this.rotation));
            }
        }
        this.stateTimer -= dt;

        if (this.state === 'walk') {
            this.position.add(this.moveDirection.clone().multiplyScalar(this.speed * dt));
            this.isMoving = true;
        } else {
            this.isMoving = false;
        }

        // Custom social behavior logic
        this.socialTimer -= dt;
        if (this.socialTimer <= 0) {
            this.socialTimer = 5 + this.rng.next() * 10;
            if (this.rng.next() < 0.3) {
                const phraseList = PHRASES[this.professionKey] || PHRASES.GREETING;
                const phrase = phraseList[Math.floor(this.rng.next() * phraseList.length)];
                // Phrase logic would normally trigger UI
            }
        }
    }
}
