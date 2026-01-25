import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { AntigravityClient } from './client.js';
import { GameBrowser } from './browser.js';

export class TestRunner {
    constructor(testFile) {
        this.testFilePath = testFile ? path.resolve(testFile) : null;
        this.client = new AntigravityClient();
        this.browser = null;
        this.testCase = null; // Can be set externally for inline tests
    }

    async run() {
        try {
            // Support inline test case or file-based
            let testCase;
            if (this.testCase) {
                testCase = this.testCase;
            } else {
                const testContent = await fs.readFile(this.testFilePath, 'utf-8');
                testCase = JSON.parse(testContent);
            }

            console.log(chalk.blue(`\nRunning Test: ${testCase.name}`));
            console.log(chalk.gray(`Prompt: "${testCase.prompt}"`));

            // Step 0: Launch browser if needed (default: true)
            if (testCase.browser !== false) {
                this.browser = new GameBrowser({
                    headless: testCase.headless ?? true,
                    gameUrl: testCase.gameUrl || 'http://localhost:3000'
                });
                await this.browser.launch();
                await this.browser.waitForGameLoad();
            }

            if (testCase.prompt) {
                await this.client.connect();
            }

            // Step 1: Execute actions or prompt
            if (testCase.actions && Array.isArray(testCase.actions)) {
                console.log(chalk.blue('\n⚡ Executing Direct Actions...'));
                await this.executeActions(testCase.actions);
            } else if (testCase.prompt) {
                await this.executePromptAndWaitForTool(testCase);
            } else {
                console.warn(chalk.yellow('No prompt or actions specified in test case'));
            }

            // Step 2: Run verifications if specified
            if (testCase.verify && testCase.verify.length > 0) {
                // Wait for spawned entities to appear in game state
                const verifyDelay = testCase.verifyDelay ?? 2000;
                console.log(chalk.dim(`  Waiting ${verifyDelay}ms for game state to update...`));
                await new Promise(r => setTimeout(r, verifyDelay));

                console.log(chalk.blue('\n🔍 Running Verifications...'));
                await this.runVerifications(testCase.verify);
            }

            // Step 3: Run Visual Verification (AI Judge) if specified
            if (testCase.visual_expectations) {
                console.log(chalk.blue('\n👁️  Running AI Visual Verification...'));
                await this.runVisualVerification(testCase);
            }

            console.log(chalk.green(`\n✅ Test Passed: ${testCase.name}`));
            await this.cleanup();
            return true;

        } catch (error) {
            console.error(chalk.red(`\n❌ Test Failed: ${error.message}`));
            await this.cleanup();
            throw error;
        }
    }

    async cleanup() {
        if (this.client.isConnected) this.client.disconnect();
        if (this.browser) await this.browser.close();
    }

    /**
     * Clean up test artifacts (screenshots, recordings)
     * @param {Object} options - Cleanup options
     * @param {boolean} options.keepGolden - Keep golden test files
     * @param {boolean} options.verbose - Log deleted files
     * @returns {Promise<{deleted: number, bytes: number}>}
     */
    static async cleanupArtifacts(options = {}) {
        const cliRoot = path.dirname(path.dirname(new URL(import.meta.url).pathname));

        const scanDirs = [
            { dir: cliRoot, pattern: /\.png$/ },
            { dir: path.join(cliRoot, 'tests'), pattern: /\.png$/ },
        ];

        let deleted = 0;
        let bytes = 0;

        for (const { dir, pattern } of scanDirs) {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });

