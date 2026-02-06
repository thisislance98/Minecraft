/**
 * MeshScript - Adds 3D mesh(es) to a GameObject (Unity-style)
 *
 * Supports both single mesh config and arrays of parts for complex creatures.
 *
 * Examples:
 *   // Single mesh
 *   obj.attach('mesh', { type: 'box', size: [1, 1, 1], color: 0xff0000 });
 *
 *   // Multi-part creature (array of parts)
 *   obj.attach('mesh', [
 *     { type: 'box', size: [0.8, 0.6, 1.2], color: 0xffaaaa, name: 'body' },
 *     { type: 'sphere', size: [0.1], color: 0xffffff, position: [-0.2, 0.8, 0.4], name: 'left_eye' },
 *     { type: 'sphere', size: [0.05], color: 0x000000, position: [-0.2, 0.8, 0.45], name: 'left_pupil' }
 *   ]);
 */
import * as THREE from 'three';
import { Time } from '../core/GameObject.js';

export const MeshScript = {
    type: 'MeshScript',

    // Config - can be single mesh properties OR an array of parts
    // Single mesh mode:
    meshType: 'box',      // box, sphere, cylinder, cone, capsule, torus, plane
    size: [1, 1, 1],      // dimensions (meaning varies by type)
    color: 0x888888,      // hex color

    // Multi-part mode:
    parts: null,          // Array of part configs: [{ type, size, color, position, rotation, name }, ...]

    // Material options (for single mesh mode)
    emissive: false,
    emissiveColor: null,
    emissiveIntensity: 0.5,
    roughness: undefined,
    metalness: undefined,
    transparent: false,
    opacity: 0.5,
    doubleSided: false,

    // Rendering
    castShadow: true,
    receiveShadow: true,

    // Animation
    _legPivots: null,      // Array of leg pivot groups for walking animation
    _tailPivot: null,      // Tail pivot for wagging
    _animTime: 0,          // Animation timer
    _legSwingSpeed: 8,     // How fast legs swing
    _legSwingAngle: 0.5,   // Max leg swing angle in radians

    Start() {
        // Check if we have an array of parts (multi-part mode)
        if (this.parts && Array.isArray(this.parts)) {
            this.gameObject.mesh = this._createMultiPartMesh(this.parts);
        } else {
            // Single mesh mode
            this.gameObject.mesh = this._createMesh();
        }

        this.gameObject.mesh.userData.gameObject = this.gameObject;

        // Sync initial transform
        this.gameObject.SyncTransform();
    },

    /**
     * Update animation each frame
     */
    Update() {
        // Check if we have legs to animate
        if (!this._legPivots || this._legPivots.length === 0) return;

        // Get AI script to check if moving
        const aiScript = this.gameObject.getScript('AIScript');
        const physicsScript = this.gameObject.getScript('PhysicsScript');
        const isMoving = aiScript?._isMoving || physicsScript?._isMoving || false;

        if (isMoving) {
            this._animTime += (Time?.deltaTime || 0.016) * this._legSwingSpeed;
            const angle = Math.sin(this._animTime) * this._legSwingAngle;

            // Animate legs - opposite pairs swing together
            if (this._legPivots.length >= 4) {
                // Quadruped: FL, FR, BL, BR
                this._legPivots[0].rotation.x = angle;   // Front Left
                this._legPivots[1].rotation.x = -angle;  // Front Right
                this._legPivots[2].rotation.x = -angle;  // Back Left
                this._legPivots[3].rotation.x = angle;   // Back Right
            } else if (this._legPivots.length >= 2) {
                // Biped
                this._legPivots[0].rotation.x = angle;
                this._legPivots[1].rotation.x = -angle;
            }

            // Wag tail if we have one
            if (this._tailPivot) {
                this._tailPivot.rotation.y = Math.sin(this._animTime * 1.5) * 0.3;
            }
        } else {
            // Reset to idle pose
            for (const pivot of this._legPivots) {
                pivot.rotation.x *= 0.9; // Smooth return to 0
            }
            if (this._tailPivot) {
                this._tailPivot.rotation.y *= 0.9;
            }
        }
    },

    /**
     * Create a group containing multiple mesh parts
     * @param {Array} parts - Array of part configs
     * @returns {THREE.Group}
     */
    _createMultiPartMesh(parts) {
        const group = new THREE.Group();
        group.name = this.gameObject.name;

        // Store part map for animation access
        this._partMap = new Map();
        this._legPivots = [];
        this._tailPivot = null;

        // Separate leg parts from other parts (legs need pivots)
        const legParts = [];
        const tailParts = [];
        const otherParts = [];

        for (const part of parts) {
            const name = (part.name || '').toLowerCase();
            if (name.includes('leg_') || name.includes('_leg') ||
                name === 'leg' || name.match(/^(front|back|left|right).*leg/)) {
                legParts.push(part);
            } else if (name.includes('tail')) {
                tailParts.push(part);
            } else {
                otherParts.push(part);
            }
        }

        // Create non-leg parts normally
        for (const part of otherParts) {
            const mesh = this._createPartMesh(part);
            if (mesh) {
                group.add(mesh);
                if (part.name) {
                    this._partMap.set(part.name, mesh);
                }
            }
        }

        // Create leg parts with pivots for animation
        // Sort legs: front-left, front-right, back-left, back-right
        const sortedLegs = this._sortLegParts(legParts);
        for (const part of sortedLegs) {
            const pivot = this._createLegWithPivot(part);
            if (pivot) {
                group.add(pivot);
                this._legPivots.push(pivot);
                if (part.name) {
                    this._partMap.set(part.name, pivot);
                }
            }
        }

        // Create tail with pivot for wagging
        if (tailParts.length > 0) {
            const tailPivot = this._createTailWithPivot(tailParts);
            if (tailPivot) {
                group.add(tailPivot);
                this._tailPivot = tailPivot;
            }
        }

        return group;
    },

    /**
     * Sort leg parts into correct order: FL, FR, BL, BR
     */
    _sortLegParts(legParts) {
        const order = { 'fl': 0, 'fr': 1, 'bl': 2, 'br': 3 };

        return legParts.sort((a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();

            // Try to determine position from name
            const getOrder = (name) => {
                if (name.includes('front') && name.includes('left')) return 0;
                if (name.includes('front') && name.includes('right')) return 1;
                if (name.includes('back') && name.includes('left')) return 2;
                if (name.includes('back') && name.includes('right')) return 3;
                if (name.includes('_fl') || name.endsWith('fl')) return 0;
                if (name.includes('_fr') || name.endsWith('fr')) return 1;
                if (name.includes('_bl') || name.endsWith('bl')) return 2;
                if (name.includes('_br') || name.endsWith('br')) return 3;
                // Fallback: use x position (negative = left, positive = right)
                // and z position (positive = front, negative = back)
                return -1;
            };

            const orderA = getOrder(nameA);
            const orderB = getOrder(nameB);

            if (orderA >= 0 && orderB >= 0) return orderA - orderB;

            // Fallback: sort by position
            const posA = a.position || [0, 0, 0];
            const posB = b.position || [0, 0, 0];
            const zA = posA[2] ?? posA.z ?? 0;
            const zB = posB[2] ?? posB.z ?? 0;
            const xA = posA[0] ?? posA.x ?? 0;
            const xB = posB[0] ?? posB.x ?? 0;

            // Sort by z (front first), then by x (left first)
            if (Math.abs(zA - zB) > 0.1) return zB - zA; // front (higher z) first
            return xA - xB; // left (lower x) first
        });
    },

    /**
     * Create a leg mesh inside a pivot group for rotation
     */
    _createLegWithPivot(config) {
        const pivot = new THREE.Group();
        pivot.name = config.name || 'leg_pivot';

        // Position the pivot at the top of the leg (hip position)
        const pos = config.position || [0, 0, 0];
        const size = config.size || [0.15, 0.35, 0.15];
        const legHeight = size[1] || 0.35;

        // Pivot is at the hip (top of leg)
        pivot.position.set(
            pos[0] ?? pos.x ?? 0,
            (pos[1] ?? pos.y ?? 0) + legHeight / 2,  // Move pivot to top of leg
            pos[2] ?? pos.z ?? 0
        );

        // Create the leg mesh, positioned below the pivot
        const legConfig = { ...config, position: [0, -legHeight / 2, 0] };
        const legMesh = this._createPartMesh(legConfig);
        if (legMesh) {
            pivot.add(legMesh);
        }

        return pivot;
    },

    /**
     * Create tail parts inside a pivot group for wagging
     */
    _createTailWithPivot(tailParts) {
        if (tailParts.length === 0) return null;

        const pivot = new THREE.Group();
        pivot.name = 'tail_pivot';

        // Use first tail part's position for pivot
        const firstPart = tailParts[0];
        const pos = firstPart.position || [0, 0, 0];
        pivot.position.set(
            pos[0] ?? pos.x ?? 0,
            pos[1] ?? pos.y ?? 0,
            pos[2] ?? pos.z ?? 0
        );

        // Add all tail parts relative to pivot
        for (const part of tailParts) {
            const partPos = part.position || [0, 0, 0];
            const relativeConfig = {
                ...part,
                position: [
                    (partPos[0] ?? partPos.x ?? 0) - (pos[0] ?? pos.x ?? 0),
                    (partPos[1] ?? partPos.y ?? 0) - (pos[1] ?? pos.y ?? 0),
                    (partPos[2] ?? partPos.z ?? 0) - (pos[2] ?? pos.z ?? 0)
                ]
            };
            const mesh = this._createPartMesh(relativeConfig);
            if (mesh) {
                pivot.add(mesh);
            }
        }

        return pivot;
    },

    /**
     * Create a single mesh part
     * @param {Object} config - Part configuration
     * @returns {THREE.Mesh}
     */
    _createPartMesh(config) {
        const type = config.type || config.meshType || 'box';
        const size = config.size || [1, 1, 1];
        const color = config.color || 0x888888;

        // Create geometry
        const geometry = this._createGeometryForType(type, size);

        // Create material
        const material = this._createMaterialWithConfig(config);

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = config.castShadow !== false;
        mesh.receiveShadow = config.receiveShadow !== false;

        // Apply position
        if (config.position) {
            const pos = config.position;
            mesh.position.set(
                pos[0] ?? pos.x ?? 0,
                pos[1] ?? pos.y ?? 0,
                pos[2] ?? pos.z ?? 0
            );
        }

        // Apply rotation (in degrees)
        if (config.rotation) {
            const rot = config.rotation;
            mesh.rotation.set(
                THREE.MathUtils.degToRad(rot[0] ?? rot.x ?? 0),
                THREE.MathUtils.degToRad(rot[1] ?? rot.y ?? 0),
                THREE.MathUtils.degToRad(rot[2] ?? rot.z ?? 0)
            );
        }

        // Apply scale
        if (config.scale) {
            if (Array.isArray(config.scale)) {
                mesh.scale.set(
                    config.scale[0] || 1,
                    config.scale[1] || config.scale[0] || 1,
                    config.scale[2] || config.scale[0] || 1
                );
            } else if (typeof config.scale === 'number') {
                mesh.scale.setScalar(config.scale);
            }
        }

        // Name for animation targeting
        if (config.name) {
            mesh.name = config.name;
        }

        return mesh;
    },

    /**
     * Create geometry for a specific type
     */
    _createGeometryForType(type, size) {
        switch (type) {
            case 'sphere':
                return new THREE.SphereGeometry(size[0] || 0.5, 16, 16);

            case 'cylinder':
                return new THREE.CylinderGeometry(
                    size[0] || 0.5,                                    // radiusTop
                    size[1] !== undefined ? size[1] : size[0] || 0.5, // radiusBottom
                    size[2] !== undefined ? size[2] : size[1] || 1,   // height
                    16
                );

            case 'cone':
                return new THREE.ConeGeometry(size[0] || 0.5, size[1] || 1, 16);

            case 'capsule':
                return new THREE.CapsuleGeometry(
                    size[0] || 0.25,  // radius
                    size[1] || 0.5,   // length
                    8, 16
                );

            case 'torus':
                return new THREE.TorusGeometry(
                    size[0] || 0.5,   // radius
                    size[1] || 0.1,   // tube
                    16, 32
                );

            case 'plane':
                return new THREE.PlaneGeometry(size[0] || 1, size[1] || 1);

            case 'box':
            default:
                return new THREE.BoxGeometry(
                    size[0] || 1,
                    size[1] || 1,
                    size[2] || size[0] || 1
                );
        }
    },

    /**
     * Create material from config
     */
    _createMaterialWithConfig(config) {
        const color = config.color || 0x888888;

        if (config.emissive) {
            return new THREE.MeshStandardMaterial({
                color: color,
                emissive: config.emissiveColor || color,
                emissiveIntensity: config.emissiveIntensity || 0.5,
                roughness: config.roughness ?? 0.5,
                metalness: config.metalness ?? 0.0
            });
        }

        if (config.transparent) {
            return new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: config.opacity || 0.5,
                side: config.doubleSided ? THREE.DoubleSide : THREE.FrontSide
            });
        }

        if (config.roughness !== undefined || config.metalness !== undefined) {
            return new THREE.MeshStandardMaterial({
                color: color,
                roughness: config.roughness ?? 0.5,
                metalness: config.metalness ?? 0.0
            });
        }

        return new THREE.MeshLambertMaterial({ color: color });
    },

    _createMesh() {
        const geometry = this._createGeometry();
        const material = this._createMaterial();

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = this.castShadow !== false;
        mesh.receiveShadow = this.receiveShadow !== false;
        mesh.name = this.gameObject.name;

        return mesh;
    },

    _createGeometry() {
        const size = this.size || [1, 1, 1];

        switch (this.meshType) {
            case 'sphere':
                return new THREE.SphereGeometry(size[0] || 0.5, 16, 16);

            case 'cylinder':
                return new THREE.CylinderGeometry(
                    size[0] || 0.5,                                    // radiusTop
                    size[1] !== undefined ? size[1] : size[0] || 0.5, // radiusBottom
                    size[2] !== undefined ? size[2] : size[1] || 1,   // height
                    16
                );

            case 'cone':
                return new THREE.ConeGeometry(size[0] || 0.5, size[1] || 1, 16);

            case 'capsule':
                return new THREE.CapsuleGeometry(
                    size[0] || 0.25,  // radius
                    size[1] || 0.5,   // length
                    8, 16
                );

            case 'torus':
                return new THREE.TorusGeometry(
                    size[0] || 0.5,   // radius
                    size[1] || 0.1,   // tube
                    16, 32
                );

            case 'plane':
                return new THREE.PlaneGeometry(size[0] || 1, size[1] || 1);

            case 'box':
            default:
                return new THREE.BoxGeometry(
                    size[0] || 1,
                    size[1] || 1,
                    size[2] || size[0] || 1
                );
        }
    },

    _createMaterial() {
        const color = this.color || 0x888888;

        if (this.emissive) {
            return new THREE.MeshStandardMaterial({
                color: color,
                emissive: this.emissiveColor || color,
                emissiveIntensity: this.emissiveIntensity || 0.5,
                roughness: this.roughness ?? 0.5,
                metalness: this.metalness ?? 0.0
            });
        }

        if (this.transparent) {
            return new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: this.opacity || 0.5,
                side: this.doubleSided ? THREE.DoubleSide : THREE.FrontSide
            });
        }

        if (this.roughness !== undefined || this.metalness !== undefined) {
            return new THREE.MeshStandardMaterial({
                color: color,
                roughness: this.roughness ?? 0.5,
                metalness: this.metalness ?? 0.0
            });
        }

        return new THREE.MeshLambertMaterial({ color: color });
    },

    /**
     * Change the mesh color at runtime
     */
    setColor(color) {
        if (this.gameObject.mesh?.material) {
            this.gameObject.mesh.material.color.setHex(color);
        }
    },

    /**
     * Set emissive properties at runtime
     */
    setEmissive(color, intensity = 0.5) {
        if (this.gameObject.mesh?.material?.emissive) {
            this.gameObject.mesh.material.emissive.setHex(color);
            this.gameObject.mesh.material.emissiveIntensity = intensity;
        }
    },

    /**
     * Set visibility
     */
    setVisible(visible) {
        if (this.gameObject.mesh) {
            this.gameObject.mesh.visible = visible;
        }
    },

    OnDestroy() {
        // Mesh cleanup handled by GameObject.Destroy()
    }
};

export default MeshScript;
