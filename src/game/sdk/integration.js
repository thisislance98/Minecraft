/**
 * SDK Integration - Connect VoxelWorld to the game
 */
import VoxelWorld from './VoxelWorld.js';

/**
 * Initialize SDK with game
 */
export function initSDK(game) {
    VoxelWorld.init(game);
    console.log('[SDK] Initialized');
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
