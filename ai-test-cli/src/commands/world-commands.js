/**
 * World Commands
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

export async function setBlock(browser, x, y, z, blockType) {
    return await executeInBrowser(browser, (bx, by, bz, type) => {
        const game = window.__VOXEL_GAME__;
        if (!game) return { error: 'Game not ready' };

        game.setBlock(bx, by, bz, type);
        return { success: true, position: { x: bx, y: by, z: bz }, blockType: type };
    }, x, y, z, blockType);
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
 * Place a block at the target location
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} blockType - Optional block type to place (selects from inventory first)
 */
export async function placeBlock(browser, blockType = null) {
    // If block type specified, try to equip it first
    if (blockType) {
        const equipResult = await equipItem(browser, blockType);
        if (equipResult.error) {
            return { error: `Cannot equip ${blockType}: ${equipResult.error}` };
        }
    }

    // Right-click to place
    await browser.page.mouse.click(640, 360, { button: 'right' });
    await new Promise(r => setTimeout(r, 100));

    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game) return { error: 'Game not ready' };

        const slot = game.inventoryManager?.getSelectedItem();
        return {
            success: true,
            action: 'place',
            item: slot?.item || null,
            remaining: slot?.count || 0
        };
    });
}

/**
 * Mine/break the block the player is looking at
 */
export async function mineBlock(browser) {
    // Hold left click for mining
    await browser.page.mouse.down();
    await new Promise(r => setTimeout(r, 500)); // Hold for half a second
    await browser.page.mouse.up();

    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game) return { error: 'Game not ready' };

        const targetBlock = game.physicsManager?.targetBlock;
        return {
            success: true,
            action: 'mine',
            targetBlock: targetBlock ? {
                x: targetBlock.x,
                y: targetBlock.y,
                z: targetBlock.z,
                type: targetBlock.type
            } : null
        };
    });
}

/**
 * Get current world info from the game client
 */
export async function getCurrentWorld(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.socketManager) return { error: 'Game not ready' };

        return {
            worldId: game.socketManager.worldId || 'global',
            roomId: game.socketManager.roomId,
            isConnected: game.socketManager.isConnected?.() || false
        };
    });
}

/**
 * Join a specific world by ID
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} worldId - World ID to join
 * @param {string} playerName - Optional player name
 */
export async function joinWorld(browser, worldId, playerName = 'TestPlayer') {
    return await executeInBrowser(browser, (wId, name) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.socketManager) return { error: 'Game not ready' };

        console.log(`[GameCommands] Joining world: ${wId}`);
        game.socketManager.joinWorld(wId, name);
        return { joining: true, worldId: wId };
    }, worldId, playerName);
}

/**
 * Wait for world:joined event and return world data
 */
export async function waitForWorldJoin(browser, timeoutMs = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        const result = await executeInBrowser(browser, () => {
            const game = window.__VOXEL_GAME__;
            if (!game?.socketManager) return null;
            // Check if we've successfully joined a world
            const worldId = game.socketManager.worldId;
            const isConnected = game.socketManager.isConnected?.() || false;
            if (worldId && isConnected) {
                return { worldId, connected: true };
            }
            return null;
        });
        if (result?.connected) return { success: true, ...result };
        await new Promise(r => setTimeout(r, 500));
    }
    return { success: false, error: 'Timeout waiting for world join' };
}

/**
 * Navigate browser to a specific world URL
 */
export async function navigateToWorld(browser, worldId) {
    const baseUrl = 'http://localhost:3000';
    const worldUrl = `${baseUrl}/world/${worldId}?cli=true&secret=asdf123`;

    console.log(`[GameCommands] Navigating to world: ${worldUrl}`);
    await browser.page.goto(worldUrl, { waitUntil: 'domcontentloaded' });

    // Wait for game to load
    try {
        await browser.page.waitForSelector('canvas', { timeout: 15000 });
        await browser.page.waitForFunction(() => {
            return window.__VOXEL_GAME__ !== undefined;
        }, { timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000));
        return { success: true, worldId, url: worldUrl };
    } catch (e) {
        return { success: false, error: e.message, worldId, url: worldUrl };
    }
}

/**
 * Get world-scoped dynamic creatures (only from current world)
 */
export async function getWorldCreatures(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        const DynamicCreatures = window.DynamicCreatures || {};
        const worldId = game?.socketManager?.worldId || 'global';

        return {
            worldId,
            creatures: Object.keys(DynamicCreatures),
            count: Object.keys(DynamicCreatures).length,
            // Also include the raw creature definitions
            definitions: Object.entries(DynamicCreatures).map(([name, def]) => ({
                name,
                hasClass: !!def.creatureClass,
                definitionKeys: def.definition ? Object.keys(def.definition) : []
            }))
        };
    });
}

/**
 * Get world-scoped dynamic items (only from current world)
 */
export async function getWorldItems(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        const DynamicItems = window.DynamicItems || {};
        const worldId = game?.socketManager?.worldId || 'global';

        return {
            worldId,
            items: Object.keys(DynamicItems),
            count: Object.keys(DynamicItems).length
        };
    });
}

