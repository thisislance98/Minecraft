/**
 * DynamicItemService - Manages dynamically created item definitions
 * 
 * Handles:
 * 1. Validation of item code structure
 * 2. Persistence to Firebase
 * 3. Broadcasting to connected clients
 * 4. Loading from database on startup
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
}

// In-memory cache of item definitions
const itemCache = new Map<string, ItemDefinition>();

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
 */
export async function saveItem(definition: Partial<ItemDefinition>): Promise<{ success: boolean; error?: string }> {
    const { name, code, icon, description } = definition;

    if (!name || !code || !icon) {
        return { success: false, error: 'Missing required fields: name, code, icon' };
    }

    // Validate name format
    if (!/^[A-Z][a-zA-Z0-9]*Item$/.test(name)) {
        return { success: false, error: 'Name must be PascalCase ending with "Item" (e.g., TeleportWandItem)' };
    }

    // Check for duplicate
    if (itemCache.has(name)) {
        return { success: false, error: `Item '${name}' already exists` };
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
        updatedAt: now
    };

    try {
        // Save to Firebase
        await db!.collection('dynamic_items').doc(name).set(fullDefinition);
        console.log(`[DynamicItemService] Saved item '${name}' to database`);

        // Add to cache
        itemCache.set(name, fullDefinition);

        // Broadcast to all connected clients
        broadcastItemDefinition(fullDefinition);

        return { success: true };
    } catch (e: any) {
        console.error(`[DynamicItemService] Failed to save item:`, e);
        return { success: false, error: e.message };
    }
}

/**
 * Broadcast item definition to all connected Socket.IO clients
 */
export function broadcastItemDefinition(definition: ItemDefinition): void {
    if (io) {
        io.emit('item_definition', {
            name: definition.name,
            code: definition.code,
            icon: definition.icon,
            description: definition.description
        });
        console.log(`[DynamicItemService] Broadcast item '${definition.name}' to all clients`);
    }
}

/**
 * Delete an item definition
 */
export async function deleteItem(name: string): Promise<{ success: boolean; error?: string }> {
    if (!name) return { success: false, error: 'Name required' };

    // Check if exists in dynamic cache
    let dynamicDeleted = false;
    if (itemCache.has(name)) {
        try {
            // Delete from Firebase
            if (db) {
                await db.collection('dynamic_items').doc(name).delete();
            }

            // Remove from cache
            itemCache.delete(name);
            dynamicDeleted = true;
        } catch (e: any) {
            console.error('[DynamicItemService] Failed to delete item:', e);
            return { success: false, error: e.message };
        }
    }

    // Also check for static file deletion
    let staticDeleted = false;
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
            // File not found, ignore
        }
    } catch (e) {
        console.error('[DynamicItemService] Error handling static file:', e);
    }

    if (dynamicDeleted || staticDeleted) {
        // Broadcast deletion
        if (io) {
            io.emit('item_deleted', { name });
            console.log(`[DynamicItemService] Deleted and broadcasted item: ${name}`);
        }
        return { success: true };
    } else {
        return { success: false, error: `Item '${name}' not found` };
    }
}

/**
 * Get an item definition by name
 */
export function getItem(name: string): ItemDefinition | undefined {
    return itemCache.get(name);
}

/**
 * Get all item definitions
 */
export function getAllItems(): ItemDefinition[] {
    return Array.from(itemCache.values());
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
        const snapshot = await db.collection('dynamic_items').get();

        for (const doc of snapshot.docs) {
            const data = doc.data() as ItemDefinition;
            itemCache.set(data.name, data);
        }

        console.log(`[DynamicItemService] Loaded ${itemCache.size} item definitions from database`);
    } catch (e) {
        console.error('[DynamicItemService] Failed to load items from database:', e);
    }
}

/**
 * Send all cached items to a newly connected client
 */
export function sendItemsToSocket(socket: any): void {
    const items = getAllItems();
    if (items.length > 0) {
        socket.emit('items_initial', items.map(item => ({
            name: item.name,
            code: item.code,
            icon: item.icon,
            description: item.description
        })));
        console.log(`[DynamicItemService] Sent ${items.length} item(s) to client ${socket.id}`);
    }
}
