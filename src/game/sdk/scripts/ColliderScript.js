/**
 * ColliderScript - Adds collision bounds to a game object
 */
import * as THREE from 'three';

export const ColliderScript = {
    type: 'ColliderScript',

    // Config
    width: 1,
    height: 1,
    depth: null,          // Defaults to width
    offset: null,         // [x, y, z] offset from center

    // State
    _box: null,

    start(obj) {
        const d = this.depth ?? this.width;
        const halfW = this.width / 2;
        const halfH = this.height / 2;
        const halfD = d / 2;

        this._box = new THREE.Box3(
            new THREE.Vector3(-halfW, 0, -halfD),
            new THREE.Vector3(halfW, this.height, halfD)
        );
    },

    update(obj, dt) {
        // Update box position
        if (this._box) {
            const halfW = this.width / 2;
            const halfD = (this.depth ?? this.width) / 2;
            const pos = obj.position;

            this._box.min.set(pos.x - halfW, pos.y, pos.z - halfD);
            this._box.max.set(pos.x + halfW, pos.y + this.height, pos.z + halfD);

            // Apply offset
            if (this.offset) {
                this._box.min.x += this.offset[0] || 0;
                this._box.min.y += this.offset[1] || 0;
                this._box.min.z += this.offset[2] || 0;
                this._box.max.x += this.offset[0] || 0;
                this._box.max.y += this.offset[1] || 0;
                this._box.max.z += this.offset[2] || 0;
            }
        }
    },

    // Public methods
    getBounds() {
        return this._box;
    },

    intersects(other) {
        if (!this._box) return false;

        // Other is a ColliderScript
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

    containsPoint(point) {
        return this._box?.containsPoint(point) ?? false;
    }
};

export default ColliderScript;
