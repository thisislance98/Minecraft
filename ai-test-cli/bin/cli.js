#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import readline from 'readline';
import { AntigravityClient } from '../src/client.js';
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

program
    .command('run')
    .description('Run an automated test verification file')
    .argument('<file>', 'Path to valid .json test file')
    .action(async (file) => {
        const { TestRunner } = await import('../src/runner.js');
        const runner = new TestRunner(file);
        try {
            await runner.run();
            process.exit(0);
        } catch (e) {
            process.exit(1);
        }
    });

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
    .option('--verify-distance <meters>', 'Distance to check (default 25)')
    .option('--verify-file <path>', 'Load custom verification code from file [GENERATED]')
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
                console.log('  exit           - Close browser and exit');
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

program.parse();

