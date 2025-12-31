/**
 * ItemRegistry - Centralized registry for all item classes with HMR support.
 * 
 * Uses import.meta.glob to automatically discover and export all item classes
 * from the ./items directory.
 */

// Auto-discover all item classes
const modules = import.meta.glob('./items/*.js', { eager: true });

export const ItemClasses = {};

// Populate ItemClasses from the loaded modules
for (const path in modules) {
    const module = modules[path];
    // Assume each module exports the item class as a named export matching the file name
    // or as a named export that extends Item.
    // For simplicity, we look for exports that look like item classes.
    for (const key in module) {
        if (typeof module[key] === 'function' && key.endsWith('Item')) {
            ItemClasses[key] = module[key];
        } else if (key === 'Item') {
            ItemClasses[key] = module[key];
        }
    }
}

// Re-export individually for convenience if needed, though mostly ItemClasses should be used.
// Note: We cannot dynamically create named exports in ES modules.
// Consumers should use ItemClasses or import directly from the file if they need a specific class static import.

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
    // Accept updates to the glob pattern
    // import.meta.hot.accept is a bit tricky with globs, 
    // typically Vite handles the module graph updates.
    // We accept the module itself to trigger the notification.
    import.meta.hot.accept(() => {
        showHMRNotification('ItemRegistry.js');
        console.log('[HMR] ItemRegistry updated');
    });
}
