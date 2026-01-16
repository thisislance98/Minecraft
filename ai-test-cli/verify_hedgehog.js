// Verify Hedgehog creature appears in spawn panel
import puppeteer from 'puppeteer';

async function verify() {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    console.log('Loading game...');
    await page.goto('http://localhost:3000?cli=true', { waitUntil: 'domcontentloaded' });

    console.log('Waiting for game to initialize...');
    await page.waitForFunction(() => window.__VOXEL_GAME__ && window.AnimalClasses, { timeout: 30000 });

    const result = await page.evaluate(() => {
        const classes = Object.keys(window.AnimalClasses).sort();
        const hasHedgehog = classes.includes('Hedgehog');
        return {
            hasHedgehog,
            total: classes.length,
            nearby: classes.filter(c => c.startsWith('G') || c.startsWith('H') || c.startsWith('I'))
        };
    });

    console.log('');
    console.log('=== HEDGEHOG VERIFICATION ===');
    console.log('Hedgehog in AnimalClasses:', result.hasHedgehog ? '✅ YES' : '❌ NO');
    console.log('Total creatures registered:', result.total);
    console.log('G/H/I creatures:', result.nearby.join(', '));

    await browser.close();

    if (result.hasHedgehog) {
        console.log('\n✅ SUCCESS: Hedgehog appears in spawn panel!');
        process.exit(0);
    } else {
        console.log('\n❌ FAIL: Hedgehog not found in registry');
        process.exit(1);
    }
}

verify().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
