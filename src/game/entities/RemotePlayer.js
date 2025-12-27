import * as THREE from 'three';

/**
 * RemotePlayer represents another player in the multiplayer world.
 * Handles visual rendering and smooth interpolation of position updates.
 */
export class RemotePlayer {
    constructor(game, actorNr, playerState) {
        this.game = game;
        this.actorNr = actorNr; // Player ID from Socket.IO
        this.playerState = playerState; // Optional initial state

        // Transform state
        this.position = new THREE.Vector3(32, 50, 32);
        this.targetPosition = new THREE.Vector3(32, 50, 32);
        this.rotation = { x: 0, y: 0 };
        this.targetRotation = { x: 0, y: 0 };

        // Animation state
        this.animation = 'idle';
        this.heldItem = null;
        this.walkCycle = 0;

        // Interpolation
        this.lerpFactor = 0.15;

        // Create mesh
        this.mesh = new THREE.Group();

        // DEBUG: Simple Box Mode (like test.html)
        // this.createBody();
        // this.createNameLabel();

        const debugGeo = new THREE.BoxGeometry(1, 2, 1);
        const debugMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true });
        this.debugBox = new THREE.Mesh(debugGeo, debugMat);
        this.mesh.add(this.debugBox);

        game.scene.add(this.mesh);
        console.log(`[RemotePlayer] Created ghost player ${actorNr} (visuals disabled)`);

        // Get reference to player state
        if (!this.playerState) {
            this.updatePlayerStateReference();
        }
    }

    /**
     * Get player state reference (for backwards compatibility)
     * We use event-based updates via updateFromNetwork() instead
     */
    updatePlayerStateReference() {
        // No-op - updates come via updateFromNetwork()
    }

    /**
     * Create the player body mesh (similar to Player.createBody but simplified)
     */
    createBody() {
        // Materials
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xc68642 });
        const shirtMat = new THREE.MeshLambertMaterial({ color: 0x3498db }); // Blue shirt
        const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 }); // Dark pants
        const hairMat = new THREE.MeshLambertMaterial({ color: 0x3d2314 }); // Brown hair

        // Body group (for animations)
        this.bodyGroup = new THREE.Group();
        this.mesh.add(this.bodyGroup);

        // Torso
        const torsoGeo = new THREE.BoxGeometry(0.5, 0.7, 0.25);
        this.torso = new THREE.Mesh(torsoGeo, shirtMat);
        this.torso.position.set(0, 1.15, 0);
        this.bodyGroup.add(this.torso);

        // Head
        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        this.head = new THREE.Mesh(headGeo, skinMat);
        this.head.position.set(0, 1.7, 0);
        this.bodyGroup.add(this.head);

        // Hair
        const hairGeo = new THREE.BoxGeometry(0.42, 0.15, 0.42);
        const hair = new THREE.Mesh(hairGeo, hairMat);
        hair.position.set(0, 0.15, 0);
        this.head.add(hair);

        // Arms
        this.leftArm = this.createLimb(-0.35, 1.4, shirtMat);
        this.rightArm = this.createLimb(0.35, 1.4, shirtMat);

        // Legs
        this.leftLeg = this.createLimb(-0.12, 0.75, pantsMat);
        this.rightLeg = this.createLimb(0.12, 0.75, pantsMat);
    }

    /**
     * Create a limb (arm or leg)
     */
    createLimb(x, y, material) {
        const pivot = new THREE.Group();
        pivot.position.set(x, y, 0);

        const geo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(0, -0.3, 0);
        pivot.add(mesh);

        this.bodyGroup.add(pivot);
        return pivot;
    }

    /**
     * Create floating name label
     */
    createNameLabel() {
        // Create canvas for text
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, 256, 64);

        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Player ${this.actorNr}`, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true
        });

        this.nameLabel = new THREE.Sprite(material);
        this.nameLabel.scale.set(1, 0.25, 1);
        this.nameLabel.position.set(0, 2.2, 0);
        this.mesh.add(this.nameLabel);
    }

    /**
     * Update remote player state from network data
     */
    updateFromNetwork(data) {
        if (data.position) {
            this.targetPosition.set(data.position.x, data.position.y, data.position.z);
        }
        if (data.rotation) {
            this.targetRotation.x = data.rotation.x;
            this.targetRotation.y = data.rotation.y;
        }
        if (data.animation) {
            this.animation = data.animation;
        }
        if (data.heldItem !== undefined) {
            this.heldItem = data.heldItem;
        }
    }

    /**
     * Update every frame
     */
    update(deltaTime) {
        // Position updates come via updateFromNetwork()
        // We just interpolate here

        // Interpolate position
        this.position.lerp(this.targetPosition, this.lerpFactor);
        this.mesh.position.copy(this.position);

        // Interpolate rotation
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * this.lerpFactor;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * this.lerpFactor;

        if (this.bodyGroup) {
            this.bodyGroup.rotation.y = this.rotation.y;
            this.head.rotation.x = -this.rotation.x * 0.5;
        }

        // Animate based on movement (Only if body exists)
        if (this.leftArm) {
            const speed = this.targetPosition.distanceTo(this.position);
            if (speed > 0.01 || this.animation === 'walking') {
                this.animateWalk(deltaTime);
            } else {
                this.animateIdle();
            }
        }

        // Keep name label facing camera
        if (this.game.camera && this.nameLabel) {
            this.nameLabel.lookAt(this.game.camera.position);
        }
    }

    /**
     * Walking animation
     */
    animateWalk(deltaTime) {
        this.walkCycle += deltaTime * 8;
        const swing = Math.sin(this.walkCycle) * 0.5;

        this.leftArm.rotation.x = swing;
        this.rightArm.rotation.x = -swing;
        this.leftLeg.rotation.x = -swing;
        this.rightLeg.rotation.x = swing;
    }

    /**
     * Idle animation
     */
    animateIdle() {
        this.leftArm.rotation.x *= 0.9;
        this.rightArm.rotation.x *= 0.9;
        this.leftLeg.rotation.x *= 0.9;
        this.rightLeg.rotation.x *= 0.9;
    }

    /**
     * Cleanup
     */
    dispose() {
        this.game.scene.remove(this.mesh);

        // Dispose geometries and materials
        this.mesh.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
    }
}

