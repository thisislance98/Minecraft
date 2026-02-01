/**
 * MeshBuilder - Simplified mesh builder
 * Just builds meshes from part arrays
 */
import * as THREE from 'three';

/**
 * Build a mesh from an array of parts
 * @param {Array} parts - Array of part configs
 * @returns {THREE.Group}
 */
export function buildMesh(parts) {
    const group = new THREE.Group();

    if (!parts || !Array.isArray(parts)) {
        return group;
    }

    for (const part of parts) {
        const mesh = createPart(part);
        if (mesh) {
            group.add(mesh);
        }
    }

    return group;
}

/**
 * Create a single mesh part
 * @param {Object} config - Part configuration
 * @returns {THREE.Mesh}
 */
export function createPart(config) {
    const type = config.type || 'box';
    const size = config.size || [1, 1, 1];
    const color = config.color || 0x888888;

    // Create geometry based on type
    let geometry;
    switch (type) {
        case 'sphere':
            geometry = new THREE.SphereGeometry(size[0] || 0.5, 16, 16);
            break;
        case 'cylinder':
            geometry = new THREE.CylinderGeometry(size[0] || 0.5, size[0] || 0.5, size[1] || 1, 16);
            break;
        case 'cone':
            geometry = new THREE.ConeGeometry(size[0] || 0.5, size[1] || 1, 16);
            break;
        case 'box':
        default:
            geometry = new THREE.BoxGeometry(size[0] || 1, size[1] || 1, size[2] || size[0] || 1);
            break;
    }

    // Create material
    let material;
    if (config.emissive) {
        material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: config.emissiveIntensity || 0.5
        });
    } else if (config.transparent) {
        material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: config.opacity || 0.5
        });
    } else {
        material = new THREE.MeshLambertMaterial({ color: color });
    }

    const mesh = new THREE.Mesh(geometry, material);

    // Apply position
    if (config.position) {
        const pos = config.position;
        mesh.position.set(
            pos[0] || pos.x || 0,
            pos[1] || pos.y || 0,
            pos[2] || pos.z || 0
        );
    }

    // Apply rotation (degrees)
    if (config.rotation) {
        const rot = config.rotation;
        mesh.rotation.set(
            THREE.MathUtils.degToRad(rot[0] || rot.x || 0),
            THREE.MathUtils.degToRad(rot[1] || rot.y || 0),
            THREE.MathUtils.degToRad(rot[2] || rot.z || 0)
        );
    }

    // Apply scale
    if (config.scale) {
        const s = typeof config.scale === 'number' ? config.scale : 1;
        mesh.scale.set(s, s, s);
    }

    // Name for debugging
    if (config.name) {
        mesh.name = config.name;
    }

    return mesh;
}

/**
 * Dispose of a mesh and free memory
 */
export function dispose(mesh) {
    if (!mesh) return;

    if (mesh.geometry) {
        mesh.geometry.dispose();
    }

    if (mesh.material) {
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
        } else {
            mesh.material.dispose();
        }
    }

    if (mesh.children) {
        mesh.children.forEach(child => dispose(child));
    }
}

export default { buildMesh, createPart, dispose };
