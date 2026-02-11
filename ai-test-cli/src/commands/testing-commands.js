/**
 * Testing Commands
 *
 * Extracted from game-commands.js for better organization
 */

import chalk from 'chalk';

/**
 * Execute a command in the browser and return the result
 */
async function executeInBrowser(browser, fn, ...args) {
    return await browser.evaluate(fn, ...args);
}

/**
 * Get game state summary
 */
export async function getGameState(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game) return { error: 'Game not ready' };

        return {
            player: game.player ? {
                position: { x: game.player.position.x, y: game.player.position.y, z: game.player.position.z },
                health: game.player.health,
                isFlying: game.player.isFlying
            } : null,
            entities: game.animals?.length || 0,
            time: game.timeOfDay,
            connected: game.socketManager?.isConnected?.() || false,
            dynamicCreatures: Object.keys(window.DynamicCreatures || {}).length,
            dynamicItems: Object.keys(window.DynamicItems || {}).length
        };
    });
}

/**
 * Print formatted game state
 */
export function printGameState(state) {
    console.log(chalk.blue('\n═══ Game State ═══'));
    if (state.player) {
        console.log(chalk.cyan('Player:'));
        console.log(`  Position: (${state.player.position.x.toFixed(1)}, ${state.player.position.y.toFixed(1)}, ${state.player.position.z.toFixed(1)})`);
        console.log(`  Health: ${state.player.health}`);
        console.log(`  Flying: ${state.player.isFlying}`);
    }
    console.log(chalk.cyan('World:'));
    console.log(`  Entities: ${state.entities}`);
    console.log(`  Time: ${state.time}`);
    console.log(`  Connected: ${state.connected}`);
    console.log(chalk.cyan('Dynamic Content:'));
    console.log(`  Creatures: ${state.dynamicCreatures}`);
    console.log(`  Items: ${state.dynamicItems}`);
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(browser, conditionFn, timeoutMs = 10000, pollMs = 500) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        const result = await executeInBrowser(browser, conditionFn);
        if (result) return { success: true, result };
        await new Promise(r => setTimeout(r, pollMs));
    }
    return { success: false, error: 'Timeout waiting for condition' };
}

/**
 * Show an in-game notification (for testing the notification system)
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} message - Message to display
 * @param {'error' | 'warning' | 'info' | 'success'} type - Notification type
 * @param {number} duration - Duration in ms (default: 3000)
 */
export async function showNotification(browser, message, type = 'info', duration = 3000) {
    return await executeInBrowser(browser, (msg, t, dur) => {
        const game = window.__VOXEL_GAME__;
        if (!game?.uiManager) return { error: 'Game not ready' };

        game.uiManager.showGameNotification(msg, t, dur);
        return { success: true, message: msg, type: t, duration: dur };
    }, message, type, duration);
}

/**
 * Get all currently visible notifications
 */
export async function getNotifications(browser) {
    return await executeInBrowser(browser, () => {
        const container = document.getElementById('game-notifications');
        if (!container) return { error: 'Container not found', notifications: [] };

        const notifications = Array.from(container.querySelectorAll('.game-notification')).map(n => ({
            type: n.classList.contains('error') ? 'error' :
                n.classList.contains('warning') ? 'warning' :
                    n.classList.contains('success') ? 'success' : 'info',
            message: n.querySelector('.notif-message')?.textContent || '',
            isFading: n.classList.contains('fade-out')
        }));

        return { count: notifications.length, notifications };
    });
}

/**
 * Get chat messages from the UI
 * @returns {Array<{type: string, text: string}>}
 */
export async function getChatMessages(browser) {
    return await executeInBrowser(browser, () => {
        const game = window.__VOXEL_GAME__;
        if (!game?.uiManager) return { error: 'Game not ready' };

        // Access chat messages directly from DOM
        const container = document.getElementById('chat-messages-ai');
        if (!container) return { messages: [] };

        const messages = Array.from(container.querySelectorAll('.message')).map(el => ({
            type: el.classList.contains('ai') ? 'ai' :
                el.classList.contains('user') ? 'user' :
                    el.classList.contains('system') ? 'system' : 'unknown',
            text: el.innerText
        }));

        return { messages };
    });
}

/**
 * Send a chat message to Merlin AI
 */
