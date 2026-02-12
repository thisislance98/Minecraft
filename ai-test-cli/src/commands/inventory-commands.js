/**
 * Inventory Commands
 *
 * Extracted from game-commands.js for better organization
 */

import chalk from 'chalk';

/**
 * Execute a command in the browser and return the result
 */
async function executeInBrowser(browser, fn, ...args) {
    return await browser.evaluate(fn, ...args);
}

/**
 * Get player's current held item
 */
export async function getHeldItem(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.inventoryManager) return null;
        const slot = game.inventoryManager.getSelectedItem();
        return slot ? { item: slot.item, count: slot.count, type: slot.type } : null;
    });
}

/**
 * Give an item to the player
 */
export async function giveItem(browser, itemName, count = 1) {
    return await executeInBrowser(browser, (name, cnt) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.inventoryManager) return { error: 'Game not ready' };

        const success = game.inventoryManager.addItem(name, cnt, 'item');
        return { success, item: name, count: cnt };
    }, itemName, count);
}

/**
 * Select a hotbar slot (0-8)
 */
export async function selectSlot(browser, slotIndex) {
    return await executeInBrowser(browser, (index) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.inventoryManager) return { error: 'Game not ready' };

        game.inventoryManager.selectSlot(index);
        const slot = game.inventoryManager.getSelectedItem();
        return { selectedSlot: index, item: slot?.item || null };
    }, slotIndex);
}

/**
 * Find an item in inventory and select its slot
 */
export async function equipItem(browser, itemName) {
    return await executeInBrowser(browser, (name) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.inventoryManager) return { error: 'Game not ready' };

        // Find slot with item
        const slotIndex = game.inventoryManager.slots.findIndex(s => s && s.item === name);
        if (slotIndex === -1) return { error: `Item '${name}' not found in inventory` };

        game.inventoryManager.selectSlot(slotIndex);
        return { success: true, item: name, slot: slotIndex };
    }, itemName);
}

/**
 * Use the currently selected item (simulate right-click)
 */
export async function useSelectedItem(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.inventoryManager) return { error: 'Game not ready' };

        const slot = game.inventoryManager.getSelectedItem();
        if (!slot?.item) return { error: 'No item selected' };

        // Try to use the item
        const result = game.inventoryManager.useSelected();
        return { used: true, item: slot.item, result };
    });
}

/**
 * Get inventory contents
 */
export async function getInventory(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.inventoryManager) return { error: 'Game not ready' };

        const slots = [];
        for (let i = 0; i < 63; i++) {
            const slot = game.inventoryManager.getSlot(i);
            if (slot?.item) {
                slots.push({ index: i, item: slot.item, count: slot.count, type: slot.type });
            }
        }
        return { slots, selectedSlot: game.inventoryManager.selectedSlot };
    });
}

/**
 * Print inventory
 */
export function printInventory(inv) {
    console.log(chalk.blue('\n═══ Inventory ═══'));
    console.log(`Selected Slot: ${inv.selectedSlot}`);
    if (inv.slots.length === 0) {
        console.log(chalk.dim('  (empty)'));
    } else {
        for (const slot of inv.slots) {
            const marker = slot.index === inv.selectedSlot ? chalk.green('→') : ' ';
            console.log(`${marker} [${slot.index}] ${slot.item} x${slot.count}`);
        }
    }
}

/**
 * Open inventory UI
 */
export async function openInventory(browser) {
    await browser.page.keyboard.press('KeyE');
    await new Promise(r => setTimeout(r, 200));

    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        const isOpen = game?.inventory?.isInventoryOpen ||
                       !document.getElementById('inventory-screen')?.classList.contains('hidden');
        return { success: true, inventoryOpen: isOpen };
    });
}

/**
 * Close inventory UI
 */
export async function closeInventory(browser) {
    await browser.page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 200));

    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        const isOpen = game?.inventory?.isInventoryOpen ||
                       !document.getElementById('inventory-screen')?.classList.contains('hidden');
        return { success: true, inventoryClosed: !isOpen };
    });
}

/**
 * Drop the currently held item
 */
export async function dropItem(browser) {
    await browser.page.keyboard.press('KeyQ');
    await new Promise(r => setTimeout(r, 100));

    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.inventoryManager) return { error: 'Game not ready' };

        const slot = game.inventoryManager.getSelectedItem();
        return {
            success: true,
            action: 'drop',
            remainingItem: slot?.item || null,
            remainingCount: slot?.count || 0
        };
    });
}

