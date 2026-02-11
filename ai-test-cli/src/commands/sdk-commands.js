/**
 * Sdk Commands
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

export async function sdkCreate(browser, config) {
    return await executeInBrowser(browser, (cfg) => {
        const vw = window.VoxelWorld;
        if (!vw) return { error: 'VoxelWorld SDK not initialized' };
        if (!cfg || !cfg.name) return { error: 'Config must have a name' };

        try {
            const obj = vw.createObject(cfg.name);

            // Attach scripts from config
            if (cfg.scripts && Array.isArray(cfg.scripts)) {
                for (const scriptConfig of cfg.scripts) {
                    const { type, ...rest } = scriptConfig;
                    if (!type) continue;
                    obj.attach(type, rest);
                }
            }

            // Register the object
            obj.register();

            return {
                success: true,
                name: cfg.name,
                id: obj.id,
                scriptsAttached: cfg.scripts?.length || 0,
                isItem: vw._items.has(obj.id),
                isEntity: vw._entities.has(obj.id)
            };
        } catch (e) {
            return { error: `Failed to create object: ${e.message}` };
        }
    }, config);
}

/**
 * Spawn a registered SDK object into the world
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} id - Object ID to spawn
 * @param {number} x, y, z - World position
 * @param {Object} options - Spawn options (velocity, etc.)
 */
export async function sdkSpawn(browser, id, x, y, z, options = {}) {
    return await executeInBrowser(browser, (objId, px, py, pz, opts) => {
        const vw = window.VoxelWorld;
        if (!vw) return { error: 'VoxelWorld SDK not initialized' };

        // If position not provided, spawn in front of player
        const game = window.__VOXEL_GAME__;
        let spawnX = px, spawnY = py, spawnZ = pz;

        if (spawnX === undefined || spawnX === null) {
            if (game?.player?.position && game?.camera) {
                // Get camera forward direction
                const dir = new window.THREE.Vector3();
                game.camera.getWorldDirection(dir);

                // Spawn 8 blocks in front of player, at eye level
                const distance = 8;
                spawnX = game.player.position.x + dir.x * distance;
                spawnY = game.player.position.y + 1.5; // Eye level
                spawnZ = game.player.position.z + dir.z * distance;
            } else {
                spawnX = 0;
                spawnY = 50;
                spawnZ = 0;
            }
        }

        try {
            const instance = vw.spawn(objId, spawnX, spawnY, spawnZ, opts);

            if (!instance) {
                return {
                    error: `Failed to spawn '${objId}'`,
                    availableObjects: Array.from(vw._objects.keys()).slice(0, 20)
                };
            }

            return {
                success: true,
                objectId: objId,
                position: { x: spawnX, y: spawnY, z: spawnZ },
                instanceId: instance.id || null,
                instanceCount: vw._instances.size
            };
        } catch (e) {
            return { error: `Spawn failed: ${e.message}` };
        }
    }, id, x, y, z, options);
}

/**
 * Give an SDK item to the player
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} id - Item ID
 * @param {number} count - Number of items
 */
export async function sdkGive(browser, id, count = 1) {
    return await executeInBrowser(browser, (itemId, itemCount) => {
        const vw = window.VoxelWorld;
        if (!vw) return { error: 'VoxelWorld SDK not initialized' };

        // Check if item is registered
        if (!vw._items.has(itemId)) {
            return {
                error: `Item '${itemId}' not found in SDK registry`,
                availableItems: Array.from(vw._items.keys()).slice(0, 20)
            };
        }

        const success = vw.giveItem(itemId, itemCount);

        return {
            success,
            itemId,
            count: itemCount,
            message: success ? `Gave ${itemCount}x ${itemId} to player` : 'Failed to give item'
        };
    }, id, count);
}

/**
 * Set a single block using the SDK
 * @param {Object} browser - Puppeteer browser instance
 * @param {number} x, y, z - Block position
 * @param {string} type - Block type (e.g., 'stone', 'brick', null to remove)
 */
export async function sdkSetBlock(browser, x, y, z, type) {
    return await executeInBrowser(browser, (bx, by, bz, blockType) => {
        const vw = window.VoxelWorld;
        if (!vw) return { error: 'VoxelWorld SDK not initialized' };

        try {
            const success = vw.setBlock(bx, by, bz, blockType);
            return {
                success,
                position: { x: bx, y: by, z: bz },
                type: blockType,
                action: blockType === null ? 'removed' : 'placed'
            };
        } catch (e) {
            return { error: `Failed to set block: ${e.message}` };
        }
    }, x, y, z, type);
}

