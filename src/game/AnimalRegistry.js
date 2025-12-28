/**
 * AnimalRegistry - Centralized registry for all animal classes with HMR support.
 * 
 * This module acts as the HMR boundary for animal classes. When any animal class
 * is updated, this registry accepts the update and notifies the game to show
 * a notification WITHOUT triggering a full page reload.
 */

// Import all animal classes
import { Pig } from './entities/animals/Pig.js';
import { Horse } from './entities/animals/Horse.js';
import { Chicken } from './entities/animals/Chicken.js';
import { Bunny } from './entities/animals/Bunny.js';
import { Frog } from './entities/animals/Frog.js';
import { Wolf } from './entities/animals/Wolf.js';
import { Elephant } from './entities/animals/Elephant.js';
import { Lion } from './entities/animals/Lion.js';
import { Bear } from './entities/animals/Bear.js';
import { Tiger } from './entities/animals/Tiger.js';
import { Deer } from './entities/animals/Deer.js';
import { Giraffe } from './entities/animals/Giraffe.js';
import { Fish } from './entities/animals/Fish.js';
import { Turtle } from './entities/animals/Turtle.js';
import { Duck } from './entities/animals/Duck.js';
import { Squirrel } from './entities/animals/Squirrel.js';
import { Monkey } from './entities/animals/Monkey.js';
import { Reindeer } from './entities/animals/Reindeer.js';
import { Sheep } from './entities/animals/Sheep.js';
import { Goat } from './entities/animals/Goat.js';
import { Turkey } from './entities/animals/Turkey.js';
import { Mouse } from './entities/animals/Mouse.js';
import { Snake } from './entities/animals/Snake.js';
import { Zombie } from './entities/animals/Zombie.js';
import { Skeleton } from './entities/animals/Skeleton.js';
import { Enderman } from './entities/animals/Enderman.js';
import { Creeper } from './entities/animals/Creeper.js';
import { Villager } from './entities/animals/Villager.js';
import { Pugasus } from './entities/animals/Pugasus.js';
import { Kangaroo } from './entities/animals/Kangaroo.js';
import { Ladybug } from './entities/animals/Ladybug.js';
import { Toucan } from './entities/animals/Toucan.js';
import { Gymnast } from './entities/animals/Gymnast.js';
import { Fox } from './entities/animals/Fox.js';
import { FennecFox } from './entities/animals/FennecFox.js';
import { Panda } from './entities/animals/Panda.js';
import { Camel } from './entities/animals/Camel.js';
import { Snail } from './entities/animals/Snail.js';
import { Owl } from './entities/animals/Owl.js';
import { Cow } from './entities/animals/Cow.js';
import { Snowman } from './entities/animals/Snowman.js';
import { SantaClaus } from './entities/animals/SantaClaus.js';
import { Unicorn } from './entities/animals/Unicorn.js';
import { MagicalCreature } from './entities/animals/MagicalCreature.js';
import { TigerBear } from './entities/animals/TigerBear.js';
import { Shark } from './entities/animals/Shark.js';
import { Raccoon } from './entities/animals/Raccoon.js';
import { TRex } from './entities/animals/TRex.js';
import { MythicalVillager } from './entities/animals/MythicalVillager.js';
import { Lampost } from './entities/animals/Lampost.js';
import { Pumpkin } from './entities/animals/Pumpkin.js';
import { Lorax } from './entities/animals/Lorax.js';
import { Wizard } from './entities/animals/Wizard.js';
import { Rocketship } from './entities/animals/Rocketship.js';
import { Giraffifant } from './entities/animals/Giraffifant.js';
import { Penguin } from './entities/animals/Penguin.js';
import { Dolphin } from './entities/animals/Dolphin.js';
import { Snowflake } from './entities/animals/Snowflake.js';
import { Chimera } from './entities/animals/Chimera.js';
import { Flamingo } from './entities/animals/Flamingo.js';
import { WienerDog } from './entities/animals/WienerDog.js';
import { GoldenRetriever } from './entities/animals/GoldenRetriever.js';
import { Cybertruck } from './entities/animals/Cybertruck.js';
import { Robot } from './entities/animals/Robot.js';
import { Zebra } from './entities/animals/Zebra.js';
import { Eagle } from './entities/animals/Eagle.js';
import { Dragon } from './entities/animals/Dragon.js';