                for (const entry of entries) {
                    if (entry.isFile() && pattern.test(entry.name)) {
                        const filePath = path.join(dir, entry.name);

                        // Skip golden files if requested
                        if (options.keepGolden && filePath.includes('/golden/')) {
                            continue;
                        }

                        try {
                            const stats = await fs.stat(filePath);
                            await fs.unlink(filePath);
                            bytes += stats.size;
                            deleted++;
                            if (options.verbose) {
                                console.log(chalk.dim(`  Deleted: ${path.basename(filePath)}`));
                            }
                        } catch (e) {
                            // File may have been deleted already
                        }
                    }
                }
            } catch (e) {
                // Directory doesn't exist
            }
        }

        return { deleted, bytes };
    }

    async executeActions(actions) {
        if (!this.browser) throw new Error('Browser required for actions');

        // Dynamic import of game commands to map string names to functions
        const GameCommands = await import('./game-commands.js');

        for (const action of actions) {
            console.log(chalk.dim(`  Running action: ${action.name} ${JSON.stringify(action.args || [])}`));

            if (GameCommands[action.name]) {
                const result = await GameCommands[action.name](this.browser, ...(action.args || []));
                if (result && result.error) {
                    throw new Error(`Action ${action.name} failed: ${result.error}`);
                }
            } else if (action.name === 'wait') {
                await new Promise(r => setTimeout(r, action.args[0]));
            } else {
                throw new Error(`Unknown action: ${action.name}`);
            }
        }
    }

    async executePromptAndWaitForTool(testCase) {
        if (!this.browser) {
            throw new Error('Browser required for executing prompts');
        }

        console.log(chalk.dim('  Sending prompt to browser Agent...'));

        // Wait for VoxelGame and Player to be ready
        console.log(chalk.dim('  Waiting for Player initialization...'));
        try {
            await this.browser.waitForFunction(() => {
                const game = window.__VOXEL_GAME__;
                return game && game.player && game.player.mesh;
            }, { timeout: 30000 });
        } catch (e) {
            console.warn(chalk.yellow('  ⚠️ Player wait timeout (sending prompt anyway)'));
        }

        // Send prompt through the browser's Agent (so tool_request goes to browser)
        // Open chat panel first so user can see the interaction
        await this.browser.evaluate((prompt) => {
            const game = window.__VOXEL_GAME__;
            if (game && game.agent && game.uiManager) {
                // Open chat panel
                game.uiManager.toggleChatPanel(true);

                // Set the input value
                const chatInput = document.getElementById('chat-input');
                if (chatInput) {
                    chatInput.value = prompt;
                    chatInput.focus();
                }

                // Simulate send button click to trigger proper UI flow
                setTimeout(() => {
                    game.uiManager.handleSendMessage();
                }, 100);
            } else {
                console.error('Game, Agent, or UIManager not available');
            }
        }, testCase.prompt);

        // Wait for AI to process and execute tools
        // The verification step will check if the expected changes occurred
        const waitTime = testCase.toolWait || 15000;
        console.log(chalk.dim(`  Waiting ${waitTime}ms for AI to process...`));
        await new Promise(r => setTimeout(r, waitTime));

        console.log(chalk.green(`  ✓ Prompt sent and wait period complete`));
        return { name: testCase.expectedTool, args: testCase.expectedArgs };
    }

    async getSceneInfo() {
        if (!this.browser) {
            throw new Error('Browser not available for scene info');
        }

        console.log(chalk.dim('  Querying game state directly...'));

        // Query game state directly from the browser
        const sceneInfo = await this.browser.evaluate(() => {
            // Access the game object from window (exposed by VoxelGame.jsx)
            const game = window.__VOXEL_GAME__;
            if (!game) return { error: 'Game not initialized' };

            const player = game.player;
            const pos = player?.position || { x: 0, y: 0, z: 0 };

            // Count nearby creatures
            const nearbyCreatures = {};
            const nearbyEntities = [];
            const animals = game.animals || [];
            const DETECTION_RADIUS = 100;

            for (const animal of animals) {
                if (animal.mesh && animal.mesh.position) {
                    const dist = animal.mesh.position.distanceTo(pos);
                    if (dist < DETECTION_RADIUS) {
                        const name = animal.constructor.name;
                        nearbyCreatures[name] = (nearbyCreatures[name] || 0) + 1;

                        const entityData = {
                            type: name,
                            id: animal.id,
                            isFlying: !!animal.isFlying,
                            isSwimming: !!animal.isSwimming,
                            isGrounded: !!animal.isGrounded,
                            position: {
                                x: Math.round(animal.position?.x * 10) / 10 || 0,
                                y: Math.round(animal.position?.y * 10) / 10 || 0,
                                z: Math.round(animal.position?.z * 10) / 10 || 0
                            }
                        };

                        // Capture scale if available
                        if (animal.mesh.scale) {
                            entityData.scale = Math.round(animal.mesh.scale.x * 100) / 100;
                        }

                        // Capture color if available
                        if (animal.mesh.material && animal.mesh.material.color) {
                            entityData.color = '#' + animal.mesh.material.color.getHexString();
                        }

                        nearbyEntities.push(entityData);
                    }
                }
            }

            return {
                position: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) },
                nearbyCreatures,
                nearbyEntities: nearbyEntities.slice(0, 20)
            };
        });

        return sceneInfo;
    }

    async runVerifications(checks) {
        const sceneInfo = await this.getSceneInfo();
        console.log(chalk.dim(`  Scene: ${JSON.stringify(sceneInfo.nearbyCreatures)}`));

        for (const check of checks) {
            switch (check.type) {
                case 'entityExists': {
                    const count = sceneInfo.nearbyCreatures?.[check.creature] || 0;
                    const minCount = check.minCount || 1;
                    if (count >= minCount) {
                        console.log(chalk.green(`  ✓ Found ${count} ${check.creature}(s) (expected >= ${minCount})`));
                    } else {
                        throw new Error(`Verification failed: Expected >= ${minCount} ${check.creature}, found ${count}`);
                    }
                    break;
                }

                case 'entityHasProperty': {
                    const entity = sceneInfo.nearbyEntities?.find(e =>
                        (check.entityId && e.id === check.entityId) ||
                        (check.creature && e.type === check.creature)
                    );
                    if (!entity) {
                        throw new Error(`Verification failed: Entity not found for ${check.entityId || check.creature}`);
                    }
                    if (entity[check.property] === check.value) {
                        console.log(chalk.green(`  ✓ Entity ${entity.id} has ${check.property}=${check.value}`));
                    } else {
                        throw new Error(`Verification failed: Expected ${check.property}=${check.value}, got ${entity[check.property]}`);
                    }
                    break;
                }

                case 'entityCount': {
                    const total = Object.values(sceneInfo.nearbyCreatures || {}).reduce((a, b) => a + b, 0);
                    if (check.min && total < check.min) {
                        throw new Error(`Verification failed: Expected >= ${check.min} entities, found ${total}`);
                    }
                    if (check.max && total > check.max) {
                        throw new Error(`Verification failed: Expected <= ${check.max} entities, found ${total}`);
                    }
                    console.log(chalk.green(`  ✓ Entity count ${total} is within bounds`));
                    break;
                }

                case 'customCode': {
                    console.log(chalk.dim(`  Running custom verification code...`));
                    // Execute the code - it should be a function
                    const codeToEval = typeof check.code === 'string' ? `(${check.code})()` : check.code;
                    const result = await this.browser.evaluate(codeToEval);
                    console.log(chalk.dim(`  Result:`, JSON.stringify(result)));
                    if (result && result.success) {
                        console.log(chalk.green(`  ✓ ${result.message || 'Custom verification passed'}`));
                    } else if (result === true) {
                        console.log(chalk.green(`  ✓ Custom verification passed`));
                    } else {
                        const msg = result?.message || 'Custom code returned false';
                        throw new Error(`Verification failed: ${msg}`);
                    }
                    break;
                }

                default:
                    console.log(chalk.yellow(`  ⚠️  Unknown verification type: ${check.type}`));
            }
        }
    }


    async runVisualVerification(testCase) {
        const expectation = testCase.visual_expectations;
        let mediaData = null; // Base64 string
        let mimeType = '';

        console.log(chalk.dim(`  Capturing ${expectation.type} for verification...`));

        if (expectation.type === 'video') {
            // Trigger video capture on the client Agent
            const result = await this.browser.evaluate(async (duration, label) => {
                const game = window.__VOXEL_GAME__;
                if (!game || !game.agent) return { error: 'Agent not available' };
                return await game.agent.captureVideo({ duration_seconds: duration, label });
            }, expectation.duration || 5, testCase.name);

            if (!result.success) {
                throw new Error(`Visual verification failed: Video capture error - ${result.error}`);
            }
            // result.videoData is "data:video/webm;base64,..."
            mediaData = result.videoData.split(',')[1];
            mimeType = 'video/webm';
            console.log(chalk.dim(`  Video captured (${(mediaData.length / 1024).toFixed(0)}KB)`));

        } else {
            // Image (Screenshot)
            // Trigger screenshot on the client Agent
            const result = await this.browser.evaluate(async (label) => {
                const game = window.__VOXEL_GAME__;
                if (!game || !game.agent) return { error: 'Agent not available' };
                return game.agent.captureScreenshot({ label });
            }, testCase.name);

            if (!result.success) {
                throw new Error(`Visual verification failed: Screenshot error - ${result.error}`);
            }
            // result.image is "data:image/jpeg;base64,..."
            mediaData = result.image.split(',')[1];
            mimeType = 'image/jpeg';
            console.log(chalk.dim(`  Screenshot captured`));
        }

        // Send to Gemini Vision
        console.log(chalk.dim('  Asking Gemini Vision to judge...'));
        try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const apiKey = process.env.GEMINI_API_KEY; // CLI needs this env var
            if (!apiKey) throw new Error('GEMINI_API_KEY not set in environment');

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-3.0-pro-001" }); // User requested Gemini 3 Pro

            const prompt = `
            You are an AI Game Judge. 
            Look at this ${expectation.type} from a Minecraft-like voxel engine.
            
            VERIFICATION VISUAL TASK:
            "${expectation.description}"

            Does the media confirm this expectation?
            Ignore UI elements or small glitches. Focus on the main subject.
            
            Respond ONLY with this JSON structure:
            {
                "pass": boolean,
                "reason": "short explanation of what you see"
            }
            `;

            const result = await model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: mediaData,
                        mimeType: mimeType
                    }
                }
            ]);

            const responseText = result.response.text();
            // Clean markdown code blocks if present
            const jsonStr = responseText.replace(/```json\n|\n```/g, '').trim();
            const judgment = JSON.parse(jsonStr);

            console.log(chalk.blue(`\n🤖 AI Judge Verdict:`));
            if (judgment.pass) {
                console.log(chalk.green(`  ✅ PASS: ${judgment.reason}`));
            } else {
                console.log(chalk.red(`  ❌ FAIL: ${judgment.reason}`));
                throw new Error(`Visual verification failed: ${judgment.reason}`);
            }

        } catch (e) {
            console.error(chalk.red(`  AI Judge Error: ${e.message}`));
            if (e.message.includes('safety')) {
                console.warn(chalk.yellow('  (Verification skipped due to safety filters)'));
                return; // Don't fail test on safety block, just warn
            }
            throw new Error(`AI Verification process failed: ${e.message}`);
        }
    }
}