/**
 * Check if an item exists in the player's inventory
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} itemName - The item name to check for
 * @returns {Object} Result with found status, slot index, and count
 */
export async function checkItemInInventory(browser, itemName) {
    return await executeInBrowser(browser, (name) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.inventoryManager) return { error: 'Game not ready' };

        const inv = game.inventoryManager;
        const searchName = name.toLowerCase();

        // Search all slots
        const results = [];
        let totalCount = 0;

        for (let i = 0; i < 63; i++) {
            const slot = inv.getSlot(i);
            if (slot && slot.item) {
                const slotItem = slot.item.toLowerCase();
                if (slotItem === searchName || slotItem.includes(searchName)) {
                    results.push({
                        slot: i,
                        item: slot.item,
                        count: slot.count,
                        type: slot.type,
                        isHotbar: i < 9
                    });
                    totalCount += slot.count;
                }
            }
        }

        return {
            found: results.length > 0,
            itemName: name,
            totalCount,
            slots: results,
            slotCount: results.length
        };
    }, itemName);
}

/**
 * Check if an item has an icon defined in the UI
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} itemName - The item name to check
 * @returns {Object} Result with icon availability info
 */
export async function checkItemIcon(browser, itemName) {
    return await executeInBrowser(browser, (name) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.inventory) return { error: 'Game not ready' };

        const inventory = game.inventory;
        const searchName = name.toLowerCase();

        // Get the icon HTML for this item
        const iconHtml = inventory.getItemIcon(searchName);

        // Check if it's a custom icon (not the default fallback)
        const isDefaultIcon = iconHtml && iconHtml.includes('#7B5B3C') && iconHtml.includes('#A0A0A0');

        // Check dynamic item icons
        const DynamicItemIcons = window.DynamicItemIcons || {};
        const hasDynamicIcon = searchName in DynamicItemIcons;

        // Check if icon looks like a valid SVG
        const hasValidSvg = iconHtml && iconHtml.includes('<svg') && iconHtml.includes('</svg>');

        return {
            itemName: name,
            hasIcon: !isDefaultIcon && hasValidSvg,
            isDefaultIcon,
            hasDynamicIcon,
            iconType: hasDynamicIcon ? 'dynamic' : (isDefaultIcon ? 'default' : 'built-in'),
            iconPreview: iconHtml ? iconHtml.substring(0, 100) + '...' : null
        };
    }, itemName);
}

/**
 * Check if an item has a 3D mesh defined
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} itemId - The item ID to check
 * @returns {Object} Result with mesh availability info
 */
export async function checkItemMesh(browser, itemId) {
    return await executeInBrowser(browser, (id) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.itemManager) return { error: 'Game not ready' };

        const item = game.itemManager.getItem(id);
        if (!item) {
            return {
                itemId: id,
                found: false,
                hasMesh: false,
                error: `Item '${id}' not found in ItemManager`
            };
        }

        // Check if item has a getMesh method
        const hasGetMesh = typeof item.getMesh === 'function';

        let meshInfo = null;
        let meshError = null;

        if (hasGetMesh) {
            try {
                const mesh = item.getMesh();
                meshInfo = {
                    type: mesh?.type || 'unknown',
                    isObject3D: mesh && typeof mesh.isObject3D !== 'undefined',
                    isMesh: mesh && mesh.isMesh === true,
                    hasGeometry: mesh && !!mesh.geometry,
                    hasMaterial: mesh && !!mesh.material,
                    geometryType: mesh?.geometry?.type || null,
                    childCount: mesh?.children?.length || 0
                };
            } catch (e) {
                meshError = e.message;
            }
        }

        return {
            itemId: id,
            found: true,
            itemName: item.name,
            itemClass: item.constructor.name,
            hasGetMesh,
            hasMesh: meshInfo !== null && !meshError,
            meshInfo,
            meshError,
            isTool: item.isTool || false
        };
    }, itemId);
}

/**
 * Check if an item is registered with the ItemManager
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} itemId - The item ID to check
 * @returns {Object} Result with registration info
 */
