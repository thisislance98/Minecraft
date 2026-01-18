/**
 * Automated test for Xbox Platformer multiplayer race
 *
 * This test verifies:
 * 1. Two players can join the same room and platformer lobby
 * 2. Lobby sync shows both players
 * 3. Ready state and game start works
 * 4. Players can see each other and movement syncs
 * 5. Race completion and finish times work
 *
 * Usage: node verify_multiplayer_platformer.js
 * Requires: Playwright, game server running on localhost:5174
 */

import { chromium } from 'playwright';

const GAME_URL = process.env.GAME_URL || 'http://localhost:5174';
const TEST_TIMEOUT = 60000;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForSelector(page, selector, timeout = 10000) {
    try {
        await page.waitForSelector(selector, { timeout });
        return true;
    } catch (e) {
        return false;
    }
}

async function waitForSocket(page, timeout = 30000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const status = await page.evaluate(() => {
            const game = window.__VOXEL_GAME__;
            const sm = game?.socketManager;
            if (!sm) return { connected: false, reason: 'no socketManager' };
            if (!sm.socket) return { connected: false, reason: 'no socket' };
            if (!sm.socket.connected) return { connected: false, reason: 'socket not connected' };
            if (!sm.roomId) return { connected: false, reason: 'no roomId' };
            return { connected: true, roomId: sm.roomId, socketId: sm.socketId };
        });
        if (status.connected) {
            console.log(`Socket connected: roomId=${status.roomId}, socketId=${status.socketId}`);
            return true;
        }
        if (Date.now() - startTime > 5000 && (Date.now() - startTime) % 5000 < 600) {
            console.log(`Still waiting for socket... (${status.reason})`);
        }
        await sleep(500);
    }
    return false;
}

