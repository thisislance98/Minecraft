#!/usr/bin/env node
/**
 * verify_world_scoped_content.js
 *
 * Tests that creatures and items are properly scoped to individual worlds.
 *
 * Test Plan:
 * 1. Create two test worlds via the API
 * 2. Player 1 joins World A, creates a creature via AI
 * 3. Player 2 joins World B - should NOT see World A's creature
 * 4. Player 2 creates different creature in World B
 * 5. Verify each world has only its own creatures
 * 6. Clean up test worlds
 */

import chalk from 'chalk';
import { GameBrowser } from '../src/browser.js';
import * as GameCommands from '../src/game-commands.js';
import { AntigravityClient } from '../src/client.js';

const TEST_TIMEOUT = 120000; // 2 minutes total
const AI_TIMEOUT = 45000; // 45 seconds for AI responses

// Test world IDs (using timestamps to ensure uniqueness)
const TEST_WORLD_A = `test-world-a-${Date.now()}`;
const TEST_WORLD_B = `test-world-b-${Date.now()}`;

// Test results
const results = {
    worldACreation: false,
    worldBCreation: false,
    worldACreatureCreated: false,
    worldBIsolation: false,
    worldBCreatureCreated: false,
    worldAIsolation: false,
    cleanup: false
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a test world via the API
 */
async function createTestWorld(worldId, name, isPublic = false) {
    console.log(chalk.blue(`\n[Setup] Creating test world: ${worldId}`));

    // Use curl to create the world via REST API
    // Note: In CLI mode, we use the secret header for auth bypass
    try {
        const response = await fetch(`http://localhost:2567/api/worlds`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-antigravity-secret': 'asdf123',
                'x-antigravity-client': 'cli'
            },
            body: JSON.stringify({
                worldId,
                name,
                isPublic
            })
        });

        if (response.ok || response.status === 409) {
            // 409 = already exists, which is fine
            console.log(chalk.green(`  ✓ World ${worldId} ready`));
            return true;
        }

        const error = await response.text();
        console.log(chalk.yellow(`  ⚠ World creation response: ${response.status} - ${error}`));
        return response.status === 409; // Treat already-exists as success
    } catch (e) {
        console.log(chalk.red(`  ✗ Failed to create world: ${e.message}`));
        return false;
    }
}

/**
 * Delete a test world via the API
 */
async function deleteTestWorld(worldId) {
    console.log(chalk.dim(`[Cleanup] Deleting test world: ${worldId}`));
    try {
        const response = await fetch(`http://localhost:2567/api/worlds/${worldId}`, {
            method: 'DELETE',
            headers: {
                'x-antigravity-secret': 'asdf123',
                'x-antigravity-client': 'cli'
            }
        });
        return response.ok;
    } catch (e) {
        console.log(chalk.yellow(`  ⚠ Cleanup failed: ${e.message}`));
        return false;
    }
}

/**
 * Wait for a creature to appear in the browser's DynamicCreatures registry
 */
async function waitForCreature(browser, creatureName, timeoutMs = AI_TIMEOUT) {
    console.log(chalk.dim(`  Waiting for creature: ${creatureName}...`));
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const creatures = await GameCommands.getWorldCreatures(browser);
        if (creatures.creatures.includes(creatureName)) {
            console.log(chalk.green(`  ✓ Creature ${creatureName} found!`));
            return true;
        }
        await sleep(1000);
    }

    console.log(chalk.red(`  ✗ Timeout waiting for creature: ${creatureName}`));
    return false;
}

/**
 * Create a creature via AI with explicit worldId context
 */
