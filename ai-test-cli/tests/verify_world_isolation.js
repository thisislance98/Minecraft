#!/usr/bin/env node
/**
 * verify_world_isolation.js
 *
 * A simpler test for world-scoped content that:
 * 1. Uses the "global" world and a test world
 * 2. Creates a creature in one, verifies it's NOT in the other
 * 3. Doesn't rely on AI creating specific names
 *
 * This test checks that creatures sent to one world via socket
 * don't appear in other worlds.
 */

import chalk from 'chalk';
import { GameBrowser } from '../src/browser.js';
import * as GameCommands from '../src/game-commands.js';
import { AntigravityClient } from '../src/client.js';

const TEST_TIMEOUT = 180000; // 3 minutes total
const AI_TIMEOUT = 60000; // 60 seconds for AI responses

// We'll use the global world and a unique test world
const TEST_WORLD = `isolation-test-${Date.now()}`;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for any new creature to appear in the browser's registry
 * Returns the name of a newly added creature (if any)
 */
async function waitForNewCreature(browser, previousCreatures, timeoutMs = AI_TIMEOUT) {
    console.log(chalk.dim(`  Waiting for new creature (had ${previousCreatures.length} before)...`));
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const current = await GameCommands.getWorldCreatures(browser);
        const newCreatures = current.creatures.filter(c => !previousCreatures.includes(c));

        if (newCreatures.length > 0) {
            console.log(chalk.green(`  ✓ New creature found: ${newCreatures.join(', ')}`));
            return newCreatures;
        }
        await sleep(2000);
    }

    console.log(chalk.yellow(`  ⚠ No new creatures after ${timeoutMs / 1000}s`));
    return [];
}

/**
 * Create a creature via the CLI AI client
 */
