/**
 * Test to verify world and world-settings buttons have correct styling
 * Should match the style of other buttons in top-right-controls
 */

import { GameBrowser } from '../src/browser.js';
import chalk from 'chalk';

async function verifyWorldButtons() {
    console.log(chalk.cyan('\n=== World Buttons Style Test ===\n'));

    const browser = new GameBrowser({
        headless: true,
        quiet: true
    });

    try {
        await browser.launch();
        await browser.waitForGameLoad(15000);

        // Give UI time to fully initialize
        await new Promise(r => setTimeout(r, 3000));

        // Check button styles
        const results = await browser.evaluate(() => {
            const results = {
                worldBtn: null,
                worldSettingsBtn: null,
                referenceBtn: null,
                allButtonsMatch: false
            };

            // Get reference button (settings button)
            const refBtn = document.getElementById('settings-btn');
            const worldBtn = document.getElementById('world-btn');
            const worldSettingsBtn = document.getElementById('world-settings-btn');

            if (refBtn) {
                const refStyle = getComputedStyle(refBtn);
                results.referenceBtn = {
                    width: refStyle.width,
                    height: refStyle.height,
                    backgroundColor: refStyle.backgroundColor,
                    border: refStyle.border,
                    borderRadius: refStyle.borderRadius,
                    fontSize: refStyle.fontSize,
                    display: refStyle.display
                };
            }

            if (worldBtn) {
                const style = getComputedStyle(worldBtn);
                results.worldBtn = {
                    exists: true,
                    width: style.width,
                    height: style.height,
                    backgroundColor: style.backgroundColor,
                    border: style.border,
                    borderRadius: style.borderRadius,
                    fontSize: style.fontSize,
                    display: style.display
                };
            } else {
                results.worldBtn = { exists: false };
            }

            if (worldSettingsBtn) {
                const style = getComputedStyle(worldSettingsBtn);
                results.worldSettingsBtn = {
                    exists: true,
                    display: style.display,
                    width: style.width,
                    height: style.height,
                    backgroundColor: style.backgroundColor,
                    border: style.border,
                    borderRadius: style.borderRadius,
                    fontSize: style.fontSize
                };
            } else {
                results.worldSettingsBtn = { exists: false };
            }

            // Check if styles match
            if (results.referenceBtn && results.worldBtn?.exists) {
                results.allButtonsMatch =
                    results.worldBtn.width === results.referenceBtn.width &&
                    results.worldBtn.height === results.referenceBtn.height &&
                    results.worldBtn.borderRadius === results.referenceBtn.borderRadius;
            }

            return results;
        });

        console.log(chalk.blue('Reference Button (settings-btn):'));
        if (results.referenceBtn) {
            console.log(`  Width: ${results.referenceBtn.width}`);
            console.log(`  Height: ${results.referenceBtn.height}`);
            console.log(`  Border Radius: ${results.referenceBtn.borderRadius}`);
            console.log(`  Background: ${results.referenceBtn.backgroundColor}`);
            console.log(`  Border: ${results.referenceBtn.border}`);
        } else {
            console.log(chalk.red('  Not found!'));
        }

        console.log(chalk.blue('\nWorld Button (#world-btn):'));
        if (results.worldBtn?.exists) {
            console.log(`  Width: ${results.worldBtn.width}`);
            console.log(`  Height: ${results.worldBtn.height}`);
            console.log(`  Border Radius: ${results.worldBtn.borderRadius}`);
            console.log(`  Background: ${results.worldBtn.backgroundColor}`);
            console.log(`  Border: ${results.worldBtn.border}`);
        } else {
            console.log(chalk.red('  Not found!'));
        }

        console.log(chalk.blue('\nWorld Settings Button (#world-settings-btn):'));
        if (results.worldSettingsBtn?.exists) {
            console.log(`  Display: ${results.worldSettingsBtn.display}`);
            console.log(`  Width: ${results.worldSettingsBtn.width}`);
            console.log(`  Height: ${results.worldSettingsBtn.height}`);
            console.log(`  Border Radius: ${results.worldSettingsBtn.borderRadius}`);
            console.log(`  Note: Hidden by default until owner joins world`);
        } else {
            console.log(chalk.yellow('  Not rendered yet (expected - shown only for world owners)'));
        }

        // Take a screenshot of the top-right area
        await browser.page.screenshot({
            path: '/Users/I850333/projects/experiments/Minecraft/ai-test-cli/tests/world_buttons_test.png',
            clip: { x: 800, y: 0, width: 480, height: 100 }
        });
        console.log(chalk.green('\n📸 Screenshot saved: tests/world_buttons_test.png'));

        // Final verdict
        console.log(chalk.yellow('\n=== Results ==='));
        if (results.allButtonsMatch) {
            console.log(chalk.green('✓ World button styles match reference button!'));
            return true;
        } else if (results.worldBtn?.exists && results.referenceBtn) {
            const widthMatch = results.worldBtn.width === results.referenceBtn.width;
            const heightMatch = results.worldBtn.height === results.referenceBtn.height;
            const radiusMatch = results.worldBtn.borderRadius === results.referenceBtn.borderRadius;

            console.log(`  Width match: ${widthMatch ? '✓' : '✗'}`);
            console.log(`  Height match: ${heightMatch ? '✓' : '✗'}`);
            console.log(`  Border radius match: ${radiusMatch ? '✓' : '✗'}`);

            if (widthMatch && heightMatch && radiusMatch) {
                console.log(chalk.green('\n✓ Core styles match! Button styling looks correct.'));
                return true;
            } else {
                console.log(chalk.red('\n✗ Some styles do not match.'));
                return false;
            }
        } else {
            console.log(chalk.red('✗ Could not compare styles - buttons may not exist'));
            return false;
        }

    } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        return false;
    } finally {
        await browser.close();
    }
}

// Run the test
verifyWorldButtons().then(success => {
    process.exit(success ? 0 : 1);
});
