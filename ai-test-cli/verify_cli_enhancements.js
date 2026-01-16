
import { GameBrowser } from './src/browser.js';
import * as gc from './src/game-commands.js';
import fs from 'fs';
import path from 'path';

async function verify() {
    console.log('Starting verification...');
    const browser = new GameBrowser({ headless: true, quiet: false });

    try {
        await browser.launch();
        const loaded = await browser.waitForGameLoad();
        if (!loaded) {
            console.error('Game failed to load');
            process.exit(1);
        }

        console.log('Game loaded. Testing inputs...');

        // Test Key Press
        await gc.pressKey(browser, 'Space');
        console.log('Key press simulated.');

        // Test Click
        const leftClickRes = await gc.leftClick(browser, 500, 500);
        console.log('Left click result:', leftClickRes);
        if (leftClickRes.x !== 500 || leftClickRes.y !== 500) {
            throw new Error('Left click coordinates mismatch');
        }

        const rightClickRes = await gc.rightClick(browser, 600, 600);
        console.log('Right click result:', rightClickRes);
        if (rightClickRes.x !== 600 || rightClickRes.y !== 600) {
            throw new Error('Right click coordinates mismatch');
        }

        // Test Screenshot
        const screenshotPath = 'verify_screenshot.png';
        if (fs.existsSync(screenshotPath)) fs.unlinkSync(screenshotPath);

        await browser.screenshot(screenshotPath);

        if (fs.existsSync(screenshotPath)) {
            console.log('Screenshot verification passed.');
            fs.unlinkSync(screenshotPath); // Cleanup
        } else {
            throw new Error('Screenshot file not created');
        }

        console.log('All verifications passed!');

    } catch (e) {
        console.error('Verification failed:', e);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

verify();
