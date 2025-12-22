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
    constructor(game, x, y, z, professionKey = null) {
        super(game, x, y, z);
        this.width = 0.6;
        this.height = 1.95;
        this.depth = 0.6;

        // Assign random profession if not specified
        if (!professionKey) {
            professionKey = PROFESSION_KEYS[Math.floor(Math.random() * PROFESSION_KEYS.length)];
        }
        this.professionKey = professionKey;
        this.profession = PROFESSIONS[professionKey];

        this.createBody();
        this.mesh.scale.set(0.9, 0.9, 0.9);

        // Apply profession modifiers
        this.speed = 1.5 * this.profession.speedMod;
        this.health = 20;
        this.idleTimeMod = this.profession.idleTimeMod;
        this.walkTimeMod = this.profession.walkTimeMod;

        // Guards can chase hostile mobs
        this.isGuard = (professionKey === 'GUARD');

        // Social State
        this.socialTimer = Math.random() * 10;
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
            const apronMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Leather brown
            const apronGeo = new THREE.BoxGeometry(0.4, 0.6, 0.05);
            const apron = new THREE.Mesh(apronGeo, apronMat);
            apron.position.set(0, 1.0, 0.18);
            this.mesh.add(apron);
        }

        // -- Limbs --
        const makeLimb = (x, y, mat, isLeg = false) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, y, 0);
            const h = isLeg ? 0.7 : 0.7;
            const geo = new THREE.BoxGeometry(0.2, h, 0.2);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(0, -h / 2, 0);
            pivot.add(mesh);
            this.mesh.add(pivot);
            return pivot;
        };

        const leftArmPivot = makeLimb(-0.35, 1.45, robeMat);
        const rightArmPivot = makeLimb(0.35, 1.45, robeMat);
        const leftLegPivot = makeLimb(-0.15, 0.7, pantsMat, true);
        const rightLegPivot = makeLimb(0.15, 0.7, pantsMat, true);

        this.legParts = [rightArmPivot, leftArmPivot, rightLegPivot, leftLegPivot];
    }

    addAccessory(headGroup, accessory) {
        switch (accessory) {
            case 'hat': {
                // Straw farmer hat
                const hatMat = new THREE.MeshLambertMaterial({ color: 0xDAA520 }); // Golden straw
                // Brim
                const brimGeo = new THREE.BoxGeometry(0.8, 0.05, 0.8);
                const brim = new THREE.Mesh(brimGeo, hatMat);
                brim.position.set(0, 0.52, 0);
                headGroup.add(brim);
                // Top
                const topGeo = new THREE.BoxGeometry(0.4, 0.15, 0.4);
                const top = new THREE.Mesh(topGeo, hatMat);
                top.position.set(0, 0.62, 0);
                headGroup.add(top);
                break;
            }
            case 'helmet': {
                // Iron guard helmet
                const helmetMat = new THREE.MeshLambertMaterial({ color: 0x708090 }); // Slate gray
                // Main helmet
                const helmetGeo = new THREE.BoxGeometry(0.55, 0.35, 0.55);
                const helmet = new THREE.Mesh(helmetGeo, helmetMat);
                helmet.position.set(0, 0.42, 0);
                headGroup.add(helmet);
                // Nose guard
                const noseGuardGeo = new THREE.BoxGeometry(0.08, 0.2, 0.1);
                const noseGuard = new THREE.Mesh(noseGuardGeo, helmetMat);
                noseGuard.position.set(0, 0.3, 0.3);
                headGroup.add(noseGuard);
                break;
            }
            case 'glasses': {
                // Librarian glasses
                const glassesMat = new THREE.MeshLambertMaterial({ color: 0x2F2F2F });
                const lensMat = new THREE.MeshLambertMaterial({ color: 0x87CEEB, transparent: true, opacity: 0.3 });
                // Frame
                const frameGeo = new THREE.BoxGeometry(0.4, 0.02, 0.02);
                const frame = new THREE.Mesh(frameGeo, glassesMat);
                frame.position.set(0, 0.28, 0.28);
                headGroup.add(frame);
                // Left lens
                const lensGeo = new THREE.BoxGeometry(0.12, 0.1, 0.02);
                const leftLens = new THREE.Mesh(lensGeo, lensMat);
                leftLens.position.set(-0.12, 0.25, 0.28);
                headGroup.add(leftLens);
                // Right lens
                const rightLens = new THREE.Mesh(lensGeo, lensMat);
                rightLens.position.set(0.12, 0.25, 0.28);
                headGroup.add(rightLens);
                break;
            }
            case 'apron':
                // Apron is added to body, not head
                break;
        }
    }

    // Override AI for profession-specific behavior
    updateAI(dt) {
        this.updateSocial(dt);

        // Guards try to chase hostile mobs (if any exist)
        if (this.isGuard && this.state !== 'chase') {
            const hostile = this.findNearbyHostile(15);
            if (hostile) {
                this.state = 'chase';
                this.chaseTarget = hostile;
                this.stateTimer = 5.0;
                this.isMoving = true;
            }
        }

        // Handle chase state for guards
        if (this.state === 'chase') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0 || !this.chaseTarget || this.chaseTarget.isDead) {
                this.state = 'idle';
                this.chaseTarget = null;
                this.isMoving = false;
                this.stateTimer = 1.0;
            } else {
                // Move toward target
                const dir = new THREE.Vector3().subVectors(this.chaseTarget.position, this.position);
                dir.y = 0;
                dir.normalize();

                // Check obstacle and find alternate path
                if (this.checkObstacleAhead && this.checkObstacleAhead(dir, 1.5)) {
                    const altDir = this.findBestDirection && this.findBestDirection(dir);
                    if (altDir) dir.copy(altDir);
                }

                this.moveDirection.copy(dir);
                this.rotation = Math.atan2(dir.x, dir.z);
                this.isMoving = true;
            }
            return;
        }

        // Normal AI with profession modifiers
        this.stateTimer -= dt;

        // Proximity flee check (if method exists)
        if (this.fleeOnProximity && this.checkProximityFlee) {
            this.checkProximityFlee(this.fleeRange);
        }

        // Stuck Detection for Villagers
        if (this.isMoving && !this.isOnCurvePath) {
            if (!this._lastPos) this._lastPos = new THREE.Vector3().copy(this.position);
            if (!this._stuckTimer) this._stuckTimer = 0;

            this._stuckTimer += dt;
            if (this._stuckTimer >= 1.0) {
                const distMoved = this.position.distanceTo(this._lastPos);
                if (distMoved < 0.1) {
                    // Stuck!
                    const dir = this.findBestDirection && this.findBestDirection(null);
                    if (dir) {
                        this.moveDirection.copy(dir);
                        this.rotation = Math.atan2(dir.x, dir.z);
                    } else {
                        this.state = 'idle';
                        this.isMoving = false;
                        this.stateTimer = Math.random() * 2 * this.idleTimeMod + 1;
                    }
                }
                this._lastPos.copy(this.position);
                this._stuckTimer = 0;
            }
        } else {
            this._stuckTimer = 0;
            if (this._lastPos) this._lastPos.copy(this.position);
        }

        // Obstacle avoidance while walking
        if (this.state === 'walk' && this.isMoving && this.checkObstacleAhead) {
            const checkDist = this.speed * 0.8;
            if (this.checkObstacleAhead(this.moveDirection, Math.max(checkDist, 1.2))) {
                const newDir = this.findBestDirection && this.findBestDirection(null);
                if (newDir) {
                    this.moveDirection.copy(newDir);
                    this.rotation = Math.atan2(newDir.x, newDir.z);
                } else {
                    this.state = 'idle';
                    this.stateTimer = Math.random() * 2 * this.idleTimeMod + 1;
                    this.isMoving = false;
                }
            }
        }

        if (this.stateTimer <= 0) {
            if (this.state === 'walk') {
                // Switch to idle
                this.state = 'idle';
                this.stateTimer = (Math.random() * 3 + 2) * this.idleTimeMod;
                this.isMoving = false;
            } else {
                // Maybe walk
                if (Math.random() < 0.7) {
                    this.state = 'walk';
                    this.stateTimer = (Math.random() * 4 + 1) * this.walkTimeMod;

                    // Pick smart direction using parent method
                    let smartDir = this.findBestDirection && this.findBestDirection(null);
                    if (smartDir) {
                        this.moveDirection.copy(smartDir);
                        this.rotation = Math.atan2(smartDir.x, smartDir.z);
                    } else {
                        this.rotation = Math.random() * Math.PI * 2;
                        this.moveDirection.set(Math.sin(this.rotation), 0, Math.cos(this.rotation));
                    }
                    this.isMoving = true;
                } else {
                    this.stateTimer = (Math.random() * 2 + 1) * this.idleTimeMod;
                    this.isMoving = false;
                }
            }
        }
    }

    findNearbyHostile(range) {
        // Look for zombies or other hostile mobs
        if (!this.game.animals) return null;
        const rangeSq = range * range;

        for (const animal of this.game.animals) {
            // Check if it's a hostile type (could add isHostile property later)
            if (animal.constructor.name === 'Zombie' || animal.isHostile) {
                const distSq = this.position.distanceToSquared(animal.position);
                if (distSq < rangeSq && !animal.isDead) {
                    return animal;
                }
            }
        }
        return null;
    }

    interact(player) {
        // Face player
        const dx = player.position.x - this.position.x;
        const dz = player.position.z - this.position.z;
        this.rotation = Math.atan2(dx, dz);
        this.mesh.rotation.y = this.rotation;

        // Pick a phrase
        const generalPool = PHRASES.GREETING;
        const profPool = PHRASES[this.professionKey] || [];

        let text = "Hrmmm.";
        if (Math.random() < 0.6 && profPool.length > 0) {
            text = profPool[Math.floor(Math.random() * profPool.length)];
        } else {
            text = generalPool[Math.floor(Math.random() * generalPool.length)];
        }

        // Show dialogue
        this.game.uiManager.showDialogue(this.profession.name, text);

        // Stop moving briefly
        this.state = 'idle';
        this.stateTimer = 3.0;
        this.isMoving = false;
    }

    updateSocial(dt) {
        if (this.socialCooldown > 0) {
            this.socialCooldown -= dt;
            return;
        }

        this.socialTimer -= dt;
        if (this.socialTimer <= 0) {
            // Reset timer
            this.socialTimer = 10 + Math.random() * 20;

            // Try to find a friend to talk to
            const friend = this.findNearbyFriend(5.0);
            if (friend) {
                this.initiateConversation(friend);
            }
        }
    }

    findNearbyFriend(range) {
        if (!this.game.animals) return null;
        const rangeSq = range * range;

        // Filter for other villagers
        const neighbors = this.game.animals.filter(a =>
            a !== this &&
            a instanceof Villager &&
            !a.isDead &&
            a.position.distanceToSquared(this.position) < rangeSq
        );

        if (neighbors.length > 0) {
            return neighbors[Math.floor(Math.random() * neighbors.length)];
        }
        return null;
    }

    initiateConversation(friend) {
        // Stop both
        this.state = 'idle';
        this.isMoving = false;
        this.stateTimer = 4.0;

        friend.state = 'idle';
        friend.isMoving = false;
        friend.stateTimer = 4.0;

        // Face each other
        const dx = friend.position.x - this.position.x;
        const dz = friend.position.z - this.position.z;
        this.rotation = Math.atan2(dx, dz);

        // Friend faces me
        friend.rotation = Math.atan2(-dx, -dz);

        // Pick phrase
        const phrases = ["Hrmmm.", "News?", "Work...", "Good day.", "Seen the player?", "Nice nose."];
        const text = phrases[Math.floor(Math.random() * phrases.length)];

        // Show bubble
        if (this.game.uiManager.addSpeechBubble) {
            this.game.uiManager.addSpeechBubble(this, text, 3000);

            // Friend responds after delay
            setTimeout(() => {
                if (!friend.isDead) {
                    const reply = ["Indeed.", "Hrm.", "Yes.", "Perhaps.", "Maybe later."];
                    const replyText = reply[Math.floor(Math.random() * reply.length)];
                    this.game.uiManager.addSpeechBubble(friend, replyText, 3000);
                }
            }, 1500);
        }

        this.socialCooldown = 15.0; // Don't talk again too soon
        friend.socialCooldown = 15.0;
    }
}

