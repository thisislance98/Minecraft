import * as THREE from 'three';
import { Animal } from '../Animal.js';

/**
 * Puppy - A cute small dog that can be shot from the Puppy Wand!
 * Based on GoldenRetriever but smaller and cuter.
 */
export class Puppy extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        // Puppies are small!
        this.width = 0.3;
        this.height = 0.4;
        this.depth = 0.5;
        this.speed = 5.0; // Puppies are fast and energetic!

        // Puppies are friendly and flee from players
        this.fleeOnProximity = true;
        this.fleeRange = 3.0;

        this.createBody();
    }

    createBody() {
        // Random puppy colors - golden, brown, black, white, or spotted
        const colors = [
            0xD4AF37, // Golden
            0x8B4513, // Saddle Brown
            0x2F1810, // Dark Brown
            0xF5F5DC, // Beige/Cream
            0xFFF8DC, // Cornsilk (Light golden)
            0xA0522D, // Sienna
        ];

        const furColor = colors[Math.floor(Math.random() * colors.length)];
        const noseColor = 0x1A1A1A;
        const tongueColor = 0xFF6B9D; // Pink tongue!

        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const noseMat = new THREE.MeshLambertMaterial({ color: noseColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const tongueMat = new THREE.MeshLambertMaterial({ color: tongueColor });
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });

        // Body - small and chubby
        const bodyGeo = new THREE.BoxGeometry(0.25, 0.2, 0.35);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.25, 0);
        this.mesh.add(body);

        // Head - big compared to body (puppy proportions!)
        const headGeo = new THREE.BoxGeometry(0.22, 0.2, 0.22);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.38, 0.22);
        this.mesh.add(head);

        // Snout - small and cute
        const snoutGeo = new THREE.BoxGeometry(0.12, 0.1, 0.12);
        const snout = new THREE.Mesh(snoutGeo, mat);
        snout.position.set(0, 0.33, 0.38);
        this.mesh.add(snout);

        // Nose - little black nose
        const noseGeo = new THREE.BoxGeometry(0.06, 0.05, 0.03);
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 0.36, 0.44);
        this.mesh.add(nose);

        // Tongue sticking out! (So cute!)
        const tongueGeo = new THREE.BoxGeometry(0.06, 0.02, 0.08);
        const tongue = new THREE.Mesh(tongueGeo, tongueMat);
        tongue.position.set(0, 0.28, 0.42);
        tongue.rotation.x = 0.3; // Slight angle down
        this.mesh.add(tongue);

        // Floppy Ears - big and floppy for a puppy
        const earGeo = new THREE.BoxGeometry(0.06, 0.14, 0.08);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.12, 0.4, 0.2);
        leftEar.rotation.z = 0.3;
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.12, 0.4, 0.2);
        rightEar.rotation.z = -0.3;
        this.mesh.add(rightEar);

        // Eyes - big puppy eyes!
        const eyeWhiteGeo = new THREE.BoxGeometry(0.06, 0.06, 0.02);
        const eyePupilGeo = new THREE.BoxGeometry(0.04, 0.04, 0.02);

        // Left eye
        const leftEyeWhite = new THREE.Mesh(eyeWhiteGeo, whiteMat);
        leftEyeWhite.position.set(-0.06, 0.42, 0.33);
        this.mesh.add(leftEyeWhite);

        const leftEyePupil = new THREE.Mesh(eyePupilGeo, blackMat);
        leftEyePupil.position.set(-0.06, 0.42, 0.34);
        this.mesh.add(leftEyePupil);

        // Right eye
        const rightEyeWhite = new THREE.Mesh(eyeWhiteGeo, whiteMat);
        rightEyeWhite.position.set(0.06, 0.42, 0.33);
        this.mesh.add(rightEyeWhite);

        const rightEyePupil = new THREE.Mesh(eyePupilGeo, blackMat);
        rightEyePupil.position.set(0.06, 0.42, 0.34);
        this.mesh.add(rightEyePupil);

        // Tail - short and wagging
        const tailGeo = new THREE.BoxGeometry(0.08, 0.08, 0.15);
        this.tail = new THREE.Mesh(tailGeo, mat);
        this.tail.position.set(0, 0.3, -0.22);
        this.tail.rotation.x = -0.5; // Pointing up happily!
        this.mesh.add(this.tail);

        // Legs - stubby puppy legs
        const legGeo = new THREE.BoxGeometry(0.08, 0.15, 0.08);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.15, z);

            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.075, 0);
            pivot.add(leg);

            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.08, 0.12),  // Front Left
            makeLeg(0.08, 0.12),   // Front Right
            makeLeg(-0.08, -0.12), // Back Left
            makeLeg(0.08, -0.12)   // Back Right
        ];
    }

    updateAnimation(dt) {
        // Call parent animation for leg movement
        super.updateAnimation(dt);

        // Wag the tail!
        if (this.tail) {
            this.tail.rotation.y = Math.sin(performance.now() * 0.015) * 0.5;
        }
    }
}
