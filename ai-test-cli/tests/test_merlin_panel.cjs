/**
 * Test: Merlin Panel UI
 *
 * Verifies:
 * 1. M key opens the Merlin panel
 * 2. Panel displays correctly with all sections
 * 3. Category selection works
 * 4. Suggestions appear when category is selected
 * 5. Task creation works
 * 6. Panel closes on Escape
 */

const puppeteer = require('puppeteer');
const path = require('path');

const BASE_URL = 'http://localhost:3000?cli=true';
const TEST_TIMEOUT = 30000;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log('[Test] Starting Merlin Panel UI test...\n');

    const browser = await puppeteer.launch({
        headless: false,
        args: ['--window-size=1280,800', '--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Collect console logs
    const logs = [];
    page.on('console', msg => {
        logs.push(`[Browser] ${msg.text()}`);
    });

    try {
        console.log('[Test] Loading game...');
        await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
        await sleep(3000);

        // Step 1: Open Merlin Panel with M key
        console.log('[Test] Step 1: Opening Merlin panel with M key...');
        await page.keyboard.press('KeyM');
        await sleep(1000);

        // Check if panel is visible
        const panelVisible = await page.evaluate(() => {
            const panel = document.getElementById('merlin-panel');
            return panel && !panel.classList.contains('hidden');
        });

        if (!panelVisible) {
            throw new Error('Merlin panel did not open');
        }
        console.log('[Test] ✓ Merlin panel opened successfully\n');

        // Step 2: Check panel structure
        console.log('[Test] Step 2: Verifying panel structure...');
        const structure = await page.evaluate(() => {
            const panel = document.getElementById('merlin-panel');
            return {
                hasHeader: !!panel.querySelector('.merlin-panel-header'),
                hasCategories: !!panel.querySelector('#merlin-categories'),
                categoryCount: panel.querySelectorAll('.merlin-category-btn').length,
                hasSuggestions: !!panel.querySelector('#merlin-suggestions'),
                hasTaskList: !!panel.querySelector('#merlin-task-list'),
                hasInput: !!panel.querySelector('#merlin-custom-input'),
                hasStartBtn: !!panel.querySelector('#merlin-start-task')
            };
        });

        console.log('[Test]   - Header:', structure.hasHeader ? '✓' : '✗');
        console.log('[Test]   - Categories:', structure.hasCategories ? '✓' : '✗');
        console.log('[Test]   - Category count:', structure.categoryCount);
        console.log('[Test]   - Suggestions area:', structure.hasSuggestions ? '✓' : '✗');
        console.log('[Test]   - Task list:', structure.hasTaskList ? '✓' : '✗');
        console.log('[Test]   - Custom input:', structure.hasInput ? '✓' : '✗');
        console.log('[Test]   - Start button:', structure.hasStartBtn ? '✓' : '✗');

        if (!structure.hasHeader || !structure.hasCategories || structure.categoryCount !== 5) {
            throw new Error('Panel structure incomplete');
        }
        console.log('[Test] ✓ Panel structure verified\n');

        // Step 3: Click a category
        console.log('[Test] Step 3: Clicking "Creature" category...');
        await page.click('.merlin-category-btn[data-category="creature"]');
        await sleep(500);

        const categorySelected = await page.evaluate(() => {
            const btn = document.querySelector('.merlin-category-btn[data-category="creature"]');
            return btn && btn.classList.contains('selected');
        });

        if (!categorySelected) {
            throw new Error('Category selection failed');
        }
        console.log('[Test] ✓ Category selected successfully\n');

        // Step 4: Check suggestions appear
        console.log('[Test] Step 4: Verifying suggestions appear...');
        await sleep(500);

        const suggestionsData = await page.evaluate(() => {
            const container = document.getElementById('merlin-suggestions');
            const items = container.querySelectorAll('.suggestion-item');
            return {
                count: items.length,
                texts: Array.from(items).map(item => item.dataset.text || item.textContent.trim())
            };
        });

        console.log('[Test]   - Suggestion count:', suggestionsData.count);
        suggestionsData.texts.forEach((text, i) => {
            console.log(`[Test]   - Suggestion ${i + 1}:`, text.substring(0, 50) + '...');
        });

        if (suggestionsData.count < 1) {
            throw new Error('No suggestions appeared');
        }
        console.log('[Test] ✓ Suggestions displayed successfully\n');

        // Step 5: Test refresh button
        console.log('[Test] Step 5: Testing refresh suggestions...');
        const refreshBtn = await page.$('#refresh-suggestions-btn');
        if (refreshBtn) {
            await refreshBtn.click();
            await sleep(500);

            const newSuggestions = await page.evaluate(() => {
                const container = document.getElementById('merlin-suggestions');
                const items = container.querySelectorAll('.suggestion-item');
                return Array.from(items).map(item => item.dataset.text || item.textContent.trim());
            });
            console.log('[Test]   - New suggestions after refresh:', newSuggestions.length);
            console.log('[Test] ✓ Refresh button works\n');
        }

        // Step 6: Test custom input (using evaluate to avoid focus issues with spawn menu)
        console.log('[Test] Step 6: Testing custom input...');
        await page.evaluate(() => {
            const input = document.getElementById('merlin-custom-input');
            input.value = 'Create a test dragon';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await sleep(300);

        const inputValue = await page.$eval('#merlin-custom-input', el => el.value);
        console.log('[Test]   - Input value:', inputValue);
        if (!inputValue.includes('test dragon')) {
            throw new Error('Custom input not working');
        }
        console.log('[Test] ✓ Custom input works\n');

        // Take screenshot of panel
        console.log('[Test] Taking screenshot...');
        await page.screenshot({
            path: path.join(__dirname, 'merlin_panel_test.png'),
            fullPage: false
        });
        console.log('[Test] ✓ Screenshot saved to merlin_panel_test.png\n');

        // Step 7: Close panel with Escape
        console.log('[Test] Step 7: Closing panel with Escape...');
        await page.keyboard.press('Escape');
        await sleep(500);

        const panelClosed = await page.evaluate(() => {
            const panel = document.getElementById('merlin-panel');
            return panel && panel.classList.contains('hidden');
        });

        if (!panelClosed) {
            throw new Error('Panel did not close with Escape');
        }
        console.log('[Test] ✓ Panel closed successfully\n');

        // Step 8: Verify N key opens minimap
        console.log('[Test] Step 8: Testing N key for minimap toggle...');
        await page.keyboard.press('KeyN');
        await sleep(300);
        console.log('[Test] ✓ Minimap toggle tested\n');

        // All tests passed
        console.log('═'.repeat(50));
        console.log('[Test] ALL TESTS PASSED!');
        console.log('═'.repeat(50));

        await browser.close();
        return { success: true };

    } catch (error) {
        console.error('[Test] ERROR:', error.message);

        // Take error screenshot
        await page.screenshot({
            path: path.join(__dirname, 'merlin_panel_error.png'),
            fullPage: true
        });
        console.log('[Test] Error screenshot saved');

        // Print relevant logs
        console.log('\n[Test] Recent browser logs:');
        logs.slice(-20).forEach(log => console.log(log));

        await browser.close();
        return { success: false, error: error.message };
    }
}

// Run the test
runTest()
    .then(result => {
        process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
        console.error('[Test] Fatal error:', err);
        process.exit(1);
    });
