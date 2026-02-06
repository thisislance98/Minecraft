/**
 * MeshBuilder - Simplified mesh builder
 * Just builds meshes from part arrays with hierarchical support
 */
import * as THREE from 'three';

/**
 * Build a mesh from an array of parts (supports nested children)
 * @param {Array} parts - Array of part configs
 * @param {Map} [partMap] - Optional map to store named parts for animation
 * @returns {THREE.Group}
 */
export function buildMesh(parts, partMap = null) {
    const group = new THREE.Group();

    // Initialize partMap if not provided
    if (!partMap) {
        partMap = new Map();
    }
    // Store on group for external access
    group.userData.partMap = partMap;

    if (!parts || !Array.isArray(parts)) {
        return group;
    }

    for (const part of parts) {
        const mesh = createPart(part, partMap);
        if (mesh) {
            group.add(mesh);
        }
    }

    return group;
}

/**
 * Create a single mesh part (supports nested children)
 * @param {Object} config - Part configuration
 * @param {Map} [partMap] - Optional map to store named parts for animation
 * @returns {THREE.Mesh|THREE.Group}
 */
export function createPart(config, partMap = null) {
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
            geometry = new THREE.CylinderGeometry(
                size[0] || 0.5,  // radiusTop
                size[1] !== undefined ? size[1] : size[0] || 0.5,  // radiusBottom (default same as top)
                size[2] !== undefined ? size[2] : size[1] || 1,    // height
                16
            );
            break;
        case 'cone':
            geometry = new THREE.ConeGeometry(size[0] || 0.5, size[1] || 1, 16);
            break;
        case 'capsule':
            // CapsuleGeometry(radius, length, capSegments, radialSegments)
            geometry = new THREE.CapsuleGeometry(
                size[0] || 0.25,  // radius
                size[1] || 0.5,   // length (total height = length + 2*radius)
                8,                // capSegments
                16                // radialSegments
            );
            break;
        case 'torus':
            geometry = new THREE.TorusGeometry(
                size[0] || 0.5,   // radius
                size[1] || 0.1,   // tube
                16,               // radialSegments
                32                // tubularSegments
            );
            break;
        case 'plane':
            geometry = new THREE.PlaneGeometry(size[0] || 1, size[1] || 1);
            break;
        case 'box':
        default:
            geometry = new THREE.BoxGeometry(size[0] || 1, size[1] || 1, size[2] || size[0] || 1);
            break;
    }

    // Create material with enhanced options
    let material;
    if (config.emissive) {
        material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: config.emissiveColor || color,
            emissiveIntensity: config.emissiveIntensity || 0.5,
            roughness: config.roughness !== undefined ? config.roughness : 0.5,
            metalness: config.metalness !== undefined ? config.metalness : 0.0
        });
    } else if (config.transparent) {
        material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: config.opacity || 0.5,
            side: config.doubleSided ? THREE.DoubleSide : THREE.FrontSide
        });
    } else if (config.roughness !== undefined || config.metalness !== undefined) {
        // Use StandardMaterial for PBR
        material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: config.roughness !== undefined ? config.roughness : 0.5,
            metalness: config.metalness !== undefined ? config.metalness : 0.0
        });
    } else {
        material = new THREE.MeshLambertMaterial({ color: color });
    }

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

    // Apply rotation (degrees)
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
        } else {
            const s = typeof config.scale === 'number' ? config.scale : 1;
            mesh.scale.set(s, s, s);
        }
    }

    // Name for debugging and animation targeting
    if (config.name) {
        mesh.name = config.name;
        // Store in partMap for easy access
        if (partMap) {
            partMap.set(config.name, mesh);
        }
    }

    // Store pivot offset if specified (for animations)
    if (config.pivot) {
        mesh.userData.pivot = config.pivot;
    }

    // Handle nested children
    if (config.children && Array.isArray(config.children)) {
        for (const childConfig of config.children) {
            const childMesh = createPart(childConfig, partMap);
            if (childMesh) {
                mesh.add(childMesh);
            }
        }
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

/**
 * Find a part by name in a mesh hierarchy
 * @param {THREE.Object3D} mesh - Root mesh to search in
 * @param {string} name - Name of the part to find
 * @returns {THREE.Object3D|null}
 */
export function findPart(mesh, name) {
    if (!mesh) return null;

    // Check the partMap first if available
    if (mesh.userData?.partMap) {
        const found = mesh.userData.partMap.get(name);
        if (found) return found;
    }

    // Fall back to recursive search
    return mesh.getObjectByName(name);
}

/**
 * Get all named parts from a mesh
 * @param {THREE.Object3D} mesh - Root mesh
 * @returns {Map<string, THREE.Object3D>}
 */
export function getPartMap(mesh) {
    if (mesh.userData?.partMap) {
        return mesh.userData.partMap;
    }

    // Build a new map
    const map = new Map();
    mesh.traverse(child => {
        if (child.name) {
            map.set(child.name, child);
        }
    });
    return map;
}

export default { buildMesh, createPart, dispose, findPart, getPartMap };
