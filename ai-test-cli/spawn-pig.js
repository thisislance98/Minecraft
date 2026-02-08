import puppeteer from 'puppeteer';

(async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--window-size=1400,900']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    console.log('Opening game...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });

    // Capture console messages (errors only)
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('[BROWSER ERROR]', msg.text());
        }
    });

    console.log('Waiting for SDK...');
    await page.waitForFunction(() => window.VoxelWorld && window.VoxelWorld.isInitialized, { timeout: 15000 });

    // Debug: check player position
    const playerInfo = await page.evaluate(() => {
        const player = VoxelWorld.localPlayer;
        return player ? {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z
        } : null;
    });
    console.log('Player position:', playerInfo);

    console.log('Creating and spawning SDK Pig...');
    const result = await page.evaluate(() => {
        const player = VoxelWorld.localPlayer;
        if (!player) return { error: 'No player found' };

        // Spawn 5 units in front of player, raised a bit
        const fwd = player.transform.forward;
        const spawnX = player.position.x + fwd.x * 5;
        const spawnY = player.position.y + 0.5;  // Raise so legs aren't in ground
        const spawnZ = player.position.z + fwd.z * 5;

        const skinColor = 0xF0ACBC;
        const hoofColor = 0x5C3A21;
        const blackColor = 0x000000;
        const whiteColor = 0xFFFFFF;

        // Create pig hierarchy
        const pig = VoxelWorld.createObject('SDKPig');

        // Body - this is the main mesh container
        const body = VoxelWorld.createObject('Body');
        body.attach('mesh', { meshType: 'box', size: [0.8, 0.7, 1.1], color: skinColor });
        body.transform.localPosition.set(0, 0.6, 0);
        body.transform.parent = pig.transform;

        // Head
        const head = VoxelWorld.createObject('Head');
        head.attach('mesh', { meshType: 'box', size: [0.6, 0.6, 0.6], color: skinColor });
        head.transform.localPosition.set(0, 0.3, 0.8);
        head.transform.parent = body.transform;

        // Snout
        const snout = VoxelWorld.createObject('Snout');
        snout.attach('mesh', { meshType: 'box', size: [0.3, 0.2, 0.1], color: skinColor });
        snout.transform.localPosition.set(0, -0.1, 0.35);
        snout.transform.parent = head.transform;

        // Nostrils
        const leftNostril = VoxelWorld.createObject('LeftNostril');
        leftNostril.attach('mesh', { meshType: 'box', size: [0.05, 0.05, 0.02], color: blackColor });
        leftNostril.transform.localPosition.set(-0.08, 0, 0.055);
        leftNostril.transform.parent = snout.transform;

        const rightNostril = VoxelWorld.createObject('RightNostril');
        rightNostril.attach('mesh', { meshType: 'box', size: [0.05, 0.05, 0.02], color: blackColor });
        rightNostril.transform.localPosition.set(0.08, 0, 0.055);
        rightNostril.transform.parent = snout.transform;

        // Ears
        const leftEar = VoxelWorld.createObject('LeftEar');
        leftEar.attach('mesh', { meshType: 'box', size: [0.2, 0.2, 0.05], color: skinColor });
        leftEar.transform.localPosition.set(-0.25, 0.25, 0.1);
        leftEar.transform.parent = head.transform;

        const rightEar = VoxelWorld.createObject('RightEar');
        rightEar.attach('mesh', { meshType: 'box', size: [0.2, 0.2, 0.05], color: skinColor });
        rightEar.transform.localPosition.set(0.25, 0.25, 0.1);
        rightEar.transform.parent = head.transform;

        // Eyes
        const leftEye = VoxelWorld.createObject('LeftEye');
        leftEye.attach('mesh', { meshType: 'box', size: [0.12, 0.12, 0.05], color: whiteColor });
        leftEye.transform.localPosition.set(-0.2, 0.1, 0.3);
        leftEye.transform.parent = head.transform;

        const leftPupil = VoxelWorld.createObject('LeftPupil');
        leftPupil.attach('mesh', { meshType: 'box', size: [0.06, 0.06, 0.06], color: blackColor });
        leftPupil.transform.localPosition.set(0, 0, 0.03);
        leftPupil.transform.parent = leftEye.transform;

        const rightEye = VoxelWorld.createObject('RightEye');
        rightEye.attach('mesh', { meshType: 'box', size: [0.12, 0.12, 0.05], color: whiteColor });
        rightEye.transform.localPosition.set(0.2, 0.1, 0.3);
        rightEye.transform.parent = head.transform;

        const rightPupil = VoxelWorld.createObject('RightPupil');
        rightPupil.attach('mesh', { meshType: 'box', size: [0.06, 0.06, 0.06], color: blackColor });
        rightPupil.transform.localPosition.set(0, 0, 0.03);
        rightPupil.transform.parent = rightEye.transform;

        // Tail
        const tailBase = VoxelWorld.createObject('TailBase');
        tailBase.attach('mesh', { meshType: 'box', size: [0.1, 0.1, 0.15], color: skinColor });
        tailBase.transform.localPosition.set(0, 0.2, -0.55);
        tailBase.transform.parent = body.transform;

        // Legs
        const legW = 0.25, legH = 0.3, hoofH = 0.1;
        function makeLeg(name, x, z) {
            const leg = VoxelWorld.createObject(name);
            leg.transform.localPosition.set(x, -0.2, z);
            leg.transform.parent = body.transform;

            const upper = VoxelWorld.createObject(name + 'Upper');
            upper.attach('mesh', { meshType: 'box', size: [legW, legH, legW], color: skinColor });
            upper.transform.localPosition.set(0, -legH/2, 0);
            upper.transform.parent = leg.transform;

            const hoof = VoxelWorld.createObject(name + 'Hoof');
            hoof.attach('mesh', { meshType: 'box', size: [legW, hoofH, legW], color: hoofColor });
            hoof.transform.localPosition.set(0, -legH - hoofH/2, 0);
            hoof.transform.parent = leg.transform;
            return leg;
        }

        makeLeg('FrontLeft', -0.25, 0.4);
        makeLeg('FrontRight', 0.25, 0.4);
        makeLeg('BackLeft', -0.25, -0.4);
        makeLeg('BackRight', 0.25, -0.4);

        // Animation
        pig.attach('animation', {
            animations: {
                walk: {
                    FrontLeft: { rotation: { x: [-20, 20] }, speed: 6 },
                    FrontRight: { rotation: { x: [20, -20] }, speed: 6 },
                    BackLeft: { rotation: { x: [20, -20] }, speed: 6 },
                    BackRight: { rotation: { x: [-20, 20] }, speed: 6 },
                    TailBase: { rotation: { y: [-15, 15] }, speed: 4 }
                }
            },
            defaultAnimation: 'walk'
        });

        // Physics - enables movement with gravity
        pig.attach('physics', {
            mode: 'walking',
            speed: 2,
            gravity: true
        });

        // AI - passive wandering behavior (flees from player)
        pig.attach('ai', {
            behavior: 'passive',
            wander: true,
            wanderRadius: 8,
            fleeRange: 4
        });

        // Register the pig type
        pig.register();

        // Spawn at calculated position
        const spawned = VoxelWorld.spawn('SDKPig', spawnX, spawnY, spawnZ);

        if (!spawned) {
            return { error: 'Spawn returned null' };
        }

        // Get scripts for verification
        const physicsScript = spawned.getScript('PhysicsScript');
        const aiScript = spawned.getScript('AIScript');

        return {
            success: true,
            spawnPosition: { x: spawnX.toFixed(2), y: spawnY.toFixed(2), z: spawnZ.toFixed(2) },
            hasPhysics: !!physicsScript,
            hasAI: !!aiScript
        };
    });

    console.log('\nResult:', JSON.stringify(result, null, 2));

    if (result.error) {
        console.log('\nERROR:', result.error);
    } else {
        console.log('\n=== Pig spawned! Look in front of your player. ===');
    }

    console.log('\nBrowser will stay open. Close it manually when done.');

    // Keep alive
    await new Promise(() => {});
})();