export async function sendChatMessage(browser, text) {
    return await executeInBrowser(browser, (msg) => {
        const game = window.__VOXEL_GAME__;
        const merlinClient = game?.uiManager?.merlinClient || window.merlinClient;

        if (!merlinClient?.send) {
            return { error: 'Merlin client not available' };
        }

        // Build context from game state
        const context = {
            position: game?.player?.position ? {
                x: game.player.position.x,
                y: game.player.position.y,
                z: game.player.position.z
            } : { x: 0, y: 50, z: 0 }
        };

        merlinClient.send({
            type: 'input',
            text: msg,
            context: context
        });

        console.log('[CLI] Sent prompt to Merlin:', msg);
        return { success: true, message: msg };
    }, text);
}

/**
 * Start video recording using Puppeteer's screencast
 * @param {Object} browser - Puppeteer browser instance
 * @param {string} outputPath - Path for output video file
 * @param {Object} options - Recording options
 */
export async function startRecording(browser, outputPath = 'recording.webm', options = {}) {
    const {
        width = 1280,
        height = 720,
        fps = 30
    } = options;

    // Store recorder on the browser object for later access
    try {
        const client = await browser.page.target().createCDPSession();

        // Start screencast
        await client.send('Page.startScreencast', {
            format: 'png',
            quality: 100,
            maxWidth: width,
            maxHeight: height,
            everyNthFrame: Math.round(60 / fps) // Adjust for target FPS
        });

        // Store frames
        browser._recordingFrames = [];
        browser._recordingClient = client;
        browser._recordingPath = outputPath;
        browser._recordingStartTime = Date.now();

        client.on('Page.screencastFrame', async (frame) => {
            browser._recordingFrames.push({
                data: frame.data,
                timestamp: Date.now()
            });
            // Acknowledge the frame
            await client.send('Page.screencastFrameAck', { sessionId: frame.sessionId });
        });

        console.log(`🎬 Recording started: ${outputPath}`);
        return {
            success: true,
            outputPath,
            width,
            height,
            fps,
            message: 'Recording started. Call stopRecording() when done.'
        };
    } catch (error) {
        return { error: `Failed to start recording: ${error.message}` };
    }
}

/**
 * Stop video recording and save to file
 * @param {Object} browser - Puppeteer browser instance
 */
export async function stopRecording(browser) {
    if (!browser._recordingClient) {
        return { error: 'No recording in progress' };
    }

    try {
        // Stop the screencast
        await browser._recordingClient.send('Page.stopScreencast');

        const duration = Date.now() - browser._recordingStartTime;
        const frameCount = browser._recordingFrames.length;
        const outputPath = browser._recordingPath;

        // Save frames as a GIF or individual PNGs (simpler approach)
        // For WebM, we'd need ffmpeg. Let's save as a sequence for now.
        const fs = await import('fs');
        const pathModule = await import('path');

        // Create output directory with absolute path
        const basePath = process.cwd();
        const dirName = outputPath.replace(/\.[^/.]+$/, '_frames');
        const absoluteDirPath = pathModule.default.isAbsolute(dirName) ? dirName : pathModule.default.join(basePath, dirName);

        console.log(`🎬 Saving frames to: ${absoluteDirPath}`);

        if (!fs.existsSync(absoluteDirPath)) {
            fs.mkdirSync(absoluteDirPath, { recursive: true });
        }

        // Save each frame
        for (let i = 0; i < browser._recordingFrames.length; i++) {
            const frame = browser._recordingFrames[i];
            const framePath = pathModule.default.join(absoluteDirPath, `frame_${String(i).padStart(5, '0')}.png`);
            fs.writeFileSync(framePath, Buffer.from(frame.data, 'base64'));
        }

        // Clean up browser state
        const savedFrameCount = browser._recordingFrames.length;
        browser._recordingFrames = [];
        browser._recordingClient = null;
        browser._recordingPath = null;
        browser._recordingStartTime = null;

        console.log(`🎬 Recording stopped: ${savedFrameCount} frames saved to ${absoluteDirPath}/`);
        return {
            success: true,
            frameCount: savedFrameCount,
            duration: duration,
            durationSeconds: (duration / 1000).toFixed(2),
            framesDirectory: absoluteDirPath,
            fps: (savedFrameCount / (duration / 1000)).toFixed(1),
            message: `Saved ${savedFrameCount} frames. Use ffmpeg to convert: ffmpeg -framerate 30 -i ${absoluteDirPath}/frame_%05d.png -c:v libx264 -pix_fmt yuv420p ${outputPath.replace('.webm', '.mp4')}`
        };
    } catch (error) {
        return { error: `Failed to stop recording: ${error.message}` };
    }
}

