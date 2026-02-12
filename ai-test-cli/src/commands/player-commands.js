/**
 * Player Commands
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
