/**
 * DynamicCreatureService - Manages dynamic creature definitions
 *
 * Handles:
 * 1. Storing creature definitions in Firebase (world-scoped or global)
 * 2. Broadcasting new definitions to clients in the same world
 * 3. Loading persisted creatures on server startup
 *
 * Creatures can be:
 * - Global (worldId = 'global') - available in all worlds
 * - World-scoped (worldId = specific world ID) - only available in that world
 */

import { db } from '../config';
import { io } from '../index';
import * as fs from 'fs/promises';
import * as path from 'path';

// Define paths to static entity directories relative to this service file
const STATIC_ENTITY_DIRS = [
    path.join(__dirname, '../../src/game/entities/animals'),
    path.join(__dirname, '../../src/game/entities/monsters'),
    path.join(__dirname, '../../src/game/entities/furniture')
];

export interface CreatureDefinition {
    name: string;           // PascalCase class name (e.g., "BouncingSlime")
    code: string;           // Full JavaScript class code
    description: string;    // What the creature does
    createdBy: string;      // User ID or "anonymous"
    createdAt: number;      // Timestamp
    worldId?: string;       // World ID (undefined or 'global' for global creatures)
}

// In-memory cache of all creature definitions
// Key format: "worldId:creatureName" for world-scoped, "global:creatureName" for global
const creatureCache = new Map<string, CreatureDefinition>();

// Helper to get cache key
function getCacheKey(worldId: string | undefined, name: string): string {
    return `${worldId || 'global'}:${name}`;
}

/**
 * Validate creature code has basic required structure
 */
function validateCreatureCode(name: string, code: string): { valid: boolean; error?: string } {
    // Check for class declaration
    if (!code.includes(`class ${name}`)) {
        return { valid: false, error: `Code must contain 'class ${name}'` };
    }

    // Check for Animal extension
    if (!code.includes('extends Animal')) {
        return { valid: false, error: `Class must extend Animal` };
    }

    // Check for constructor
    if (!code.includes('constructor')) {
        return { valid: false, error: `Class must have a constructor` };
    }

    // Check for createBody
    if (!code.includes('createBody')) {
        return { valid: false, error: `Class must implement createBody()` };
    }

    // Blacklist dangerous patterns
    const dangerousPatterns = [
        'eval(', 'eval (',
        'Function(',
        'fetch(',
        'XMLHttpRequest',
        'localStorage',
        'sessionStorage',
        'document.cookie',
        'window.location',
        'process.',
        'require(',
        'import(',
        '__proto__',
        'constructor.constructor'
    ];

    for (const pattern of dangerousPatterns) {
        if (code.includes(pattern)) {
            return { valid: false, error: `Code contains forbidden pattern: ${pattern}` };
        }
    }

    return { valid: true };
}

/**
 * Save a new creature definition
 * @param definition The creature definition
 * @param worldId Optional world ID (undefined or 'global' for global creatures)
 */
