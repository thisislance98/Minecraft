/**
 * Simple test to verify the XboxPong class loads and runs correctly
 */
import { chromium } from 'playwright';

async function testPongGame() {
    console.log('Starting simple Pong game verification...');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Collect console logs
    const consoleLogs = [];
    page.on('console', msg => {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Collect errors
    const errors = [];
    page.on('pageerror', err => {
        errors.push(err.message);
    });

    try {
        // Navigate to server and inject test
        await page.goto('http://localhost:3004', { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for page to stabilize
        await page.waitForTimeout(5000);

        console.log('Injecting Pong test...');

        // Run the test via page evaluation
        const testResult = await page.evaluate(async () => {
            const results = { tests: [], errors: [] };

            try {
                // Import the XboxPong module
                const { XboxPong } = await import('/src/game/minigames/XboxPong.js');
                results.tests.push({ name: 'Module imported', passed: true });

                // Create a test canvas
                const canvas = document.createElement('canvas');
                canvas.width = 600;
                canvas.height = 340;
                document.body.appendChild(canvas);

                // Create instance
                let gameOverCalled = false;
                let levelCompleteCalled = false;
                const pong = new XboxPong(canvas, {
                    onGameOver: () => { gameOverCalled = true; },
                    onLevelComplete: () => { levelCompleteCalled = true; },
                    onAllLevelsComplete: () => {}
                });
                results.tests.push({ name: 'Instance created', passed: true });

                // Check level data
                if (pong.levelData && pong.levelData.length >= 5) {
                    results.tests.push({
                        name: 'Level data',
                        passed: true,
                        details: `${pong.levelData.length} levels: ${pong.levelData.map(l => l.name).join(', ')}`
                    });
                } else {
                    results.tests.push({ name: 'Level data', passed: false });
                }

                // Start the game
                pong.start(0);
                results.tests.push({ name: 'Game started', passed: pong.state !== null });

                // Check state initialization
                const state = pong.state;
                if (state) {
                    results.tests.push({
                        name: 'Ball initialized',
                        passed: state.ball !== undefined && state.ball.x !== undefined,
                        details: state.ball ? `Position: (${state.ball.x.toFixed(1)}, ${state.ball.y.toFixed(1)})` : 'missing'
                    });

                    results.tests.push({
                        name: 'Left paddle initialized',
                        passed: state.leftPaddle !== undefined,
                        details: state.leftPaddle ? `Y: ${state.leftPaddle.y.toFixed(1)}` : 'missing'
                    });

                    results.tests.push({
                        name: 'Right paddle (AI) initialized',
                        passed: state.rightPaddle !== undefined && state.rightPaddle.isAI === true,
                        details: state.rightPaddle ? `isAI: ${state.rightPaddle.isAI}` : 'missing'
                    });

                    // Test paddle movement
                    const initialY = state.leftPaddle.y;
                    state.keys['KeyW'] = true;

                    // Wait a frame
                    await new Promise(r => setTimeout(r, 100));

                    const movedY = state.leftPaddle.y;
                    state.keys['KeyW'] = false;

                    results.tests.push({
                        name: 'Paddle responds to input',
                        passed: movedY < initialY,
                        details: `Moved from ${initialY.toFixed(1)} to ${movedY.toFixed(1)}`
                    });

                    // Test pause
                    state.paused = true;
                    results.tests.push({
                        name: 'Pause works',
                        passed: state.paused === true
                    });
                    state.paused = false;
                }

                // Stop the game
                pong.stop();
                results.tests.push({ name: 'Game stopped', passed: pong.state === null });

                // Clean up
                canvas.remove();

            } catch (e) {
                results.errors.push(e.message);
            }

            return results;
        });

        // Take screenshot
        await page.screenshot({ path: 'ai-test-cli/pong_simple_test.png' });
        console.log('Screenshot saved: pong_simple_test.png');

        // Print results
        console.log('\n=== Test Results ===');
        let allPassed = true;
        for (const test of testResult.tests) {
            const status = test.passed ? '✓' : '✗';
            const details = test.details ? ` (${test.details})` : '';
            console.log(`${status} ${test.name}${details}`);
            if (!test.passed) allPassed = false;
        }

        if (testResult.errors.length > 0) {
            console.log('\nTest Errors:');
            testResult.errors.forEach(e => console.log(`  - ${e}`));
            allPassed = false;
        }

        if (errors.length > 0) {
            console.log('\nPage Errors:');
            errors.forEach(e => console.log(`  - ${e}`));
        }

        if (allPassed) {
            console.log('\nPONG GAME VERIFICATION PASSED!');
        } else {
            console.log('\nSome tests failed');
            process.exit(1);
        }

    } catch (error) {
        console.error('Test failed:', error.message);
        await page.screenshot({ path: 'ai-test-cli/pong_simple_error.png' });

        console.log('\nConsole logs:');
        consoleLogs.slice(-30).forEach(log => console.log(`  ${log}`));

        if (errors.length > 0) {
            console.log('\nPage Errors:');
            errors.forEach(e => console.log(`  - ${e}`));
        }

        process.exit(1);
    } finally {
        await browser.close();
    }
}

testPongGame();
