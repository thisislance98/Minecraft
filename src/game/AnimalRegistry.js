/**
 * AnimalRegistry - Centralized registry for all animal classes with HMR support.
 * 
 * This module acts as the HMR boundary for animal classes. When any animal class
 * is updated, this registry accepts the update and notifies the game to show
 * a notification WITHOUT triggering a full page reload.
 */

// Import all animal classes
import { Pig } from './animals/Pig.js';
import { Horse } from './animals/Horse.js';
import { Chicken } from './animals/Chicken.js';
import { Bunny } from './animals/Bunny.js';
import { Frog } from './animals/Frog.js';
import { Wolf } from './animals/Wolf.js';
import { Elephant } from './animals/Elephant.js';
import { Lion } from './animals/Lion.js';
import { Bear } from './animals/Bear.js';
import { Tiger } from './animals/Tiger.js';
import { Deer } from './animals/Deer.js';
import { Giraffe } from './animals/Giraffe.js';
import { Fish } from './animals/Fish.js';
import { Turtle } from './animals/Turtle.js';
import { Duck } from './animals/Duck.js';
import { Squirrel } from './animals/Squirrel.js';
import { Monkey } from './animals/Monkey.js';
import { Reindeer } from './animals/Reindeer.js';
import { Sheep } from './animals/Sheep.js';
import { Goat } from './animals/Goat.js';
import { Turkey } from './animals/Turkey.js';
import { Mouse } from './animals/Mouse.js';
import { Snake } from './animals/Snake.js';
import { Zombie } from './animals/Zombie.js';
import { Skeleton } from './animals/Skeleton.js';
import { Enderman } from './animals/Enderman.js';
import { Creeper } from './animals/Creeper.js';
import { Villager } from './animals/Villager.js';
import { Pugasus } from './animals/Pugasus.js';
import { Kangaroo } from './animals/Kangaroo.js';
import { Ladybug } from './animals/Ladybug.js';
import { Toucan } from './animals/Toucan.js';
import { Gymnast } from './animals/Gymnast.js';
import { Fox } from './animals/Fox.js';
import { FennecFox } from './animals/FennecFox.js';
import { Panda } from './animals/Panda.js';
import { Camel } from './animals/Camel.js';
import { Snail } from './animals/Snail.js';
import { Owl } from './animals/Owl.js';
import { Cow } from './animals/Cow.js';
import { Snowman } from './animals/Snowman.js';
import { SantaClaus } from './animals/SantaClaus.js';
import { Unicorn } from './animals/Unicorn.js';
import { MagicalCreature } from './animals/MagicalCreature.js';
import { TigerBear } from './animals/TigerBear.js';
import { Shark } from './animals/Shark.js';
import { Raccoon } from './animals/Raccoon.js';
import { TRex } from './animals/TRex.js';
import { MythicalVillager } from './animals/MythicalVillager.js';
import { Lampost } from './animals/Lampost.js';
import { Pumpkin } from './animals/Pumpkin.js';
import { Lorax } from './animals/Lorax.js';
import { Wizard } from './animals/Wizard.js';
import { Rocketship } from './animals/Rocketship.js';
import { Giraffifant } from './animals/Giraffifant.js';
import { Penguin } from './animals/Penguin.js';

// Export all classes for use by SpawnManager and others
export {
    Pig, Horse, Chicken, Bunny, Frog, Wolf, Elephant, Lion, Bear, Tiger,
    Deer, Giraffe, Fish, Turtle, Duck, Squirrel, Monkey, Reindeer, Sheep,
    Goat, Turkey, Mouse, Snake, Zombie, Skeleton, Enderman, Creeper, Villager, Pugasus, Kangaroo,
    Ladybug, Toucan, Gymnast,
    Fox, FennecFox,
    Panda, Camel, Snail, Owl, Cow, Snowman,
    SantaClaus, Unicorn, MagicalCreature, TigerBear, Raccoon, Shark, TRex, MythicalVillager, Lampost, Pumpkin, Lorax, Wizard, Rocketship, Giraffifant, Penguin
};

// Map of class names to classes for potential runtime lookup
export const AnimalClasses = {
    Pig, Horse, Chicken, Bunny, Frog, Wolf, Elephant, Lion, Bear, Tiger,
    Deer, Giraffe, Fish, Turtle, Duck, Squirrel, Monkey, Reindeer, Sheep,
    Goat, Turkey, Mouse, Snake, Zombie, Skeleton, Enderman, Creeper, Villager, Pugasus, Kangaroo,
    Ladybug, Toucan, Gymnast,
    Fox, FennecFox,
    Panda, Camel, Snail, Owl, Cow, Snowman,
    SantaClaus, Unicorn, MagicalCreature, TigerBear, Raccoon, Shark, TRex, MythicalVillager, Lampost, Pumpkin, Lorax, Wizard, Rocketship, Giraffifant, Penguin
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
        './animals/Pig.js', './animals/Horse.js', './animals/Chicken.js',
        './animals/Bunny.js', './animals/Frog.js', './animals/Wolf.js',
        './animals/Elephant.js', './animals/Lion.js', './animals/Bear.js',
        './animals/Tiger.js', './animals/Deer.js', './animals/Giraffe.js',
        './animals/Fish.js', './animals/Turtle.js', './animals/Duck.js',
        './animals/Squirrel.js', './animals/Monkey.js', './animals/Reindeer.js',
        './animals/Sheep.js', './animals/Goat.js', './animals/Turkey.js',
        './animals/Mouse.js', './animals/Snake.js', './animals/Zombie.js',
        './animals/Skeleton.js', './animals/Enderman.js', './animals/Creeper.js',
        './animals/Villager.js', './animals/Pugasus.js', './animals/Kangaroo.js',
        './animals/Ladybug.js', './animals/Toucan.js', './animals/Gymnast.js',
        './animals/Fox.js', './animals/FennecFox.js',
        './animals/Panda.js', './animals/Camel.js', './animals/Snail.js',
        './animals/Owl.js', './animals/Cow.js', './animals/Snowman.js', './animals/SantaClaus.js', './animals/Unicorn.js',
        './animals/MagicalCreature.js', './animals/TigerBear.js', './animals/Shark.js', './animals/Raccoon.js', './animals/TRex.js', './animals/MythicalVillager.js', './animals/Lampost.js', './animals/Pumpkin.js', './animals/Lorax.js', './animals/Wizard.js', './animals/Rocketship.js', './animals/Giraffifant.js', './animals/Penguin.js'
    ];

    import.meta.hot.accept(animalModules, (modules) => {
        // When any animal module updates, show notification
        // The actual class updates are handled by the module system
        console.log('[HMR] Animal module(s) updated');
    });
}