export async function saveCreature(
    definition: CreatureDefinition,
    worldId?: string
): Promise<{ success: boolean; error?: string }> {
    // Validate
    const validation = validateCreatureCode(definition.name, definition.code);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    const effectiveWorldId = worldId || 'global';
    const cacheKey = getCacheKey(effectiveWorldId, definition.name);

    // Check for duplicate names in this world
    if (creatureCache.has(cacheKey)) {
        return { success: false, error: `Creature '${definition.name}' already exists in this world` };
    }

    // Also check global for name conflicts when saving to a world
    if (effectiveWorldId !== 'global' && creatureCache.has(getCacheKey('global', definition.name))) {
        return { success: false, error: `Creature '${definition.name}' already exists as a global creature` };
    }

    try {
        // Add worldId to definition
        const fullDefinition: CreatureDefinition = {
            ...definition,
            worldId: effectiveWorldId
        };

        // Save to Firebase
        if (db) {
            if (effectiveWorldId === 'global') {
                // Global creatures go to the original collection
                await db.collection('dynamic_creatures').doc(definition.name).set({
                    name: definition.name,
                    code: definition.code,
                    description: definition.description,
                    createdBy: definition.createdBy,
                    createdAt: definition.createdAt,
                    worldId: 'global'
                });
            } else {
                // World-scoped creatures go to a subcollection
                await db.collection('worlds').doc(effectiveWorldId)
                    .collection('creatures').doc(definition.name).set({
                        name: definition.name,
                        code: definition.code,
                        description: definition.description,
                        createdBy: definition.createdBy,
                        createdAt: definition.createdAt,
                        worldId: effectiveWorldId
                    });
            }
        }

        // Add to cache
        creatureCache.set(cacheKey, fullDefinition);

        // Broadcast to clients in the appropriate scope
        broadcastCreatureDefinition(fullDefinition, effectiveWorldId);

        console.log(`[DynamicCreatureService] Saved creature: ${definition.name} (world: ${effectiveWorldId})`);
        return { success: true };
    } catch (e: any) {
        console.error('[DynamicCreatureService] Failed to save creature:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Broadcast creature definition to Socket.IO clients
 * @param definition The creature definition
 * @param worldId The world ID to broadcast to ('global' broadcasts to all)
 */
function broadcastCreatureDefinition(definition: CreatureDefinition, worldId: string) {
    if (io) {
        const payload = {
            name: definition.name,
            code: definition.code,
            description: definition.description,
            worldId: worldId
        };

        if (worldId === 'global') {
            // Global creatures broadcast to everyone
            io.emit('creature_definition', payload);
            console.log(`[DynamicCreatureService] Broadcasted creature globally: ${definition.name}`);
        } else {
            // World-scoped creatures only go to players in that world
            io.to(`world:${worldId}`).emit('creature_definition', payload);
            console.log(`[DynamicCreatureService] Broadcasted creature to world ${worldId}: ${definition.name}`);
        }
    }
}

/**
 * Delete a creature definition
 * @param name Creature name
 * @param worldId Optional world ID (undefined checks global)
 */
export async function deleteCreature(
    name: string,
    worldId?: string
): Promise<{ success: boolean; error?: string }> {
    if (!name) return { success: false, error: 'Name required' };

    const effectiveWorldId = worldId || 'global';
    const cacheKey = getCacheKey(effectiveWorldId, name);

    // Check if exists in dynamic cache
    let dynamicDeleted = false;
    if (creatureCache.has(cacheKey)) {
        try {
            // Delete from Firebase
            if (db) {
                if (effectiveWorldId === 'global') {
                    await db.collection('dynamic_creatures').doc(name).delete();
                } else {
                    await db.collection('worlds').doc(effectiveWorldId)
                        .collection('creatures').doc(name).delete();
                }
            }

            // Remove from cache
            creatureCache.delete(cacheKey);
            dynamicDeleted = true;
            console.log(`[DynamicCreatureService] Deleted dynamic creature: ${name} (world: ${effectiveWorldId})`);
        } catch (e: any) {
            console.error('[DynamicCreatureService] Failed to delete dynamic creature:', e);
            return { success: false, error: e.message };
        }
    }

    // Also check for static file deletion (only for global)
    let staticDeleted = false;
    if (effectiveWorldId === 'global') {
        try {
            const safeName = name.replace(/[^a-zA-Z0-9]/g, '');
            const filename = `${safeName}.js`;

            for (const dir of STATIC_ENTITY_DIRS) {
                const filePath = path.join(dir, filename);
                try {
                    await fs.access(filePath);
                    await fs.unlink(filePath);
                    staticDeleted = true;
                    console.log(`[DynamicCreatureService] Deleted static creature file: ${filePath}`);
                    break;
                } catch (err) {
                    // File doesn't exist in this dir
                }
            }
        } catch (e: any) {
            console.error('[DynamicCreatureService] Failed to check/delete static file:', e);
        }
    }

    if (dynamicDeleted || staticDeleted) {
        // Broadcast deletion
        if (io) {
            const payload = { name, worldId: effectiveWorldId };
            if (effectiveWorldId === 'global') {
                io.emit('creature_deleted', payload);
            } else {
                io.to(`world:${effectiveWorldId}`).emit('creature_deleted', payload);
            }
            console.log(`[DynamicCreatureService] Broadcasted deletion for: ${name} (world: ${effectiveWorldId})`);
        }
        return { success: true };
    } else {
        return { success: false, error: `Creature '${name}' not found in world '${effectiveWorldId}'` };
    }
}

/**
 * Get a creature definition by name
 * @param name Creature name
 * @param worldId Optional world ID (undefined checks global)
 */
export function getCreature(name: string, worldId?: string): CreatureDefinition | undefined {
    const effectiveWorldId = worldId || 'global';

    // First check world-specific
    const worldCreature = creatureCache.get(getCacheKey(effectiveWorldId, name));
    if (worldCreature) return worldCreature;

    // Fall back to global
    if (effectiveWorldId !== 'global') {
        return creatureCache.get(getCacheKey('global', name));
    }

    return undefined;
}

/**
 * Get all creature definitions for a world (includes global creatures)
 * @param worldId World ID (undefined returns only global)
 */
export function getAllCreatures(worldId?: string): CreatureDefinition[] {
    const creatures: CreatureDefinition[] = [];

    for (const [key, creature] of creatureCache) {
        const [creatureWorldId] = key.split(':');

        // Include global creatures
        if (creatureWorldId === 'global') {
            creatures.push(creature);
        }
        // Include world-specific creatures if worldId matches
        else if (worldId && creatureWorldId === worldId) {
            creatures.push(creature);
        }
    }

    return creatures;
}

/**
 * Load all creature definitions from Firebase into cache
 * Called on server startup
 */
export async function loadAllCreatures(): Promise<void> {
    if (!db) {
        console.log('[DynamicCreatureService] No database connection, skipping creature load');
        return;
    }

    try {
        // Load global creatures
        const globalSnapshot = await db.collection('dynamic_creatures').get();

        for (const doc of globalSnapshot.docs) {
            const data = doc.data() as CreatureDefinition;
            data.worldId = 'global';
            creatureCache.set(getCacheKey('global', data.name), data);
        }

        console.log(`[DynamicCreatureService] Loaded ${globalSnapshot.size} global creature definitions`);

        // Note: World-specific creatures are loaded on-demand when players join a world
        // This avoids loading all creatures from all worlds at startup

    } catch (e) {
        console.error('[DynamicCreatureService] Failed to load creatures:', e);
    }
}

/**
 * Load creatures for a specific world into cache
 * @param worldId The world ID to load creatures for
 */
export async function loadWorldCreatures(worldId: string): Promise<void> {
    if (!db || worldId === 'global') return;

    try {
        const snapshot = await db.collection('worlds').doc(worldId)
            .collection('creatures').get();

        for (const doc of snapshot.docs) {
            const data = doc.data() as CreatureDefinition;
            data.worldId = worldId;
            creatureCache.set(getCacheKey(worldId, data.name), data);
        }

        console.log(`[DynamicCreatureService] Loaded ${snapshot.size} creatures for world ${worldId}`);
    } catch (e) {
        console.error(`[DynamicCreatureService] Failed to load creatures for world ${worldId}:`, e);
    }
}

/**
 * Send all cached creature definitions to a specific socket
 * @param socket The socket to send to
 * @param worldId The world the player is joining
 */
export async function sendCreaturesToSocket(socket: any, worldId?: string): Promise<void> {
    // Ensure world-specific creatures are loaded
    if (worldId && worldId !== 'global') {
        await loadWorldCreatures(worldId);
    }

    const creatures = getAllCreatures(worldId);
    if (creatures.length > 0) {
        socket.emit('creatures_initial', creatures.map(c => ({
            name: c.name,
            code: c.code,
            description: c.description,
            worldId: c.worldId
        })));
        console.log(`[DynamicCreatureService] Sent ${creatures.length} creature definitions to client (world: ${worldId || 'global'})`);
    }
}
