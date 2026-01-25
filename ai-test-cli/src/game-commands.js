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
 * Get all creature registration errors (for debugging AI-generated creatures)
 */
export async function getCreatureErrors(browser) {
    return await executeInBrowser(browser, () => {
        const errors = window.DynamicCreatureErrors || {};
        return {
            count: Object.keys(errors).length,
            errors: errors
        };
    });
}

/**
 * Get detailed info about dynamic creatures (for debugging)
 */
export async function getDynamicCreatureInfo(browser) {
    return await executeInBrowser(browser, () => {
        const DynamicCreatures = window.DynamicCreatures || {};
        const DynamicCreatureErrors = window.DynamicCreatureErrors || {};
        const AnimalClasses = window.AnimalClasses || {};

        const info = {};
        for (const name of Object.keys(DynamicCreatures)) {
            info[name] = {
                registered: name in AnimalClasses,
                hasError: name in DynamicCreatureErrors,
                error: DynamicCreatureErrors[name]?.error || null
            };
        }
        return info;
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

        return { count: entities.length, byType, entities: entities };
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

        // Spawn directly near player position (more reliable than spawnEntitiesInFrontOfPlayer in CLI)
        const player = game.player;
        if (!player) return { error: 'No player' };

        const spawned = [];
        for (let i = 0; i < cnt; i++) {
            const offsetX = (Math.random() - 0.5) * 10;
            const offsetZ = (Math.random() - 0.5) * 10;
            const x = player.position.x + 5 + offsetX;
            const z = player.position.z + 5 + offsetZ;
            const y = player.position.y + 2;

            try {
                const animal = new CreatureClass(game, x, y, z, Math.random());
                game.animals.push(animal);
                game.scene.add(animal.mesh);
                if (game.spawnManager?.entityRegistry) {
                    game.spawnManager.entityRegistry.register(animal.id, animal);
                }
                spawned.push({
                    type: animal.constructor.name,
                    position: { x, y, z },
                    isRideable: animal.isRideable || false
                });
            } catch (e) {
                return { error: `Failed to spawn ${type}: ${e.message}` };
            }
        }

        return { success: true, count: spawned.length, type, spawned };
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

export async function setBlock(browser, x, y, z, blockType) {
    return await executeInBrowser(browser, (bx, by, bz, type) => {
        const game = window.__VOXEL_GAME__;
        if (!game) return { error: 'Game not ready' };

        game.setBlock(bx, by, bz, type);
        return { success: true, position: { x: bx, y: by, z: bz }, blockType: type };
    }, x, y, z, blockType);
}

/**
 * Show an in-game notification (for testing the notification system)
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} message - Message to display
 * @param {'error' | 'warning' | 'info' | 'success'} type - Notification type
 * @param {number} duration - Duration in ms (default: 3000)
 */
export async function showNotification(browser, message, type = 'info', duration = 3000) {
    return await executeInBrowser(browser, (msg, t, dur) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.uiManager) return { error: 'Game not ready' };

        game.uiManager.showGameNotification(msg, t, dur);
        return { success: true, message: msg, type: t, duration: dur };
    }, message, type, duration);
}

/**
 * Get all currently visible notifications
 */
export async function getNotifications(browser) {
    return await executeInBrowser(browser, () => {
        const container = document.getElementById('game-notifications');
        if (!container) return { error: 'Container not found', notifications: [] };

        const notifications = Array.from(container.querySelectorAll('.game-notification')).map(n => ({
            type: n.classList.contains('error') ? 'error' :
                n.classList.contains('warning') ? 'warning' :
                    n.classList.contains('success') ? 'success' : 'info',
            message: n.querySelector('.notif-message')?.textContent || '',
            isFading: n.classList.contains('fade-out')
        }));

        return { count: notifications.length, notifications };
    });
}

/**
 * Spawn creature at specific coordinates
 */
export async function spawnCreatureAt(browser, creatureType, x, y, z) {
    return await executeInBrowser(browser, (type, px, py, pz) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.spawnManager) return { error: 'Game not ready' };

        const AnimalClasses = window.AnimalClasses || {};
        const CreatureClass = AnimalClasses[type];
        if (!CreatureClass) {
            return { error: `Creature '${type}' not found` };
        }

        // Create directly
        // createAnimal(AnimalClass, x, y, z, snapToGround = true, seed = null)
        // We want absolute control, so snapToGround = false? 
        // But createAnimal logic forces snapToGround if not specified.
        // Actually createAnimal signature: createAnimal(AnimalClass, x, y, z, snapToGround = true, seed = null)
        // Wait, I saw createAnimal code: createAnimal(AnimalClass, x, y, z, snapToGround = true, seed = null)
        // If I pass false, it should respect it.
        // But wait, the code I read earlier:
        /*
        createAnimal(AnimalClass, x, y, z, snapToGround = true, seed = null) {
            // ...
            if (snapToGround) {
                // ... finds ground ...
            }
            const animal = new AnimalClass(this.game, x, y, z, seed);
            // ...
        }
        */
        // So passing false should work.

        // However, `spawnManager.createAnimal` might not return the created instance.
        // It returns nothing usually.
        // But `spawnEntitiesInFrontOfPlayer` returns the list.
        // I'll implement a simple wrapper that instantiates or calls createAnimal.

        // Let's use createAnimal but with snapToGround=false to force position.

        game.spawnManager.createAnimal(CreatureClass, px, py, pz, false);
        return { success: true, type, x: px, y: py, z: pz };
    }, creatureType, x, y, z);
}

/**
 * Set player rotation
 */
export async function setRotation(browser, x, y, z) {
    return await executeInBrowser(browser, (rx, ry, rz) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.camera) return { error: 'Game not ready' };
        game.camera.rotation.set(rx, ry, rz);
        game.camera.quaternion.setFromEuler(game.camera.rotation);
        return { success: true, rotation: { x: rx, y: ry, z: rz } };
    }, x, y, z);
}

