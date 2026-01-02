
// Verification for Hollow Cube
// Expected global: window.__VOXEL_GAME__
// Expected context: this function is run in browser
const game = window.__VOXEL_GAME__;
if (!game || !game.player) return { success: false, message: 'Game/Player not ready' };

const center = game.player.position;
const radius = 25; // Search radius (large enough to find the build)
// Material is hardcoded here or passed via template, 
// strictly speaking verifyFile takes raw code, so we can hardcode 'glass' for this specific test file
const mat = 'glass';

console.log('[Verification] Centre:', center.x, center.y, center.z);

let foundBlocks = [];
let scanned = 0;

// Scan area
for (let x = Math.floor(center.x - radius); x <= Math.floor(center.x + radius); x++) {
    for (let y = Math.floor(center.y - 10); y <= Math.floor(center.y + 20); y++) {
        for (let z = Math.floor(center.z - radius); z <= Math.floor(center.z + radius); z++) {
            const b = game.getBlock(x, y, z);
            if (b) {
                scanned++;
                if (b.id === mat) foundBlocks.push({ x, y, z });
            }
        }
    }
}

console.log('[Verification] Scanned blocks:', scanned);
console.log('[Verification] Found target blocks:', foundBlocks.length);

if (foundBlocks.length === 0) return { success: false, message: 'No ' + mat + ' blocks found.' };

// Calculate bounds
const minX = Math.min(...foundBlocks.map(b => b.x));
const maxX = Math.max(...foundBlocks.map(b => b.x));
const minY = Math.min(...foundBlocks.map(b => b.y));
const maxY = Math.max(...foundBlocks.map(b => b.y));
const minZ = Math.min(...foundBlocks.map(b => b.z));
const maxZ = Math.max(...foundBlocks.map(b => b.z));

const width = maxX - minX + 1;
const height = maxY - minY + 1;
const depth = maxZ - minZ + 1;

console.log(`[Verification] Bounds: ${width}x${height}x${depth}`);

// Check if it's roughly cubic (allow 1 block variance)
if (Math.abs(width - depth) > 2 || Math.abs(width - height) > 2) {
    return { success: false, message: `Not cubic. Dimensions: ${width}x${height}x${depth}` };
}

// Check if dimensions are roughly 5x5 (allow variance)
if (width < 4 || width > 7) {
    return { success: false, message: `Wrong size. Dimensions: ${width}x${height}x${depth} (Expected ~5)` };
}

// Check for hollowness (sample center)
const midX = Math.floor((minX + maxX) / 2);
const midY = Math.floor((minY + maxY) / 2);
const midZ = Math.floor((minZ + maxZ) / 2);

const centerBlock = game.getBlock(midX, midY, midZ);
// Center should be air OR player (if player is there, getBlock usually returns null/air if no block)
if (centerBlock && centerBlock.id !== 'air') {
    return { success: false, message: `Not hollow. Found ${centerBlock.id} at center (${midX},${midY},${midZ})` };
}

return { success: true, message: `Found hollow ${width}x${height}x${depth} cube of ${mat}` };
