
import puppeteer from 'puppeteer';

const roomId = process.argv[2];

if (!roomId) {
    console.error('❌ Usage: node scripts/join-room.js <ROOM_ID>');
    process.exit(1);
}

async function startClient() {
    console.log(`🚀 Launching Game Client for Room: ${roomId}`);

    // Launch visible browser so you can see it (if supported), or use "new" for headless
    // Using false to let you see the window if running locally
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null, // Fullbed
        args: ['--window-size=1280,720']
    });

    try {
        const page = await browser.newPage();

        // Log console messages to terminal
        page.on('console', msg => console.log(`[CLIENT 👤] ${msg.text()}`));
        page.on('pageerror', err => console.log(`[CLIENT 🔴] ERROR: ${err.message}`));

        const joinUrl = `http://localhost:3000/?room=${roomId}`;
        console.log(`🔗 Navigating to: ${joinUrl}`);

        await page.goto(joinUrl);

        // Keep it open indefinitely
        console.log('✅ Client running. Press Ctrl+C to close.');

        // Wait forever (or until closed)
        await new Promise(() => { });

    } catch (e) {
        console.error('CRITICAL ERROR:', e);
        await browser.close();
    }
}

startClient();
