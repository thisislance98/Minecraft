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
    './entities/furniture/*.js'
], { eager: true });

export const AnimalClasses = {};

// Populate AnimalClasses from the loaded modules
for (const path in modules) {
    const module = modules[path];
    // We assume each file exports the class as a named export matching the filename
    // OR as 'default' if we enforced that.
    // The previous pattern was named exports.
    // Let's iterate all exports and find the class.

    for (const key in module) {
        // Simple heuristic: Class name usually matches export name
        // And we want to exclude utility exports if any.
        // For now, take all functions that look like Classes (start with Uppercase?)
        // Or just take explicit known exports?
        // Let's rely on the assumption that the main export matches the type name.
        if (typeof module[key] === 'function' && /^[A-Z]/.test(key)) {
            AnimalClasses[key] = module[key];
        }
    }
}

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