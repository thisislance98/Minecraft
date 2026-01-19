/**
 * Test: Jump Ground Detection Fix
 *
 * Verifies that the player can reliably jump while walking on the ground.
 * Tests the fix for intermittent ground detection failures.
 */

import { startBrowser, stopBrowser, waitForGame } from '../src/browser.js';
import {
    getPlayerPhysics,
    monitorGroundState,
    testJumpWhileWalking,
    teleportPlayer
} from '../src/game-commands.js';
import chalk from 'chalk';

const TEST_URL = 'http://localhost:3000/?cli=true&secret=asdf123';

async function runTest() {
    console.log(chalk.blue('\n═══════════════════════════════════════════════════'));
    console.log(chalk.blue('Test: Jump Ground Detection Fix'));
    console.log(chalk.blue('═══════════════════════════════════════════════════\n'));

    let browser;
    let passed = true;

    try {
        // Start browser
        console.log(chalk.cyan('Starting browser...'));
        browser = await startBrowser({ headless: false, url: TEST_URL });

        // Wait for game to load
        console.log(chalk.cyan('Waiting for game to load...'));
        const gameReady = await waitForGame(browser, 30000);
        if (!gameReady) {
            throw new Error('Game did not load in time');
        }
        console.log(chalk.green('✓ Game loaded\n'));

        // Wait a bit for terrain to generate
        await new Promise(r => setTimeout(r, 3000));

        // Click to get pointer lock
        await browser.page.click('canvas');
        await new Promise(r => setTimeout(r, 500));

        // Test 1: Initial physics state
        console.log(chalk.yellow('Test 1: Checking initial player physics state...'));
        const initialState = await getPlayerPhysics(browser);
        console.log('  Position:', initialState.position);
        console.log('  Velocity:', initialState.velocity);
        console.log('  On Ground:', initialState.onGround);
        console.log('  Is Flying:', initialState.isFlying);

        // Test 2: Monitor ground state while walking
        console.log(chalk.yellow('\nTest 2: Monitoring ground state while walking (5 seconds)...'));

        // Start walking
        await browser.page.keyboard.down('KeyW');

        const groundMonitor = await monitorGroundState(browser, 5000, 50);

        // Stop walking
        await browser.page.keyboard.up('KeyW');

        console.log('  Total samples:', groundMonitor.totalSamples);
        console.log('  On ground:', groundMonitor.onGroundCount, `(${groundMonitor.onGroundPercent}%)`);
        console.log('  Off ground:', groundMonitor.offGroundCount);
        console.log('  State transitions:', groundMonitor.transitionCount);

        if (groundMonitor.transitions.length > 0) {
            console.log(chalk.dim('  Transitions:'));
            groundMonitor.transitions.slice(0, 5).forEach((t, i) => {
                console.log(chalk.dim(`    ${i + 1}. ${t.from ? 'ground' : 'air'} → ${t.to ? 'ground' : 'air'} (y: ${t.y.toFixed(2)}, velY: ${t.velY.toFixed(2)})`));
            });
        }

        // Success criteria: Should be on ground > 80% of the time when walking
        if (parseFloat(groundMonitor.onGroundPercent) < 80 && !initialState.isFlying) {
            console.log(chalk.red('  ✗ Ground detection unstable - expected >80% on ground while walking'));
            passed = false;
        } else {
            console.log(chalk.green('  ✓ Ground state is stable'));
        }

        // Test 3: Jump while walking test
        console.log(chalk.yellow('\nTest 3: Testing jump while walking (10 jump attempts)...'));

        // First make sure we're on flat ground
        const physics = await getPlayerPhysics(browser);
        // Teleport to a flat area near the current position
        await teleportPlayer(browser,
            Math.round(physics.position.x),
            physics.position.y + 2, // Slightly up to land safely
            Math.round(physics.position.z)
        );

        // Wait to land
        await new Promise(r => setTimeout(r, 1500));

        // Click to maintain pointer lock
        await browser.page.click('canvas');
        await new Promise(r => setTimeout(r, 300));

        const jumpResults = await testJumpWhileWalking(browser);

        console.log('  Total jump attempts:', jumpResults.totalAttempts);
        console.log('  Attempts while on ground:', jumpResults.attemptedWhileOnGround);
        console.log('  Successful jumps:', jumpResults.successfulJumps);
        console.log('  Failed jumps (on ground but didn\'t jump):', jumpResults.failedJumps);
        console.log('  Failure rate:', jumpResults.failureRate);

        // Show details of failures
        const failures = jumpResults.details.filter(d => d.wasOnGround && !d.jumped);
        if (failures.length > 0) {
            console.log(chalk.dim('  Failed attempts:'));
            failures.forEach((f, i) => {
                console.log(chalk.dim(`    ${i + 1}. Attempt ${f.attempt}: wasOnGround=${f.wasOnGround}, velY before=${f.velYBefore.toFixed(2)}, velY after=${f.velYAfter.toFixed(2)}`));
            });
        }

        // Success criteria: < 10% failure rate when on ground
        const failurePercent = parseFloat(jumpResults.failureRate);
        if (failurePercent > 10) {
            console.log(chalk.red(`  ✗ Jump failure rate too high: ${jumpResults.failureRate}`));
            passed = false;
        } else {
            console.log(chalk.green(`  ✓ Jump reliability acceptable: ${100 - failurePercent}% success rate`));
        }

        // Summary
        console.log(chalk.blue('\n═══════════════════════════════════════════════════'));
        if (passed) {
            console.log(chalk.green('✓ All tests passed - Jump ground detection is working correctly'));
        } else {
            console.log(chalk.red('✗ Some tests failed - Ground detection may still have issues'));
        }
        console.log(chalk.blue('═══════════════════════════════════════════════════\n'));

    } catch (error) {
        console.error(chalk.red('\n✗ Test error:'), error.message);
        console.error(error.stack);
        passed = false;
    } finally {
        if (browser) {
            console.log(chalk.cyan('\nClosing browser...'));
            await stopBrowser(browser);
        }
    }

    process.exit(passed ? 0 : 1);
}

runTest();
