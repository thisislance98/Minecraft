import * as THREE from 'three';

/**
 * Minecraft-style third-person camera
 *
 * Based on ClassiCube and Simon Dev implementations:
 * - Camera orbits around player using spherical coordinates
 * - Uses player's yaw for horizontal orbit, pitch for vertical
 * - Smooth interpolation with frame-rate independent smoothing
 * - Collision detection to prevent clipping through terrain
 */
export class ThirdPersonCamera {
    constructor(game, params = {}) {
        this.game = game;
        this.camera = game.camera;

        // Current interpolated position
        this._currentPosition = new THREE.Vector3();

        // Configuration - Over-the-shoulder style
        this.distance = params.distance || 1.5;        // Close behind player
        this.heightOffset = params.heightOffset || 2.0; // Above player's head
        this.smoothing = params.smoothing || 0.01;     // Lower = smoother (0.001 very smooth, 0.1 responsive)
        this.pivotHeight = params.pivotHeight !== undefined ? params.pivotHeight : 1.6; // Eye level

        // Pitch constraints to prevent flipping
        this.minPitch = params.minPitch || -Math.PI / 2 + 0.1; // Just above -90 degrees
        this.maxPitch = params.maxPitch || Math.PI / 2 - 0.1;  // Just below 90 degrees

        // Collision detection
        this.enableCollision = params.enableCollision !== false;
        this.minDistance = params.minDistance || 1.0;
        this.collisionPadding = 0.2;

        // Reusable objects for performance
        this._pivotPoint = new THREE.Vector3();
        this._idealPosition = new THREE.Vector3();
        this._raycaster = new THREE.Raycaster();
        this._rayDirection = new THREE.Vector3();

        this._initialized = false;
    }

    /**
     * Calculate ideal camera position using spherical coordinates around player
     * This is the Minecraft approach: camera orbits at fixed distance
     */
    _calculateIdealPosition(player) {
        // Pivot point is at player's eye level
        this._pivotPoint.set(
            player.position.x,
            player.position.y + this.pivotHeight,
            player.position.z
        );

        // Get player's look direction (pitch and yaw)
        // Note: Player's rotation.x is OPPOSITE of camera pitch convention
        // (positive rotation.x = looking UP in first-person)
        const pitch = THREE.MathUtils.clamp(player.rotation.x, this.minPitch, this.maxPitch);
        const yaw = player.rotation.y;

        // Calculate camera position using spherical coordinates
        // Camera should be BEHIND and ABOVE the player
        // When player looks up (positive pitch), camera should go up too
        const cosPitch = Math.cos(pitch);
        const sinPitch = Math.sin(pitch);

        // Camera offset from pivot (behind player)
        // sin(0) = 0, cos(0) = 1, so camera is at (0, height, +distance) when yaw=0
        this._idealPosition.set(
            this.distance * cosPitch * Math.sin(yaw),
            this.distance * sinPitch + this.heightOffset,
            this.distance * cosPitch * Math.cos(yaw)
        );

        // Add pivot point to get world position
        this._idealPosition.add(this._pivotPoint);

        return this._idealPosition;
    }

    /**
     * Get the point the camera should look at
     * Look far ahead of player so crosshair is in front
     */
    _getLookAtPoint(player) {
        const yaw = player.rotation.y;
        const pitch = player.rotation.x;

        // Look far ahead of the player in their facing direction
        // Player faces -Z when yaw = 0
        const lookDistance = 20; // Far ahead for proper aiming

        return new THREE.Vector3(
            player.position.x - Math.sin(yaw) * lookDistance,
            player.position.y + this.pivotHeight + Math.sin(pitch) * lookDistance,
            player.position.z - Math.cos(yaw) * lookDistance
        );
    }

    /**
     * Check for collisions and pull camera closer if needed
     * Like ClassiCube: raycast from player to camera, stop at first hit
     */
    _handleCollision(player, idealPosition) {
        if (!this.enableCollision || !this.game.chunks) return idealPosition;

        // Ray from pivot point toward ideal camera position
        const pivotPoint = new THREE.Vector3(
            player.position.x,
            player.position.y + this.pivotHeight,
            player.position.z
        );

        this._rayDirection.subVectors(idealPosition, pivotPoint);
        const distance = this._rayDirection.length();
        this._rayDirection.normalize();

        this._raycaster.set(pivotPoint, this._rayDirection);
        this._raycaster.far = distance;

        // Collect terrain meshes
        const meshes = [];
        this.game.chunks.forEach(chunk => {
            if (chunk.mesh) meshes.push(chunk.mesh);
        });

        if (meshes.length === 0) return idealPosition;

        const intersects = this._raycaster.intersectObjects(meshes, false);

        if (intersects.length > 0) {
            const hit = intersects[0];
            // Pull camera to hit point minus padding
            const newDist = Math.max(this.minDistance, hit.distance - this.collisionPadding);
            return pivotPoint.clone().add(
                this._rayDirection.clone().multiplyScalar(newDist)
            );
        }

        return idealPosition;
    }

    /**
     * Initialize camera position instantly (no interpolation)
     */
    initialize(player) {
        const idealPosition = this._calculateIdealPosition(player);
        const finalPosition = this._handleCollision(player, idealPosition);

        this._currentPosition.copy(finalPosition);
        this.camera.position.copy(this._currentPosition);
        this.camera.lookAt(this._getLookAtPoint(player));

        this._initialized = true;
    }

    /**
     * Update camera with smooth interpolation
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

        // Calculate ideal position
        const idealPosition = this._calculateIdealPosition(player);

        // Handle collision - pull camera closer if needed
        const finalPosition = this._handleCollision(player, idealPosition);

        // Frame-rate independent smoothing
        // Formula: t = 1 - smoothing^deltaTime
        // With smoothing=0.01 and dt=0.016 (60fps): t ≈ 0.071
        // This gives silky smooth camera movement
        const t = 1.0 - Math.pow(this.smoothing, deltaTime);

        // Lerp to target position
        this._currentPosition.lerp(finalPosition, t);

        // Apply position and look at player
        this.camera.position.copy(this._currentPosition);
        this.camera.lookAt(this._getLookAtPoint(player));
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
     * Set camera distance from player
     */
    setDistance(distance) {
        this.distance = Math.max(this.minDistance, distance);
    }

    /**
     * Set height offset above player's head
     */
    setHeightOffset(offset) {
        this.heightOffset = offset;
    }

    /**
     * Set smoothing factor (0.001 = very smooth, 0.1 = responsive)
     */
    setSmoothing(value) {
        this.smoothing = THREE.MathUtils.clamp(value, 0.001, 0.5);
    }
}
