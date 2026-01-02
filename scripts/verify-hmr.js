
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_FILE = path.resolve(__dirname, '../server/services/AntigravitySession.ts');

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
    console.log('[Verify] Starting HMR Isolation Test...');
    console.log('[Verify] connecting to http://localhost:3000');

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // 1. Navigate to app
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        console.log('[Verify] Page loaded.');

        // 2. Set persistence marker
        await page.evaluate(() => {
            window.TEST_PERSISTENCE_MARKER = 'I_AM_STILL_HERE';
            console.log('Marked window with persistence marker');
        });

        // 3. Verify marker exists
        const markerInitial = await page.evaluate(() => window.TEST_PERSISTENCE_MARKER);
        if (markerInitial !== 'I_AM_STILL_HERE') {
            throw new Error('Failed to set persistence marker on page.');
        }

        // 4. Modify Server File
        console.log('[Verify] Modifying server file to trigger backend restart...');
        const originalContent = fs.readFileSync(SERVER_FILE, 'utf8');
        const timestamp = Date.now();
        const modifiedContent = originalContent + `\n// TEST_HMR_${timestamp}`;
        fs.writeFileSync(SERVER_FILE, modifiedContent);

        console.log('[Verify] Accessing file modified. Waiting 5 seconds for potential reload...');
        await wait(5000);

        // 5. Check persistence
        console.log('[Verify] Checking if page reloaded...');
        const markerAfter = await page.evaluate(() => window.TEST_PERSISTENCE_MARKER);

        // Cleanup file immediately
        fs.writeFileSync(SERVER_FILE, originalContent);
        console.log('[Verify] Reverted server file.');

        if (markerAfter === 'I_AM_STILL_HERE') {
            console.log('✅ SUCCESS: Page state preserved! Frontend did NOT reload.');
        } else {
            console.error('❌ FAILURE: Page state lost. Frontend REloaded.');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ ERROR:', error);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
})();
