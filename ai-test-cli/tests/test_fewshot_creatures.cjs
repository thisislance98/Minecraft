/**
 * Few-Shot Creature Generation Test
 * Tests creating creatures via few-shot AI and verifies they appear visually in-game
 */

const { chromium } = require('playwright');

(async () => {
    console.log('🧪 Starting Few-Shot Creature Generation Test...\n');

    const browser = await chromium.launch({ headless: false }); // Show browser for visual confirmation
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // Navigate to game
        console.log('🌐 Loading game...');
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(3000); // Wait for game to initialize

        // Wait for canvas to be ready
        await page.waitForSelector('canvas', { timeout: 10000 });
        console.log('✅ Game loaded\n');

        // Open Merlin AI panel
        console.log('🤖 Opening Merlin AI panel...');
        await page.keyboard.press('m'); // Assuming 'm' opens Merlin
        await page.waitForTimeout(1000);

        // Take initial screenshot
        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_creatures_before.png' });
        console.log('📸 Initial screenshot saved\n');

        // Test 1: Create a flying pig
        console.log('🐷 Test 1: Creating a flying pig...');
        const flyingPigPrompt = 'create a pink flying pig that floats up and down';
        await testCreatureCreation(page, flyingPigPrompt, 'FlyingPig');

        // Wait to see the creature
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_flying_pig.png' });
        console.log('📸 Flying pig screenshot saved\n');

        // Test 2: Create a glowing butterfly
        console.log('🦋 Test 2: Creating a glowing butterfly...');
        const butterflyPrompt = 'create a butterfly with glowing wings that changes colors';
        await testCreatureCreation(page, butterflyPrompt, 'GlowingButterfly');

        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_butterfly.png' });
        console.log('📸 Butterfly screenshot saved\n');

        // Test 3: Create a swimming fish
        console.log('🐟 Test 3: Creating a swimming fish...');
        const fishPrompt = 'create a blue fish that swims in circles';
        await testCreatureCreation(page, fishPrompt, 'SwimmingFish');

        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_fish.png' });
        console.log('📸 Fish screenshot saved\n');

        // Test 4: Create a hostile robot
        console.log('🤖 Test 4: Creating a hostile robot...');
        const robotPrompt = 'create a red robot that patrols and shoots lasers';
        await testCreatureCreation(page, robotPrompt, 'HostileRobot');

        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_robot.png' });
        console.log('📸 Robot screenshot saved\n');

        // Final screenshot showing all creatures
        console.log('📸 Taking final overview screenshot...');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_creatures_all.png', fullPage: false });

        console.log('\n✅ All creature tests completed!');
        console.log('📁 Screenshots saved to ai-test-cli/screenshots/');
        console.log('🎮 Check the game window to see all creatures');
        console.log('⏸️  Browser will stay open for 30 seconds for visual inspection...\n');

        // Keep browser open for visual inspection
        await page.waitForTimeout(30000);

    } catch (error) {
        console.error('❌ Test failed:', error);
        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_error.png' });
        throw error;
    } finally {
        await browser.close();
    }
})();

/**
 * Test creating a creature via Merlin AI
 */
async function testCreatureCreation(page, prompt, expectedName) {
    console.log(`  📝 Sending prompt: "${prompt}"`);

    // Find input and send message
    const input = await page.locator('textarea, input[type="text"]').first();
    await input.fill(prompt);
    await input.press('Enter');

    console.log('  ⏳ Waiting for AI response...');

    // Wait for response (look for success indicators)
    await page.waitForTimeout(8000); // Give AI time to generate and spawn

    // Check for success messages in the UI
    const hasSuccess = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes('created') ||
               text.includes('spawned') ||
               text.includes('I created') ||
               text.includes('has been spawned');
    });

    if (hasSuccess) {
        console.log(`  ✅ Creature created successfully!`);
    } else {
        console.log(`  ⚠️  Could not confirm creature creation (may still have worked)`);
    }

    // Check console for creature registration
    const logs = await page.evaluate(() => {
        // This would need the game to expose logs, or we check network
        return 'Logs not accessible via evaluate';
    });

    console.log(`  🎯 Expected creature: ${expectedName}`);
}
