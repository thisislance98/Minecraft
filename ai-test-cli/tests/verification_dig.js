
// Verification for Digging (Tunnel)
const game = window.__VOXEL_GAME__;
if (!game || !game.player) return { success: false, message: 'Game/Player not ready' };

const pos = game.player.position;
// Check vector in front of player? Or just around player?
// Assume "Dig a hole 3x3x3 under me"
const center = { x: Math.floor(pos.x), y: Math.floor(pos.y) - 1, z: Math.floor(pos.z) };
const size = 3; // radius 1.5 approx

let airCount = 0;
let blockCount = 0;

for (let x = center.x - 1; x <= center.x + 1; x++) {
    for (let y = center.y - 2; y <= center.y; y++) {
        for (let z = center.z - 1; z <= center.z + 1; z++) {
            const b = game.getBlock(x, y, z);
            // getBlock returns null for air usually, or object with id 'air'
            if (!b || b.id === 'air') {
                airCount++;
            } else {
                blockCount++;
                console.log(`[Verification] Found block at ${x},${y},${z}: ${b.id}`);
            }
        }
    }
}

console.log(`[Verification] Dig check. Air: ${airCount}, Blocks: ${blockCount}`);

if (blockCount > 2) { // Allow slight inaccuracies or player standing on something
    return { success: false, message: `Found ${blockCount} blocks in hole area. Not fully dug.` };
}

return { success: true, message: `Area is clear (Air: ${airCount}). Dig successful.` };
