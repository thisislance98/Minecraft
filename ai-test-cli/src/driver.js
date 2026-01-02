import { SessionManager } from './session-manager.js';
import * as GameCommands from './game-commands.js';
import chalk from 'chalk';

/**
 * GameDriver - The "MCP Server" for game testing
 * Receives high-level JSON commands and orchestrates browser sessions.
 */
export class GameDriver {
    constructor() {
        this.sessionManager = new SessionManager();
        this.keepAlive = false;
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

        // --- GAME TOOLS ---
        // tools below require a valid session_id
        if (!session_id && this.sessionManager.getActiveSessions().length === 1) {
            // Auto-target the only session if not specified
            const singleSession = this.sessionManager.getActiveSessions()[0];
            // We can optionally auto-assign, but strict mode is better for now.
            // throw new Error('Session ID required');
            // Let's implement auto-target for convenience
            cmd.session_id = singleSession;
        }

        const browser = this.sessionManager.getSession(cmd.session_id);

        switch (tool) {
            case 'screenshot':
                await browser.screenshot(args.path || `${cmd.session_id}_screenshot.png`);
                return { path: args.path || `${cmd.session_id}_screenshot.png` };

            case 'get_game_state':
                return await GameCommands.getGameState(browser);

            case 'spawn_creature':
                return await GameCommands.spawnCreature(browser, args.type, args.count);

            case 'give_item':
                return await GameCommands.giveItem(browser, args.item, args.count);

            case 'teleport':
                return await GameCommands.teleportPlayer(browser, args.x, args.y, args.z);

            case 'look_at':
                // New tool: Rotate player to look at a point
                return await browser.evaluate((x, y, z) => {
                    const game = window.__VOXEL_GAME__;
                    if (game && game.player) {
                        game.player.controls.lookAt(new window.THREE.Vector3(x, y, z));
                        return { success: true };
                    }
                    return { error: 'Player not found' };
                }, args.x, args.y, args.z);

            case 'move_to':
                // New tool: Simple teleport for now, can be pathfinding later
                return await GameCommands.teleportPlayer(browser, args.x, args.y, args.z);

            case 'wait':
                await new Promise(r => setTimeout(r, args.ms || 1000));
                return { waited: args.ms };

            case 'wait_for_log':
                // Block until specific log message
                // Implementation requires enhanced browser.js hooking
                // For now, simpler timeout-based check
                return { error: 'Not implemented yet' };

            case 'input_inject':
                // Generic input: { type: 'click'|'key', code: 'KeyW' }
                if (args.type === 'click') {
                    if (args.button === 'right') return await GameCommands.rightClick(browser, args.x, args.y);
                    return await GameCommands.leftClick(browser, args.x, args.y);
                }
                if (args.type === 'key') {
                    return await GameCommands.pressKey(browser, args.key);
                }
                return { error: 'Unknown input type' };

            case 'execute_script':
                // Dangerous but powerful: execute arbitrary JS
                const script = args.code;
                return await browser.evaluate((code) => {
                    // Wrap in localized scope
                    try {
                        // Limited usage: we just use Function constructor or simple eval
                        // It's a test tool, so security is less critical (local only)
                        const fn = new Function('game', 'window', `return (${code})`);
                        return fn(window.__VOXEL_GAME__, window);
                    } catch (e) {
                        return { error: e.toString() };
                    }
                }, script);

            default:
                throw new Error(`Unknown tool: ${tool}`);
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
