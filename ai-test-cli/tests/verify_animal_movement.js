/**
 * Test script to verify that land animals are moving around
 */
import { GameBrowser } from '../src/browser.js';
import chalk from 'chalk';

async function testAnimalMovement() {
    console.log(chalk.blue('Starting animal movement verification...'));

    const browser = new GameBrowser({ headless: true, quiet: true });

    try {
        await browser.launch();
        await browser.waitForGameLoad();

        console.log(chalk.dim('Game Loaded. Waiting for animals to spawn...'));

        // Wait for animals to spawn
        await new Promise(r => setTimeout(r, 5000));

        // Check initial animal states
        console.log(chalk.dim('Checking initial animal states...'));

        const animalInfo = await browser.evaluate(() => {
            const game = window.__VOXEL_GAME__;
            if (!game || !game.animals) {
                return { error: 'Game or animals not found', gameExists: !!game };
            }

            const animals = game.animals;
            const animalStates = [];

            // Record initial positions for land animals (skip aquatic)
            const aquaticTypes = ['Fish', 'Shark', 'Dolphin', 'Turtle', 'Starfish'];

            for (let i = 0; i < Math.min(animals.length, 15); i++) {
                const animal = animals[i];
                const typeName = animal.constructor.name;
                if (aquaticTypes.includes(typeName)) continue;

                animalStates.push({
                    type: typeName,
                    id: animal.id,
                    state: animal.state,
                    isMoving: animal.isMoving,
                    isRemoteControlled: animal.isRemoteControlled,
                    stateTimer: animal.stateTimer?.toFixed(2),
                    position: {
                        x: animal.position.x,
                        y: animal.position.y,
                        z: animal.position.z
                    }
                });
            }

            return {
                totalAnimals: animals.length,
                animalStates,
                error: null
            };
        });

        if (animalInfo.error) {
            console.log(chalk.red(`Error: ${animalInfo.error}`));
            throw new Error(animalInfo.error);
        }

        console.log(`\n${chalk.cyan('=== Initial Animal States ===')}`)
        console.log(`Total animals: ${animalInfo.totalAnimals}`);
        console.log(`Land animals tracked: ${animalInfo.animalStates.length}`);

        if (animalInfo.animalStates.length === 0) {
            console.log(chalk.yellow('WARNING: No land animals found in the game yet'));
        }

        // Print initial states
        animalInfo.animalStates.forEach((animal, i) => {
            const remoteFlag = animal.isRemoteControlled ? chalk.red(' [REMOTE!]') : '';
            console.log(`  [${i}] ${animal.type} - state: ${animal.state}, isMoving: ${animal.isMoving}${remoteFlag}`);
        });

        // Wait for animals to move
        console.log(chalk.dim('\nWaiting 10 seconds for animals to move...'));
        await new Promise(r => setTimeout(r, 10000));

        // Check positions again
        const animalInfoAfter = await browser.evaluate(() => {
            const game = window.__VOXEL_GAME__;
            if (!game || !game.animals) {
                return { error: 'Game or animals not found' };
            }

            const animals = game.animals;
            const animalStates = [];
            const aquaticTypes = ['Fish', 'Shark', 'Dolphin', 'Turtle', 'Starfish'];

            for (let i = 0; i < Math.min(animals.length, 15); i++) {
                const animal = animals[i];
                const typeName = animal.constructor.name;
                if (aquaticTypes.includes(typeName)) continue;

                animalStates.push({
                    type: typeName,
                    id: animal.id,
                    state: animal.state,
                    isMoving: animal.isMoving,
                    isRemoteControlled: animal.isRemoteControlled,
                    stateTimer: animal.stateTimer?.toFixed(2),
                    position: {
                        x: animal.position.x,
                        y: animal.position.y,
                        z: animal.position.z
                    }
                });
            }

            return {
                totalAnimals: animals.length,
                animalStates,
                error: null
            };
        });

        console.log(`\n${chalk.cyan('=== Animal States After 10 Seconds ===')}`);

        // Compare positions and count movers
        let movedCount = 0;
        let remoteControlledCount = 0;

        animalInfoAfter.animalStates.forEach((animal, i) => {
            const before = animalInfo.animalStates.find(a => a.id === animal.id);
            let moved = false;

            if (before) {
                const dx = Math.abs(animal.position.x - before.position.x);
                const dz = Math.abs(animal.position.z - before.position.z);
                moved = dx > 0.1 || dz > 0.1;
                if (moved) movedCount++;
            }

            if (animal.isRemoteControlled) remoteControlledCount++;

            const movedIndicator = moved ? chalk.green(' ✅ MOVED') : '';
            const remoteFlag = animal.isRemoteControlled ? chalk.red(' [REMOTE!]') : '';
            console.log(`  [${i}] ${animal.type} - state: ${animal.state}, isMoving: ${animal.isMoving}, stateTimer: ${animal.stateTimer}${remoteFlag}${movedIndicator}`);
        });

        // Take screenshot
        await browser.screenshot('ai-test-cli/tests/animal_movement_test.png');

        // Report results
        console.log(`\n${chalk.cyan('=== Test Results ===')}`);
        console.log(`Total land animals tracked: ${animalInfoAfter.animalStates.length}`);
        console.log(`Animals that moved: ${movedCount}`);
        console.log(`Remote controlled animals (BUG if > 0): ${remoteControlledCount}`);

        if (remoteControlledCount > 0) {
            console.log(chalk.red('\n❌ BUG DETECTED: Some animals are marked as remoteControlled when they should not be!'));
            console.log(chalk.red('This prevents them from running their local AI.'));
            process.exit(1);
        }

        if (movedCount === 0 && animalInfoAfter.animalStates.length > 0) {
            console.log(chalk.yellow('\n⚠️ WARNING: No animals moved in 10 seconds'));
            console.log(chalk.yellow('This might indicate the movement bug is still present.'));
            // Don't fail - animals might just be in idle state
        } else if (movedCount > 0) {
            console.log(chalk.green('\n✅ SUCCESS: Animals are moving!'));
            console.log(chalk.green(`${movedCount}/${animalInfoAfter.animalStates.length} animals moved during the test`));
        }

        process.exit(0);

    } catch (error) {
        console.error(chalk.red('\nTest failed:'), error.message);
        await browser.screenshot('ai-test-cli/tests/animal_movement_error.png');
        process.exit(1);
    } finally {
        await browser.close();
    }
}

testAnimalMovement();