export async function checkItemRegistered(browser, itemId) {
    return await executeInBrowser(browser, (id) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.itemManager) return { error: 'Game not ready' };

        const item = game.itemManager.getItem(id);
        const ItemClasses = window.ItemClasses || {};
        const DynamicItems = window.DynamicItems || {};

        // Check if class exists
        const className = id.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('') + 'Item';
        const hasClass = className in ItemClasses;
        const isDynamic = id in (DynamicItems) || Object.values(DynamicItems).some(d => d.definition?.name === className);

        return {
            itemId: id,
            isRegistered: !!item,
            hasClass,
            isDynamic,
            className: item ? item.constructor.name : className,
            itemInfo: item ? {
                id: item.id,
                name: item.name,
                maxStack: item.maxStack,
                isTool: item.isTool
            } : null
        };
    }, itemId);
}

/**
 * Get comprehensive info about an item
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} itemId - The item ID
 * @returns {Object} Comprehensive item information
 */
export async function getItemInfo(browser, itemId) {
    const [registration, mesh, icon, inventory] = await Promise.all([
        checkItemRegistered(browser, itemId),
        checkItemMesh(browser, itemId),
        checkItemIcon(browser, itemId),
        checkItemInInventory(browser, itemId)
    ]);

    return {
        itemId,
        registration,
        mesh,
        icon,
        inventory,
        summary: {
            isRegistered: registration.isRegistered,
            hasMesh: mesh.hasMesh,
            hasIcon: icon.hasIcon,
            inInventory: inventory.found,
            totalInInventory: inventory.totalCount || 0
        }
    };
}

/**
 * List all registered items with their status
 * @param {Object} browser - Puppeteer browser instance
 * @returns {Object} List of all items with status info
 */
export async function listAllItems(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.itemManager) return { error: 'Game not ready' };

        const items = [];
        const ItemClasses = window.ItemClasses || {};
        const DynamicItems = window.DynamicItems || {};
        const DynamicItemIcons = window.DynamicItemIcons || {};

        // Get all registered item instances
        game.itemManager.items.forEach((item, id) => {
            // Skip items without valid id
            if (!id || typeof id !== 'string') return;

            items.push({
                id,
                name: item.name || id,
                className: item.constructor.name,
                isTool: item.isTool || false,
                maxStack: item.maxStack || 64,
                isDynamic: id in DynamicItems || Object.values(DynamicItems).some(d =>
                    d.class?.prototype?.constructor?.name === item.constructor.name
                ),
                hasCustomIcon: id in DynamicItemIcons
            });
        });

        // Sort safely - handle any undefined values
        items.sort((a, b) => {
            const idA = a.id || '';
            const idB = b.id || '';
            return idA.localeCompare(idB);
        });

        return {
            totalItems: items.length,
            items,
            dynamicItemCount: Object.keys(DynamicItems).length,
            itemClassCount: Object.keys(ItemClasses).length
        };
    });
}

/**
 * Print formatted item info to console
 * @param {Object} info - Item info object from getItemInfo
 */