/**
 * Deal damage to the player (for testing health bar sync)
 * @param {Object} browser - Puppeteer browser instance
 * @param {number} amount - Damage amount
 */
export async function takeDamage(browser, amount = 5) {
    return await executeInBrowser(browser, (dmg) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.player) return { error: 'Game not ready' };

        const oldHealth = game.player.health;
        game.player.takeDamage(dmg);
        return {
            success: true,
            damage: dmg,
            oldHealth: oldHealth,
            newHealth: game.player.health
        };
    }, amount);
}

/**
 * Get player health info
 */
export async function getPlayerHealth(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.player) return { error: 'Game not ready' };
        return {
            health: game.player.health,
            maxHealth: game.player.maxHealth
        };
    });
}

/**
 * Get info about remote players (for testing multiplayer)
 */
export async function getRemotePlayers(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.socketManager) return { error: 'Game not ready' };

        const players = [];
        if (game.socketManager.playerMeshes) {
            game.socketManager.playerMeshes.forEach((meshInfo, id) => {
                players.push({
                    id: id,
                    position: meshInfo.group ? {
                        x: meshInfo.group.position.x,
                        y: meshInfo.group.position.y,
                        z: meshInfo.group.position.z
                    } : null,
                    hasHealthBar: !!meshInfo.healthBar
                });
            });
        }
        return { count: players.length, players };
    });
}


/**
 * Get chat messages from the UI
 * @returns {Array<{type: string, text: string}>}
 */
export async function getChatMessages(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.uiManager) return { error: 'Game not ready' };

        // Access chat messages directly from DOM
        const container = document.getElementById('chat-messages-ai');
        if (!container) return { messages: [] };

        const messages = Array.from(container.querySelectorAll('.message')).map(el => ({
            type: el.classList.contains('ai') ? 'ai' :
                el.classList.contains('user') ? 'user' :
                    el.classList.contains('system') ? 'system' : 'unknown',
            text: el.innerText
        }));

        return { messages };
    });
}

/**
 * Send a chat message (as if typed by player)
 */
export async function sendChatMessage(browser, text) {
    return await executeInBrowser(browser, (msg) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.uiManager) return { error: 'Game not ready' };

        // Ensure chat is open
        game.uiManager.toggleChatPanel(true);
        const input = document.getElementById('chat-input');
        if (input) {
            input.value = msg;
            game.uiManager.handleSendMessage();
            return { success: true, message: msg };
        }
        return { error: 'Chat input not found' };
    }, text);
}

// ========== WORLD-RELATED COMMANDS ==========

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

// ========== WORLD SETTINGS COMMANDS ==========

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
 * Get creature statistics and counts
 */
export async function getCreatureStats(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.spawnManager) return { error: 'Game not ready' };

        const stats = {
            totalCreatures: game.animals?.length || 0,
            entitiesTracked: game.spawnManager.entities.size,
            creaturesByType: {}
        };

        // Count creatures by type
        if (game.animals) {
            for (const animal of game.animals) {
                const typeName = animal.constructor.name;
                stats.creaturesByType[typeName] = (stats.creaturesByType[typeName] || 0) + 1;
            }
        }

        // Get allowed creatures filter info
        const allowed = game.spawnManager.allowedCreatures;
        stats.allowAll = allowed === null;
        stats.allowedCreatures = allowed ? Array.from(allowed) : null;

        // Get ambient manager stats
        if (game.entityManager) {
            stats.ambientManagers = {
                birdManager: game.entityManager.birdManager?.count || 0,
                butterflyManager: game.entityManager.butterflyManager?.count || 0,
                pixieManager: game.entityManager.pixieManager?.count || 0,
                batManager: game.entityManager.batManager?.count || 0,
                mosquitoManager: game.entityManager.mosquitoManager?.count || 0
            };
        }

        return stats;
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

// ========== WORLD BROWSER UI COMMANDS ==========

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

// ========== PLAYER PHYSICS COMMANDS ==========

/**
 * Get detailed player physics state
 */
export async function getPlayerPhysics(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.player) return { error: 'Game not ready' };

        return {
            position: {
                x: game.player.position.x,
                y: game.player.position.y,
                z: game.player.position.z
            },
            velocity: {
                x: game.player.velocity.x,
                y: game.player.velocity.y,
                z: game.player.velocity.z
            },
            onGround: game.player.onGround,
            isFlying: game.player.isFlying,
            isMoving: game.player.isMoving,
            jumpForce: game.player.jumpForce
        };
    });
}

/**
 * Monitor player ground state over time
 * @param {Object} browser - Puppeteer browser instance
 * @param {number} durationMs - How long to monitor in milliseconds
 * @param {number} intervalMs - Sampling interval
 */
export async function monitorGroundState(browser, durationMs = 3000, intervalMs = 50) {
    const samples = [];
    const startTime = Date.now();

    while (Date.now() - startTime < durationMs) {
        const state = await executeInBrowser(browser, () => {
            const game = window.__VOXEL_GAME__;
            if (!game?.player) return null;
            return {
                onGround: game.player.onGround,
                y: game.player.position.y,
                velY: game.player.velocity.y,
                timestamp: Date.now()
            };
        });
        if (state) samples.push(state);
        await new Promise(r => setTimeout(r, intervalMs));
    }

    // Analyze samples
    const onGroundCount = samples.filter(s => s.onGround).length;
    const offGroundCount = samples.filter(s => !s.onGround).length;

    // Find transitions (ground state changes)
    const transitions = [];
    for (let i = 1; i < samples.length; i++) {
        if (samples[i].onGround !== samples[i-1].onGround) {
            transitions.push({
                from: samples[i-1].onGround,
                to: samples[i].onGround,
                y: samples[i].y,
                velY: samples[i].velY
            });
        }
    }

    return {
        totalSamples: samples.length,
        onGroundCount,
        offGroundCount,
        onGroundPercent: (onGroundCount / samples.length * 100).toFixed(1),
        transitions,
        transitionCount: transitions.length,
        samples: samples.slice(-20) // Last 20 samples for debugging
    };
}