/**
 * Clear dynamic content (for testing isolation)
 */
export async function clearDynamicContent(browser) {
    return await executeInBrowser(browser, () => {
        const before = {
            creatures: Object.keys(window.DynamicCreatures || {}).length,
            items: Object.keys(window.DynamicItems || {}).length
        };

        // Clear the registries
        window.DynamicCreatures = {};
        window.DynamicItems = {};

        return {
            cleared: true,
            before,
            after: { creatures: 0, items: 0 }
        };
    });
}

/**
 * Apply sky color to the game environment
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} hexColor - Hex color string like '#87CEEB'
 */
export async function applySkyColor(browser, hexColor) {
    return await executeInBrowser(browser, (color) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.environment) return { error: 'Game not ready' };

        game.environment.applySkyColor(color);
        return { success: true, color };
    }, hexColor);
}

/**
 * Get current sky color from the environment
 */
export async function getSkyColor(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.environment) return { error: 'Game not ready' };

        const skyColor = game.environment.skyColor;
        if (!skyColor) return { color: null };

        // Convert THREE.Color to hex string
        const hex = '#' + skyColor.getHexString().toUpperCase();
        return { color: hex };
    });
}

/**
 * Set gravity multiplier
 * @param {Object} browser - Puppeteer browser instance
 * @param {number} multiplier - Gravity multiplier (0.1 to 3.0)
 */
export async function setGravity(browser, multiplier) {
    return await executeInBrowser(browser, (mult) => {
        const game = window.__VOXEL_GAME__;
        if (!game) return { error: 'Game not ready' };

        game.gravityMultiplier = mult;
        return { success: true, gravity: mult };
    }, multiplier);
}

/**
 * Get current gravity multiplier
 */
export async function getGravity(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game) return { error: 'Game not ready' };

        return { gravity: game.gravityMultiplier ?? 1.0 };
    });
}

/**
 * Get current gravity multiplier
 */
export async function getGravity(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game) return { error: 'Game not ready' };

        return { gravity: game.gravityMultiplier ?? 1.0 };
    });
}

/**
 * Set allowed creatures filter
 * @param {Object} browser - Puppeteer browser instance
 * @param {string[]|null} creatures - Array of creature names, or null for all
 */
export async function setAllowedCreatures(browser, creatures) {
    return await executeInBrowser(browser, (list) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.spawnManager) return { error: 'Game not ready' };

        game.spawnManager.setAllowedCreatures(list);
        return { success: true, creatures: list };
    }, creatures);
}

/**
 * Get allowed creatures filter
 */
export async function getAllowedCreatures(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.spawnManager) return { error: 'Game not ready' };

        const allowed = game.spawnManager.allowedCreatures;
        if (allowed === null) {
            return { allowAll: true, creatures: null };
        }
        return { allowAll: false, creatures: Array.from(allowed) };
    });
}

/**
 * Get world customizations from current world
 */
export async function getWorldCustomizations(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game) return { error: 'Game not ready' };

        // Try to get from WorldSettingsUI or stored world data
        const settingsUI = game.uiManager?.worldSettingsUI;
        const world = settingsUI?.world;

        return {
            worldId: world?.id || game.socketManager?.worldId || 'unknown',
            customizations: world?.customizations || {},
            settings: world?.settings || {}
        };
    });
}

/**
 * Test world settings update via API
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} worldId - World ID
 * @param {Object} customizations - Customizations to apply
 */
