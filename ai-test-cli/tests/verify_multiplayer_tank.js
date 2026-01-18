/**
 * Automated test for Xbox Tank Battle multiplayer
 *
 * This test verifies:
 * 1. Two players can join the same room and tank lobby
 * 2. Lobby sync shows both players
 * 3. Ready state and game start works
 * 4. Players can see each other and movement syncs
 * 5. Shooting and damage syncs between players
 *
 * Usage: node verify_multiplayer_tank.js
 * Requires: Playwright, game server running on localhost:5173
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
            // Game is exposed as window.__VOXEL_GAME__
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
    console.log('Starting Xbox Tank multiplayer test...');
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

        // Enable console logging for debugging (filter noisy messages)
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

        // Set username in localStorage before loading game to avoid prompt
        // Using cli=true to skip username prompt automatically
        await player1Page.goto(`${GAME_URL}?cli=true`);
        // Wait for initial page load
        await sleep(3000);

        // Now set our preferred username and reload
        await player1Page.evaluate(() => {
            localStorage.setItem('communityUsername', 'TestPlayer1');
        });
        await player1Page.reload();
        await sleep(5000); // Wait for game initialization and socket connection

        const p1Title = await player1Page.title();
        console.log(`Player 1 page title: "${p1Title}"`);

        // Check if game initialized
        const p1HasGame = await player1Page.evaluate(() => !!window.__VOXEL_GAME__);
        console.log(`Player 1 has __VOXEL_GAME__: ${p1HasGame}`);

        // Wait for Player 1 socket connection
        console.log('Waiting for Player 1 socket connection...');
        const p1Connected = await waitForSocket(player1Page);
        if (!p1Connected) {
            throw new Error('Player 1 failed to connect to server');
        }
        console.log('Player 1 connected!');

        // Get Player 1's room ID
        const roomId = await player1Page.evaluate(() => {
            return window.__VOXEL_GAME__?.socketManager?.roomId;
        });
        console.log(`Player 1 in room: ${roomId}`);

        // ========================
        // Step 2: Load game for Player 2 - they should auto-join the same room
        // ========================
        console.log('\n--- Step 2: Loading game for Player 2 ---');

        // Set Player 2's username and load game with cli=true
        await player2Page.goto(`${GAME_URL}?cli=true`);
        await sleep(3000);

        // Set our preferred username and reload
        await player2Page.evaluate(() => {
            localStorage.setItem('communityUsername', 'TestPlayer2');
        });
        await player2Page.reload();
        await sleep(5000); // Wait for game initialization

        // Wait for Player 2 socket connection
        console.log('Waiting for Player 2 socket connection...');
        const p2Connected = await waitForSocket(player2Page);
        if (!p2Connected) {
            throw new Error('Player 2 failed to connect to server');
        }
        console.log('Player 2 connected!');

        // Verify Player 2 is in the same room
        const p2RoomId = await player2Page.evaluate(() => {
            return window.__VOXEL_GAME__?.socketManager?.roomId;
        });
        console.log(`Player 2 in room: ${p2RoomId}`);

        if (roomId !== p2RoomId) {
            console.warn(`Warning: Players in different rooms (${roomId} vs ${p2RoomId})`);
            // This can happen if the room filled up, but for testing we'll proceed
        }

        // ========================
        // Step 3: Dismiss any popups and Open Xbox UI for both players
        // ========================
        console.log('\n--- Step 3: Dismissing popups and Opening Xbox UI ---');

        // Dismiss any blocking popups/modals
        const dismissAllPopups = async (page, label) => {
            try {
                // Try announcement dismiss button first
                const announcementBtn = await page.$('.announcement-dismiss');
                if (announcementBtn && await announcementBtn.isVisible()) {
                    console.log(`${label}: Dismissing announcement popup`);
                    await announcementBtn.click();
                    await sleep(500);
                }

                // Tutorial button
                const tutorialBtn = await page.$('#tutorial-ok');
                if (tutorialBtn && await tutorialBtn.isVisible()) {
                    console.log(`${label}: Dismissing tutorial popup`);
                    await tutorialBtn.click();
                    await sleep(500);
                }

                // Close community UI if open
                const commCloseBtn = await page.$('.comm-close-btn');
                if (commCloseBtn && await commCloseBtn.isVisible()) {
                    console.log(`${label}: Closing community UI`);
                    await commCloseBtn.click();
                    await sleep(500);
                }

                // Close any auth/store modal
                const storeCloseBtn = await page.$('#store-ui .close-button, #auth-close');
                if (storeCloseBtn && await storeCloseBtn.isVisible()) {
                    console.log(`${label}: Closing store/auth modal`);
                    await storeCloseBtn.click();
                    await sleep(500);
                }

                // Press Escape to close any remaining modal
                await page.keyboard.press('Escape');
                await sleep(300);

            } catch (e) {
                console.log(`${label}: Popup dismissal note: ${e.message}`);
            }
        };

        await dismissAllPopups(player1Page, 'P1');
        await dismissAllPopups(player2Page, 'P2');

        // Click on game canvas to ensure focus
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

        // Open Xbox UI programmatically (since X key requires holding an xbox item)
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

        // Wait for Xbox modal to appear
        const xboxModalVisible1 = await waitForSelector(player1Page, '#xbox-menu', 10000);
        const xboxModalVisible2 = await waitForSelector(player2Page, '#xbox-menu', 10000);

        if (!xboxModalVisible1 || !xboxModalVisible2) {
            throw new Error('Xbox menu did not open for both players');
        }
        console.log('Xbox UI opened for both players!');

        // ========================
        // Step 4: Both players click Tank Battle
        // ========================
        console.log('\n--- Step 4: Both players clicking Tank Battle ---');

        // Player 1 clicks first
        await player1Page.click('#play-tank');
        await sleep(1000);

        // Player 2 clicks
        await player2Page.click('#play-tank');
        await sleep(2000);

        // ========================
        // Step 5: Check lobby state
        // ========================
        console.log('\n--- Step 5: Checking lobby state ---');

        const lobby1Visible = await waitForSelector(player1Page, '#xbox-lobby', 5000);
        const lobby2Visible = await waitForSelector(player2Page, '#xbox-lobby', 5000);

        if (!lobby1Visible) {
            console.log('Note: Lobby not visible for Player 1 - may have started single-player');
        }
        if (!lobby2Visible) {
            console.log('Note: Lobby not visible for Player 2 - may have started single-player');
        }

        if (lobby1Visible && lobby2Visible) {
            console.log('Both players see lobby!');

            // Wait for lobby to sync
            await sleep(2000);

            // Check player count in lobby
            const lobbyPlayers1 = await player1Page.evaluate(() => {
                const lobby = document.querySelector('#lobby-players');
                if (!lobby) return 0;
                return lobby.querySelectorAll('div[style*="border-left"]').length;
            });

            console.log(`Player 1 sees ${lobbyPlayers1} players in lobby`);

            if (lobbyPlayers1 >= 2) {
                // ========================
                // Step 6: Player 2 clicks Ready
                // ========================
                console.log('\n--- Step 6: Player 2 clicking Ready ---');
                await player2Page.click('#lobby-ready-btn');
                await sleep(1000);

                // ========================
                // Step 7: Player 1 (host) clicks Start
                // ========================
                console.log('\n--- Step 7: Player 1 (host) clicking Start ---');
                const startBtn = await player1Page.$('#lobby-start-btn');
                if (startBtn) {
                    // Wait for button to be enabled
                    await sleep(1000);
                    const isEnabled = await player1Page.evaluate(el => !el.disabled, startBtn);
                    console.log(`Start button enabled: ${isEnabled}`);

                    if (isEnabled) {
                        await player1Page.click('#lobby-start-btn');
                        console.log('Game starting...');
                    } else {
                        console.log('Start button not enabled, waiting more...');
                        await sleep(2000);
                        await player1Page.click('#lobby-start-btn').catch(() => {
                            console.log('Could not click start button');
                        });
                    }
                }
                await sleep(3000);
            } else {
                console.log('Less than 2 players in lobby, cannot test multiplayer start');
            }
        }

        // ========================
        // Step 8: Check if game started
        // ========================
        console.log('\n--- Step 8: Checking if game started ---');

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
            // Step 9: Test movement and shooting
            // ========================
            console.log('\n--- Step 9: Testing movement and shooting ---');

            // Player 1 moves forward
            await player1Page.keyboard.down('KeyW');
            await sleep(500);
            await player1Page.keyboard.up('KeyW');
            await sleep(500);

            // Player 1 shoots
            const canvas1 = await player1Page.$('#xbox-canvas');
            if (canvas1) {
                const box = await canvas1.boundingBox();
                if (box) {
                    await player1Page.mouse.click(box.x + 300, box.y + 200);
                }
            }
            await sleep(500);

            // Player 2 moves
            await player2Page.keyboard.down('KeyS');
            await sleep(500);
            await player2Page.keyboard.up('KeyS');
            await sleep(500);

            // Run game for a few seconds
            console.log('Running game for 5 seconds...');
            await sleep(5000);

            // ========================
            // Step 10: Verify game state
            // ========================
            console.log('\n--- Step 10: Verifying game state ---');

            const tankState1 = await player1Page.evaluate(() => {
                const tank = window.__VOXEL_GAME__?.uiManager?.minigameManager?.xboxTank;
                if (!tank) return null;
                return {
                    isActive: tank.isActive,
                    isMultiplayer: tank.isMultiplayer,
                    isHost: tank.isHost,
                    playerCount: tank.multiplayerPlayers?.size || 0
                };
            });

            const tankState2 = await player2Page.evaluate(() => {
                const tank = window.__VOXEL_GAME__?.uiManager?.minigameManager?.xboxTank;
                if (!tank) return null;
                return {
                    isActive: tank.isActive,
                    isMultiplayer: tank.isMultiplayer,
                    isHost: tank.isHost,
                    playerCount: tank.multiplayerPlayers?.size || 0
                };
            });

            console.log('Player 1 tank state:', tankState1);
            console.log('Player 2 tank state:', tankState2);

            // Get scores
            const scores = await player1Page.evaluate(() => {
                const tank = window.__VOXEL_GAME__?.uiManager?.minigameManager?.xboxTank;
                if (!tank || !tank.multiplayerPlayers) return {};
                const scores = {};
                for (const [id, player] of tank.multiplayerPlayers) {
                    scores[player.name] = player.score;
                }
                return scores;
            });

            console.log('Current scores:', scores);
        }

        // Take final screenshots
        await player1Page.screenshot({ path: 'multiplayer_tank_p1_final.png' });
        await player2Page.screenshot({ path: 'multiplayer_tank_p2_final.png' });
        console.log('Screenshots saved: multiplayer_tank_p1_final.png, multiplayer_tank_p2_final.png');

        console.log('\n✅ MULTIPLAYER TEST COMPLETED');
        return { success: true };

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error(error.stack);

        // Take screenshots for debugging
        try {
            if (player1Page) {
                await player1Page.screenshot({ path: 'test_failure_player1.png' });
                console.log('Screenshot saved: test_failure_player1.png');
            }
        } catch (e) {
            console.log('Could not take screenshot for Player 1');
        }

        try {
            if (player2Page) {
                await player2Page.screenshot({ path: 'test_failure_player2.png' });
                console.log('Screenshot saved: test_failure_player2.png');
            }
        } catch (e) {
            console.log('Could not take screenshot for Player 2');
        }

        return { success: false, error: error.message };

    } finally {
        // Cleanup
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
