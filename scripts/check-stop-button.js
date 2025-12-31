import puppeteer from 'puppeteer';

(async () => {
    // Connect to existing Chrome instance or launch new one if needed (using new for isolation)
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Log console output
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    try {
        console.log('Navigating to game...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

        // Wait for game to load
        await page.waitForSelector('#chat-panel', { timeout: 10000 });
        console.log('Chat panel loaded.');

        // Check for Stop Button
        const stopBtn = await page.$('#stop-generation-btn');
        const stopContainer = await page.$('#chat-stop-container');

        if (!stopBtn) {
            console.error('FAIL: Stop button not found!');
            process.exit(1);
        }
        console.log('PASS: Stop button found.');

        // Check if hidden by default
        const isVisible = await page.evaluate((el) => {
            return el.style.display !== 'none' && !el.classList.contains('hidden');
        }, stopContainer);

        if (isVisible) {
            // It might be hidden via class 'hidden' which often sets display: none
            const style = await page.evaluate((el) => window.getComputedStyle(el).display, stopContainer);
            if (style !== 'none') {
                console.error('FAIL: Stop button should be hidden by default! Display is ' + style);
                process.exit(1);
            }
        }
        console.log('PASS: Stop button is hidden by default.');

    } catch (e) {
        console.error('Test failed:', e);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
