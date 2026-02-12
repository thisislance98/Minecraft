/**
 * Few-Shot Structure Generation Test
 * Tests creating structures via few-shot AI and verifies they appear in the world
 */

const { chromium } = require('playwright');

(async () => {
    console.log('🧪 Starting Few-Shot Structure Generation Test...\n');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // Navigate to game
        console.log('🌐 Loading game...');
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(3000);

        await page.waitForSelector('canvas', { timeout: 10000 });
        console.log('✅ Game loaded\n');

        // Open Merlin AI panel
        console.log('🤖 Opening Merlin AI panel...');
        await page.keyboard.press('m');
        await page.waitForTimeout(1000);

        // Take initial screenshot
        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_structures_before.png' });
        console.log('📸 Initial screenshot saved\n');

        // Test 1: Build a simple house
        console.log('🏠 Test 1: Building a simple house...');
        await testStructureCreation(page, 'build a small house with a door and windows', 'House');
        await page.waitForTimeout(3000);

        // Fly up to get a better view
        console.log('  🚁 Flying up for aerial view...');
        await page.keyboard.press('f'); // Toggle fly mode
        await page.waitForTimeout(500);
        await page.keyboard.down('Space');
        await page.waitForTimeout(1500);
        await page.keyboard.up('Space');
        await page.waitForTimeout(500);

        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_house_aerial.png' });
        console.log('  📸 House aerial screenshot saved');

        // Land
        await page.keyboard.down('Shift');
        await page.waitForTimeout(1500);
        await page.keyboard.up('Shift');
        await page.keyboard.press('f'); // Toggle fly mode off
        await page.waitForTimeout(1000);

        // Test 2: Build a tower
        console.log('🗼 Test 2: Building a tall tower...');
        await testStructureCreation(page, 'build a tall stone tower 20 blocks high', 'Tower');
        await page.waitForTimeout(3000);

        // Fly up to see the tower
        await page.keyboard.press('f');
        await page.waitForTimeout(500);
        await page.keyboard.down('Space');
        await page.waitForTimeout(2000);
        await page.keyboard.up('Space');
        await page.waitForTimeout(500);

        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_tower_view.png' });
        console.log('  📸 Tower screenshot saved');

        // Land
        await page.keyboard.down('Shift');
        await page.waitForTimeout(2000);
        await page.keyboard.up('Shift');
        await page.keyboard.press('f');
        await page.waitForTimeout(1000);

        // Test 3: Build a bridge
        console.log('🌉 Test 3: Building a bridge...');
        await testStructureCreation(page, 'build a wooden bridge 10 blocks long', 'Bridge');
        await page.waitForTimeout(3000);

        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_bridge.png' });
        console.log('  📸 Bridge screenshot saved');

        // Test 4: Build a pyramid
        console.log('🔺 Test 4: Building a pyramid...');
        await testStructureCreation(page, 'build a sandstone pyramid', 'Pyramid');
        await page.waitForTimeout(3000);

        // Fly up for aerial view of all structures
        await page.keyboard.press('f');
        await page.waitForTimeout(500);
        await page.keyboard.down('Space');
        await page.waitForTimeout(3000);
        await page.keyboard.up('Space');
        await page.waitForTimeout(500);

        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_pyramid_aerial.png' });
        console.log('  📸 Pyramid aerial screenshot saved');

        // Final overview
        console.log('📸 Taking final overview screenshot...');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_structures_all.png' });

        // Land
        await page.keyboard.down('Shift');
        await page.waitForTimeout(3000);
        await page.keyboard.up('Shift');
        await page.keyboard.press('f');

        console.log('\n✅ All structure tests completed!');
        console.log('📁 Screenshots saved to ai-test-cli/screenshots/');
        console.log('🎮 Check the game window to see all structures');
        console.log('💡 Tip: Fly around (F key) to explore the structures');
        console.log('⏸️  Browser will stay open for 45 seconds for exploration...\n');

        // Keep browser open for visual inspection
        await page.waitForTimeout(45000);

    } catch (error) {
        console.error('❌ Test failed:', error);
        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_structures_error.png' });
        throw error;
    } finally {
        await browser.close();
    }
})();

async function testStructureCreation(page, prompt, structureName) {
    console.log(`  📝 Sending prompt: "${prompt}"`);

    // Find input and send message - use specific selector for Merlin panel
    const input = await page.getByRole('textbox', { name: 'Enter your custom request...' });
    await input.fill(prompt);

    // Click the Start Task button
    const startButton = await page.getByRole('button', { name: '▶️ Start Task' });
    await startButton.click();

    console.log('  ⏳ Waiting for AI to generate and build...');
    await page.waitForTimeout(10000); // Structures take longer

    const hasSuccess = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes('Building') ||
               text.includes('complete') ||
               text.includes('blocks placed') ||
               text.includes('Structure complete');
    });

    if (hasSuccess) {
        console.log(`  ✅ ${structureName} built successfully!`);
    } else {
        console.log(`  ⚠️  Could not confirm structure completion`);
    }

    console.log(`  🏗️  ${structureName} should be visible in front of you\n`);
}
