/**
 * SDK Integration - Connect VoxelWorld to the game
 *
 * Provides Unity-style component system for scripting
 */
import VoxelWorld from './VoxelWorld.js';

/**
 * Initialize SDK with game
 * Sets up VoxelWorld JavaScript SDK
 */
export function initSDK(game) {
    // Initialize JavaScript SDK
    VoxelWorld.init(game);
    console.log('[SDK] VoxelWorld initialized');

    return VoxelWorld;
}

/**
 * Get icon for an item (from SDK registry)
 */
export function getItemIcon(itemId) {
    return VoxelWorld.getIcon(itemId) || null;
}

export { VoxelWorld };
export default { initSDK, getItemIcon, VoxelWorld };
