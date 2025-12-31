import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Ladybug extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.3;
        this.height = 0.2;
        this.depth = 0.3;
        this.speed = 1.5;
        this.createBody();
        this.mesh.scale.set(0.5, 0.5, 0.5); // Tiny insect!

        // Ladybug behavior
        this.crawlTimer = 0;
        this.pauseTimer = 0;
        this.isPaused = false;
        this.wingsOpen = false;
        this.wingAngle = 0;
    }

    createBody() {
        const redMat = new THREE.MeshLambertMaterial({ color: 0xCC0000 }); // Bright red
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });

        // Main body (dome-shaped shell)
        const shellGeo = new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
        const shell = new THREE.Mesh(shellGeo, redMat);
        shell.position.set(0, 0.1, 0);
        shell.rotation.x = Math.PI;
        this.mesh.add(shell);

        // Black stripe down the middle
        const stripeGeo = new THREE.BoxGeometry(0.02, 0.12, 0.35);
        const stripe = new THREE.Mesh(stripeGeo, blackMat);
        stripe.position.set(0, 0.15, 0);
        this.mesh.add(stripe);

        // Black spots on shell
        const spotGeo = new THREE.CircleGeometry(0.04, 6);
        const spotPositions = [
            { x: -0.1, y: 0.18, z: 0.05, rx: -0.3 },
            { x: 0.1, y: 0.18, z: 0.05, rx: -0.3 },
            { x: -0.08, y: 0.16, z: -0.08, rx: 0.3 },
            { x: 0.08, y: 0.16, z: -0.08, rx: 0.3 },
            { x: -0.12, y: 0.14, z: 0.0, rx: 0 },
            { x: 0.12, y: 0.14, z: 0.0, rx: 0 }
        ];

        spotPositions.forEach(pos => {
            const spot = new THREE.Mesh(spotGeo, blackMat);
            spot.position.set(pos.x, pos.y, pos.z);
            spot.rotation.x = -Math.PI / 2 + pos.rx;
            spot.rotation.z = Math.atan2(pos.x, 0.2);
            this.mesh.add(spot);
        });

        // Head
        const headGeo = new THREE.SphereGeometry(0.08, 6, 4);
        const head = new THREE.Mesh(headGeo, blackMat);
        head.position.set(0, 0.1, 0.2);
        this.mesh.add(head);

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.02, 4, 4);
        const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.04, 0.12, 0.25);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.04, 0.12, 0.25);
        this.mesh.add(rightEye);

        // Antennae
        const antennaGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.1, 4);

        const leftAntenna = new THREE.Mesh(antennaGeo, blackMat);
        leftAntenna.position.set(-0.03, 0.18, 0.22);
        leftAntenna.rotation.z = 0.3;
        leftAntenna.rotation.x = -0.3;
        this.mesh.add(leftAntenna);

        const rightAntenna = new THREE.Mesh(antennaGeo, blackMat);
        rightAntenna.position.set(0.03, 0.18, 0.22);
        rightAntenna.rotation.z = -0.3;
        rightAntenna.rotation.x = -0.3;
        this.mesh.add(rightAntenna);

        // Legs (6 tiny legs)
        const legGeo = new THREE.BoxGeometry(0.02, 0.05, 0.02);
        this.legParts = [];

        for (let i = 0; i < 3; i++) {
            const zOffset = 0.1 - i * 0.08;

            const leftLeg = new THREE.Mesh(legGeo, blackMat);
            leftLeg.position.set(-0.12, 0.03, zOffset);
            this.mesh.add(leftLeg);
            this.legParts.push(leftLeg);

            const rightLeg = new THREE.Mesh(legGeo, blackMat);
            rightLeg.position.set(0.12, 0.03, zOffset);
            this.mesh.add(rightLeg);
            this.legParts.push(rightLeg);
        }

        // Wings (hidden under shell, for animation)
        const wingGeo = new THREE.BoxGeometry(0.15, 0.01, 0.25);
        const wingMat = new THREE.MeshLambertMaterial({ color: 0x888888, transparent: true, opacity: 0.6 });

        this.leftWing = new THREE.Mesh(wingGeo, wingMat);
        this.leftWing.position.set(-0.02, 0.12, -0.02);
        this.leftWing.visible = false;
        this.mesh.add(this.leftWing);

        this.rightWing = new THREE.Mesh(wingGeo, wingMat);
        this.rightWing.position.set(0.02, 0.12, -0.02);
        this.rightWing.visible = false;
        this.mesh.add(this.rightWing);
    }

    updateAI(dt) {
        // Simple crawl and pause behavior
        if (this.isPaused) {
            this.pauseTimer -= dt;
            if (this.pauseTimer <= 0) {
                this.isPaused = false;
                this.crawlTimer = 2 + Math.random() * 3;
                // Pick new random direction
                this.rotation = Math.random() * Math.PI * 2;
            }
            this.state = 'idle';
            this.isMoving = false;
        } else {
            this.crawlTimer -= dt;
            if (this.crawlTimer <= 0) {
                this.isPaused = true;
                this.pauseTimer = 0.5 + Math.random() * 1.5;
            } else {
                // Crawl forward
                this.moveDirection.set(
                    Math.sin(this.rotation),
                    0,
                    Math.cos(this.rotation)
                );
                this.state = 'walk';
                this.isMoving = true;
            }
        }

        // Occasionally change direction slightly while crawling
        if (!this.isPaused && Math.random() < 0.02) {
            this.rotation += (Math.random() - 0.5) * 0.5;
        }
    }

    updateAnimation(dt) {
        // Tiny leg wiggles
        if (this.isMoving && this.legParts.length > 0) {
            this.animTime += dt * 20;
            for (let i = 0; i < this.legParts.length; i++) {
                const phase = (i % 2 === 0) ? 0 : Math.PI;
                this.legParts[i].rotation.x = Math.sin(this.animTime + phase) * 0.3;
            }
        }

        // Wing flutter animation (when opening wings)
        if (this.wingsOpen) {
            this.wingAngle = Math.sin(this.animTime * 15) * 0.5 + 1;
            this.leftWing.rotation.z = this.wingAngle;
            this.rightWing.rotation.z = -this.wingAngle;
        }
    }
}
