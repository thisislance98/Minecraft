/**
 * PhysicsScript - Adds movement physics and collision bounds to a game object
 */
import * as THREE from 'three';

export const PhysicsScript = {
    type: 'PhysicsScript',

    // Config - Movement
    mode: 'walking',      // walking | hopping | flying | swimming
    speed: 3,
    gravity: true,
    jumpHeight: 1,
    groundY: null,        // Set this to override ground level

    // Config - Collider (optional)
    collider: false,      // Enable collision bounds
    colliderWidth: 1,
    colliderHeight: 1,
    colliderDepth: null,  // Defaults to width
    colliderOffset: null, // [x, y, z] offset from center

    // State - Movement
    velocity: null,
    grounded: false,
    _hopTimer: 0,
    _hopInterval: 1.5,

    // State - Collider
    _box: null,
    _meshHeightOffset: 0,  // Half the mesh height (for centered meshes)

    Start() {
        this.velocity = new THREE.Vector3();

        // Calculate mesh height offset for centered meshes
        const rootMesh = this._getRootMesh();
        if (rootMesh?.geometry) {
            rootMesh.geometry.computeBoundingBox();
            const bbox = rootMesh.geometry.boundingBox;
            if (bbox) {
                this._meshHeightOffset = -bbox.min.y; // Distance from center to bottom
            }
        }

        // Store initial Y as ground level if not set
        if (this.groundY === null) {
            this.groundY = this.transform.localPosition.y;
        }

        // Initialize collider if enabled
        if (this.collider) {
            this._initCollider();
        }
    },

    _initCollider() {
        const d = this.colliderDepth ?? this.colliderWidth;
        const halfW = this.colliderWidth / 2;
        const halfD = d / 2;

        this._box = new THREE.Box3(
            new THREE.Vector3(-halfW, 0, -halfD),
            new THREE.Vector3(halfW, this.colliderHeight, halfD)
        );
    },

    Update() {
        if (!this.velocity) return;

        const dt = window.Time?.deltaTime || 0.016;

        switch (this.mode) {
            case 'walking':
                this._updateWalking(dt);
                break;
            case 'hopping':
                this._updateHopping(dt);
                break;
            case 'flying':
                this._updateFlying(dt);
                break;
            case 'swimming':
                this._updateSwimming(dt);
                break;
        }

        // Apply velocity to root mesh position (since that's what's in the scene)
        const rootMesh = this._getRootMesh();
        if (rootMesh) {
            rootMesh.position.x += this.velocity.x * dt;
            rootMesh.position.y += this.velocity.y * dt;
            rootMesh.position.z += this.velocity.z * dt;

            // Apply gravity
            if (this.gravity && this.mode !== 'flying') {
                this.velocity.y -= 20 * dt;

                // Calculate mesh height offset on first update (mesh may not exist in Start)
                if (!this._meshHeightOffset && rootMesh.geometry) {
                    rootMesh.geometry.computeBoundingBox();
                    const bbox = rootMesh.geometry.boundingBox;
                    if (bbox) {
                        this._meshHeightOffset = -bbox.min.y;
                        console.log(`[SDK:Physics] ${this.gameObject.name} heightOffset=${this._meshHeightOffset.toFixed(2)} (bbox.min.y=${bbox.min.y.toFixed(2)})`);
                    }
                }

                // Ground check - use actual terrain if available
                // For centered meshes, we need to account for the height offset
                const terrainY = this._getGroundLevel(rootMesh.position);
                const heightOffset = this._meshHeightOffset || 0;
                const groundLevel = terrainY + heightOffset;

                if (rootMesh.position.y <= groundLevel) {
                    rootMesh.position.y = groundLevel;
                    this.velocity.y = 0;
                    this.grounded = true;
                } else {
                    this.grounded = false;
                }

                // Debug log once when first grounded
                if (this.grounded && !this._loggedGround) {
                    this._loggedGround = true;
                    console.log(`[SDK:Physics] ${this.gameObject.name} grounded: terrainY=${terrainY}, offset=${heightOffset.toFixed(2)}, finalY=${rootMesh.position.y.toFixed(2)}`);
                }
            }

            // Update collider position
            if (this._box) {
                this._updateCollider(rootMesh.position);
            }
        }
    },

    _getRootMesh() {
        // Find the root mesh (topmost mesh in hierarchy)
        let go = this.gameObject;
        while (go.transform._parent) {
            go = go.transform._parent.gameObject;
        }
        return go.mesh;
    },

    _getGroundLevel(position) {
        // Try to get actual ground level from game
        const game = this.gameObject.game || window.__VOXEL_GAME__;
        if (game?.getGroundLevel) {
            const groundY = game.getGroundLevel(position.x, position.z);
            // Sanity check - if ground returns something unreasonable, use fallback
            if (groundY !== undefined && groundY !== null && groundY > -100 && groundY < 300) {
                return groundY;
            }
        }
        // Fall back to stored groundY or 0
        return this.groundY ?? 0;
    },

    _updateWalking(dt) {
        // Friction
        this.velocity.x *= 0.9;
        this.velocity.z *= 0.9;
    },

    _updateHopping(dt) {
        this._hopTimer += dt;

        if (this.grounded && this._hopTimer >= this._hopInterval) {
            this._hopTimer = 0;
            this.velocity.y = this.jumpHeight * 5;
            this.grounded = false;

            // Random horizontal direction
            const angle = Math.random() * Math.PI * 2;
            this.velocity.x = Math.cos(angle) * this.speed;
            this.velocity.z = Math.sin(angle) * this.speed;
        }
    },

    _updateFlying(dt) {
        // Gentle bobbing
        const rootMesh = this._getRootMesh();
        if (rootMesh) {
            rootMesh.position.y += Math.sin(Date.now() * 0.002) * 0.01;
        }
        // Friction
        this.velocity.multiplyScalar(0.95);
    },

    _updateSwimming(dt) {
        const rootMesh = this._getRootMesh();
        // Buoyancy
        if (rootMesh && rootMesh.position.y < 0) {
            this.velocity.y += 5 * dt;
        }
        this.velocity.multiplyScalar(0.98);
    },

    _updateCollider(pos) {
        const halfW = this.colliderWidth / 2;
        const halfD = (this.colliderDepth ?? this.colliderWidth) / 2;

        this._box.min.set(pos.x - halfW, pos.y, pos.z - halfD);
        this._box.max.set(pos.x + halfW, pos.y + this.colliderHeight, pos.z + halfD);

        // Apply offset
        if (this.colliderOffset) {
            this._box.min.x += this.colliderOffset[0] || 0;
            this._box.min.y += this.colliderOffset[1] || 0;
            this._box.min.z += this.colliderOffset[2] || 0;
            this._box.max.x += this.colliderOffset[0] || 0;
            this._box.max.y += this.colliderOffset[1] || 0;
            this._box.max.z += this.colliderOffset[2] || 0;
        }
    },

    // ========== PUBLIC METHODS - Movement ==========

    move(direction) {
        this.velocity.x = direction.x * this.speed;
        this.velocity.z = direction.z * this.speed;
    },

    jump() {
        if (this.grounded) {
            this.velocity.y = this.jumpHeight * 5;
            this.grounded = false;
        }
    },

    // Get current position (from root mesh)
    getPosition() {
        const rootMesh = this._getRootMesh();
        return rootMesh ? rootMesh.position.clone() : new THREE.Vector3();
    },

    // ========== PUBLIC METHODS - Collider ==========

    /**
     * Get collision bounds (if collider is enabled)
     */
    getBounds() {
        return this._box;
    },

    /**
     * Check if this collider intersects another
     */
    intersects(other) {
        if (!this._box) return false;

        // Other is a PhysicsScript with collider
        if (other._box) {
            return this._box.intersectsBox(other._box);
        }

        // Other is a Box3
        if (other instanceof THREE.Box3) {
            return this._box.intersectsBox(other);
        }

        // Other is a Vector3 (point)
        if (other instanceof THREE.Vector3) {
            return this._box.containsPoint(other);
        }

        return false;
    },

    /**
     * Check if a point is inside the collider
     */
    containsPoint(point) {
        return this._box?.containsPoint(point) ?? false;
    }
};

export default PhysicsScript;
