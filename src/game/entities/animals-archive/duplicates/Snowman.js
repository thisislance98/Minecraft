import * as THREE from 'three';
import { Animal } from '../Animal.js';

// Snowman phrases for "talking"
const SNOWMAN_PHRASES = [
    "❄️ Brrr! What a lovely day!",
    "🎄 Happy Holidays!",
    "⛄ Do you want to build a snowman?",
    "❄️ I'm not melting... am I?",
    "🌨️ Snow is my favorite weather!",
    "⛄ Hi there, friend!",
    "❄️ Stay frosty!",
    "🎅 Have you seen Santa?",
    "⛄ I love the cold!",
    "❄️ Let it snow, let it snow!",
    "🧣 Nice scarf weather, isn't it?",
    "⛄ Winter wonderland vibes!",
    "❄️ Catch a snowflake!"
];

export class Snowman extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.8;
        this.height = 2.0;
        this.depth = 0.8;
        this.speed = 1.2; // Slower, waddles around

        // Talking mechanism
        this.talkCooldown = 0;
        this.currentPhrase = null;
        this.phraseTimer = 0;
        this.speechBubble = null;

        // Animation extras
        this.bounceTime = 0;
        this.armWaveTime = 0;

        this.createBody();
    }

    createBody() {
        // Classic snowman colors
        const snowMat = new THREE.MeshLambertMaterial({ color: 0xFFFAFA }); // Snow white
        const coalMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a }); // Coal black
        const carrotMat = new THREE.MeshLambertMaterial({ color: 0xFF6600 }); // Orange carrot
        const stickMat = new THREE.MeshLambertMaterial({ color: 0x4a2c0a }); // Brown sticks
        const scarfMat = new THREE.MeshLambertMaterial({ color: 0xCC0000 }); // Red scarf
        const hatMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a }); // Black hat

        // === Bottom sphere (largest) ===
        const bottomGeo = new THREE.SphereGeometry(0.5, 12, 10);
        const bottom = new THREE.Mesh(bottomGeo, snowMat);
        bottom.position.set(0, 0.5, 0);
        this.mesh.add(bottom);

        // Bottom coal buttons
        for (let i = 0; i < 3; i++) {
            const buttonGeo = new THREE.SphereGeometry(0.05, 6, 6);
            const button = new THREE.Mesh(buttonGeo, coalMat);
            button.position.set(0, 0.3 + i * 0.15, 0.48);
            this.mesh.add(button);
        }

        // === Middle sphere ===
        const middleGeo = new THREE.SphereGeometry(0.4, 12, 10);
        const middle = new THREE.Mesh(middleGeo, snowMat);
        middle.position.set(0, 1.15, 0);
        this.mesh.add(middle);

        // Middle coal buttons
        for (let i = 0; i < 2; i++) {
            const buttonGeo = new THREE.SphereGeometry(0.04, 6, 6);
            const button = new THREE.Mesh(buttonGeo, coalMat);
            button.position.set(0, 1.0 + i * 0.15, 0.38);
            this.mesh.add(button);
        }

        // === Top sphere (head) ===
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.7, 0);
        this.mesh.add(headGroup);
        this.headGroup = headGroup;

        const headGeo = new THREE.SphereGeometry(0.3, 12, 10);
        const head = new THREE.Mesh(headGeo, snowMat);
        head.position.set(0, 0, 0);
        headGroup.add(head);

        // === Eyes (coal) ===
        const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
        const leftEye = new THREE.Mesh(eyeGeo, coalMat);
        leftEye.position.set(-0.1, 0.05, 0.26);
        headGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, coalMat);
        rightEye.position.set(0.1, 0.05, 0.26);
        headGroup.add(rightEye);

        // === Carrot nose ===
        const noseGeo = new THREE.ConeGeometry(0.05, 0.25, 8);
        const nose = new THREE.Mesh(noseGeo, carrotMat);
        nose.position.set(0, -0.02, 0.35);
        nose.rotation.x = Math.PI / 2;
        headGroup.add(nose);

        // === Smile (coal pieces) ===
        for (let i = -2; i <= 2; i++) {
            const smileGeo = new THREE.SphereGeometry(0.02, 4, 4);
            const smilePiece = new THREE.Mesh(smileGeo, coalMat);
            const angle = i * 0.2;
            smilePiece.position.set(
                i * 0.05,
                -0.12 + Math.abs(i) * 0.02,
                0.28
            );
            headGroup.add(smilePiece);
        }

        // === Top hat ===
        const hatBrimGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.03, 12);
        const hatBrim = new THREE.Mesh(hatBrimGeo, hatMat);
        hatBrim.position.set(0, 0.28, 0);
        headGroup.add(hatBrim);

        const hatTopGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.25, 12);
        const hatTop = new THREE.Mesh(hatTopGeo, hatMat);
        hatTop.position.set(0, 0.42, 0);
        headGroup.add(hatTop);

        // Hat band (red)
        const bandGeo = new THREE.CylinderGeometry(0.16, 0.19, 0.04, 12);
        const band = new THREE.Mesh(bandGeo, scarfMat);
        band.position.set(0, 0.32, 0);
        headGroup.add(band);

        // === Scarf around neck ===
        const scarfGeo = new THREE.TorusGeometry(0.28, 0.05, 6, 12);
        const scarf = new THREE.Mesh(scarfGeo, scarfMat);
        scarf.position.set(0, 1.45, 0);
        scarf.rotation.x = Math.PI / 2;
        this.mesh.add(scarf);

        // Scarf tail hanging
        const tailGeo = new THREE.BoxGeometry(0.08, 0.25, 0.03);
        const scarfTail = new THREE.Mesh(tailGeo, scarfMat);
        scarfTail.position.set(0.2, 1.35, 0.15);
        scarfTail.rotation.z = 0.3;
        this.mesh.add(scarfTail);

        // === Stick arms ===
        // Left arm
        const leftArmGroup = new THREE.Group();
        leftArmGroup.position.set(-0.4, 1.15, 0);
        this.mesh.add(leftArmGroup);
        this.leftArm = leftArmGroup;

        const leftArmGeo = new THREE.CylinderGeometry(0.03, 0.02, 0.5, 6);
        const leftArmMesh = new THREE.Mesh(leftArmGeo, stickMat);
        leftArmMesh.rotation.z = Math.PI / 4;
        leftArmMesh.position.set(-0.2, 0, 0);
        leftArmGroup.add(leftArmMesh);

        // Left arm twigs (fingers)
        for (let i = 0; i < 3; i++) {
            const twigGeo = new THREE.CylinderGeometry(0.015, 0.01, 0.12, 4);
            const twig = new THREE.Mesh(twigGeo, stickMat);
            twig.position.set(-0.38, 0.05 + i * 0.05, (i - 1) * 0.05);
            twig.rotation.z = Math.PI / 3 + i * 0.2;
            leftArmGroup.add(twig);
        }

        // Right arm
        const rightArmGroup = new THREE.Group();
        rightArmGroup.position.set(0.4, 1.15, 0);
        this.mesh.add(rightArmGroup);
        this.rightArm = rightArmGroup;

        const rightArmGeo = new THREE.CylinderGeometry(0.03, 0.02, 0.5, 6);
        const rightArmMesh = new THREE.Mesh(rightArmGeo, stickMat);
        rightArmMesh.rotation.z = -Math.PI / 4;
        rightArmMesh.position.set(0.2, 0, 0);
        rightArmGroup.add(rightArmMesh);

        // Right arm twigs
        for (let i = 0; i < 3; i++) {
            const twigGeo = new THREE.CylinderGeometry(0.015, 0.01, 0.12, 4);
            const twig = new THREE.Mesh(twigGeo, stickMat);
            twig.position.set(0.38, 0.05 + i * 0.05, (i - 1) * 0.05);
            twig.rotation.z = -Math.PI / 3 - i * 0.2;
            rightArmGroup.add(twig);
        }

        // === Speech bubble (initially hidden) ===
        this.createSpeechBubble();
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
        sprite.scale.set(2.5, 0.6, 1);
        sprite.position.set(0, 2.5, 0);
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
        ctx.roundRect(padding, padding, canvas.width - padding * 2, canvas.height - padding * 2, radius);
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

    talk() {
        // Pick a random phrase
        const phrase = SNOWMAN_PHRASES[Math.floor(Math.random() * SNOWMAN_PHRASES.length)];
        this.currentPhrase = phrase;
        this.phraseTimer = 3.0; // Show for 3 seconds
        this.updateSpeechBubble(phrase);

        // Wave arms when talking
        this.armWaveTime = 0;
    }

    update(dt) {
        super.update(dt);

        // Talking logic
        this.talkCooldown -= dt;
        if (this.talkCooldown <= 0) {
            // Random chance to talk when player is nearby
            const distToPlayer = this.position.distanceTo(this.game.player.position);
            if (distToPlayer < 8) {
                if (Math.random() < 0.02) { // 2% chance per frame when nearby
                    this.talk();
                    this.talkCooldown = 8.0; // 8 second cooldown
                }
            }
        }

        // Update speech bubble timer
        if (this.phraseTimer > 0) {
            this.phraseTimer -= dt;
            if (this.phraseTimer <= 0) {
                this.currentPhrase = null;
                this.updateSpeechBubble(null);
            }
        }

        // Arm waving animation when talking
        if (this.currentPhrase && this.leftArm && this.rightArm) {
            this.armWaveTime += dt * 8;
            const wave = Math.sin(this.armWaveTime) * 0.3;
            this.leftArm.rotation.z = wave;
            this.rightArm.rotation.z = -wave;
        } else if (this.leftArm && this.rightArm) {
            // Subtle idle arm movement
            this.leftArm.rotation.z = Math.sin(this.animTime * 0.5) * 0.05;
            this.rightArm.rotation.z = -Math.sin(this.animTime * 0.5) * 0.05;
        }

        // Bouncy walk animation
        if (this.isMoving) {
            this.bounceTime += dt * 6;
            this.mesh.position.y = this.position.y + Math.abs(Math.sin(this.bounceTime)) * 0.08;
        }

        // Speech bubble always faces camera
        if (this.speechBubble && this.speechBubble.visible && this.game.camera) {
            // Sprites auto-face camera, but we want to ensure it's above the snowman
            this.speechBubble.position.set(0, 2.5, 0);
        }

        // Head bobbing
        if (this.headGroup) {
            this.headGroup.rotation.z = Math.sin(this.animTime * 2) * 0.03;
        }
    }

    updateAnimation(dt) {
        this.animTime += dt;

        // No leg parts for snowman - it waddles as a whole
        // The bouncing is handled in update()
    }
}
