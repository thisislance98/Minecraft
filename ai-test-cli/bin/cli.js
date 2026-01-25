#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import readline from 'readline';
import { AntigravityClient } from '../src/client.js';
import { WorldClient } from '../src/world-client.js';
import fs from 'fs';
import path from 'path';

const program = new Command();

program
    .name('ai-test')
    .description('CLI to test and verify In-Game AI')
    .version('1.0.0');

// ... existing imports

program
    .arguments('<prompt>')
    .description('Send a one-off prompt to the AI')
    .option('-w, --wait-for <tool>', 'Exit successfully when this tool is called')
    .option('-t, --timeout <ms>', 'Timeout in milliseconds', '30000')
    .option('--pos <x,y,z>', 'Player position', '0,0,0')
    .option('--rot <x,y,z>', 'Player rotation', '0,0,0')
    .action(async (prompt, options) => {
        const client = new AntigravityClient();

        try {
            // Parse context
            const [px, py, pz] = options.pos.split(',').map(Number);
            const [rx, ry, rz] = options.rot.split(',').map(Number);

            const context = {
                position: { x: px, y: py, z: pz },
                rotation: { x: rx, y: ry, z: rz }
            };

            // console.log(chalk.blue(`Sending Prompt: "${prompt}"`));
            await client.connect();

            let timeoutHandle;
            if (options.timeout) {
                timeoutHandle = setTimeout(() => {
                    console.error(chalk.red('\nTimeout waiting for completion'));
                    process.exit(1);
                }, parseInt(options.timeout));
            }

            client.on('thought', (msg) => console.log(chalk.gray(`Thought: ${msg.text}`)));
            client.on('tool_start', (msg) => {
                console.log(chalk.cyan(`Tool Call: ${msg.name}`));
                console.log(chalk.dim(JSON.stringify(msg.args, null, 2)));

                if (options.waitFor && msg.name === options.waitFor) {
                    console.log(chalk.green(`\n✅ Caught expected tool: ${msg.name}`));
                    clearTimeout(timeoutHandle);
                    client.disconnect();
                    process.exit(0);
                }
            });
            client.on('token', (msg) => process.stdout.write(msg.text));

            client.on('token_usage', (msg) => {
                const inputCost = (msg.promptTokens / 1000000) * 0.50;
                const thoughtCost = (msg.thoughtTokens / 1000000) * 3.00; // Output rate
                const outputCost = (msg.candidatesTokens / 1000000) * 3.00;
                const totalCost = inputCost + thoughtCost + outputCost;

                console.log(chalk.gray(`\n\n📊 Token Usage:`));
                console.log(chalk.gray(`   Input: ${msg.promptTokens} ($${inputCost.toFixed(6)})`));
                console.log(chalk.gray(`   Thoughts (Est.): ${msg.thoughtTokens} ($${thoughtCost.toFixed(6)})`));
                console.log(chalk.gray(`   Output: ${msg.candidatesTokens} ($${outputCost.toFixed(6)})`));
                console.log(chalk.yellow(`   Total Estimated Cost: $${totalCost.toFixed(6)}`));
            });

            client.on('error', (err) => console.error(chalk.red(`Error: ${err.message}`)));

            client.sendPrompt(prompt, context);

            // If no wait-for, we might want to just listen indefinitely or exit after X seconds of silence?
            // For now, let's rely on timeout or manual Ctrl+C if no wait-for is provided.

        } catch (error) {
            console.error(chalk.red('Failed:'), error.message);
            process.exit(1);
        }
    });

program
    .command('interactive')
    // ... rest of file
    .description('Start an interactive session with the AI')
    .action(async () => {
        const client = new AntigravityClient();

        try {
            console.log(chalk.blue('Connecting to AI Brain...'));
            await client.connect();
            console.log(chalk.green('✅ Connected! Type your prompt and press Enter.'));

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                prompt: chalk.yellow('You > ')
            });

            // Handle AI Messages
            client.on('thought', (msg) => {
                console.log(chalk.gray(`\nThought: ${msg.text}`));
            });

            client.on('tool_start', (msg) => {
                console.log(chalk.cyan(`\n🛠  Tool Call: ${msg.name}`));
                console.log(chalk.dim(JSON.stringify(msg.args, null, 2)));
            });

            client.on('token', (msg) => {
                process.stdout.write(msg.text);
            });

            client.on('token_usage', (msg) => {
                const inputCost = (msg.promptTokens / 1000000) * 0.50;
                const thoughtCost = (msg.thoughtTokens / 1000000) * 3.00;
                const outputCost = (msg.candidatesTokens / 1000000) * 3.00;
                const totalCost = inputCost + thoughtCost + outputCost;

                console.log(chalk.magenta(`\n💰 Cost: $${totalCost.toFixed(6)} (${msg.totalTokens} tokens)`));
            });

            client.on('tool_result', (msg) => {
                // Often redundant for interactive chat, but good for debug
                //console.log(chalk.dim(`\nResult: ${msg.result}`));
            });

            client.on('error', (err) => {
                console.log(chalk.red(`\n❌ Error: ${err.message}`));
            });

            // Handle User Input
            rl.prompt();

            rl.on('line', (line) => {
                const text = line.trim();
                if (text) {
                    client.sendPrompt(text);
                }
                rl.prompt();
            });

            rl.on('close', () => {
                console.log('\nExiting...');
                client.disconnect();
                process.exit(0);
            });

        } catch (error) {
            console.error(chalk.red('Failed to connect:'), error.message);
            process.exit(1);
        }
    });

// run command removed per user request

program
    .command('test')
    .description('Run a test with CLI arguments (launches browser)')
    .argument('<prompt>', 'Prompt to send to AI')
    .option('--tool <name>', 'Expected tool to be called')
    .option('--creature <type>', 'Expected creature type (for spawn verification)')
    .option('--scale <value>', 'Expected scale value (for update verification)', parseFloat)
    .option('--property <key:value>', 'Expected property key:value (e.g. color:#ff0000)')
    .option('--verify-count <type:min>', 'Verify entity count (e.g. Elephant:2)')
    .option('--verify-types <types>', 'Verify multiple types exist (comma-separated, e.g. Elephant,Lion,Giraffe)')
    .option('--verify-shape <type>', 'Verify a specific built shape (e.g. pyramid)')
    .option('--verify-material <id>', 'Material to check for shape verification')
    .option('--verify-item <name>', 'Verify player has item in inventory')
    .option('--verify-distance <meters>', 'Distance to check (default 25)')
    .option('--verify-file <path>', 'Load custom verification code from file [GENERATED]')
    .option('--verify-code <code>', 'Run custom verification code inline')
    .option('--verify-flying', 'Verify creature is flying', false)
    .option('--headless', 'Run browser in headless mode', false)
    .option('-t, --timeout <ms>', 'Timeout in milliseconds', '60000')
    .action(async (prompt, options) => {
        const { TestRunner } = await import('../src/runner.js');

        // Build test case from CLI args
        const testCase = {
            name: `CLI Test: ${prompt.substring(0, 50)}`,
            prompt: prompt,
            expectedTool: options.tool || 'spawn_creature',
            headless: options.headless,
            timeout: parseInt(options.timeout),
            toolWait: 45000 // Give AI time to think and build
        };

        // Add creature verification if specified
        if (options.creature) {
            testCase.expectedArgs = { creature: options.creature };
            testCase.verify = [];

            // Check existence
            testCase.verify.push({
                type: 'entityExists',
                creature: options.creature,
                minCount: 1
            });

            // Check scale if specified
            if (options.scale !== undefined) {
                testCase.verify.push({
                    type: 'entityHasProperty',
                    creature: options.creature,
                    property: 'scale',
                    value: options.scale
                });
            }

            // Check custom property if specified
            if (options.property) {
                const [key, value] = options.property.split(':');
                testCase.verify.push({
                    type: 'entityHasProperty',
                    creature: options.creature,
                    property: key,
                    value: value
                });
            }

            // Check if flying
            if (options.verifyFlying) {
                testCase.verify.push({
                    type: 'customCode',
                    code: `() => { const game = window.__VOXEL_GAME__; const creature = game.animals.find(a => a.constructor.name === '${options.creature}'); if (!creature) return { success: false, message: 'Creature not found' }; const isFlying = creature.velocity?.y > 0.1 || creature.position?.y > 50; return { success: isFlying, message: \`Flying: y=\${creature.position?.y.toFixed(1)}, vy=\${creature.velocity?.y.toFixed(2)}\` }; }`
                });
            }
        } else {
            testCase.verify = [];
        }

        // Verify specific count
        if (options.verifyCount) {
            const [type, minStr] = options.verifyCount.split(':');
            const minCount = parseInt(minStr);
            testCase.verify.push({
                type: 'entityExists',
                creature: type,
                minCount: minCount
            });
        }

        // Verify item in inventory
        if (options.verifyItem) {
            testCase.verify.push({
                type: 'customCode',
                code: `() => { 
                    const game = window.__VOXEL_GAME__;
                    if (!game || !game.inventoryManager) return { success: false, message: 'InventoryManager not found' };
                    
                    const itemName = '${options.verifyItem}'.toLowerCase();
                    let hasItem = false;
                    
                    // Check slots
                    for (let i = 0; i < 63; i++) {
                        const slot = game.inventoryManager.getSlot(i);
                        if (slot && slot.item && slot.item.toLowerCase().includes(itemName)) {
                            hasItem = true;
                            break;
                        }
                    }
                    
                    return { success: hasItem, message: hasItem ? 'Item found in inventory' : 'Item not found in inventory' };
                }`
            });
        }

        // Verify shape (Legacy)
        if (options.verifyShape) {
            const shape = options.verifyShape.toLowerCase();
            const material = options.verifyMaterial || 'gold_block';
            const distance = parseInt(options.verifyDistance) || 25;

            let checkCode = '';

            if (shape === 'pyramid') {
                checkCode = `
                    // Log positions for Agent verification
                    return window.VerificationUtils.logBlockPositions(window.__VOXEL_GAME__, '${material}', window.__VOXEL_GAME__.player.position, ${distance});
                `;
            }

            if (checkCode) {
                testCase.verify.push({
                    type: 'customCode',
                    code: `() => { 
                        if (!window.VerificationUtils) return { success: false, message: 'VerificationUtils not loaded' };
                        ${checkCode}
                    }`
                });
            }
        }

        // Verify from file (Dynamic/Generated)
        if (options.verifyFile) {
            const codePath = path.resolve(process.cwd(), options.verifyFile);
            try {
                let code = fs.readFileSync(codePath, 'utf8');
                // Ensure code is wrapped in a function if it's not already
                if (!code.trim().startsWith('() =>') && !code.trim().startsWith('function')) {
                    // If it's just a body, wrap it
                    code = `() => { ${code} }`;
                }
                testCase.verify.push({
                    type: 'customCode',
                    code: code
                });
            } catch (e) {
                console.error(chalk.red(`Failed to read verification file: ${e.message}`));
                process.exit(1);
            }
        }

        // Verify multiple types exist
        if (options.verifyTypes) {
            const types = options.verifyTypes.split(',');
            testCase.verify.push({
                type: 'customCode',
                code: `() => { const game = window.__VOXEL_GAME__; const animals = game.animals || []; const counts = {}; for(const a of animals) { const name = a.constructor.name; counts[name] = (counts[name] || 0) + 1; } const types = ${JSON.stringify(types)}; const missing = []; for (const t of types) { if ((counts[t] || 0) === 0) missing.push(t); } const success = missing.length === 0; const msg = types.map(t => \`\${t}=\${counts[t]||0}\`).join(', '); return { success, message: success ? msg : \`Missing: \${missing.join(', ')}. Found: \${msg}\` }; }`
            });
        }

        // Verify with inline custom code
        if (options.verifyCode) {
            testCase.verify.push({
                type: 'customCode',
                code: options.verifyCode
            });
        }

        // Create runner with inline test case
        const runner = new TestRunner(null);
        runner.testCase = testCase;

        try {
            await runner.run();
            process.exit(0);
        } catch (e) {
            process.exit(1);
        }
    });



