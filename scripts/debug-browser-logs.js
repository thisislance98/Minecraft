
import puppeteer from 'puppeteer';

async function runDebug() {
    console.log('🚀 Starting Browser Debugger (Host + 2 Guests)...');

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });

    try {
        // --- 1. Host Page ---
        console.log('1️⃣  Launching Host...');
        const hostPage = await browser.newPage();
        hostPage.on('console', msg => console.log(`[HOST 🖥️] ${msg.text()}`));
        hostPage.on('pageerror', err => console.log(`[HOST 🔴] ERROR: ${err.message}`));

        await hostPage.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

        console.log('creating host room...');
        await new Promise(r => setTimeout(r, 5000)); // Wait for auto-host

        const roomId = await hostPage.evaluate(() => {
            return window.game?.networkManager?.room?.roomId;
        });

        if (!roomId) {
            console.error('❌ Could not get Room ID from Host! Aborting.');
            await browser.close();
            return;
        }

        console.log(`✅ Host Room ID: ${roomId}`);

        // --- 2. Guest 1 ---
        console.log(`\n2️⃣  Launching Guest 1 (joining ${roomId})...`);
        const guestPage = await browser.newPage();
        guestPage.on('console', msg => console.log(`[GUEST 1 👤] ${msg.text()}`));

        const joinUrl = `http://localhost:3000/?room=${roomId}`;
        await guestPage.goto(joinUrl);
        await new Promise(r => setTimeout(r, 8000));

        const guestRoomId = await guestPage.evaluate(() => window.game?.networkManager?.room?.roomId);
        if (guestRoomId === roomId) {
            console.log('✅ GUEST 1: Connected to correct room.');
        } else {
            console.log(`❌ GUEST 1: Room ID mismatch (${guestRoomId})`);
        }

        // --- 3. Guest 2 ---
        console.log(`\n3️⃣  Launching Guest 2 (joining ${roomId})...`);
        const guest2Page = await browser.newPage();
        guest2Page.on('console', msg => console.log(`[GUEST 2 👤] ${msg.text()}`));

        await guest2Page.goto(joinUrl);
        await new Promise(r => setTimeout(r, 8000));

        const guest2RoomId = await guest2Page.evaluate(() => window.game?.networkManager?.room?.roomId);
        if (guest2RoomId === roomId) {
            console.log('✅ GUEST 2: Connected to correct room.');
        } else {
            console.log(`❌ GUEST 2: Room ID mismatch (${guest2RoomId})`);
        }

        // --- Verify Player Counts ---
        console.log('\n📊 Verifying Player Counts...');

        const hostCount = await hostPage.evaluate(() => window.game?.networkManager?.room?.state?.players?.size);
        const guest1Count = await guestPage.evaluate(() => window.game?.networkManager?.room?.state?.players?.size);
        const guest2Count = await guest2Page.evaluate(() => window.game?.networkManager?.room?.state?.players?.size);

        console.log(`   Host sees: ${hostCount} players`);
        console.log(`   Guest 1 sees: ${guest1Count} players`);
        console.log(`   Guest 2 sees: ${guest2Count} players`);

        if (hostCount === 3 && guest1Count === 3 && guest2Count === 3) {
            console.log('\n✅ SUCCESS: All 3 clients connected and synchronized!');
        } else {
            console.log('\n⚠️ PARTIAL SUCCESS: Counts may not be fully synced yet.');
        }

    } catch (e) {
        console.error('CRITICAL ERROR:', e);
    } finally {
        await browser.close();
        console.log('\nDebug session finished.');
    }
}

runDebug();
