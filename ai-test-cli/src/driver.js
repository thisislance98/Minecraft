import { SessionManager } from './session-manager.js';
import * as GameCommands from './game-commands.js';
import chalk from 'chalk';

/**
 * GameDriver - The "MCP Server" for game testing
 * Receives high-level JSON commands and orchestrates browser sessions.
 *
 * ADVANCED FEATURES:
 * - Warp to any location (named or coordinates)
 * - Video recording with screencast
 * - Full object interaction (use, pickup, place, mine, etc.)
 * - Movement controls (walk, sprint, fly)
 */
export class GameDriver {
    constructor() {
        this.sessionManager = new SessionManager();
        this.keepAlive = false;
    }

    /**
     * Get all available tools/commands
     */
    getAvailableTools() {
        return {
            session: ['browser_launch', 'browser_close', 'list_sessions'],
            navigation: ['warp', 'warp_relative', 'warp_to_entity', 'teleport', 'warp_locations'],
            movement: ['move', 'sprint', 'fly', 'fly_vertical', 'look_direction'],
            interaction: ['interact', 'use_item', 'pickup', 'attack', 'drop_item', 'place_block', 'mine_block', 'mount'],
            inventory: ['give_item', 'equip_item', 'get_inventory', 'select_slot', 'open_inventory', 'close_inventory'],
            recording: ['start_recording', 'stop_recording', 'screenshot', 'screenshot_burst'],
            spawning: ['spawn_creature', 'spawn_creature_at'],
            observation: ['get_game_state', 'get_position', 'look_at', 'get_entities', 'get_drops'],
            debug: ['debug_creatures', 'creature_errors', 'execute_script'],
            utility: ['wait', 'input_inject']
        };
    }

    /**
     * Execute a batch of tools/commands
     */
    async executeBatch(commands) {
        const results = [];
        for (const cmd of commands) {
            try {
                const result = await this.executeCommand(cmd);
                results.push({ command: cmd.tool, status: 'success', result });
            } catch (error) {
                console.error(chalk.red(`Error executing ${cmd.tool}:`), error.message);
                results.push({ command: cmd.tool, status: 'error', error: error.message });
                // Stop batch on error? Optional. For now continue.
            }
        }
        return results;
    }

