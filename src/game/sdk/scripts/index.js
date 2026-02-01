/**
 * Built-in Scripts Index
 */

export { MeshScript } from './MeshScript.js';
export { ItemScript } from './ItemScript.js';
export { EntityScript } from './EntityScript.js';
export { PhysicsScript } from './PhysicsScript.js';
export { AIScript } from './AIScript.js';
export { HealthScript } from './HealthScript.js';
export { ColliderScript } from './ColliderScript.js';
export { ShooterScript } from './ShooterScript.js';
export { ProjectileScript } from './ProjectileScript.js';
export { ParticleScript } from './ParticleScript.js';

// Script registry for lookup by name
export const Scripts = {
    MeshScript: () => import('./MeshScript.js').then(m => m.MeshScript),
    ItemScript: () => import('./ItemScript.js').then(m => m.ItemScript),
    EntityScript: () => import('./EntityScript.js').then(m => m.EntityScript),
    PhysicsScript: () => import('./PhysicsScript.js').then(m => m.PhysicsScript),
    AIScript: () => import('./AIScript.js').then(m => m.AIScript),
    HealthScript: () => import('./HealthScript.js').then(m => m.HealthScript),
    ColliderScript: () => import('./ColliderScript.js').then(m => m.ColliderScript),
    ShooterScript: () => import('./ShooterScript.js').then(m => m.ShooterScript),
    ProjectileScript: () => import('./ProjectileScript.js').then(m => m.ProjectileScript),
    ParticleScript: () => import('./ParticleScript.js').then(m => m.ParticleScript),
};

// Synchronous registry (loaded on import)
import { MeshScript } from './MeshScript.js';
import { ItemScript } from './ItemScript.js';
import { EntityScript } from './EntityScript.js';
import { PhysicsScript } from './PhysicsScript.js';
import { AIScript } from './AIScript.js';
import { HealthScript } from './HealthScript.js';
import { ColliderScript } from './ColliderScript.js';
import { ShooterScript } from './ShooterScript.js';
import { ProjectileScript } from './ProjectileScript.js';
import { ParticleScript } from './ParticleScript.js';

export const ScriptTypes = {
    mesh: MeshScript,
    item: ItemScript,
    entity: EntityScript,
    physics: PhysicsScript,
    ai: AIScript,
    health: HealthScript,
    collider: ColliderScript,
    shooter: ShooterScript,
    projectile: ProjectileScript,
    particle: ParticleScript,
};

/**
 * Get a script by type name
 */
export function getScript(typeName) {
    const normalized = typeName.toLowerCase().replace('script', '');
    return ScriptTypes[normalized] || null;
}
