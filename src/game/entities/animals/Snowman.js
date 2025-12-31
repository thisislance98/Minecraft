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
        this.width = 4.0;
        this.height = 8.0;
        this.depth = 4.0;
        this.speed = 1.0;

        this.mesh.scale.set(2, 2, 2);

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

        // === Bottom block (2x2x2) ===
        const bottomGeo = new THREE.BoxGeometry(2.0, 2.0, 2.0);
        const bottom = new THREE.Mesh(bottomGeo, snowMat);
        bottom.position.set(0, 1.0, 0);
        this.mesh.add(bottom);

        // Buttons
        for (let i = 0; i < 2; i++) {
            const buttonGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
            const button = new THREE.Mesh(buttonGeo, coalMat);
            button.position.set(0, 0.8 + i * 0.8, 1.02);
            this.mesh.add(button);
        }

        // === Middle block (1.6x1.6x1.6) ===
        const middleGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
        const middle = new THREE.Mesh(middleGeo, snowMat);
        middle.position.set(0, 2.8, 0);
        this.mesh.add(middle);

        // Middle button
        const midButtonGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const midButton = new THREE.Mesh(midButtonGeo, coalMat);
        midButton.position.set(0, 2.8, 0.82);
        this.mesh.add(midButton);

        // === Head (1.2x1.2x1.2) ===
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 4.2, 0);
        this.mesh.add(headGroup);
        this.headGroup = headGroup;

        const headGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        const head = new THREE.Mesh(headGeo, snowMat);
        headGroup.add(head);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const leftEye = new THREE.Mesh(eyeGeo, coalMat);
        leftEye.position.set(-0.3, 0.2, 0.62);
        headGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, coalMat);
        rightEye.position.set(0.3, 0.2, 0.62);
        headGroup.add(rightEye);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.2, 0.2, 0.4);
        const nose = new THREE.Mesh(noseGeo, carrotMat);
        nose.position.set(0, -0.1, 0.8);
        headGroup.add(nose);

        // === Hat ===
        const brimGeo = new THREE.BoxGeometry(1.6, 0.2, 1.6);
        const brim = new THREE.Mesh(brimGeo, hatMat);
        brim.position.set(0, 0.7, 0);
        headGroup.add(brim);

        const topHatGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
        const topHat = new THREE.Mesh(topHatGeo, hatMat);
        topHat.position.set(0, 1.3, 0);
        headGroup.add(topHat);

        // === Scarf ===
        const scarfGeo = new THREE.BoxGeometry(1.4, 0.4, 1.4);
        const scarf = new THREE.Mesh(scarfGeo, scarfMat);
        scarf.position.set(0, 3.6, 0);
        this.mesh.add(scarf);

        // === Arms ===
        const armGeo = new THREE.BoxGeometry(1.2, 0.2, 0.2);
        
        const leftArm = new THREE.Mesh(armGeo, stickMat);
        leftArm.position.set(-1.2, 2.8, 0);
        this.mesh.add(leftArm);
        this.leftArm = leftArm;

        const rightArm = new THREE.Mesh(armGeo, stickMat);
        rightArm.position.set(1.2, 2.8, 0);
        this.mesh.add(rightArm);
        this.rightArm = rightArm;

        this.createSpeechBubble();
    }

    createSpeechBubble() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        this.speechCanvas = canvas;
        this.speechContext = canvas.getContext('2d');
        const texture = new THREE.CanvasTexture(canvas);
        this.speechTexture = texture;
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(5.0, 1.2, 2);
        sprite.position.set(0, 5.6, 0);
        sprite.visible = false;
        this.mesh.add(sprite);
        this.speechBubble = sprite;
    }

    updateSpeechBubble(text) {
        const ctx = this.speechContext;
        const canvas = this.speechCanvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!text) { this.speechBubble.visible = false; return; }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(20, 20, canvas.width - 40, canvas.height - 40, 20);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#333';
        ctx.font = 'bold 32px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        this.speechTexture.needsUpdate = true;
        this.speechBubble.visible = true;
    }

    talk() {
        const phrase = SNOWMAN_PHRASES[Math.floor(Math.random() * SNOWMAN_PHRASES.length)];
        this.updateSpeechBubble(phrase);
        this.phraseTimer = 3.0;
    }

    update(dt) {
        super.update(dt);
        this.talkCooldown -= dt;
        if (this.talkCooldown <= 0) {
            const dist = this.position.distanceTo(this.game.player.position);
            if (dist < 8 && Math.random() < 0.02) {
                this.talk();
                this.talkCooldown = 8.0;
            }
        }
        if (this.phraseTimer > 0) {
            this.phraseTimer -= dt;
            if (this.phraseTimer <= 0) this.updateSpeechBubble(null);
        }
        this.bounceTime += dt * 2;
        this.mesh.position.y = Math.abs(Math.sin(this.bounceTime)) * 0.1;
        if (this.headGroup) {
            this.headGroup.rotation.z = Math.sin(this.bounceTime * 0.5) * 0.1;
        }
        const wave = Math.sin(this.bounceTime * 2) * 0.2;
        if (this.leftArm) this.leftArm.rotation.z = wave;
        if (this.rightArm) this.rightArm.rotation.z = -wave;
    }
}
