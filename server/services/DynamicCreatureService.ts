/**
 * DynamicCreatureService - Manages dynamic creature definitions
 * 
 * Handles:
 * 1. Storing creature definitions in Firebase
 * 2. Broadcasting new definitions to all connected clients
 * 3. Loading persisted creatures on server startup
 */

import { db } from '../config';
import { io } from '../index';
import * as fs from 'fs/promises';
import * as path from 'path';

// Define paths to static entity directories relative to this service file
// Service is in /server/services/, so we go up twice to root, then into src/game/entities
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
}

// In-memory cache of all creature definitions
const creatureCache = new Map<string, CreatureDefinition>();

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
 */
export async function saveCreature(definition: CreatureDefinition): Promise<{ success: boolean; error?: string }> {
    // Validate
    const validation = validateCreatureCode(definition.name, definition.code);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    // Check for duplicate names
    if (creatureCache.has(definition.name)) {
        return { success: false, error: `Creature '${definition.name}' already exists` };
    }

    try {
        // Save to Firebase
        if (db) {
            await db.collection('dynamic_creatures').doc(definition.name).set({
                name: definition.name,
                code: definition.code,
                description: definition.description,
                createdBy: definition.createdBy,
                createdAt: definition.createdAt
            });
        }

        // Add to cache
        creatureCache.set(definition.name, definition);

        // Broadcast to all connected clients
        broadcastCreatureDefinition(definition);

        console.log(`[DynamicCreatureService] Saved creature: ${definition.name}`);
        return { success: true };
    } catch (e: any) {
        console.error('[DynamicCreatureService] Failed to save creature:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Broadcast creature definition to all connected Socket.IO clients
 */
function broadcastCreatureDefinition(definition: CreatureDefinition) {
    if (io) {
        io.emit('creature_definition', {
            name: definition.name,
            code: definition.code,
            description: definition.description
        });
        console.log(`[DynamicCreatureService] Broadcasted creature definition: ${definition.name}`);
    }
}

/**
 * Delete a creature definition
 */
export async function deleteCreature(name: string): Promise<{ success: boolean; error?: string }> {
    if (!name) return { success: false, error: 'Name required' };

    // Check if exists in dynamic cache
    let dynamicDeleted = false;
    if (creatureCache.has(name)) {
        try {
            // Delete from Firebase
            if (db) {
                await db.collection('dynamic_creatures').doc(name).delete();
            }

            // Remove from cache
            creatureCache.delete(name);
            dynamicDeleted = true;
            console.log(`[DynamicCreatureService] Deleted dynamic creature: ${name}`);
        } catch (e: any) {
            console.error('[DynamicCreatureService] Failed to delete dynamic creature:', e);
            return { success: false, error: e.message };
        }
    }

    // Also check for static file deletion
    let staticDeleted = false;
    try {
        // Sanitize name to prevent directory traversal
        const safeName = name.replace(/[^a-zA-Z0-9]/g, '');
        const filename = `${safeName}.js`;

        for (const dir of STATIC_ENTITY_DIRS) {
            const filePath = path.join(dir, filename);
            try {
                // Check if file exists
                await fs.access(filePath);
                // If we get here, it exists. Delete it.
                await fs.unlink(filePath);
                staticDeleted = true;
                console.log(`[DynamicCreatureService] Deleted static creature file: ${filePath}`);
                // Stop after finding one matching file (assuming unique class names across folders)
                break;
            } catch (err) {
                // File doesn't exist in this dir, continue
            }
        }
    } catch (e: any) {
        console.error('[DynamicCreatureService] Failed to check/delete static file:', e);
        // If we failed to delete a static file but it Was static execution, we should probably report error
        // But if we already deleted dynamic, maybe partial success?
    }

    if (dynamicDeleted || staticDeleted) {
        // Broadcast deletion
        if (io) {
            io.emit('creature_deleted', { name });
            console.log(`[DynamicCreatureService] Broadcasted deletion for: ${name}`);
        }
        return { success: true };
    } else {
        return { success: false, error: `Creature '${name}' not found in dynamic registry or static files.` };
    }
}

/**
 * Get a creature definition by name
 */
export function getCreature(name: string): CreatureDefinition | undefined {
    return creatureCache.get(name);
}

/**
 * Get all creature definitions
 */
export function getAllCreatures(): CreatureDefinition[] {
    return Array.from(creatureCache.values());
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
        const snapshot = await db.collection('dynamic_creatures').get();

        for (const doc of snapshot.docs) {
            const data = doc.data() as CreatureDefinition;
            creatureCache.set(data.name, data);
        }

        console.log(`[DynamicCreatureService] Loaded ${creatureCache.size} creature definitions from database`);
    } catch (e) {
        console.error('[DynamicCreatureService] Failed to load creatures:', e);
    }
}

/**
 * Send all cached creature definitions to a specific socket (for new connections)
 */
export function sendCreaturesToSocket(socket: any): void {
    const creatures = getAllCreatures();
    if (creatures.length > 0) {
        socket.emit('creatures_initial', creatures.map(c => ({
            name: c.name,
            code: c.code,
            description: c.description
        })));
        console.log(`[DynamicCreatureService] Sent ${creatures.length} creature definitions to new client`);
    }
}
