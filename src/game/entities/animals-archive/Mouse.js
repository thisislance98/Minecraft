import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Mouse extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        
        // Dimensions: Small mouse
        this.width = 0.4;
        this.height = 0.3;
        this.depth = 0.5;
        
        this.speed = 4.0; // Fast!
        this.health = 2;
        this.maxHealth = 2;

        // Talking logic
        this.talkTimer = 2 + Math.random() * 5;
        this.phrases = [
            "Squeak! Have you seen any cheese?",
            "Watch out for the cats!",
            "This jungle is huge!",
            "I'm small but I'm fast!",
            "Do you have a crumb to spare?",
            "Squeak squeak!",
            "I love exploring!",
            "Is that an elephant? Wow, so big!",
            "I'm a talking mouse! Can you believe it?",
            "The cheese is a lie... just kidding, I love cheese!",
            "Hey there, giant!"
        ];

        this.createBody();
    }

    createBody() {
        const mouseColor = 0x999999; // Grey
        const mat = new THREE.MeshLambertMaterial({ color: mouseColor });
        const earMat = new THREE.MeshLambertMaterial({ color: 0xffaaaa }); // Pink inner ear
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 }); // Black eyes
        const noseMat = new THREE.MeshLambertMaterial({ color: 0x333333 }); // Dark nose

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.3, 0.25, 0.45);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.125, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.25, 0.2, 0.25);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.2, 0.25);
        this.mesh.add(head);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.1, 0.08, 0.1);
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 0.18, 0.4);
        this.mesh.add(nose);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.15, 0.15, 0.05);
        const innerEarGeo = new THREE.BoxGeometry(0.1, 0.1, 0.01);

        // Left Ear
        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.15, 0.35, 0.2);
        leftEar.rotation.y = 0.2;
        this.mesh.add(leftEar);

        const leftInnerEar = new THREE.Mesh(innerEarGeo, earMat);
        leftInnerEar.position.set(-0.15, 0.35, 0.22);
        leftInnerEar.rotation.y = 0.2;
        this.mesh.add(leftInnerEar);

        // Right Ear
        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.15, 0.35, 0.2);
        rightEar.rotation.y = -0.2;
        this.mesh.add(rightEar);

        const rightInnerEar = new THREE.Mesh(innerEarGeo, earMat);
        rightInnerEar.position.set(0.15, 0.35, 0.22);
        rightInnerEar.rotation.y = -0.2;
        this.mesh.add(rightInnerEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
        
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.08, 0.25, 0.35);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.08, 0.25, 0.35);
        this.mesh.add(rightEye);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.04, 0.04, 0.3);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 0.1, -0.3);
        tail.rotation.x = -0.2;
        this.mesh.add(tail);
        this.tail = tail;

        // Legs (tiny nubs)
        const legGeo = new THREE.BoxGeometry(0.08, 0.1, 0.08);
        
        const makeLeg = (x, z) => {
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(x, 0.05, z);
            this.mesh.add(leg);
            return leg;
        };

        this.legParts = [
            makeLeg(-0.1, 0.15),
            makeLeg(0.1, 0.15),
            makeLeg(-0.1, -0.15),
            makeLeg(0.1, -0.15)
        ];
    }

    updateAI(dt) {
        super.updateAI(dt);

        // Talking logic
        this.talkTimer -= dt;
        if (this.talkTimer <= 0) {
            this.talk();
            this.talkTimer = 8 + Math.random() * 12; // Randomly talk every 8-20 seconds
        }

        // Proximity talk: if player is very close, maybe say something
        if (this.game.player) {
            const dist = this.position.distanceTo(this.game.player.position);
            if (dist < 5.0 && Math.random() < 0.05) { // 5% chance per frame when close
                this.talk();
                this.talkTimer = 10; // Reset timer so it doesn't double talk
            }
        }
    }

    talk() {
        if (!this.game.uiManager) return;
        
        const phrase = this.phrases[Math.floor(Math.random() * this.phrases.length)];
        this.game.uiManager.addChatMessage(`Mouse`, phrase, "#aaaaaa");
    }

    updateAnimation(dt) {
        super.updateAnimation(dt);

        // Extra tail wiggle
        if (this.tail) {
            this.tail.rotation.y = Math.sin(this.animTime * 10) * 0.3;
        }
    }
}