/**
 * Take a burst of screenshots over a duration
 * @param {Object} browser - Puppeteer browser instance
 * @param {number} durationMs - Duration in milliseconds
 * @param {number} intervalMs - Interval between shots
 * @param {string} prefix - Filename prefix
 */
export async function screenshotBurst(browser, durationMs = 3000, intervalMs = 100, prefix = 'burst') {
    const screenshots = [];
    const startTime = Date.now();
    let frameNum = 0;

    while (Date.now() - startTime < durationMs) {
        const path = `${prefix}_${String(frameNum).padStart(4, '0')}.png`;
        await browser.page.screenshot({ path });
        screenshots.push(path);
        frameNum++;
        await new Promise(r => setTimeout(r, intervalMs));
    }

    return {
        success: true,
        frameCount: screenshots.length,
        duration: durationMs,
        interval: intervalMs,
        files: screenshots
    };
}

/**
 * Test airplane controls - apply control inputs and measure response
 * @param {Object} browser - Puppeteer browser instance
 * @param {Object} controls - Control inputs: { throttle, pitch, roll, duration }
 */
export async function testFlightControls(browser, controls = {}) {
    const {
        throttle = false,     // Hold space for throttle up
        throttleDown = false, // Hold shift for throttle down
        pitchUp = false,      // Hold W for pitch up
        pitchDown = false,    // Hold S for pitch down
        rollLeft = false,     // Hold A for roll left
        rollRight = false,    // Hold D for roll right
        duration = 2000       // How long to hold controls
    } = controls;

    // Get initial state
    const initialState = await getMountInfo(browser);
    if (!initialState.mounted) {
        return { error: 'Not mounted on a vehicle', initialState };
    }

    // Press the control keys
    const keysHeld = [];
    if (throttle) { await browser.page.keyboard.down('Space'); keysHeld.push('Space'); }
    if (throttleDown) { await browser.page.keyboard.down('ShiftLeft'); keysHeld.push('ShiftLeft'); }
    if (pitchUp) { await browser.page.keyboard.down('KeyW'); keysHeld.push('KeyW'); }
    if (pitchDown) { await browser.page.keyboard.down('KeyS'); keysHeld.push('KeyS'); }
    if (rollLeft) { await browser.page.keyboard.down('KeyA'); keysHeld.push('KeyA'); }
    if (rollRight) { await browser.page.keyboard.down('KeyD'); keysHeld.push('KeyD'); }

    // Sample state during flight
    const samples = [];
    const startTime = Date.now();
    const sampleInterval = 200; // Sample every 200ms

    while (Date.now() - startTime < duration) {
        const state = await getMountInfo(browser);
        if (state.mounted) {
            samples.push({
                time: Date.now() - startTime,
                throttle: state.throttle,
                airspeed: state.airspeed,
                pitch: state.pitch,
                roll: state.roll,
                altitude: state.position?.y,
                isStalling: state.isStalling
            });
        }
        await new Promise(r => setTimeout(r, sampleInterval));
    }

    // Release keys
    for (const key of keysHeld) {
        await browser.page.keyboard.up(key);
    }

    // Get final state
    const finalState = await getMountInfo(browser);

    // Analyze results
    const analysis = {
        initialAltitude: initialState.position?.y,
        finalAltitude: finalState.position?.y,
        altitudeChange: finalState.position?.y - initialState.position?.y,
        initialAirspeed: initialState.airspeed,
        finalAirspeed: finalState.airspeed,
        airspeedChange: finalState.airspeed - initialState.airspeed,
        initialThrottle: initialState.throttle,
        finalThrottle: finalState.throttle,
        maxPitch: Math.max(...samples.map(s => s.pitch || 0)),
        minPitch: Math.min(...samples.map(s => s.pitch || 0)),
        maxRoll: Math.max(...samples.map(s => s.roll || 0)),
        minRoll: Math.min(...samples.map(s => s.roll || 0)),
        stalledAtAnyPoint: samples.some(s => s.isStalling)
    };

    return {
        success: true,
        keysHeld,
        duration,
        sampleCount: samples.length,
        initialState,
        finalState,
        analysis,
        samples: samples.slice(-10) // Last 10 samples
    };
}

/**
 * Run a full Starfighter flight test sequence
 * Tests: Boost (Space), Brake (Shift), Pitch (W/S), Turn with bank (A/D)
 */
