import puppeteer from 'puppeteer';

(async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    page.on('error', err => console.log('ERROR:', err.toString()));
    // page.on('requestfailed', request => {
    //   console.log(`REQUEST FAILED: ${request.url()} - ${request.failure().errorText}`);
    // });

    console.log('Navigating to http://localhost:3000...');
    try {
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 10000 });
        console.log('Navigation complete.');
    } catch (e) {
        console.log('Navigation timeout or error:', e.message);
    }

    // Wait for game to initialize
    await new Promise(r => setTimeout(r, 4000));

    // Evaluate game state
    try {
        const gameState = await page.evaluate(() => {
            const game = window.game; // Assuming game is attached to window from previous main.js inspection or we might need to find it.
            // main.js defines `const game = new VoxelGame();` but doesn't explicitly attach it to window. 
            // However, `AntigravityClient` logic usually does `window.game = game;` or similar?
            // Let's check if we can reach it. 
            // If not, we rely on logs.
            if (window.game) {
                return {
                    playerPos: window.game.player ? window.game.player.position : 'no player',
                    sceneChildren: window.game.scene ? window.game.scene.children.length : 'no scene',
                    chunkCount: window.game.chunks ? window.game.chunks.size : 'no chunks',
                    isPaused: window.game.isPaused
                };
            }
            return 'window.game not found';
        });
        console.log('GAME STATE:', gameState);
    } catch (e) {
        console.log('Error evaluating game state:', e);
    }

    await browser.close();
})();