    /**
     * Execute a single command
     * Command format: { tool: "name", session_id: "id", args: {} }
     */
    async executeCommand(cmd) {
        const { tool, session_id, args = {} } = cmd;

        console.log(chalk.cyan(`[Driver] Executing: ${tool} ${session_id ? `on ${session_id}` : ''}`));

        // --- SESSION TOOLS ---
        if (tool === 'browser_launch') {
            return await this.sessionManager.startSession({
                id: session_id, // Optional, auto-generated if missing
                headless: args.headless,
                gameUrl: args.gameUrl
            });
        }

        if (tool === 'browser_close') {
            if (session_id === 'all') {
                await this.sessionManager.stopAll();
                return { closed: 'all' };
            }
            return await this.sessionManager.stopSession(session_id);
        }

        if (tool === 'list_sessions') {
            return this.sessionManager.getActiveSessions();
        }

        if (tool === 'help' || tool === 'list_tools') {
            return this.getAvailableTools();
        }

        if (tool === 'warp_locations') {
            return GameCommands.getWarpLocations();
        }

        // --- GAME TOOLS ---
        // tools below require a valid session_id
        if (!session_id && this.sessionManager.getActiveSessions().length === 1) {
            // Auto-target the only session if not specified
            const singleSession = this.sessionManager.getActiveSessions()[0];
            cmd.session_id = singleSession;
        }

        const browser = this.sessionManager.getSession(cmd.session_id);

        switch (tool) {
            // ==================== SCREENSHOTS & RECORDING ====================
            case 'screenshot':
                await browser.screenshot(args.path || `${cmd.session_id}_screenshot.png`);
                return { path: args.path || `${cmd.session_id}_screenshot.png` };

            case 'screenshot_burst':
                return await GameCommands.screenshotBurst(
                    browser,
                    args.duration || 3000,
                    args.interval || 100,
                    args.prefix || 'burst'
                );

            case 'start_recording':
                return await GameCommands.startRecording(browser, args.path || 'recording.webm', {
                    width: args.width || 1280,
                    height: args.height || 720,
                    fps: args.fps || 30
                });

            case 'stop_recording':
                return await GameCommands.stopRecording(browser);

            // ==================== WARP / TELEPORT ====================
            case 'warp':
                // Warp to named location or coordinates
                // Usage: warp destination="desert" OR warp destination="100,50,200"
                return await GameCommands.warp(browser, args.destination || args.location || args.to);

            case 'warp_relative':
                return await GameCommands.warpRelative(
                    browser,
                    args.dx || args.x || 0,
                    args.dy || args.y || 0,
                    args.dz || args.z || 0
                );

            case 'warp_to_entity':
                return await GameCommands.warpToEntity(browser, args.type || args.entity, args.offset || 5);

            case 'teleport':
                // Backward compatible: exact coordinates
                return await GameCommands.teleportPlayer(browser, args.x, args.y, args.z);

            // ==================== MOVEMENT ====================
            case 'move':
                return await GameCommands.moveDirection(browser, args.direction, args.duration || 1000);

            case 'sprint':
                return await GameCommands.sprint(browser, args.direction || 'forward', args.duration || 2000);

            case 'fly':
            case 'toggle_flight':
                return await GameCommands.toggleFlight(browser);

            case 'fly_vertical':
                return await GameCommands.flyVertical(browser, args.direction || 'up', args.duration || 1000);

            case 'look_direction':
                return await GameCommands.lookDirection(browser, args.direction);

            case 'look_at':
                // Rotate player to look at a point
                return await browser.evaluate((x, y, z) => {
                    const game = window.__VOXEL_GAME__;
                    if (game && game.camera) {
                        game.camera.lookAt(x, y, z);
                        return { success: true, target: { x, y, z } };
                    }
                    return { error: 'Camera not found' };
                }, args.x, args.y, args.z);

            case 'move_to':
                return await GameCommands.teleportPlayer(browser, args.x, args.y, args.z);

            // ==================== OBJECT INTERACTION ====================
            case 'interact':
                return await GameCommands.interact(browser);

            case 'use_item':
            case 'use':
                return await GameCommands.useItem(browser, args.target ? { x: args.x, y: args.y, z: args.z } : null);

            case 'pickup':
            case 'pickup_item':
                return await GameCommands.pickupItem(browser);

            case 'attack':
                return await GameCommands.attack(browser);

            case 'drop_item':
            case 'drop':
                return await GameCommands.dropItem(browser);

            case 'place_block':
            case 'place':
                return await GameCommands.placeBlock(browser, args.block || args.type);

            case 'mine_block':
            case 'mine':
            case 'break_block':
                return await GameCommands.mineBlock(browser);

            case 'mount':
            case 'dismount':
                return await GameCommands.mount(browser);

            // ==================== INVENTORY ====================
            case 'give_item':
                return await GameCommands.giveItem(browser, args.item, args.count || 1);

            case 'equip_item':
            case 'equip':
                return await GameCommands.equipItem(browser, args.item);

            case 'get_inventory':
                return await GameCommands.getInventory(browser);

            case 'select_slot':
                return await GameCommands.selectSlot(browser, args.slot || args.index || 0);

            case 'open_inventory':
                return await GameCommands.openInventory(browser);

            case 'close_inventory':
                return await GameCommands.closeInventory(browser);

            // ==================== SPAWNING ====================
            case 'spawn_creature':
            case 'spawn':
                return await GameCommands.spawnCreature(browser, args.type || args.creature, args.count || 1);

            case 'spawn_creature_at':
            case 'spawn_at':
                return await GameCommands.spawnCreatureAt(browser, args.type || args.creature, args.x, args.y, args.z);

            // ==================== OBSERVATION ====================
            case 'get_game_state':
            case 'state':
                return await GameCommands.getGameState(browser);

            case 'get_position':
            case 'position':
            case 'pos':
                return await GameCommands.getPlayerPosition(browser);

            case 'get_entities':
            case 'entities':
                return await GameCommands.getEntities(browser);

            case 'get_drops':
            case 'drops':
                return await GameCommands.getDrops(browser);

            case 'what_am_i_looking_at':
            case 'target':
                return await GameCommands.lookAt(browser);

            // ==================== UTILITY ====================
            case 'wait':
                await new Promise(r => setTimeout(r, args.ms || 1000));
                return { waited: args.ms || 1000 };

            case 'input_inject':
            case 'input':
                if (args.type === 'click') {
                    if (args.button === 'right') return await GameCommands.rightClick(browser, args.x, args.y);
                    return await GameCommands.leftClick(browser, args.x, args.y);
                }
                if (args.type === 'key') {
                    return await GameCommands.pressKey(browser, args.key);
                }
                return { error: 'Unknown input type. Use type="click" or type="key"' };

            case 'execute_script':
            case 'exec':
                const script = args.code;
                return await browser.evaluate((code) => {
                    try {
                        const fn = new Function('game', 'window', `return (${code})`);
                        return fn(window.__VOXEL_GAME__, window);
                    } catch (e) {
                        return { error: e.toString() };
                    }
                }, script);

            // ==================== DEBUG ====================
            case 'debug_creatures':
                return await GameCommands.getDynamicCreatureInfo(browser);

            case 'creature_errors':
                return await GameCommands.getCreatureErrors(browser);

            default:
                return {
                    error: `Unknown tool: ${tool}`,
                    hint: 'Use tool="help" to list all available tools',
                    availableTools: Object.keys(this.getAvailableTools()).flatMap(cat => this.getAvailableTools()[cat])
                };
        }
    }

    /**
     * Start interactive loop (REPL)
     */
    async startInteractive() {
        console.log(chalk.blue('Game Driver Interactive Mode'));
        console.log(chalk.dim('Enter JSON commands to execute. Example: {"tool":"browser_launch"}'));

        const readline = await import('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'driver> '
        });

        rl.prompt();

        rl.on('line', async (line) => {
            const trimmed = line.trim();
            if (!trimmed) {
                rl.prompt();
                return;
            }

            try {
                // Heuristic: If it looks like JSON, parse it.
                // If not, treat as "tool arg1 arg2" syntax? 
                // Let's stick to JSON for maximum power first, or simple simplified syntax
                let cmd;
                if (trimmed.startsWith('{')) {
                    cmd = JSON.parse(trimmed);
                } else {
                    // Simple syntax: tool key=value session=id
                    const [toolName, ...rest] = trimmed.split(' ');
                    const args = {};
                    let sessionId = null;

                    for (const part of rest) {
                        if (part.includes('=')) {
                            const [k, v] = part.split('=');
                            if (k === 'session' || k === 'session_id') {
                                sessionId = v;
                            } else {
                                // Try number
                                args[k] = isNaN(v) ? v : parseFloat(v);
                            }
                        }
                    }
                    cmd = { tool: toolName, session_id: sessionId, args };
                }

                if (cmd.tool === 'exit') {
                    await this.sessionManager.stopAll();
                    process.exit(0);
                }

                const result = await this.executeCommand(cmd);
                console.log(JSON.stringify(result, null, 2));

            } catch (e) {
                console.error(chalk.red('Error:'), e.message);
            }
            rl.prompt();
        });
    }
}
