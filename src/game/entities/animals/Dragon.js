import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Dragon extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        this.width = 2.0;
        this.height = 2.0;
        this.depth = 5.0; // Long tail

        this.createBody();
        this.mesh.scale.set(1, 1, 1);
    }

    createBody() {
        // Dragon materials
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x8B0000 }); // Dark red
        const bellyMat = new THREE.MeshLambertMaterial({ color: 0xD2691E }); // Orange-brown belly
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0xFFFF00 }); // Yellow eyes
        const pupilMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const hornMat = new THREE.MeshLambertMaterial({ color: 0x2F2F2F }); // Dark gray horns

        // Main body - elongated
        const bodyGeo = new THREE.BoxGeometry(2.5, 1.2, 1.5);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0, 0);
        this.mesh.add(body);

        // Belly
        const bellyGeo = new THREE.BoxGeometry(2.0, 0.4, 1.2);
        const belly = new THREE.Mesh(bellyGeo, bellyMat);
        belly.position.set(0, -0.5, 0);
        this.mesh.add(belly);

        // Neck
        const neckGeo = new THREE.BoxGeometry(0.8, 0.8, 1.5);
        const neck = new THREE.Mesh(neckGeo, bodyMat);
        neck.position.set(1.4, 0.4, 0);
        neck.rotation.z = Math.PI / 6;
        this.mesh.add(neck);

        // Head
        const headGeo = new THREE.BoxGeometry(1.2, 0.8, 0.9);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.set(2.2, 0.9, 0);
        this.mesh.add(head);

        // Snout
        const snoutGeo = new THREE.BoxGeometry(0.8, 0.4, 0.6);
        const snout = new THREE.Mesh(snoutGeo, bodyMat);
        snout.position.set(2.9, 0.75, 0);
        this.mesh.add(snout);

        // Nostrils
        const nostrilGeo = new THREE.BoxGeometry(0.1, 0.1, 0.15);
        const leftNostril = new THREE.Mesh(nostrilGeo, pupilMat);
        leftNostril.position.set(3.3, 0.8, 0.15);
        this.mesh.add(leftNostril);

        const rightNostril = new THREE.Mesh(nostrilGeo, pupilMat);
        rightNostril.position.set(3.3, 0.8, -0.15);
        this.mesh.add(rightNostril);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.2, 0.25, 0.15);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(2.5, 1.1, 0.4);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(2.5, 1.1, -0.4);
        this.mesh.add(rightEye);

        // Pupils
        const pupilGeo = new THREE.BoxGeometry(0.1, 0.15, 0.12);
        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(2.55, 1.1, 0.45);
        this.mesh.add(leftPupil);

        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(2.55, 1.1, -0.45);
        this.mesh.add(rightPupil);

        // Horns
        const hornGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15);
        const leftHorn = new THREE.Mesh(hornGeo, hornMat);
        leftHorn.position.set(2.0, 1.4, 0.35);
        leftHorn.rotation.z = -0.3;
        this.mesh.add(leftHorn);

        const rightHorn = new THREE.Mesh(hornGeo, hornMat);
        rightHorn.position.set(2.0, 1.4, -0.35);
        rightHorn.rotation.z = -0.3;
        this.mesh.add(rightHorn);

        // Spines along back
        for (let i = 0; i < 6; i++) {
            const spineGeo = new THREE.BoxGeometry(0.2, 0.3 + (2 - Math.abs(i - 2.5)) * 0.1, 0.15);
            const spine = new THREE.Mesh(spineGeo, hornMat);
            spine.position.set(1.0 - i * 0.5, 0.75, 0);
            this.mesh.add(spine);
        }

        // Tail
        const tailGroup = new THREE.Group();
        tailGroup.position.set(-1.25, 0, 0);

        for (let i = 0; i < 5; i++) {
            const segGeo = new THREE.BoxGeometry(0.6 - i * 0.08, 0.4 - i * 0.05, 0.4 - i * 0.05);
            const segment = new THREE.Mesh(segGeo, bodyMat);
            segment.position.set(-i * 0.55, i * -0.1, 0);
            tailGroup.add(segment);
        }

        // Tail spike
        const tailSpikeGeo = new THREE.BoxGeometry(0.3, 0.4, 0.2);
        const tailSpike = new THREE.Mesh(tailSpikeGeo, hornMat);
        tailSpike.position.set(-2.6, -0.5, 0);
        tailSpike.rotation.z = 0.5;
        tailGroup.add(tailSpike);

        this.mesh.add(tailGroup);

        // Wings
        this.leftWing = this.createWing(bodyMat);
        this.leftWing.position.set(-0.3, 0.4, 0.75);
        this.mesh.add(this.leftWing);

        this.rightWing = this.createWing(bodyMat);
        this.rightWing.position.set(-0.3, 0.4, -0.75);
        this.mesh.add(this.rightWing);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.3, 0.8, 0.3);
        const footGeo = new THREE.BoxGeometry(0.4, 0.15, 0.5);
        const clawGeo = new THREE.BoxGeometry(0.1, 0.2, 0.1);

        const makeLeg = (x, z) => {
            const legGroup = new THREE.Group();
            legGroup.position.set(x, -0.5, z);

            const leg = new THREE.Mesh(legGeo, bodyMat);
            leg.position.set(0, -0.4, 0);
            legGroup.add(leg);

            const foot = new THREE.Mesh(footGeo, bodyMat);
            foot.position.set(0.1, -0.85, 0);
            legGroup.add(foot);

            // Claws
            for (let c = -1; c <= 1; c++) {
                const claw = new THREE.Mesh(clawGeo, hornMat);
                claw.position.set(0.3, -0.9, c * 0.15);
                legGroup.add(claw);
            }

            this.mesh.add(legGroup);
            return legGroup;
        };

        this.leftFrontLeg = makeLeg(0.8, 0.5);
        this.rightFrontLeg = makeLeg(0.8, -0.5);
        this.leftBackLeg = makeLeg(-0.8, 0.5);
        this.rightBackLeg = makeLeg(-0.8, -0.5);

        // Flight stats
        this.gravity = 0; // Dragons defy gravity!
        this.wingFlapTimer = 0;
        this.hoverOffset = 0;
        this.baseY = this.position.y;
        this.flyingHeight = 15; // Target height above terrain

        // Dynamic flight behavior (like birds)
        this.flightSpeed = 12.0; // Base flight speed
        this.flightVelocity = new THREE.Vector3(
            (Math.random() - 0.5) * this.flightSpeed,
            0,
            (Math.random() - 0.5) * this.flightSpeed
        );
        this.directionChangeTimer = 0;
        this.directionChangeInterval = 3 + Math.random() * 4; // 3-7 seconds
        this.targetDirection = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        this.turnSpeed = 1.5; // How fast dragon turns
        this.swoopTimer = Math.random() * Math.PI * 2; // For swooping motion
        this.circleCenter = null; // For circling behavior
        this.circleRadius = 20 + Math.random() * 15;
        this.circleAngle = Math.random() * Math.PI * 2;
        this.isCircling = false;
        this.homePosition = new THREE.Vector3(this.position.x, this.position.y, this.position.z);
        this.maxRoamDistance = 100; // How far from home position

        // Enable shadows
        this.mesh.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }

    createWing(boneMat) {
        const wing = new THREE.Group();

        // Wing bone structure
        const upperBoneGeo = new THREE.BoxGeometry(0.2, 0.2, 1.5);
        const upperBone = new THREE.Mesh(upperBoneGeo, boneMat);
        upperBone.position.set(0, 0, 0);
        wing.add(upperBone);

        const lowerBoneGeo = new THREE.BoxGeometry(0.15, 0.15, 2.0);
        const lowerBone = new THREE.Mesh(lowerBoneGeo, boneMat);
        lowerBone.position.set(-0.5, -0.1, 1.25);
        lowerBone.rotation.x = 0.3;
        wing.add(lowerBone);

        // Membrane (wing skin)
        const membraneGeo = new THREE.PlaneGeometry(1.5, 3.0);
        const membraneMat = new THREE.MeshLambertMaterial({ color: 0x4a0000, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
        const membrane = new THREE.Mesh(membraneGeo, membraneMat);
        membrane.position.set(-0.5, 0, 1.0);
        membrane.rotation.x = Math.PI / 2;
        wing.add(membrane);

        return wing;
    }

    update(dt) {
        // Skip the parent update physics - we handle our own movement
        // Just update the mesh position
        if (this.mesh) {
            this.mesh.position.copy(this.position);
        }

        // Flap wings - faster when flying fast
        const speed = this.flightVelocity.length();
        const flapRate = 3 + (speed / this.flightSpeed) * 4; // 3-7 Hz based on speed
        this.wingFlapTimer += dt * flapRate;
        const flapAngle = Math.sin(this.wingFlapTimer) * 0.5;

        this.leftWing.rotation.z = flapAngle + 0.3;
        this.rightWing.rotation.z = -flapAngle - 0.3;

        // --- Direction Change Logic ---
        this.directionChangeTimer += dt;
        if (this.directionChangeTimer >= this.directionChangeInterval) {
            this.directionChangeTimer = 0;
            this.directionChangeInterval = 3 + Math.random() * 5;

            // Randomly decide behavior: circle, swoop, or new direction
            const behavior = Math.random();
            if (behavior < 0.3) {
                // Start circling
                this.isCircling = true;
                this.circleCenter = this.position.clone();
                this.circleRadius = 15 + Math.random() * 20;
            } else {
                this.isCircling = false;
                // Pick a new random direction
                const angle = Math.random() * Math.PI * 2;
                this.targetDirection.set(Math.cos(angle), 0, Math.sin(angle)).normalize();
            }
        }

        // --- Flight Velocity Update ---
        if (this.isCircling) {
            // Circle around the center point
            this.circleAngle += dt * 0.5; // Angular velocity
            const targetX = this.circleCenter.x + Math.cos(this.circleAngle) * this.circleRadius;
            const targetZ = this.circleCenter.z + Math.sin(this.circleAngle) * this.circleRadius;

            const toTarget = new THREE.Vector3(targetX - this.position.x, 0, targetZ - this.position.z);
            toTarget.normalize().multiplyScalar(this.flightSpeed);

            // Smoothly blend towards target velocity
            this.flightVelocity.lerp(toTarget, dt * 2);
        } else {
            // Move in target direction
            const targetVelocity = this.targetDirection.clone().multiplyScalar(this.flightSpeed);
            this.flightVelocity.lerp(targetVelocity, dt * this.turnSpeed);
        }

        // --- Bounds checking - stay near home ---
        const distFromHome = new THREE.Vector2(
            this.position.x - this.homePosition.x,
            this.position.z - this.homePosition.z
        ).length();

        if (distFromHome > this.maxRoamDistance) {
            // Steer back towards home
            const toHome = new THREE.Vector3(
                this.homePosition.x - this.position.x,
                0,
                this.homePosition.z - this.position.z
            ).normalize();
            this.targetDirection.copy(toHome);
            this.isCircling = false;
        }

        // --- Height control with swooping ---
        this.swoopTimer += dt * 0.8;
        const swoopOffset = Math.sin(this.swoopTimer) * 5; // Swoop ±5 blocks

        const groundY = this.game.worldGen ? this.game.worldGen.getTerrainHeight(this.position.x, this.position.z) : 0;
        const targetY = groundY + this.flyingHeight + swoopOffset;

        const yDiff = targetY - this.position.y;
        this.flightVelocity.y = yDiff * 1.5; // Responsive height adjustment

        // Limit vertical speed
        const maxVertSpeed = this.flightSpeed * 0.4;
        this.flightVelocity.y = Math.max(-maxVertSpeed, Math.min(maxVertSpeed, this.flightVelocity.y));

        // --- Apply velocity ---
        this.position.x += this.flightVelocity.x * dt;
        this.position.y += this.flightVelocity.y * dt;
        this.position.z += this.flightVelocity.z * dt;

        // Ensure minimum height
        if (this.position.y < groundY + 3) {
            this.position.y = groundY + 3;
            this.flightVelocity.y = Math.abs(this.flightVelocity.y); // Bounce up
        }

        // --- Orient dragon to face flight direction ---
        if (this.mesh && this.flightVelocity.lengthSq() > 0.1) {
            // Calculate heading (Y rotation) from horizontal velocity using atan2
            const heading = Math.atan2(this.flightVelocity.x, this.flightVelocity.z);

            // Calculate pitch (X rotation) from vertical velocity
            const horizontalSpeed = Math.sqrt(this.flightVelocity.x * this.flightVelocity.x + this.flightVelocity.z * this.flightVelocity.z);
            const pitch = Math.atan2(-this.flightVelocity.y, horizontalSpeed) * 0.3; // Subtle pitch, limited

            // Apply rotations manually - no lookAt to avoid upside-down issues
            this.mesh.rotation.order = 'YXZ'; // Yaw, then pitch, then roll
            this.mesh.rotation.y = heading - Math.PI / 2; // Dragon faces +X in model space
            this.mesh.rotation.x = pitch;
            this.mesh.rotation.z = 0; // Keep level, no banking that could flip
        }

        // Update mesh position
        if (this.mesh) {
            this.mesh.position.copy(this.position);
        }
    }
}