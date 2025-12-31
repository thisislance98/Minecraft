import * as THREE from 'three';
import { Animal } from '../Animal.js';

const PHRASES = [
    "Oink!",
    "Snort.",
    "Hungry...",
    "Mud is nice.",
    "Have you seen any carrots?",
    "Oink oink.",
    "Bacon? What's that?",
    "It's a pig's life.",
    "Zzz...",
    "The trough is empty."
];

export class Pig extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.9;
        this.height = 0.9;
        this.depth = 1.3;
        this.createBody();
        this.mesh.scale.set(1.0, 1.0, 1.0);

        // Social State
        this.socialTimer = Math.random() * 10;
        this.socialCooldown = 0;

        // Speech Bubble
        this.currentPhrase = null;
        this.phraseTimer = 0;
        this.speechBubble = null;
        this.createSpeechBubble();
    }

    createBody() {
        // Pig: Pink
        const skinColor = 0xF0ACBC;
        const mat = new THREE.MeshLambertMaterial({ color: skinColor });
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const hoofMat = new THREE.MeshLambertMaterial({ color: 0x5C3A21 }); // Dark brown for hooves
        const darkPinkMat = new THREE.MeshLambertMaterial({ color: 0xD68E9E }); // Darker pink for details

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.8, 0.7, 1.1);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.6, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.9, 0.8);
        this.mesh.add(head);

        // Snout
        const snoutGeo = new THREE.BoxGeometry(0.3, 0.2, 0.1);
        const snout = new THREE.Mesh(snoutGeo, mat);
        snout.position.set(0, 0.8, 1.15);
        this.mesh.add(snout);

        // Nostrils
        const nostrilGeo = new THREE.BoxGeometry(0.05, 0.05, 0.02);
        const leftNostril = new THREE.Mesh(nostrilGeo, blackMat);
        leftNostril.position.set(-0.08, 0.8, 1.205); // Slightly in front of snout
        this.mesh.add(leftNostril);

        const rightNostril = new THREE.Mesh(nostrilGeo, blackMat);
        rightNostril.position.set(0.08, 0.8, 1.205);
        this.mesh.add(rightNostril);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.2, 0.2, 0.05);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.25, 1.15, 0.9);
        leftEar.rotation.z = 0.2; // Tilt out
        leftEar.rotation.x = 0.2; // Tilt forward
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.25, 1.15, 0.9);
        rightEar.rotation.z = -0.2;
        rightEar.rotation.x = 0.2;
        this.mesh.add(rightEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
        const pupilGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);

        // Left Eye
        const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.2, 1.0, 1.1);
        this.mesh.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.2, 1.0, 1.12);
        this.mesh.add(leftPupil);

        // Right Eye
        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.2, 1.0, 1.1);
        this.mesh.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.2, 1.0, 1.12);
        this.mesh.add(rightPupil);

        // Curly Tail
        const tailGroup = new THREE.Group();
        tailGroup.position.set(0, 0.8, -0.55); // Back of body
        this.mesh.add(tailGroup);

        const tailSegGeo = new THREE.BoxGeometry(0.1, 0.1, 0.15);
        // Segment 1 (Base)
        const tail1 = new THREE.Mesh(tailSegGeo, mat);
        tail1.position.set(0, 0, 0);
        tail1.rotation.x = -0.5;
        tailGroup.add(tail1);

        // Segment 2 (Curl up)
        const tail2 = new THREE.Mesh(tailSegGeo, mat);
        tail2.position.set(0, 0.08, -0.1);
        tail2.rotation.x = -1.5;
        tailGroup.add(tail2);

        // Segment 3 (Curl back)
        const tail3 = new THREE.Mesh(tailSegGeo, mat);
        tail3.position.set(0, 0.05, -0.2); // Relative to group
        // A simple spiral approximation is hard with boxes, let's just make a little hook
        // Re-positioning for a simpler hook look
        tail1.position.set(0, 0, 0);
        tail1.rotation.set(0.5, 0, 0);

        tail2.position.set(0, 0.1, -0.05);
        tail2.rotation.set(1.5, 0, 0);

        tail3.position.set(0, 0.05, -0.12);
        tail3.rotation.set(2.5, 0, 0);
        // Just keeping previous add calls, overwriting pos

        // Legs with Hooves
        // Leg Geometry: Top part pink, bottom part hoof
        const legW = 0.25;
        const legH = 0.4;
        const hoofH = 0.1;

        const legGeo = new THREE.BoxGeometry(legW, legH - hoofH, legW);
        const hoofGeo = new THREE.BoxGeometry(legW, hoofH, legW);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.4, z); // Hip position

            // Upper leg
            const legMesh = new THREE.Mesh(legGeo, mat);
            legMesh.position.set(0, -((legH - hoofH) / 2), 0);
            pivot.add(legMesh);

            // Hoof
            const hoofMesh = new THREE.Mesh(hoofGeo, hoofMat);
            hoofMesh.position.set(0, -(legH - hoofH) - (hoofH / 2), 0);
            pivot.add(hoofMesh);

            // Re-center pivot visuals so 0,0,0 is top of leg
            // Total lenth is legH. 
            // legMesh center Y = - (0.3 / 2) = -0.15
            // hoofMesh center Y = -0.3 - 0.05 = -0.35
            // Visuals look correct relative to pivot.

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.25, 0.4),  // Front Left
            makeLeg(0.25, 0.4),   // Front Right
            makeLeg(-0.25, -0.4), // Back Left
            makeLeg(0.25, -0.4)   // Back Right
        ];
    }

    createSpeechBubble() {
        // Create a canvas for the speech text
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        this.speechCanvas = canvas;
        this.speechContext = canvas.getContext('2d');

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        this.speechTexture = texture;

        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });

        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(2.0, 0.5, 1);
        sprite.position.set(0, 1.5, 0); // Above pig
        sprite.visible = false;
        this.mesh.add(sprite);
        this.speechBubble = sprite;
    }

    updateSpeechBubble(text) {
        const ctx = this.speechContext;
        const canvas = this.speechCanvas;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!text) {
            this.speechBubble.visible = false;
            return;
        }

        // Draw bubble background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;

        // Rounded rectangle
        const padding = 20;
        const radius = 20;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(padding, padding, canvas.width - padding * 2, canvas.height - padding * 2, radius);
        } else {
            // Fallback for older browsers if needed, but roundRect is standard now
            ctx.rect(padding, padding, canvas.width - padding * 2, canvas.height - padding * 2);
        }
        ctx.fill();
        ctx.stroke();

        // Draw text
        ctx.fillStyle = '#333';
        ctx.font = 'bold 32px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        this.speechTexture.needsUpdate = true;
        this.speechBubble.visible = true;
    }

    talk(phrase) {
        this.currentPhrase = phrase;
        this.phraseTimer = 3.0;
        this.updateSpeechBubble(phrase);
    }

    updateAI(dt) {
        this.updateSocial(dt);

        // Update speech bubble timer
        if (this.phraseTimer > 0) {
            this.phraseTimer -= dt;
            if (this.phraseTimer <= 0) {
                this.currentPhrase = null;
                this.updateSpeechBubble(null);
            }
        }

        super.updateAI(dt);
    }

    interact(player) {
        // Face player
        const dx = player.position.x - this.position.x;
        const dz = player.position.z - this.position.z;
        this.rotation = Math.atan2(dx, dz);
        this.mesh.rotation.y = this.rotation;

        // Pick a phrase
        const text = PHRASES[Math.floor(Math.random() * PHRASES.length)];

        // Play Sound
        if (this.game.soundManager) {
            this.game.soundManager.playSound('pig_oink', this.position);
        }

        // Show bubble
        this.talk(text);

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

        // Filter for other Pigs
        const neighbors = this.game.animals.filter(a =>
            a !== this &&
            a instanceof Pig &&
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
        const text = PHRASES[Math.floor(Math.random() * PHRASES.length)];
        this.talk(text);

        // Friend responds after delay
        setTimeout(() => {
            if (!friend.isDead) {
                const reply = PHRASES[Math.floor(Math.random() * PHRASES.length)];
                if (friend.talk) friend.talk(reply);
            }
        }, 1500);

        this.socialCooldown = 15.0; // Don't talk again too soon
        friend.socialCooldown = 15.0;
    }
}
