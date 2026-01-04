
// Verify Ship Portal
// Checks if portal blocks were spawned by SpaceShipManager

const game = window.__VOXEL_GAME__;
if (!game) return { success: false, message: 'Game not found' };

const shipManager = game.spaceShipManager;
if (!shipManager) return { success: false, message: 'SpaceShipManager not found' };

if (!shipManager.isActive) {
    return { success: false, message: 'Starship is not active (was it spawned?)' };
}

const portalPos = shipManager.portalPos;
if (!portalPos) {
    return { success: false, message: 'Portal Position is null' };
}

console.log('[Verify] Portal Position:', portalPos);

// Check Trigger Block (Center)
// In SpaceShipManager: 
// this.portalPos = new THREE.Vector3(px, py + 1, pz);
// Trigger blocks: y+1 to y+3.
const tx = Math.floor(portalPos.x);
const ty = Math.floor(portalPos.y);
const tz = Math.floor(portalPos.z);

// We need to check the chunk data directly via game.getBlock
const block = game.getBlock(tx, ty, tz);

if (!block) {
    return { success: false, message: `No block found at trigger position ${tx},${ty},${tz}` };
}

if (block.type !== 'glowstone') {
    return { success: false, message: `Expected glowstone at ${tx},${ty},${tz}, found: ${block.type}` };
}

// Check Frame (Obsidian)
// Frame bottom is at py-1 relative to trigger?
// In code:
// py is floor(centerPos.y)
// portalPos.y is py + 1
// So trigger is at y=1 relative to local.
// Frame bottom is at y=0 relative to local.
// So Frame bottom is at portalPos.y - 1.

const frameY = ty - 1;
const frameBlock = game.getBlock(tx, frameY, tz - 1); // One of the bottom frame blocks

if (!frameBlock) {
    return { success: false, message: `No frame block found at ${tx},${frameY},${tz - 1}` };
}

if (frameBlock.type !== 'obsidian') {
    // Note: Blocks.OBSIDIAN might be 'obsidian' string.
    return { success: false, message: `Expected obsidian frame at ${tx},${frameY},${tz - 1}, found: ${frameBlock.type}` };
}

return { success: true, message: `Portal Verified at ${tx},${ty},${tz}` };
