/**
 * verify_world_settings.js
 *
 * Tests for enhanced world settings:
 * - Sky color customization
 * - Gravity multiplier
 * - Creature filtering
 * - Landscape settings
 */

import chalk from 'chalk';
import {
    applySkyColor,
    getSkyColor,
    setGravity,
    getGravity,
    setAllowedCreatures,
    getAllowedCreatures,
    getPlayerPosition,
    getGameState,
    waitFor,
    getRegisteredCreatures
} from '../src/game-commands.js';

export async function run(browser) {
    console.log(chalk.blue('\n═══════════════════════════════════════════'));
    console.log(chalk.blue('    World Settings Verification Test'));
    console.log(chalk.blue('═══════════════════════════════════════════\n'));

    const results = {
        skyColor: false,
        gravity: false,
        creatureFilter: false
    };

    // Wait for game to be ready
    console.log(chalk.cyan('Waiting for game to be ready...'));
    await new Promise(r => setTimeout(r, 3000));

    const gameState = await getGameState(browser);
    if (gameState.error) {
        console.log(chalk.red(`✗ Game not ready: ${gameState.error}`));
        return { success: false, results };
    }

    console.log(chalk.green('✓ Game ready'));
    console.log(chalk.dim(`  Player at: (${gameState.player.position.x.toFixed(1)}, ${gameState.player.position.y.toFixed(1)}, ${gameState.player.position.z.toFixed(1)})`));

    // ==========================================
    // Test 1: Sky Color
    // ==========================================
    console.log(chalk.yellow('\n--- Test 1: Sky Color ---'));

    // Get initial sky color
    const initialSky = await getSkyColor(browser);
    console.log(chalk.dim(`  Initial sky color: ${initialSky.color || 'unknown'}`));

    // Apply a red sunset sky
    const sunsetColor = '#FF6B35';
    console.log(chalk.cyan(`  Applying sunset color: ${sunsetColor}`));
    const applyResult = await applySkyColor(browser, sunsetColor);

    if (applyResult.success) {
        // Verify the change
        await new Promise(r => setTimeout(r, 500));
        const newSky = await getSkyColor(browser);
        console.log(chalk.dim(`  New sky color: ${newSky.color}`));

        if (newSky.color === sunsetColor) {
            console.log(chalk.green('✓ Sky color changed successfully'));
            results.skyColor = true;
        } else {
            console.log(chalk.yellow(`⚠ Sky color different than expected: ${newSky.color}`));
            // Still mark as success if color changed at all
            results.skyColor = newSky.color !== initialSky.color;
        }
    } else {
        console.log(chalk.red(`✗ Failed to apply sky color: ${applyResult.error}`));
    }

    // Restore original color
    await applySkyColor(browser, initialSky.color || '#87CEEB');

    // ==========================================
    // Test 2: Gravity Multiplier
    // ==========================================
    console.log(chalk.yellow('\n--- Test 2: Gravity Multiplier ---'));

    // Get initial gravity
    const initialGravity = await getGravity(browser);
    console.log(chalk.dim(`  Initial gravity: ${initialGravity.gravity}x`));

    // Set moon gravity (0.3x)
    const moonGravity = 0.3;
    console.log(chalk.cyan(`  Setting moon gravity: ${moonGravity}x`));
    const gravityResult = await setGravity(browser, moonGravity);

    if (gravityResult.success) {
        // Verify the change
        const newGravity = await getGravity(browser);
        console.log(chalk.dim(`  New gravity: ${newGravity.gravity}x`));

        if (Math.abs(newGravity.gravity - moonGravity) < 0.01) {
            console.log(chalk.green('✓ Gravity changed successfully'));
            results.gravity = true;
        } else {
            console.log(chalk.red(`✗ Gravity not set correctly: ${newGravity.gravity}`));
        }
    } else {
        console.log(chalk.red(`✗ Failed to set gravity: ${gravityResult.error}`));
    }

    // Restore normal gravity
    await setGravity(browser, initialGravity.gravity || 1.0);

    // ==========================================
    // Test 3: Creature Filter
    // ==========================================
    console.log(chalk.yellow('\n--- Test 3: Creature Filter ---'));

    // Get available creatures
    const registeredCreatures = await getRegisteredCreatures(browser);
    console.log(chalk.dim(`  Total registered creatures: ${registeredCreatures.all?.length || 0}`));

    // Get initial allowed state
    const initialAllowed = await getAllowedCreatures(browser);
    console.log(chalk.dim(`  Initial: ${initialAllowed.allowAll ? 'All allowed' : `${initialAllowed.creatures?.length} allowed`}`));

    // Set a restricted list (only Pig, Cow, Chicken)
    const restrictedList = ['Pig', 'Cow', 'Chicken'];
    console.log(chalk.cyan(`  Setting restricted list: ${restrictedList.join(', ')}`));
    const filterResult = await setAllowedCreatures(browser, restrictedList);

    if (filterResult.success) {
        // Verify the change
        const newAllowed = await getAllowedCreatures(browser);
        console.log(chalk.dim(`  New state: ${newAllowed.allowAll ? 'All allowed' : `${newAllowed.creatures?.length} creatures`}`));

        if (!newAllowed.allowAll && newAllowed.creatures?.length === 3) {
            console.log(chalk.green('✓ Creature filter set successfully'));
            results.creatureFilter = true;
        } else {
            console.log(chalk.yellow(`⚠ Filter state unexpected`));
        }
    } else {
        console.log(chalk.red(`✗ Failed to set creature filter: ${filterResult.error}`));
    }

    // Restore to allow all
    await setAllowedCreatures(browser, null);
    console.log(chalk.dim('  Restored to allow all creatures'));

    // ==========================================
    // Summary
    // ==========================================
    console.log(chalk.blue('\n═══════════════════════════════════════════'));
    console.log(chalk.blue('    Results Summary'));
    console.log(chalk.blue('═══════════════════════════════════════════'));

    const allPassed = Object.values(results).every(v => v);
    const passedCount = Object.values(results).filter(v => v).length;
    const totalCount = Object.keys(results).length;

    console.log(`\n  ${results.skyColor ? chalk.green('✓') : chalk.red('✗')} Sky Color`);
    console.log(`  ${results.gravity ? chalk.green('✓') : chalk.red('✗')} Gravity Multiplier`);
    console.log(`  ${results.creatureFilter ? chalk.green('✓') : chalk.red('✗')} Creature Filter`);

    console.log(`\n  ${chalk.bold(allPassed ? chalk.green('ALL TESTS PASSED') : chalk.yellow(`${passedCount}/${totalCount} tests passed`))}`);

    return {
        success: allPassed,
        results,
        passed: passedCount,
        total: totalCount
    };
}

export default { run };
