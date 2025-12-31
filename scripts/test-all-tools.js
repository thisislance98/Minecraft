
import puppeteer from 'puppeteer';

async function testAllTools() {
    console.log('🚀 Launching All Tools Test...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Capture console logs
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[CHAT') || text.includes('[SpawnManager]')) {
                console.log(`[BROWSER] ${text}`);
            }
        });

        console.log('🔗 Navigating to game...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 60000 });

        console.log('⏳ Waiting for game initialization...');
        await page.waitForFunction(() => window.__VOXEL_GAME__ && window.__VOXEL_GAME__.agent, { timeout: 10000 });

        // Helper
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        await wait(5000); // Increased initial wait

        const prompt = `
            Please list the files in the current directory (list_dir).
            Then create a file 'tool_test_simple.txt' with text 'Verified Simple' (write_to_file).
        `;

        console.log('💬 Sending simplified tool test prompt...');
        await page.evaluate((p) => {
            window.__VOXEL_GAME__.agent.sendTextMessage(p);
        }, prompt);

        // Wait for execution
        await wait(30000); // Increased execution wait

        console.log('✅ Test sequence completed. Check logs for tool execution details.');

    } catch (error) {
        console.error('❌ TEST FAILED', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

testAllTools();
