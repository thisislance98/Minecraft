/**
 * ItemRegistry - Centralized registry for all item classes with HMR support.
 * 
 * This module acts as the HMR boundary for item classes. When any item class
 * is updated, this registry accepts the update and notifies the game to show
 * a notification WITHOUT triggering a full page reload.
 */

// Import all item classes
import { Item } from './items/Item.js';
import { WandItem } from './items/WandItem.js';
import { ShrinkWandItem } from './items/ShrinkWandItem.js';
import { GrowthWandItem } from './items/GrowthWandItem.js';
import { BowItem } from './items/BowItem.js';
import { FlyingBroomItem } from './items/FlyingBroomItem.js';
import { LevitationWandItem } from './items/LevitationWandItem.js';
import { GiantWandItem } from './items/GiantWandItem.js';
import { WizardTowerWandItem } from './items/WizardTowerWandItem.js';
import { OmniWandItem } from './items/OmniWandItem.js';
import { RideWandItem } from './items/RideWandItem.js';
import { CaptureWandItem } from './items/CaptureWandItem.js';
import { SpawnEggItem } from './items/SpawnEggItem.js';
import { WaterBucketItem } from './items/WaterBucketItem.js';
import { SignItem } from './items/SignItem.js';

// Export all classes for use by ItemManager and others
export {
    Item,
    WandItem,
    ShrinkWandItem,
    GrowthWandItem,
    BowItem,
    FlyingBroomItem,
    LevitationWandItem,
    GiantWandItem,
    WizardTowerWandItem,
    OmniWandItem,
    RideWandItem,
    CaptureWandItem,
    SpawnEggItem,
    WaterBucketItem,
    SignItem
};

// Map of class names to classes for runtime lookup
export const ItemClasses = {
    Item,
    WandItem,
    ShrinkWandItem,
    GrowthWandItem,
    BowItem,
    FlyingBroomItem,
    LevitationWandItem,
    GiantWandItem,
    WizardTowerWandItem,
    OmniWandItem,
    RideWandItem,
    CaptureWandItem,
    SpawnEggItem,
    WaterBucketItem,
    SignItem
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
            Object.assign(ItemClasses, newModule.ItemClasses);
            showHMRNotification('ItemRegistry.js');
            console.log('[HMR] ItemRegistry updated');
        }
    });

    // Accept updates to all item modules
    const itemModules = [
        './items/Item.js',
        './items/WandItem.js',
        './items/ShrinkWandItem.js',
        './items/GrowthWandItem.js',
        './items/BowItem.js',
        './items/FlyingBroomItem.js',
        './items/LevitationWandItem.js',
        './items/GiantWandItem.js',
        './items/WizardTowerWandItem.js',
        './items/OmniWandItem.js',
        './items/RideWandItem.js',
        './items/CaptureWandItem.js',
        './items/SpawnEggItem.js',
        './items/WaterBucketItem.js',
        './items/SignItem.js'
    ];

    import.meta.hot.accept(itemModules, (modules) => {
        // When any item module updates, show notification
        // The actual class updates are handled by the module system
        console.log('[HMR] Item module(s) updated');
    });
}
