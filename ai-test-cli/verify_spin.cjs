const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({
            headless: false,
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        });
        const page = await browser.newPage();
        await page.goto('http://localhost:3000');

        console.log('Waiting for game...');
        await page.waitForFunction(() => window.__VOXEL_GAME__, { timeout: 20000 });
        console.log('Game loaded. Waiting for network...');
        await new Promise(r => setTimeout(r, 2000));

        const result = await page.evaluate(() => {
            const creatures = window.DynamicCreatures || {};

            // Check TrueSpinBlock
            const trueSpin = creatures['TrueSpinBlock'];
            let trueSpinData = 'Not Found';

            if (trueSpin) {
                trueSpinData = {
                    hasUpdateAI: trueSpin.code.includes('updateAI'),
                    // Check for proper usage: 'this.rotation +='
                    usesThisRotation: trueSpin.code.includes('this.rotation +='),
                    // Check for bad usage: 'this.mesh.rotation.y +='
                    usesMeshRotation: trueSpin.code.includes('this.mesh.rotation.y +='),
                    codeSnippet: trueSpin.code.slice(0, 500)
                };
            }

            // Check UltimateSpinBlock
            const ultSpin = creatures['UltimateSpinBlock'];
            let ultSpinData = 'Not Found';

            if (ultSpin) {
                ultSpinData = {
                    hasUpdateAI: ultSpin.code.includes('updateAI'),
                    // Check for proper usage: 'this.rotation +='
                    usesThisRotation: ultSpin.code.includes('this.rotation +='),
                    // Check for bad usage: 'this.mesh.rotation.y +='
                    usesMeshRotation: ultSpin.code.includes('this.mesh.rotation.y +='),
                    codeSnippet: ultSpin.code.slice(0, 500)
                };
            }

            return {
                creatures: Object.keys(creatures),
                TrueSpinBlock: trueSpinData,
                UltimateSpinBlock: ultSpinData
            };
        });

        console.log('Verification Result:', JSON.stringify(result, null, 2));
        await browser.close();
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
})();
