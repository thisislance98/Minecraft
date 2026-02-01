/**
 * VoxelWorld SDK
 *
 * GameObject + Scripts architecture
 *
 * @example
 * // Create a wand
 * VoxelWorld.createObject('fire_wand')
 *   .attach('mesh', [{ type: 'cylinder', size: [0.1, 0.8], color: 0x5c4033 }])
 *   .attach('item', { icon: '<svg>...</svg>', category: 'tool' })
 *   .attach('shooter', { speed: 25, cooldown: 500 })
 *   .register();
 *
 * // Create a creature
 * VoxelWorld.createObject('Slime')
 *   .attach('mesh', [{ type: 'sphere', size: [0.8], color: 0x00ff00 }])
 *   .attach('entity')
 *   .attach('physics', { mode: 'hopping', speed: 3 })
 *   .attach('ai', { behavior: 'passive' })
 *   .attach('health', { max: 20 })
 *   .register();
 */

import VoxelWorld, { GameObject } from './VoxelWorld.js';

// Core
export { VoxelWorld, GameObject };
export default VoxelWorld;

// Scripts
export {
    MeshScript,
    ItemScript,
    EntityScript,
    PhysicsScript,
    AIScript,
    HealthScript,
    ColliderScript,
    ShooterScript,
    ProjectileScript,
    ParticleScript,
    ScriptTypes,
    getScript
} from './scripts/index.js';

// Utilities
export { buildMesh, createPart } from './core/MeshBuilder.js';
export { validateIcon } from './core/IconValidator.js';

export const SDK_VERSION = '3.0.0';
