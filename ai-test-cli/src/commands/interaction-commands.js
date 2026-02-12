/**
 * Interaction Commands
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