// Export all classes for use by SpawnManager and others
export {
    Pig, Horse, Chicken, Bunny, Frog, Wolf, Elephant, Lion, Bear, Tiger,
    Deer, Giraffe, Fish, Turtle, Duck, Squirrel, Monkey, Reindeer, Sheep,
    Goat, Turkey, Mouse, Snake, Zombie, Skeleton, Enderman, Creeper, Villager, Pugasus, Kangaroo,
    Ladybug, Toucan, Gymnast,
    Fox, FennecFox,
    Panda, Camel, Snail, Owl, Cow, Snowman,
    SantaClaus, Unicorn, MagicalCreature, TigerBear, Raccoon, Shark, TRex, MythicalVillager, Lampost, Pumpkin, Lorax, Wizard, Rocketship, Giraffifant, Penguin, Dolphin, Snowflake, Chimera, Flamingo, WienerDog, GoldenRetriever, Robot, Cybertruck, Zebra, Eagle,
    Dragon
};

// Map of class names to classes for potential runtime lookup
export const AnimalClasses = {
    Pig, Horse, Chicken, Bunny, Frog, Wolf, Elephant, Lion, Bear, Tiger,
    Deer, Giraffe, Fish, Turtle, Duck, Squirrel, Monkey, Reindeer, Sheep,
    Goat, Turkey, Mouse, Snake, Zombie, Skeleton, Enderman, Creeper, Villager, Pugasus, Kangaroo,
    Ladybug, Toucan, Gymnast,
    Fox, FennecFox,
    Panda, Camel, Snail, Owl, Cow, Snowman,
    SantaClaus, Unicorn, MagicalCreature, TigerBear, Raccoon, Shark, TRex, MythicalVillager, Lampost, Pumpkin, Lorax, Wizard, Rocketship, Giraffifant, Penguin, Dolphin, Snowflake, Chimera, Flamingo, WienerDog, GoldenRetriever, Robot, Cybertruck, Zebra, Eagle,
    Dragon: Dragon
};

/**
 * Show HMR notification in the UI
 */
function showHMRNotification(modulePath) {
    const container = document.getElementById('hmr-notifications');
    if (!container) return;

    const fileName = modulePath.split('/').slice(-2).join('/');
    const notification = document.createElement('div');
    notification.className = 'hmr-notification';
    notification.innerHTML = `<span class="hmr-icon">🔄</span> Updated: <span class="hmr-file">${fileName}</span>`;

    container.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 4000);
}

// HMR acceptance - this is the key part that prevents full page reloads
if (import.meta.hot) {
    // Accept updates to this module
    import.meta.hot.accept((newModule) => {
        if (newModule) {
            // Update the exported classes in-place
            Object.assign(AnimalClasses, newModule.AnimalClasses);

            // Live-update all existing creatures of changed types
            updateExistingCreatures(newModule.AnimalClasses);

            showHMRNotification('AnimalRegistry.js');
            console.log('[HMR] AnimalRegistry updated');
        }
    });
}

/**
 * Live-update existing creatures when their class code changes.
 * Rebuilds the mesh of all existing animals of updated types.
 */
function updateExistingCreatures(newClasses) {
    // Get reference to the game (it's a global singleton)
    const game = window.__VOXEL_GAME__;
    if (!game || !game.animals) return;

    console.log(`[HMR] Updating ${game.animals.length} existing creatures...`);

    for (const animal of game.animals) {
        const className = animal.constructor.name;
        const NewClass = newClasses[className];

        if (NewClass && NewClass !== animal.constructor) {
            try {
                // Store current position
                const pos = animal.mesh.position.clone();
                const rot = animal.mesh.rotation.clone();

                // Clear old mesh children
                while (animal.mesh.children.length > 0) {
                    const child = animal.mesh.children[0];
                    animal.mesh.remove(child);
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }

                // Borrow createBody from the new class
                if (NewClass.prototype.createBody) {
                    NewClass.prototype.createBody.call(animal);
                }

                // Restore position
                animal.mesh.position.copy(pos);
                animal.mesh.rotation.copy(rot);

                console.log(`[HMR] Updated existing ${className}`);
            } catch (e) {
                console.error(`[HMR] Failed to update ${className}:`, e);
            }
        }
    }
}