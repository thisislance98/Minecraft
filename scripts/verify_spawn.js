
import { GameBrowser } from '../ai-test-cli/src/browser.js';
import * as gc from '../ai-test-cli/src/game-commands.js';

async function test() {
    console.log('Launching game...');
    const gb = new GameBrowser({ headless: false });
    await gb.launch();
    const page = gb.page;

    console.log('Waiting for load...');
    await new Promise(r => setTimeout(r, 5000));

    // Ensure game is loaded
    await page.evaluate(() => {
        if (!window.__VOXEL_GAME__) throw new Error('Game not loaded');
    });

    console.log('Spawning Wolf manually...');
    const res1 = await gc.spawnCreature(page, 'Wolf');
    console.log('Spawn Result 1:', res1);

    await new Promise(r => setTimeout(r, 2000));

    console.log('Checking Entities...');
    const entities = await gc.getEntities(page);
    console.log('Entities:', JSON.stringify(entities, null, 2));

    if (entities.entities && entities.entities.some(e => e.type === 'Wolf')) {
        console.log('✅ PASS: Wolf found.');
    } else {
        console.log('❌ FAIL: No Wolf found.');
    }

    await gb.browser.close();
}

test().catch(console.error);
