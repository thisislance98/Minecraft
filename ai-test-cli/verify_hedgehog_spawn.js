// Verify Hedgehog can be spawned in game
import puppeteer from 'puppeteer';

async function verifySpawn() {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    console.log('Loading game...');
    await page.goto('http://localhost:3000?cli=true', { waitUntil: 'domcontentloaded' });

    console.log('Waiting for game to initialize...');
    await page.waitForFunction(() => window.__VOXEL_GAME__ && window.AnimalClasses, { timeout: 30000 });

    // Test spawning a Hedgehog
    const result = await page.evaluate(() => {
        const game = window.__VOXEL_GAME__;
        const HedgehogClass = window.AnimalClasses['Hedgehog'];

        if (!HedgehogClass) {
            return { error: 'Hedgehog class not found' };
        }

        const countBefore = game.animals.length;

        // Spawn a Hedgehog
        const playerPos = game.player.position;
        try {
            const hedgehog = new HedgehogClass(game, playerPos.x + 3, playerPos.y, playerPos.z + 3, Math.random());
            game.animals.push(hedgehog);
            game.scene.add(hedgehog.mesh);

            const countAfter = game.animals.length;

            return {
                success: true,
                animalsBefore: countBefore,
                animalsAfter: countAfter,
                position: {
                    x: hedgehog.position.x.toFixed(1),
                    y: hedgehog.position.y.toFixed(1),
                    z: hedgehog.position.z.toFixed(1)
                },
                hasSpines: hedgehog.mesh.children.length > 10, // Hedgehog has many mesh children for spines
                meshChildren: hedgehog.mesh.children.length
            };
        } catch (e) {
            return { error: e.message };
        }
    });

    console.log('');
    console.log('=== HEDGEHOG SPAWN TEST ===');

    if (result.error) {
        console.log('❌ FAIL:', result.error);
        await browser.close();
        process.exit(1);
    }

    console.log('Spawn successful:', result.success ? '✅ YES' : '❌ NO');
    console.log('Animals before:', result.animalsBefore);
    console.log('Animals after:', result.animalsAfter);
    console.log('Position:', `(${result.position.x}, ${result.position.y}, ${result.position.z})`);
    console.log('Mesh children (spines+body):', result.meshChildren);
    console.log('Has complex geometry:', result.hasSpines ? '✅ YES' : '❌ NO');

    console.log('\n✅ SUCCESS: Hedgehog spawned correctly!');

    await browser.close();
    process.exit(0);
}

verifySpawn().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