export async function runAirplaneFlightTest(browser) {
    const results = {
        mounted: false,
        tests: []
    };

    console.log(chalk.blue('\n═══ Starfighter Flight Test ═══'));
    console.log(chalk.dim('Controls: W/S = pitch, A/D = turn, Space = boost, Shift = brake\n'));

    // Step 1: Find and mount a ship
    console.log(chalk.cyan('1. Finding and mounting ship...'));
    const mountResult = await findAndMountShip(browser);
    if (mountResult.error) {
        console.log(chalk.red(`   ✗ ${mountResult.error}`));
        return { error: mountResult.error, results };
    }
    console.log(chalk.green(`   ✓ Mounted ${mountResult.mountType}`));
    results.mounted = true;

    await new Promise(r => setTimeout(r, 500)); // Let it settle

    // Step 2: Test boost (Space) - should increase speed
    console.log(chalk.cyan('\n2. Testing boost (Space)...'));
    const boostTest = await testFlightControls(browser, { throttle: true, duration: 2500 });
    results.tests.push({ name: 'boost', result: boostTest });
    if (boostTest.analysis) {
        const speedIncreased = boostTest.analysis.finalAirspeed > boostTest.analysis.initialAirspeed;
        console.log(speedIncreased ? chalk.green('   ✓ Speed increased (boosting)') : chalk.red('   ✗ Speed did not increase'));
        console.log(`     Speed: ${boostTest.analysis.initialAirspeed?.toFixed(1)} → ${boostTest.analysis.finalAirspeed?.toFixed(1)}`);
    }

    await new Promise(r => setTimeout(r, 300));

    // Step 3: Test pitch up (W) - should climb
    console.log(chalk.cyan('\n3. Testing pitch up (W) - should climb...'));
    const pitchUpTest = await testFlightControls(browser, { pitchUp: true, throttle: true, duration: 2500 });
    results.tests.push({ name: 'pitch_up', result: pitchUpTest });
    if (pitchUpTest.analysis) {
        const pitchIncreased = pitchUpTest.analysis.maxPitch > 0.2;
        const altitudeIncreased = pitchUpTest.analysis.altitudeChange > 1;
        console.log(pitchIncreased ? chalk.green('   ✓ Pitch increased (nose up)') : chalk.red('   ✗ Pitch did not increase'));
        console.log(altitudeIncreased ? chalk.green('   ✓ Altitude increased (climbing)') : chalk.yellow('   ~ Altitude change small'));
        console.log(`     Max pitch: ${(pitchUpTest.analysis.maxPitch * 180 / Math.PI).toFixed(1)}°`);
        console.log(`     Altitude change: ${pitchUpTest.analysis.altitudeChange?.toFixed(1)} blocks`);
    }

    await new Promise(r => setTimeout(r, 300));

    // Step 4: Test pitch down (S) - should descend
    console.log(chalk.cyan('\n4. Testing pitch down (S) - should descend...'));
    const pitchDownTest = await testFlightControls(browser, { pitchDown: true, duration: 2000 });
    results.tests.push({ name: 'pitch_down', result: pitchDownTest });
    if (pitchDownTest.analysis) {
        const pitchDecreased = pitchDownTest.analysis.minPitch < -0.2;
        console.log(pitchDecreased ? chalk.green('   ✓ Pitch decreased (nose down)') : chalk.red('   ✗ Pitch did not decrease'));
        console.log(`     Min pitch: ${(pitchDownTest.analysis.minPitch * 180 / Math.PI).toFixed(1)}°`);
        console.log(`     Altitude change: ${pitchDownTest.analysis.altitudeChange?.toFixed(1)} blocks`);
    }

    await new Promise(r => setTimeout(r, 300));

    // Step 5: Test turn left (A) - should bank and turn
    console.log(chalk.cyan('\n5. Testing turn left (A)...'));
    const turnLeftTest = await testFlightControls(browser, { rollLeft: true, throttle: true, duration: 2000 });
    results.tests.push({ name: 'turn_left', result: turnLeftTest });
    if (turnLeftTest.analysis) {
        const banked = turnLeftTest.analysis.minRoll < -0.1;
        console.log(banked ? chalk.green('   ✓ Ship banked left') : chalk.yellow('   ~ Banking not detected'));
        console.log(`     Roll range: ${(turnLeftTest.analysis.minRoll * 180 / Math.PI).toFixed(1)}° to ${(turnLeftTest.analysis.maxRoll * 180 / Math.PI).toFixed(1)}°`);
    }

    await new Promise(r => setTimeout(r, 300));

    // Step 6: Test turn right (D) - should bank and turn
    console.log(chalk.cyan('\n6. Testing turn right (D)...'));
    const turnRightTest = await testFlightControls(browser, { rollRight: true, throttle: true, duration: 2000 });
    results.tests.push({ name: 'turn_right', result: turnRightTest });
    if (turnRightTest.analysis) {
        const banked = turnRightTest.analysis.maxRoll > 0.1;
        console.log(banked ? chalk.green('   ✓ Ship banked right') : chalk.yellow('   ~ Banking not detected'));
        console.log(`     Roll range: ${(turnRightTest.analysis.minRoll * 180 / Math.PI).toFixed(1)}° to ${(turnRightTest.analysis.maxRoll * 180 / Math.PI).toFixed(1)}°`);
    }

    await new Promise(r => setTimeout(r, 300));

    // Step 7: Test brake (Shift) - should decrease speed
    console.log(chalk.cyan('\n7. Testing brake (Shift)...'));
    // First boost to get some speed
    await testFlightControls(browser, { throttle: true, duration: 1500 });
    const brakeTest = await testFlightControls(browser, { throttleDown: true, duration: 2000 });
    results.tests.push({ name: 'brake', result: brakeTest });
    if (brakeTest.analysis) {
        const speedDecreased = brakeTest.analysis.finalAirspeed < brakeTest.analysis.initialAirspeed;
        console.log(speedDecreased ? chalk.green('   ✓ Speed decreased (braking)') : chalk.red('   ✗ Speed did not decrease'));
        console.log(`     Speed: ${brakeTest.analysis.initialAirspeed?.toFixed(1)} → ${brakeTest.analysis.finalAirspeed?.toFixed(1)}`);
    }

    // Summary
    console.log(chalk.blue('\n═══ Test Summary ═══'));
    const passedTests = results.tests.filter(t => {
        const a = t.result?.analysis;
        if (!a) return false;
        switch (t.name) {
            case 'boost': return a.finalAirspeed > a.initialAirspeed;
            case 'pitch_up': return a.maxPitch > 0.2 || a.altitudeChange > 1;
            case 'pitch_down': return a.minPitch < -0.2;
            case 'turn_left': return a.minRoll < -0.05; // Visual bank
            case 'turn_right': return a.maxRoll > 0.05; // Visual bank
            case 'brake': return a.finalAirspeed < a.initialAirspeed;
            default: return true;
        }
    }).length;

    console.log(`Passed: ${passedTests}/${results.tests.length} tests`);

    // Dismount
    await dismount(browser);

    return results;
}

