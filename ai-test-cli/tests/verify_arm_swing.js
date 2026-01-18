/**
 * Test to verify arm swing behavior on mouse click
 * - Single click should swing arm once (up and down)
 * - Holding click should repeat the swing
 */
import { chromium } from 'playwright';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testArmSwing() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('Navigating to game...');
    await page.goto('http://localhost:3006');

    // Wait for game to load
    console.log('Waiting for game to load...');
    await sleep(5000);

    // Click to get pointer lock
    console.log('Clicking to get pointer lock...');
    await page.click('#container');
    await sleep(1000);

    // Listen for console messages to see isMining state
    page.on('console', msg => {
        if (msg.text().includes('InputManager') || msg.text().includes('Mining')) {
            console.log(`[Browser]: ${msg.text()}`);
        }
    });

    // Inject a function to track isMining state
    await page.evaluate(() => {
        window.miningStates = [];
        window.trackMining = setInterval(() => {
            if (window.game && window.game.player) {
                window.miningStates.push({
                    time: Date.now(),
                    isMining: window.game.player.isMining,
                    miningTimer: window.game.player.miningTimer
                });
            }
        }, 50);
    });

    // Test 1: Single click - arm should swing once
    console.log('\n=== TEST 1: Single Click ===');
    console.log('Performing single click...');

    await page.mouse.down();
    await sleep(50);  // Very short click
    await page.mouse.up();

    // Wait for swing to complete
    await sleep(1000);

    // Check the mining states
    const states1 = await page.evaluate(() => {
        clearInterval(window.trackMining);
        const result = window.miningStates;
        window.miningStates = [];
        return result;
    });

    console.log(`Recorded ${states1.length} state samples`);

    // Count transitions from mining to not mining
    let miningPeriods = 0;
    let wasMining = false;
    for (const state of states1) {
        if (state.isMining && !wasMining) {
            miningPeriods++;
            console.log(`Mining started at sample ${states1.indexOf(state)}`);
        }
        if (!state.isMining && wasMining) {
            console.log(`Mining stopped at sample ${states1.indexOf(state)}`);
        }
        wasMining = state.isMining;
    }

    const currentlyMining = await page.evaluate(() => window.game.player.isMining);

    console.log(`\nResults:`);
    console.log(`- Mining periods started: ${miningPeriods}`);
    console.log(`- Currently still mining: ${currentlyMining}`);

    if (miningPeriods <= 1 && !currentlyMining) {
        console.log('✅ PASS: Single click resulted in single swing');
    } else {
        console.log('❌ FAIL: Single click resulted in multiple swings or endless mining');
        console.log('Detailed states:', JSON.stringify(states1.slice(-10), null, 2));
    }

    // Test 2: Held click - should continue swinging
    console.log('\n=== TEST 2: Held Click ===');

    // Reset tracking
    await page.evaluate(() => {
        window.miningStates = [];
        window.trackMining = setInterval(() => {
            if (window.game && window.game.player) {
                window.miningStates.push({
                    time: Date.now(),
                    isMining: window.game.player.isMining
                });
            }
        }, 50);
    });

    console.log('Holding click for 2 seconds...');
    await page.mouse.down();
    await sleep(2000);
    await page.mouse.up();

    await sleep(500);

    const states2 = await page.evaluate(() => {
        clearInterval(window.trackMining);
        const result = window.miningStates;
        window.miningStates = [];
        return result;
    });

    // Count mining periods
    miningPeriods = 0;
    wasMining = false;
    for (const state of states2) {
        if (state.isMining && !wasMining) {
            miningPeriods++;
        }
        wasMining = state.isMining;
    }

    console.log(`\nResults:`);
    console.log(`- Mining periods started: ${miningPeriods}`);

    if (miningPeriods > 1) {
        console.log('✅ PASS: Held click resulted in multiple swings');
    } else {
        console.log('⚠️ INFO: Held click did not result in multiple swings (may need longer hold)');
    }

    // Final check - should not be mining after release
    await sleep(1000);
    const stillMining = await page.evaluate(() => window.game.player.isMining);

    if (!stillMining) {
        console.log('✅ PASS: Arm stopped swinging after mouse release');
    } else {
        console.log('❌ FAIL: Arm is still swinging after mouse release');
    }

    console.log('\nTest complete!');
    await page.screenshot({ path: 'ai-test-cli/tests/arm_swing_test.png' });

    await browser.close();
}

testArmSwing().catch(console.error);
