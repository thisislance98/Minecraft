
import { GameBrowser } from '../src/browser.js';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

const TARGET_FILE = path.resolve('../src/game/constants.js');
const ERROR_CODE = '\n\nconst invalid syntax = ; // SYNTAX ERROR INJECTION';

async function run() {
    console.log(chalk.blue('🧪 Starting Vite Error Overlay Verification Test...'));
    const browser = new GameBrowser({ headless: true }); // Headless can still check DOM

    let originalContent = '';

    try {
        // 1. Launch Game
        await browser.launch();
        await browser.waitForGameLoad();

        // 2. Read original file
        originalContent = await fs.readFile(TARGET_FILE, 'utf-8');
        console.log(chalk.dim(`  Saved original content of ${path.basename(TARGET_FILE)}`));

        // 3. Inject Syntax Error
        console.log(chalk.yellow('  Injecting syntax error...'));
        await fs.appendFile(TARGET_FILE, ERROR_CODE);

        // 4. Wait for HMR/Error Overlay
        console.log(chalk.dim('  Waiting 5s for error overlay...'));
        await new Promise(r => setTimeout(r, 5000));

        // 5. Check for Overlay
        // Vite error overlay custom element is <vite-error-overlay>
        const hasOverlay = await browser.page.evaluate(() => {
            return !!document.querySelector('vite-error-overlay');
        });

        if (hasOverlay) {
            console.error(chalk.red('\n❌ FAIL: Vite Error Overlay detected!'));
        } else {
            console.log(chalk.green('\n✅ PASS: No Vite Error Overlay detected.'));
        }

        // Also check if we can still interact or if the app crashed hard (optional)

    } catch (e) {
        console.error(chalk.red('Test Error:'), e);
    } finally {
        // 6. Cleanup
        if (originalContent) {
            console.log(chalk.dim('  Restoring file content...'));
            await fs.writeFile(TARGET_FILE, originalContent);
        }
        await browser.close();
        process.exit(0);
    }
}

run();