/**
 * Simulate player walking and jumping for testing
 */
export async function testJumpWhileWalking(browser) {
    // Start walking forward
    await browser.page.keyboard.down('KeyW');

    const results = [];

    // Try to jump multiple times while walking
    for (let i = 0; i < 10; i++) {
        // Check onGround before jump
        const beforeJump = await executeInBrowser(browser, () => {
            const game = window.__VOXEL_GAME__;
            return {
                onGround: game?.player?.onGround,
                y: game?.player?.position?.y,
                velY: game?.player?.velocity?.y
            };
        });

        // Press space to jump
        await browser.page.keyboard.press('Space');

        // Wait a frame
        await new Promise(r => setTimeout(r, 16));

        // Check onGround after jump attempt
        const afterJump = await executeInBrowser(browser, () => {
            const game = window.__VOXEL_GAME__;
            return {
                onGround: game?.player?.onGround,
                y: game?.player?.position?.y,
                velY: game?.player?.velocity?.y
            };
        });

        const jumped = afterJump.velY > 0;
        results.push({
            attempt: i + 1,
            wasOnGround: beforeJump.onGround,
            jumped,
            velYBefore: beforeJump.velY,
            velYAfter: afterJump.velY
        });

        // Wait for landing
        await new Promise(r => setTimeout(r, 800));
    }

    // Stop walking
    await browser.page.keyboard.up('KeyW');

    // Analyze results
    const attemptedOnGround = results.filter(r => r.wasOnGround);
    const successfulJumps = results.filter(r => r.jumped);
    const failedJumps = attemptedOnGround.filter(r => !r.jumped);

    return {
        totalAttempts: results.length,
        attemptedWhileOnGround: attemptedOnGround.length,
        successfulJumps: successfulJumps.length,
        failedJumps: failedJumps.length,
        failureRate: failedJumps.length > 0 ?
            (failedJumps.length / attemptedOnGround.length * 100).toFixed(1) + '%' : '0%',
        details: results
    };
}

// ========== ADVANCED WARP/TELEPORT COMMANDS ==========

/**
 * Named locations for warping - common biomes and points of interest
 */
const WARP_LOCATIONS = {
    spawn: { x: 0, y: 50, z: 0 },
    origin: { x: 0, y: 50, z: 0 },
    ocean: { x: 500, y: 40, z: 500 },
    desert: { x: -300, y: 60, z: 200 },
    forest: { x: 150, y: 55, z: -200 },
    jungle: { x: -400, y: 60, z: -400 },
    mountain: { x: 200, y: 120, z: 300 },
    snow: { x: -500, y: 70, z: -200 },
    plains: { x: 100, y: 52, z: 100 },
    cave: { x: 50, y: 20, z: 50 },
    sky: { x: 0, y: 200, z: 0 },
    space: { x: 0, y: 500, z: 0 },
    underground: { x: 0, y: 10, z: 0 }
};

/**
 * Warp player to a named location or coordinates
 * @param {Object} browser - Puppeteer browser instance
 * @param {string|Object} destination - Named location string or {x, y, z} coordinates
 * @returns {Object} Warp result with position
 */
export async function warp(browser, destination) {
    let targetPos;
    let locationName = null;

    if (typeof destination === 'string') {
        // Check if it's a named location
        const lowerDest = destination.toLowerCase();
        if (WARP_LOCATIONS[lowerDest]) {
            targetPos = WARP_LOCATIONS[lowerDest];
            locationName = lowerDest;
        } else if (destination.includes(',')) {
            // Parse coordinate string like "100, 50, 200"
            const parts = destination.split(',').map(s => parseFloat(s.trim()));
            if (parts.length >= 3 && parts.every(n => !isNaN(n))) {
                targetPos = { x: parts[0], y: parts[1], z: parts[2] };
            } else {
                return { error: `Invalid coordinates: ${destination}` };
            }
        } else {
            return {
                error: `Unknown location: ${destination}`,
                availableLocations: Object.keys(WARP_LOCATIONS)
            };
        }
    } else if (typeof destination === 'object' && destination.x !== undefined) {
        targetPos = destination;
    } else {
        return { error: 'Invalid destination format' };
    }

    // Execute the warp
    const result = await executeInBrowser(browser, (x, y, z) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.player) return { error: 'Game not ready' };

        // Store old position for logging
        const oldPos = {
            x: game.player.position.x,
            y: game.player.position.y,
            z: game.player.position.z
        };

        // Teleport
        game.player.position.set(x, y, z);

        // Reset velocity to prevent falling momentum
        if (game.player.velocity) {
            game.player.velocity.set(0, 0, 0);
        }

        return {
            success: true,
            from: oldPos,
            to: { x, y, z }
        };
    }, targetPos.x, targetPos.y, targetPos.z);

    if (result.success) {
        result.locationName = locationName;
    }

    return result;
}

/**
 * Get list of all available warp locations
 */
export function getWarpLocations() {
    return {
        locations: Object.entries(WARP_LOCATIONS).map(([name, pos]) => ({
            name,
            x: pos.x,
            y: pos.y,
            z: pos.z
        })),
        count: Object.keys(WARP_LOCATIONS).length
    };
}

/**
 * Warp player relative to current position
 * @param {Object} browser - Puppeteer browser instance
 * @param {number} dx - Delta X
 * @param {number} dy - Delta Y
 * @param {number} dz - Delta Z
 */
export async function warpRelative(browser, dx, dy, dz) {
    return await executeInBrowser(browser, (deltaX, deltaY, deltaZ) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.player) return { error: 'Game not ready' };

        const oldPos = {
            x: game.player.position.x,
            y: game.player.position.y,
            z: game.player.position.z
        };

        game.player.position.x += deltaX;
        game.player.position.y += deltaY;
        game.player.position.z += deltaZ;

        return {
            success: true,
            from: oldPos,
            to: {
                x: game.player.position.x,
                y: game.player.position.y,
                z: game.player.position.z
            },
            delta: { x: deltaX, y: deltaY, z: deltaZ }
        };
    }, dx, dy, dz);
}