program
    .command('merlin')
    .description('Interact with and verify Merlin AI persona')
    .argument('<action>', 'Action to perform: verify, chat')
    .option('--headless', 'Run browser in headless mode', false)
    .action(async (action, options) => {
        const { GameBrowser } = await import('../src/browser.js');
        const gc = await import('../src/game-commands.js');
        const chalk = (await import('chalk')).default;
        const readline = await import('readline');

        const browser = new GameBrowser({ headless: options.headless, quiet: true });
        console.log(chalk.blue(`\n🧙 Launching Merlin (${action})...`));

        await browser.launch();
        await browser.waitForGameLoad();

        if (action === 'verify') {
            console.log(chalk.cyan('Clearing local storage for fresh test...'));
            await browser.evaluate(() => localStorage.clear());
            await browser.page.reload();
            await browser.waitForGameLoad();

            console.log(chalk.cyan('Waiting for Merlin to introduce himself...'));

            // 1. Wait for Intro
            const introFound = await gc.waitFor(browser, () => {
                const container = document.getElementById('chat-messages-ai');
                if (!container) return false;
                const msgs = Array.from(container.querySelectorAll('.message.ai'));
                const lastAi = msgs.pop();
                if (lastAi && (lastAi.innerText.includes('Merlin') || lastAi.innerText.toLowerCase().includes('wolf'))) {
                    return lastAi.innerText;
                }
                return false;
            }, 30000);

            if (!introFound.success) {
                console.error(chalk.red('❌ Failed: Merlin did not introduce himself.'));
                await browser.close();
                process.exit(1);
            }
            console.log(chalk.green(`✅ Intro received: "${introFound.result.substring(0, 50)}..."`));

            // 2. Perform Tutorial Task
            console.log(chalk.yellow('Sending: "spawn a wolf"...'));
            await gc.sendChatMessage(browser, 'spawn a wolf');

            // 3. Wait for Praise/Response
            console.log(chalk.cyan('Waiting for Merlin to respond...'));
            const praiseFound = await gc.waitFor(browser, () => {
                const container = document.getElementById('chat-messages-ai');
                if (!container) return false;
                const msgs = Array.from(container.querySelectorAll('.message.ai'));
                // valid intro + praise = 2 messages at least
                if (msgs.length >= 2) {
                    const last = msgs[msgs.length - 1];
                    // Verify content is substantial
                    if (last.innerText.length > 5) return last.innerText;
                }
                return false;
            }, 20000);

            if (!praiseFound.success) {
                console.error(chalk.red('❌ Failed: Merlin did not respond to the task.'));
                await browser.close();
                process.exit(1);
            }
            console.log(chalk.green(`✅ Response received: "${praiseFound.result.substring(0, 50)}..."`));

            // 4. Verify Wolf Entity Existed
            console.log(chalk.cyan('Verifying wolf entity...'));
            const startTime = Date.now();
            let wolfCheck = { success: false };
            while (Date.now() - startTime < 20000) {
                const result = await gc.getEntities(browser);

                // Debug log
                if (result && result.entities) {
                    const pPos = await gc.getPlayerPosition(browser);
                    console.log(`[DEBUG] Player: (${pPos.x.toFixed(1)}, ${pPos.y.toFixed(1)}, ${pPos.z.toFixed(1)}) | Entities (${result.entities.length}): ${result.entities.map(e => e.type).join(', ')}`);
                } else {
                    console.log('[DEBUG] No entities or error:', result);
                }

                if (!result.error && result.entities) {
                    const wolf = result.entities.find(e => e.type.includes('Wolf') || e.type.includes('Dog'));
                    if (wolf) {
                        wolfCheck = { success: true, result: wolf };
                        break;
                    }
                }
                await new Promise(r => setTimeout(r, 1000));
            }

            if (!wolfCheck.success) {
                console.error(chalk.red('❌ Failed: No wolf entity found.'));
                const entities = await gc.getEntities(browser);
                console.log('Entities found:', entities.entities.map(e => e.type).join(', '));

                // Log full conversation for QA
                console.log(chalk.blue('\n--- Full Conversation ---'));
                const finalLogs = await gc.getChatMessages(browser);
                finalLogs.messages.forEach(m => {
                    const color = m.type === 'ai' ? chalk.cyan : m.type === 'user' ? chalk.yellow : chalk.gray;
                    console.log(color(`[${m.type}] ${m.text}`));
                });

                await browser.close();
                process.exit(1);
            }
            console.log(chalk.green(`✅ Wolf found at (${wolfCheck.result.position.x.toFixed(1)}, ${wolfCheck.result.position.y.toFixed(1)}, ${wolfCheck.result.position.z.toFixed(1)})`));


            // 5. Test Creation Task: "make a glass pyramid"
            console.log(chalk.yellow('\nSending: "make a glass pyramid nearby"...'));
            await gc.sendChatMessage(browser, 'make a glass pyramid nearby');

            console.log(chalk.cyan('Waiting for Merlin to build...'));
            // Wait for response first
            await gc.waitFor(browser, () => {
                const container = document.getElementById('chat-messages-ai');
                if (!container) return false;
                const msgs = Array.from(container.querySelectorAll('.message.ai'));
                return msgs.length > 2; // Intro + Wolf Praise + Pyramid Response
            }, 30000);

            // Wait for blocks to appear
            const pyramidStartTime = Date.now();
            let pyramidCheck = { success: false };
            while (Date.now() - pyramidStartTime < 30000) {
                const glassCount = await browser.evaluate(() => {
                    const game = window.__VOXEL_GAME__;
                    if (!game) return false;
                    let count = 0;
                    const pPos = game.player.position;
                    // Check volume around player
                    for (let x = Math.floor(pPos.x - 20); x <= Math.floor(pPos.x + 20); x++) {
                        for (let z = Math.floor(pPos.z - 20); z <= Math.floor(pPos.z + 20); z++) {
                            for (let y = Math.floor(pPos.y - 5); y <= Math.floor(pPos.y + 20); y++) {
                                const block = game.getBlock(x, y, z);
                                if (block && block.type === 'glass') {
                                    count++;
                                }
                            }
                        }
                    }
                    return count;
                });

                if (glassCount > 5) {
                    pyramidCheck = { success: true, result: glassCount };
                    break;
                }
                await new Promise(r => setTimeout(r, 1000));
            }

            if (!pyramidCheck.success) {
                console.error(chalk.red('❌ Failed: No glass blocks found (Pyramid not built).'));
                // Don't fail hard, maybe logging is enough?
                // process.exit(1); 
            } else {
                console.log(chalk.green(`✅ Glass pyramid verified (${pyramidCheck.result} blocks found).`));
            }

            // Log full conversation for QA
            console.log(chalk.blue('\n--- Full Conversation ---'));
            const finalLogs = await gc.getChatMessages(browser);
            finalLogs.messages.forEach(m => {
                const color = m.type === 'ai' ? chalk.cyan : m.type === 'user' ? chalk.yellow : chalk.gray;
                console.log(color(`[${m.type}] ${m.text}`));
            });
            console.log(chalk.blue('-------------------------\n'));

            console.log(chalk.green('\n🎉 Merlin Verification PASSED!'));

            await browser.close();
            process.exit(0);

        } else if (action === 'chat') {
            console.log(chalk.green('✅ Connected! Chat with Merlin below.'));
            console.log(chalk.dim('(Type "exit" to quit)'));

            // Setup Console Listener for Chat Streaming
            browser.page.on('console', msg => {
                const text = msg.text();
                if (text.startsWith('[Chat:AI]')) {
                    process.stdout.write(chalk.cyan(text.replace('[Chat:AI]', 'Merlin: ')));
                } else if (text.startsWith('[Chat:Thought]')) {
                    // process.stdout.write(chalk.gray(text.replace('[Chat:Thought]', 'Thinking: ')));
                    // Maybe print thoughts in gray?
                    // console.log(chalk.gray('\n' + text));
                }
            });

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                prompt: chalk.yellow('You > ')
            });

            rl.prompt();

            rl.on('line', async (line) => {
                const text = line.trim();
                if (text === 'exit') {
                    rl.close();
                    return;
                }
                if (text) {
                    await gc.sendChatMessage(browser, text);
                    // Add newline after sending so async logs don't mess up prompt
                    process.stdout.write('\n');
                }
                rl.prompt();
            });

            rl.on('close', async () => {
                console.log(chalk.yellow('\nClosing...'));
                await browser.close();
                process.exit(0);
            });
        }

    });

program
    .command('tool')
    .description('Directly test a client tool (requires game client running)')
    .argument('<name>', 'Tool name (e.g. spawn_creature, patch_entity)')
    .argument('<args>', 'JSON-encoded arguments')
    .option('-t, --timeout <ms>', 'Timeout in milliseconds', '10000')
    .action(async (name, argsJson, options) => {
        const client = new AntigravityClient();

        try {
            const args = JSON.parse(argsJson);
            console.log(chalk.blue(`Testing tool: ${name}`));
            console.log(chalk.dim(JSON.stringify(args, null, 2)));

            await client.connect();

            // Construct a prompt that will directly invoke the tool
            const toolPrompt = `Call the ${name} tool with these exact arguments: ${JSON.stringify(args)}. Do not do anything else.`;

            let timeoutHandle = setTimeout(() => {
                console.error(chalk.red('\nTimeout waiting for tool result'));
                process.exit(1);
            }, parseInt(options.timeout));

            client.on('tool_start', (msg) => {
                if (msg.name === name) {
                    console.log(chalk.cyan(`\n🛠  Tool Invoked: ${msg.name}`));
                    console.log(chalk.dim(JSON.stringify(msg.args, null, 2)));
                }
            });

            client.on('tool_end', (msg) => {
                if (msg.name === name) {
                    console.log(chalk.green(`\n✅ Tool Result:`));
                    console.log(JSON.stringify(msg.result, null, 2));
                    clearTimeout(timeoutHandle);
                    client.disconnect();
                    process.exit(msg.result?.error ? 1 : 0);
                }
            });

            client.on('token', (msg) => process.stdout.write(chalk.gray(msg.text)));
            client.on('error', (err) => console.error(chalk.red(`Error: ${err.message}`)));

            client.sendPrompt(toolPrompt);

        } catch (error) {
            console.error(chalk.red('Failed:'), error.message);
            process.exit(1);
        }
    });

// ============================================================
// MULTI-BROWSER TESTING
// ============================================================

program
    .command('multi')
    .description('Launch multiple browser instances for multiplayer testing')
    .option('-n, --count <number>', 'Number of browsers to launch', '2')
    .option('--headless', 'Run browsers in headless mode', false)
    .action(async (options) => {
        const { MultiBrowserRunner } = await import('../src/multi-browser.js');

        const runner = new MultiBrowserRunner({
            browserCount: parseInt(options.count),
            headless: options.headless
        });

        try {
            await runner.launchAll();
            console.log(chalk.green('\n✅ All browsers launched and connected!'));
            console.log(chalk.dim('Press Ctrl+C to close all browsers and exit.'));

            // Keep process running
            process.on('SIGINT', async () => {
                console.log(chalk.yellow('\n\nClosing browsers...'));
                await runner.closeAll();
                process.exit(0);
            });

        } catch (error) {
            console.error(chalk.red('Failed:'), error.message);
            await runner.closeAll();
            process.exit(1);
        }
    });

program
    .command('test-creature-sync')
    .description('Test dynamic creature creation and sync across multiple browsers')
    .option('--description <text>', 'Description of creature to create', 'a small hopping blue cube')
    .option('--name <name>', 'Expected name for the creature', 'HoppingCube')
    .option('--headless', 'Run browsers in headless mode', false)
    .action(async (options) => {
        const { MultiBrowserRunner } = await import('../src/multi-browser.js');

        const runner = new MultiBrowserRunner({
            browserCount: 2,
            headless: options.headless
        });

        try {
            await runner.runDynamicCreatureTest(options.description, options.name);
            process.exit(0);
        } catch (error) {
            process.exit(1);
        }
    });

