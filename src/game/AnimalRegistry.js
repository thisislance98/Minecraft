/**
 * AnimalRegistry - Centralized registry for all animal/entity classes with HMR support.
 * 
 * Uses import.meta.glob to automatically discover and export all entity classes
 * from the ./entities subdirectories.
 */

// Auto-discover all entity classes from specific directories
// eager: true ensures they are available immediately
const modules = import.meta.glob([
    './entities/animals/*.js',
    './entities/monsters/*.js',
    './entities/furniture/*.js',
    './entities/plants/*.js'
], { eager: true });

export const AnimalClasses = {};

// Populate AnimalClasses from the loaded modules
for (const path in modules) {
    const module = modules[path];
    for (const key in module) {
        if (typeof module[key] === 'function' && /^[A-Z]/.test(key)) {
            AnimalClasses[key] = module[key];
        }
    }
}

// Manual additions if any (for debugging or special cases)
import { Slime } from './entities/monsters/Slime.js';
import { Firefly } from './entities/animals/Firefly.js';
import { Bee } from './entities/animals/Bee.js'; // Verification entity
import { Starfish } from './entities/animals/Starfish.js';
import { Car } from './entities/animals/Car.js';
import { Hedgehog } from './entities/animals/Hedgehog.js';
AnimalClasses['Slime'] = Slime;
AnimalClasses['Firefly'] = Firefly;
AnimalClasses['Bee'] = Bee;
AnimalClasses['Starfish'] = Starfish;
AnimalClasses['Car'] = Car;
AnimalClasses['Hedgehog'] = Hedgehog;
console.log('[AnimalRegistry] Manually registered Firefly, Bee, and Hedgehog.');
console.log('[AnimalRegistry] Final AnimalClasses keys:', Object.keys(AnimalClasses));

// Expose Animal base class to window for dynamic creature creation
import { Animal } from './entities/Animal.js';
window.Animal = Animal;

// Expose AnimalClasses to window for testing and debugging
window.AnimalClasses = AnimalClasses;

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

// HMR acceptance
if (import.meta.hot) {
    // Accept updates to the glob patterns
    import.meta.hot.accept(() => {
        // Update AnimalClasses with new modules
        showHMRNotification('AnimalRegistry.js');
        updateExistingCreatures(AnimalClasses);
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

        // If the class has changed (prototype is different), rebuild
        if (NewClass && animal.constructor !== NewClass) {
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