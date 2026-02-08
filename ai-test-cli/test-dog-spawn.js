#!/usr/bin/env node
/**
 * Test Dog Spawn via Merlin Lua SDK
 */

import { GameBrowser } from './src/browser.js';
import chalk from 'chalk';

const GAME_URL = 'http://localhost:3000';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log(chalk.blue('🐕 Dog Spawn Test via Merlin Lua SDK'));
    console.log(chalk.gray('Testing: "create a big dog" -> execute_lua -> game\n'));

    const browser = new GameBrowser({ url: GAME_URL, headless: false, quiet: false });

    try {
        console.log(chalk.yellow('1. Launching browser...'));
        await browser.launch();

        console.log(chalk.yellow('2. Waiting for game init (10s)...'));
        await sleep(10000);

        // Check status
        const status = await browser.evaluate(() => {
            return {
                luaRuntime: !!window.LuaRuntime,
                merlinClient: !!window.merlinClient,
                connected: window.merlinClient?.isConnected,
                agent: !!window.__VOXEL_GAME__?.agent
            };
        });
        console.log(chalk.cyan('   Status:'), status);

        if (!status.connected) {
            console.log(chalk.red('   Merlin not connected!'));
            return;
        }

        // Count initial wolves (dogs)
        const initialWolves = await browser.evaluate(() => {
            const game = window.__VOXEL_GAME__;
            return game?.entities?.filter(e => e.type === 'Wolf' || e.constructor?.name === 'Wolf').length || 0;
        });
        console.log(chalk.cyan(`   Initial wolf count: ${initialWolves}`));

        // Send message to Merlin - ask for a dog
        console.log(chalk.yellow('\n3. Sending message: "create a big dog"'));
        await browser.evaluate(() => {
            const game = window.__VOXEL_GAME__;
            const pos = game?.player?.position || { x: 32, y: 35, z: 32 };

            window.merlinClient.send({
                type: 'input',
                text: 'create a big dog',
                context: { x: pos.x, y: pos.y, z: pos.z, worldId: 'global' }
            });
        });

        // Wait for AI response
        console.log(chalk.yellow('4. Waiting for AI response (15s)...'));

        // Log server messages as they come
        let codeExecuted = false;
        let luaCode = '';

        for (let i = 0; i < 30; i++) {
            await sleep(500);

            // Check for tool execution
            const toolStatus = await browser.evaluate(() => {
                const logs = window.__TOOL_LOGS__ || [];
                return logs;
            });

            // Check console for Lua execution
            const luaExecuted = await browser.evaluate(() => {
                // Check if LuaRuntime executed anything
                return window.__LAST_LUA_CODE__ || null;
            });

            if (luaExecuted && !codeExecuted) {
                codeExecuted = true;
                luaCode = luaExecuted;
                console.log(chalk.green('   ✓ Lua code detected!'));
            }
        }

        // Check if wolves were spawned
        const finalWolves = await browser.evaluate(() => {
            const game = window.__VOXEL_GAME__;
            const animals = game?.animals || [];
            const wolves = animals.filter(e => e.constructor?.name === 'Wolf');
            return {
                count: wolves.length,
                positions: wolves.slice(0, 3).map(w => ({
                    x: Math.round(w.position?.x || 0),
                    y: Math.round(w.position?.y || 0),
                    z: Math.round(w.position?.z || 0)
                }))
            };
        });
        console.log(chalk.cyan(`   Final wolf count: ${finalWolves.count}`));
        if (finalWolves.positions.length > 0) {
            console.log(chalk.cyan('   Wolf positions:'), finalWolves.positions);
        }

        // Check all animals
        const allAnimals = await browser.evaluate(() => {
            const game = window.__VOXEL_GAME__;
            const animals = game?.animals || [];
            const counts = {};
            animals.forEach(a => {
                const name = a.constructor?.name || 'Unknown';
                counts[name] = (counts[name] || 0) + 1;
            });
            return counts;
        });
        console.log(chalk.cyan('   All animals:'), allAnimals);

        // Results
        console.log(chalk.yellow('\n5. Results:'));
        if (finalWolves.count > initialWolves) {
            console.log(chalk.green(`   ✅ SUCCESS! Wolves increased from ${initialWolves} to ${finalWolves.count}`));
        } else {
            console.log(chalk.red(`   ❌ Wolves did not increase (${initialWolves} -> ${finalWolves.count})`));

            // Check server logs for what happened
            console.log(chalk.gray('   Checking what the AI actually did...'));
        }

    } catch (error) {
        console.error(chalk.red('❌ Test failed:'), error.message);
    } finally {
        console.log(chalk.yellow('\nClosing browser in 3s...'));
        await sleep(3000);
        await browser.close();
    }
}

runTest();