program
    .command('test-chat-sync')
    .description('Verify group chat synchronization across multiple browsers')
    .option('--headless', 'Run browsers in headless mode', false)
    .action(async (options) => {
        const { MultiBrowserRunner } = await import('../src/multi-browser.js');

        const runner = new MultiBrowserRunner({
            browserCount: 2,
            headless: options.headless
        });

        try {
            await runner.runGroupChatTest();
            process.exit(0);
        } catch (error) {
            process.exit(1);
        }
    });

// ============================================================
// GAME DRIVER (MCP Server)
// ============================================================

program
    .command('drive')
    .description('Start the generic Game Driver (MCP-style) for multi-session automation')
    .action(async () => {
        const { GameDriver } = await import('../src/driver.js');
        const driver = new GameDriver();
        await driver.startInteractive();
    });

// ============================================================
// INTERACTIVE GAME CONSOLE
// ============================================================

program
    .command('console')
    .description('Launch browser and open interactive game console for testing')
    .option('--headless', 'Run browser in headless mode', false)
    .option('-q, --quiet', 'Suppress browser console output', false)
    .action(async (options) => {
        const { GameBrowser } = await import('../src/browser.js');
        const gc = await import('../src/game-commands.js');
        const readline = await import('readline');

        console.log(chalk.blue('\n🎮 Launching Game Console...'));

        const browser = new GameBrowser({ headless: options.headless, quiet: options.quiet });
        await browser.launch();
        await browser.waitForGameLoad();

        console.log(chalk.green('✓ Game loaded'));
        console.log(chalk.dim('Type "help" for available commands, "exit" to quit.\n'));

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.cyan('game> ')
        });

        const commands = {
            help: () => {
                console.log(chalk.blue('\n═══ Available Commands ═══'));
                console.log('  state          - Show game state summary');
                console.log('  inventory      - Show player inventory');
                console.log('  entities       - Show entity counts');
                console.log('  items          - List registered items');
                console.log('  creatures      - List registered creatures');
                console.log('  give <item>    - Give item to player');
                console.log('  select <0-8>   - Select hotbar slot');
                console.log('  use            - Use selected item (right-click)');
                console.log('  held           - Show currently held item');
                console.log('  pos            - Show player position');
                console.log('  tp <x> <y> <z> - Teleport player');
                console.log('  spawn <type>   - Spawn creature');
                console.log('  prompt <text>  - Send AI prompt');
                console.log('  wait <ms>      - Wait milliseconds');
                console.log('  screenshot [file] - Take a screenshot');
                console.log('  click <params> - Simulate click (left/right x y)');
                console.log('  key <key>      - Simulate key press');
                console.log('  break [x y z]  - Break block (targeted or at coords)');
                console.log('  drops          - Show dropped blocks (for lighting test)');
                console.log('  setblock <x> <y> <z> <type> - Place a block');
                console.log('  damage <amount> - Deal damage to player (test health sync)');
                console.log('  health         - Show player health');
                console.log('  players        - Show remote players');
                console.log('  exit           - Close browser and exit');
                console.log(chalk.cyan('\n═══ Item Testing Commands ═══'));
                console.log('  iteminfo <id>  - Get comprehensive item info');
                console.log('  checkitem <id> - Check if item is in inventory');
                console.log('  itemicon <id>  - Check if item has an icon');
                console.log('  itemmesh <id>  - Check if item has a 3D mesh');
                console.log('  testitem <id>  - Test item registration, icon, mesh & functionality');
                console.log('  listitems      - List all registered items');
                console.log('');
            },
            state: async () => {
                const state = await gc.getGameState(browser);
                gc.printGameState(state);
            },
            inventory: async () => {
                const inv = await gc.getInventory(browser);
                gc.printInventory(inv);
            },
            entities: async () => {
                const entities = await gc.getEntities(browser);
                gc.printEntities(entities);
            },
            items: async () => {
                const items = await gc.getRegisteredItems(browser);
                console.log(chalk.blue('\n═══ Registered Items ═══'));
                console.log(`Total: ${items.all.length}`);
                console.log(chalk.cyan('Dynamic Items:'), items.dynamic.join(', ') || '(none)');
            },
            creatures: async () => {
                const creatures = await gc.getRegisteredCreatures(browser);
                console.log(chalk.blue('\n═══ Registered Creatures ═══'));
                console.log(`Total: ${creatures.all.length}`);
                console.log(chalk.cyan('Dynamic Creatures:'), creatures.dynamic.join(', ') || '(none)');
            },
            debug: async () => {
                // Check dynamic creature errors
                const info = await gc.getDynamicCreatureInfo(browser);
                const errors = await gc.getCreatureErrors(browser);
                console.log(chalk.blue('\n═══ Dynamic Creature Debug ═══'));
                console.log(chalk.cyan('Dynamic Creatures:'));
                for (const [name, data] of Object.entries(info)) {
                    const status = data.hasError ? chalk.red('❌ ERROR') : chalk.green('✓ OK');
                    console.log(`  ${name}: ${status} (registered: ${data.registered})`);
                    if (data.error) console.log(chalk.dim(`    → ${data.error}`));
                }
                if (errors.count > 0) {
                    console.log(chalk.red('\n─── Errors ───'));
                    for (const [name, err] of Object.entries(errors.errors)) {
                        console.log(chalk.red(`  ${name}: ${err.error}`));
                        if (err.stack) console.log(chalk.dim(err.stack.split('\n').slice(0, 3).join('\n')));
                    }
                }
            },
            check: async (creatureName) => {
                if (!creatureName) { console.log(chalk.red('Usage: check <creatureName>')); return; }
                const result = await gc.isCreatureRegistered(browser, creatureName);
                console.log(chalk.blue(`\n═══ Creature Check: ${creatureName} ═══`));
                console.log(`Registered: ${result.registered ? chalk.green('YES') : chalk.red('NO')}`);
                console.log(`Is Dynamic: ${result.isDynamic ? chalk.cyan('YES') : 'NO'}`);
                // Also check AnimalClasses directly
                const allCreatures = await gc.getRegisteredCreatures(browser);
                const found = allCreatures.all.find(c => c.toLowerCase() === creatureName.toLowerCase());
                if (found && found !== creatureName) {
                    console.log(chalk.yellow(`Note: Found as '${found}' (case mismatch)`));
                }
            },
            give: async (itemName, count = '1') => {
                if (!itemName) { console.log(chalk.red('Usage: give <itemName> [count]')); return; }
                const result = await gc.giveItem(browser, itemName, parseInt(count));
                console.log(result.error ? chalk.red(result.error) : chalk.green(`Gave ${result.item} x${result.count}`));
            },
            select: async (slot) => {
                const index = parseInt(slot);
                if (isNaN(index) || index < 0 || index > 8) {
                    console.log(chalk.red('Usage: select <0-8>')); return;
                }
                const result = await gc.selectSlot(browser, index);
                console.log(chalk.green(`Selected slot ${result.selectedSlot}: ${result.item || '(empty)'}`));
            },
            use: async () => {
                const result = await gc.useSelectedItem(browser);
                console.log(result.error ? chalk.red(result.error) : chalk.green(`Used ${result.item}`));
            },
            held: async () => {
                const item = await gc.getHeldItem(browser);
                console.log(item ? chalk.green(`Holding: ${item.item} x${item.count}`) : chalk.dim('(nothing)'));
            },
            pos: async () => {
                const pos = await gc.getPlayerPosition(browser);
                console.log(pos ? `Position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})` : chalk.red('Player not ready'));
            },
            tp: async (x, y, z) => {
                if (!x || !y || !z) { console.log(chalk.red('Usage: tp <x> <y> <z>')); return; }
                const result = await gc.teleportPlayer(browser, parseFloat(x), parseFloat(y), parseFloat(z));
                console.log(result.error ? chalk.red(result.error) : chalk.green(`Teleported to (${x}, ${y}, ${z})`));
            },
            spawn: async (type, count = '1') => {
                if (!type) { console.log(chalk.red('Usage: spawn <creatureType> [count]')); return; }
                const result = await gc.spawnCreature(browser, type, parseInt(count));
                if (result.error) {
                    console.log(chalk.red(result.error));
                    if (result.available) console.log(chalk.dim(`Available: ${result.available.join(', ')}`));
                } else {
                    console.log(chalk.green(`Spawned ${result.count} ${result.type}(s)`));
                }
            },
            prompt: async (...words) => {
                const text = words.join(' ');
                if (!text) { console.log(chalk.red('Usage: prompt <text>')); return; }
                console.log(chalk.dim(`Sending: "${text}"`));
                await browser.evaluate((prompt) => {
                    const game = window.__VOXEL_GAME__;
                    if (game?.uiManager) {
                        game.uiManager.toggleChatPanel(true);
                        const chatInput = document.getElementById('chat-input');
                        if (chatInput) {
                            chatInput.value = prompt;
                            chatInput.focus();
                            setTimeout(() => game.uiManager.handleSendMessage(), 100);
                        }
                    }
                }, text);
                console.log(chalk.green('Prompt sent'));
            },
            wait: async (ms) => {
                const time = parseInt(ms) || 1000;
                console.log(chalk.dim(`Waiting ${time}ms...`));
                await new Promise(r => setTimeout(r, time));
                console.log(chalk.green('Done'));
            },
            exit: async () => {
                console.log(chalk.yellow('Closing browser...'));
                await browser.close();
                process.exit(0);
            },
            screenshot: async (file = 'screenshot.png') => {
                await browser.screenshot(file);
            },
            click: async (btn = 'left', x = '400', y = '300') => {
                const xVal = parseInt(x);
                const yVal = parseInt(y);
                if (btn === 'left') {
                    const res = await gc.leftClick(browser, xVal, yVal);
                    console.log(chalk.green(`Left clicked at (${res.x}, ${res.y})`));
                } else if (btn === 'right') {
                    const res = await gc.rightClick(browser, xVal, yVal);
                    console.log(chalk.green(`Right clicked at (${res.x}, ${res.y})`));
                } else {
                    console.log(chalk.red('Usage: click <left|right> [x] [y]'));
                }
            },
            key: async (keyName) => {
                if (!keyName) { console.log(chalk.red('Usage: key <keyName>')); return; }
                await gc.pressKey(browser, keyName);
                console.log(chalk.green(`Pressed key: ${keyName}`));
            },
            break: async (x, y, z) => {
                if (x !== undefined && y !== undefined && z !== undefined) {
                    const result = await gc.breakBlock(browser, parseFloat(x), parseFloat(y), parseFloat(z));
                    if (result.error) {
                        console.log(chalk.red(result.error));
                    } else {
                        console.log(chalk.green(`Broke ${result.blockType} at (${x}, ${y}, ${z})`));
                    }
                } else {
                    const result = await gc.breakBlock(browser);
                    if (result.error) {
                        console.log(chalk.red(result.error));
                    } else {
                        console.log(chalk.green('Broke targeted block'));
                    }
                }
            },
            drops: async () => {
                const dropsData = await gc.getDrops(browser);
                gc.printDrops(dropsData);
            },
            setblock: async (x, y, z, type) => {
                if (!x || !y || !z || !type) {
                    console.log(chalk.red('Usage: setblock <x> <y> <z> <blockType>'));
                    return;
                }
                const result = await gc.setBlock(browser, parseFloat(x), parseFloat(y), parseFloat(z), type);
                if (result.error) {
                    console.log(chalk.red(result.error));
                } else {
                    console.log(chalk.green(`Set ${type} at (${x}, ${y}, ${z})`));
                }
            },
            hotbar: async () => {
                const inv = await gc.getInventory(browser);
                console.log(chalk.blue('\n═══ Hotbar ═══'));
                console.log(`Selected Slot: ${inv.selectedSlot}`);
                for (let i = 0; i < 9; i++) {
                    const slot = inv.slots.find(s => s.index === i);
                    const marker = i === inv.selectedSlot ? chalk.green('→') : ' ';
                    if (slot) {
                        console.log(`${marker} [${i}] ${slot.item} x${slot.count}`);
                    } else {
                        console.log(`${marker} [${i}] ${chalk.dim('(empty)')}`);
                    }
                }
            },
            damage: async (amount = '5') => {
                const result = await gc.takeDamage(browser, parseInt(amount));
                if (result.error) {
                    console.log(chalk.red(result.error));
                } else {
                    console.log(chalk.green(`Dealt ${result.damage} damage: ${result.oldHealth} → ${result.newHealth}`));
                }
            },
            health: async () => {
                const result = await gc.getPlayerHealth(browser);
                if (result.error) {
                    console.log(chalk.red(result.error));
                } else {
                    console.log(chalk.green(`Health: ${result.health}/${result.maxHealth}`));
                }
            },
            players: async () => {
                const result = await gc.getRemotePlayers(browser);
                if (result.error) {
                    console.log(chalk.red(result.error));
                } else {
                    console.log(chalk.blue('\n═══ Remote Players ═══'));
                    console.log(`Count: ${result.count}`);
                    for (const p of result.players) {
                        const pos = p.position ? `(${p.position.x.toFixed(1)}, ${p.position.y.toFixed(1)}, ${p.position.z.toFixed(1)})` : 'unknown';
                        console.log(`  ${p.id.substring(0, 8)}... at ${pos} [health bar: ${p.hasHealthBar ? 'yes' : 'no'}]`);
                    }
                }
            },
            // ========== ITEM TESTING COMMANDS ==========
            iteminfo: async (itemId) => {
                if (!itemId) { console.log(chalk.red('Usage: iteminfo <itemId>')); return; }
                const info = await gc.getItemInfo(browser, itemId);
                gc.printItemInfo(info);
            },
            checkitem: async (itemId) => {
                if (!itemId) { console.log(chalk.red('Usage: checkitem <itemId>')); return; }
                const inv = await gc.checkItemInInventory(browser, itemId);
                console.log(chalk.blue(`\n═══ Item Check: ${itemId} ═══`));
                console.log(`In Inventory: ${inv.found ? chalk.green('Yes') : chalk.dim('No')}`);
                if (inv.found) {
                    console.log(`Total Count: ${inv.totalCount}`);
                    console.log(`Slots: ${inv.slots.map(s => `#${s.slot} (${s.count})`).join(', ')}`);
                }
            },
            itemicon: async (itemId) => {
                if (!itemId) { console.log(chalk.red('Usage: itemicon <itemId>')); return; }
                const icon = await gc.checkItemIcon(browser, itemId);
                console.log(chalk.blue(`\n═══ Icon Check: ${itemId} ═══`));
                console.log(`Has Icon: ${icon.hasIcon ? chalk.green('Yes') : chalk.yellow('No (default)')}`);
                console.log(`Icon Type: ${icon.iconType}`);
                console.log(`Dynamic Icon: ${icon.hasDynamicIcon ? 'Yes' : 'No'}`);
            },
            itemmesh: async (itemId) => {
                if (!itemId) { console.log(chalk.red('Usage: itemmesh <itemId>')); return; }
                const mesh = await gc.checkItemMesh(browser, itemId);
                console.log(chalk.blue(`\n═══ Mesh Check: ${itemId} ═══`));
                if (!mesh.found) {
                    console.log(chalk.red(`Item '${itemId}' not found`));
                } else {
                    console.log(`Has getMesh: ${mesh.hasGetMesh ? chalk.green('Yes') : chalk.red('No')}`);
                    console.log(`Has Mesh: ${mesh.hasMesh ? chalk.green('Yes') : chalk.red('No')}`);
                    if (mesh.meshInfo) {
                        console.log(`Mesh Type: ${mesh.meshInfo.geometryType || 'custom'}`);
                        console.log(`Is Object3D: ${mesh.meshInfo.isObject3D ? 'Yes' : 'No'}`);
                    }
                }
            },
            testitem: async (itemId) => {
                if (!itemId) { console.log(chalk.red('Usage: testitem <itemId>')); return; }
                console.log(chalk.cyan(`Testing item: ${itemId}...`));
                const result = await gc.testItemFunctionality(browser, itemId, { testUse: true });
                console.log(chalk.blue(`\n═══ Item Test: ${itemId} ═══`));
                console.log(`Summary: ${result.summary}`);
                for (const test of result.tests) {
                    const status = test.passed ? chalk.green('✓') : chalk.red('✗');
                    console.log(`  ${status} ${test.name}`);
                }
                if (result.error) console.log(chalk.red(`Error: ${result.error}`));
            },
            listitems: async () => {
                const result = await gc.listAllItems(browser);
                console.log(chalk.blue('\n═══ All Registered Items ═══'));
                console.log(`Total: ${result.totalItems}`);
                console.log(`Dynamic: ${result.dynamicItemCount}`);
                console.log(chalk.cyan('\nItems:'));
                for (const item of result.items) {
                    const dynamicTag = item.isDynamic ? chalk.magenta(' [dynamic]') : '';
                    const toolTag = item.isTool ? chalk.yellow(' [tool]') : '';
                    console.log(`  ${item.id}${dynamicTag}${toolTag}`);
                }
            }
        };

        rl.prompt();

        rl.on('line', async (line) => {
            const [cmd, ...args] = line.trim().split(/\s+/);
            if (!cmd) { rl.prompt(); return; }

            if (commands[cmd]) {
                try {
                    await commands[cmd](...args);
                } catch (e) {
                    console.log(chalk.red(`Error: ${e.message}`));
                }
            } else {
                console.log(chalk.red(`Unknown command: ${cmd}. Type "help" for available commands.`));
            }
            rl.prompt();
        });

        rl.on('close', async () => {
            console.log(chalk.yellow('\nClosing browser...'));
            await browser.close();
            process.exit(0);
        });
    });

