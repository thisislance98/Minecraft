#!/usr/bin/env node
/**
 * Test script to debug the delete functionality in spawn panel
 * This will open the game, trigger delete, and show all console logs
 */

import puppeteer from 'puppeteer';

const GAME_URL = process.env.GAME_URL || 'http://localhost:5173/?cli=true';

async function main() {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Capture all console logs
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        if (text.includes('SpawnUI') || text.includes('Admin') || text.includes('delete')) {
            console.log(`[Browser ${type.toUpperCase()}] ${text}`);
        }
    });

    // Capture errors
    page.on('pageerror', error => {
        console.log('[Browser ERROR]', error.message);
    });

    console.log(`Navigating to ${GAME_URL}...`);
    await page.goto(GAME_URL, { waitUntil: 'networkidle2' });

    console.log('Waiting for game to load...');
    await page.waitForFunction(() => window.__VOXEL_GAME__ !== undefined, { timeout: 30000 });

    console.log('Game loaded! Waiting 2 seconds for initialization...');
    await new Promise(r => setTimeout(r, 2000));

    // Check if spawn panel exists and if user is admin
    const checkResult = await page.evaluate(() => {
        const game = window.__VOXEL_GAME__;
        if (!game) return { error: 'Game not found' };
        if (!game.spawnUI) return { error: 'SpawnUI not found' };

        // Check auth state
        const authModule = game.spawnUI.constructor.toString().includes('auth');

        return {
            hasSpawnUI: true,
            isAdmin: game.spawnUI.isAdmin ? game.spawnUI.isAdmin() : 'isAdmin method not found',
            hasSocket: !!game.socket,
            socketConnected: game.socket?.connected
        };
    });

    console.log('Check result:', JSON.stringify(checkResult, null, 2));

    // Let's try to open the spawn panel and look for delete buttons
    console.log('\nOpening spawn panel...');
    await page.evaluate(() => {
        const game = window.__VOXEL_GAME__;
        if (game && game.spawnUI) {
            game.spawnUI.openPanel();
        }
    });

    await new Promise(r => setTimeout(r, 500));

    // Check for delete buttons
    const deleteButtons = await page.evaluate(() => {
        const buttons = document.querySelectorAll('.spawn-delete-btn');
        return {
            count: buttons.length,
            buttonTexts: Array.from(buttons).map(b => b.textContent).slice(0, 5)
        };
    });

    console.log('Delete buttons found:', JSON.stringify(deleteButtons, null, 2));

    if (deleteButtons.count === 0) {
        console.log('\n⚠️ No delete buttons found! This means isAdmin() returns false.');
        console.log('The user is likely not logged in as thisislance98@gmail.com');

        // Check Firebase auth state
        const authState = await page.evaluate(() => {
            // Try to access Firebase auth
            try {
                // Firebase SDK should be loaded
                if (window.firebaseAuth) {
                    const user = window.firebaseAuth.currentUser;
                    return {
                        hasAuth: true,
                        user: user ? {
                            email: user.email,
                            uid: user.uid
                        } : null
                    };
                }
                return { hasAuth: false, note: 'Firebase auth not in window' };
            } catch (e) {
                return { error: e.toString() };
            }
        });
        console.log('Auth state:', JSON.stringify(authState, null, 2));
    } else {
        console.log('\n✓ Delete buttons found! Trying to click the first one...');

        // Try clicking first delete button
        // We'll need to mock the confirm dialog
        await page.evaluate(() => {
            window.confirm = () => true; // Auto-confirm
        });

        // List creatures in spawn panel
        const creatures = await page.evaluate(() => {
            const items = document.querySelectorAll('#spawn-grid .spawn-item-btn');
            return Array.from(items).map(item => item.textContent).slice(0, 10);
        });
        console.log('Creatures in panel:', creatures);

        // Find and click the Worm delete button
        console.log('\nLooking for Worm creature...');
        const wormDeleted = await page.evaluate(() => {
            const items = document.querySelectorAll('#spawn-grid .spawn-item-btn');
            for (const item of items) {
                if (item.textContent.toLowerCase().includes('worm')) {
                    const delBtn = item.querySelector('.spawn-delete-btn');
                    if (delBtn) {
                        console.log('[Test] Clicking delete button for Worm');
                        delBtn.click();
                        return { found: true, clicked: true };
                    }
                    return { found: true, clicked: false, noDeleteBtn: true };
                }
            }
            return { found: false };
        });

        console.log('Worm delete result:', JSON.stringify(wormDeleted, null, 2));

        // Wait for any async operations
        await new Promise(r => setTimeout(r, 2000));
        console.log('\nWaiting for logs... (check above for [Browser] messages)');
    }

    console.log('\nTest complete. Keeping browser open for 30 seconds for inspection...');
    await new Promise(r => setTimeout(r, 30000));

    await browser.close();
}

main().catch(e => {
    console.error('Test failed:', e);
    process.exit(1);
});
