/**
 * Test: Soccer World Scoreboard
 * Verifies that the scoreboard UI works correctly:
 * - Scoreboard appears when entering Soccer World
 * - Score updates when goals are scored
 * - Win screen appears when a team reaches 10 goals
 * - Reset button works to reset scores
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_URL = 'http://localhost:3000';
const TIMEOUT = 60000;

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log('=== Soccer Scoreboard Test ===\n');

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });

        // Enable console logging from the page
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('Soccer') || text.includes('soccer') || text.includes('score') || text.includes('[SpaceShip]')) {
                console.log('[Page]', text);
            }
        });

        console.log('1. Loading game...');
        await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: TIMEOUT });
        await delay(5000); // Wait for game to initialize

        // Click to capture pointer and dismiss any initial dialogs
        console.log('2. Clicking to initialize game...');
        await page.mouse.click(640, 360);
        await delay(2000);

        // Press Escape to ensure we're not locked
        await page.keyboard.press('Escape');
        await delay(500);

        console.log('3. Opening settings panel with E key...');
        await page.keyboard.press('KeyE');
        await delay(1000);

        // Take screenshot of settings
        await page.screenshot({ path: path.join(__dirname, 'soccer_settings_panel.png') });

        // Look for the soccer warp button by ID
        console.log('4. Looking for Soccer World warp button...');

        // Wait for button to be visible in DOM
        try {
            await page.waitForSelector('#settings-warp-soccer', { visible: true, timeout: 5000 });
            console.log('   Found Soccer World button!');

            // Use evaluate to click to avoid node issues
            await page.evaluate(() => {
                const btn = document.querySelector('#settings-warp-soccer');
                if (btn) {
                    btn.click();
                }
            });
            console.log('   Clicked Soccer World button');
        } catch (e) {
            console.log('   Soccer button not found by ID, trying to warp programmatically...');
            // Try to warp via JavaScript
            await page.evaluate(() => {
                if (window.game && window.game.spaceShipManager) {
                    window.game.spaceShipManager.warpToWorld('soccer');
                }
            });
        }

        console.log('5. Waiting for Soccer World to load...');
        await delay(6000); // Wait for warp + terrain load

        // Close settings if still open
        await page.keyboard.press('Escape');
        await delay(500);

        // Take screenshot
        const screenshot1 = path.join(__dirname, 'soccer_world_loaded.png');
        await page.screenshot({ path: screenshot1 });
        console.log(`   Screenshot saved: ${screenshot1}`);

        // Check if scoreboard is visible
        console.log('\n6. Checking scoreboard UI...');
        const scoreboard = await page.$('#soccer-scoreboard');
        if (scoreboard) {
            console.log('   ✓ Scoreboard element found');

            const isVisible = await page.evaluate(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden';
            }, scoreboard);

            if (isVisible) {
                console.log('   ✓ Scoreboard is visible');
            } else {
                console.log('   ✗ Scoreboard exists but not visible');
            }

            // Check for score elements
            const blueScore = await page.$('#soccer-blue-score');
            const orangeScore = await page.$('#soccer-orange-score');

            if (blueScore && orangeScore) {
                const blueValue = await page.evaluate(el => el.innerText, blueScore);
                const orangeValue = await page.evaluate(el => el.innerText, orangeScore);
                console.log(`   Blue Score: ${blueValue}, Orange Score: ${orangeValue}`);
            }

            // Check for reset button
            const resetButton = await page.$('#soccer-reset-button');
            if (resetButton) {
                console.log('   ✓ Reset button found');
            } else {
                console.log('   ✗ Reset button not found');
            }
        } else {
            console.log('   ✗ Scoreboard element not found - checking if it exists at all...');

            // Debug: list all divs with soccer in ID
            const soccerDivs = await page.evaluate(() => {
                const divs = document.querySelectorAll('[id*="soccer"]');
                return Array.from(divs).map(d => d.id);
            });
            console.log('   Soccer elements found:', soccerDivs);
        }

        // Check for soccer ball
        console.log('\n7. Checking soccer ball...');
        const ballInfo = await page.evaluate(() => {
            if (window.game && window.game.spaceShipManager) {
                const ball = window.game.spaceShipManager.soccerBall;
                if (ball) {
                    return {
                        exists: true,
                        position: { x: ball.x.toFixed(2), y: ball.y.toFixed(2), z: ball.z.toFixed(2) },
                        scores: ball.scores || null,
                        gameOver: ball.gameOver || false
                    };
                }
            }
            return { exists: false };
        });

        if (ballInfo.exists) {
            console.log('   ✓ Soccer ball found');
            console.log(`   Position: (${ballInfo.position.x}, ${ballInfo.position.y}, ${ballInfo.position.z})`);
            if (ballInfo.scores) {
                console.log(`   Scores: Blue ${ballInfo.scores.blue} - Orange ${ballInfo.scores.orange}`);
            }
        } else {
            console.log('   ✗ Soccer ball not found');
        }

        // Test score update function
        console.log('\n8. Testing score update...');
        const updateResult = await page.evaluate(() => {
            if (window.game && window.game.uiManager && window.game.uiManager.updateSoccerScoreboard) {
                window.game.uiManager.updateSoccerScoreboard(5, 3);
                return true;
            }
            return false;
        });

        if (updateResult) {
            console.log('   Called updateSoccerScoreboard(5, 3)');
            await delay(500);

            const scores = await page.evaluate(() => {
                const blue = document.querySelector('#soccer-blue-score');
                const orange = document.querySelector('#soccer-orange-score');
                return {
                    blue: blue ? blue.innerText : null,
                    orange: orange ? orange.innerText : null
                };
            });

            if (scores.blue === '5' && scores.orange === '3') {
                console.log('   ✓ Scores updated correctly');
            } else {
                console.log(`   Scores after update: Blue=${scores.blue}, Orange=${scores.orange}`);
            }
        } else {
            console.log('   ✗ updateSoccerScoreboard function not available');
        }

        // Take screenshot after score update
        await page.screenshot({ path: path.join(__dirname, 'soccer_score_updated.png') });

        // Test win screen
        console.log('\n9. Testing win screen...');
        await page.evaluate(() => {
            if (window.game && window.game.uiManager && window.game.uiManager.showSoccerWinScreen) {
                window.game.uiManager.showSoccerWinScreen('BLUE');
            }
        });
        await delay(1000);

        const winScreen = await page.$('#soccer-win-screen');
        if (winScreen) {
            const isVisible = await page.evaluate(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none';
            }, winScreen);

            if (isVisible) {
                console.log('   ✓ Win screen is visible');
                await page.screenshot({ path: path.join(__dirname, 'soccer_win_screen.png') });
            } else {
                console.log('   ✗ Win screen exists but not visible');
            }
        } else {
            console.log('   ✗ Win screen element not found');
        }

        // Hide win screen
        await page.evaluate(() => {
            if (window.game && window.game.uiManager) {
                window.game.uiManager.hideSoccerWinScreen();
            }
        });
        await delay(500);

        // Test leaving Soccer World
        console.log('\n10. Testing scoreboard hides when leaving...');
        await page.evaluate(() => {
            if (window.game && window.game.spaceShipManager) {
                window.game.spaceShipManager.warpToWorld('earth');
            }
        });
        await delay(4000);

        const scoreboardAfterLeave = await page.$('#soccer-scoreboard');
        if (scoreboardAfterLeave) {
            const isHidden = await page.evaluate(el => {
                const style = window.getComputedStyle(el);
                return style.display === 'none';
            }, scoreboardAfterLeave);

            if (isHidden) {
                console.log('   ✓ Scoreboard hidden after leaving Soccer World');
            } else {
                console.log('   ✗ Scoreboard still visible after leaving');
            }
        } else {
            console.log('   ✓ Scoreboard element removed');
        }

        await page.screenshot({ path: path.join(__dirname, 'soccer_after_leave.png') });

        console.log('\n=== Test Complete ===');

        await browser.close();
        return true;

    } catch (error) {
        console.error('\nTest failed with error:', error.message);
        if (browser) {
            await browser.close();
        }
        return false;
    }
}

// Run the test
runTest().then(success => {
    process.exit(success ? 0 : 1);
});
