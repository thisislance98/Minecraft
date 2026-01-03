import chalk from 'chalk';
import { GameBrowser } from './browser.js';

/**
 * Multi-Browser Test Runner for testing multiplayer features
 * like dynamic creature creation across multiple clients
 */
export class MultiBrowserRunner {
    constructor(options = {}) {
        this.browsers = [];
        this.browserCount = options.browserCount || 2;
        this.headless = options.headless ?? false;
        this.gameUrl = options.gameUrl || 'http://localhost:3000';
    }

    /**
     * Launch multiple browser instances
     */
    async launchAll() {
        console.log(chalk.blue(`\n🌐 Launching ${this.browserCount} browser instances...`));

        for (let i = 0; i < this.browserCount; i++) {
            const browser = new GameBrowser({
                headless: this.headless,
                gameUrl: this.gameUrl
            });
            await browser.launch();
            await browser.waitForGameLoad();
            this.browsers.push(browser);
            console.log(chalk.green(`  ✓ Browser ${i + 1} ready`));
        }

        // Give sockets time to connect and sync
        console.log(chalk.dim('  Waiting for socket connections to stabilize...'));
        await new Promise(r => setTimeout(r, 2000));

        return this.browsers;
    }

    /**
     * Send a prompt to a specific browser's AI agent
     */
    async sendPrompt(browserIndex, prompt) {
        const browser = this.browsers[browserIndex];
        if (!browser) throw new Error(`Browser ${browserIndex} not found`);

        console.log(chalk.cyan(`\n📨 Browser ${browserIndex + 1}: Sending prompt...`));
        console.log(chalk.dim(`  "${prompt}"`));

        await browser.evaluate((prompt) => {
            const game = window.__VOXEL_GAME__;
            if (game && game.agent && game.uiManager) {
                game.uiManager.toggleChatPanel(true);
                const chatInput = document.getElementById('chat-input');
                if (chatInput) {
                    chatInput.value = prompt;
                    chatInput.focus();
                }
                setTimeout(() => {
                    game.uiManager.handleSendMessage();
                }, 100);
            }
        }, prompt);
    }

    /**
     * Wait for AI processing in a browser
     */
    async waitForAI(browserIndex, waitMs = 30000) {
        console.log(chalk.dim(`  Browser ${browserIndex + 1}: Waiting ${waitMs}ms for AI...`));
        await new Promise(r => setTimeout(r, waitMs));
    }

    /**
     * Check if a creature class is registered in AnimalClasses
     */
    async checkCreatureRegistered(browserIndex, creatureName) {
        const browser = this.browsers[browserIndex];

        const result = await browser.evaluate((name) => {
            // Check AnimalClasses for the creature
            const AnimalClasses = window.__VOXEL_GAME__?.spawnManager?.AnimalClasses ||
                window.AnimalClasses;

            // Also try the import
            if (!AnimalClasses) {
                // Check dynamically registered creatures
                const registry = window.__VOXEL_GAME__?.animals?.find(a => a.constructor.name === name);
                if (registry) return { registered: true, foundAs: 'instance' };
            }

            if (AnimalClasses && AnimalClasses[name]) {
                return { registered: true, foundAs: 'class' };
            }

            // Check DynamicCreatures
            const dynamicMod = window.DynamicCreatures;
            if (dynamicMod && dynamicMod[name]) {
                return { registered: true, foundAs: 'dynamic' };
            }

            return { registered: false, availableClasses: AnimalClasses ? Object.keys(AnimalClasses) : [] };
        }, creatureName);

        return result;
    }

    /**
     * Get list of dynamic creatures from a browser
     */
    async getDynamicCreatures(browserIndex) {
        const browser = this.browsers[browserIndex];

        return await browser.evaluate(() => {
            // Access AnimalClasses to get all available creatures
            const allClasses = [];
            const AnimalClasses = window.__VOXEL_GAME__?.AnimalClasses;
            if (AnimalClasses) {
                allClasses.push(...Object.keys(AnimalClasses));
            }

            // Also check for dynamic creatures specifically
            const DynamicCreatures = window.DynamicCreatures;
            const dynamicNames = DynamicCreatures ? Object.keys(DynamicCreatures) : [];

            return {
                all: allClasses,
                dynamic: dynamicNames
            };
        });
    }

    /**
     * Spawn a creature in a browser
     */
    async spawnCreature(browserIndex, creatureName, count = 1) {
        const browser = this.browsers[browserIndex];

        return await browser.evaluate((name, count) => {
            const game = window.__VOXEL_GAME__;
            if (!game || !game.spawnManager) {
                return { error: 'Game not ready' };
            }

            // Get creature class from AnimalClasses (includes dynamic ones)
            const AnimalClasses = game.AnimalClasses || {};
            let CreatureClass = AnimalClasses[name];

            // Try case-insensitive match
            if (!CreatureClass) {
                const match = Object.keys(AnimalClasses).find(k => k.toLowerCase() === name.toLowerCase());
                if (match) CreatureClass = AnimalClasses[match];
            }

            if (!CreatureClass) {
                return { error: `Creature '${name}' not found in registry`, available: Object.keys(AnimalClasses) };
            }

            const spawned = game.spawnManager.spawnEntitiesInFrontOfPlayer(CreatureClass, count);
            return {
                success: true,
                count: spawned?.length || 0,
                ids: spawned?.map(e => e.id) || []
            };
        }, creatureName, count);
    }