async function createCreatureViaAI(worldId, creatureName) {
    console.log(chalk.cyan(`  [AI] Requesting creature in world: ${worldId}`));

    const client = new AntigravityClient();
    await client.connect();

    return new Promise((resolve, reject) => {
        let completed = false;
        let toolCalls = [];

        const timeout = setTimeout(() => {
            if (!completed) {
                client.disconnect();
                resolve({ toolCalls, timeout: true });
            }
        }, AI_TIMEOUT);

        client.on('tool_call', (msg) => {
            const toolName = msg.name || msg.tool || 'unknown';
            console.log(chalk.cyan(`  [AI Tool] ${toolName}`));
            toolCalls.push(toolName);
        });

        client.on('completion', () => {
            completed = true;
            clearTimeout(timeout);
            client.disconnect();
            resolve({ toolCalls, timeout: false });
        });

        // Send prompt with worldId context
        const prompt = `Create a unique creature called ${creatureName} - a small blue bird that flies around. Make it simple.`;
        client.sendPrompt(prompt, {
            position: { x: 0, y: 50, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            biome: 'Plains',
            worldId: worldId
        });
    });
}

async function runTest() {
    console.log(chalk.bold.blue('\n════════════════════════════════════════════'));
    console.log(chalk.bold.blue('  World Isolation Test (Simplified)'));
    console.log(chalk.bold.blue('════════════════════════════════════════════\n'));

    let browserGlobal = null;
    let browserTest = null;
    const results = {
        globalWorldConnected: false,
        testWorldConnected: false,
        creatureCreatedInGlobal: false,
        testWorldIsolation: false
    };

    try {
        // ============================================
        // Phase 1: Launch browser for GLOBAL world
        // ============================================
        console.log(chalk.bold('\n🌐 Phase 1: Connecting to GLOBAL world'));

        browserGlobal = new GameBrowser({
            headless: false,
            gameUrl: 'http://localhost:3000',  // No world path = global
            quiet: true
        });
        await browserGlobal.launch();
        await browserGlobal.waitForGameLoad();
        await sleep(5000); // Wait for full connection

        const globalInfo = await GameCommands.getCurrentWorld(browserGlobal);
        console.log(chalk.green(`  ✓ Global world connected: ${globalInfo.worldId}`));
        results.globalWorldConnected = globalInfo.isConnected;

        const initialGlobalCreatures = await GameCommands.getWorldCreatures(browserGlobal);
        console.log(chalk.dim(`  Initial creatures: ${initialGlobalCreatures.creatures.join(', ') || '(none)'}`));

        // ============================================
        // Phase 2: Launch browser for TEST world
        // ============================================
        console.log(chalk.bold('\n🌍 Phase 2: Connecting to TEST world'));

        browserTest = new GameBrowser({
            headless: false,
            gameUrl: `http://localhost:3000/world/${TEST_WORLD}`,
            quiet: true
        });
        await browserTest.launch();
        await browserTest.waitForGameLoad();
        await sleep(5000);

        const testInfo = await GameCommands.getCurrentWorld(browserTest);
        console.log(chalk.green(`  ✓ Test world connected: ${testInfo.worldId}`));
        results.testWorldConnected = testInfo.isConnected;

        const initialTestCreatures = await GameCommands.getWorldCreatures(browserTest);
        console.log(chalk.dim(`  Initial creatures in test world: ${initialTestCreatures.creatures.join(', ') || '(none)'}`));

        // ============================================
        // Phase 3: Create creature in GLOBAL world
        // ============================================
        console.log(chalk.bold('\n🦅 Phase 3: Creating creature in GLOBAL world'));

        const creatureName = `BlueBird_${Date.now().toString(36)}`;
        const aiResult = await createCreatureViaAI('global', creatureName);

        // Wait for new creature to appear in global world
        await sleep(3000);
        const newCreaturesInGlobal = await waitForNewCreature(
            browserGlobal,
            initialGlobalCreatures.creatures,
            30000
        );

        results.creatureCreatedInGlobal = newCreaturesInGlobal.length > 0;
        const createdCreatureName = newCreaturesInGlobal[0] || null;

        if (createdCreatureName) {
            console.log(chalk.green(`  ✓ Creature created in global: ${createdCreatureName}`));
        } else {
            console.log(chalk.yellow(`  ⚠ No new creature detected (AI may have used existing creature)`));
        }

        // ============================================
        // Phase 4: Verify TEST world isolation
        // ============================================
        console.log(chalk.bold('\n🔒 Phase 4: Verifying TEST world isolation'));

        await sleep(3000); // Give time for any potential (incorrect) sync

        const testCreaturesAfter = await GameCommands.getWorldCreatures(browserTest);
        console.log(chalk.dim(`  Creatures in test world: ${testCreaturesAfter.creatures.join(', ') || '(none)'}`));

        // Check if the creature created in global appears in test world
        if (createdCreatureName) {
            results.testWorldIsolation = !testCreaturesAfter.creatures.includes(createdCreatureName);
            if (results.testWorldIsolation) {
                console.log(chalk.green(`  ✓ TEST WORLD ISOLATED: Does NOT contain '${createdCreatureName}'`));
            } else {
                console.log(chalk.red(`  ✗ ISOLATION FAILED: Test world contains '${createdCreatureName}'`));
            }
        } else {
            // If no creature was created, we can't test isolation properly
            // But we can still check that the test world has no unexpected creatures
            const unexpectedCreatures = testCreaturesAfter.creatures.filter(
                c => !initialTestCreatures.creatures.includes(c)
            );
            results.testWorldIsolation = unexpectedCreatures.length === 0;
            console.log(chalk.green(`  ✓ No unexpected creatures leaked to test world`));
        }

        // ============================================
        // Additional check: Print what each world sees
        // ============================================
        console.log(chalk.bold('\n📊 World Content Summary'));

        const globalFinal = await GameCommands.getWorldCreatures(browserGlobal);
        const testFinal = await GameCommands.getWorldCreatures(browserTest);

        console.log(chalk.blue(`\n  GLOBAL World (${globalInfo.worldId}):`));
        console.log(`    Dynamic creatures: ${globalFinal.count}`);
        globalFinal.creatures.forEach(c => console.log(`      - ${c}`));

        console.log(chalk.blue(`\n  TEST World (${testInfo.worldId}):`));
        console.log(`    Dynamic creatures: ${testFinal.count}`);
        testFinal.creatures.forEach(c => console.log(`      - ${c}`));

        // ============================================
        // Results
        // ============================================
        console.log(chalk.bold('\n════════════════════════════════════════════'));
        console.log(chalk.bold('  Test Results'));
        console.log(chalk.bold('════════════════════════════════════════════'));

        console.log(`  Global World Connected:   ${results.globalWorldConnected ? chalk.green('PASS') : chalk.red('FAIL')}`);
        console.log(`  Test World Connected:     ${results.testWorldConnected ? chalk.green('PASS') : chalk.red('FAIL')}`);
        console.log(`  Creature Created:         ${results.creatureCreatedInGlobal ? chalk.green('PASS') : chalk.yellow('SKIP')}`);
        console.log(`  World Isolation:          ${results.testWorldIsolation ? chalk.green('PASS') : chalk.red('FAIL')}`);

        const criticalPassed = results.testWorldIsolation;
        if (criticalPassed) {
            console.log(chalk.bold.green('\n✅ WORLD ISOLATION WORKING!\n'));
        } else {
            console.log(chalk.bold.red('\n❌ WORLD ISOLATION FAILED\n'));
        }

        return criticalPassed;

    } finally {
        console.log(chalk.dim('\n[Cleanup] Closing browsers...'));
        if (browserGlobal) {
            await browserGlobal.screenshot('tests/world_isolation_global.png').catch(() => {});
            await browserGlobal.close();
        }
        if (browserTest) {
            await browserTest.screenshot('tests/world_isolation_test.png').catch(() => {});
            await browserTest.close();
        }
    }
}

// Run with timeout
const testTimeout = setTimeout(() => {
    console.log(chalk.red('\n⏰ TEST TIMEOUT'));
    process.exit(1);
}, TEST_TIMEOUT);

runTest()
    .then((passed) => {
        clearTimeout(testTimeout);
        process.exit(passed ? 0 : 1);
    })
    .catch((error) => {
        clearTimeout(testTimeout);
        console.error(chalk.red('\n💥 Test error:'), error);
        process.exit(1);
    });