/**
 * Warp to a specific entity by type or ID
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} entityType - Type of entity to warp to (e.g., 'Pig', 'Wolf')
 * @param {number} offset - Distance offset from entity (default: 5 blocks)
 */
export async function warpToEntity(browser, entityType, offset = 5) {
    return await executeInBrowser(browser, (type, dist) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.player || !game.animals) return { error: 'Game not ready' };

        // Find entity of matching type
        const entity = game.animals.find(a =>
            a.constructor.name.toLowerCase() === type.toLowerCase()
        );

        if (!entity || !entity.position) {
            return {
                error: `No ${type} found`,
                availableTypes: [...new Set(game.animals.map(a => a.constructor.name))]
            };
        }

        const targetPos = {
            x: entity.position.x + dist,
            y: entity.position.y + 2,
            z: entity.position.z
        };

        game.player.position.set(targetPos.x, targetPos.y, targetPos.z);

        return {
            success: true,
            entityType: entity.constructor.name,
            entityPosition: { x: entity.position.x, y: entity.position.y, z: entity.position.z },
            playerPosition: targetPos
        };
    }, entityType, offset);
}

// ========== VIDEO RECORDING COMMANDS ==========

/**
 * Start video recording using Puppeteer's screencast
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} outputPath - Path for output video file
 * @param {Object} options - Recording options
 */
export async function startRecording(browser, outputPath = 'recording.webm', options = {}) {
    const {
        width = 1280,
        height = 720,
        fps = 30
    } = options;

    // Store recorder on the browser object for later access
    try {
        const client = await browser.page.target().createCDPSession();

        // Start screencast
        await client.send('Page.startScreencast', {
            format: 'png',
            quality: 100,
            maxWidth: width,
            maxHeight: height,
            everyNthFrame: Math.round(60 / fps) // Adjust for target FPS
        });

        // Store frames
        browser._recordingFrames = [];
        browser._recordingClient = client;
        browser._recordingPath = outputPath;
        browser._recordingStartTime = Date.now();

        client.on('Page.screencastFrame', async (frame) => {
            browser._recordingFrames.push({
                data: frame.data,
                timestamp: Date.now()
            });
            // Acknowledge the frame
            await client.send('Page.screencastFrameAck', { sessionId: frame.sessionId });
        });

        console.log(`🎬 Recording started: ${outputPath}`);
        return {
            success: true,
            outputPath,
            width,
            height,
            fps,
            message: 'Recording started. Call stopRecording() when done.'
        };
    } catch (error) {
        return { error: `Failed to start recording: ${error.message}` };
    }
}

/**
 * Stop video recording and save to file
 * @param {Object} browser - Puppeteer browser instance
 */
export async function stopRecording(browser) {
    if (!browser._recordingClient) {
        return { error: 'No recording in progress' };
    }

    try {
        // Stop the screencast
        await browser._recordingClient.send('Page.stopScreencast');

        const duration = Date.now() - browser._recordingStartTime;
        const frameCount = browser._recordingFrames.length;
        const outputPath = browser._recordingPath;

        // Save frames as a GIF or individual PNGs (simpler approach)
        // For WebM, we'd need ffmpeg. Let's save as a sequence for now.
        const fs = await import('fs');
        const pathModule = await import('path');

        // Create output directory with absolute path
        const basePath = process.cwd();
        const dirName = outputPath.replace(/\.[^/.]+$/, '_frames');
        const absoluteDirPath = pathModule.default.isAbsolute(dirName) ? dirName : pathModule.default.join(basePath, dirName);

        console.log(`🎬 Saving frames to: ${absoluteDirPath}`);

        if (!fs.existsSync(absoluteDirPath)) {
            fs.mkdirSync(absoluteDirPath, { recursive: true });
        }

        // Save each frame
        for (let i = 0; i < browser._recordingFrames.length; i++) {
            const frame = browser._recordingFrames[i];
            const framePath = pathModule.default.join(absoluteDirPath, `frame_${String(i).padStart(5, '0')}.png`);
            fs.writeFileSync(framePath, Buffer.from(frame.data, 'base64'));
        }

        // Clean up browser state
        const savedFrameCount = browser._recordingFrames.length;
        browser._recordingFrames = [];
        browser._recordingClient = null;
        browser._recordingPath = null;
        browser._recordingStartTime = null;

        console.log(`🎬 Recording stopped: ${savedFrameCount} frames saved to ${absoluteDirPath}/`);
        return {
            success: true,
            frameCount: savedFrameCount,
            duration: duration,
            durationSeconds: (duration / 1000).toFixed(2),
            framesDirectory: absoluteDirPath,
            fps: (savedFrameCount / (duration / 1000)).toFixed(1),
            message: `Saved ${savedFrameCount} frames. Use ffmpeg to convert: ffmpeg -framerate 30 -i ${absoluteDirPath}/frame_%05d.png -c:v libx264 -pix_fmt yuv420p ${outputPath.replace('.webm', '.mp4')}`
        };
    } catch (error) {
        return { error: `Failed to stop recording: ${error.message}` };
    }
}

/**
 * Take a burst of screenshots over a duration
 * @param {Object} browser - Puppeteer browser instance
 * @param {number} durationMs - Duration in milliseconds
 * @param {number} intervalMs - Interval between shots
 * @param {string} prefix - Filename prefix
 */
export async function screenshotBurst(browser, durationMs = 3000, intervalMs = 100, prefix = 'burst') {
    const screenshots = [];
    const startTime = Date.now();
    let frameNum = 0;

    while (Date.now() - startTime < durationMs) {
        const path = `${prefix}_${String(frameNum).padStart(4, '0')}.png`;
        await browser.page.screenshot({ path });
        screenshots.push(path);
        frameNum++;
        await new Promise(r => setTimeout(r, intervalMs));
    }

    return {
        success: true,
        frameCount: screenshots.length,
        duration: durationMs,
        interval: intervalMs,
        files: screenshots
    };
}

