/**
 * DebugScript - Visual debugging helpers for SDK entities
 *
 * @description Provides visual debug overlays for colliders, AI paths, transforms,
 * and other debugging information. Useful during development.
 *
 * @example
 * // Enable debug visuals for an entity
 * obj.attach('debug', {
 *   showCollider: true,
 *   showVelocity: true,
 *   showPath: true,
 *   showTransformAxes: true
 * });
 *
 * // Or toggle at runtime
 * debugScript.ShowCollider(true);
 * debugScript.ShowPath(true);
 */
import * as THREE from 'three';

/** @type {number} Debug line opacity */
const DEBUG_OPACITY = 0.7;

/** @type {number} Velocity arrow scale */
const VELOCITY_SCALE = 0.2;

/** @type {number} Transform axes length */
const AXES_LENGTH = 1.0;

/** @type {Object} Debug colors */
const DEBUG_COLORS = {
    collider: 0x00ff00,      // Green
    velocity: 0xff0000,      // Red
    pathCurrent: 0xffff00,   // Yellow
    pathTarget: 0x00ffff,    // Cyan
    axisX: 0xff0000,         // Red
    axisY: 0x00ff00,         // Green
    axisZ: 0x0000ff,         // Blue
    state: 0xffffff          // White
};

export const DebugScript = {
    type: 'DebugScript',

    // ===== CONFIG =====
    /** @type {boolean} Show collision bounds */
    showCollider: false,
    /** @type {boolean} Show velocity vector */
    showVelocity: false,
    /** @type {boolean} Show AI path/target */
    showPath: false,
    /** @type {boolean} Show transform axes */
    showTransformAxes: false,
    /** @type {boolean} Show state label */
    showState: false,
    /** @type {boolean} Show position label */
    showPosition: false,

    // ===== STATE =====
    /** @type {THREE.Group|null} Container for debug visuals */
    _debugGroup: null,
    /** @type {THREE.LineSegments|null} Collider wireframe */
    _colliderMesh: null,
    /** @type {THREE.ArrowHelper|null} Velocity arrow */
    _velocityArrow: null,
    /** @type {THREE.Line|null} Path line */
    _pathLine: null,
    /** @type {THREE.AxesHelper|null} Transform axes */
    _axesHelper: null,
    /** @type {HTMLDivElement|null} State label element */
    _stateLabel: null,

    /**
     * Called when the script starts
     */
    Start() {
        this._debugGroup = new THREE.Group();
        this._debugGroup.name = `${this.gameObject.name}_debug`;

        // Add to scene
        const game = this.gameObject.game || window.__VOXEL_GAME__;
        if (game?.scene) {
            game.scene.add(this._debugGroup);
        }

        // Initialize enabled visuals
        if (this.showCollider) this._createColliderVisual();
        if (this.showVelocity) this._createVelocityVisual();
        if (this.showPath) this._createPathVisual();
        if (this.showTransformAxes) this._createAxesVisual();
        if (this.showState || this.showPosition) this._createStateLabel();
    },

    /**
     * Called every frame
     */
    Update() {
        if (!this._debugGroup) return;

        // Update position to follow entity
        const pos = this.gameObject.position;
        if (pos) {
            this._debugGroup.position.copy(pos);
        }

        // Update velocity arrow
        if (this.showVelocity && this._velocityArrow) {
            this._updateVelocityVisual();
        }

        // Update path visualization
        if (this.showPath && this._pathLine) {
            this._updatePathVisual();
        }

        // Update state label
        if ((this.showState || this.showPosition) && this._stateLabel) {
            this._updateStateLabel();
        }
    },

    /**
     * Called when destroyed
     */
    OnDestroy() {
        // Remove debug group from scene
        if (this._debugGroup?.parent) {
            this._debugGroup.parent.remove(this._debugGroup);
        }

        // Dispose geometries and materials
        this._debugGroup?.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });

        // Remove state label
        if (this._stateLabel?.parentElement) {
            this._stateLabel.parentElement.removeChild(this._stateLabel);
        }
    },

    // ===== PUBLIC API =====

    /**
     * Toggle collider visualization
     * @param {boolean} show
     */
    ShowCollider(show) {
        this.showCollider = show;
        if (show && !this._colliderMesh) {
            this._createColliderVisual();
        } else if (!show && this._colliderMesh) {
            this._debugGroup.remove(this._colliderMesh);
            this._colliderMesh.geometry?.dispose();
            this._colliderMesh.material?.dispose();
            this._colliderMesh = null;
        }
    },

    /**
     * Toggle velocity visualization
     * @param {boolean} show
     */
    ShowVelocity(show) {
        this.showVelocity = show;
        if (show && !this._velocityArrow) {
            this._createVelocityVisual();
        } else if (!show && this._velocityArrow) {
            this._debugGroup.remove(this._velocityArrow);
            this._velocityArrow = null;
        }
    },

    /**
     * Toggle path visualization
     * @param {boolean} show
     */
    ShowPath(show) {
        this.showPath = show;
        if (show && !this._pathLine) {
            this._createPathVisual();
        } else if (!show && this._pathLine) {
            this._debugGroup.remove(this._pathLine);
            this._pathLine.geometry?.dispose();
            this._pathLine.material?.dispose();
            this._pathLine = null;
        }
    },

    /**
     * Toggle transform axes visualization
     * @param {boolean} show
     */
    ShowTransformAxes(show) {
        this.showTransformAxes = show;
        if (show && !this._axesHelper) {
            this._createAxesVisual();
        } else if (!show && this._axesHelper) {
            this._debugGroup.remove(this._axesHelper);
            this._axesHelper = null;
        }
    },

    /**
     * Toggle all debug visuals
     * @param {boolean} show
     */
    ShowAll(show) {
        this.ShowCollider(show);
        this.ShowVelocity(show);
        this.ShowPath(show);
        this.ShowTransformAxes(show);
    },

    // ===== INTERNAL =====

    _createColliderVisual() {
        const physics = this.gameObject.getScript?.('PhysicsScript');
        if (!physics) {
            // Create default box
            const geo = new THREE.BoxGeometry(1, 1, 1);
            const edges = new THREE.EdgesGeometry(geo);
            const mat = new THREE.LineBasicMaterial({
                color: DEBUG_COLORS.collider,
                transparent: true,
                opacity: DEBUG_OPACITY
            });
            this._colliderMesh = new THREE.LineSegments(edges, mat);
            geo.dispose();
        } else {
            const w = physics.colliderWidth || 1;
            const h = physics.colliderHeight || 1;
            const d = physics.colliderDepth || w;

            const geo = new THREE.BoxGeometry(w, h, d);
            const edges = new THREE.EdgesGeometry(geo);
            const mat = new THREE.LineBasicMaterial({
                color: DEBUG_COLORS.collider,
                transparent: true,
                opacity: DEBUG_OPACITY
            });
            this._colliderMesh = new THREE.LineSegments(edges, mat);
            this._colliderMesh.position.y = h / 2; // Offset to match collider
            geo.dispose();
        }

        this._debugGroup.add(this._colliderMesh);
    },

    _createVelocityVisual() {
        const dir = new THREE.Vector3(0, 0, 1);
        const origin = new THREE.Vector3(0, 0.5, 0);
        this._velocityArrow = new THREE.ArrowHelper(
            dir,
            origin,
            1,
            DEBUG_COLORS.velocity,
            0.2,
            0.1
        );
        this._debugGroup.add(this._velocityArrow);
    },

    _updateVelocityVisual() {
        const physics = this.gameObject.getScript?.('PhysicsScript');
        if (!physics?.velocity || !this._velocityArrow) return;

        const vel = physics.velocity;
        const length = vel.length() * VELOCITY_SCALE;

        if (length > 0.01) {
            const dir = vel.clone().normalize();
            this._velocityArrow.setDirection(dir);
            this._velocityArrow.setLength(Math.max(0.5, length));
            this._velocityArrow.visible = true;
        } else {
            this._velocityArrow.visible = false;
        }
    },

    _createPathVisual() {
        const points = [
            new THREE.Vector3(0, 0.5, 0),
            new THREE.Vector3(0, 0.5, 1)
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineDashedMaterial({
            color: DEBUG_COLORS.pathCurrent,
            dashSize: 0.3,
            gapSize: 0.1,
            transparent: true,
            opacity: DEBUG_OPACITY
        });
        this._pathLine = new THREE.Line(geo, mat);
        this._pathLine.computeLineDistances();
        this._debugGroup.add(this._pathLine);
    },

    _updatePathVisual() {
        const ai = this.gameObject.getScript?.('AIScript');
        if (!ai || !this._pathLine) return;

        const pos = this.gameObject.position;
        const target = ai._target?.position || ai._home;

        if (target) {
            const positions = this._pathLine.geometry.attributes.position;
            positions.setXYZ(0, 0, 0.5, 0);
            positions.setXYZ(1, target.x - pos.x, 0.5, target.z - pos.z);
            positions.needsUpdate = true;
            this._pathLine.computeLineDistances();
            this._pathLine.visible = true;
        } else {
            this._pathLine.visible = false;
        }
    },

    _createAxesVisual() {
        this._axesHelper = new THREE.AxesHelper(AXES_LENGTH);
        this._debugGroup.add(this._axesHelper);
    },

    _createStateLabel() {
        // Create HTML overlay for state display
        this._stateLabel = document.createElement('div');
        this._stateLabel.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 2px 6px;
            font-size: 12px;
            font-family: monospace;
            border-radius: 3px;
            pointer-events: none;
            z-index: 1000;
            white-space: nowrap;
        `;
        document.body.appendChild(this._stateLabel);
    },

    _updateStateLabel() {
        if (!this._stateLabel) return;

        const game = this.gameObject.game || window.__VOXEL_GAME__;
        const camera = game?.camera;

        if (!camera) {
            this._stateLabel.style.display = 'none';
            return;
        }

        // Project position to screen
        const pos = this.gameObject.position.clone();
        pos.y += 1.5; // Offset above entity

        const screenPos = pos.clone().project(camera);

        // Check if in front of camera
        if (screenPos.z > 1) {
            this._stateLabel.style.display = 'none';
            return;
        }

        // Convert to screen coordinates
        const canvas = game.renderer?.domElement;
        if (!canvas) return;

        const x = (screenPos.x * 0.5 + 0.5) * canvas.clientWidth;
        const y = (-screenPos.y * 0.5 + 0.5) * canvas.clientHeight;

        // Build label text
        let text = this.gameObject.name;

        if (this.showState) {
            const ai = this.gameObject.getScript?.('AIScript');
            if (ai) {
                text += ` [${ai._state || 'unknown'}]`;
            }

            const health = this.gameObject.getScript?.('HealthScript');
            if (health) {
                text += ` HP:${health.current}/${health.max}`;
            }
        }

        if (this.showPosition) {
            const p = this.gameObject.position;
            text += ` (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`;
        }

        this._stateLabel.textContent = text;
        this._stateLabel.style.display = 'block';
        this._stateLabel.style.left = `${x}px`;
        this._stateLabel.style.top = `${y}px`;
        this._stateLabel.style.transform = 'translate(-50%, -100%)';
    }
};

export default DebugScript;