export function printItemInfo(info) {
    console.log(chalk.blue(`\n═══ Item Info: ${info.itemId} ═══`));

    console.log(chalk.cyan('\n📋 Registration:'));
    console.log(`   Registered: ${info.registration.isRegistered ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`   Class: ${info.registration.className || 'N/A'}`);
    console.log(`   Dynamic: ${info.registration.isDynamic ? 'Yes' : 'No'}`);

    console.log(chalk.cyan('\n🎨 Appearance:'));
    console.log(`   Has Icon: ${info.icon.hasIcon ? chalk.green('✓') : chalk.yellow('⚠ (using default)')}`);
    console.log(`   Icon Type: ${info.icon.iconType}`);
    console.log(`   Has Mesh: ${info.mesh.hasMesh ? chalk.green('✓') : chalk.red('✗')}`);
    if (info.mesh.meshInfo) {
        console.log(`   Mesh Type: ${info.mesh.meshInfo.geometryType || 'custom'}`);
    }

    console.log(chalk.cyan('\n📦 Inventory:'));
    console.log(`   In Inventory: ${info.inventory.found ? chalk.green('✓') : chalk.dim('No')}`);
    if (info.inventory.found) {
        console.log(`   Total Count: ${info.inventory.totalCount}`);
        console.log(`   Slots: ${info.inventory.slots.map(s => `#${s.slot} (${s.count})`).join(', ')}`);
    }

    console.log(chalk.blue('\n═══════════════════════════════\n'));
}

/**
 * Get all registered item classes
 */
export async function getRegisteredItems(browser) {
    return await executeInBrowser(browser, () => {
        const ItemClasses = window.ItemClasses || {};
        const DynamicItems = window.DynamicItems || {};
        return {
            all: Object.keys(ItemClasses),
            dynamic: Object.keys(DynamicItems)
        };
    });
}

/**
 * Check if an item class is registered
 */
export async function isItemRegistered(browser, itemName) {
    return await executeInBrowser(browser, (name) => {
        const ItemClasses = window.ItemClasses || {};
        return {
            registered: name in ItemClasses,
            isDynamic: name in (window.DynamicItems || {})
        };
    }, itemName);
}

/**
 * Test if an item functions correctly by attempting to use it
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} itemId - The item ID to test
 * @param {Object} options - Test options
 * @returns {Object} Result with functionality test info
 */
export async function testItemFunctionality(browser, itemId, options = {}) {
    const results = {
        itemId,
        tests: [],
        passed: 0,
        failed: 0
    };

    // 1. Check if item is registered
    const regCheck = await checkItemRegistered(browser, itemId);
    results.tests.push({
        name: 'registration',
        passed: regCheck.isRegistered,
        details: regCheck
    });
    if (regCheck.isRegistered) results.passed++; else results.failed++;

    if (!regCheck.isRegistered) {
        results.error = `Item '${itemId}' is not registered`;
        return results;
    }

    // 2. Check if item has a mesh
    const meshCheck = await checkItemMesh(browser, itemId);
    results.tests.push({
        name: 'mesh',
        passed: meshCheck.hasMesh,
        details: meshCheck
    });
    if (meshCheck.hasMesh) results.passed++; else results.failed++;

    // 3. Check if item has an icon
    const iconCheck = await checkItemIcon(browser, itemId);
    results.tests.push({
        name: 'icon',
        passed: iconCheck.hasIcon,
        details: iconCheck
    });
    if (iconCheck.hasIcon) results.passed++; else results.failed++;

    // 4. Check item methods exist
    const methodCheck = await executeInBrowser(browser, (id) => {
        const game = window.__VOXEL_GAME__;
        const item = game?.itemManager?.getItem(id);
        if (!item) return { error: 'Item not found' };

        return {
            hasOnUseDown: typeof item.onUseDown === 'function',
            hasOnUseUp: typeof item.onUseUp === 'function',
            hasOnPrimaryDown: typeof item.onPrimaryDown === 'function',
            hasOnSelect: typeof item.onSelect === 'function',
            hasOnDeselect: typeof item.onDeselect === 'function',
            hasGetMesh: typeof item.getMesh === 'function'
        };
    }, itemId);

    const hasRequiredMethods = methodCheck.hasOnUseDown || methodCheck.hasOnPrimaryDown;
    results.tests.push({
        name: 'methods',
        passed: hasRequiredMethods,
        details: methodCheck
    });
    if (hasRequiredMethods) results.passed++; else results.failed++;

    // 5. Test actual use if requested
    if (options.testUse) {
        // Give item to player first
        const giveResult = await giveItem(browser, itemId, 1);
        if (giveResult.success) {
            // Find and select the slot
            const equipResult = await equipItem(browser, itemId);
            if (equipResult.success) {
                // Try to use the item
                const useResult = await executeInBrowser(browser, (id) => {
                    const game = window.__VOXEL_GAME__;
                    const item = game?.itemManager?.getItem(id);
                    if (!item) return { error: 'Item not found' };

                    // Try onUseDown
                    let useDownResult = null;
                    try {
                        useDownResult = item.onUseDown(game, game.player);
                    } catch (e) {
                        useDownResult = { error: e.message };
                    }

                    return {
                        useDownResult,
                        usedItem: id
                    };
                }, itemId);

                results.tests.push({
                    name: 'use',
                    passed: !useResult.error && useResult.useDownResult !== null,
                    details: useResult
                });
                if (!useResult.error) results.passed++; else results.failed++;
            }
        }
    }

    results.allPassed = results.failed === 0;
    results.summary = `${results.passed}/${results.tests.length} tests passed`;

    return results;
}
