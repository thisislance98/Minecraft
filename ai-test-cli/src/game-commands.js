/**
 * GameCommands - General-purpose game commands for CLI testing
 * 
 * Provides functions to interact with the game client through Puppeteer:
 * - Inventory management
 * - Item usage
 * - Player state
 * - Entity inspection
 * - Dynamic content verification
 */

import chalk from 'chalk';

/**
 * Execute a command in the browser and return the result
 */
async function executeInBrowser(browser, fn, ...args) {
    return await browser.evaluate(fn, ...args);
}

/**
 * Get player position
 */
export async function getPlayerPosition(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.player) return null;
        const pos = game.player.position;
        return { x: pos.x, y: pos.y, z: pos.z };
    });
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
 * Simulate pressing a key
 */
export async function pressKey(browser, key) {
    await browser.page.keyboard.press(key);
    return { pressed: key };
}

/**
 * Simulate right-click (use item)
 */
export async function rightClick(browser, x = 400, y = 300) {
    await browser.page.mouse.click(x, y, { button: 'right' });
    return { clicked: 'right', x, y };
}

/**
 * Simulate left-click (primary action)
 */
export async function leftClick(browser, x = 400, y = 300) {
    await browser.page.mouse.click(x, y, { button: 'left' });
    return { clicked: 'left', x, y };
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
 * Get all registered creature classes
 */
export async function getRegisteredCreatures(browser) {
    return await executeInBrowser(browser, () => {
        const AnimalClasses = window.AnimalClasses || {};
        const DynamicCreatures = window.DynamicCreatures || {};
        return {
            all: Object.keys(AnimalClasses),
            dynamic: Object.keys(DynamicCreatures)
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
 * Check if a creature class is registered
 */
export async function isCreatureRegistered(browser, creatureName) {
    return await executeInBrowser(browser, (name) => {
        const AnimalClasses = window.AnimalClasses || {};
        return {
            registered: name in AnimalClasses,
            isDynamic: name in (window.DynamicCreatures || {})
        };
    }, creatureName);
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
 * Get all entities in the scene
 */
export async function getEntities(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.animals) return { error: 'Game not ready' };

        const entities = game.animals.map(a => ({
            id: a.id,
            type: a.constructor.name,
            position: a.position ? { x: a.position.x, y: a.position.y, z: a.position.z } : null
        }));

        // Group by type
        const byType = {};
        for (const e of entities) {
            byType[e.type] = (byType[e.type] || 0) + 1;
        }

        return { count: entities.length, byType, entities: entities.slice(0, 20) };
    });
}

/**
 * Teleport player to position
 */
export async function teleportPlayer(browser, x, y, z) {
    return await executeInBrowser(browser, (x, y, z) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.player) return { error: 'Game not ready' };

        game.player.position.set(x, y, z);
        return { teleported: true, position: { x, y, z } };
    }, x, y, z);
}

/**
 * Spawn a creature at player's position
 */
export async function spawnCreature(browser, creatureType, count = 1) {
    return await executeInBrowser(browser, (type, cnt) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.spawnManager) return { error: 'Game not ready' };

        const AnimalClasses = window.AnimalClasses || {};
        const CreatureClass = AnimalClasses[type];
        if (!CreatureClass) {
            return { error: `Creature '${type}' not found`, available: Object.keys(AnimalClasses).slice(0, 20) };
        }

        const spawned = game.spawnManager.spawnEntitiesInFrontOfPlayer(CreatureClass, cnt);
        return { success: true, count: spawned?.length || 0, type };
    }, creatureType, count);
}

/**
 * Get game state summary
 */
export async function getGameState(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game) return { error: 'Game not ready' };

        return {
            player: game.player ? {
                position: { x: game.player.position.x, y: game.player.position.y, z: game.player.position.z },
                health: game.player.health,
                isFlying: game.player.isFlying
            } : null,
            entities: game.animals?.length || 0,
            time: game.timeOfDay,
            connected: game.socketManager?.isConnected?.() || false,
            dynamicCreatures: Object.keys(window.DynamicCreatures || {}).length,
            dynamicItems: Object.keys(window.DynamicItems || {}).length
        };
    });
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(browser, conditionFn, timeoutMs = 10000, pollMs = 500) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        const result = await executeInBrowser(browser, conditionFn);
        if (result) return { success: true, result };
        await new Promise(r => setTimeout(r, pollMs));
    }
    return { success: false, error: 'Timeout waiting for condition' };
}

