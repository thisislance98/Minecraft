/**
 * Test script for verifying the new debug commands work
 */
import { GameDriver } from '../src/driver.js';

async function testDebugCommands() {
    const driver = new GameDriver();

    console.log('🔧 Testing Debug Commands for AI Creature Creation');
    console.log('='.repeat(50));

    // Launch browser and wait for game
    console.log('\n1. Launching browser...');
    const browserResult = await driver.executeCommand({ tool: 'browser_launch', args: { headless: true } });
    console.log('Browser launched:', browserResult ? 'YES' : 'NO');

    // Wait for game and dynamic creatures to load
    console.log('\n2. Waiting for game to load...');
    await driver.executeCommand({ tool: 'wait', args: { ms: 5000 } });

    // Test debug_creatures command
    console.log('\n3. Testing debug_creatures command...');
    try {
        const creatureInfo = await driver.executeCommand({ tool: 'debug_creatures', args: {} });
        console.log('Dynamic Creatures Info:');
        console.log(JSON.stringify(creatureInfo, null, 2));
    } catch (e) {
        console.error('ERROR in debug_creatures:', e.message);
    }

    // Test creature_errors command
    console.log('\n4. Testing creature_errors command...');
    try {
        const errors = await driver.executeCommand({ tool: 'creature_errors', args: {} });
        console.log('Creature Errors:');
        console.log(JSON.stringify(errors, null, 2));
    } catch (e) {
        console.error('ERROR in creature_errors:', e.message);
    }

    // Test get_game_state to verify things are working
    console.log('\n5. Verifying game state...');
    const gameState = await driver.executeCommand({ tool: 'get_game_state', args: {} });
    console.log('Game loaded:', gameState?.ready ? 'YES' : 'NO');
    console.log('Player position:', gameState?.player?.position);

    // Cleanup
    console.log('\n6. Closing browser...');
    await driver.executeCommand({ tool: 'browser_close', args: {} });

    console.log('\n' + '='.repeat(50));
    console.log('✅ Debug commands test complete!');
}

testDebugCommands().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
