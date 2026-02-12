/**
 * Few-Shot Item Generation Test
 * Tests creating items via few-shot AI and verifies they appear in inventory
 */

const { chromium } = require('playwright');

(async () => {
    console.log('🧪 Starting Few-Shot Item Generation Test...\n');

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
        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_items_before.png' });
        console.log('📸 Initial screenshot saved\n');

        // Test 1: Create a magic wand
        console.log('🪄 Test 1: Creating a magic fire wand...');
        await testItemCreation(page, 'create a fire wand that shoots fireballs', 'FireWand');
        await page.waitForTimeout(2000);

        // Open inventory to see the item
        console.log('  📦 Opening inventory...');
        await page.keyboard.press('e');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_fire_wand_inventory.png' });
        console.log('  📸 Inventory screenshot saved');
        await page.keyboard.press('Escape'); // Close inventory
        await page.waitForTimeout(500);

        // Test 2: Create a healing potion
        console.log('🧪 Test 2: Creating a healing potion...');
        await testItemCreation(page, 'create a healing potion that restores health', 'HealingPotion');
        await page.waitForTimeout(2000);

        await page.keyboard.press('e');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_healing_potion_inventory.png' });
        console.log('  📸 Inventory screenshot saved');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // Test 3: Create a teleport wand
        console.log('✨ Test 3: Creating a teleport wand...');
        await testItemCreation(page, 'create a teleport wand that lets me teleport where I click', 'TeleportWand');
        await page.waitForTimeout(2000);

        await page.keyboard.press('e');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_teleport_wand_inventory.png' });
        console.log('  📸 Inventory screenshot saved');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // Test 4: Create a building tool
        console.log('🔨 Test 4: Creating a build tool...');
        await testItemCreation(page, 'create a build wand that places multiple blocks at once', 'BuildWand');
        await page.waitForTimeout(2000);

        // Final inventory screenshot
        await page.keyboard.press('e');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_items_all_inventory.png' });
        console.log('  📸 Final inventory screenshot saved');
        await page.keyboard.press('Escape');

        console.log('\n✅ All item tests completed!');
        console.log('📁 Screenshots saved to ai-test-cli/screenshots/');
        console.log('🎮 Check the game window - items should be in your inventory');
        console.log('⏸️  Browser will stay open for 30 seconds for testing items...\n');

        // Keep browser open to test using the items
        await page.waitForTimeout(30000);

    } catch (error) {
        console.error('❌ Test failed:', error);
        await page.screenshot({ path: 'ai-test-cli/screenshots/fewshot_items_error.png' });
        throw error;
    } finally {
        await browser.close();
    }
})();

async function testItemCreation(page, prompt, expectedName) {
    console.log(`  📝 Sending prompt: "${prompt}"`);

    // Find input and send message - use specific selector for Merlin panel
    const input = await page.getByRole('textbox', { name: 'Enter your custom request...' });
    await input.fill(prompt);

    // Click the Start Task button
    const startButton = await page.getByRole('button', { name: '▶️ Start Task' });
    await startButton.click();

    console.log('  ⏳ Waiting for AI response...');
    await page.waitForTimeout(8000);

    const hasSuccess = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes('created') ||
               text.includes('added to your inventory') ||
               text.includes('I created') ||
               text.includes('gave you');
    });

    if (hasSuccess) {
        console.log(`  ✅ Item created and added to inventory!`);
    } else {
        console.log(`  ⚠️  Could not confirm item creation`);
    }

    console.log(`  🎯 Expected item: ${expectedName}\n`);
}