// ========== OBJECT INTERACTION COMMANDS ==========

/**
 * Interact with the nearest entity or object (press F key)
 */
export async function interact(browser) {
    await browser.page.keyboard.press('KeyF');

    // Give time for interaction to process
    await new Promise(r => setTimeout(r, 100));

    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game) return { error: 'Game not ready' };

        // Get what player is looking at
        const targetBlock = game.physicsManager?.targetBlock;

        return {
            success: true,
            action: 'interact',
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
 * Use the currently held item (right-click action)
 * @param {Object} browser - Puppeteer browser instance
 * @param {Object} target - Optional target {x, y, z} for directional use
 */
export async function useItem(browser, target = null) {
    // If target specified, look at it first
    if (target) {
        await executeInBrowser(browser, (tx, ty, tz) => {
            const game = window.__VOXEL_GAME__;
            if (game?.camera) {
                game.camera.lookAt(tx, ty, tz);
            }
        }, target.x, target.y, target.z);
    }

    // Right-click to use
    await browser.page.mouse.click(640, 360, { button: 'right' });
    await new Promise(r => setTimeout(r, 100));

    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.inventoryManager) return { error: 'Game not ready' };

        const slot = game.inventoryManager.getSelectedItem();
        return {
            success: true,
            action: 'use',
            item: slot?.item || null,
            remaining: slot?.count || 0
        };
    });
}

/**
 * Pick up the nearest dropped item
 */
export async function pickupItem(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.player || !game.drops) return { error: 'Game not ready' };

        // Find nearest drop
        let nearestDrop = null;
        let nearestDist = Infinity;
        const playerPos = game.player.position;

        for (const drop of game.drops) {
            if (!drop.position) continue;
            const dist = playerPos.distanceTo(drop.position);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestDrop = drop;
            }
        }

        if (!nearestDrop) {
            return { error: 'No drops nearby', dropsCount: game.drops.length };
        }

        if (nearestDist > 5) {
            return {
                error: 'Drop too far',
                distance: nearestDist.toFixed(2),
                dropPosition: {
                    x: nearestDrop.position.x,
                    y: nearestDrop.position.y,
                    z: nearestDrop.position.z
                }
            };
        }

        // Move player to pickup position
        game.player.position.set(
            nearestDrop.position.x,
            nearestDrop.position.y + 1,
            nearestDrop.position.z
        );

        return {
            success: true,
            action: 'pickup',
            item: nearestDrop.blockType || 'unknown',
            distance: nearestDist.toFixed(2)
        };
    });
}

/**
 * Get information about the object the player is looking at
 */
export async function lookAt(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game) return { error: 'Game not ready' };

        const result = {
            block: null,
            entity: null,
            drop: null
        };

        // Check target block
        if (game.physicsManager?.targetBlock) {
            const tb = game.physicsManager.targetBlock;
            result.block = {
                x: tb.x,
                y: tb.y,
                z: tb.z,
                type: tb.type,
                face: game.physicsManager.targetFace
            };
        }

        // Check for nearby entities in view
        if (game.animals && game.camera) {
            const camPos = game.camera.position;
            const camDir = new window.THREE.Vector3();
            game.camera.getWorldDirection(camDir);

            for (const animal of game.animals) {
                if (!animal.position) continue;

                // Simple ray check - is entity roughly in front?
                const toEntity = animal.position.clone().sub(camPos);
                const dist = toEntity.length();
                if (dist > 50) continue; // Too far

                toEntity.normalize();
                const dot = camDir.dot(toEntity);
                if (dot > 0.9) { // Looking at it (within ~25 degrees)
                    result.entity = {
                        type: animal.constructor.name,
                        position: { x: animal.position.x, y: animal.position.y, z: animal.position.z },
                        distance: dist.toFixed(2),
                        health: animal.health
                    };
                    break;
                }
            }
        }

        // Check for drops
        if (game.drops) {
            const camPos = game.camera?.position;
            const camDir = new window.THREE.Vector3();
            game.camera?.getWorldDirection(camDir);

            for (const drop of game.drops) {
                if (!drop.position) continue;
                const toEntity = drop.position.clone().sub(camPos);
                const dist = toEntity.length();
                if (dist > 10) continue;

                toEntity.normalize();
                const dot = camDir.dot(toEntity);
                if (dot > 0.8) {
                    result.drop = {
                        type: drop.blockType,
                        position: { x: drop.position.x, y: drop.position.y, z: drop.position.z },
                        distance: dist.toFixed(2)
                    };
                    break;
                }
            }
        }

        return result;
    });
}

/**
 * Attack the nearest entity (left-click action)
 */
export async function attack(browser) {
    await browser.page.mouse.click(640, 360, { button: 'left' });
    await new Promise(r => setTimeout(r, 100));

    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        return {
            success: true,
            action: 'attack'
        };
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
 * Enter/exit a vehicle or mount (spaceship, horse, etc.)
 */
export async function mount(browser) {
    // Press F to interact (mount/dismount)
    await browser.page.keyboard.press('KeyF');
    await new Promise(r => setTimeout(r, 200));

    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.player) return { error: 'Game not ready' };

        return {
            success: true,
            action: 'mount/dismount',
            isMounted: game.player.isInVehicle || game.player.mountedEntity != null
        };
    });
}

/**
 * Look in a specific direction (set camera rotation)
 * @param {Object} browser - Puppeteer browser instance
 * @param {string|Object} direction - 'north', 'south', 'east', 'west', 'up', 'down' or {pitch, yaw}
 */