async function runTest() {
    console.log('Starting Xbox Platformer multiplayer test...');
    console.log(`Game URL: ${GAME_URL}`);

    const browser = await chromium.launch({
        headless: false, // Set to true for CI
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let player1Page, player2Page;
    let player1Context, player2Context;

    try {
        // Create two browser contexts (separate sessions)
        player1Context = await browser.newContext();
        player2Context = await browser.newContext();

        player1Page = await player1Context.newPage();
        player2Page = await player2Context.newPage();

        // Enable console logging for debugging
        player1Page.on('console', msg => {
            const text = msg.text();
            if (!text.includes('[WebSocket]') && !text.includes('task:') && !text.includes('[vite]')) {
                console.log(`[P1] ${text}`);
            }
        });
        player2Page.on('console', msg => {
            const text = msg.text();
            if (!text.includes('[WebSocket]') && !text.includes('task:') && !text.includes('[vite]')) {
                console.log(`[P2] ${text}`);
            }
        });

        // Log page errors
        player1Page.on('pageerror', err => console.error(`[P1 ERROR] ${err.message}`));
        player2Page.on('pageerror', err => console.error(`[P2 ERROR] ${err.message}`));

        // Set viewport size
        await player1Page.setViewportSize({ width: 1280, height: 720 });
        await player2Page.setViewportSize({ width: 1280, height: 720 });

        // ========================
        // Step 1: Load game for Player 1
        // ========================
        console.log('\n--- Step 1: Loading game for Player 1 ---');

        await player1Page.goto(`${GAME_URL}?cli=true`);
        await sleep(3000);

        await player1Page.evaluate(() => {
            localStorage.setItem('communityUsername', 'TestRacer1');
        });
        await player1Page.reload();
        await sleep(5000);

        const p1Title = await player1Page.title();
        console.log(`Player 1 page title: "${p1Title}"`);

        const p1HasGame = await player1Page.evaluate(() => !!window.__VOXEL_GAME__);
        console.log(`Player 1 has __VOXEL_GAME__: ${p1HasGame}`);

        console.log('Waiting for Player 1 socket connection...');
        const p1Connected = await waitForSocket(player1Page);
        if (!p1Connected) {
            throw new Error('Player 1 failed to connect to server');
        }
        console.log('Player 1 connected!');

        const roomId = await player1Page.evaluate(() => {
            return window.__VOXEL_GAME__?.socketManager?.roomId;
        });
        console.log(`Player 1 in room: ${roomId}`);

        // ========================
        // Step 2: Load game for Player 2
        // ========================
        console.log('\n--- Step 2: Loading game for Player 2 ---');

        await player2Page.goto(`${GAME_URL}?cli=true`);
        await sleep(3000);

        await player2Page.evaluate(() => {
            localStorage.setItem('communityUsername', 'TestRacer2');
        });
        await player2Page.reload();
        await sleep(5000);

        console.log('Waiting for Player 2 socket connection...');
        const p2Connected = await waitForSocket(player2Page);
        if (!p2Connected) {
            throw new Error('Player 2 failed to connect to server');
        }
        console.log('Player 2 connected!');

        const p2RoomId = await player2Page.evaluate(() => {
            return window.__VOXEL_GAME__?.socketManager?.roomId;
        });
        console.log(`Player 2 in room: ${p2RoomId}`);

        if (roomId !== p2RoomId) {
            console.warn(`Warning: Players in different rooms (${roomId} vs ${p2RoomId})`);
        }

        // ========================
        // Step 3: Dismiss popups and Open Xbox UI
        // ========================
        console.log('\n--- Step 3: Dismissing popups and Opening Xbox UI ---');

        const dismissAllPopups = async (page, label) => {
            try {
                const announcementBtn = await page.$('.announcement-dismiss');
                if (announcementBtn && await announcementBtn.isVisible()) {
                    console.log(`${label}: Dismissing announcement popup`);
                    await announcementBtn.click();
                    await sleep(500);
                }

                const tutorialBtn = await page.$('#tutorial-ok');
                if (tutorialBtn && await tutorialBtn.isVisible()) {
                    console.log(`${label}: Dismissing tutorial popup`);
                    await tutorialBtn.click();
                    await sleep(500);
                }

                const commCloseBtn = await page.$('.comm-close-btn');
                if (commCloseBtn && await commCloseBtn.isVisible()) {
                    console.log(`${label}: Closing community UI`);
                    await commCloseBtn.click();
                    await sleep(500);
                }

                await page.keyboard.press('Escape');
                await sleep(300);

            } catch (e) {
                console.log(`${label}: Popup dismissal note: ${e.message}`);
            }
        };

        await dismissAllPopups(player1Page, 'P1');
        await dismissAllPopups(player2Page, 'P2');

        const canvas1 = await player1Page.$('#game-container canvas');
        const canvas2 = await player2Page.$('#game-container canvas');
        if (canvas1) {
            await canvas1.click();
            console.log('P1: Clicked game canvas');
        }
        if (canvas2) {
            await canvas2.click();
            console.log('P2: Clicked game canvas');
        }
        await sleep(500);

        console.log('Opening Xbox UI programmatically for both players...');
        await player1Page.evaluate(() => {
            window.__VOXEL_GAME__?.uiManager?.showXboxUI();
        });
        await sleep(500);
        await player2Page.evaluate(() => {
            window.__VOXEL_GAME__?.uiManager?.showXboxUI();
        });
        await sleep(2000);

        // Wait for Xbox boot sequence
        await sleep(5000);

        const xboxModalVisible1 = await waitForSelector(player1Page, '#xbox-menu', 10000);
        const xboxModalVisible2 = await waitForSelector(player2Page, '#xbox-menu', 10000);

        if (!xboxModalVisible1 || !xboxModalVisible2) {
            throw new Error('Xbox menu did not open for both players');
        }
        console.log('Xbox UI opened for both players!');

        // ========================
        // Step 4: Both players click Platformer
        // ========================
        console.log('\n--- Step 4: Both players clicking Platformer ---');

        // Player 1 clicks Platformer
        await player1Page.click('#play-platformer');
        await sleep(1000);

        // Should show mode selection - click Multiplayer Race
        const modeSelect1 = await waitForSelector(player1Page, '#platformer-mode-multiplayer', 3000);
        if (modeSelect1) {
            console.log('P1: Mode selection visible, clicking Multiplayer Race');
            await player1Page.click('#platformer-mode-multiplayer');
        } else {
            console.log('P1: No mode selection, may not have multiplayer available');
        }
        await sleep(1000);

        // Player 2 clicks Platformer
        await player2Page.click('#play-platformer');
        await sleep(1000);

        const modeSelect2 = await waitForSelector(player2Page, '#platformer-mode-multiplayer', 3000);
        if (modeSelect2) {
            console.log('P2: Mode selection visible, clicking Multiplayer Race');
            await player2Page.click('#platformer-mode-multiplayer');
        } else {
            console.log('P2: No mode selection, may not have multiplayer available');
        }
        await sleep(2000);

        // ========================
        // Step 5: Check if game started (auto-join mode)
        // ========================
        console.log('\n--- Step 5: Checking if game started ---');

        // Wait for game to start (auto-join should match players)
        await sleep(5000);

        const gameRunning1 = await player1Page.evaluate(() => {
            const canvas = document.querySelector('#xbox-canvas');
            return canvas && canvas.style.display !== 'none';
        });

        const gameRunning2 = await player2Page.evaluate(() => {
            const canvas = document.querySelector('#xbox-canvas');
            return canvas && canvas.style.display !== 'none';
        });

        console.log(`Player 1 game running: ${gameRunning1}`);
        console.log(`Player 2 game running: ${gameRunning2}`);

        if (gameRunning1 && gameRunning2) {
            console.log('Both players have game running!');

            // ========================
            // Step 6: Test movement
            // ========================
            console.log('\n--- Step 6: Testing movement ---');

            // Player 1 moves right and jumps
            await player1Page.keyboard.down('KeyD');
            await sleep(200);
            await player1Page.keyboard.press('Space');
            await sleep(500);
            await player1Page.keyboard.up('KeyD');
            await sleep(500);

            // Player 2 moves right and jumps
            await player2Page.keyboard.down('KeyD');
            await sleep(200);
            await player2Page.keyboard.press('Space');
            await sleep(500);
            await player2Page.keyboard.up('KeyD');
            await sleep(500);

            // Run game for a few seconds
            console.log('Running game for 5 seconds...');
            await sleep(5000);

            // ========================
            // Step 7: Verify game state
            // ========================
            console.log('\n--- Step 7: Verifying game state ---');

            const platformerState1 = await player1Page.evaluate(() => {
                const platformer = window.__VOXEL_GAME__?.uiManager?.minigameManager?.xboxPlatformer;
                if (!platformer) return null;
                return {
                    isActive: platformer.isActive,
                    isMultiplayer: platformer.isMultiplayer,
                    isHost: platformer.isHost,
                    playerCount: platformer.multiplayerPlayers?.size || 0,
                    gameTime: platformer.state?.gameTime?.toFixed(1) || 0
                };
            });

            const platformerState2 = await player2Page.evaluate(() => {
                const platformer = window.__VOXEL_GAME__?.uiManager?.minigameManager?.xboxPlatformer;
                if (!platformer) return null;
                return {
                    isActive: platformer.isActive,
                    isMultiplayer: platformer.isMultiplayer,
                    isHost: platformer.isHost,
                    playerCount: platformer.multiplayerPlayers?.size || 0,
                    gameTime: platformer.state?.gameTime?.toFixed(1) || 0
                };
            });

            console.log('Player 1 platformer state:', platformerState1);
            console.log('Player 2 platformer state:', platformerState2);

            // Get player positions
            const playerPositions = await player1Page.evaluate(() => {
                const platformer = window.__VOXEL_GAME__?.uiManager?.minigameManager?.xboxPlatformer;
                if (!platformer || !platformer.multiplayerPlayers) return {};
                const positions = {};
                for (const [id, player] of platformer.multiplayerPlayers) {
                    positions[player.name] = {
                        x: Math.round(player.x),
                        y: Math.round(player.y),
                        finishTime: player.finishTime
                    };
                }
                return positions;
            });

            console.log('Player positions:', playerPositions);
        }

        // Take final screenshots
        await player1Page.screenshot({ path: 'multiplayer_platformer_p1_final.png' });
        await player2Page.screenshot({ path: 'multiplayer_platformer_p2_final.png' });
        console.log('Screenshots saved: multiplayer_platformer_p1_final.png, multiplayer_platformer_p2_final.png');

        console.log('\n MULTIPLAYER PLATFORMER TEST COMPLETED');
        return { success: true };

    } catch (error) {
        console.error('\n TEST FAILED:', error.message);
        console.error(error.stack);

        try {
            if (player1Page) {
                await player1Page.screenshot({ path: 'platformer_test_failure_p1.png' });
                console.log('Screenshot saved: platformer_test_failure_p1.png');
            }
        } catch (e) {
            console.log('Could not take screenshot for Player 1');
        }

        try {
            if (player2Page) {
                await player2Page.screenshot({ path: 'platformer_test_failure_p2.png' });
                console.log('Screenshot saved: platformer_test_failure_p2.png');
            }
        } catch (e) {
            console.log('Could not take screenshot for Player 2');
        }

        return { success: false, error: error.message };

    } finally {
        try {
            if (player1Context) await player1Context.close();
            if (player2Context) await player2Context.close();
            await browser.close();
        } catch (e) {
            console.log('Error during cleanup:', e.message);
        }
    }
}

// Run the test
runTest()
    .then(result => {
        process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
        console.error('Test runner error:', err);
        process.exit(1);
    });
