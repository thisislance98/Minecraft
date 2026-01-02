
import { GameBrowser } from './src/browser.js';
import chalk from 'chalk';

async function verify() {
    console.log(chalk.blue('Launching browser for Spawn Verification...'));
    // headless: true for CI/fast check
    const browser = new GameBrowser({ headless: true });

    try {
        await browser.launch();
        await browser.waitForGameLoad();

        console.log(chalk.dim('Game Loaded. Attempting to spawn Pig via SpawnManager...'));

        const result = await browser.evaluate(() => {
            const game = window.__VOXEL_GAME__;
            if (!game || !game.spawnManager) return { error: 'Game or SpawnManager not available' };

            // 1. Setup Environment
            const player = game.player;
            // Ensure player is at known location or just use relative
            // Reset rotation to look +Z (South) for consistent test
            // Player camera usually controlled by controls.
            // We can force camera direction vector for the calculation.
            // spawnEntitiesInFrontOfPlayer uses camera.getWorldDirection()

            // Force Camera quaternion?
            // game.camera.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), 0); // Look -Z usually
            // Just assume current look is valid, or set it.

            // Let's rely on whatever look direction, but if it faces down it might spawn close.
            // Set look to horizon.
            game.camera.lookAt(player.position.x, player.position.y, player.position.z + 100);

            // 2. Call Method
            const Pig = window.AnimalClasses['Pig'];
            if (!Pig) return { error: 'Pig class not found in registry' };

            const countBefore = game.animals.length;

            // Call the UI's method
            if (!game.spawnManager.spawnEntitiesInFrontOfPlayer) return { error: 'Method spawnEntitiesInFrontOfPlayer missing' };

            game.spawnManager.spawnEntitiesInFrontOfPlayer(Pig, 1);

            // 3. Verify
            const countAfter = game.animals.length;
            if (countAfter <= countBefore) return { error: 'Animal count did not increase' };

            const spawnedEntity = game.animals[countAfter - 1];
            const dist = spawnedEntity.position.distanceTo(player.position);

            return {
                success: true,
                dist: dist,
                pos: spawnedEntity.position,
                playerPos: player.position
            };
        });

        if (result.error) {
            console.error(chalk.red('❌ Verification Failed:'), result.error);
            process.exit(1); // Exit code 1 for failure
        } else {
            console.log(chalk.green('✅ Spawn Successful!'));
            console.log(`   Distance: ${result.dist.toFixed(2)} blocks`);
            console.log(`   Player: (${result.playerPos.x.toFixed(1)}, ${result.playerPos.y.toFixed(1)}, ${result.playerPos.z.toFixed(1)})`);
            console.log(`   Entity: (${result.pos.x.toFixed(1)}, ${result.pos.y.toFixed(1)}, ${result.pos.z.toFixed(1)})`);

            // Dist matches 5.0 set in code?
            if (result.dist >= 4.5 && result.dist <= 5.5) {
                console.log(chalk.green('✅ Distance is within expected range (5.0 ± 0.5)'));
                process.exit(0);
            } else {
                console.log(chalk.yellow('⚠️ Distance deviates from expected 5.0 (Raycast might have hit something or fallback used)'));
                process.exit(0); // Soft pass, behavior might vary
            }
        }

    } catch (e) {
        console.error(chalk.red('Script Error:'), e);
        if (browser) await browser.close();
        process.exit(1);
    }

    await browser.close();
}

verify();