export async function lookDirection(browser, direction) {
    const directions = {
        north: { pitch: 0, yaw: Math.PI },
        south: { pitch: 0, yaw: 0 },
        east: { pitch: 0, yaw: -Math.PI / 2 },
        west: { pitch: 0, yaw: Math.PI / 2 },
        up: { pitch: -Math.PI / 2, yaw: 0 },
        down: { pitch: Math.PI / 2, yaw: 0 }
    };

    let rotation;
    if (typeof direction === 'string') {
        rotation = directions[direction.toLowerCase()];
        if (!rotation) {
            return { error: `Unknown direction: ${direction}`, available: Object.keys(directions) };
        }
    } else {
        rotation = direction;
    }

    return await executeInBrowser(browser, (pitch, yaw) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.camera) return { error: 'Game not ready' };

        game.camera.rotation.x = pitch;
        game.camera.rotation.y = yaw;

        return {
            success: true,
            pitch: pitch,
            yaw: yaw
        };
    }, rotation.pitch, rotation.yaw);
}

/**
 * Move player in a direction for a specified duration
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} direction - 'forward', 'backward', 'left', 'right'
 * @param {number} durationMs - How long to move
 */
export async function moveDirection(browser, direction, durationMs = 1000) {
    const keyMap = {
        forward: 'KeyW',
        backward: 'KeyS',
        left: 'KeyA',
        right: 'KeyD',
        up: 'Space',
        jump: 'Space'
    };

    const key = keyMap[direction.toLowerCase()];
    if (!key) {
        return { error: `Unknown direction: ${direction}`, available: Object.keys(keyMap) };
    }

    const startPos = await getPlayerPosition(browser);

    await browser.page.keyboard.down(key);
    await new Promise(r => setTimeout(r, durationMs));
    await browser.page.keyboard.up(key);

    const endPos = await getPlayerPosition(browser);

    return {
        success: true,
        direction,
        duration: durationMs,
        startPosition: startPos,
        endPosition: endPos,
        distance: startPos && endPos ? Math.sqrt(
            Math.pow(endPos.x - startPos.x, 2) +
            Math.pow(endPos.y - startPos.y, 2) +
            Math.pow(endPos.z - startPos.z, 2)
        ).toFixed(2) : null
    };
}

/**
 * Sprint in a direction
 */
export async function sprint(browser, direction = 'forward', durationMs = 2000) {
    const keyMap = {
        forward: 'KeyW',
        backward: 'KeyS',
        left: 'KeyA',
        right: 'KeyD'
    };

    const key = keyMap[direction.toLowerCase()];
    if (!key) {
        return { error: `Unknown direction: ${direction}` };
    }

    const startPos = await getPlayerPosition(browser);

    // Hold shift for sprint
    await browser.page.keyboard.down('ShiftLeft');
    await browser.page.keyboard.down(key);
    await new Promise(r => setTimeout(r, durationMs));
    await browser.page.keyboard.up(key);
    await browser.page.keyboard.up('ShiftLeft');

    const endPos = await getPlayerPosition(browser);

    return {
        success: true,
        action: 'sprint',
        direction,
        duration: durationMs,
        startPosition: startPos,
        endPosition: endPos
    };
}

/**
 * Toggle flying mode
 */
export async function toggleFlight(browser) {
    // Double-tap space for creative flight
    await browser.page.keyboard.press('Space');
    await new Promise(r => setTimeout(r, 100));
    await browser.page.keyboard.press('Space');
    await new Promise(r => setTimeout(r, 200));

    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.player) return { error: 'Game not ready' };

        return {
            success: true,
            isFlying: game.player.isFlying
        };
    });
}

/**
 * Fly up/down in creative mode
 */
export async function flyVertical(browser, direction = 'up', durationMs = 1000) {
    const key = direction === 'up' ? 'Space' : 'ShiftLeft';

    const startPos = await getPlayerPosition(browser);

    await browser.page.keyboard.down(key);
    await new Promise(r => setTimeout(r, durationMs));
    await browser.page.keyboard.up(key);

    const endPos = await getPlayerPosition(browser);

    return {
        success: true,
        direction,
        duration: durationMs,
        startY: startPos?.y,
        endY: endPos?.y,
        deltaY: endPos && startPos ? (endPos.y - startPos.y).toFixed(2) : null
    };
}

// Print helper for warp locations
export function printWarpLocations() {
    console.log(chalk.blue('\n═══ Available Warp Locations ═══'));
    for (const [name, pos] of Object.entries(WARP_LOCATIONS)) {
        console.log(`  ${chalk.cyan(name.padEnd(12))} → (${pos.x}, ${pos.y}, ${pos.z})`);
    }
}

// ========== VEHICLE / AIRPLANE FLIGHT COMMANDS ==========

/**
 * Get the player's current mount/vehicle info
 */
export async function getMountInfo(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.player) return { error: 'Game not ready' };

        const mount = game.player.mount;
        if (!mount) {
            return { mounted: false, mount: null };
        }

        // Get pitch/yaw from mount properties (Starfighter stores these directly)
        let pitch = mount.pitch ?? 0;
        let yaw = mount.yaw ?? 0;
        let roll = mount.roll ?? 0;

        // Calculate effective airspeed from velocity or currentSpeed
        let airspeed = mount.currentSpeed ?? 0;
        if (!airspeed && mount.velocity) {
            airspeed = Math.sqrt(
                mount.velocity.x * mount.velocity.x +
                mount.velocity.y * mount.velocity.y +
                mount.velocity.z * mount.velocity.z
            );
        }

        return {
            mounted: true,
            mountType: mount.constructor.name,
            position: mount.position ? {
                x: mount.position.x,
                y: mount.position.y,
                z: mount.position.z
            } : null,
            // Flight-specific properties
            throttle: mount.throttle ?? null,
            currentSpeed: mount.currentSpeed ?? null,
            airspeed: airspeed,
            pitch: pitch,
            roll: roll,
            yaw: yaw,
            boostIntensity: mount.boostIntensity ?? null,
            isStalling: mount.isStalling ?? false,
            isLanded: mount.isLanded ?? null
        };
    });
}

/**
 * Find and mount the nearest rideable entity (like MillenniumFalcon)
 */