export async function updateWorldSettings(browser, worldId, customizations) {
    // This uses the API directly via fetch
    return await executeInBrowser(browser, async (wId, custom) => {
        const serverUrl = window.location.hostname === 'localhost' ?
            'http://localhost:2567' : window.location.origin;

        try {
            const response = await fetch(`${serverUrl}/api/worlds/${wId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Antigravity-Secret': 'asdf123',
                    'X-Antigravity-Client': 'cli'
                },
                body: JSON.stringify({ customizations: custom })
            });

            const data = await response.json();
            return { success: response.ok, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, worldId, customizations);
}

/**
 * Open the World Browser modal
 */
export async function openWorldBrowser(browser) {
    return await executeInBrowser(browser, () => {
        const worldBtn = document.getElementById('world-btn');
        if (!worldBtn) return { error: 'World button not found' };

        worldBtn.click();

        // Wait a moment for modal to open
        return new Promise(resolve => {
            setTimeout(() => {
                const modal = document.getElementById('world-browser-modal');
                const isOpen = modal && !modal.classList.contains('hidden');
                resolve({ success: isOpen, modalVisible: isOpen });
            }, 100);
        });
    });
}

/**
 * Close the World Browser modal
 */
export async function closeWorldBrowser(browser) {
    return await executeInBrowser(browser, () => {
        const closeBtn = document.getElementById('world-browser-close');
        if (closeBtn) {
            closeBtn.click();
            return { success: true };
        }
        return { error: 'Close button not found' };
    });
}

/**
 * Switch tabs in the World Browser
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} tabName - Tab name: 'browse', 'my-worlds', 'create', 'settings'
 */
export async function switchWorldBrowserTab(browser, tabName) {
    return await executeInBrowser(browser, (tab) => {
        const tabBtn = document.querySelector(`.world-tab[data-tab="${tab}"]`);
        if (!tabBtn) return { error: `Tab '${tab}' not found` };

        tabBtn.click();

        return new Promise(resolve => {
            setTimeout(() => {
                const tabContent = document.getElementById(`world-tab-${tab}`);
                const isActive = tabContent && tabContent.classList.contains('active');
                resolve({ success: isActive, tab, isActive });
            }, 100);
        });
    }, tabName);
}

/**
 * Get current World Browser tab info
 */
export async function getWorldBrowserState(browser) {
    return await executeInBrowser(browser, () => {
        const modal = document.getElementById('world-browser-modal');
        const isOpen = modal && !modal.classList.contains('hidden');

        // Find active tab
        const activeTab = document.querySelector('.world-tab.active');
        const activeTabName = activeTab?.dataset.tab || null;

        // Get active content
        const activeContent = document.querySelector('.world-tab-content.active');
        const activeContentId = activeContent?.id || null;

        // Settings tab specific info
        let settingsInfo = null;
        if (activeTabName === 'settings') {
            const notInWorld = document.getElementById('settings-not-in-world');
            const notOwner = document.getElementById('settings-not-owner');
            const settingsContent = document.getElementById('settings-content');

            settingsInfo = {
                showingNotInWorld: notInWorld && !notInWorld.classList.contains('hidden'),
                showingNotOwner: notOwner && !notOwner.classList.contains('hidden'),
                showingSettings: settingsContent && !settingsContent.classList.contains('hidden')
            };
        }

        return {
            isOpen,
            activeTab: activeTabName,
            activeContentId,
            settingsInfo
        };
    });
}

/**
 * Get all available tabs in the World Browser
 */
export async function getWorldBrowserTabs(browser) {
    return await executeInBrowser(browser, () => {
        const tabs = Array.from(document.querySelectorAll('.world-tab')).map(tab => ({
            name: tab.dataset.tab,
            label: tab.textContent.trim(),
            isActive: tab.classList.contains('active')
        }));
        return { tabs, count: tabs.length };
    });
}

/**
 * Get settings form values from the World Browser Settings tab
 */
export async function getWorldBrowserSettings(browser) {
    return await executeInBrowser(browser, () => {
        const worldName = document.getElementById('wb-world-name')?.textContent || null;
        const worldId = document.getElementById('wb-world-id')?.textContent || null;
        const description = document.getElementById('wb-description')?.value || '';
        const visibility = document.querySelector('input[name="wb-visibility"]:checked')?.value || null;
        const timeOfDay = parseFloat(document.getElementById('wb-time-of-day')?.value || 0.25);
        const timeFrozen = document.getElementById('wb-time-frozen')?.checked || false;
        const skyColor = document.getElementById('wb-sky-color')?.value || '#87CEEB';
        const gravity = parseFloat(document.getElementById('wb-gravity')?.value || 1.0);
        const allowBuilding = document.getElementById('wb-allow-building')?.value || 'all';
        const allowSpawn = document.getElementById('wb-allow-spawn')?.value || 'all';
        const allowPvP = document.getElementById('wb-allow-pvp')?.checked || false;

        return {
            worldName,
            worldId,
            description,
            visibility,
            timeOfDay,
            timeFrozen,
            skyColor,
            gravity,
            allowBuilding,
            allowSpawn,
            allowPvP
        };
    });
}

/**
 * Send AI prompt with world context
 */
export async function sendAIPromptWithWorld(browser, prompt, worldId) {
    return await executeInBrowser(browser, (text, wId) => {
        const game = window.__VOXEL_GAME__;
        const merlinClient = game?.uiManager?.merlinClient || window.merlinClient;

        if (!merlinClient?.send) {
            return { error: 'Merlin client not found' };
        }

        const context = {
            position: game?.player?.position ? {
                x: game.player.position.x,
                y: game.player.position.y,
                z: game.player.position.z
            } : { x: 0, y: 50, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            biome: 'Plains',
            worldId: wId || game?.socketManager?.worldId || 'global'
        };

        merlinClient.send({
            type: 'input',
            text: text,
            context: context
        });

        return { sent: true, prompt: text, worldId: context.worldId };
    }, prompt, worldId);
}

/**
 * Get socket event logs (for debugging)
 */
export async function getSocketEvents(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        // Return recent socket events if tracked
        return {
            worldId: game?.socketManager?.worldId || null,
            roomId: game?.socketManager?.roomId || null,
            isConnected: game?.socketManager?.isConnected?.() || false,
            // Check for any tracked events
            lastEvents: window.__SOCKET_DEBUG_EVENTS__ || []
        };
    });
}
