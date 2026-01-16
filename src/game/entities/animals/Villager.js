import * as THREE from 'three';
import { Animal } from '../Animal.js';
import { Pathfinder } from '../../ai/Pathfinder.js';

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
    ],
    HURT: [
        "Ouch!",
        "Hey! Watch it!",
        "Why would you do that?",
        "That hurts!",
        "Stop it!",
        "I'm telling the Iron Golem!",
        "Help! I'm being repressed!"
    ]
};

const NAMES = [
    "Arthur", "Bree", "Caleb", "Dora", "Elias", "Fae", "Gideon", "Hana", "Ivy", "Jared",
    "Kael", "Lyra", "Milo", "Nora", "Orin", "Piper", "Quinn", "Rowan", "Silas", "Tess",
    "Finn", "Willow", "Oscar", "Hazel", "Leo", "Luna", "Jasper", "Ruby", "Felix", "Iris"
];

const BACKSTORIES = [
    "I used to be an adventurer until I took an arrow to the knee.",
    "I'm saving up specifically to buy a golden hoe.",
    "I haven't slept in days because of the zombies.",
    "My grandfather built this village with his bare hands.",
    "I'm secretly afraid of chickens.",
    "I brew the best potions in the tri-state area... legally.",
    "I lost my wedding ring in the well and I'm still looking for it.",
    "I once saw a dragon, or maybe it was just a really big bat.",
    "I'm writing a novel about a creeper who wants to be a baker.",
    "I collect dirt blocks. I have the rarest dirt block in the world."
];