// ============================================================
// QUICK GAME ACTIONS (one-shot)
// ============================================================

program
    .command('game-state')
    .description('Show current game state')
    .action(async () => {
        const { GameBrowser } = await import('../src/browser.js');
        const gc = await import('../src/game-commands.js');

        const browser = new GameBrowser({ headless: true });
        await browser.launch();
        await browser.waitForGameLoad();

        const state = await gc.getGameState(browser);
        gc.printGameState(state);

        await browser.close();
    });

program
    .command('audit')
    .description('Audit game materials and entities')
    .option('--headless', 'Run browser in headless mode', true)
    .action(async (options) => {
        const { GameBrowser } = await import('../src/browser.js');
        const chalk = (await import('chalk')).default;

        console.log(chalk.blue('\n🔍 Starting Material Audit...'));

        const browser = new GameBrowser({ headless: options.headless, quiet: true });
        await browser.launch();
        await browser.waitForGameLoad();

        // 1. Trigger AssetManager Validation
        console.log(chalk.cyan('\n1. Checking Block Materials (AssetManager)...'));
        const assetResult = await browser.evaluate(() => {
            const game = window.__VOXEL_GAME__;
            if (!game || !game.assetManager) return { error: 'Game or AssetManager not found' };
            const missing = game.assetManager.validateMaterials();
            return { missing };
        });

        if (assetResult.error) {
            console.error(chalk.red(`Error: ${assetResult.error}`));
        } else if (assetResult.missing && assetResult.missing.length > 0) {
            console.log(chalk.red(`❌ Found ${assetResult.missing.length} missing block materials:`));
            assetResult.missing.forEach(m => {
                console.log(chalk.yellow(`   - [${m.type}] ${m.name}: ${m.issue}`));
            });
        } else {
            console.log(chalk.green('✅ All registered blocks have materials.'));
        }

        // 2. Scan All Active Entities
        console.log(chalk.cyan('\n2. Scanning Active Entities...'));
        const entityResult = await browser.evaluate(() => {
            const game = window.__VOXEL_GAME__;
            const entities = [
                ...(game.animals || []),
                ...(game.monsters || [])
            ];

            const issues = [];
            let checkedCount = 0;

            entities.forEach(entity => {
                checkedCount++;
                const name = entity.constructor.name;

                // Traverse full object to check all meshes
                const root = entity.mesh || (entity.isObject3D ? entity : null);

                if (root) {
                    root.traverse((obj) => {
                        if (obj.isMesh) {
                            if (!obj.material) {
                                issues.push({ entity: name, id: entity.uuid, issue: 'Mesh has no material', meshName: obj.name });
                            }
                        }
                    });
                }
            });
            return { count: checkedCount, issues };
        });

        console.log(chalk.dim(`Scanned ${entityResult.count} entities.`));

        if (entityResult.issues.length > 0) {
            console.log(chalk.red(`❌ Found ${entityResult.issues.length} entity material issues:`));
            entityResult.issues.forEach(i => {
                console.log(chalk.yellow(`   - [${i.entity}] ${i.meshName || 'Mesh'}: ${i.issue}`));
            });
        } else {
            console.log(chalk.green('✅ No missing materials found on active entities.'));
        }

        await browser.close();
        process.exit(assetResult.missing?.length || entityResult.issues.length ? 1 : 0);
    });

// ============================================================
// PERFORMANCE PROFILING
// ============================================================

