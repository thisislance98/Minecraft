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

// Export all classes for use by SpawnManager and others
export {
    Pig, Horse, Chicken, Bunny, Frog, Wolf, Elephant, Lion, Bear, Tiger,
    Deer, Giraffe, Fish, Turtle, Duck, Squirrel, Monkey, Reindeer, Sheep,
    Goat, Turkey, Mouse, Snake, Zombie, Skeleton, Enderman, Creeper, Villager, Pugasus, Kangaroo,
    Ladybug, Toucan, Gymnast,
    Fox, FennecFox,
    Panda, Camel, Snail, Owl, Cow, Snowman,
    SantaClaus, Unicorn, MagicalCreature, TigerBear, Raccoon, Shark, TRex, MythicalVillager, Lampost, Pumpkin, Lorax, Wizard, Rocketship, Giraffifant, Penguin, Dolphin, Snowflake
};

// Map of class names to classes for potential runtime lookup
export const AnimalClasses = {
    Pig, Horse, Chicken, Bunny, Frog, Wolf, Elephant, Lion, Bear, Tiger,
    Deer, Giraffe, Fish, Turtle, Duck, Squirrel, Monkey, Reindeer, Sheep,
    Goat, Turkey, Mouse, Snake, Zombie, Skeleton, Enderman, Creeper, Villager, Pugasus, Kangaroo,
    Ladybug, Toucan, Gymnast,
    Fox, FennecFox,
    Panda, Camel, Snail, Owl, Cow, Snowman,
    SantaClaus, Unicorn, MagicalCreature, TigerBear, Raccoon, Shark, TRex, MythicalVillager, Lampost, Pumpkin, Lorax, Wizard, Rocketship, Giraffifant, Penguin, Dolphin, Snowflake
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
            showHMRNotification('AnimalRegistry.js');
            console.log('[HMR] AnimalRegistry updated');
        }
    });

    // Accept updates to all animal modules
    const animalModules = [
        './entities/animals/Pig.js', './entities/animals/Horse.js', './entities/animals/Chicken.js',
        './entities/animals/Bunny.js', './entities/animals/Frog.js', './entities/animals/Wolf.js',
        './entities/animals/Elephant.js', './entities/animals/Lion.js', './entities/animals/Bear.js',
        './entities/animals/Tiger.js', './entities/animals/Deer.js', './entities/animals/Giraffe.js',
        './entities/animals/Fish.js', './entities/animals/Turtle.js', './entities/animals/Duck.js',
        './entities/animals/Squirrel.js', './entities/animals/Monkey.js', './entities/animals/Reindeer.js',
        './entities/animals/Sheep.js', './entities/animals/Goat.js', './entities/animals/Turkey.js',
        './entities/animals/Mouse.js', './entities/animals/Snake.js', './entities/animals/Zombie.js',
        './entities/animals/Skeleton.js', './entities/animals/Enderman.js', './entities/animals/Creeper.js',
        './entities/animals/Villager.js', './entities/animals/Pugasus.js', './entities/animals/Kangaroo.js',
        './entities/animals/Ladybug.js', './entities/animals/Toucan.js', './entities/animals/Gymnast.js',
        './entities/animals/Fox.js', './entities/animals/FennecFox.js',
        './entities/animals/Panda.js', './entities/animals/Camel.js', './entities/animals/Snail.js',
        './entities/animals/Owl.js', './entities/animals/Cow.js', './entities/animals/Snowman.js', './entities/animals/SantaClaus.js', './entities/animals/Unicorn.js',
        './entities/animals/MagicalCreature.js', './entities/animals/TigerBear.js', './entities/animals/Shark.js', './entities/animals/Raccoon.js', './entities/animals/TRex.js', './entities/animals/MythicalVillager.js', './entities/animals/Lampost.js', './entities/animals/Pumpkin.js', './entities/animals/Lorax.js', './entities/animals/Wizard.js', './entities/animals/Rocketship.js', './entities/animals/Giraffifant.js', './entities/animals/Penguin.js', './entities/animals/Dolphin.js', './entities/animals/Snowflake.js'
    ];

    import.meta.hot.accept(animalModules, (modules) => {
        // When any animal module updates, show notification
        // The actual class updates are handled by the module system
        console.log('[HMR] Animal module(s) updated');
    });
}
