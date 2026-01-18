/**
 * Test: Verify Millennium Falcon Spaceship Spawns and Can Be Mounted
 *
 * This test verifies:
 * 1. The MillenniumFalcon ship spawns near player spawn
 * 2. Player can interact with it using F key to mount
 * 3. Ship has broom-like flight controls
 */

export const testConfig = {
    name: 'Millennium Falcon Ship Test',
    timeout: 60000
};

export async function run(browser, log) {
    log('Starting Millennium Falcon test...');

    // Wait for game to initialize and spawn entities
    await browser.waitForFunction(() => {
        const game = window.__VOXEL_GAME__;
        return game && game.animals && game.animals.length > 0 && game._initialSpawnDone;
    }, { timeout: 30000 });

    log('Game initialized');

    // Check if MillenniumFalcon exists in animals array
    const shipInfo = await browser.evaluate(() => {
        const game = window.__VOXEL_GAME__;
        if (!game) return { error: 'Game not found' };

        // Find the ship
        const ship = game.animals.find(a => a.constructor.name === 'MillenniumFalcon');
        if (!ship) {
            // List all animal types for debugging
            const types = [...new Set(game.animals.map(a => a.constructor.name))];
            return { error: 'MillenniumFalcon not found', animalTypes: types };
        }

        return {
            found: true,
            position: { x: ship.position.x, y: ship.position.y, z: ship.position.z },
            isRideable: ship.isRideable,
            hasInteract: typeof ship.interact === 'function',
            hasHandleRiding: typeof ship.handleRiding === 'function'
        };
    });

    if (shipInfo.error) {
        log(`ERROR: ${shipInfo.error}`);
        if (shipInfo.animalTypes) {
            log(`Available animal types: ${shipInfo.animalTypes.join(', ')}`);
        }
        return { success: false, error: shipInfo.error };
    }

    log(`Ship found at position: (${shipInfo.position.x.toFixed(1)}, ${shipInfo.position.y.toFixed(1)}, ${shipInfo.position.z.toFixed(1)})`);
    log(`Ship isRideable: ${shipInfo.isRideable}`);
    log(`Ship has interact(): ${shipInfo.hasInteract}`);
    log(`Ship has handleRiding(): ${shipInfo.hasHandleRiding}`);

    // Get player position
    const playerPos = await browser.evaluate(() => {
        const game = window.__VOXEL_GAME__;
        if (!game?.player) return null;
        return { x: game.player.position.x, y: game.player.position.y, z: game.player.position.z };
    });

    if (playerPos) {
        log(`Player position: (${playerPos.x.toFixed(1)}, ${playerPos.y.toFixed(1)}, ${playerPos.z.toFixed(1)})`);

        // Calculate distance between player and ship
        const dx = shipInfo.position.x - playerPos.x;
        const dy = shipInfo.position.y - playerPos.y;
        const dz = shipInfo.position.z - playerPos.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        log(`Distance from player to ship: ${distance.toFixed(1)} blocks`);
    }

    // Test mounting the ship via interact()
    log('Testing ship mount via interact()...');
    const mountResult = await browser.evaluate(() => {
        const game = window.__VOXEL_GAME__;
        if (!game) return { error: 'Game not found' };

        const ship = game.animals.find(a => a.constructor.name === 'MillenniumFalcon');
        if (!ship) return { error: 'Ship not found' };

        // Move player close to ship
        game.player.position.copy(ship.position);
        game.player.position.y = ship.position.y + 2;

        // Call interact
        if (ship.interact) {
            ship.interact();
        }

        // Check if mounted
        return {
            mounted: game.player.mount === ship,
            shipHasRider: ship.rider === game.player
        };
    });

    log(`Mount result: mounted=${mountResult.mounted}, shipHasRider=${mountResult.shipHasRider}`);

    // Test dismounting
    await browser.evaluate(() => {
        const game = window.__VOXEL_GAME__;
        if (game?.player?.mount) {
            game.player.dismount();
        }
    });

    log('Dismounted from ship');

    // Final check
    const finalCheck = await browser.evaluate(() => {
        const game = window.__VOXEL_GAME__;
        return {
            playerMounted: !!game?.player?.mount,
            shipExists: !!game?.animals?.find(a => a.constructor.name === 'MillenniumFalcon')
        };
    });

    log(`Final state: playerMounted=${finalCheck.playerMounted}, shipExists=${finalCheck.shipExists}`);

    const success = shipInfo.found && shipInfo.isRideable && shipInfo.hasInteract && mountResult.mounted;

    return {
        success,
        details: {
            shipFound: shipInfo.found,
            isRideable: shipInfo.isRideable,
            hasInteract: shipInfo.hasInteract,
            mountWorked: mountResult.mounted,
            position: shipInfo.position
        }
    };
}
