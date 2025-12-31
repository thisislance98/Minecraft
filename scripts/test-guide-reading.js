
import puppeteer from 'puppeteer';

async function testGuideReading() {
    console.log('🚀 Launching Guide Reading Test...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Capture console logs from browser
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[CHAT')) {
                console.log(`[BROWSER] ${text}`);
            }
        });

        console.log('🔗 Navigating to game...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 60000 });

        console.log('⏳ Waiting for game initialization...');
        await page.waitForFunction(() => window.__VOXEL_GAME__ && window.__VOXEL_GAME__.agent, { timeout: 10000 });

        // Helper to wait
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        await wait(2000);

        // Send prompt that requires reading a guide
        console.log('💬 Sending prompt: "Create a new creature called Dragon..."');
        await page.evaluate(() => {
            window.__VOXEL_GAME__.agent.sendTextMessage("I want to create a new creature called a Dragon. It should breathe fire.");
        });

        // Wait for response (long timeout for thinking + reading + responding)
        await wait(15000); // Give it time to read the file and verify

        // We can't easily assert on server logs here, but we can see if the AI acknowledges the guide in the chat output
        // or effectively we manually check server logs after this runs.

        console.log('✅ Test finished (check server logs for view_file call)');

    } catch (error) {
        console.error('❌ TEST FAILED', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

testGuideReading();
