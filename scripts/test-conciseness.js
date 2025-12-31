
import puppeteer from 'puppeteer';

async function testConciseness() {
    console.log('🚀 Launching Conciseness Test...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        let aiResponseCount = 0;

        // Capture console logs
        page.on('console', msg => {
            const text = msg.text();

            // Log ALL chat related messages to see what's actually coming back
            if (text.includes('[CHAT')) {
                console.log(`[BROWSER] ${text}`);
            }
        });

        console.log('🔗 Navigating to game...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 60000 });

        console.log('⏳ Waiting for game initialization...');
        await page.waitForFunction(() => window.__VOXEL_GAME__ && window.__VOXEL_GAME__.agent, { timeout: 10000 });

        // Helper
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        await wait(3000);

        // Send a simple creation prompt
        const prompt = "Create a file called 'brief.txt' with content 'This should be a silent success'.";
        console.log(`💬 Sending prompt: "${prompt}"`);

        await page.evaluate((p) => {
            window.__VOXEL_GAME__.agent.sendTextMessage(p);
        }, prompt);

        // Wait to capture response
        console.log('⏳ Waiting for AI response...');
        await wait(15000);

        console.log('✅ Test finished. Review logs above. The AI response should be minimal or absent.');

    } catch (error) {
        console.error('❌ TEST FAILED', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

testConciseness();
