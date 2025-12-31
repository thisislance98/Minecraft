#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import readline from 'readline';
import { AntigravityClient } from '../src/client.js';

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

program.parse();
