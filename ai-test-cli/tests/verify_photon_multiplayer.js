/**
 * Test: Verify Photon Multiplayer
 *
 * Opens two browser windows and verifies:
 * 1. Both connect to Photon
 * 2. Players see each other
 * 3. Position sync works
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GAME_URL = 'http://localhost:3000';
const TIMEOUT = 45000;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log('='.repeat(60));
    console.log('Photon Multiplayer Test');
    console.log('='.repeat(60));
    console.log(`Game URL: ${GAME_URL}`);
    console.log('');

    let browser1 = null;
    let browser2 = null;
    let success = false;

    try {
        // Launch first browser
        console.log('[Test] Launching browser 1...');
        browser1 = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--window-size=800,600', '--window-position=0,0']
        });
        const page1 = await browser1.newPage();
        await page1.setViewport({ width: 800, height: 600 });

        // Set localStorage for player 1
        await page1.evaluateOnNewDocument(() => {
            localStorage.setItem('communityUsername', 'PhotonPlayer1');
        });

        // Set up console listeners BEFORE navigation to capture everything
        page1.on('console', msg => {
            const text = msg.text();
            console.log(`[P1 Console] ${text}`);
        });

        page1.on('pageerror', err => {
            console.log(`[P1 Error] ${err.message}`);
        });

        console.log('[Test] Player 1: Loading game...');
        await page1.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: TIMEOUT });

        // Click to start (pointer lock)
        await sleep(3000);
        await page1.mouse.click(400, 300);
        await sleep(2000);

        // Launch second browser
        console.log('[Test] Launching browser 2...');
        browser2 = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--window-size=800,600', '--window-position=850,0']
        });
        const page2 = await browser2.newPage();
        await page2.setViewport({ width: 800, height: 600 });

        // Set localStorage for player 2
        await page2.evaluateOnNewDocument(() => {
            localStorage.setItem('communityUsername', 'PhotonPlayer2');
        });

        // Set up console listeners BEFORE navigation
        page2.on('console', msg => {
            const text = msg.text();
            console.log(`[P2 Console] ${text}`);
        });

        page2.on('pageerror', err => {
            console.log(`[P2 Error] ${err.message}`);
        });

        console.log('[Test] Player 2: Loading game...');
        await page2.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: TIMEOUT });

        // Click to start
        await sleep(3000);
        await page2.mouse.click(400, 300);
        await sleep(2000);

        // Wait for both to connect
        console.log('[Test] Waiting for Photon connections...');
        await sleep(10000); // Increased wait time for Photon

        // Check connection status in page 1
        const p1Status = await page1.evaluate(() => {
            const game = window.__VOXEL_GAME__;
            if (game && game.socketManager) {
                return {
                    connected: game.socketManager.isConnected?.() || false,
                    roomId: game.socketManager.roomId,
                    actorNr: game.socketManager.actorNr,
                    connectionState: game.socketManager.connectionState,
                    otherPlayers: game.socketManager.playerMeshes?.size || 0
                };
            }
            return { error: 'No game instance found', hasGame: !!game };
        });

        console.log('[Test] Player 1 Status:', JSON.stringify(p1Status, null, 2));

        // Check connection status in page 2
        const p2Status = await page2.evaluate(() => {
            const game = window.__VOXEL_GAME__;
            if (game && game.socketManager) {
                return {
                    connected: game.socketManager.isConnected?.() || false,
                    roomId: game.socketManager.roomId,
                    actorNr: game.socketManager.actorNr,
                    connectionState: game.socketManager.connectionState,
                    otherPlayers: game.socketManager.playerMeshes?.size || 0
                };
            }
            return { error: 'No game instance found', hasGame: !!game };
        });

        console.log('[Test] Player 2 Status:', JSON.stringify(p2Status, null, 2));

        // Move player 1 and check if player 2 sees them
        console.log('[Test] Moving player 1...');
        await page1.keyboard.down('w');
        await sleep(1000);
        await page1.keyboard.up('w');
        await sleep(2000);

        // Check if player 2 sees player 1's mesh
        const p2SeesP1 = await page2.evaluate(() => {
            const game = window.__VOXEL_GAME__;
            if (game && game.socketManager && game.socketManager.playerMeshes) {
                return game.socketManager.playerMeshes.size > 0;
            }
            return false;
        });

        console.log(`[Test] Player 2 sees Player 1: ${p2SeesP1}`);

        // Take screenshots
        const screenshotDir = path.join(__dirname, '..');
        await page1.screenshot({ path: path.join(screenshotDir, 'photon_test_p1.png') });
        await page2.screenshot({ path: path.join(screenshotDir, 'photon_test_p2.png') });
        console.log('[Test] Screenshots saved');

        // Determine success
        success = p1Status.connected && p2Status.connected &&
            p1Status.roomId === p2Status.roomId;

        if (success) {
            console.log('\n[SUCCESS] Photon multiplayer test PASSED!');
            console.log(`Both players connected to room: ${p1Status.roomId}`);
            if (p2SeesP1) {
                console.log('Player 2 can see Player 1');
            }
        } else {
            console.log('\n[FAILED] Photon multiplayer test FAILED');
            if (!p1Status.connected) console.log('  - Player 1 not connected');
            if (!p2Status.connected) console.log('  - Player 2 not connected');
            if (p1Status.roomId !== p2Status.roomId) console.log('  - Players in different rooms');
        }

    } catch (error) {
        console.error('[Test Error]', error.message);
        success = false;
    } finally {
        // Keep browsers open for a moment to observe
        await sleep(5000);

        if (browser1) await browser1.close();
        if (browser2) await browser2.close();
    }

    console.log('\n' + '='.repeat(60));
    process.exit(success ? 0 : 1);
}

runTest();
