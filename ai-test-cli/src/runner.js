import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { AntigravityClient } from './client.js';

export class TestRunner {
    constructor(testFile) {
        this.testFilePath = path.resolve(testFile);
        this.client = new AntigravityClient();
    }

    async run() {
        try {
            const testContent = await fs.readFile(this.testFilePath, 'utf-8');
            const testCase = JSON.parse(testContent);

            console.log(chalk.blue(`\nRunning Test: ${testCase.name}`));
            console.log(chalk.gray(`Prompt: "${testCase.prompt}"`));

            await this.client.connect();

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Test timed out - expected tool call not received'));
                }, testCase.timeout || 30000);

                this.client.sendPrompt(testCase.prompt);

                this.client.on('tool_start', (msg) => {
                    console.log(chalk.dim(`  -> Tool called: ${msg.name}`));

                    if (msg.name === testCase.expectedTool) {
                        // Check arguments if specified
                        if (testCase.expectedArgs) {
                            for (const [key, value] of Object.entries(testCase.expectedArgs)) {
                                if (msg.args[key] !== value && !msg.args[key]?.includes(value)) {
                                    console.log(chalk.yellow(`    ⚠️  Arg mismatch for ${key}. Got: ${msg.args[key]}, Expected: ${value}`));
                                    return; // Not the tool call we are looking for?
                                }
                            }
                        }

                        clearTimeout(timeout);
                        console.log(chalk.green(`\n✅ Test Passed! Caught expected tool: ${msg.name}`));

                        // Verification Step (Optional extension: check file system, etc.)

                        this.client.disconnect();
                        resolve(true);
                    }
                });

                this.client.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
            });

        } catch (error) {
            console.error(chalk.red(`\n❌ Test Failed: ${error.message}`));
            if (this.client.isConnected) this.client.disconnect();
            throw error;
        }
    }
}