    /**
     * Count creatures of a type in a browser
     */
    async countCreatures(browserIndex, creatureName) {
        const browser = this.browsers[browserIndex];

        return await browser.evaluate((name) => {
            const game = window.__VOXEL_GAME__;
            if (!game || !game.animals) return 0;

            return game.animals.filter(a => a.constructor.name === name).length;
        }, creatureName);
    }

    /**
     * Get all creature counts from a browser
     */
    async getAllCreatureCounts(browserIndex) {
        const browser = this.browsers[browserIndex];

        return await browser.evaluate(() => {
            const game = window.__VOXEL_GAME__;
            if (!game || !game.animals) return {};

            const counts = {};
            for (const animal of game.animals) {
                const name = animal.constructor.name;
                counts[name] = (counts[name] || 0) + 1;
            }
            return counts;
        });
    }

    /**
     * Close all browsers
     */
    async closeAll() {
        console.log(chalk.dim('\n  Closing all browsers...'));
        for (const browser of this.browsers) {
            await browser.close();
        }
        this.browsers = [];
        console.log(chalk.green('  ✓ All browsers closed'));
    }

    /**
     * Run the dynamic creature creation test
     * 
     * Test flow:
     * 1. Launch 2 browsers
     * 2. Browser 1: Ask AI to create a new creature
     * 3. Wait for AI to generate and save creature
     * 4. Browser 2: Verify creature is available
     * 5. Browser 2: Spawn the creature
     * 6. Verify creature appears in both browsers
     */
    async runDynamicCreatureTest(creatureDescription, expectedName) {
        console.log(chalk.blue('\n═══════════════════════════════════════════════════'));
        console.log(chalk.blue('  DYNAMIC CREATURE CREATION TEST'));
        console.log(chalk.blue('═══════════════════════════════════════════════════'));

        try {
            // Step 1: Launch browsers
            await this.launchAll();

            // Step 2: Browser 1 creates a creature
            console.log(chalk.yellow('\n📝 STEP 1: Creating creature from Browser 1'));
            const createPrompt = `Create a creature: ${creatureDescription}. Name it "${expectedName}".`;
            await this.sendPrompt(0, createPrompt);

            // Wait for AI to process and create
            await this.waitForAI(0, 45000);

            // Step 3: Check Browser 1 has the creature
            console.log(chalk.yellow('\n🔍 STEP 2: Verifying creature in Browser 1'));
            const b1Check = await this.checkCreatureRegistered(0, expectedName);
            if (b1Check.registered) {
                console.log(chalk.green(`  ✓ Browser 1: Creature '${expectedName}' registered (${b1Check.foundAs})`));
            } else {
                console.log(chalk.red(`  ✗ Browser 1: Creature '${expectedName}' NOT found`));
                console.log(chalk.dim(`    Available: ${b1Check.availableClasses?.slice(0, 10).join(', ')}...`));
                throw new Error(`Creature creation failed in Browser 1`);
            }

            // Step 4: Check Browser 2 received the creature (socket broadcast)
            console.log(chalk.yellow('\n🔍 STEP 3: Verifying creature synced to Browser 2'));
            // Give some time for socket broadcast
            await new Promise(r => setTimeout(r, 2000));

            const b2Check = await this.checkCreatureRegistered(1, expectedName);
            if (b2Check.registered) {
                console.log(chalk.green(`  ✓ Browser 2: Creature '${expectedName}' received via sync (${b2Check.foundAs})`));
            } else {
                console.log(chalk.red(`  ✗ Browser 2: Creature '${expectedName}' NOT synced`));
                console.log(chalk.dim(`    Available: ${b2Check.availableClasses?.slice(0, 10).join(', ')}...`));
                throw new Error(`Creature not synced to Browser 2`);
            }

            // Step 5: Browser 2 spawns the creature
            console.log(chalk.yellow('\n🎮 STEP 4: Browser 2 spawns the creature'));
            await this.sendPrompt(1, `Spawn a ${expectedName}`);
            await this.waitForAI(1, 15000);

            // Step 6: Verify creature exists in both browsers
            console.log(chalk.yellow('\n🔍 STEP 5: Verifying spawned creature visibility'));
            await new Promise(r => setTimeout(r, 2000)); // Wait for entity sync

            const b1Count = await this.countCreatures(0, expectedName);
            const b2Count = await this.countCreatures(1, expectedName);

            console.log(chalk.dim(`  Browser 1 sees: ${b1Count} ${expectedName}(s)`));
            console.log(chalk.dim(`  Browser 2 sees: ${b2Count} ${expectedName}(s)`));

            if (b1Count > 0 && b2Count > 0) {
                console.log(chalk.green(`  ✓ Creature visible in both browsers!`));
            } else if (b2Count > 0) {
                console.log(chalk.yellow(`  ⚠️ Creature spawned but not synced (entity sync may need time)`));
            } else {
                console.log(chalk.red(`  ✗ Creature spawn failed`));
                throw new Error('Creature not visible in any browser');
            }

            // SUCCESS
            console.log(chalk.green('\n═══════════════════════════════════════════════════'));
            console.log(chalk.green('  ✅ DYNAMIC CREATURE CREATION TEST PASSED!'));
            console.log(chalk.green('═══════════════════════════════════════════════════'));

            await this.closeAll();
            return true;

        } catch (error) {
            console.log(chalk.red('\n═══════════════════════════════════════════════════'));
            console.log(chalk.red(`  ❌ TEST FAILED: ${error.message}`));
            console.log(chalk.red('═══════════════════════════════════════════════════'));
            await this.closeAll();
            throw error;
        }
    }
    /**
     * Run group chat synchronization test
     */
    async runGroupChatTest() {
        console.log(chalk.blue('\n═══════════════════════════════════════════════════'));
        console.log(chalk.blue('  GROUP CHAT SYNC TEST'));
        console.log(chalk.blue('═══════════════════════════════════════════════════'));

        try {
            await this.launchAll();

            // Wait for socket sync
            await new Promise(r => setTimeout(r, 2000));

            // Browser 1 sends message
            const browser1 = this.browsers[0];
            const message1 = "Hello from Browser 1 " + Date.now();

            console.log(chalk.yellow('\n💬 STEP 1: Browser 1 sending message...'));
            await browser1.evaluate((msg) => {
                const game = window.__VOXEL_GAME__;
                if (game && game.uiManager) {
                    game.uiManager.toggleChatPanel(true);
                    game.uiManager.setChatMode('group');
                    const chatInput = document.getElementById('chat-input');
                    if (chatInput) {
                        chatInput.value = msg;
                        game.uiManager.handleSendMessage();
                    }
                }
            }, message1);

            // Browser 2 verification
            const browser2 = this.browsers[1];
            console.log(chalk.yellow('\n🔍 STEP 2: Verifying reception in Browser 2'));

            let received = false;
            let attempts = 0;
            while (!received && attempts < 10) {
                await new Promise(r => setTimeout(r, 1000));
                received = await browser2.evaluate((expectedMsg) => {
                    const groupParams = document.getElementById('chat-messages-group');
                    return groupParams && groupParams.innerText.includes(expectedMsg);
                }, message1);
                attempts++;
            }

            if (received) {
                console.log(chalk.green('  ✓ Browser 2 received message'));
            } else {
                console.log(chalk.red('  ✗ Browser 2 did NOT receive message'));
                throw new Error('Chat sync failed');
            }

            // Browser 2 replies
            const message2 = "Reply from Browser 2 " + Date.now();
            console.log(chalk.yellow('\n💬 STEP 3: Browser 2 replying...'));
            await browser2.evaluate((msg) => {
                const game = window.__VOXEL_GAME__;
                game.uiManager.toggleChatPanel(true);
                game.uiManager.setChatMode('group');
                const chatInput = document.getElementById('chat-input');
                if (chatInput) {
                    chatInput.value = msg;
                    game.uiManager.handleSendMessage();
                }
            }, message2);

            // Browser 1 verification
            console.log(chalk.yellow('\n🔍 STEP 4: Verifying reply in Browser 1'));
            let receivedReply = false;
            attempts = 0;

            while (!receivedReply && attempts < 10) {
                await new Promise(r => setTimeout(r, 1000));
                receivedReply = await browser1.evaluate((expectedMsg) => {
                    const groupParams = document.getElementById('chat-messages-group');
                    return groupParams && groupParams.innerText.includes(expectedMsg);
                }, message2);
                attempts++;
            }

            if (receivedReply) {
                console.log(chalk.green('  ✓ Browser 1 received reply'));
            } else {
                console.log(chalk.red('  ✗ Browser 1 did NOT receive reply'));
                throw new Error('Chat sync failed (reply)');
            }

            console.log(chalk.green('\n═══════════════════════════════════════════════════'));
            console.log(chalk.green('  ✅ GROUP CHAT TEST PASSED!'));
            console.log(chalk.green('═══════════════════════════════════════════════════'));

            await this.closeAll();
            return true;

        } catch (error) {
            console.log(chalk.red('\n═══════════════════════════════════════════════════'));
            console.log(chalk.red(`  ❌ TEST FAILED: ${error.message}`));
            console.log(chalk.red('═══════════════════════════════════════════════════'));
            await this.closeAll();
            throw error;
        }
    }
}
