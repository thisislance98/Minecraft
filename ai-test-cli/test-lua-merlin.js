#!/usr/bin/env node
/**
 * Test Lua SDK via Merlin AI
 * Sends a message to Merlin and verifies Lua code execution
 */

import { GameBrowser } from './src/browser.js';
import chalk from 'chalk';

const GAME_URL = 'http://localhost:3000';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log(chalk.blue('🧙 Merlin Lua SDK Test'));
    console.log(chalk.gray('Testing AI -> execute_lua -> game\n'));

    const browser = new GameBrowser({ url: GAME_URL, headless: false, quiet: false });

    try {
        // Launch browser
        console.log(chalk.yellow('1. Launching browser...'));
        await browser.launch();

        // Wait for game to fully initialize
        console.log(chalk.yellow('2. Waiting for game init (8s)...'));
        await sleep(8000);

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

        // Count initial pigs
        const initialPigs = await browser.evaluate(() => {
            const game = window.__VOXEL_GAME__;
            return game?.entities?.filter(e => e.type === 'Pig').length || 0;
        });
        console.log(chalk.cyan(`   Initial pig count: ${initialPigs}`));

        // Send message to Merlin
        console.log(chalk.yellow('\n3. Sending message: "spawn 2 pigs near me"'));
        await browser.evaluate(() => {
            const game = window.__VOXEL_GAME__;
            const pos = game?.player?.position || { x: 0, y: 60, z: 0 };

            window.merlinClient.send({
                type: 'input',
                text: 'spawn 2 pigs near me',
                context: { x: pos.x, y: pos.y, z: pos.z }
            });
        });

        // Wait for AI response and tool execution
        console.log(chalk.yellow('4. Waiting for AI response (10s)...'));
        await sleep(10000);

        // Check if pigs were spawned
        const finalPigs = await browser.evaluate(() => {
            const game = window.__VOXEL_GAME__;
            return game?.entities?.filter(e => e.type === 'Pig').length || 0;
        });
        console.log(chalk.cyan(`   Final pig count: ${finalPigs}`));

        // Get any chat messages
        const chatMessages = await browser.evaluate(() => {
            const chatEl = document.querySelector('.chat-messages, #chat-messages');
            if (!chatEl) return [];
            return Array.from(chatEl.querySelectorAll('.chat-message')).slice(-3).map(el => el.textContent?.substring(0, 100));
        });
        console.log(chalk.cyan('   Recent chat:'), chatMessages);

        // Results
        console.log(chalk.yellow('\n5. Results:'));
        if (finalPigs > initialPigs) {
            console.log(chalk.green(`   ✅ SUCCESS! Pigs increased from ${initialPigs} to ${finalPigs}`));
        } else {
            console.log(chalk.red(`   ❌ Pigs did not increase (${initialPigs} -> ${finalPigs})`));
            console.log(chalk.gray('   Check server logs for execute_lua tool calls'));
        }

    } catch (error) {
        console.error(chalk.red('❌ Test failed:'), error.message);
    } finally {
        console.log(chalk.yellow('\nClosing browser in 5s...'));
        await sleep(5000);
        await browser.close();
    }
}

runTest();