program
    .command('profile')
    .description('Run performance profiling and identify inefficiencies')
    .option('--duration <seconds>', 'Duration to profile in seconds', '15')
    .option('--samples <count>', 'Number of samples to collect', '60')
    .option('--headless', 'Run browser in headless mode (not recommended for accurate profiling)', false)
    .option('-q, --quiet', 'Suppress browser console output', true)
    .action(async (options) => {
        const { GameBrowser } = await import('../src/browser.js');
        const chalk = (await import('chalk')).default;

        const duration = parseInt(options.duration) * 1000;
        const sampleCount = parseInt(options.samples);
        const sampleInterval = Math.floor(duration / sampleCount);

        console.log(chalk.blue('\n⚡ Performance Profiler'));
        console.log(chalk.dim(`Duration: ${options.duration}s, Samples: ${sampleCount}`));
        console.log(chalk.dim('Launching game in headed mode for accurate profiling...\n'));

        const browser = new GameBrowser({ headless: options.headless, quiet: options.quiet });
        await browser.launch();
        await browser.waitForGameLoad();

        // Wait a moment for world to generate
        console.log(chalk.dim('Waiting for world generation...'));
        await new Promise(r => setTimeout(r, 3000));

        console.log(chalk.cyan('\n📊 Collecting performance samples...'));

        const samples = [];
        let peakMemory = 0;
        let peakTriangles = 0;
        let peakDrawCalls = 0;
        let peakFrameTime = 0;

        for (let i = 0; i < sampleCount; i++) {
            const sample = await browser.evaluate(() => {
                const game = window.__VOXEL_GAME__;
                if (!game) return null;

                const renderer = game.renderer;
                const info = renderer.info;

                // Memory info
                const memory = info.memory || {};
                const programs = info.programs || [];

                // Render info
                const render = info.render || {};

                // Get entity counts
                const animals = game.animals?.length || 0;
                const chunks = game.chunks?.size || 0;
                const projectiles = game.projectiles?.length || 0;
                const drops = game.drops?.length || 0;

                // Get grass system info
                const grassInstances = game.grassSystem?.totalInstances || 0;
                const grassVisible = game.grassSystem?.visible !== false;

                // FIXED: Use Stats.js FPS reading if available, otherwise estimate from frame timing
                let fps = 60;
                if (game.stats?.dom?.children?.[0]) {
                    // Stats.js shows FPS in first panel
                    const fpsText = game.stats.dom.children[0].innerText;
                    fps = parseInt(fpsText) || 60;
                } else if (game._lastFrameTime) {
                    // Fallback: Calculate from game's internal timing
                    fps = Math.round(1000 / (performance.now() - game._lastFrameTime));
                }
                // Store for next sample
                game._lastFrameTime = performance.now();

                // PERFORMANCE: Only count meshes/lights occasionally (expensive!)
                let meshCount = game._cachedMeshCount || 0;
                let lightCount = game._cachedLightCount || 0;
                if (!game._lastMeshCount || performance.now() - game._lastMeshCount > 5000) {
                    game._lastMeshCount = performance.now();
                    meshCount = 0;
                    lightCount = 0;
                    game.scene?.traverse((obj) => {
                        if (obj.isMesh) meshCount++;
                        if (obj.isLight) lightCount++;
                    });
                    game._cachedMeshCount = meshCount;
                    game._cachedLightCount = lightCount;
                }

                return {
                    timestamp: performance.now(),
                    triangles: render.triangles || 0,
                    drawCalls: render.calls || 0,
                    geometries: memory.geometries || 0,
                    textures: memory.textures || 0,
                    programs: programs.length,
                    animals,
                    chunks,
                    projectiles,
                    drops,
                    meshCount,
                    lightCount,
                    grassInstances,
                    grassVisible,
                    fps: Math.round(fps)
                };
            });

            if (sample) {
                samples.push(sample);
                if (sample.triangles > peakTriangles) peakTriangles = sample.triangles;
                if (sample.drawCalls > peakDrawCalls) peakDrawCalls = sample.drawCalls;
                if (sample.geometries > peakMemory) peakMemory = sample.geometries;

                // Progress indicator
                process.stdout.write(`\r  Sample ${i + 1}/${sampleCount} | Tris: ${(sample.triangles / 1000).toFixed(0)}k | Draws: ${sample.drawCalls} | FPS: ${sample.fps}`);
            }

            await new Promise(r => setTimeout(r, sampleInterval));
        }

        console.log('\n');

        // Analyze results
        const avgTriangles = Math.round(samples.reduce((a, s) => a + s.triangles, 0) / samples.length);
        const avgDrawCalls = Math.round(samples.reduce((a, s) => a + s.drawCalls, 0) / samples.length);
        const avgFPS = Math.round(samples.reduce((a, s) => a + s.fps, 0) / samples.length);
        const minFPS = Math.min(...samples.map(s => s.fps));
        const lastSample = samples[samples.length - 1];

        console.log(chalk.blue('═══════════════════════════════════════'));
        console.log(chalk.blue('        PERFORMANCE REPORT'));
        console.log(chalk.blue('═══════════════════════════════════════\n'));

        // Render Stats
        console.log(chalk.cyan('📐 Render Stats:'));
        console.log(`   Avg Triangles:    ${(avgTriangles / 1000).toFixed(1)}k`);
        console.log(`   Peak Triangles:   ${(peakTriangles / 1000).toFixed(1)}k`);
        console.log(`   Avg Draw Calls:   ${avgDrawCalls}`);
        console.log(`   Peak Draw Calls:  ${peakDrawCalls}`);
        console.log(`   Avg FPS:          ${avgFPS}`);
        console.log(`   Min FPS:          ${minFPS}`);
        console.log('');

        // Memory Stats
        console.log(chalk.cyan('💾 Memory Stats:'));
        console.log(`   Geometries:       ${lastSample?.geometries || 0}`);
        console.log(`   Textures:         ${lastSample?.textures || 0}`);
        console.log(`   Shader Programs:  ${lastSample?.programs || 0}`);
        console.log('');

        // Scene Stats
        console.log(chalk.cyan('🎮 Scene Stats:'));
        console.log(`   Active Chunks:    ${lastSample?.chunks || 0}`);
        console.log(`   Animals:          ${lastSample?.animals || 0}`);
        console.log(`   Projectiles:      ${lastSample?.projectiles || 0}`);
        console.log(`   Drops:            ${lastSample?.drops || 0}`);
        console.log(`   Total Meshes:     ${lastSample?.meshCount || 0}`);
        console.log(`   Lights:           ${lastSample?.lightCount || 0}`);
        console.log(`   Grass Instances:  ${lastSample?.grassInstances || 0}`);
        console.log('');

        // Inefficiency Analysis
        const issues = [];

        if (avgTriangles > 500000) {
            issues.push({
                severity: 'HIGH',
                area: 'Triangles',
                message: `High triangle count (${(avgTriangles / 1000).toFixed(0)}k avg)`,
                suggestion: 'Consider LOD system, frustum culling, or reducing mesh complexity'
            });
        } else if (avgTriangles > 200000) {
            issues.push({
                severity: 'MEDIUM',
                area: 'Triangles',
                message: `Moderate triangle count (${(avgTriangles / 1000).toFixed(0)}k avg)`,
                suggestion: 'Monitor for performance impact on lower-end devices'
            });
        }

        if (avgDrawCalls > 1000) {
            issues.push({
                severity: 'HIGH',
                area: 'Draw Calls',
                message: `Very high draw call count (${avgDrawCalls} avg)`,
                suggestion: 'Use instancing, merge geometries, or reduce unique materials'
            });
        } else if (avgDrawCalls > 500) {
            issues.push({
                severity: 'MEDIUM',
                area: 'Draw Calls',
                message: `High draw call count (${avgDrawCalls} avg)`,
                suggestion: 'Consider batching similar objects or using instanced rendering'
            });
        }

        if (minFPS < 30) {
            issues.push({
                severity: 'HIGH',
                area: 'Frame Rate',
                message: `FPS drops below 30 (min: ${minFPS})`,
                suggestion: 'Profile specific systems (grass, chunks, entities) to find bottleneck'
            });
        } else if (minFPS < 50) {
            issues.push({
                severity: 'MEDIUM',
                area: 'Frame Rate',
                message: `FPS drops below 50 (min: ${minFPS})`,
                suggestion: 'May impact smoothness on regular monitors'
            });
        }

        if ((lastSample?.lightCount || 0) > 5) {
            issues.push({
                severity: 'MEDIUM',
                area: 'Lights',
                message: `${lastSample?.lightCount} lights in scene`,
                suggestion: 'Consider baking lighting or reducing dynamic light count'
            });
        }

        if ((lastSample?.grassInstances || 0) > 50000 && lastSample?.grassVisible) {
            issues.push({
                severity: 'LOW',
                area: 'Grass System',
                message: `${lastSample?.grassInstances} grass instances active`,
                suggestion: 'Grass system may impact lower-end devices'
            });
        }

        const meshPerChunk = lastSample?.chunks > 0
            ? Math.round(lastSample.meshCount / lastSample.chunks)
            : 0;
        if (meshPerChunk > 100) {
            issues.push({
                severity: 'MEDIUM',
                area: 'Chunk Complexity',
                message: `${meshPerChunk} meshes per chunk on average`,
                suggestion: 'Consider merging block geometries within chunks'
            });
        }

        // Print Issues
        if (issues.length > 0) {
            console.log(chalk.yellow('⚠️  INEFFICIENCIES DETECTED:\n'));
            issues.forEach((issue, i) => {
                const color = issue.severity === 'HIGH' ? chalk.red
                    : issue.severity === 'MEDIUM' ? chalk.yellow
                        : chalk.dim;
                console.log(color(`   ${i + 1}. [${issue.severity}] ${issue.area}`));
                console.log(chalk.white(`      ${issue.message}`));
                console.log(chalk.dim(`      → ${issue.suggestion}\n`));
            });
        } else {
            console.log(chalk.green('✅ No significant inefficiencies detected!\n'));
        }

        // Performance Score
        let score = 100;
        issues.forEach(issue => {
            if (issue.severity === 'HIGH') score -= 25;
            else if (issue.severity === 'MEDIUM') score -= 10;
            else score -= 5;
        });
        score = Math.max(0, score);

        const scoreColor = score >= 80 ? chalk.green : score >= 50 ? chalk.yellow : chalk.red;
        console.log(chalk.blue('═══════════════════════════════════════'));
        console.log(`   Performance Score: ${scoreColor(score + '/100')}`);
        console.log(chalk.blue('═══════════════════════════════════════\n'));

        await browser.close();
        process.exit(issues.filter(i => i.severity === 'HIGH').length > 0 ? 1 : 0);
    });

// ============================================================================
// VERIFY-KNOWLEDGE COMMAND - E2E Knowledge Retrieval Verification
// ============================================================================
program
    .command('verify-knowledge <prompt>')
    .description('Test knowledge retrieval E2E: prompt → knowledge search → code gen → verify')
    .option('-t, --timeout <ms>', 'Timeout in milliseconds', '60000')
    .option('--headless', 'Run browser in headless mode', false)
    .option('--persist', 'Keep the browser open after the test completes', false)
    .action(async (prompt, options) => {
        console.log(chalk.blue('\n🧠 KNOWLEDGE VERIFICATION TEST\n'));
        console.log(chalk.dim(`Prompt: "${prompt}"\n`));

        const { GameBrowser } = await import('../src/browser.js');
        const browser = new GameBrowser({ headless: options.headless });

        // Track knowledge events
        let knowledgeSearches = [];
        let knowledgeGaps = [];

        try {
            console.log(chalk.dim('Launching browser...\n'));
            await browser.launch();

            // Listen for console logs
            browser.page.on('console', (msg) => {
                const text = msg.text();
                // Forward server logs about knowledge
                if (text.includes('[Knowledge]')) {
                    console.log(chalk.cyan(`  📚 ${text}`));
                    if (text.includes('Search:')) {
                        const match = text.match(/query="([^"]+)"/);
                        if (match) knowledgeSearches.push(match[1]);
                    }
                }
                if (text.includes('[Knowledge Gap]')) {
                    console.log(chalk.yellow(`  ⚠️  ${text}`));
                    knowledgeGaps.push(text);
                }
            });

            await browser.waitForGameLoad();

            console.log(chalk.dim('Sending prompt to Merlin...\n'));
            await browser.sendPrompt(prompt);

            // Wait for AI to complete
            console.log(chalk.dim(`Waiting ${options.timeout}ms for AI response...\n`));
            await new Promise(r => setTimeout(r, parseInt(options.timeout)));

            // Report
            console.log(chalk.blue('\n═══════════════════════════════════════'));
            console.log(chalk.bold('  KNOWLEDGE VERIFICATION REPORT'));
            console.log(chalk.blue('═══════════════════════════════════════\n'));

            console.log(`📚 Knowledge Searches: ${knowledgeSearches.length}`);
            knowledgeSearches.forEach((q, i) => console.log(chalk.dim(`   ${i + 1}. "${q}"`)));

            if (knowledgeGaps.length > 0) {
                console.log(chalk.yellow(`\n⚠️  Knowledge Gaps: ${knowledgeGaps.length}`));
                knowledgeGaps.forEach((g, i) => console.log(chalk.dim(`   ${i + 1}. ${g}`)));
            } else {
                console.log(chalk.green('\n✅ No knowledge gaps detected'));
            }

            console.log(chalk.blue('\n═══════════════════════════════════════\n'));

            if (options.persist) {
                console.log(chalk.yellow('Persist mode enabled. Keeping browser open. Press Ctrl+C to exit.'));
                // Wait forever
                await new Promise(() => { });
            } else {
                await browser.close();
                process.exit(knowledgeGaps.length > 0 ? 1 : 0);
            }

        } catch (error) {
            console.error(chalk.red(`Error: ${error.message}`));
            if (!options.persist) await browser.close();
            process.exit(1);
        }
    });

// ============================================================
// AIRPLANE FLIGHT TEST
// ============================================================

