/**
 * Test script: Navigate to a world and create a creature using Merlin
 */

import { GameBrowser } from '../src/browser.js';
import * as GameCommands from '../src/game-commands.js';

async function main() {
    const browser = new GameBrowser({
        headless: false,
        gameUrl: 'http://localhost:3000'
    });

    try {
        console.log('=== Merlin Creature Creation Test ===\n');

        // Step 1: Launch browser
        console.log('1. Launching browser...');
        await browser.launch();
        await browser.waitForGameLoad();

        // Wait extra for full game init
        console.log('   Waiting for full game initialization...');
        await new Promise(r => setTimeout(r, 3000));

        // Step 2: Navigate to Test World 2
        const worldId = '3YAzzSoP5i'; // Test World 2
        console.log(`\n2. Navigating to world: ${worldId}...`);

        const navResult = await GameCommands.navigateToWorld(browser, worldId);
        console.log('   Navigation result:', JSON.stringify(navResult, null, 2));

        // Wait for world to load
        console.log('   Waiting for world to load...');
        await new Promise(r => setTimeout(r, 5000));

        // Check world join status
        const worldInfo = await GameCommands.getCurrentWorld(browser);
        console.log('   Current world info:', JSON.stringify(worldInfo, null, 2));

        // Step 3: Get player position
        const pos = await GameCommands.getPlayerPosition(browser);
        console.log(`\n3. Player position: x=${pos?.x?.toFixed(1)}, y=${pos?.y?.toFixed(1)}, z=${pos?.z?.toFixed(1)}`);

        // Step 4: Send prompt to Merlin to create a creature
        console.log('\n4. Sending prompt to Merlin to create a creature...');
        const prompt = 'Create a FlamingEagle creature that flies and has glowing fire particles';

        await browser.sendPrompt(prompt);
        console.log(`   Prompt sent: "${prompt}"`);

        // Step 5: Wait for AI to process
        console.log('\n5. Waiting for Merlin to generate the creature (30 seconds)...');
        await new Promise(r => setTimeout(r, 30000));

        // Step 6: Check for new creatures
        console.log('\n6. Checking game state for new creatures...');
        const gameState = await GameCommands.getGameState(browser);
        console.log('   Game state:', JSON.stringify(gameState, null, 2));

        const dynamicCreatures = await GameCommands.getDynamicCreatureInfo(browser);
        console.log('   Dynamic creatures:', JSON.stringify(dynamicCreatures, null, 2));

        const worldCreatures = await GameCommands.getWorldCreatures(browser);
        console.log('   World creatures:', JSON.stringify(worldCreatures, null, 2));

        const entities = await GameCommands.getEntities(browser);
        console.log('   Entities in scene:', JSON.stringify(entities.byType, null, 2));

        // Take a screenshot
        console.log('\n7. Taking screenshot...');
        await browser.screenshot('/Users/I850333/projects/experiments/Minecraft/ai-test-cli/tests/merlin_creature_test.png');

        console.log('\n=== Test Complete ===');
        console.log('Check the browser window to see the result.');
        console.log('Press Ctrl+C to exit and close browser.\n');

        // Keep browser open for inspection
        await new Promise(r => setTimeout(r, 60000));

    } catch (error) {
        console.error('\nError:', error.message);
        console.error(error.stack);
    } finally {
        await browser.close();
    }
}

main().catch(console.error);
