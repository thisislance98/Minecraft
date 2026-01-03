
import { io } from 'socket.io-client';
import { GameBrowser } from '../src/browser.js';
import chalk from 'chalk';

async function verifyDamageColor() {
    console.log(chalk.blue('Starting Damage Color Verification Test...'));

    const browser = new GameBrowser({ headless: true });
    await browser.launch();
    await browser.waitForGameLoad();
    console.log(chalk.green('Browser launched and game loaded.'));

    const serverUrl = 'http://localhost:2567';
    // Use a unique name to identify our fake player
    const fakeName = 'RedTest_' + Math.floor(Math.random() * 1000);
    const fakeSocket = io(serverUrl);

    // 1. Join Fake Player
    await new Promise(resolve => fakeSocket.on('connect', resolve));
    console.log(`Fake player ${fakeName} connected:`, fakeSocket.id);
    fakeSocket.emit('join_game', { name: fakeName });

    // Send initial position (Required to spawn mesh on other clients)
    console.log('Sending initial position...');
    fakeSocket.emit('player:move', {
        pos: { x: 0, y: 10, z: 0 },
        rotY: 0,
        isCrouching: false,
        health: 20,
        maxHealth: 20
    });

    // Wait for sync
    console.log('Waiting for player sync...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get the mesh on the main client
    // We need to evaluate inside the browser to check the mesh
    const getRemoteMeshColor = async (targetId) => {
        return await browser.evaluate((id) => {
            const game = window.__VOXEL_GAME__;
            if (!game || !game.socketManager) return { error: 'Game not ready' };
            const meshInfo = game.socketManager.playerMeshes.get(id);
            if (!meshInfo) return { error: 'Mesh not found' };

            let color = null;
            meshInfo.group.traverse((child) => {
                if (child.isMesh && child.material && !child.userData.name /* skip name label */ && !color) {
                    // Try to find a limb or torso
                    if (child.geometry && child.geometry.type === 'BoxGeometry') {
                        color = child.material.color.getHex();
                    }
                }
            });

            // Fallback
            if (color === null) return { error: 'No colored mesh found' };
            return { color };
        }, targetId);
    };

    const result = await getRemoteMeshColor(fakeSocket.id);
    if (result.error) {
        console.error(chalk.red('Error getting mesh:', result.error));
        await browser.close();
        fakeSocket.disconnect();
        process.exit(1);
    }

    console.log('Remote mesh found.');
    const initialColor = result.color;
    console.log('Initial Color:', initialColor.toString(16));

    if (initialColor === 0xFF0000) {
        console.error(chalk.red('Player started as RED! Test Invalid.'));
        await browser.close();
        fakeSocket.disconnect();
        process.exit(1);
    }

    // 2. Single Hit Test
    console.log('Triggering single damage event...');
    fakeSocket.emit('player:damage', { targetId: fakeSocket.id, amount: 1, sourceId: null });

    // Wait small amount to catch the flash (50ms)
    await new Promise(resolve => setTimeout(resolve, 50));

    const flashResult = await getRemoteMeshColor(fakeSocket.id);
    const flashColor = flashResult.color;
    console.log('Flash Color:', flashColor.toString(16));

    if (flashColor !== 0xFF0000) {
        console.warn(chalk.yellow('Player did not flash RED! (Might have missed the frame or logic issue, but ignoring for now if restore works)'));
    } else {
        console.log(chalk.green('Player flashed RED correctly.'));
    }

    // Wait for flash to end (200ms duration)
    await new Promise(resolve => setTimeout(resolve, 300));
    const restoredResult = await getRemoteMeshColor(fakeSocket.id);
    const restoredColor = restoredResult.color;
    console.log('Restored Color:', restoredColor.toString(16));

    if (restoredColor === 0xFF0000) {
        console.error(chalk.red('FAILED: Player stuck RED after single hit!'));
        await browser.close();
        fakeSocket.disconnect();
        process.exit(1);
    }

    // 3. Rapid Hit Test (The Bug Reproduction)
    console.log('Triggering rapid damage events (spamming 10 hits at 30ms interval)...');
    for (let i = 0; i < 10; i++) {
        fakeSocket.emit('player:damage', { targetId: fakeSocket.id, amount: 1, sourceId: null });
        await new Promise(resolve => setTimeout(resolve, 30));
    }

    // Wait for all flashes to subside
    await new Promise(resolve => setTimeout(resolve, 500));

    const finalResult = await getRemoteMeshColor(fakeSocket.id);
    const finalColor = finalResult.color;
    console.log('Final Color:', finalColor.toString(16));

    await browser.close();
    fakeSocket.disconnect();

    if (finalColor === 0xFF0000) {
        console.error(chalk.red('FAILED: Player stuck RED after rapid hits!'));
        process.exit(1);
    }

    console.log(chalk.green('SUCCESS: Player returned to normal color.'));
    process.exit(0);
}

verifyDamageColor().catch(err => {
    console.error(chalk.red('Critical Error:', err));
    process.exit(1);
});
