/**
 * SDK Integration - Connect VoxelWorld and Lua Runtime to the game
 *
 * Supports two scripting paradigms:
 * 1. VoxelWorld (JavaScript) - Unity-style component system
 * 2. LuaRuntime (Lua) - Roblox-style scripting for AI code generation
 */
import VoxelWorld from './VoxelWorld.js';
import { createLuaRuntime, ExampleScripts } from '../roblox-sdk/index.js';

/** @type {import('../roblox-sdk/LuaRuntime.js').LuaRuntime|null} */
let luaRuntime = null;

/**
 * Initialize SDK with game
 * Sets up both JavaScript (VoxelWorld) and Lua (Roblox-style) SDKs
 */
export function initSDK(game) {
    // Initialize JavaScript SDK
    VoxelWorld.init(game);
    console.log('[SDK] VoxelWorld initialized');

    // Initialize Lua Runtime
    try {
        luaRuntime = createLuaRuntime(game);
        window.LuaRuntime = luaRuntime;
        window.ExampleLuaScripts = ExampleScripts;
        console.log('[SDK] LuaRuntime initialized');
    } catch (e) {
        console.warn('[SDK] LuaRuntime failed to initialize (Fengari may not be loaded):', e.message);
        luaRuntime = null;
    }

    return VoxelWorld;
}

/**
 * Execute Lua code in the sandboxed runtime
 * @param {string} code - Lua source code
 * @param {string} [name='script'] - Script name for error messages
 * @returns {{success: boolean, error?: string}}
 */
export function executeLua(code, name = 'script') {
    if (!luaRuntime) {
        return { success: false, error: 'Lua runtime not initialized' };
    }
    return luaRuntime.execute(code, name);
}

/**
 * Get the Lua runtime instance
 * @returns {import('../roblox-sdk/LuaRuntime.js').LuaRuntime|null}
 */
export function getLuaRuntime() {
    return luaRuntime;
}

/**
 * Update the Lua runtime (call each frame)
 * @param {number} dt - Delta time
 */
export function updateLua(dt) {
    if (luaRuntime) {
        luaRuntime.update(dt);
    }
}

/**
 * Get icon for an item (from SDK registry)
 */
export function getItemIcon(itemId) {
    return VoxelWorld.getIcon(itemId) || null;
}

// Expose Lua execution globally for Merlin/AI
window.executeLua = executeLua;

export { VoxelWorld, luaRuntime };
export default { initSDK, getItemIcon, VoxelWorld, executeLua, getLuaRuntime, updateLua };
