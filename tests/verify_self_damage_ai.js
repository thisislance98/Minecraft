
import { GameBrowser } from '../ai-test-cli/src/browser.js';
import * as gc from '../ai-test-cli/src/game-commands.js';
import chalk from 'chalk';
import fs from 'fs';

async function runTest() {
    fs.writeFileSync('test_result.txt', 'STARTING\n');
    console.log(chalk.blue('Starting Self-Damage Verification...'));
    const browser = new GameBrowser({ headless: false });

    try {
        await browser.launch();
        await browser.waitForGameLoad();
        fs.appendFileSync('test_result.txt', 'GAME LOADED\n');

        const initialHealthState = await gc.getPlayerHealth(browser);
        fs.appendFileSync('test_result.txt', `Initial Health: ${initialHealthState.health}\n`);

        await gc.giveItem(browser, 'bow', 1);
        await gc.giveItem(browser, 'wand', 1);

        // --- TEST 1: Arrow Self-Damage ---
        await gc.equipItem(browser, 'bow');
        await gc.setRotation(browser, -Math.PI / 2, 0, 0); // Up
        await new Promise(r => setTimeout(r, 500)); // Wait for rotation
        await gc.leftClick(browser);

        fs.appendFileSync('test_result.txt', 'Arrow fired. Waiting 5s...\n');
        await new Promise(r => setTimeout(r, 5000));

        const healthAfterArrow = await gc.getPlayerHealth(browser);
        fs.appendFileSync('test_result.txt', `Health after Arrow: ${healthAfterArrow.health}\n`);

        if (healthAfterArrow.health < initialHealthState.health) {
            fs.appendFileSync('test_result.txt', 'PASS: Arrow self-damage\n');
        } else {
            fs.appendFileSync('test_result.txt', 'FAIL: Arrow self-damage (Health did not decrease)\n');
        }

        // --- TEST 2: Magic Wand Self-Damage ---
        await gc.equipItem(browser, 'wand');
        const healthBeforeMagic = healthAfterArrow.health;

        await gc.setRotation(browser, Math.PI / 2, 0, 0); // Down
        await new Promise(r => setTimeout(r, 500));
        await gc.leftClick(browser);

        fs.appendFileSync('test_result.txt', 'Magic fired. Waiting 1s...\n');
        await new Promise(r => setTimeout(r, 1000));

        const healthAfterMagic = await gc.getPlayerHealth(browser);
        fs.appendFileSync('test_result.txt', `Health after Magic: ${healthAfterMagic.health}\n`);

        if (healthAfterMagic.health < healthBeforeMagic) {
            fs.appendFileSync('test_result.txt', 'PASS: Magic self-damage\n');
        } else {
            fs.appendFileSync('test_result.txt', 'FAIL: Magic self-damage\n');
        }

    } catch (e) {
        console.error(chalk.red('Test Error:'), e);
        fs.appendFileSync('test_result.txt', `ERROR: ${e.message}\n${e.stack}\n`);
    } finally {
        await browser.close();
    }
}

runTest();
