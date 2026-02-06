/**
 * Built-in Scripts Index
 *
 * 11 scripts:
 * - MeshScript: 3D geometry rendering
 * - ItemScript: Inventory items
 * - PhysicsScript: Movement + collision bounds
 * - AIScript: AI behavior + smart wandering
 * - HealthScript: HP/damage system
 * - ShooterScript: Fire projectiles
 * - ProjectileScript: Projectile behavior
 * - ParticleScript: Particle effects
 * - AnimationScript: Skeletal animation
 * - SoundScript: 3D positional audio
 * - DebugScript: Visual debugging helpers
 */

export { MeshScript } from './MeshScript.js';
export { ItemScript } from './ItemScript.js';
export { PhysicsScript } from './PhysicsScript.js';
export { AIScript } from './AIScript.js';
export { HealthScript } from './HealthScript.js';
export { ShooterScript } from './ShooterScript.js';
export { ProjectileScript } from './ProjectileScript.js';
export { ParticleScript } from './ParticleScript.js';
export { AnimationScript } from './AnimationScript.js';
export { SoundScript } from './SoundScript.js';
export { DebugScript } from './DebugScript.js';

// Script registry for lookup by name (async)
export const Scripts = {
    MeshScript: () => import('./MeshScript.js').then(m => m.MeshScript),
    ItemScript: () => import('./ItemScript.js').then(m => m.ItemScript),
    PhysicsScript: () => import('./PhysicsScript.js').then(m => m.PhysicsScript),
    AIScript: () => import('./AIScript.js').then(m => m.AIScript),
    HealthScript: () => import('./HealthScript.js').then(m => m.HealthScript),
    ShooterScript: () => import('./ShooterScript.js').then(m => m.ShooterScript),
    ProjectileScript: () => import('./ProjectileScript.js').then(m => m.ProjectileScript),
    ParticleScript: () => import('./ParticleScript.js').then(m => m.ParticleScript),
    AnimationScript: () => import('./AnimationScript.js').then(m => m.AnimationScript),
    SoundScript: () => import('./SoundScript.js').then(m => m.SoundScript),
    DebugScript: () => import('./DebugScript.js').then(m => m.DebugScript),
};

// Synchronous registry (loaded on import)
import { MeshScript } from './MeshScript.js';
import { ItemScript } from './ItemScript.js';
import { PhysicsScript } from './PhysicsScript.js';
import { AIScript } from './AIScript.js';
import { HealthScript } from './HealthScript.js';
import { ShooterScript } from './ShooterScript.js';
import { ProjectileScript } from './ProjectileScript.js';
import { ParticleScript } from './ParticleScript.js';
import { AnimationScript } from './AnimationScript.js';
import { SoundScript } from './SoundScript.js';
import { DebugScript } from './DebugScript.js';

/**
 * Script type lookup table
 * Maps lowercase names to script prototypes
 * @type {Object<string, Object>}
 */
export const ScriptTypes = {
    mesh: MeshScript,
    item: ItemScript,
    physics: PhysicsScript,
    ai: AIScript,
    health: HealthScript,
    shooter: ShooterScript,
    projectile: ProjectileScript,
    particle: ParticleScript,
    animation: AnimationScript,
    sound: SoundScript,
    debug: DebugScript,
};

/**
 * Get a script prototype by type name
 * @param {string} typeName - Script type (e.g., 'mesh', 'MeshScript', 'physics')
 * @returns {Object|null} Script prototype or null if not found
 */
export function getScript(typeName) {
    const normalized = typeName.toLowerCase().replace('script', '');
    return ScriptTypes[normalized] || null;
}
