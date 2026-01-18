/**
 * Test to verify life icons are NOT hearts
 */
import puppeteer from 'puppeteer';

async function verifyLifeIcons() {
    console.log('Starting life icons verification test...');

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Set up console logging
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`[Browser Error] ${msg.text()}`);
            }
        });

        console.log('Navigating to game...');
        await page.goto('http://localhost:3002', { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for game to load
        await page.waitForSelector('#health-hearts', { timeout: 10000 });

        // Wait a bit for the game to initialize and render health
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Get the health container content
        const healthContent = await page.evaluate(() => {
            const container = document.getElementById('health-hearts');
            return container ? container.innerHTML : null;
        });

        console.log('Health container content:', healthContent);

        if (!healthContent) {
            console.error('❌ FAIL: Could not find health-hearts container');
            process.exit(1);
        }

        // Check that we DON'T have heart emojis
        const hasHearts = healthContent.includes('❤️') ||
                          healthContent.includes('💔') ||
                          healthContent.includes('🖤') ||
                          healthContent.includes('❤') ||
                          healthContent.includes('♥');

        if (hasHearts) {
            console.error('❌ FAIL: Found heart icons in health display');
            console.log('Content:', healthContent);
            process.exit(1);
        }

        // Check that we have the new shield/skull icons
        const hasShields = healthContent.includes('🛡️');
        const hasSkulls = healthContent.includes('💀');
        const hasSwords = healthContent.includes('⚔️');

        console.log('Found shields:', hasShields);
        console.log('Found skulls:', hasSkulls);
        console.log('Found swords:', hasSwords);

        if (hasShields || hasSkulls || hasSwords) {
            console.log('✅ PASS: Life icons changed successfully - no hearts found, new icons present');
            process.exit(0);
        } else {
            console.error('❌ FAIL: New icons not found');
            console.log('Content:', healthContent);
            process.exit(1);
        }

    } catch (error) {
        console.error('Test error:', error);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

verifyLifeIcons();
