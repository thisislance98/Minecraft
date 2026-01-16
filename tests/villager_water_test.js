
import { GameBrowser } from '../ai-test-cli/src/browser.js';
import * as gc from '../ai-test-cli/src/game-commands.js';
import chalk from 'chalk';
import fs from 'fs';

async function testVillagerWaterAvoidance() {
    console.log(chalk.blue('Starting Villager Water Avoidance Verification...'));
    const browser = new GameBrowser({ headless: true }); // Headless true for automated verification

    try {
        await browser.launch();
        await browser.waitForGameLoad();
        console.log('Game loaded.');

        // Setup: Create water pool and spawn villager
        await browser.evaluate(() => {
            const player = window.game.player;
            if (!player) return;

            const x = Math.floor(player.position.x);
            const y = Math.floor(player.position.y);
            const z = Math.floor(player.position.z);

            // Create a water pool nearby
            // Make a 5x5 pool at z+5 to z+10
            for (let i = -2; i <= 2; i++) {
                for (let j = 5; j <= 9; j++) {
                    window.game.setBlock(x + i, y - 1, z + j, 'water');
                    window.game.setBlock(x + i, y, z + j, 'air');
                }
            }

            // Spawn villager right next to it (z+4)
            const Villager = window.game.entityManager.entityClasses.Villager;
            const villager = new Villager(window.game, x, y, z + 4);
            // Face the water
            villager.rotation = 0; // Towards +Z (water is at +Z)
            window.game.addEntity(villager);
            window.testVillager = villager;
        });

        console.log("Spawned villager next to water. Observing for 10 seconds...");
        fs.writeFileSync('villager_test_result.txt', 'STARTED\n');

        const startTime = Date.now();
        let enteredWater = false;

        while (Date.now() - startTime < 10000) {
            await new Promise(r => setTimeout(r, 500));

            // Force wander if idle to ensure it actually tries to move
            await browser.evaluate(() => {
                const v = window.testVillager;
                if (!v) return;

                // Check if in water
                const block = window.game.getBlock(Math.floor(v.position.x), Math.floor(v.position.y), Math.floor(v.position.z));
                const inWater = block && block.type === 'water';
                if (inWater) {
                    window.testFailure = true;
                }

                // If in idle state, force expire timer to pick new state
                if (v.state === 'idle') {
                    v.stateTimer = 0;
                }
            });

            const failure = await browser.evaluate(() => window.testFailure);
            if (failure) {
                enteredWater = true;
                break;
            }
        }

        if (enteredWater) {
            console.error(chalk.red("FAILURE: Villager walked into water!"));
            fs.appendFileSync('villager_test_result.txt', 'FAILURE: Villager walked into water!\n');
            process.exit(1);
        } else {
            console.log(chalk.green("SUCCESS: Villager stayed dry."));
            fs.appendFileSync('villager_test_result.txt', 'SUCCESS: Villager stayed dry.\n');
        }

    } catch (e) {
        console.error(chalk.red('Test Error:'), e);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

testVillagerWaterAvoidance();
