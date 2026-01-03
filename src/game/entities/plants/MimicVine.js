import * as THREE from 'three';
import { InteractivePlant } from './InteractivePlant.js';

/**
 * MimicVine - A curious plant that watches and copies the player.
 * Segmented vine with a flower "head" that has expressive eye-spots.
 */
export class MimicVine extends InteractivePlant {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        this.width = 0.6;
        this.height = 2.0;
        this.depth = 0.6;

        this.detectionRange = 6.0;

        // Mimicry state
        this.headTargetRotation = new THREE.Euler();
        this.headCurrentRotation = new THREE.Euler();
        this.bobAmount = 0;
        this.duckAmount = 0;
        this.lastPlayerY = 0;
        this.lastPlayerJumping = false;

        // Segments for flexible stalk
        this.segments = [];
        this.segmentCount = 5;

        this.createBody();
    }

    createBody() {
        const segmentHeight = 0.3;
        const segmentMat = new THREE.MeshLambertMaterial({ color: 0x66bb6a }); // Green

        // Create segmented stalk
        let currentY = 0;
        for (let i = 0; i < this.segmentCount; i++) {
            const radius = 0.08 - i * 0.01;
            const segGeo = new THREE.CylinderGeometry(radius, radius + 0.01, segmentHeight, 6);
            const segment = new THREE.Mesh(segGeo, segmentMat);
            segment.position.y = currentY + segmentHeight / 2;

            this.segments.push({
                mesh: segment,
                baseY: currentY + segmentHeight / 2,
                rotationX: 0,
                rotationZ: 0
            });

            this.mesh.add(segment);
            currentY += segmentHeight * 0.9; // Slight overlap
        }

        // Head group (flower with eyes)
        this.head = new THREE.Group();
        this.head.position.y = currentY;

        // Flower face
        const faceGeo = new THREE.SphereGeometry(0.25, 12, 8);
        const faceMat = new THREE.MeshLambertMaterial({ color: 0x98d8a8 }); // Light green
        const face = new THREE.Mesh(faceGeo, faceMat);
        this.head.add(face);

        // Petals around face
        const petalMat = new THREE.MeshLambertMaterial({ color: 0xffc107 }); // Yellow
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const petalGeo = new THREE.SphereGeometry(0.15, 8, 6);
            petalGeo.scale(1, 0.3, 1);
            const petal = new THREE.Mesh(petalGeo, petalMat);
            petal.position.set(
                Math.cos(angle) * 0.25,
                0,
                Math.sin(angle) * 0.25
            );
            petal.rotation.x = 0.3;
            petal.rotation.y = -angle;
            this.head.add(petal);
        }

        // Eyes (expressive!)
        const eyeWhiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const pupilMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

        // Left eye
        this.leftEye = new THREE.Group();
        const leftWhite = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), eyeWhiteMat);
        this.leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), pupilMat);
        this.leftPupil.position.z = 0.05;
        this.leftEye.add(leftWhite);
        this.leftEye.add(this.leftPupil);
        this.leftEye.position.set(-0.1, 0.05, 0.2);
        this.head.add(this.leftEye);

        // Right eye
        this.rightEye = new THREE.Group();
        const rightWhite = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), eyeWhiteMat);
        this.rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), pupilMat);
        this.rightPupil.position.z = 0.05;
        this.rightEye.add(rightWhite);
        this.rightEye.add(this.rightPupil);
        this.rightEye.position.set(0.1, 0.05, 0.2);
        this.head.add(this.rightEye);

        this.mesh.add(this.head);
        this.baseHeadY = currentY;
    }

    onActivate(player) {
        this.lastPlayerY = player.position.y;
    }

    onUpdateActive(dt) {
        const player = this.game.player;
        if (!player) return;

        // Track player with head
        const toPlayer = new THREE.Vector3().subVectors(player.position, this.position);
        toPlayer.y = 0; // Keep horizontal for rotation

        if (toPlayer.length() > 0.1) {
            const targetAngle = Math.atan2(toPlayer.x, toPlayer.z);
            this.headTargetRotation.y = targetAngle;
        }

        // Check for player jump (mimic by bobbing)
        const isJumping = !player.onGround && player.velocity.y > 2;
        if (isJumping && !this.lastPlayerJumping) {
            this.bobAmount = 1.0; // Trigger bob
        }
        this.lastPlayerJumping = isJumping;

        // Check for crouch (mimic by ducking)
        const isCrouching = this.game.inputManager?.isActionActive?.('SNEAK') || false;
        this.duckAmount = THREE.MathUtils.lerp(
            this.duckAmount,
            isCrouching ? 1.0 : 0,
            dt * 5
        );

        // Look up/down based on player height
        const heightDiff = player.position.y - (this.position.y + this.baseHeadY);
        this.headTargetRotation.x = THREE.MathUtils.clamp(heightDiff * 0.1, -0.5, 0.5);

        this.lastPlayerY = player.position.y;
    }

    updatePhysics(dt) {
        const time = performance.now() / 1000;

        // Lerp head rotation towards target
        this.headCurrentRotation.x = THREE.MathUtils.lerp(
            this.headCurrentRotation.x,
            this.headTargetRotation.x,
            dt * 3
        );
        this.headCurrentRotation.y = THREE.MathUtils.lerp(
            this.headCurrentRotation.y,
            this.headTargetRotation.y,
            dt * 4
        );

        this.head.rotation.x = this.headCurrentRotation.x;
        this.head.rotation.y = this.headCurrentRotation.y;

        // Bob animation (mimic jump)
        if (this.bobAmount > 0) {
            this.bobAmount -= dt * 3;
            const bobOffset = Math.sin(this.bobAmount * Math.PI) * 0.3;
            this.head.position.y = this.baseHeadY + bobOffset;
        } else {
            this.bobAmount = 0;
            this.head.position.y = this.baseHeadY;
        }

        // Duck animation (mimic crouch)
        const duckOffset = this.duckAmount * 0.5;
        this.head.position.y -= duckOffset;
        this.head.scale.y = 1.0 - this.duckAmount * 0.3;

        // Animate segments to follow head direction
        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            const influence = (i + 1) / this.segments.length;

            // Gentle sway when idle, follow head when active
            const baseSwayX = Math.sin(time * 1.5 + i * 0.5) * 0.02;
            const baseSwayZ = Math.cos(time * 1.2 + i * 0.3) * 0.02;

            if (this.isActive) {
                segment.mesh.rotation.x = this.headCurrentRotation.x * influence * 0.5 + baseSwayX;
                segment.mesh.rotation.z = Math.sin(this.headCurrentRotation.y) * influence * 0.2 + baseSwayZ;
            } else {
                segment.mesh.rotation.x = baseSwayX;
                segment.mesh.rotation.z = baseSwayZ;
            }
        }

        // Pupils follow player
        if (this.isActive && this.game.player) {
            const toPlayer = new THREE.Vector3().subVectors(
                this.game.player.position,
                this.mesh.getWorldPosition(new THREE.Vector3()).add(this.head.position)
            );
            toPlayer.normalize();

            const pupilOffset = 0.03;
            this.leftPupil.position.x = toPlayer.x * pupilOffset;
            this.leftPupil.position.y = toPlayer.y * pupilOffset;
            this.rightPupil.position.x = toPlayer.x * pupilOffset;
            this.rightPupil.position.y = toPlayer.y * pupilOffset;
        }

        this.mesh.position.copy(this.position);
    }
}