/**
 * Simulate player walking and jumping for testing
 */
export async function testJumpWhileWalking(browser) {
    // Start walking forward
    await browser.page.keyboard.down('KeyW');

    const results = [];

    // Try to jump multiple times while walking
    for (let i = 0; i < 10; i++) {
        // Check onGround before jump
        const beforeJump = await executeInBrowser(browser, () => {
            const game = window.__VOXEL_GAME__;
            return {
                onGround: game?.player?.onGround,
                y: game?.player?.position?.y,
                velY: game?.player?.velocity?.y
            };
        });

        // Press space to jump
        await browser.page.keyboard.press('Space');

        // Wait a frame
        await new Promise(r => setTimeout(r, 16));

        // Check onGround after jump attempt
        const afterJump = await executeInBrowser(browser, () => {
            const game = window.__VOXEL_GAME__;
            return {
                onGround: game?.player?.onGround,
                y: game?.player?.position?.y,
                velY: game?.player?.velocity?.y
            };
        });

        const jumped = afterJump.velY > 0;
        results.push({
            attempt: i + 1,
            wasOnGround: beforeJump.onGround,
            jumped,
            velYBefore: beforeJump.velY,
            velYAfter: afterJump.velY
        });

        // Wait for landing
        await new Promise(r => setTimeout(r, 800));
    }

    // Stop walking
    await browser.page.keyboard.up('KeyW');

    // Analyze results
    const attemptedOnGround = results.filter(r => r.wasOnGround);
    const successfulJumps = results.filter(r => r.jumped);
    const failedJumps = attemptedOnGround.filter(r => !r.jumped);

    return {
        totalAttempts: results.length,
        attemptedWhileOnGround: attemptedOnGround.length,
        successfulJumps: successfulJumps.length,
        failedJumps: failedJumps.length,
        failureRate: failedJumps.length > 0 ?
            (failedJumps.length / attemptedOnGround.length * 100).toFixed(1) + '%' : '0%',
        details: results
    };
}
