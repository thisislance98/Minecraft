import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class MagicalCreature extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.type = 'magical_creature';
        this.speed = 2.5; // Increased speed
        this.wanderRadius = 20;

        // Define dimensions for collision
        this.width = 1.0;
        this.height = 1.5;
        this.depth = 1.2;

        this.createBody();
    }

    createBody() {
        // Pink toucan-shaped body
        const bodyGeometry = new THREE.CapsuleGeometry(0.4, 1.2, 8, 16);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0xff69b4, // Hot pink
            roughness: 0.6,
            metalness: 0.2
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.rotation.z = Math.PI / 2; // Horizontal like a bird
        body.position.y = 0.8;
        this.mesh.add(body);

        // Toucan-style large beak
        const beakGeometry = new THREE.ConeGeometry(0.25, 0.8, 8);
        const beakMaterial = new THREE.MeshStandardMaterial({
            color: 0xffa500, // Orange
            roughness: 0.5
        });
        const beak = new THREE.Mesh(beakGeometry, beakMaterial);
        beak.rotation.z = -Math.PI / 2;
        beak.position.set(0.8, 0.9, 0);
        this.mesh.add(beak);

        // Head (pink)
        const headGeometry = new THREE.SphereGeometry(0.35, 16, 16);
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0xffb6c1, // Light pink
            roughness: 0.6
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0.5, 0.9, 0);
        this.mesh.add(head);

        // Unicorn horn (spiral)
        const hornGeometry = new THREE.ConeGeometry(0.1, 0.6, 8);
        const hornMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700, // Gold
            roughness: 0.3,
            metalness: 0.8,
            emissive: 0xffd700,
            emissiveIntensity: 0.3
        });
        const horn = new THREE.Mesh(hornGeometry, hornMaterial);
        horn.position.set(0.5, 1.5, 0);
        horn.rotation.z = -0.2;
        this.mesh.add(horn);

        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const eyeMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            emissive: 0x4444ff,
            emissiveIntensity: 0.5
        });
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(0.65, 1.0, 0.15);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.65, 1.0, -0.15);
        this.mesh.add(rightEye);

        // Black wings
        const wingGeometry = new THREE.BoxGeometry(0.1, 0.8, 1.2);
        const wingMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000, // Black
            roughness: 0.4,
            metalness: 0.1
        });

        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(0, 0.8, 0.6);
        leftWing.rotation.y = 0.3;
        this.mesh.add(leftWing);
        this.leftWing = leftWing;

        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(0, 0.8, -0.6);
        rightWing.rotation.y = -0.3;
        this.mesh.add(rightWing);
        this.rightWing = rightWing;

        // Fox tail (fluffy and bushy)
        const tailSegments = 5;
        for (let i = 0; i < tailSegments; i++) {
            const size = 0.25 - (i * 0.03);
            const tailSegmentGeometry = new THREE.SphereGeometry(size, 8, 8);
            const tailColors = [0xff6600, 0xff8800, 0xffaa00, 0xffcc00, 0xffffff]; // Orange gradient to white tip
            const tailMaterial = new THREE.MeshStandardMaterial({
                color: tailColors[i],
                roughness: 0.8
            });
            const tailSegment = new THREE.Mesh(tailSegmentGeometry, tailMaterial);
            tailSegment.position.set(-0.6 - (i * 0.2), 0.5 + (i * 0.1), 0);
            this.mesh.add(tailSegment);
        }

        // Legs (small, bird-like)
        const legGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8);
        const legMaterial = new THREE.MeshStandardMaterial({
            color: 0xff69b4,
            roughness: 0.7
        });

        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-0.2, 0.25, 0.2);
        this.mesh.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(-0.2, 0.25, -0.2);
        this.mesh.add(rightLeg);

        // Feet
        const footGeometry = new THREE.BoxGeometry(0.15, 0.05, 0.2);
        const footMaterial = new THREE.MeshStandardMaterial({
            color: 0xff1493,
            roughness: 0.8
        });

        const leftFoot = new THREE.Mesh(footGeometry, footMaterial);
        leftFoot.position.set(-0.15, 0.02, 0.2);
        this.mesh.add(leftFoot);

        const rightFoot = new THREE.Mesh(footGeometry, footMaterial);
        rightFoot.position.set(-0.15, 0.02, -0.2);
        this.mesh.add(rightFoot);

        // Animation properties
        this.wingFlapSpeed = 0.1;
        this.wingAngle = 0;
        this.bobPhase = 0;
    }

    update(dt) {
        super.update(dt);

        // Wing flapping animation
        this.wingAngle += this.wingFlapSpeed;
        if (this.leftWing) this.leftWing.rotation.y = 0.3 + Math.sin(this.wingAngle) * 0.5;
        if (this.rightWing) this.rightWing.rotation.y = -0.3 - Math.sin(this.wingAngle) * 0.5;

        // Bobbing motion using mesh position offset if needed, or stick to physics
        // Since Animal.js controls this.mesh.position directly from this.position, 
        // we shouldn't manually override mesh.position.y for bobbing unless we change the visual offset.
        // Instead, let's bob the wings/body parts relative to the mesh center.
        // But the simplified bobbing is fine if it doesn't conflict with physics snapping.
        // The original code modified this.model.position.y, but this.mesh.position is controlled by physics.
        // So let's skip the vertical bobbing of the WHOLE mesh to avoid fighting physics.

        // Gentle rotation while moving
        if (this.velocity.length() > 0.01) {
            // physics handles rotation
            // this.mesh.rotation.x = Math.sin(this.bobPhase * 2) * 0.1; 
        }
    }

    makeSound() {
        // Magical creature makes a unique sound
        console.log('✨ Magical creature sparkles! ✨');
    }
}