/**
 * Fill a region with blocks using the SDK
 * @param {Object} browser - Puppeteer browser instance
 * @param {number} x1, y1, z1 - Start corner
 * @param {number} x2, y2, z2 - End corner
 * @param {string} type - Block type
 */
export async function sdkFill(browser, x1, y1, z1, x2, y2, z2, type) {
    return await executeInBrowser(browser, (bx1, by1, bz1, bx2, by2, bz2, blockType) => {
        const vw = window.VoxelWorld;
        if (!vw) return { error: 'VoxelWorld SDK not initialized' };

        try {
            const result = vw.fill(bx1, by1, bz1, bx2, by2, bz2, blockType);
            return {
                success: result.success,
                blocksPlaced: result.count,
                type: blockType,
                region: {
                    from: { x: bx1, y: by1, z: bz1 },
                    to: { x: bx2, y: by2, z: bz2 }
                }
            };
        } catch (e) {
            return { error: `Failed to fill region: ${e.message}` };
        }
    }, x1, y1, z1, x2, y2, z2, type);
}

/**
 * Spawn a tree using the SDK
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} type - Tree type (oak, birch, pine, etc.)
 * @param {number} x, y, z - Position
 */
export async function sdkSpawnTree(browser, type, x, y, z) {
    return await executeInBrowser(browser, (treeType, tx, ty, tz) => {
        const vw = window.VoxelWorld;
        if (!vw) return { error: 'VoxelWorld SDK not initialized' };

        // If position not provided, use player position
        const game = window.__VOXEL_GAME__;
        let spawnX = tx, spawnY = ty, spawnZ = tz;

        if (spawnX === undefined || spawnX === null) {
            if (game?.player?.position) {
                spawnX = Math.floor(game.player.position.x) + 10;
                spawnY = Math.floor(game.player.position.y);
                spawnZ = Math.floor(game.player.position.z);
            } else {
                spawnX = 0;
                spawnY = 50;
                spawnZ = 0;
            }
        }

        try {
            const result = vw.spawnTree(treeType, spawnX, spawnY, spawnZ);
            return result;
        } catch (e) {
            return {
                error: `Failed to spawn tree: ${e.message}`,
                availableTypes: vw.getTreeTypes()
            };
        }
    }, type, x, y, z);
}

/**
 * Find objects in radius using the SDK
 * @param {Object} browser - Puppeteer browser instance
 * @param {number} x, y, z - Center position (or player position if not specified)
 * @param {number} radius - Search radius
 */
export async function sdkFindInRadius(browser, x, y, z, radius = 50) {
    return await executeInBrowser(browser, (cx, cy, cz, r) => {
        const vw = window.VoxelWorld;
        if (!vw) return { error: 'VoxelWorld SDK not initialized' };

        const game = window.__VOXEL_GAME__;

        // Use player position if not specified
        let centerX = cx, centerY = cy, centerZ = cz;
        if (centerX === undefined || centerX === null) {
            if (game?.player?.position) {
                centerX = game.player.position.x;
                centerY = game.player.position.y;
                centerZ = game.player.position.z;
            } else {
                return { error: 'No position specified and no player found' };
            }
        }

        try {
            const results = vw.findInRadius({ x: centerX, y: centerY, z: centerZ }, r);

            return {
                success: true,
                center: { x: centerX, y: centerY, z: centerZ },
                radius: r,
                count: results.length,
                objects: results.slice(0, 20).map(obj => ({
                    name: obj.name || obj.constructor.name,
                    id: obj.id,
                    position: obj.position ? {
                        x: Math.round(obj.position.x),
                        y: Math.round(obj.position.y),
                        z: Math.round(obj.position.z)
                    } : null,
                    type: obj.constructor.name
                }))
            };
        } catch (e) {
            return { error: `Find failed: ${e.message}` };
        }
    }, x, y, z, radius);
}

/**
 * List available block and tree types from the SDK
 * @param {Object} browser - Puppeteer browser instance
 */
export async function sdkListTypes(browser) {
    return await executeInBrowser(browser, () => {
        const vw = window.VoxelWorld;
        if (!vw) return { error: 'VoxelWorld SDK not initialized' };

        return {
            trees: vw.getTreeTypes(),
            blocks: vw.getBlockTypes(),
            registeredObjects: Array.from(vw._objects.keys()),
            registeredItems: Array.from(vw._items.keys()),
            registeredEntities: Array.from(vw._entities.keys())
        };
    });
}