async function createCreatureViaAI(browser, creatureName, worldId) {
    console.log(chalk.cyan(`\n[AI] Requesting creature creation: ${creatureName} in ${worldId}`));

    const client = new AntigravityClient();
    await client.connect();

    return new Promise((resolve, reject) => {
        let completed = false;
        const timeout = setTimeout(() => {
            if (!completed) {
                client.disconnect();
                reject(new Error('AI timeout'));
            }
        }, AI_TIMEOUT);

        client.on('tool_call', (msg) => {
            console.log(chalk.cyan(`  [AI Tool] ${msg.name || msg.tool || 'unknown'}`));
        });

        client.on('completion', async () => {
            completed = true;
            clearTimeout(timeout);
            client.disconnect();

            // Wait a moment for creature to register
            await sleep(2000);
            resolve(true);
        });

        // Send prompt with explicit worldId
        const prompt = `Create a simple creature called "${creatureName}" with default appearance. Just a basic creature for testing.`;
        client.sendPrompt(prompt, {
            position: { x: 0, y: 50, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            biome: 'Plains',
            worldId: worldId
        });
    });
}

/**
 * Main test execution
 */
async function runTest() {
    console.log(chalk.bold.blue('\n════════════════════════════════════════════'));
    console.log(chalk.bold.blue('  World-Scoped Content Test'));
    console.log(chalk.bold.blue('════════════════════════════════════════════\n'));

    let browserA = null;
    let browserB = null;

    try {
        // ============================================
        // Phase 1: Create test worlds
        // ============================================
        console.log(chalk.bold('\n📦 Phase 1: Creating test worlds'));

        results.worldACreation = await createTestWorld(TEST_WORLD_A, 'Test World A');
        results.worldBCreation = await createTestWorld(TEST_WORLD_B, 'Test World B');

        if (!results.worldACreation || !results.worldBCreation) {
            console.log(chalk.yellow('  ⚠ Using worlds without API creation (may already exist or be global)'));
        }

        // ============================================
        // Phase 2: Launch browsers for both worlds
        // ============================================
        console.log(chalk.bold('\n🌐 Phase 2: Launching browser sessions'));

        // Browser A - joins World A
        console.log(chalk.blue('\n[Browser A] Launching for World A...'));
        browserA = new GameBrowser({
            headless: false,
            gameUrl: `http://localhost:3000/world/${TEST_WORLD_A}`,
            quiet: false
        });
        await browserA.launch();
        await browserA.waitForGameLoad();

        // Wait for world join
        await sleep(3000);
        const worldAInfo = await GameCommands.getCurrentWorld(browserA);
        console.log(chalk.green(`  ✓ Browser A connected to: ${worldAInfo.worldId}`));

        // Get initial creatures in World A
        const initialCreaturesA = await GameCommands.getWorldCreatures(browserA);
        console.log(chalk.dim(`  Initial creatures in World A: ${initialCreaturesA.creatures.join(', ') || '(none)'}`));

        // Browser B - joins World B
        console.log(chalk.blue('\n[Browser B] Launching for World B...'));
        browserB = new GameBrowser({
            headless: false,
            gameUrl: `http://localhost:3000/world/${TEST_WORLD_B}`,
            quiet: false
        });
        await browserB.launch();
        await browserB.waitForGameLoad();

        await sleep(3000);
        const worldBInfo = await GameCommands.getCurrentWorld(browserB);
        console.log(chalk.green(`  ✓ Browser B connected to: ${worldBInfo.worldId}`));

        // Get initial creatures in World B
        const initialCreaturesB = await GameCommands.getWorldCreatures(browserB);
        console.log(chalk.dim(`  Initial creatures in World B: ${initialCreaturesB.creatures.join(', ') || '(none)'}`));

        // ============================================
        // Phase 3: Create creature in World A via AI
        // ============================================
        console.log(chalk.bold('\n🦊 Phase 3: Creating creature in World A'));

        const creatureNameA = `TestFox_${Date.now().toString(36)}`;

        try {
            await createCreatureViaAI(browserA, creatureNameA, TEST_WORLD_A);
            results.worldACreatureCreated = await waitForCreature(browserA, creatureNameA);
        } catch (e) {
            console.log(chalk.red(`  ✗ AI creature creation failed: ${e.message}`));
            results.worldACreatureCreated = false;
        }

        // ============================================
        // Phase 4: Verify World B doesn't see World A's creature
        // ============================================
        console.log(chalk.bold('\n🔒 Phase 4: Testing world isolation (B should NOT see A\'s creature)'));

        await sleep(2000); // Wait for any potential sync

        const creaturesInB = await GameCommands.getWorldCreatures(browserB);
        console.log(chalk.dim(`  Creatures visible in World B: ${creaturesInB.creatures.join(', ') || '(none)'}`));

        results.worldBIsolation = !creaturesInB.creatures.includes(creatureNameA);
        if (results.worldBIsolation) {
            console.log(chalk.green(`  ✓ World B correctly does NOT see creature '${creatureNameA}'`));
        } else {
            console.log(chalk.red(`  ✗ ISOLATION FAILURE: World B can see World A's creature!`));
        }

        // ============================================
        // Phase 5: Create creature in World B
        // ============================================
        console.log(chalk.bold('\n🐺 Phase 5: Creating creature in World B'));

        const creatureNameB = `TestWolf_${Date.now().toString(36)}`;

        try {
            await createCreatureViaAI(browserB, creatureNameB, TEST_WORLD_B);
            results.worldBCreatureCreated = await waitForCreature(browserB, creatureNameB);
        } catch (e) {
            console.log(chalk.red(`  ✗ AI creature creation failed: ${e.message}`));
            results.worldBCreatureCreated = false;
        }

        // ============================================
        // Phase 6: Verify World A doesn't see World B's creature
        // ============================================
        console.log(chalk.bold('\n🔒 Phase 6: Testing reverse isolation (A should NOT see B\'s creature)'));

        await sleep(2000);

        const creaturesInA = await GameCommands.getWorldCreatures(browserA);
        console.log(chalk.dim(`  Creatures visible in World A: ${creaturesInA.creatures.join(', ') || '(none)'}`));

        results.worldAIsolation = !creaturesInA.creatures.includes(creatureNameB);
        if (results.worldAIsolation) {
            console.log(chalk.green(`  ✓ World A correctly does NOT see creature '${creatureNameB}'`));
        } else {
            console.log(chalk.red(`  ✗ ISOLATION FAILURE: World A can see World B's creature!`));
        }

        // ============================================
        // Final Summary
        // ============================================
        console.log(chalk.bold('\n════════════════════════════════════════════'));
        console.log(chalk.bold('  Test Results Summary'));
        console.log(chalk.bold('════════════════════════════════════════════'));

        console.log(`  World A Creation:      ${results.worldACreation ? chalk.green('PASS') : chalk.yellow('SKIP')}`);
        console.log(`  World B Creation:      ${results.worldBCreation ? chalk.green('PASS') : chalk.yellow('SKIP')}`);
        console.log(`  Creature in World A:   ${results.worldACreatureCreated ? chalk.green('PASS') : chalk.red('FAIL')}`);
        console.log(`  World B Isolation:     ${results.worldBIsolation ? chalk.green('PASS') : chalk.red('FAIL')}`);
        console.log(`  Creature in World B:   ${results.worldBCreatureCreated ? chalk.green('PASS') : chalk.red('FAIL')}`);
        console.log(`  World A Isolation:     ${results.worldAIsolation ? chalk.green('PASS') : chalk.red('FAIL')}`);

        const allPassed = results.worldACreatureCreated && results.worldBIsolation &&
            results.worldBCreatureCreated && results.worldAIsolation;

        if (allPassed) {
            console.log(chalk.bold.green('\n✅ ALL TESTS PASSED!\n'));
        } else {
            console.log(chalk.bold.red('\n❌ SOME TESTS FAILED\n'));
        }

        return allPassed;

    } finally {
        // ============================================
        // Cleanup
        // ============================================
        console.log(chalk.dim('\n[Cleanup] Closing browsers...'));

        if (browserA) {
            await browserA.screenshot(`tests/world_a_final_${TEST_WORLD_A}.png`).catch(() => { });
            await browserA.close();
        }
        if (browserB) {
            await browserB.screenshot(`tests/world_b_final_${TEST_WORLD_B}.png`).catch(() => { });
            await browserB.close();
        }

        // Clean up test worlds
        await deleteTestWorld(TEST_WORLD_A);
        await deleteTestWorld(TEST_WORLD_B);
        results.cleanup = true;
    }
}

// Run with timeout
const testTimeout = setTimeout(() => {
    console.log(chalk.red('\n⏰ TEST TIMEOUT EXCEEDED'));
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
