/**
 * DynamicItemService - Manages dynamically created item definitions
 *
 * Handles:
 * 1. Validation of item code structure
 * 2. Persistence to Firebase (world-scoped or global)
 * 3. Broadcasting to connected clients in the same world
 * 4. Loading from database on startup
 *
 * Items can be:
 * - Global (worldId = 'global') - available in all worlds
 * - World-scoped (worldId = specific world ID) - only available in that world
 */

import { db } from '../config';
import { io } from '../index';
import * as fs from 'fs/promises';
import * as path from 'path';

// Define path to static items directory relative to this service file
const STATIC_ITEM_DIR = path.join(__dirname, '../../src/game/items');

export interface ItemDefinition {
    name: string;       // PascalCase class name (e.g., "TeleportWandItem")
    code: string;       // Full JavaScript class definition
    icon: string;       // SVG string for inventory icon
    description: string;
    createdAt: number;
    updatedAt: number;
    worldId?: string;   // World ID (undefined or 'global' for global items)
}

// In-memory cache of item definitions
// Key format: "worldId:itemName"
const itemCache = new Map<string, ItemDefinition>();

// Helper to get cache key
function getCacheKey(worldId: string | undefined, name: string): string {
    return `${worldId || 'global'}:${name}`;
}

// Dangerous patterns to block in item code
const DANGEROUS_PATTERNS = [
    /\beval\s*\(/,
    /\bFunction\s*\(/,
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /\bdocument\.cookie\b/,
    /\bprocess\./,
    /\brequire\s*\(/,
    /\bimport\s*\(/,
    /\b__proto__\b/,
    /\bconstructor\.constructor\b/,
    /\bwindow\.open\b/,
    /\bwindow\.location\b/,
];

/**
 * Validate item code for safety and structure
 */
export function validateItemCode(name: string, code: string): { valid: boolean; error?: string } {
    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(code)) {
            return { valid: false, error: `Code contains forbidden pattern: ${pattern.source}` };
        }
    }

    // Check class declaration
    const classPattern = new RegExp(`class\\s+${name}\\s+extends\\s+(Item|WandItem)\\s*\\{`);
    if (!classPattern.test(code)) {
        return { valid: false, error: `Code must define 'class ${name} extends Item' or 'extends WandItem'` };
    }

    // Check for constructor
    if (!/constructor\s*\([^)]*\)\s*\{/.test(code)) {
        return { valid: false, error: 'Class must have a constructor' };
    }

    // Check for super() call
    if (!/super\s*\(/.test(code)) {
        return { valid: false, error: 'Constructor must call super()' };
    }

    return { valid: true };
}

/**
 * Validate SVG icon
 */
export function validateIcon(icon: string): { valid: boolean; error?: string } {
    if (!icon || typeof icon !== 'string') {
        return { valid: false, error: 'Icon must be a valid SVG string' };
    }

    if (!icon.trim().startsWith('<svg') || !icon.includes('</svg>')) {
        return { valid: false, error: 'Icon must be a valid SVG element' };
    }

    // Check for script tags or event handlers in SVG
    if (/<script/i.test(icon) || /on\w+\s*=/i.test(icon)) {
        return { valid: false, error: 'SVG cannot contain scripts or event handlers' };
    }

    return { valid: true };
}

/**
 * Save a new item definition
 * @param definition The item definition
 * @param worldId Optional world ID (undefined or 'global' for global items)
 */
export async function saveItem(
    definition: Partial<ItemDefinition>,
    worldId?: string
): Promise<{ success: boolean; error?: string }> {
    const { name, code, icon, description } = definition;

    if (!name || !code || !icon) {
        return { success: false, error: 'Missing required fields: name, code, icon' };
    }

    // Validate name format
    if (!/^[A-Z][a-zA-Z0-9]*Item$/.test(name)) {
        return { success: false, error: 'Name must be PascalCase ending with "Item" (e.g., TeleportWandItem)' };
    }

    const effectiveWorldId = worldId || 'global';
    const cacheKey = getCacheKey(effectiveWorldId, name);

    // Check for duplicate in this world
    if (itemCache.has(cacheKey)) {
        return { success: false, error: `Item '${name}' already exists in this world` };
    }

    // Check global for conflicts when saving to a world
    if (effectiveWorldId !== 'global' && itemCache.has(getCacheKey('global', name))) {
        return { success: false, error: `Item '${name}' already exists as a global item` };
    }

    // Validate code
    const codeValidation = validateItemCode(name, code);
    if (!codeValidation.valid) {
        return { success: false, error: codeValidation.error };
    }

    // Validate icon
    const iconValidation = validateIcon(icon);
    if (!iconValidation.valid) {
        return { success: false, error: iconValidation.error };
    }

    const now = Date.now();
    const fullDefinition: ItemDefinition = {
        name,
        code,
        icon,
        description: description || '',
        createdAt: now,
        updatedAt: now,
        worldId: effectiveWorldId
    };

    try {
        // Save to Firebase
        if (db) {
            if (effectiveWorldId === 'global') {
                await db.collection('dynamic_items').doc(name).set(fullDefinition);
            } else {
                await db.collection('worlds').doc(effectiveWorldId)
                    .collection('items').doc(name).set(fullDefinition);
            }
        }
        console.log(`[DynamicItemService] Saved item '${name}' to database (world: ${effectiveWorldId})`);

        // Add to cache
        itemCache.set(cacheKey, fullDefinition);

        // Broadcast to clients in the appropriate scope
        broadcastItemDefinition(fullDefinition, effectiveWorldId);

        return { success: true };
    } catch (e: any) {
        console.error(`[DynamicItemService] Failed to save item:`, e);
        return { success: false, error: e.message };
    }
}

/**
 * Broadcast item definition to Socket.IO clients
 * @param definition The item definition
 * @param worldId The world ID to broadcast to ('global' broadcasts to all)
 */
export function broadcastItemDefinition(definition: ItemDefinition, worldId: string): void {
    if (io) {
        const payload = {
            name: definition.name,
            code: definition.code,
            icon: definition.icon,
            description: definition.description,
            worldId: worldId
        };

        if (worldId === 'global') {
            io.emit('item_definition', payload);
            console.log(`[DynamicItemService] Broadcast item globally: ${definition.name}`);
        } else {
            io.to(`world:${worldId}`).emit('item_definition', payload);
            console.log(`[DynamicItemService] Broadcast item to world ${worldId}: ${definition.name}`);
        }
    }
}

/**
 * Delete an item definition
 * @param name Item name
 * @param worldId Optional world ID
 */
export async function deleteItem(
    name: string,
    worldId?: string
): Promise<{ success: boolean; error?: string }> {
    if (!name) return { success: false, error: 'Name required' };

    const effectiveWorldId = worldId || 'global';
    const cacheKey = getCacheKey(effectiveWorldId, name);

    // Check if exists in dynamic cache
    let dynamicDeleted = false;
    if (itemCache.has(cacheKey)) {
        try {
            // Delete from Firebase
            if (db) {
                if (effectiveWorldId === 'global') {
                    await db.collection('dynamic_items').doc(name).delete();
                } else {
                    await db.collection('worlds').doc(effectiveWorldId)
                        .collection('items').doc(name).delete();
                }
            }

            // Remove from cache
            itemCache.delete(cacheKey);
            dynamicDeleted = true;
            console.log(`[DynamicItemService] Deleted dynamic item: ${name} (world: ${effectiveWorldId})`);
        } catch (e: any) {
            console.error('[DynamicItemService] Failed to delete item:', e);
            return { success: false, error: e.message };
        }
    }

    // Also check for static file deletion (only for global)
    let staticDeleted = false;
    if (effectiveWorldId === 'global') {
        try {
            const safeName = name.replace(/[^a-zA-Z0-9]/g, '');
            const filename = `${safeName}.js`;
            const filePath = path.join(STATIC_ITEM_DIR, filename);

            try {
                await fs.access(filePath);
                await fs.unlink(filePath);
                staticDeleted = true;
                console.log(`[DynamicItemService] Deleted static item file: ${filePath}`);
            } catch (err) {
                // File not found
            }
        } catch (e) {
            console.error('[DynamicItemService] Error handling static file:', e);
        }
    }

    if (dynamicDeleted || staticDeleted) {
        // Broadcast deletion
        if (io) {
            const payload = { name, worldId: effectiveWorldId };
            if (effectiveWorldId === 'global') {
                io.emit('item_deleted', payload);
            } else {
                io.to(`world:${effectiveWorldId}`).emit('item_deleted', payload);
            }
            console.log(`[DynamicItemService] Deleted and broadcasted item: ${name} (world: ${effectiveWorldId})`);
        }
        return { success: true };
    } else {
        return { success: false, error: `Item '${name}' not found in world '${effectiveWorldId}'` };
    }
}

/**
 * Get an item definition by name
 * @param name Item name
 * @param worldId Optional world ID
 */
export function getItem(name: string, worldId?: string): ItemDefinition | undefined {
    const effectiveWorldId = worldId || 'global';

    // First check world-specific
    const worldItem = itemCache.get(getCacheKey(effectiveWorldId, name));
    if (worldItem) return worldItem;

    // Fall back to global
    if (effectiveWorldId !== 'global') {
        return itemCache.get(getCacheKey('global', name));
    }

    return undefined;
}

/**
 * Get all item definitions for a world (includes global items)
 * @param worldId World ID (undefined returns only global)
 */
export function getAllItems(worldId?: string): ItemDefinition[] {
    const items: ItemDefinition[] = [];

    for (const [key, item] of itemCache) {
        const [itemWorldId] = key.split(':');

        // Include global items
        if (itemWorldId === 'global') {
            items.push(item);
        }
        // Include world-specific items if worldId matches
        else if (worldId && itemWorldId === worldId) {
            items.push(item);
        }
    }

    return items;
}

/**
 * Load all items from database on server startup
 */
export async function loadAllItems(): Promise<void> {
    if (!db) {
        console.warn('[DynamicItemService] Database not initialized, skipping item load');
        return;
    }
    try {
        // Load global items
        const snapshot = await db.collection('dynamic_items').get();

        for (const doc of snapshot.docs) {
            const data = doc.data() as ItemDefinition;
            data.worldId = 'global';
            itemCache.set(getCacheKey('global', data.name), data);
        }

        console.log(`[DynamicItemService] Loaded ${snapshot.size} global item definitions`);

        // Note: World-specific items are loaded on-demand when players join a world

    } catch (e) {
        console.error('[DynamicItemService] Failed to load items from database:', e);
    }
}

/**
 * Load items for a specific world into cache
 * @param worldId The world ID to load items for
 */
export async function loadWorldItems(worldId: string): Promise<void> {
    if (!db || worldId === 'global') return;

    try {
        const snapshot = await db.collection('worlds').doc(worldId)
            .collection('items').get();

        for (const doc of snapshot.docs) {
            const data = doc.data() as ItemDefinition;
            data.worldId = worldId;
            itemCache.set(getCacheKey(worldId, data.name), data);
        }

        console.log(`[DynamicItemService] Loaded ${snapshot.size} items for world ${worldId}`);
    } catch (e) {
        console.error(`[DynamicItemService] Failed to load items for world ${worldId}:`, e);
    }
}

/**
 * Send all cached items to a newly connected client
 * @param socket The socket to send to
 * @param worldId The world the player is joining
 */
export async function sendItemsToSocket(socket: any, worldId?: string): Promise<void> {
    // Ensure world-specific items are loaded
    if (worldId && worldId !== 'global') {
        await loadWorldItems(worldId);
    }

    const items = getAllItems(worldId);
    if (items.length > 0) {
        socket.emit('items_initial', items.map(item => ({
            name: item.name,
            code: item.code,
            icon: item.icon,
            description: item.description,
            worldId: item.worldId
        })));
        console.log(`[DynamicItemService] Sent ${items.length} item(s) to client (world: ${worldId || 'global'})`);
    }
}