/**
 * Get all active SDK instances in the world
 * @param {Object} browser - Puppeteer browser instance
 */
export async function sdkGetInstances(browser) {
    return await executeInBrowser(browser, () => {
        const vw = window.VoxelWorld;
        if (!vw) return { error: 'VoxelWorld SDK not initialized' };

        const instances = [];
        for (const instance of vw._instances) {
            instances.push({
                name: instance.name,
                id: instance.id,
                position: instance.position ? {
                    x: Math.round(instance.position.x),
                    y: Math.round(instance.position.y),
                    z: Math.round(instance.position.z)
                } : null,
                destroyed: instance._destroyed || false,
                scripts: instance._scripts?.map(s => s.constructor.name) || []
            });
        }

        return {
            count: instances.length,
            instances
        };
    });
}

/**
 * Test a complete SDK workflow: create object, register, spawn/give, verify
 * @param {Object} browser - Puppeteer browser instance
 * @param {Object} config - Test configuration
 */
export async function sdkTestWorkflow(browser, config) {
    const results = {
        steps: [],
        passed: 0,
        failed: 0
    };

    // Step 1: Create and register the object
    console.log(chalk.cyan('  1. Creating SDK object...'));
    const createResult = await sdkCreate(browser, config);
    results.steps.push({ step: 'create', result: createResult });

    if (createResult.success) {
        results.passed++;
        console.log(chalk.green(`     ✓ Created: ${config.name}`));
    } else {
        results.failed++;
        console.log(chalk.red(`     ✗ Failed: ${createResult.error}`));
        return results;
    }

    // Step 2: Verify it's in the registry
    const registryCheck = await executeInBrowser(browser, (name) => {
        const vw = window.VoxelWorld;
        return {
            inObjects: vw._objects.has(name),
            inItems: vw._items.has(name),
            inEntities: vw._entities.has(name)
        };
    }, createResult.id);
    results.steps.push({ step: 'registry', result: registryCheck });

    if (registryCheck.inObjects) {
        results.passed++;
        console.log(chalk.green('     ✓ Object registered'));
    } else {
        results.failed++;
        console.log(chalk.red('     ✗ Object not in registry'));
    }

    // Step 3: If it's an item, give it to the player
    if (createResult.isItem) {
        console.log(chalk.cyan('  2. Giving item to player...'));
        const giveResult = await sdkGive(browser, createResult.id, 1);
        results.steps.push({ step: 'give', result: giveResult });

        if (giveResult.success) {
            results.passed++;
            console.log(chalk.green(`     ✓ Item given to player`));
        } else {
            results.failed++;
            console.log(chalk.red(`     ✗ Failed to give item: ${giveResult.error}`));
        }

        // Verify it's in inventory
        const invCheck = await checkItemInInventory(browser, createResult.id);
        results.steps.push({ step: 'inventory', result: invCheck });

        if (invCheck.found) {
            results.passed++;
            console.log(chalk.green(`     ✓ Item in inventory (slot ${invCheck.slots[0]?.slot})`));
        } else {
            results.failed++;
            console.log(chalk.red('     ✗ Item not found in inventory'));
        }
    }

    // Step 4: If it's an entity, spawn it
    if (createResult.isEntity) {
        console.log(chalk.cyan('  2. Spawning entity...'));
        const spawnResult = await sdkSpawn(browser, createResult.id);
        results.steps.push({ step: 'spawn', result: spawnResult });

        if (spawnResult.success) {
            results.passed++;
            console.log(chalk.green(`     ✓ Entity spawned at (${spawnResult.position.x}, ${spawnResult.position.y}, ${spawnResult.position.z})`));
        } else {
            results.failed++;
            console.log(chalk.red(`     ✗ Failed to spawn: ${spawnResult.error}`));
        }
    }

    results.allPassed = results.failed === 0;
    results.summary = `${results.passed}/${results.steps.length} steps passed`;

    return results;
}

/**
 * Print SDK test results
 * @param {Object} results - Results from sdkTestWorkflow
 */
export function printSdkTestResults(results) {
    console.log(chalk.blue('\n═══ SDK Test Results ═══'));
    console.log(`Status: ${results.allPassed ? chalk.green('PASSED') : chalk.red('FAILED')}`);
    console.log(`Summary: ${results.summary}`);

    console.log(chalk.cyan('\nSteps:'));
    for (const { step, result } of results.steps) {
        const status = result.success || result.found || result.inObjects ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${status} ${step}`);
    }
    console.log();
}