const JOB_SPECIALTIES = {
    FARMER: ["Wheat Farmer", "Carrot Cultivator", "Potato Peeler", "Beetroot Baron", "Seed Sower"],
    BLACKSMITH: ["Swordsmith", "Armorer", "Toolsmith", "Horseshoer", "Anvil Polisher"],
    GUARD: ["Gatekeeper", "Patrol Officer", "Night Watch", "Scout", "Bodyguard"],
    LIBRARIAN: ["Archivist", "Scribe", "Scholar", "Bookbinder", "Storyteller"]
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

        // Identity Generation
        this.name = this.generateName();
        this.job = this.generateJob();
        this.backstory = this.generateBackstory();

        this.createBody();
        this.mesh.scale.set(0.9, 0.9, 0.9);

        // Apply profession modifiers
        this.speed = 1.5 * (this.profession.speedMod || 1.0);
        this.health = 20;
        this.idleTimeMod = this.profession.idleTimeMod || 1.0;
        this.walkTimeMod = this.profession.walkTimeMod || 1.0;
        this.legSwingSpeed = 10.0;

        // Guards can chase hostile mobs
        this.isGuard = (this.professionKey === 'GUARD');

        // Social State
        this.socialTimer = this.rng.next() * 10;
        this.socialCooldown = 0;
        this.talkingPartner = null;

        // Pathfinding
        this.pathfinder = new Pathfinder(game);
        this.currentPath = null;
        this.pathIndex = 0;
        this.repathTimer = 0;

        // Combat
        this.isHostile = false;
        this.target = null;
        this.weapon = null;
        this.lastAttackTime = 0;

        // Assign Quest (25% chance)
        if (this.game && this.game.questSystem && this.rng.next() < 0.25) {
            this.game.questSystem.generateQuestForVillager(this);
        }

        this.avoidsWater = true;
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
        // -- Eyes --
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const pupilMat = new THREE.MeshLambertMaterial({ color: 0x00AA00 });
        const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
        const pupilGeo = new THREE.BoxGeometry(0.06, 0.06, 0.02);

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.15, 0.25, 0.26);
        headGroup.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(-0.15, 0.25, 0.32);
        headGroup.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.15, 0.25, 0.26);
        headGroup.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(0.15, 0.25, 0.32);
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
        // Map arms for Animal.js attack animation compatibility
        // Animal.js uses armParts[1] for right arm attack
        this.armParts = [leftArmPivot, rightArmPivot];
    }

    generateName() {
        const index = Math.floor(this.rng.next() * NAMES.length);
        return NAMES[index];
    }

    generateJob() {
        const specialties = JOB_SPECIALTIES[this.professionKey] || ["Villager"];
        const index = Math.floor(this.rng.next() * specialties.length);
        return specialties[index];
    }

    generateBackstory() {
        const index = Math.floor(this.rng.next() * BACKSTORIES.length);
        return BACKSTORIES[index];
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
                frame.position.set(0, 0.25, 0.30); // Moved forward to Z=0.30 to avoid Z-fighting
                headGroup.add(frame);
                break;
            }
        }
    }

    updateAI(dt) {
        // Combat Logic
        if (this.isHostile && this.target) {
            // Check if target is dead or valid
            if (this.target.health <= 0 || this.target.isDead) {
                this.isHostile = false;
                this.target = null;
                this.unequipWeapon();
                this.state = 'idle';
                return;
            }

            this.state = 'chase'; // Use chase state for animation cues

            const dist = this.position.distanceTo(this.target.position);

            // Look at target
            const dx = this.target.position.x - this.position.x;
            const dz = this.target.position.z - this.position.z;
            this.rotation = Math.atan2(dx, dz);

            if (dist > 100) {
                // Too far, give up
                this.isHostile = false;
                this.target = null;
                this.unequipWeapon();
                return;
            }

            if (dist > 2.0) {
                // Chase
                this.moveDirection.set(Math.sin(this.rotation), 0, Math.cos(this.rotation));
                this.isMoving = true;
            } else {
                // Attack
                this.isMoving = false;
                // Attack cooldown
                const now = Date.now();
                if (now - this.lastAttackTime > 1500) { // 1.5s attack speed
                    this.attackTarget(this.target);
                    this.lastAttackTime = now;
                }
            }
            return; // Skip normal AI
        }

        // If conversing, stay put and face player
        if (this.isConversing) {
            this.isMoving = false;
            this.state = 'talking';
            if (this.game?.player) {
                const dx = this.game.player.position.x - this.position.x;
                const dy = this.game.player.position.y - this.position.y;
                const dz = this.game.player.position.z - this.position.z;
                this.rotation = Math.atan2(dx, dz);

                // End conversation if player walks away (> 5 blocks)
                const distToPlayer = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (distToPlayer > 5) {
                    this.endConversation();
                }
            }
            return;
        }

        // Player proximity detection for conversations
        const player = this.game?.player;
        if (player && !this.isConversing) {
            const dx = player.position.x - this.position.x;
            const dy = player.position.y - this.position.y;
            const dz = player.position.z - this.position.z;
            const distToPlayer = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (distToPlayer < 10 && !this.conversationCooldown) {
                // 1. Check if close enough to START conversation FIRST
                if (distToPlayer <= 2.5) {
                    this.startConversation();
                    return;
                }

                // 2. If not close enough, check if we should approach
                // Check if player is already busy with another villager
                if (this.game?.uiManager?.activeVillagerConversation) {
                    // Start wandering instead of waiting awkwardly
                    // Fallthrough to normal roaming behavior below logic...
                    // We need to NOT return here if we want to wander, but we effectively want to stop "Approaching"
                    // So we just don't enter the approach block.
                } else {
                    // Approach player
                    this.state = 'approaching';

                    // Pathfinding Logic
                    this.repathTimer -= dt;

                    // Check if target moved significantly or timer expired
                    const playerBlockPos = new THREE.Vector3(Math.floor(player.position.x), Math.floor(player.position.y), Math.floor(player.position.z));
                    const lastTargetPos = this.lastTargetBlockPos;

                    let needsRepath = this.repathTimer <= 0;
                    if (lastTargetPos && playerBlockPos.distanceTo(lastTargetPos) > 1.5) {
                        needsRepath = true;
                    }

                    if (needsRepath) {
                        this.repathTimer = 1.0; // Re-path every 1s
                        this.lastTargetBlockPos = playerBlockPos.clone();

                        const path = this.pathfinder.findPath(this.position, player.position, 2000, { avoidWater: this.avoidsWater });
                        if (path) {
                            this.currentPath = path;
                            this.pathIndex = 0;
                        } else {
                            this.currentPath = null;
                        }
                    }

                    if (this.currentPath && this.pathIndex < this.currentPath.length) {
                        const targetVec = this.currentPath[this.pathIndex];

                        // Horizontal distance check
                        const dx = targetVec.x - this.position.x;
                        const dz = targetVec.z - this.position.z;
                        const distSq = dx * dx + dz * dz;

                        // Move towards point
                        const angle = Math.atan2(dx, dz);
                        this.rotation = angle;
                        this.moveDirection.set(Math.sin(angle), 0, Math.cos(angle));
                        this.isMoving = true;

                        // Check arrival
                        if (distSq < 0.2) {
                            this.pathIndex++;
                        }
                    } else {
                        // Fallback (direct line if simple)
                        if (!this.currentPath) {
                            const dx = player.position.x - this.position.x;
                            const dz = player.position.z - this.position.z;
                            const angle = Math.atan2(dx, dz);
                            this.rotation = angle;
                            this.isMoving = true; // Keep moving if strictly approaching
                            this.moveDirection.set(Math.sin(angle), 0, Math.cos(angle));
                        } else {
                            this.isMoving = false;
                        }
                    }
                    return; // We are strictly in approach mode, so we return to skip random wandering
                }
            }

            // Normal roaming behavior when not approaching player
            if (!this.stateTimer || this.stateTimer <= 0) {
                this.stateTimer = (2 + this.rng.next() * 5) * (this.idleTimeMod || 1.0);
                this.state = this.rng.next() < 0.5 ? 'idle' : 'walk';
                if (this.state === 'walk') {
                    // Smart wander: pick a direction that avoids water/obstacles
                    const smartDir = this.findBestDirection(null);
                    if (smartDir) {
                        this.moveDirection.copy(smartDir);
                        this.rotation = Math.atan2(smartDir.x, smartDir.z);
                    } else {
                        // Fallback but maybe we shouldn't walk if trapped?
                        // For now, random is better than nothing, but it might lead to water.
                        // Let's try random but re-check? findBestDirection essentially does that.
                        // If null, we are excessively trapped. Let's just idle.
                        this.state = 'idle';
                    }
                }
            }
            this.stateTimer -= dt;

            if (this.state === 'walk') {
                this.isMoving = true;
            } else {
                this.isMoving = false;
            }

            // Conversation timeout handling
            if (this.conversationCooldown > 0) {
                this.conversationCooldown -= dt;
                if (this.conversationCooldown <= 0) {
                    this.conversationCooldown = 0;
                }
            }
        }
    }

    /**
     * Start a conversation with the player via LLM
     * @param {string|null} initialPlayerMessage - Optional message from player to start the convo with
     */
    startConversation(initialPlayerMessage = null) {
        if (this.isConversing || this.isHostile) return;

        // Check if player is already talking to someone else
        if (this.game?.uiManager?.activeVillagerConversation) {
            return;
        }

        // LOCK IMMEDIATELY
        if (this.game?.uiManager) {
            this.game.uiManager.activeVillagerConversation = this;
        }

        this.isConversing = true;
        this.conversationCooldown = 60; // Don't talk again for 60 seconds
        this.isMoving = false;
        this.state = 'talking';

        console.log(`[Villager] ${this.profession.name} starting conversation at ${this.position.x.toFixed(1)}, ${this.position.z.toFixed(1)}`);

        // Request LLM-generated greeting from server
        this.requestVillagerDialogue(initialPlayerMessage);
    }

    /**
     * Request dialogue from LLM
     * @param {string|null} playerMessage - Player's response, null for initial greeting
     */
    requestVillagerDialogue(playerMessage) {
        const socket = this.game?.socketManager?.socket;
        if (!socket) {
            console.warn('[Villager] No socket available for chat');
            this.showSpeechBubble(this.getRandomPhrase());
            this.endConversation();
            return;
        }

        // Emit villager chat request
        const quest = this.game?.questSystem?.getQuestFromVillager(this.id);
        const activeQuest = this.game?.questSystem?.activeQuests.get(quest?.id);

        // If quest is already active, we shouldn't offer it again, maybe ask for status?
        // If quest is active, we pass that status.

        socket.emit('villager:chat', {
            villagerId: this.id,
            profession: this.professionKey,
            professionName: this.profession.name,
            name: this.name,
            job: this.job,
            backstory: this.backstory,
            playerMessage: playerMessage,
            isGreeting: playerMessage === null,
            quest: quest ? {
                id: quest.id,
                title: quest.title,
                description: quest.description,
                dialogueIntro: quest.dialogueIntro,
                isAccepted: !!activeQuest,
                isCompleted: quest.isCompleted,
                canComplete: this.game.questSystem.canCompleteQuest(quest.id)
            } : null
        });

        // Listen for response (one-time)
        const handleResponse = (response) => {
            if (response.villagerId === this.id) {
                socket.off('villager:chat:response', handleResponse);
                clearTimeout(timeoutId); // Clear the timeout since we got a response
                this.showSpeechBubble(response.message);
                this.stateTimer = 60; // Reset idle timer - stay engaged for 1 minute

                if (response.questAccepted && quest) {
                    this.game.questSystem.acceptQuest(quest.id);
                }

                if (response.questCompleted && quest) {
                    this.game.questSystem.completeQuest(quest.id);
                }

                if (response.endConversation) {
                    this.endConversation();
                }
            }
        };
        socket.on('villager:chat:response', handleResponse);

        // Timeout fallback
        const timeoutId = setTimeout(() => {
            socket.off('villager:chat:response', handleResponse);
            if (this.isConversing) {
                // Only show fallback if we haven't received a response yet (and still conversing)
                // We don't want to interrupt if a valid response came late but just before this timer
                // But since we remove the listener above, this logic is safe.
                this.showSpeechBubble(this.getRandomPhrase());
                this.endConversation();
            }
        }, 15000);
    }

    /**
     * Handle player response to this villager
     */
    handlePlayerResponse(message) {
        if (!this.isConversing) return;

        console.log(`[Villager] Player responded: "${message}"`);
        this.stateTimer = 60; // Reset idle timer - stay engaged for 1 minute
        this.requestVillagerDialogue(message);
    }

    /**
     * End the current conversation
     */
    endConversation() {
        this.isConversing = false;
        this.state = 'idle';
        this.stateTimer = 60; // Stay idle for 60 seconds after chatting

        // Notify game that conversation ended
        if (this.game?.uiManager && this.game.uiManager.activeVillagerConversation === this) {
            this.game.uiManager.activeVillagerConversation = null;
        }
    }

    /**
     * Get a random phrase based on profession
     */
    getRandomPhrase() {
        const phraseList = PHRASES[this.professionKey] || PHRASES.GREETING;
        return phraseList[Math.floor(Math.random() * phraseList.length)];
    }

    /**
     * Display speech bubble above villager
     */
    showSpeechBubble(text) {
        console.log(`[Villager] ${this.profession.name} says: "${text}"`);

        // Notify UIManager to display speech bubble
        if (this.game?.uiManager) {
            this.game.uiManager.showVillagerSpeech(this, text);
            this.game.uiManager.activeVillagerConversation = this;
        }
    }

    takeDamage(amount, attacker) {
        super.takeDamage(amount, attacker);
        if (!this.isDead && attacker) {
            this.turnHostile(attacker);
            this.alertNeighbors(attacker);
        }
        this.showSpeechBubble(this.getRandomHurtPhrase());
    }

    getRandomHurtPhrase() {
        const phrases = PHRASES.HURT;
        return phrases[Math.floor(Math.random() * phrases.length)];
    }

    turnHostile(attacker) {
        if (this.isHostile) return;
        this.isHostile = true;
        this.target = attacker;
        this.endConversation();
        this.equipWeapon();
        this.showSpeechBubble("You'll regret that!");
    }

    alertNeighbors(attacker) {
        if (!this.game || !this.game.entities) return;

        // Find other villagers within 20 blocks
        for (const entity of this.game.entities) {
            if (entity !== this &&
                entity instanceof Villager &&
                !entity.isHostile &&
                !entity.isDead &&
                entity.position.distanceTo(this.position) < 20) {

                entity.turnHostile(attacker);
                entity.showSpeechBubble("Protec!");
            }
        }
    }

    equipWeapon() {
        if (this.weapon) return; // Already equipped

        // Right arm is this.armParts[1] (which is legParts[0])
        const arm = this.armParts[1];
        if (!arm) return;

        let weaponGeo, weaponMat;
        const weaponGroup = new THREE.Group();

        switch (this.professionKey) {
            case 'GUARD':
            case 'BLACKSMITH':
                // Iron Sword
                weaponMat = new THREE.MeshLambertMaterial({ color: 0xDDDDDD }); // Blade
                const handleMat = new THREE.MeshLambertMaterial({ color: 0x4A3222 }); // Wood

                const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.05), weaponMat);
                blade.position.set(0, 0.4, 0);
                weaponGroup.add(blade);

                const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), weaponMat);
                guard.position.set(0, 0, 0);
                weaponGroup.add(guard);

                const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, 0.05), handleMat);
                handle.position.set(0, -0.15, 0);
                weaponGroup.add(handle);
                break;

            case 'FARMER':
                // Hoe
                const stickMat = new THREE.MeshLambertMaterial({ color: 0x4A3222 });
                const headMat = new THREE.MeshLambertMaterial({ color: 0x888888 }); // Stone/Iron

                const stick = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), stickMat);
                stick.position.set(0, 0.15, 0); // Offset to hold
                weaponGroup.add(stick);

                const head = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.3), headMat);
                head.position.set(0, 0.6, 0.12);
                weaponGroup.add(head);
                break;

            default:
                // Stick? Or nothing? Let's give them a stick
                const wStickMat = new THREE.MeshLambertMaterial({ color: 0x4A3222 });
                const wStick = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), wStickMat);
                wStick.position.set(0, 0.25, 0);
                weaponGroup.add(wStick);
                break;
        }

        // Attach to hand
        // Arm is 0.7 high. Hand is at bottom.
        // Pivot is at shoulder.
        // Hand position relative to pivot: (0, -0.7, 0)
        weaponGroup.position.set(0, -0.6, 0.1);
        weaponGroup.rotation.x = -Math.PI / 2; // Point forward

        arm.add(weaponGroup);
        this.weapon = weaponGroup;
    }

    unequipWeapon() {
        if (this.weapon) {
            const arm = this.armParts[1];
            if (arm) arm.remove(this.weapon);
            this.weapon = null;
        }
    }

    attackTarget(target) {
        // Trigger generic attack
        super.attackPlayer(target);

        // Visuals
        this.isAttacking = true;
        this.attackAnimTimer = 0.3;
    }

    updateAnimation(dt) {
        super.updateAnimation(dt);
        // Override arm rotation if attacking to ensure weapon swing looks right
        if (this.isAttacking && this.armParts && this.armParts[1]) {
            // Animal.js handles the swing logic in updateAnimation for armParts[1]
            // So we might not need to do anything if we set up armParts correctly!
            // It swings armParts[1].rotation.x
        }

        // If holding weapon but NOT attacking, keep arm pointed slightly forward
        if (this.weapon && !this.isAttacking && this.armParts && this.armParts[1]) {
            // Override walking swing for right arm properties
            this.armParts[1].rotation.x = -0.5; // Hold weapon forward/up
            // We need to fight the walking swing if moving
            if (this.isMoving) {
                // Animal.js sets it to -angle or angle.
                // We force it here
                this.armParts[1].rotation.x = -0.5;
            }
        }
    }
}

