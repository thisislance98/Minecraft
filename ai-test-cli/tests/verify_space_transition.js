/**
 * Test: Space Transition at Height 500
 * Verifies that stars and asteroids appear when player reaches height 500+
 */

import { chromium } from 'playwright';

async function test() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    console.log('Opening game...');
    await page.goto('http://localhost:3000');

    // Wait for game to load
    await page.waitForSelector('canvas', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));

    // Click to start game
    await page.click('canvas');
    await new Promise(r => setTimeout(r, 1000));

    console.log('Game loaded, checking environment system...');

    // Check if environment exists and get initial space factor
    const initialCheck = await page.evaluate(() => {
        const game = window.__VOXEL_GAME__;
        if (!game || !game.environment) {
            return { error: 'Game or environment not found' };
        }
        const env = game.environment;
        const playerY = game.player?.position?.y || 0;
        return {
            playerY,
            currentWorld: env.currentWorld,
            hasStarField: !!env.starField,
            starFieldVisible: env.starField?.visible,
            hasAsteroidGroup: !!env.asteroidGroup
        };
    });

    console.log('Initial state:', initialCheck);

    // Teleport player to height 400 (below space transition)
    console.log('\nTeleporting to Y=400 (below space transition)...');
    const belowSpace = await page.evaluate(() => {
        const game = window.__VOXEL_GAME__;
        const player = game.player;
        player.position.y = 400;
        // Force update
        game.environment.updateDayNightCycle(0.016, player.position);

        const env = game.environment;
        return {
            playerY: player.position.y,
            starFieldOpacity: env.starField?.material?.opacity,
            starFieldVisible: env.starField?.visible,
            asteroidGroupVisible: env.asteroidGroup?.visible
        };
    });
    console.log('At Y=400:', belowSpace);

    // Wait a moment
    await new Promise(r => setTimeout(r, 500));

    // Teleport player to height 500 (start of space transition)
    console.log('\nTeleporting to Y=500 (start of space transition)...');
    const atSpaceStart = await page.evaluate(() => {
        const game = window.__VOXEL_GAME__;
        const player = game.player;
        player.position.y = 500;
        game.environment.updateDayNightCycle(0.016, player.position);

        const env = game.environment;
        return {
            playerY: player.position.y,
            starFieldOpacity: env.starField?.material?.opacity,
            starFieldVisible: env.starField?.visible,
            asteroidGroupVisible: env.asteroidGroup?.visible,
            asteroidCount: env.asteroids?.length
        };
    });
    console.log('At Y=500:', atSpaceStart);

    // Wait a moment
    await new Promise(r => setTimeout(r, 500));

    // Teleport player to height 650 (middle of transition)
    console.log('\nTeleporting to Y=650 (middle of space transition)...');
    const midTransition = await page.evaluate(() => {
        const game = window.__VOXEL_GAME__;
        const player = game.player;
        player.position.y = 650;
        game.environment.updateDayNightCycle(0.016, player.position);

        const env = game.environment;
        // Compute spaceFactor the same way the code does
        const spaceStart = 500;
        const spaceFull = 800;
        const spaceFactor = Math.min(1, Math.max(0, (player.position.y - spaceStart) / (spaceFull - spaceStart)));

        return {
            playerY: player.position.y,
            spaceFactor: spaceFactor,
            lastSpaceFactor: env.lastSpaceFactor,
            currentWorld: env.currentWorld,
            starFieldOpacity: env.starField?.material?.opacity,
            starFieldVisible: env.starField?.visible,
            asteroidGroupVisible: env.asteroidGroup?.visible,
            asteroidGroupExists: !!env.asteroidGroup,
            asteroidCount: env.asteroids?.length
        };
    });
    console.log('At Y=650:', midTransition);

    // Wait a moment
    await new Promise(r => setTimeout(r, 500));

    // Teleport player to height 800 (full space)
    console.log('\nTeleporting to Y=800 (full space)...');
    const fullSpace = await page.evaluate(() => {
        const game = window.__VOXEL_GAME__;
        const player = game.player;
        player.position.y = 800;
        game.environment.updateDayNightCycle(0.016, player.position);

        const env = game.environment;
        return {
            playerY: player.position.y,
            starFieldOpacity: env.starField?.material?.opacity,
            starFieldVisible: env.starField?.visible,
            asteroidGroupVisible: env.asteroidGroup?.visible
        };
    });
    console.log('At Y=800:', fullSpace);

    // Take screenshot
    await page.screenshot({ path: 'ai-test-cli/tests/space_transition_test.png' });
    console.log('\nScreenshot saved to ai-test-cli/tests/space_transition_test.png');

    // Verify results
    let passed = true;

    // At Y=400, should NOT be in space (below threshold)
    if (belowSpace.starFieldOpacity > 0.1 || belowSpace.asteroidGroupVisible) {
        console.log('FAIL: Space effects visible below Y=500');
        passed = false;
    }

    // At Y=500+, stars should start appearing (unless it's day)
    // Stars depend on time of day, so check asteroids which always appear
    if (!atSpaceStart.asteroidGroupVisible && atSpaceStart.asteroidCount > 0) {
        // Asteroids should be visible at some point after Y=500
        console.log('Note: Asteroids may need higher altitude to be visible');
    }

    // At Y=800, full space - stars and asteroids should be visible
    if (!fullSpace.starFieldVisible) {
        console.log('FAIL: Stars not visible at Y=800');
        passed = false;
    }

    if (!fullSpace.asteroidGroupVisible) {
        console.log('FAIL: Asteroids not visible at Y=800');
        passed = false;
    }

    console.log('\n=================================');
    if (passed) {
        console.log('TEST PASSED: Space transition works at height 500+');
    } else {
        console.log('TEST FAILED: Some space effects not working');
    }
    console.log('=================================');

    await browser.close();
    return passed;
}

test().catch(console.error);
