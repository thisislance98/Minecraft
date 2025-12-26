
import puppeteer from 'puppeteer';

async function launchSession() {
    console.log('🚀 Launching Real Multiplayer Session (Host + Guest)...');

    // Launch a visible browser
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null, // Fullbed
        args: ['--start-maximized', '--window-size=1600,900']
    });

    try {
        // --- 1. Host Page ---
        console.log('1️⃣  Starting HOST...');
        const pages = await browser.pages();
        const hostPage = pages[0] || await browser.newPage();

        // Log console messages to terminal
        hostPage.on('console', msg => {
            const text = msg.text();
            if (text.includes('[Colyseus]')) console.log(`[HOST] ${text}`);
            if (text.includes('[Game]')) console.log(`[HOST] ${text}`);
        });

        await hostPage.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 60000 });

        console.log('⏳ Waiting for Host to create room...');

        // Wait for room ID to be available in the game instance
        const roomId = await hostPage.waitForFunction(() => {
            return window.game?.networkManager?.room?.roomId;
        }, { timeout: 30000 }).then(handle => handle.jsonValue());

        console.log(`✅ Host Created Room: ${roomId}`);

        // --- 2. Guest Page ---
        console.log(`\n2️⃣  Starting GUEST (Joining ${roomId})...`);
        const guestPage = await browser.newPage();

        guestPage.on('console', msg => {
            const text = msg.text();
            if (text.includes('[Colyseus]')) console.log(`[GUEST] ${text}`);
            if (text.includes('[Game]')) console.log(`[GUEST] ${text}`);
        });

        const joinUrl = `http://localhost:3000/?room=${roomId}`;
        console.log(`🔗 Guest joining: ${joinUrl}`);

        await guestPage.goto(joinUrl);

        console.log('⏳ Waiting 5s for connection and world load...');
        await new Promise(r => setTimeout(r, 5000));

        console.log('📸 Taking screenshots...');
        await hostPage.screenshot({ path: 'host_view.png' });
        await guestPage.screenshot({ path: 'guest_view.png' });
        console.log('✅ Screenshots saved: host_view.png, guest_view.png');

        console.log('\n🟢 Session Running. Close the browser windows to stop.');

        // Keep script running
        await new Promise(() => { });

    } catch (e) {
        console.error('❌ Error:', e);
        // Only close if error, otherwise keep open
        if (e.message.includes('timeout')) {
            await browser.close();
        }
    }
}

launchSession();