export async function findAndMountShip(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.player || !game.animals) return { error: 'Game not ready' };

        // Find nearest rideable entity
        let nearestRideable = null;
        let nearestDist = Infinity;
        const playerPos = game.player.position;

        for (const animal of game.animals) {
            if (!animal.isRideable || !animal.position) continue;
            const dist = playerPos.distanceTo(animal.position);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestRideable = animal;
            }
        }

        if (!nearestRideable) {
            // List what we found
            const rideables = game.animals.filter(a => a.isRideable).map(a => a.constructor.name);
            return { error: 'No rideable entity found', availableRideables: rideables };
        }

        // Teleport player to the entity and mount it
        game.player.position.set(
            nearestRideable.position.x,
            nearestRideable.position.y + 2,
            nearestRideable.position.z
        );

        // Try to mount
        if (nearestRideable.interact) {
            nearestRideable.interact();
        } else if (game.player.mountEntity) {
            game.player.mountEntity(nearestRideable);
        }

        return {
            success: true,
            mountType: nearestRideable.constructor.name,
            distance: nearestDist.toFixed(2),
            mounted: game.player.mount === nearestRideable
        };
    });
}

/**
 * Dismount from current vehicle
 */
export async function dismount(browser) {
    await browser.page.keyboard.press('KeyF');
    await new Promise(r => setTimeout(r, 200));

    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.player) return { error: 'Game not ready' };

        return {
            success: true,
            mounted: game.player.mount != null
        };
    });
}

/**
 * Test airplane controls - apply control inputs and measure response
 * @param {Object} browser - Puppeteer browser instance
 * @param {Object} controls - Control inputs: { throttle, pitch, roll, duration }
 */
export async function testFlightControls(browser, controls = {}) {
    const {
        throttle = false,     // Hold space for throttle up
        throttleDown = false, // Hold shift for throttle down
        pitchUp = false,      // Hold W for pitch up
        pitchDown = false,    // Hold S for pitch down
        rollLeft = false,     // Hold A for roll left
        rollRight = false,    // Hold D for roll right
        duration = 2000       // How long to hold controls
    } = controls;

    // Get initial state
    const initialState = await getMountInfo(browser);
    if (!initialState.mounted) {
        return { error: 'Not mounted on a vehicle', initialState };
    }

    // Press the control keys
    const keysHeld = [];
    if (throttle) { await browser.page.keyboard.down('Space'); keysHeld.push('Space'); }
    if (throttleDown) { await browser.page.keyboard.down('ShiftLeft'); keysHeld.push('ShiftLeft'); }
    if (pitchUp) { await browser.page.keyboard.down('KeyW'); keysHeld.push('KeyW'); }
    if (pitchDown) { await browser.page.keyboard.down('KeyS'); keysHeld.push('KeyS'); }
    if (rollLeft) { await browser.page.keyboard.down('KeyA'); keysHeld.push('KeyA'); }
    if (rollRight) { await browser.page.keyboard.down('KeyD'); keysHeld.push('KeyD'); }

    // Sample state during flight
    const samples = [];
    const startTime = Date.now();
    const sampleInterval = 200; // Sample every 200ms

    while (Date.now() - startTime < duration) {
        const state = await getMountInfo(browser);
        if (state.mounted) {
            samples.push({
                time: Date.now() - startTime,
                throttle: state.throttle,
                airspeed: state.airspeed,
                pitch: state.pitch,
                roll: state.roll,
                altitude: state.position?.y,
                isStalling: state.isStalling
            });
        }
        await new Promise(r => setTimeout(r, sampleInterval));
    }

    // Release keys
    for (const key of keysHeld) {
        await browser.page.keyboard.up(key);
    }

    // Get final state
    const finalState = await getMountInfo(browser);

    // Analyze results
    const analysis = {
        initialAltitude: initialState.position?.y,
        finalAltitude: finalState.position?.y,
        altitudeChange: finalState.position?.y - initialState.position?.y,
        initialAirspeed: initialState.airspeed,
        finalAirspeed: finalState.airspeed,
        airspeedChange: finalState.airspeed - initialState.airspeed,
        initialThrottle: initialState.throttle,
        finalThrottle: finalState.throttle,
        maxPitch: Math.max(...samples.map(s => s.pitch || 0)),
        minPitch: Math.min(...samples.map(s => s.pitch || 0)),
        maxRoll: Math.max(...samples.map(s => s.roll || 0)),
        minRoll: Math.min(...samples.map(s => s.roll || 0)),
        stalledAtAnyPoint: samples.some(s => s.isStalling)
    };

    return {
        success: true,
        keysHeld,
        duration,
        sampleCount: samples.length,
        initialState,
        finalState,
        analysis,
        samples: samples.slice(-10) // Last 10 samples
    };
}

/**
 * Run a full Starfighter flight test sequence
 * Tests: Boost (Space), Brake (Shift), Pitch (W/S), Turn with bank (A/D)
 */
