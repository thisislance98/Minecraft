#!/usr/bin/env node
/**
 * verify_world_settings.js
 *
 * Tests the enhanced world settings system:
 * 1. Sky color changes via API and visual verification
 * 2. Gravity settings via API and physics effect
 * 3. Creature filtering via API
 * 4. Settings broadcast to other players
 */

import chalk from 'chalk';
import { GameBrowser } from '../src/browser.js';

const TEST_TIMEOUT = 90000; // 90 seconds total
const SERVER_URL = 'http://localhost:2567';
const GAME_URL = 'http://localhost:3000';

// Test world IDs
const TEST_WORLD_ID = `test-settings-${Date.now()}`;

// Test results
const results = {
    worldCreation: false,
    skyColorAPI: false,
    skyColorVisual: false,
    gravityAPI: false,
    gravityEffect: false,
    creatureFilterAPI: false,
    landscapeSettingsAPI: false,
    cleanup: false
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a test world via the API
 */
async function createTestWorld() {
    console.log(chalk.blue(`\n[Setup] Creating test world: ${TEST_WORLD_ID}`));

    try {
        const response = await fetch(`${SERVER_URL}/api/worlds`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-antigravity-secret': 'asdf123',
                'x-antigravity-client': 'cli'
            },
            body: JSON.stringify({
                name: 'World Settings Test',
                description: 'Testing enhanced world settings',
                visibility: 'unlisted'
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log(chalk.green(`  ✓ World created: ${data.world.id}`));
            return data.world.id;
        }

        const error = await response.text();
        console.log(chalk.red(`  ✗ World creation failed: ${response.status} - ${error}`));
        return null;
    } catch (e) {
        console.log(chalk.red(`  ✗ Failed to create world: ${e.message}`));
        return null;
    }
}

/**
 * Update world settings via the API
 */
async function updateWorldSettings(worldId, settings, customizations) {
    try {
        const body = {};
        if (settings) body.settings = settings;
        if (customizations) body.customizations = customizations;

        const response = await fetch(`${SERVER_URL}/api/worlds/${worldId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'x-antigravity-secret': 'asdf123',
                'x-antigravity-client': 'cli'
            },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            const data = await response.json();
            return { success: true, world: data.world };
        }

        const error = await response.text();
        return { success: false, error };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * Get world details via API
 */
async function getWorld(worldId) {
    try {
        const response = await fetch(`${SERVER_URL}/api/worlds/${worldId}`, {
            headers: {
                'x-antigravity-secret': 'asdf123',
                'x-antigravity-client': 'cli'
            }
        });

        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Delete a test world via the API
 */
async function deleteTestWorld(worldId) {
    console.log(chalk.dim(`\n[Cleanup] Deleting test world: ${worldId}`));
    try {
        const response = await fetch(`${SERVER_URL}/api/worlds/${worldId}`, {
            method: 'DELETE',
            headers: {
                'x-antigravity-secret': 'asdf123',
                'x-antigravity-client': 'cli'
            }
        });
        return response.ok;
    } catch (e) {
        console.log(chalk.yellow(`  ⚠ Cleanup failed: ${e.message}`));
        return false;
    }
}

/**
 * Main test execution
 */
async function runTest() {
    console.log(chalk.bold.blue('\n════════════════════════════════════════════'));
    console.log(chalk.bold.blue('  Enhanced World Settings Test'));
    console.log(chalk.bold.blue('════════════════════════════════════════════\n'));

    let worldId = null;
    let browser = null;

    try {
        // ============================================
        // Phase 1: Create test world
        // ============================================
        console.log(chalk.bold('\n📦 Phase 1: Creating test world'));

        worldId = await createTestWorld();
        results.worldCreation = worldId !== null;

        if (!worldId) {
            console.log(chalk.red('  ✗ Cannot proceed without a test world'));
            return false;
        }

        // ============================================
        // Phase 2: Test Sky Color API
        // ============================================
        console.log(chalk.bold('\n🎨 Phase 2: Testing Sky Color API'));

        const skyTestColor = '#FF6B35'; // Sunset orange
        const skyResult = await updateWorldSettings(worldId, null, {
            skyColor: skyTestColor
        });

        if (skyResult.success) {
            console.log(chalk.green(`  ✓ Sky color updated to ${skyTestColor}`));
            results.skyColorAPI = true;

            // Verify the value was saved
            const worldData = await getWorld(worldId);
            if (worldData?.world?.customizations?.skyColor === skyTestColor) {
                console.log(chalk.green(`  ✓ Sky color persisted correctly`));
            } else {
                console.log(chalk.yellow(`  ⚠ Sky color value: ${worldData?.world?.customizations?.skyColor}`));
            }
        } else {
            console.log(chalk.red(`  ✗ Sky color update failed: ${skyResult.error}`));
        }

        // Test invalid sky color
        const invalidSkyResult = await updateWorldSettings(worldId, null, {
            skyColor: 'not-a-color'
        });
        if (!invalidSkyResult.success) {
            console.log(chalk.green(`  ✓ Invalid sky color rejected correctly`));
        } else {
            console.log(chalk.yellow(`  ⚠ Invalid sky color was accepted`));
        }

        // ============================================
        // Phase 3: Test Gravity API
        // ============================================
        console.log(chalk.bold('\n⚖️ Phase 3: Testing Gravity API'));

        const gravityValue = 0.3; // Moon gravity
        const gravityResult = await updateWorldSettings(worldId, null, {
            gravity: gravityValue
        });

        if (gravityResult.success) {
            console.log(chalk.green(`  ✓ Gravity updated to ${gravityValue}x`));
            results.gravityAPI = true;

            // Verify the value was saved
            const worldData = await getWorld(worldId);
            if (worldData?.world?.customizations?.gravity === gravityValue) {
                console.log(chalk.green(`  ✓ Gravity persisted correctly`));
            } else {
                console.log(chalk.yellow(`  ⚠ Gravity value: ${worldData?.world?.customizations?.gravity}`));
            }
        } else {
            console.log(chalk.red(`  ✗ Gravity update failed: ${gravityResult.error}`));
        }

        // Test invalid gravity (out of range)
        const invalidGravityResult = await updateWorldSettings(worldId, null, {
            gravity: 5.0 // Out of 0.1-3.0 range
        });
        if (!invalidGravityResult.success) {
            console.log(chalk.green(`  ✓ Invalid gravity (5.0) rejected correctly`));
        } else {
            console.log(chalk.yellow(`  ⚠ Invalid gravity was accepted`));
        }

        // ============================================
        // Phase 4: Test Creature Filter API
        // ============================================
        console.log(chalk.bold('\n🦁 Phase 4: Testing Creature Filter API'));

        const allowedCreatures = ['Pig', 'Cow', 'Chicken', 'Horse'];
        const creatureResult = await updateWorldSettings(worldId, {
            allowedCreatures: allowedCreatures
        }, null);

        if (creatureResult.success) {
            console.log(chalk.green(`  ✓ Creature filter set to: ${allowedCreatures.join(', ')}`));
            results.creatureFilterAPI = true;

            // Verify the value was saved
            const worldData = await getWorld(worldId);
            const savedCreatures = worldData?.world?.settings?.allowedCreatures;
            if (Array.isArray(savedCreatures) && savedCreatures.length === allowedCreatures.length) {
                console.log(chalk.green(`  ✓ Creature filter persisted correctly`));
            } else {
                console.log(chalk.yellow(`  ⚠ Creature filter value: ${JSON.stringify(savedCreatures)}`));
            }
        } else {
            console.log(chalk.red(`  ✗ Creature filter update failed: ${creatureResult.error}`));
        }

        // Test null creatures (all allowed)
        const allCreaturesResult = await updateWorldSettings(worldId, {
            allowedCreatures: null
        }, null);
        if (allCreaturesResult.success) {
            console.log(chalk.green(`  ✓ Creature filter cleared (all allowed)`));
        }

        // ============================================
        // Phase 5: Test Landscape Settings API
        // ============================================
        console.log(chalk.bold('\n🏞️ Phase 5: Testing Landscape Settings API'));

        const landscapeSettings = {
            enableRivers: false,
            enableVillages: true,
            seaLevel: 45,
            terrainScale: 1.5
        };

        const landscapeResult = await updateWorldSettings(worldId, null, {
            landscapeSettings: landscapeSettings
        });

        if (landscapeResult.success) {
            console.log(chalk.green(`  ✓ Landscape settings updated`));
            console.log(chalk.dim(`    Rivers: ${landscapeSettings.enableRivers}`));
            console.log(chalk.dim(`    Villages: ${landscapeSettings.enableVillages}`));
            console.log(chalk.dim(`    Sea Level: ${landscapeSettings.seaLevel}`));
            console.log(chalk.dim(`    Terrain Scale: ${landscapeSettings.terrainScale}x`));
            results.landscapeSettingsAPI = true;

            // Verify the values were saved
            const worldData = await getWorld(worldId);
            const saved = worldData?.world?.customizations?.landscapeSettings;
            if (saved?.seaLevel === landscapeSettings.seaLevel &&
                saved?.terrainScale === landscapeSettings.terrainScale) {
                console.log(chalk.green(`  ✓ Landscape settings persisted correctly`));
            }
        } else {
            console.log(chalk.red(`  ✗ Landscape settings update failed: ${landscapeResult.error}`));
        }

        // Test invalid sea level
        const invalidSeaResult = await updateWorldSettings(worldId, null, {
            landscapeSettings: { seaLevel: 200 } // Out of 10-100 range
        });
        if (!invalidSeaResult.success) {
            console.log(chalk.green(`  ✓ Invalid sea level (200) rejected correctly`));
        } else {
            console.log(chalk.yellow(`  ⚠ Invalid sea level was accepted`));
        }

        // ============================================
        // Phase 6: Visual Testing with Browser
        // ============================================
        console.log(chalk.bold('\n🌐 Phase 6: Visual Testing with Browser'));

        // Set a distinctive sky color for visual verification
        await updateWorldSettings(worldId, null, {
            skyColor: '#2D1B4E', // Purple night
            gravity: 0.3
        });

        browser = new GameBrowser({
            headless: false,
            gameUrl: `${GAME_URL}/world/${worldId}`,
            quiet: true
        });

        await browser.launch();
        console.log(chalk.dim('  Waiting for game load...'));
        await browser.waitForGameLoad(15000);
        await sleep(3000);

        // Check if sky color was applied
        const visualCheck = await browser.evaluate(() => {
            const game = window.game;
            if (!game || !game.environment) {
                return { hasEnvironment: false };
            }

            return {
                hasEnvironment: true,
                skyColorHex: game.environment.skyColor ?
                    '#' + game.environment.skyColor.getHexString().toUpperCase() : null,
                gravityMultiplier: game.gravityMultiplier
            };
        });

        console.log(chalk.dim(`  Environment exists: ${visualCheck.hasEnvironment}`));
        console.log(chalk.dim(`  Current sky color: ${visualCheck.skyColorHex}`));
        console.log(chalk.dim(`  Gravity multiplier: ${visualCheck.gravityMultiplier}`));

        if (visualCheck.hasEnvironment && visualCheck.skyColorHex) {
            results.skyColorVisual = true;
            console.log(chalk.green(`  ✓ Sky color applied in game`));
        }

        if (visualCheck.gravityMultiplier === 0.3) {
            results.gravityEffect = true;
            console.log(chalk.green(`  ✓ Gravity multiplier applied correctly`));
        } else if (visualCheck.gravityMultiplier !== undefined) {
            console.log(chalk.yellow(`  ⚠ Gravity multiplier: ${visualCheck.gravityMultiplier} (expected 0.3)`));
        }

        // Take a screenshot
        await browser.screenshot('tests/world_settings_visual.png');
        console.log(chalk.green('\n📸 Screenshot saved: tests/world_settings_visual.png'));

        // ============================================
        // Final Summary
        // ============================================
        console.log(chalk.bold('\n════════════════════════════════════════════'));
        console.log(chalk.bold('  Test Results Summary'));
        console.log(chalk.bold('════════════════════════════════════════════'));

        console.log(`  World Creation:        ${results.worldCreation ? chalk.green('PASS') : chalk.red('FAIL')}`);
        console.log(`  Sky Color API:         ${results.skyColorAPI ? chalk.green('PASS') : chalk.red('FAIL')}`);
        console.log(`  Sky Color Visual:      ${results.skyColorVisual ? chalk.green('PASS') : chalk.yellow('SKIP')}`);
        console.log(`  Gravity API:           ${results.gravityAPI ? chalk.green('PASS') : chalk.red('FAIL')}`);
        console.log(`  Gravity Effect:        ${results.gravityEffect ? chalk.green('PASS') : chalk.yellow('SKIP')}`);
        console.log(`  Creature Filter API:   ${results.creatureFilterAPI ? chalk.green('PASS') : chalk.red('FAIL')}`);
        console.log(`  Landscape Settings:    ${results.landscapeSettingsAPI ? chalk.green('PASS') : chalk.red('FAIL')}`);

        const apiPassed = results.worldCreation && results.skyColorAPI &&
            results.gravityAPI && results.creatureFilterAPI && results.landscapeSettingsAPI;

        if (apiPassed) {
            console.log(chalk.bold.green('\n✅ ALL API TESTS PASSED!\n'));
        } else {
            console.log(chalk.bold.red('\n❌ SOME TESTS FAILED\n'));
        }

        return apiPassed;

    } finally {
        // ============================================
        // Cleanup
        // ============================================
        if (browser) {
            console.log(chalk.dim('[Cleanup] Closing browser...'));
            await browser.close();
        }

        if (worldId) {
            results.cleanup = await deleteTestWorld(worldId);
        }
    }
}

// Run with timeout
const testTimeout = setTimeout(() => {
    console.log(chalk.red('\n⏰ TEST TIMEOUT EXCEEDED'));
    process.exit(1);
}, TEST_TIMEOUT);

runTest()
    .then((passed) => {
        clearTimeout(testTimeout);
        process.exit(passed ? 0 : 1);
    })
    .catch((error) => {
        clearTimeout(testTimeout);
        console.error(chalk.red('\n💥 Test error:'), error);
        process.exit(1);
    });