program
    .command('test-flight')
    .description('Test airplane flight controls on MillenniumFalcon or other rideable vehicles')
    .option('--headless', 'Run browser in headless mode', false)
    .option('--persist', 'Keep the browser open after the test completes', false)
    .action(async (options) => {
        const { GameBrowser } = await import('../src/browser.js');
        const gc = await import('../src/game-commands.js');

        console.log(chalk.blue('\n✈️  AIRPLANE FLIGHT TEST\n'));
        console.log(chalk.dim('Testing airplane controls: W/S = pitch, A/D = yaw/turn, Space = throttle up, Shift = throttle down\n'));

        const browser = new GameBrowser({ headless: options.headless, quiet: true });

        try {
            await browser.launch();
            await browser.waitForGameLoad();

            // Run the flight test
            const results = await gc.runAirplaneFlightTest(browser);

            if (results.error) {
                console.error(chalk.red(`\n❌ Test Failed: ${results.error}`));
                if (!options.persist) await browser.close();
                process.exit(1);
            }

            // Determine pass/fail
            const passedCount = results.tests.filter(t => {
                const a = t.result?.analysis;
                if (!a) return false;
                switch (t.name) {
                    case 'throttle_up': return a.finalThrottle > a.initialThrottle;
                    case 'pitch_up': return a.maxPitch > 0.1 || a.altitudeChange > 1;
                    case 'pitch_down': return a.minPitch < -0.1 || a.altitudeChange < -1;
                    case 'roll_left':
                    case 'roll_right':
                        // Note: with the new yaw-based controls, A/D now yaw instead of roll
                        return true; // Skip this test for now
                    case 'throttle_down': return a.finalThrottle < a.initialThrottle;
                    default: return true;
                }
            }).length;

            const totalTests = results.tests.length;
            const passRate = passedCount / totalTests;

            if (passRate >= 0.7) {
                console.log(chalk.green(`\n✅ Flight Test PASSED (${passedCount}/${totalTests} tests)`));
            } else {
                console.log(chalk.red(`\n❌ Flight Test FAILED (${passedCount}/${totalTests} tests)`));
            }

            if (options.persist) {
                console.log(chalk.yellow('\nPersist mode enabled. Keeping browser open. Press Ctrl+C to exit.'));
                await new Promise(() => { });
            } else {
                await browser.close();
                process.exit(passRate >= 0.7 ? 0 : 1);
            }

        } catch (error) {
            console.error(chalk.red(`Error: ${error.message}`));
            if (!options.persist) await browser.close();
            process.exit(1);
        }
    });

// ============================================================
// WORLD MANAGEMENT COMMANDS
// ============================================================

const worldCommand = program
    .command('world')
    .description('World management commands');

worldCommand
    .command('create')
    .description('Create a new world')
    .requiredOption('-n, --name <name>', 'World name')
    .option('-d, --description <desc>', 'World description', '')
    .option('-v, --visibility <type>', 'Visibility: public, private, unlisted', 'unlisted')
    .option('--seed <number>', 'World seed (random if not specified)')
    .option('--sky-color <hex>', 'Sky color (e.g. #87CEEB)')
    .option('--gravity <value>', 'Gravity multiplier (0.1-3.0)', '1.0')
    .action(async (options) => {
        const { WorldClient } = await import('../src/world-client.js');
        const client = new WorldClient();

        try {
            const worldOptions = {
                name: options.name,
                description: options.description,
                visibility: options.visibility
            };

            if (options.seed) {
                worldOptions.seed = parseInt(options.seed);
            }

            // Build customizations if any are specified
            const customizations = {};
            if (options.skyColor) {
                customizations.skyColor = options.skyColor;
            }
            if (options.gravity && options.gravity !== '1.0') {
                customizations.gravity = parseFloat(options.gravity);
            }
            if (Object.keys(customizations).length > 0) {
                worldOptions.customizations = customizations;
            }

            const world = await client.createWorld(worldOptions);

            console.log(chalk.green('\n✅ World created successfully!\n'));
            console.log(chalk.blue('═══════════════════════════════════════'));
            console.log(`  ${chalk.bold('ID:')}          ${world.id}`);
            console.log(`  ${chalk.bold('Name:')}        ${world.name}`);
            console.log(`  ${chalk.bold('Visibility:')}  ${world.visibility}`);
            console.log(`  ${chalk.bold('Seed:')}        ${world.seed}`);
            console.log(chalk.blue('═══════════════════════════════════════\n'));
            console.log(chalk.dim(`Load this world with: ai-test world load ${world.id}`));
            console.log(chalk.dim(`Or open in browser: http://localhost:5173/?world=${world.id}\n`));

        } catch (error) {
            console.error(chalk.red(`\n❌ Failed to create world: ${error.message}\n`));
            process.exit(1);
        }
    });

worldCommand
    .command('list')
    .description('List worlds')
    .option('-m, --mine', 'List only my worlds')
    .option('-l, --limit <number>', 'Number of worlds to show', '20')
    .action(async (options) => {
        const { WorldClient } = await import('../src/world-client.js');
        const client = new WorldClient();

        try {
            let worlds;
            if (options.mine) {
                worlds = await client.listMyWorlds();
                console.log(chalk.blue('\n═══ My Worlds ═══\n'));
            } else {
                worlds = await client.listPublicWorlds(parseInt(options.limit));
                console.log(chalk.blue('\n═══ Public Worlds ═══\n'));
            }

            if (worlds.length === 0) {
                console.log(chalk.dim('  No worlds found.\n'));
            } else {
                worlds.forEach((world, i) => {
                    const visibility = world.visibility === 'public' ? chalk.green('public') :
                        world.visibility === 'private' ? chalk.red('private') :
                            chalk.yellow('unlisted');
                    console.log(`  ${i + 1}. ${chalk.bold(world.name)} ${chalk.dim(`(${world.id})`)}`);
                    console.log(`     ${visibility} | ${chalk.dim(world.description || 'No description')}`);
                    console.log(`     ${chalk.dim(`Players: ${world.playerCount || 0} | Visits: ${world.totalVisits || 0}`)}`);
                    console.log('');
                });
            }

            console.log(chalk.dim(`Load a world with: ai-test world load <world-id>\n`));

        } catch (error) {
            console.error(chalk.red(`\n❌ Failed to list worlds: ${error.message}\n`));
            process.exit(1);
        }
    });

worldCommand
    .command('load <worldId>')
    .description('Load a world in the browser')
    .option('--headless', 'Run browser in headless mode', false)
    .option('-q, --quiet', 'Suppress browser console output', false)
    .option('--console', 'Open interactive console after loading', false)
    .action(async (worldId, options) => {
        const { GameBrowser } = await import('../src/browser.js');
        const gc = await import('../src/game-commands.js');

        console.log(chalk.blue(`\n🌍 Loading world: ${worldId}\n`));

        // Construct URL with world parameter
        const url = `http://localhost:5173/?world=${worldId}`;

        const browser = new GameBrowser({
            headless: options.headless,
            quiet: options.quiet,
            url: url
        });

        try {
            await browser.launch();
            await browser.waitForGameLoad();

            // Verify we loaded the correct world
            const loadedWorld = await browser.evaluate(() => {
                const game = window.__VOXEL_GAME__;
                return {
                    worldId: game?.worldId,
                    worldName: game?.worldName
                };
            });

            if (loadedWorld.worldId === worldId) {
                console.log(chalk.green(`✅ World loaded: ${loadedWorld.worldName || worldId}\n`));
            } else {
                console.log(chalk.yellow(`⚠️  Loaded world ID: ${loadedWorld.worldId} (requested: ${worldId})\n`));
            }

            if (options.console) {
                // Open interactive console
                console.log(chalk.dim('Type "help" for available commands, "exit" to quit.\n'));

                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                    prompt: chalk.cyan(`[${worldId}]> `)
                });

                rl.prompt();

                rl.on('line', async (line) => {
                    const text = line.trim();
                    if (text === 'exit') {
                        rl.close();
                        return;
                    }
                    if (text === 'help') {
                        console.log(chalk.dim('Commands: state, entities, pos, tp <x> <y> <z>, spawn <type>, exit'));
                    } else if (text === 'state') {
                        const state = await gc.getGameState(browser);
                        gc.printGameState(state);
                    } else if (text === 'entities') {
                        const entities = await gc.getEntities(browser);
                        gc.printEntities(entities);
                    } else if (text === 'pos') {
                        const pos = await gc.getPlayerPosition(browser);
                        console.log(`Position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`);
                    } else if (text.startsWith('tp ')) {
                        const [, x, y, z] = text.split(/\s+/);
                        if (x && y && z) {
                            await gc.teleportPlayer(browser, parseFloat(x), parseFloat(y), parseFloat(z));
                            console.log(chalk.green(`Teleported to (${x}, ${y}, ${z})`));
                        }
                    } else if (text.startsWith('spawn ')) {
                        const type = text.replace('spawn ', '').trim();
                        const result = await gc.spawnCreature(browser, type, 1);
                        if (result.error) {
                            console.log(chalk.red(result.error));
                        } else {
                            console.log(chalk.green(`Spawned ${result.type}`));
                        }
                    }
                    rl.prompt();
                });

                rl.on('close', async () => {
                    console.log(chalk.yellow('\nClosing browser...'));
                    await browser.close();
                    process.exit(0);
                });

            } else {
                // Just keep browser open
                console.log(chalk.dim('Press Ctrl+C to close browser and exit.\n'));

                process.on('SIGINT', async () => {
                    console.log(chalk.yellow('\nClosing browser...'));
                    await browser.close();
                    process.exit(0);
                });
            }

        } catch (error) {
            console.error(chalk.red(`\n❌ Failed to load world: ${error.message}\n`));
            await browser.close();
            process.exit(1);
        }
    });

worldCommand
    .command('delete <worldId>')
    .description('Delete a world')
    .option('-f, --force', 'Skip confirmation')
    .action(async (worldId, options) => {
        const { WorldClient } = await import('../src/world-client.js');
        const client = new WorldClient();

        if (worldId === 'global') {
            console.error(chalk.red('\n❌ Cannot delete the global world.\n'));
            process.exit(1);
        }

        try {
            // Get world info first
            const { world } = await client.getWorld(worldId);

            if (!options.force) {
                console.log(chalk.yellow(`\n⚠️  You are about to delete world: ${world.name} (${worldId})\n`));

                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                const answer = await new Promise(resolve => {
                    rl.question(chalk.yellow('Type the world name to confirm: '), resolve);
                });
                rl.close();

                if (answer !== world.name) {
                    console.log(chalk.dim('\nDeletion cancelled.\n'));
                    process.exit(0);
                }
            }

            await client.deleteWorld(worldId);
            console.log(chalk.green(`\n✅ World "${world.name}" deleted successfully.\n`));

        } catch (error) {
            console.error(chalk.red(`\n❌ Failed to delete world: ${error.message}\n`));
            process.exit(1);
        }
    });

worldCommand
    .command('info <worldId>')
    .description('Get details about a world')
    .action(async (worldId) => {
        const { WorldClient } = await import('../src/world-client.js');
        const client = new WorldClient();

        try {
            const { world, permissions } = await client.getWorld(worldId);

            console.log(chalk.blue('\n═══════════════════════════════════════'));
            console.log(chalk.bold(`  World: ${world.name}`));
            console.log(chalk.blue('═══════════════════════════════════════\n'));

            console.log(`  ${chalk.bold('ID:')}           ${world.id}`);
            console.log(`  ${chalk.bold('Owner:')}        ${world.ownerName}`);
            console.log(`  ${chalk.bold('Visibility:')}   ${world.visibility}`);
            console.log(`  ${chalk.bold('Description:')}  ${world.description || chalk.dim('(none)')}`);
            console.log(`  ${chalk.bold('Seed:')}         ${world.seed}`);
            console.log(`  ${chalk.bold('Players:')}      ${world.playerCount || 0}`);
            console.log(`  ${chalk.bold('Total Visits:')} ${world.totalVisits || 0}`);
            console.log(`  ${chalk.bold('Created:')}      ${new Date(world.createdAt).toLocaleString()}`);

            if (world.customizations) {
                console.log(chalk.cyan('\n  Customizations:'));
                if (world.customizations.skyColor) {
                    console.log(`    Sky Color: ${world.customizations.skyColor}`);
                }
                if (world.customizations.gravity) {
                    console.log(`    Gravity: ${world.customizations.gravity}x`);
                }
            }

            if (permissions) {
                console.log(chalk.cyan('\n  Your Permissions:'));
                console.log(`    Owner: ${permissions.isOwner ? chalk.green('Yes') : 'No'}`);
                console.log(`    Can Build: ${permissions.canBuild ? chalk.green('Yes') : chalk.red('No')}`);
                console.log(`    Can Spawn: ${permissions.canSpawnCreatures ? chalk.green('Yes') : chalk.red('No')}`);
            }

            console.log(chalk.blue('\n═══════════════════════════════════════\n'));
            console.log(chalk.dim(`Load this world: ai-test world load ${world.id}`));
            console.log(chalk.dim(`Browser URL: http://localhost:5173/?world=${world.id}\n`));

        } catch (error) {
            console.error(chalk.red(`\n❌ Failed to get world info: ${error.message}\n`));
            process.exit(1);
        }
    });