export async function runAirplaneFlightTest(browser) {
    const results = {
        mounted: false,
        tests: []
    };

    console.log(chalk.blue('\n═══ Starfighter Flight Test ═══'));
    console.log(chalk.dim('Controls: W/S = pitch, A/D = turn, Space = boost, Shift = brake\n'));

    // Step 1: Find and mount a ship
    console.log(chalk.cyan('1. Finding and mounting ship...'));
    const mountResult = await findAndMountShip(browser);
    if (mountResult.error) {
        console.log(chalk.red(`   ✗ ${mountResult.error}`));
        return { error: mountResult.error, results };
    }
    console.log(chalk.green(`   ✓ Mounted ${mountResult.mountType}`));
    results.mounted = true;

    await new Promise(r => setTimeout(r, 500)); // Let it settle

    // Step 2: Test boost (Space) - should increase speed
    console.log(chalk.cyan('\n2. Testing boost (Space)...'));
    const boostTest = await testFlightControls(browser, { throttle: true, duration: 2500 });
    results.tests.push({ name: 'boost', result: boostTest });
    if (boostTest.analysis) {
        const speedIncreased = boostTest.analysis.finalAirspeed > boostTest.analysis.initialAirspeed;
        console.log(speedIncreased ? chalk.green('   ✓ Speed increased (boosting)') : chalk.red('   ✗ Speed did not increase'));
        console.log(`     Speed: ${boostTest.analysis.initialAirspeed?.toFixed(1)} → ${boostTest.analysis.finalAirspeed?.toFixed(1)}`);
    }

    await new Promise(r => setTimeout(r, 300));

    // Step 3: Test pitch up (W) - should climb
    console.log(chalk.cyan('\n3. Testing pitch up (W) - should climb...'));
    const pitchUpTest = await testFlightControls(browser, { pitchUp: true, throttle: true, duration: 2500 });
    results.tests.push({ name: 'pitch_up', result: pitchUpTest });
    if (pitchUpTest.analysis) {
        const pitchIncreased = pitchUpTest.analysis.maxPitch > 0.2;
        const altitudeIncreased = pitchUpTest.analysis.altitudeChange > 1;
        console.log(pitchIncreased ? chalk.green('   ✓ Pitch increased (nose up)') : chalk.red('   ✗ Pitch did not increase'));
        console.log(altitudeIncreased ? chalk.green('   ✓ Altitude increased (climbing)') : chalk.yellow('   ~ Altitude change small'));
        console.log(`     Max pitch: ${(pitchUpTest.analysis.maxPitch * 180 / Math.PI).toFixed(1)}°`);
        console.log(`     Altitude change: ${pitchUpTest.analysis.altitudeChange?.toFixed(1)} blocks`);
    }

    await new Promise(r => setTimeout(r, 300));

    // Step 4: Test pitch down (S) - should descend
    console.log(chalk.cyan('\n4. Testing pitch down (S) - should descend...'));
    const pitchDownTest = await testFlightControls(browser, { pitchDown: true, duration: 2000 });
    results.tests.push({ name: 'pitch_down', result: pitchDownTest });
    if (pitchDownTest.analysis) {
        const pitchDecreased = pitchDownTest.analysis.minPitch < -0.2;
        console.log(pitchDecreased ? chalk.green('   ✓ Pitch decreased (nose down)') : chalk.red('   ✗ Pitch did not decrease'));
        console.log(`     Min pitch: ${(pitchDownTest.analysis.minPitch * 180 / Math.PI).toFixed(1)}°`);
        console.log(`     Altitude change: ${pitchDownTest.analysis.altitudeChange?.toFixed(1)} blocks`);
    }

    await new Promise(r => setTimeout(r, 300));

    // Step 5: Test turn left (A) - should bank and turn
    console.log(chalk.cyan('\n5. Testing turn left (A)...'));
    const turnLeftTest = await testFlightControls(browser, { rollLeft: true, throttle: true, duration: 2000 });
    results.tests.push({ name: 'turn_left', result: turnLeftTest });
    if (turnLeftTest.analysis) {
        const banked = turnLeftTest.analysis.minRoll < -0.1;
        console.log(banked ? chalk.green('   ✓ Ship banked left') : chalk.yellow('   ~ Banking not detected'));
        console.log(`     Roll range: ${(turnLeftTest.analysis.minRoll * 180 / Math.PI).toFixed(1)}° to ${(turnLeftTest.analysis.maxRoll * 180 / Math.PI).toFixed(1)}°`);
    }

    await new Promise(r => setTimeout(r, 300));

    // Step 6: Test turn right (D) - should bank and turn
    console.log(chalk.cyan('\n6. Testing turn right (D)...'));
    const turnRightTest = await testFlightControls(browser, { rollRight: true, throttle: true, duration: 2000 });
    results.tests.push({ name: 'turn_right', result: turnRightTest });
    if (turnRightTest.analysis) {
        const banked = turnRightTest.analysis.maxRoll > 0.1;
        console.log(banked ? chalk.green('   ✓ Ship banked right') : chalk.yellow('   ~ Banking not detected'));
        console.log(`     Roll range: ${(turnRightTest.analysis.minRoll * 180 / Math.PI).toFixed(1)}° to ${(turnRightTest.analysis.maxRoll * 180 / Math.PI).toFixed(1)}°`);
    }

    await new Promise(r => setTimeout(r, 300));

    // Step 7: Test brake (Shift) - should decrease speed
    console.log(chalk.cyan('\n7. Testing brake (Shift)...'));
    // First boost to get some speed
    await testFlightControls(browser, { throttle: true, duration: 1500 });
    const brakeTest = await testFlightControls(browser, { throttleDown: true, duration: 2000 });
    results.tests.push({ name: 'brake', result: brakeTest });
    if (brakeTest.analysis) {
        const speedDecreased = brakeTest.analysis.finalAirspeed < brakeTest.analysis.initialAirspeed;
        console.log(speedDecreased ? chalk.green('   ✓ Speed decreased (braking)') : chalk.red('   ✗ Speed did not decrease'));
        console.log(`     Speed: ${brakeTest.analysis.initialAirspeed?.toFixed(1)} → ${brakeTest.analysis.finalAirspeed?.toFixed(1)}`);
    }

    // Summary
    console.log(chalk.blue('\n═══ Test Summary ═══'));
    const passedTests = results.tests.filter(t => {
        const a = t.result?.analysis;
        if (!a) return false;
        switch (t.name) {
            case 'boost': return a.finalAirspeed > a.initialAirspeed;
            case 'pitch_up': return a.maxPitch > 0.2 || a.altitudeChange > 1;
            case 'pitch_down': return a.minPitch < -0.2;
            case 'turn_left': return a.minRoll < -0.05; // Visual bank
            case 'turn_right': return a.maxRoll > 0.05; // Visual bank
            case 'brake': return a.finalAirspeed < a.initialAirspeed;
            default: return true;
        }
    }).length;

    console.log(`Passed: ${passedTests}/${results.tests.length} tests`);

    // Dismount
    await dismount(browser);

    return results;
}

// ========== ITEM TESTING COMMANDS ==========

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
