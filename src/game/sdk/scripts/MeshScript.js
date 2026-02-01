/**
 * MeshScript - Adds 3D visual to a game object
 */
import { buildMesh } from '../core/MeshBuilder.js';

export const MeshScript = {
    type: 'MeshScript',

    // Config
    parts: null,

    Start() {
        if (this.parts && Array.isArray(this.parts)) {
            this.gameObject.mesh = buildMesh(this.parts);
            this.gameObject.mesh.userData.gameObject = this.gameObject;
        }
    },

    OnDestroy() {
        // Mesh cleanup handled by GameObject.Destroy()
    }
};

export default MeshScript;