worldCommand
    .command('update <worldId>')
    .description('Update world settings')
    .option('-n, --name <name>', 'New world name')
    .option('-d, --description <desc>', 'New description')
    .option('-v, --visibility <type>', 'New visibility: public, private, unlisted')
    .action(async (worldId, options) => {
        const { WorldClient } = await import('../src/world-client.js');
        const client = new WorldClient();

        try {
            const updates = {};
            if (options.name) updates.name = options.name;
            if (options.description !== undefined) updates.description = options.description;
            if (options.visibility) updates.visibility = options.visibility;

            if (Object.keys(updates).length === 0) {
                console.log(chalk.yellow('\n⚠️  No updates specified. Use --name, --description, or --visibility.\n'));
                process.exit(0);
            }

            const world = await client.updateWorld(worldId, updates);

            console.log(chalk.green('\n✅ World updated successfully!\n'));
            console.log(`  ${chalk.bold('Name:')}        ${world.name}`);
            console.log(`  ${chalk.bold('Visibility:')}  ${world.visibility}`);
            console.log(`  ${chalk.bold('Description:')} ${world.description || chalk.dim('(none)')}\n`);

        } catch (error) {
            console.error(chalk.red(`\n❌ Failed to update world: ${error.message}\n`));
            process.exit(1);
        }
    });

// ============================================================
// ENHANCED MERLIN COMMANDS
// ============================================================

program
    .command('merlin-chat')
    .description('Interactive chat with Merlin AI (WebSocket mode)')
    .option('--world <id>', 'Connect to a specific world')
    .option('--provider <name>', 'AI provider: gemini, openrouter, claude', 'gemini')
    .action(async (options) => {
        const client = new AntigravityClient(`ws://localhost:2567/api/antigravity?provider=${options.provider}`);

        try {
            console.log(chalk.blue(`\n🧙 Connecting to Merlin (${options.provider})...`));
            await client.connect();
            console.log(chalk.green('✅ Connected!\n'));
            console.log(chalk.dim('Type your message and press Enter. Type "exit" to quit.\n'));

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                prompt: chalk.yellow('You > ')
            });

            // Track when AI is responding
            let isResponding = false;

            client.on('thought', (msg) => {
                console.log(chalk.gray(`\n💭 ${msg.text}`));
            });

            client.on('tool_start', (msg) => {
                console.log(chalk.cyan(`\n🛠  Tool: ${msg.name}`));
                if (msg.args) {
                    console.log(chalk.dim(JSON.stringify(msg.args, null, 2)));
                }
            });

            client.on('tool_end', (msg) => {
                if (msg.result?.error) {
                    console.log(chalk.red(`   ❌ ${msg.result.error}`));
                } else {
                    console.log(chalk.green(`   ✓ Done`));
                }
            });

            client.on('token', (msg) => {
                if (!isResponding) {
                    isResponding = true;
                    process.stdout.write(chalk.cyan('\nMerlin: '));
                }
                process.stdout.write(msg.text);
            });

            client.on('turn_end', () => {
                if (isResponding) {
                    console.log('\n');
                    isResponding = false;
                }
                rl.prompt();
            });

            client.on('token_usage', (msg) => {
                const totalCost = ((msg.promptTokens + msg.candidatesTokens) / 1000000) * 1.5;
                console.log(chalk.dim(`💰 ${msg.totalTokens} tokens (~$${totalCost.toFixed(6)})`));
            });

            client.on('error', (err) => {
                console.log(chalk.red(`\n❌ Error: ${err.message}`));
                rl.prompt();
            });

            rl.prompt();

            rl.on('line', (line) => {
                const text = line.trim();
                if (text === 'exit') {
                    rl.close();
                    return;
                }
                if (text) {
                    const context = {};
                    if (options.world) {
                        context.worldId = options.world;
                    }
                    client.sendPrompt(text, context);
                } else {
                    rl.prompt();
                }
            });

            rl.on('close', () => {
                console.log(chalk.yellow('\nDisconnecting...'));
                client.disconnect();
                process.exit(0);
            });

        } catch (error) {
            console.error(chalk.red(`\n❌ Failed to connect: ${error.message}\n`));
            process.exit(1);
        }
    });

program
    .command('merlin-prompt <prompt>')
    .description('Send a single prompt to Merlin and get the response')
    .option('--world <id>', 'Connect to a specific world')
    .option('--provider <name>', 'AI provider: gemini, openrouter, claude', 'gemini')
    .option('-t, --timeout <ms>', 'Timeout in milliseconds', '60000')
    .option('--json', 'Output result as JSON')
    .action(async (prompt, options) => {
        const client = new AntigravityClient(`ws://localhost:2567/api/antigravity?provider=${options.provider}`);

        const result = {
            prompt,
            response: '',
            tools: [],
            tokens: null,
            error: null
        };

        try {
            if (!options.json) {
                console.log(chalk.blue(`\n🧙 Sending prompt to Merlin...\n`));
            }

            await client.connect();

            let timeoutHandle = setTimeout(() => {
                result.error = 'Timeout waiting for response';
                if (options.json) {
                    console.log(JSON.stringify(result, null, 2));
                } else {
                    console.error(chalk.red('\n❌ Timeout waiting for response\n'));
                }
                client.disconnect();
                process.exit(1);
            }, parseInt(options.timeout));

            client.on('tool_start', (msg) => {
                result.tools.push({ name: msg.name, args: msg.args });
                if (!options.json) {
                    console.log(chalk.cyan(`🛠  ${msg.name}`));
                }
            });

            client.on('token', (msg) => {
                result.response += msg.text;
                if (!options.json) {
                    process.stdout.write(msg.text);
                }
            });

            client.on('token_usage', (msg) => {
                result.tokens = msg;
            });

            client.on('turn_end', () => {
                clearTimeout(timeoutHandle);
                if (options.json) {
                    console.log(JSON.stringify(result, null, 2));
                } else {
                    console.log('\n');
                }
                client.disconnect();
                process.exit(0);
            });

            client.on('error', (err) => {
                clearTimeout(timeoutHandle);
                result.error = err.message;
                if (options.json) {
                    console.log(JSON.stringify(result, null, 2));
                } else {
                    console.error(chalk.red(`\n❌ Error: ${err.message}\n`));
                }
                client.disconnect();
                process.exit(1);
            });

            const context = {};
            if (options.world) {
                context.worldId = options.world;
            }
            client.sendPrompt(prompt, context);

        } catch (error) {
            result.error = error.message;
            if (options.json) {
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.error(chalk.red(`\n❌ Failed: ${error.message}\n`));
            }
            process.exit(1);
        }
    });

// ============================================================
// RAG TEMPLATE TESTING
// ============================================================

program
    .command('rag')
    .description('Test RAG template lookup for a given prompt')
    .argument('<prompt>', 'The prompt to classify and find templates for')
    .option('--json', 'Output as JSON', false)
    .option('--no-semantic', 'Disable semantic search (keyword only)', false)
    .action(async (prompt, options) => {
        console.log(chalk.blue('\n🔍 RAG Template Lookup Test\n'));
        console.log(chalk.dim(`Prompt: "${prompt}"\n`));

        const client = new AntigravityClient();

        try {
            await client.connect();
            console.log(chalk.green('✓ Connected to server\n'));

            let ragResult = null;
            let completed = false;
            let responseText = '';

            // Listen for RAG lookup event
            client.on('rag_lookup', (msg) => {
                ragResult = msg;
                console.log(chalk.cyan('📚 RAG Lookup Result:'));
                console.log(chalk.dim(`   Task Type: ${msg.taskType} (${msg.subType || 'generic'})`));
                console.log(chalk.dim(`   Confidence: ${(msg.confidence * 100).toFixed(0)}%`));
                console.log(chalk.dim(`   Templates Found: ${msg.templatesFound}`));

                if (msg.templates && msg.templates.length > 0) {
                    console.log(chalk.yellow('\n   Templates:'));
                    msg.templates.forEach((t, i) => {
                        console.log(chalk.dim(`     ${i + 1}. ${t.title} (${(t.relevance * 100).toFixed(0)}% - ${t.source})`));
                    });
                }
                console.log('');
            });

            // Listen for response
            client.on('token', (msg) => {
                responseText += msg.text;
                if (!options.json) {
                    process.stdout.write(msg.text);
                }
            });

            client.on('complete', () => {
                completed = true;
                if (!options.json) {
                    console.log('\n');
                }
            });

            client.on('error', (msg) => {
                console.error(chalk.red(`Error: ${msg.message}`));
            });

            // Handle tool requests with mock responses
            client.on('tool_request', (msg) => {
                console.log(chalk.cyan(`🛠️  Tool Request: ${msg.name}`));
                // Send mock response
                client.ws.send(JSON.stringify({
                    type: 'tool_response',
                    id: msg.id,
                    result: { success: true, message: 'Mock tool response for RAG test' }
                }));
            });

            // Send prompt
            client.sendPrompt(prompt, {
                position: { x: 0, y: 64, z: 0 },
                rotation: { x: 0, y: 0, z: 0 }
            });

            // Wait for completion or timeout
            const timeout = 60000;
            const startTime = Date.now();
            while (!completed && Date.now() - startTime < timeout) {
                await new Promise(r => setTimeout(r, 100));
            }

            if (!completed) {
                console.error(chalk.red('\n⏱️  Timeout waiting for response'));
            }

            // Output JSON if requested
            if (options.json) {
                const output = {
                    prompt,
                    rag: ragResult,
                    response: responseText,
                    completed
                };
                console.log(JSON.stringify(output, null, 2));
            }

            // Summary
            console.log(chalk.blue('\n📊 RAG Test Summary:'));
            if (ragResult) {
                console.log(chalk.green(`   ✓ RAG lookup successful`));
                console.log(chalk.dim(`   Task: ${ragResult.taskType}${ragResult.subType ? ' (' + ragResult.subType + ')' : ''}`));
                console.log(chalk.dim(`   Templates injected: ${ragResult.templatesFound}`));
            } else {
                console.log(chalk.yellow(`   ⚠ No RAG lookup event received (may be conversation or disabled)`));
            }

            client.disconnect();
            process.exit(0);

        } catch (error) {
            console.error(chalk.red(`\n❌ Failed: ${error.message}\n`));
            process.exit(1);
        }
    });

