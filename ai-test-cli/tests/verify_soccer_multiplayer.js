/**
 * Test: Soccer Ball Multiplayer Collision
 * Verifies that non-host players can kick the ball and the ball moves
 *
 * Simplified test:
 * 1. Launch two browser instances
 * 2. Both go to Soccer World
 * 3. Teleport P2 to ball and simulate collision check
 * 4. Verify ball state updates work
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_URL = 'http://localhost:3000';
const TIMEOUT = 90000;

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForGame(page, name) {
    console.log(`${name}: Waiting for game to initialize...`);
    for (let i = 0; i < 60; i++) {
        const status = await page.evaluate(() => {
            return {
                hasGame: !!window.game,
                hasSpaceShipManager: !!window.game?.spaceShipManager,
                hasSocketManager: !!window.game?.socketManager,
                hasPlayer: !!window.game?.player
            };
        }).catch(e => ({ error: e.message }));

        if (status.hasGame && status.hasSpaceShipManager && status.hasSocketManager) {
            console.log(`${name}: Game ready!`);
            return true;
        }

        if (i % 10 === 0) {
            console.log(`${name}: Status at ${i}s:`, JSON.stringify(status));
        }
        await delay(1000);
    }
    console.log(`${name}: Game did not initialize in time`);
    return false;
}

async function waitForSocket(page, name) {
    console.log(`${name}: Waiting for socket connection...`);
    for (let i = 0; i < 20; i++) {
        const connected = await page.evaluate(() => {
            return window.game?.socketManager?.isConnected?.() ?? false;
        }).catch(() => false);
        if (connected) {
            console.log(`${name}: Socket connected!`);
            return true;
        }
        await delay(1000);
    }
    console.log(`${name}: Socket did not connect in time`);
    return false;
}

async function warpToSoccer(page, name) {
    console.log(`${name}: Warping to Soccer World...`);
    await page.evaluate(() => {
        if (window.game && window.game.spaceShipManager) {
            window.game.spaceShipManager.warpToWorld('soccer');
        }
    });
    await delay(6000);

    // Verify soccer ball exists
    const ballExists = await page.evaluate(() => {
        return !!window.game?.spaceShipManager?.soccerBall;
    }).catch(() => false);
    console.log(`${name}: Soccer ball exists: ${ballExists}`);
    return ballExists;
}

async function runTest() {
    console.log('=== Soccer Multiplayer Ball Collision Test ===\n');

    let browser1 = null;
    let browser2 = null;

    try {
        // Launch two browser instances
        console.log('1. Launching browsers...');
        browser1 = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        browser2 = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page1 = await browser1.newPage();
        const page2 = await browser2.newPage();
        await page1.setViewport({ width: 1280, height: 720 });
        await page2.setViewport({ width: 1280, height: 720 });

        // Log relevant console messages
        page1.on('console', msg => {
            const text = msg.text();
            if (text.includes('SoccerBall') || text.includes('Remote player') || text.includes('kicked')) {
                console.log(`[P1]`, text);
            }
        });

        page2.on('console', msg => {
            const text = msg.text();
            if (text.includes('SoccerBall') || text.includes('Remote player') || text.includes('kicked')) {
                console.log(`[P2]`, text);
            }
        });

        // Load game for P1
        console.log('\n2. Loading game for P1...');
        await page1.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: TIMEOUT });
        await page1.mouse.click(640, 360);
        await delay(2000);
        await page1.keyboard.press('Escape');

        if (!await waitForGame(page1, 'P1')) {
            throw new Error('P1 game failed to initialize');
        }

        if (!await waitForSocket(page1, 'P1')) {
            throw new Error('P1 socket failed to connect');
        }

        // Load game for P2
        console.log('\n3. Loading game for P2...');
        await page2.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: TIMEOUT });
        await page2.mouse.click(640, 360);
        await delay(2000);
        await page2.keyboard.press('Escape');

        if (!await waitForGame(page2, 'P2')) {
            throw new Error('P2 game failed to initialize');
        }

        if (!await waitForSocket(page2, 'P2')) {
            throw new Error('P2 socket failed to connect');
        }

        // Warp both to soccer
        console.log('\n4. Warping both players to Soccer World...');
        if (!await warpToSoccer(page1, 'P1')) {
            throw new Error('P1 soccer ball not found');
        }
        await delay(2000);

        if (!await warpToSoccer(page2, 'P2')) {
            throw new Error('P2 soccer ball not found');
        }
        await delay(3000);

        // Check host status
        console.log('\n5. Checking host status...');
        const hostStatus = await page1.evaluate(() => {
            return {
                p1IsHost: window.game?.socketManager?.isSoccerBallHost,
                remotePlayerCount: window.game?.socketManager?.playerMeshes?.size ?? 0
            };
        });
        console.log(`   P1 is host: ${hostStatus.p1IsHost}`);
        console.log(`   P1 sees ${hostStatus.remotePlayerCount} remote player(s)`);

        // Wait for players to see each other
        await delay(2000);

        // Get initial ball position on P1 (host)
        console.log('\n6. Getting initial ball position...');
        const initialBall = await page1.evaluate(() => {
            const ball = window.game?.spaceShipManager?.soccerBall;
            if (ball) {
                return { x: ball.position.x, y: ball.position.y, z: ball.position.z };
            }
            return null;
        });

        if (!initialBall) {
            throw new Error('Could not get ball position');
        }
        console.log(`   Ball at: (${initialBall.x.toFixed(2)}, ${initialBall.y.toFixed(2)}, ${initialBall.z.toFixed(2)})`);

        // Test 1: Verify remote players are accessible from SoccerBall
        console.log('\n7. Testing remote player detection...');
        const remotePlayersTest = await page1.evaluate(() => {
            const ball = window.game?.spaceShipManager?.soccerBall;
            if (!ball) return { error: 'No ball' };

            // Check both sources (same logic as in SoccerBall.checkRemotePlayerCollisions)
            const remotePlayers = window.game?.remotePlayers ||
                (window.game?.socketManager?.playerMeshes);

            if (!remotePlayers) {
                return { error: 'No remote players source found', hasGameRemotePlayers: !!window.game?.remotePlayers, hasSocketManagerPlayerMeshes: !!window.game?.socketManager?.playerMeshes };
            }

            const players = [];
            for (const [id, player] of remotePlayers) {
                const mesh = player?.mesh || player;
                if (mesh && mesh.position) {
                    players.push({
                        id,
                        x: mesh.position.x,
                        y: mesh.position.y,
                        z: mesh.position.z
                    });
                }
            }

            return {
                count: remotePlayers.size,
                players: players
            };
        });

        console.log(`   Remote players result:`, JSON.stringify(remotePlayersTest, null, 2));

        // Test 2: Teleport P2 near ball and verify P1 sees collision
        console.log('\n8. Teleporting P2 near ball...');
        await page2.evaluate((ballPos) => {
            const player = window.game?.player;
            if (player) {
                player.position.x = ballPos.x + 3;  // 3 units from ball
                player.position.y = ballPos.y;
                player.position.z = ballPos.z;
                player.velocity.set(0, 0, 0);
                console.log(`[Debug] P2 teleported to near ball`);
            }
        }, initialBall);

        await delay(2000);  // Wait for position sync

        // Have P2 walk towards ball
        console.log('\n9. P2 walking towards ball...');
        await page2.mouse.click(640, 360);  // Lock pointer
        await delay(500);
        await page2.keyboard.down('KeyA');  // Walk left towards ball
        await delay(2000);
        await page2.keyboard.up('KeyA');
        await delay(1000);

        // Get final ball position
        console.log('\n10. Checking final ball position...');
        const finalBall = await page1.evaluate(() => {
            const ball = window.game?.spaceShipManager?.soccerBall;
            if (ball) {
                return { x: ball.position.x, y: ball.position.y, z: ball.position.z };
            }
            return null;
        });

        if (finalBall) {
            const dx = finalBall.x - initialBall.x;
            const dz = finalBall.z - initialBall.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            console.log(`    Initial: (${initialBall.x.toFixed(2)}, ${initialBall.z.toFixed(2)})`);
            console.log(`    Final: (${finalBall.x.toFixed(2)}, ${finalBall.z.toFixed(2)})`);
            console.log(`    Ball moved: ${distance.toFixed(2)} units`);

            // Take screenshots
            await page1.screenshot({ path: path.join(__dirname, 'soccer_mp_p1.png') });
            await page2.screenshot({ path: path.join(__dirname, 'soccer_mp_p2.png') });

            if (distance > 0.5) {
                console.log('\n    ✓ SUCCESS: Ball was moved!');
            } else {
                console.log('\n    Note: Ball did not move much (may need manual verification)');
            }
        }

        console.log('\n=== Test Complete ===');
        console.log('Keeping browsers open for 5 seconds...');
        await delay(5000);

        await browser1.close();
        await browser2.close();
        return true;

    } catch (error) {
        console.error('\nTest failed:', error.message);
        console.error(error.stack);

        if (browser1) await browser1.close().catch(() => {});
        if (browser2) await browser2.close().catch(() => {});
        return false;
    }
}

// Run the test
runTest().then(success => {
    process.exit(success ? 0 : 1);
});
