import * as THREE from 'three';
import { Animal } from '../Animal.js';
import { Blocks } from '../../core/Blocks.js';

export class CrewMember extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        // Crew Attributes
        this.width = 0.6;
        this.height = 1.8;
        this.depth = 0.6;

        // Colors for uniforms: Gold (Command), Blue (Science), Red (Ops)
        const colors = [0xFFD700, 0x0000FF, 0xFF0000];
        this.uniformColor = colors[Math.floor(this.rng.next() * colors.length)];

        this.createBody();

        // AI State
        this.state = 'idle';
        this.stateTimer = 0;
        this.targetSeat = null; // Vector3

        // Dialogue lines
        this.dialogues = [
            "Captain on deck!",
            "Sensors differ, sir.",
            "I'm picking up a strange anomaly.",
            "Shields holding at 100%.",
            "Hailing frequencies open.",
            "Warp core is stable.",
            "Fascinating.",
            "I canna change the laws of physics!",
            "Setting course for the Neutral Zone.",
            "Tea. Earl Grey. Hot.",
            "I'm giving her all she's got, Captain!",
            "Course laid in.",
            "Live long and prosper.",
            "There's coffee in that nebula.",
            "Red alert!",
            "All decks reporting ready.",
            "Make it so.",
            "Engage.",
            "Resistance is futile... wait, wrong franchise."
        ];
    }

    createBody() {
        this.bodyGroup = new THREE.Group();
        this.mesh.add(this.bodyGroup);

        // Materials
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xFFCCAA }); // Skin tone
        const uniformMat = new THREE.MeshLambertMaterial({ color: this.uniformColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 }); // Pants/Boots

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skinMat);
        head.position.y = 1.6;
        this.bodyGroup.add(head);

        // Torso
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), uniformMat);
        torso.position.y = 1.05;
        this.bodyGroup.add(torso);

        // Legs (One block for simplicity, or two?)
        // Pants/Legs
        const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), blackMat);
        legs.position.y = 0.35;
        this.bodyGroup.add(legs);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.15, 0.7, 0.15);
        const leftArm = new THREE.Mesh(armGeo, uniformMat);
        leftArm.position.set(-0.35, 1.05, 0);
        this.bodyGroup.add(leftArm);

        const rightArm = new THREE.Mesh(armGeo, uniformMat);
        rightArm.position.set(0.35, 1.05, 0);
        this.bodyGroup.add(rightArm);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1, 0.05, 0.21); // Slightly in front of head
        head.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1, 0.05, 0.21);
        head.add(rightEye);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const noseMat = new THREE.MeshLambertMaterial({ color: 0xCC8866 }); // Slightly darker skin
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 0, 0.22);
        head.add(nose);

        // Mouth
        const mouthGeo = new THREE.BoxGeometry(0.2, 0.05, 0.02);
        const mouthMat = new THREE.MeshLambertMaterial({ color: 0x550000 }); // Dark red
        const mouth = new THREE.Mesh(mouthGeo, mouthMat);
        mouth.position.set(0, -0.15, 0.21);
        head.add(mouth);

        this.parts = { head, torso, legs, leftArm, rightArm };
    }

    interact(player) {
        // Face player
        this.lookAt(player.position);

        // Pick random line
        const line = this.dialogues[Math.floor(Math.random() * this.dialogues.length)];

        // Show chat message
        if (this.game.uiManager) {
            // "Crewman [Color]: Message"
            let rank = "Crewman";
            if (this.uniformColor === 0xFFD700) rank = "Commander";
            if (this.uniformColor === 0x0000FF) rank = "Officer";
            if (this.uniformColor === 0xFF0000) rank = "Ensign";

            this.game.uiManager.addChatMessage(rank, line);
            this.game.soundManager.playSound('click'); // Basic feedback
        }

        // Small jump or animation?
        this.velocity.y = 2;
    }

    lookAt(targetPos) {
        const dx = targetPos.x - this.position.x;
        const dz = targetPos.z - this.position.z;
        this.rotation = Math.atan2(dx, dz);
        this.mesh.rotation.y = this.rotation;
    }

    updateAI(dt) {
        if (this.state === 'sitting') {
            // Stay put, maybe look around randomly
            if (this.rng.next() < 0.01) {
                this.standUp();
            }
            return;
        }

        this.stateTimer -= dt;

        if (this.stateTimer <= 0) {
            // Pick new state
            const r = this.rng.next();

            if (r < 0.4) {
                // Idle
                this.state = 'idle';
                this.stateTimer = 2 + this.rng.next() * 3;
                this.isMoving = false;
            } else if (r < 0.8) {
                // Walk / Wander
                this.state = 'walk';
                this.stateTimer = 3 + this.rng.next() * 4;

                // Pick random direction on bridge
                // Assuming bridge is relatively flat and safe to wander short distances
                const angle = this.rng.next() * Math.PI * 2;
                this.moveDirection.set(Math.sin(angle), 0, Math.cos(angle));
                this.rotation = angle;
                this.isMoving = true;
            } else {
                // Try to sit?
                this.findSeat();
            }
        }

        if (this.state === 'walk') {
            // Check collisions using base class logic
            if (this.checkObstacleAhead(this.moveDirection, 1.0)) {
                // Blocked, stop or turn
                this.state = 'idle';
                this.isMoving = false;
                this.stateTimer = 1;
            }

            // Check for chairs while walking
            if (this.rng.next() < 0.05) {
                this.findSeat();
            }
        }
    }

    findSeat() {
        // Look for ENTERPRISE_CHAIR blocks nearby
        const range = 5;
        const bx = Math.floor(this.position.x);
        const by = Math.floor(this.position.y);
        const bz = Math.floor(this.position.z);

        for (let x = -range; x <= range; x++) {
            for (let z = -range; z <= range; z++) {
                const checkX = bx + x;
                const checkZ = bz + z;
                // Check block at feet or slightly below
                const block = this.game.getBlock(checkX, by, checkZ) || this.game.getBlock(checkX, by - 1, checkZ);

                if (block === Blocks.ENTERPRISE_CHAIR) {
                    // Start moving towards it?
                    // For simplicity, if close enough, just teleport/sit
                    const dist = Math.sqrt(x * x + z * z);
                    if (dist < 2.0) {
                        this.sitDown(checkX, by, checkZ); // Use correct Y?
                        return;
                    }
                }
            }
        }
    }

    sitDown(x, y, z) {
        this.state = 'sitting';
        this.isMoving = false;
        // Position directly on the target coordinate
        this.position.set(x, y + 0.6, z);
        this.mesh.position.copy(this.position);

        // Kill velocity
        this.velocity.set(0, 0, 0);

        // Visual adjustment for sitting
        // Lower body parts?
        this.parts.legs.rotation.x = -Math.PI / 2;
        this.parts.legs.position.set(0, 0.35, 0.2); // Stick out legs

        this.stateTimer = 999999; // Sit indefinitely until interacted with?
    }

    standUp() {
        this.state = 'idle';
        this.stateTimer = 1;

        // Reset Visuals
        this.parts.legs.rotation.x = 0;
        this.parts.legs.position.set(0, 0.35, 0);

        this.position.y += 0.5; // Hop up
    }
}