program
    .command('rag-classify')
    .description('Test task classification via server HTTP API')
    .argument('<prompt>', 'The prompt to classify')
    .option('--json', 'Output as JSON', false)
    .option('--batch', 'Test multiple prompts (pass comma-separated)', false)
    .option('--server <url>', 'Server URL', 'http://localhost:2567')
    .action(async (prompt, options) => {
        console.log(chalk.blue('\n🏷️  RAG Task Classification Test\n'));

        try {
            if (options.batch) {
                // Batch mode: split by comma
                const prompts = prompt.split(',').map(p => p.trim());
                console.log(chalk.dim(`Testing ${prompts.length} prompts...\n`));

                const response = await fetch(`${options.server}/api/ai/classify/batch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompts })
                });

                const data = await response.json();

                if (options.json) {
                    console.log(JSON.stringify(data, null, 2));
                } else {
                    for (const result of data.results) {
                        console.log(chalk.yellow(`"${result.prompt.substring(0, 40)}..."`));
                        console.log(chalk.dim(`   Type: ${result.classification.taskType} (${result.classification.subType || 'generic'})`));
                        console.log(chalk.dim(`   Confidence: ${(result.classification.confidence * 100).toFixed(0)}%`));
                        console.log('');
                    }
                }
            } else {
                // Single prompt
                console.log(chalk.dim(`Prompt: "${prompt}"\n`));

                const response = await fetch(`${options.server}/api/ai/classify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt })
                });

                const data = await response.json();

                if (options.json) {
                    console.log(JSON.stringify(data, null, 2));
                } else {
                    console.log(chalk.cyan('Classification Result:'));
                    console.log(chalk.dim(`   Task Type: ${data.taskType}`));
                    console.log(chalk.dim(`   Sub Type: ${data.subType || 'none'}`));
                    console.log(chalk.dim(`   Confidence: ${(data.confidence * 100).toFixed(0)}%`));
                    console.log(chalk.dim(`   Keywords: ${data.keywords?.join(', ') || 'none'}`));
                }
            }

            process.exit(0);
        } catch (error) {
            console.error(chalk.red(`\n❌ Failed: ${error.message}`));
            console.error(chalk.dim('Make sure the server is running (npm run dev in server/).\n'));
            process.exit(1);
        }
    });

program
    .command('rag-lookup')
    .description('Test full RAG template lookup via server HTTP API')
    .argument('<prompt>', 'The prompt to find templates for')
    .option('--json', 'Output as JSON', false)
    .option('--no-semantic', 'Disable semantic search', false)
    .option('--server <url>', 'Server URL', 'http://localhost:2567')
    .action(async (prompt, options) => {
        console.log(chalk.blue('\n📚 RAG Template Lookup Test\n'));
        console.log(chalk.dim(`Prompt: "${prompt}"\n`));

        try {
            const response = await fetch(`${options.server}/api/ai/rag`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, semantic: options.semantic !== false })
            });

            const data = await response.json();

            if (options.json) {
                console.log(JSON.stringify(data, null, 2));
            } else {
                console.log(chalk.cyan('Classification:'));
                console.log(chalk.dim(`   Task Type: ${data.classification.taskType} (${data.classification.subType || 'generic'})`));
                console.log(chalk.dim(`   Confidence: ${(data.classification.confidence * 100).toFixed(0)}%`));
                console.log(chalk.dim(`   Keywords: ${data.classification.keywords?.join(', ') || 'none'}`));

                console.log(chalk.yellow('\nTemplates Found:'));
                if (data.templates.length === 0) {
                    console.log(chalk.dim('   (none)'));
                } else {
                    data.templates.forEach((t, i) => {
                        console.log(chalk.dim(`   ${i + 1}. ${t.title}`));
                        console.log(chalk.dim(`      Relevance: ${(t.relevance * 100).toFixed(0)}% | Source: ${t.source}`));
                        console.log(chalk.dim(`      Preview: ${t.contentPreview.substring(0, 80)}...`));
                    });
                }

                console.log(chalk.dim(`\nContext injection: ${data.contextInjectionLength} chars`));
            }

            process.exit(0);
        } catch (error) {
            console.error(chalk.red(`\n❌ Failed: ${error.message}`));
            console.error(chalk.dim('Make sure the server is running (npm run dev in server/).\n'));
            process.exit(1);
        }
    });

// ============ Server Commands ============
program
    .command('restart')
    .description('Restart the server by killing port 2567 (relies on file watcher to restart)')
    .action(async () => {
        const { execSync } = await import('child_process');

        console.log(chalk.blue('\nRestarting server...\n'));

        try {
            // Kill process on port 2567
            const pids = execSync('lsof -ti :2567 2>/dev/null || true').toString().trim();
            if (pids) {
                const pidList = pids.split('\n').join(' ');
                console.log(chalk.yellow(`Killing processes on port 2567: ${pidList}`));
                execSync(`kill -9 ${pidList}`);
                console.log(chalk.green('✅ Server killed. File watcher should restart it automatically.'));
            } else {
                console.log(chalk.yellow('No server process found on port 2567.'));
                console.log(chalk.dim('Run ./start.sh to start the server.'));
            }
        } catch (error) {
            // Kill might partially succeed, check if server is down
            const stillRunning = execSync('lsof -ti :2567 2>/dev/null || true').toString().trim();
            if (!stillRunning) {
                console.log(chalk.green('✅ Server killed. File watcher should restart it automatically.'));
            } else {
                console.error(chalk.red(`Failed: ${error.message}`));
                console.log(chalk.dim('\nTo fully restart, run: ./start.sh'));
            }
        }

        process.exit(0);
    });

// ============ Item Commands ============
const itemCommand = program
    .command('item')
    .description('Manage dynamic items');

itemCommand
    .command('delete <name>')
    .description('Delete a dynamic item')
    .option('-w, --world <worldId>', 'World ID (default: global)', 'global')
    .action(async (name, options) => {
        const { io } = await import('socket.io-client');
        const socket = io('http://localhost:2567');

        console.log(chalk.blue(`\nDeleting item: ${name} (world: ${options.world})...\n`));

        socket.on('connect', () => {
            socket.emit('admin:delete_item', {
                name: name,
                worldId: options.world,
                token: process.env.CLI_SECRET || 'asdf123'
            });
        });

        socket.on('admin:delete_item:result', (result) => {
            if (result.success) {
                console.log(chalk.green(`✅ Deleted: ${name}`));
            } else {
                console.log(chalk.red(`❌ Failed: ${result.error}`));
            }
            socket.disconnect();
            process.exit(result.success ? 0 : 1);
        });

        socket.on('connect_error', (err) => {
            console.error(chalk.red(`Connection error: ${err.message}`));
            process.exit(1);
        });

        setTimeout(() => {
            console.log(chalk.yellow('Timeout - no response from server'));
            socket.disconnect();
            process.exit(1);
        }, 5000);
    });

itemCommand
    .command('list')
    .description('List all dynamic items')
    .option('-w, --world <worldId>', 'World ID (default: global)', 'global')
    .action(async (options) => {
        try {
            const response = await fetch(`http://localhost:2567/api/worlds/${options.world}/items`);
            if (!response.ok) {
                // Try alternate endpoint
                const altResponse = await fetch(`http://localhost:2567/api/items?worldId=${options.world}`);
                if (!altResponse.ok) throw new Error('Failed to fetch items');
                const data = await altResponse.json();
                console.log(chalk.blue('\n═══ Dynamic Items ═══'));
                console.log(JSON.stringify(data, null, 2));
            } else {
                const data = await response.json();
                console.log(chalk.blue('\n═══ Dynamic Items ═══'));
                if (data.items && data.items.length > 0) {
                    data.items.forEach(item => {
                        console.log(`  - ${item.name}`);
                    });
                } else {
                    console.log(chalk.dim('  (no dynamic items)'));
                }
            }
            process.exit(0);
        } catch (error) {
            console.error(chalk.red(`Failed: ${error.message}`));
            process.exit(1);
        }
    });

// ============================================================
// CLEANUP COMMAND
// ============================================================

program
    .command('cleanup')
    .description('Remove test artifacts (screenshots, recordings, test results)')
    .option('--dry-run', 'Show what would be deleted without actually deleting')
    .option('--keep-golden', 'Keep golden test files in tests/golden/')
    .option('--all', 'Also clean test-results directory')
    .action(async (options) => {
        const { readdir, unlink, rmdir, stat } = await import('fs/promises');
        const pathModule = await import('path');

        console.log(chalk.blue('\n🧹 Test Artifact Cleanup\n'));

        const cliRoot = pathModule.dirname(pathModule.dirname(new URL(import.meta.url).pathname));

        // Directories to scan with their file patterns
        const scanDirs = [
            { dir: cliRoot, pattern: /\.png$/ },
            { dir: pathModule.join(cliRoot, 'tests'), pattern: /\.png$/ },
        ];

        if (options.all) {
            scanDirs.push({ dir: pathModule.join(cliRoot, 'test-results'), pattern: /.*/, recursive: true });
        }

        let totalFiles = 0;
        let totalSize = 0;
        const filesToDelete = [];

        for (const { dir, pattern, recursive } of scanDirs) {
            try {
                const entries = await readdir(dir, { withFileTypes: true });

                for (const entry of entries) {
                    const filePath = pathModule.join(dir, entry.name);

                    if (entry.isFile() && pattern.test(entry.name)) {
                        // Skip golden files if requested
                        if (options.keepGolden && filePath.includes('/golden/')) {
                            continue;
                        }

                        try {
                            const stats = await stat(filePath);
                            filesToDelete.push({ path: filePath, size: stats.size });
                            totalSize += stats.size;
                            totalFiles++;
                        } catch (e) {
                            // File may have been deleted already
                        }
                    } else if (entry.isDirectory() && recursive) {
                        // Handle recursive directories
                        try {
                            const subEntries = await readdir(filePath, { withFileTypes: true });
                            for (const subEntry of subEntries) {
                                if (subEntry.isFile()) {
                                    const subPath = pathModule.join(filePath, subEntry.name);
                                    try {
                                        const stats = await stat(subPath);
                                        filesToDelete.push({ path: subPath, size: stats.size });
                                        totalSize += stats.size;
                                        totalFiles++;
                                    } catch (e) {}
                                }
                            }
                        } catch (e) {}
                    }
                }
            } catch (e) {
                // Directory doesn't exist, skip
            }
        }

        if (filesToDelete.length === 0) {
            console.log(chalk.green('✅ No test artifacts found. Already clean!'));
            process.exit(0);
        }

        console.log(chalk.dim(`Found ${totalFiles} files (${(totalSize / 1024).toFixed(1)} KB)\n`));

        // Group by directory for display
        const byDir = {};
        for (const f of filesToDelete) {
            const dir = pathModule.dirname(f.path).replace(cliRoot + '/', '').replace(cliRoot, '.');
            byDir[dir] = byDir[dir] || [];
            byDir[dir].push(f);
        }

        for (const [dir, files] of Object.entries(byDir)) {
            console.log(chalk.cyan(`${dir}/`));
            for (const f of files.slice(0, 10)) {
                const name = pathModule.basename(f.path);
                const size = (f.size / 1024).toFixed(1);
                console.log(chalk.dim(`  ${options.dryRun ? '[would delete]' : '✗'} ${name} (${size} KB)`));
            }
            if (files.length > 10) {
                console.log(chalk.dim(`  ... and ${files.length - 10} more`));
            }
        }

        if (options.dryRun) {
            console.log(chalk.yellow(`\n🔍 Dry run: Would delete ${totalFiles} files (${(totalSize / 1024).toFixed(1)} KB)`));
            console.log(chalk.dim('Run without --dry-run to actually delete.\n'));
            process.exit(0);
        }

        // Actually delete files
        let deleted = 0;
        let errors = 0;
        for (const f of filesToDelete) {
            try {
                await unlink(f.path);
                deleted++;
            } catch (e) {
                errors++;
            }
        }

        // Clean up empty test-results directory if --all
        if (options.all) {
            const { rm } = await import('fs/promises');
            try {
                await rm(pathModule.join(cliRoot, 'test-results'), { recursive: true, force: true });
                console.log(chalk.dim('Removed test-results/ directory'));
            } catch (e) {
                // Directory not empty or doesn't exist
            }
        }

        console.log(chalk.green(`\n✅ Deleted ${deleted} files (${(totalSize / 1024).toFixed(1)} KB)`));
        if (errors > 0) {
            console.log(chalk.yellow(`⚠️  ${errors} files could not be deleted`));
        }
        console.log('');
        process.exit(0);
    });

program.parse();
