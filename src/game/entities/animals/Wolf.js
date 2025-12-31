import * as THREE from 'three';
import { Animal } from '../Animal.js';
import { Bunny } from './Bunny.js';

const PHRASES = [
    "Woof!",
    "Bark!",
    "Grrr...",
    "Sniff sniff.",
    "Aroooo!",
    "Where is the bone?",
    "Chasing bunnies is fun.",
    "The moon is beautiful.",
    "I smell something.",
    "Friendly wag."
];

export class Wolf extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.6;
        this.height = 0.8;
        this.depth = 3.0; // Accurate length ~3.0
        this.collisionScale = 1.0; // No shrinking for collision box
        this.speed = 5.0; // Fast
        this.createBody();
        this.attackTimer = 0;

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
        // Wolf: Grey
        const furColor = 0x808080;
        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const noseMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.6, 0.6, 1.4); // Longer body mesh
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.6, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.6);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.9, 0.9); // Moved head forward slightly (0.7 -> 0.9)
        this.mesh.add(head);

        // Snout
        const snoutGeo = new THREE.BoxGeometry(0.25, 0.25, 0.3);
        const snout = new THREE.Mesh(snoutGeo, mat);
        snout.position.set(0, 0.8, 1.3); // Moved snout forward (1.1 -> 1.3)
        this.mesh.add(snout);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 0.9, 1.45); // Moved nose forward (1.25 -> 1.45)
        this.mesh.add(nose);

        // Ears (Pointy)
        const earGeo = new THREE.BoxGeometry(0.15, 0.2, 0.1);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.18, 1.2, 0.85); // Moved ears forward (0.65 -> 0.85)
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.18, 1.2, 0.85); // Moved ears forward (0.65 -> 0.85)
        this.mesh.add(rightEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const pupilGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);

        // Left Eye
        const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.15, 0.95, 1.2); // Moved eyes forward (1.0 -> 1.2)
        this.mesh.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.15, 0.95, 1.23); // Moved pupils forward (1.03 -> 1.23)
        this.mesh.add(leftPupil);

        // Right Eye
        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.15, 0.95, 1.2); // Moved eyes forward (1.0 -> 1.2)
        this.mesh.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.15, 0.95, 1.23); // Moved pupils forward (1.03 -> 1.23)
        this.mesh.add(rightPupil);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.15, 0.15, 1.0); // Longer tail (0.6 -> 1.0)
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 0.7, -0.9); // Moved tail back (-0.6 -> -0.9)
        tail.rotation.x = -0.4;
        this.mesh.add(tail);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.2, 0.5, 0.2);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.5, z);
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.25, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.2, 0.5), // Spread legs a bit more (0.4 -> 0.5)
            makeLeg(0.2, 0.5),
            makeLeg(-0.2, -0.5), // (-0.4 -> -0.5)
            makeLeg(0.2, -0.5)
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
        sprite.position.set(0, 1.8, 0); // Above wolf
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

        // Look for bunnies!
        const detectionRange = 20.0;
        const attackRange = 1.5;
        let target = null;
        let nearestDist = detectionRange * detectionRange;

        if (this.game.animals) {
            for (const animal of this.game.animals) {
                if (animal instanceof Bunny && !animal.isDead) {
                    const distSq = this.position.distanceToSquared(animal.position);
                    if (distSq < nearestDist) {
                        nearestDist = distSq;
                        target = animal;
                    }
                }
            }
        }

        // Prioritize Player
        const player = this.game.player;
        if (player && !player.isDead) { // Assume player has isDead or health > 0 check
            const distToPlayerSq = this.position.distanceToSquared(player.position);
            if (distToPlayerSq < detectionRange * detectionRange) {
                // Player is closer or we just really hate players
                // Let's prioritize player if within range
                target = player;
            }
        }

        if (target) {
            this.state = 'chase';
            // Move towards target
            const dir = new THREE.Vector3().subVectors(target.position, this.position);
            const dist = dir.length();

            if (dist < attackRange) {
                // ATTACK!
                if (target instanceof Bunny) {
                    target.takeDamage(100); // Instakill bunnies
                } else if (target === player) {
                    // Attack player
                    if (this.attackTimer <= 0) {
                        target.takeDamage(2); // 1 heart

                        // Calculated knockback
                        const kbDir = dir.clone().normalize();
                        target.knockback(kbDir, 0.5);

                        this.attackTimer = 1.0; // Cooldown
                    }
                }

                // Stop moving briefly
                // this.state = 'idle';
                // this.stateTimer = 1.0;
                // this.isMoving = false;

                // For player, keep chasing but maybe slower? 
                // Let's just pause briefly to "bite"
                if (this.attackTimer > 0) {
                    this.attackTimer -= dt;
                }

            } else {
                dir.normalize();
                this.moveDirection.copy(dir);
                this.rotation = Math.atan2(dir.x, dir.z);
                this.isMoving = true;
            }
        } else {
            // No targets, wander normally
            super.updateAI(dt);
        }
    }



    interact(player) {
        // Face player
        const dx = player.position.x - this.position.x;
        const dz = player.position.z - this.position.z;
        this.rotation = Math.atan2(dx, dz);
        this.mesh.rotation.y = this.rotation;

        // Pick a phrase
        const text = PHRASES[Math.floor(Math.random() * PHRASES.length)];

        // Show dialogue
        this.talk(text);

        // Stop moving briefly
        if (this.state !== 'chase') {
            this.state = 'idle';
            this.stateTimer = 3.0;
            this.isMoving = false;
        }
    }

    updateSocial(dt) {
        // Don't socialize if chasing or attacking
        if (this.state === 'chase' || this.socialCooldown > 0) {
            if (this.socialCooldown > 0) this.socialCooldown -= dt;
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

        // Filter for other Wolves
        const neighbors = this.game.animals.filter(a =>
            a !== this &&
            a instanceof Wolf &&
            !a.isDead &&
            a.state !== 'chase' && // Don't talk to chasing wolves
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
            if (!friend.isDead && friend.state !== 'chase') {
                const reply = PHRASES[Math.floor(Math.random() * PHRASES.length)];
                if (friend.talk) friend.talk(reply);
            }
        }, 1500);

        this.socialCooldown = 15.0; // Don't talk again too soon
        friend.socialCooldown = 15.0;
    }
}
