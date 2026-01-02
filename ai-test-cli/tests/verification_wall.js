
// Verification for Wall
const game = window.__VOXEL_GAME__;
if (!game || !game.player) return { success: false, message: 'Game/Player not ready' };

const center = game.player.position;
const radius = 25;
const mat = 'stone_brick'; // Default or templated

console.log('[Verification] Centre:', center.x, center.y, center.z);
let foundBlocks = [];

// Scan area
for (let x = Math.floor(center.x - radius); x <= Math.floor(center.x + radius); x++) {
    for (let y = Math.floor(center.y - 5); y <= Math.floor(center.y + 20); y++) {
        for (let z = Math.floor(center.z - radius); z <= Math.floor(center.z + radius); z++) {
            const b = game.getBlock(x, y, z);
            if (b && b.id === mat) foundBlocks.push({ x, y, z });
        }
    }
}

if (foundBlocks.length === 0) return { success: false, message: 'No ' + mat + ' blocks found.' };

// Calculate bounds
const minX = Math.min(...foundBlocks.map(b => b.x));
const maxX = Math.max(...foundBlocks.map(b => b.x));
const minZ = Math.min(...foundBlocks.map(b => b.z));
const maxZ = Math.max(...foundBlocks.map(b => b.z));

const dx = maxX - minX;
const dz = maxZ - minZ;

// A wall should be significantly longer in one dimension than the other
// Aspect ratio check
const length = Math.max(dx, dz);
const width = Math.min(dx, dz) + 1; // +1 to avoid div/0
const ratio = length / width;

console.log(`[Verification] Wall check: ${dx}x${dz} (Ratio: ${ratio.toFixed(1)})`);

if (ratio < 2.5) {
    return { success: false, message: `Not wall-like. Ratio ${ratio.toFixed(1)}. Dimensions: ${dx}x${dz}` };
}

return { success: true, message: `Found wall-like structure. Dimensions: ${dx}x${dz}` };
