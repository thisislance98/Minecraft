/**
 * Warp Commands
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

export function printWarpLocations() {
    console.log(chalk.blue('\n═══ Available Warp Locations ═══'));
    for (const [name, pos] of Object.entries(WARP_LOCATIONS)) {
        console.log(`  ${chalk.cyan(name.padEnd(12))} → (${pos.x}, ${pos.y}, ${pos.z})`);
    }
}
