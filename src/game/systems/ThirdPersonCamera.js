import * as THREE from 'three';

/**
 * Smooth third-person follow camera
 * Based on Simon Dev's implementation with improvements for Minecraft-style gameplay
 *
 * Features:
 * - Smooth position and rotation interpolation
 * - Frame-rate independent smoothing
 * - Configurable offset and look-ahead
 * - Collision avoidance (optional)
 */
export class ThirdPersonCamera {
    constructor(game, params = {}) {
        this.game = game;
        this.camera = game.camera;

        // Current interpolated values
        this._currentPosition = new THREE.Vector3();
        this._currentLookat = new THREE.Vector3();

        // Configuration
        // In Three.js, player faces -Z when rotation.y = 0
        // So +Z is behind the player, -Z is in front
        this.offset = params.offset || new THREE.Vector3(0, 3, 6); // Behind and above (+Z = behind)
        this.lookAtOffset = params.lookAtOffset || new THREE.Vector3(0, 1.5, -4); // Look ahead of player (-Z = forward)
        this.smoothing = params.smoothing || 0.05; // Lower = smoother (0.001 - 0.1)

        // Collision detection
        this.enableCollision = params.enableCollision !== false;
        this.minDistance = 1.5;
        this.collisionPadding = 0.3;

        // Reusable objects for performance
        this._idealOffset = new THREE.Vector3();
        this._idealLookat = new THREE.Vector3();
        this._targetQuaternion = new THREE.Quaternion();
        this._raycaster = new THREE.Raycaster();
        this._rayDirection = new THREE.Vector3();

        this._initialized = false;
    }

    /**
     * Calculate ideal camera position based on player position and rotation
     */
    _calculateIdealOffset(player) {
        // Start with base offset
        this._idealOffset.copy(this.offset);

        // Apply player's pitch (X rotation) - camera pivots around player vertically
        const pitchQuat = new THREE.Quaternion();
        pitchQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -player.rotation.x);
        this._idealOffset.applyQuaternion(pitchQuat);

        // Apply player's yaw (Y rotation) - camera follows player's facing direction
        this._targetQuaternion.setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            player.rotation.y
        );
        this._idealOffset.applyQuaternion(this._targetQuaternion);

        // Add player position (pivot point is at player's body)
        this._idealOffset.add(player.position);

        return this._idealOffset;
    }

    /**
     * Calculate ideal look-at point (ahead of player)
     */
    _calculateIdealLookat(player) {
        // Start with base look-at offset
        this._idealLookat.copy(this.lookAtOffset);

        // Apply player's pitch (X rotation) - look up/down like first person
        const pitchQuat = new THREE.Quaternion();
        pitchQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), player.rotation.x);
        this._idealLookat.applyQuaternion(pitchQuat);

        // Apply player's yaw (Y rotation)
        this._targetQuaternion.setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            player.rotation.y
        );
        this._idealLookat.applyQuaternion(this._targetQuaternion);

        // Add player position
        this._idealLookat.add(player.position);

        return this._idealLookat;
    }

    /**
     * Check for collisions between camera and player, adjust position if needed
     */
    _handleCollision(player, idealPosition) {
        if (!this.enableCollision || !this.game.chunks) return idealPosition;

        // Ray from player to ideal camera position
        const playerHead = player.position.clone();
        playerHead.y += 1.6; // Eye height

        this._rayDirection.subVectors(idealPosition, playerHead).normalize();
        const distance = idealPosition.distanceTo(playerHead);

        this._raycaster.set(playerHead, this._rayDirection);
        this._raycaster.far = distance;

        // Check intersections with terrain chunks
        const meshes = [];
        this.game.chunks.forEach(chunk => {
            if (chunk.mesh) meshes.push(chunk.mesh);
        });

        if (meshes.length === 0) return idealPosition;

        const intersects = this._raycaster.intersectObjects(meshes, false);

        if (intersects.length > 0) {
            const hit = intersects[0];
            // Move camera closer, with padding
            const newDist = Math.max(this.minDistance, hit.distance - this.collisionPadding);
            const adjustedPosition = playerHead.clone().add(
                this._rayDirection.multiplyScalar(newDist)
            );
            return adjustedPosition;
        }

        return idealPosition;
    }

    /**
     * Initialize camera position instantly (no interpolation)
     */
    initialize(player) {
        const idealOffset = this._calculateIdealOffset(player);
        const idealLookat = this._calculateIdealLookat(player);

        this._currentPosition.copy(idealOffset);
        this._currentLookat.copy(idealLookat);

        this.camera.position.copy(this._currentPosition);
        this.camera.lookAt(this._currentLookat);

        this._initialized = true;
    }

    /**
     * Update camera position with smooth interpolation
     * @param {number} deltaTime - Time since last frame in seconds
     * @param {Player} player - The player to follow
     */
    update(deltaTime, player) {
        if (!player) return;

        // Initialize on first update
        if (!this._initialized) {
            this.initialize(player);
            return;
        }

        // Calculate ideal positions
        let idealOffset = this._calculateIdealOffset(player);
        const idealLookat = this._calculateIdealLookat(player);

        // Handle collision
        idealOffset = this._handleCollision(player, idealOffset);

        // Frame-rate independent smoothing
        // t approaches 1 as deltaTime increases, ensuring consistent feel
        // The formula: 1 - (smoothing)^deltaTime
        // With smoothing=0.05 and dt=0.016 (60fps): t ≈ 0.048
        // With smoothing=0.05 and dt=0.033 (30fps): t ≈ 0.093
        const t = 1.0 - Math.pow(this.smoothing, deltaTime);

        // Lerp position and look-at
        this._currentPosition.lerp(idealOffset, t);
        this._currentLookat.lerp(idealLookat, t);

        // Apply to camera
        this.camera.position.copy(this._currentPosition);
        this.camera.lookAt(this._currentLookat);
    }

    /**
     * Reset camera to follow player immediately
     */
    reset(player) {
        this._initialized = false;
        if (player) {
            this.initialize(player);
        }
    }

    /**
     * Set camera offset
     */
    setOffset(x, y, z) {
        this.offset.set(x, y, z);
    }

    /**
     * Set look-at offset
     */
    setLookAtOffset(x, y, z) {
        this.lookAtOffset.set(x, y, z);
    }

    /**
     * Set smoothing factor (0.001 = very smooth, 0.1 = responsive)
     */
    setSmoothing(value) {
        this.smoothing = Math.max(0.001, Math.min(0.5, value));
    }
}
