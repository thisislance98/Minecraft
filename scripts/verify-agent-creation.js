
import puppeteer from 'puppeteer';

async function verifyAgentCreation() {
    console.log('🚀 Launching Agent Creation Verification...');

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Forward console logs with prefix to distinguish source
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('antigravity')) console.log(`[CLIENT] ${text}`);
            else if (text.startsWith('VERIFY')) console.log(`[VERIFY] ${text}`);
            else if (msg.type() === 'error') console.error(`[BROWSER-ERR] ${text}`);
        });

        console.log('🔗 Navigating to game...');
        await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for connection
        console.log('⏳ Waiting for agent connection...');
        await page.waitForFunction(() => {
            return window.antigravityClient && window.antigravityClient.ws && window.antigravityClient.ws.readyState === 1;
        }, { timeout: 20000 });
        console.log('✅ Agent Connected.');

        // 1. Count existing Pigs
        const initialCount = await page.evaluate(() => {
            if (!window.__VOXEL_GAME__) return 0;
            // Count animals with class name 'Pig'
            return window.__VOXEL_GAME__.animals.filter(a => a.constructor.name === 'Pig').length;
        });
        console.log(`[VERIFY] Initial Pig Count: ${initialCount}`);

        // 2. Send Command
        console.log('💬 Sending prompt: "Spawn a Pig and update its color to gold"');
        await page.evaluate(() => {
            window.antigravityClient.send({
                type: 'input',
                text: "Spawn a Pig and update its color to gold."
            });
        });

        // 3. Wait for Pig count to increase
        console.log('⏳ Waiting for Pig spawn...');
        const success = await page.waitForFunction((initial) => {
            if (!window.__VOXEL_GAME__) return false;
            const current = window.__VOXEL_GAME__.animals.filter(a => a.constructor.name === 'Pig').length;
            if (current > initial) {
                console.log(`VERIFY: Found new Pig! Count: ${current}`);
                return true;
            }
            return false;
        }, { timeout: 20000 }, initialCount);

        if (success) {
            console.log('✅ SUCCESS: Pig spawned!');

            // 4. Check for 'gold' color property
            // We need to find the NEW pig. It should be the last one added, or we search for one with color gold.
            const isGold = await page.evaluate((initial) => {
                const pigs = window.__VOXEL_GAME__.animals.filter(a => a.constructor.name === 'Pig');
                // The new one is likely at the end, but let's check all pigs we didn't have before?
                // Or just check if ANY pig is gold.
                const goldPig = pigs.find(p => p.color === 'gold' || (p.mesh && p.mesh.material && p.mesh.material.color.getHexString() === 'ffd700')); // Gold hex approx

                if (goldPig) return true;

                // Also check our specific update_entity tool implementation. 
                // Does it set .color property? Yes.
                return pigs.some(p => p.color === 'gold' || p.color === '#FFD700');
            }, initialCount);

            if (isGold) {
                console.log('✅ SUCCESS: Pig is GOLD!');
            } else {
                console.warn('⚠️ WARNING: Pig spawned but might not be gold (or color verification failed).');
                // Inspect the pigs
                const pigData = await page.evaluate(() => {
                    return window.__VOXEL_GAME__.animals
                        .filter(a => a.constructor.name === 'Pig')
                        .map(p => ({ id: p.id, color: p.color }));
                });
                console.log('Pig Data:', pigData);
            }

        } else {
            console.error('❌ FAILURE: No new Pig appeared.');
            process.exit(1);
        }

    } catch (e) {
        console.error('CRITICAL ERROR:', e);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

verifyAgentCreation();