/**
 * Print formatted game state
 */
export function printGameState(state) {
    console.log(chalk.blue('\n═══ Game State ═══'));
    if (state.player) {
        console.log(chalk.cyan('Player:'));
        console.log(`  Position: (${state.player.position.x.toFixed(1)}, ${state.player.position.y.toFixed(1)}, ${state.player.position.z.toFixed(1)})`);
        console.log(`  Health: ${state.player.health}`);
        console.log(`  Flying: ${state.player.isFlying}`);
    }
    console.log(chalk.cyan('World:'));
    console.log(`  Entities: ${state.entities}`);
    console.log(`  Time: ${state.time}`);
    console.log(`  Connected: ${state.connected}`);
    console.log(chalk.cyan('Dynamic Content:'));
    console.log(`  Creatures: ${state.dynamicCreatures}`);
    console.log(`  Items: ${state.dynamicItems}`);
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
 * Print entity summary
 */
export function printEntities(entities) {
    console.log(chalk.blue('\n═══ Entities ═══'));
    console.log(`Total: ${entities.count}`);
    console.log(chalk.cyan('By Type:'));
    for (const [type, count] of Object.entries(entities.byType)) {
        console.log(`  ${type}: ${count}`);
    }
}

/**
 * Break a block at specific world coordinates (or in front of player)
 */
export async function breakBlock(browser, x, y, z) {
    return await executeInBrowser(browser, (bx, by, bz) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.physicsManager) return { error: 'Game not ready' };

        // If no coordinates provided, break block in front of player
        if (bx === undefined) {
            game.physicsManager.breakBlock();
            return { success: true, method: 'targetedBlock' };
        }

        // Break block at specific coordinates and spawn a drop entity
        const block = game.getBlock(bx, by, bz);
        if (!block || block.type === 'air') {
            return { error: `No block at (${bx}, ${by}, ${bz})` };
        }

        // Use spawnDrop to create a Drop entity (for testing drop lighting)
        game.spawnDrop(bx, by, bz, block.type);
        game.setBlock(bx, by, bz, null);
        return { success: true, position: { x: bx, y: by, z: bz }, blockType: block.type, spawned: 'drop' };
    }, x, y, z);
}

/**
 * Get all dropped items (Drop entities) in the scene
 */
export async function getDrops(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.drops) return { error: 'Game not ready', drops: [] };

        const drops = game.drops.map(d => ({
            blockType: d.blockType,
            position: d.position ? { x: d.position.x, y: d.position.y, z: d.position.z } : null,
            hasVertexColors: d.mesh?.material?.[0]?.vertexColors ?? d.mesh?.material?.vertexColors ?? 'unknown',
            materialCount: Array.isArray(d.mesh?.material) ? d.mesh.material.length : 1
        }));

        return { count: drops.length, drops };
    });
}

/**
 * Print drops summary
 */
export function printDrops(dropsData) {
    console.log(chalk.blue('\n═══ Dropped Blocks ═══'));
    console.log(`Total: ${dropsData.count}`);
    if (dropsData.drops.length === 0) {
        console.log(chalk.dim('  (none)'));
    } else {
        for (const drop of dropsData.drops) {
            const pos = drop.position ? `(${drop.position.x.toFixed(1)}, ${drop.position.y.toFixed(1)}, ${drop.position.z.toFixed(1)})` : 'unknown';
            const vertexColors = drop.hasVertexColors === false ? chalk.green('✓ Fixed (vertexColors: false)') : chalk.red('⚠ Still has vertexColors: ' + drop.hasVertexColors);
            console.log(`  ${drop.blockType} at ${pos} - ${vertexColors}`);
        }
    }
}

/**
 * Set a block at specific coordinates
 */
export async function setBlock(browser, x, y, z, blockType) {
    return await executeInBrowser(browser, (bx, by, bz, type) => {
        const game = window.__VOXEL_GAME__;
        if (!game) return { error: 'Game not ready' };

        game.setBlock(bx, by, bz, type);
        return { success: true, position: { x: bx, y: by, z: bz }, blockType: type };
    }, x, y, z, blockType);
}
