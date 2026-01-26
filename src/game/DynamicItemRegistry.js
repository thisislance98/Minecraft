/**
 * DynamicItemRegistry - Handles client-side registration of dynamic items
 *
 * Receives item definitions from the server and:
 * 1. Evaluates the code safely using Function constructor
 * 2. Registers the item class in ItemClasses
 * 3. Stores SVG icons for inventory display
 * 4. Registers instance with ItemManager so the item can be used
 */

import { ItemClasses } from './ItemRegistry.js';
import { Item } from './items/Item.js';
import { WandItem } from './items/WandItem.js';
import * as THREE from 'three';

// Store dynamic item definitions
export const DynamicItems = {};

// Store custom icons for dynamic items (keyed by item id, e.g., 'teleport_wand')
export const DynamicItemIcons = {};

// Expose to window for testing/debugging
window.DynamicItems = DynamicItems;
window.DynamicItemIcons = DynamicItemIcons;

// Reference to the game's ItemManager (set via setItemManager)
let itemManagerRef = null;

/**
 * Set the ItemManager reference so we can register item instances
 * @param {ItemManager} manager
 */
export function setItemManager(manager) {
    itemManagerRef = manager;
    console.log('[DynamicItemRegistry] ItemManager reference set');
}

/**
 * Register a dynamic item class from a definition
 * @param {Object} definition - { name, code, icon, description }
 */
export function registerDynamicItem(definition) {
    const { name, code, icon, description } = definition;

    if (!name || !code) {
        console.error('[DynamicItemRegistry] Invalid definition - missing name or code');
        return false;
    }

    // Check if already registered
    if (ItemClasses[name]) {
        console.log(`[DynamicItemRegistry] Item '${name}' already registered, skipping`);
        return true;
    }

    try {
        // Create the class using Function constructor with controlled scope
        // We provide THREE, Item, and WandItem for the code to use
        const createClass = new Function('THREE', 'Item', 'WandItem', `
            ${code}
            return ${name};
        `);

        // Execute to get the class
        const ItemClass = createClass(THREE, Item, WandItem);

        // Validate the class
        if (typeof ItemClass !== 'function') {
            console.error(`[DynamicItemRegistry] Failed to create class '${name}' - result is not a function`);
            return false;
        }

        // Verify it extends Item or WandItem
        const testInstance = new ItemClass();
        if (!(testInstance instanceof Item)) {
            console.error(`[DynamicItemRegistry] Class '${name}' does not extend Item`);
            return false;
        }

        // Register in ItemClasses
        ItemClasses[name] = ItemClass;

        // Store in DynamicItems for reference
        DynamicItems[name] = {
            class: ItemClass,
            definition: definition
        };

        // Extract the item id from the instance
        const itemId = testInstance.id;

        // Store the SVG icon if provided
        if (icon) {
            DynamicItemIcons[itemId] = icon;
            console.log(`[DynamicItemRegistry] Stored icon for item id '${itemId}'`);
        }

        // CRITICAL: Register the instance with ItemManager so the item can be used!
        // This is what makes onUseDown/onPrimaryDown work
        // BUT: Do NOT overwrite existing items with the same ID (protect core items like 'wand')
        if (itemManagerRef) {
            const existingItem = itemManagerRef.getItem(itemId);
            if (existingItem) {
                console.log(`[DynamicItemRegistry] ⚠️ Item id '${itemId}' already exists in ItemManager, skipping registration to prevent overwrite`);
            } else {
                itemManagerRef.register(testInstance);
                console.log(`[DynamicItemRegistry] ✅ Registered item instance '${itemId}' with ItemManager (isTool: ${testInstance.isTool})`);
            }
        } else {
            console.warn(`[DynamicItemRegistry] ⚠️ No ItemManager reference - item '${itemId}' won't be usable until game restart`);
            // Try to get it from window.__VOXEL_GAME__ as fallback
            if (window.__VOXEL_GAME__?.itemManager) {
                const existingItem = window.__VOXEL_GAME__.itemManager.getItem(itemId);
                if (existingItem) {
                    console.log(`[DynamicItemRegistry] ⚠️ Item id '${itemId}' already exists, skipping`);
                } else {
                    window.__VOXEL_GAME__.itemManager.register(testInstance);
                    console.log(`[DynamicItemRegistry] ✅ Registered item instance '${itemId}' via window.__VOXEL_GAME__.itemManager`);
                }
            }
        }

        console.log(`[DynamicItemRegistry] ✅ Registered item: ${name}`);
        return true;

    } catch (error) {
        console.error(`[DynamicItemRegistry] Failed to register '${name}':`, error);
        return false;
    }
}

/**
 * Register multiple items (used for initial batch loading)
 * @param {Array} definitions - Array of item definitions
 */
export function registerMultipleItems(definitions) {
    if (!Array.isArray(definitions)) {
        console.error('[DynamicItemRegistry] Expected array of definitions');
        return;
    }

    let successCount = 0;
    for (const definition of definitions) {
        if (registerDynamicItem(definition)) {
            successCount++;
        }
    }

    console.log(`[DynamicItemRegistry] Loaded ${successCount} dynamic item(s)`);
}

/**
 * Get the SVG icon for a dynamic item
 * @param {string} itemId - The item id (e.g., 'teleport_wand')
 * @returns {string|null} The SVG string or null if not found
 */
export function getDynamicItemIcon(itemId) {
    return DynamicItemIcons[itemId] || null;
}

/**
 * Check if an item is a dynamic item
 * @param {string} name - The item class name
 * @returns {boolean}
 */
export function isDynamicItem(name) {
    return name in DynamicItems;
}
