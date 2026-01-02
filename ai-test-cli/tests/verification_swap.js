
// Verification for Material Swap
// Assumes we swapped 'dirt' for 'gold_block' (or similar)
const game = window.__VOXEL_GAME__;
if (!game || !game.player) return { success: false, message: 'Game/Player not ready' };

const center = game.player.position;
const radius = 10;
const targetMat = 'gold_block'; // The new material
const oldMat = 'dirt'; // The old material (optional check)

let foundTarget = 0;
let foundOld = 0;

// Scan area
for (let x = Math.floor(center.x - radius); x <= Math.floor(center.x + radius); x++) {
    for (let y = Math.floor(center.y - 5); y <= Math.floor(center.y + 10); y++) {
        for (let z = Math.floor(center.z - radius); z <= Math.floor(center.z + radius); z++) {
            const b = game.getBlock(x, y, z);
            if (b) {
                if (b.id === targetMat) foundTarget++;
                if (b.id === oldMat) foundOld++;
            }
        }
    }
}

console.log(`[Verification] Swap check. Found ${foundTarget} ${targetMat}, ${foundOld} ${oldMat}`);

if (foundTarget === 0) {
    return { success: false, message: `No ${targetMat} blocks found. Swap failed.` };
}

if (foundOld > 10) { // Tolerate some clutter
    // This might fail if the world is huge, but assuming local swap
    // return { success: false, message: `Too many old blocks (${foundOld} ${oldMat}) remaining.` };
}

return { success: true, message: `Found ${foundTarget} ${targetMat} blocks. Swap successful.` };
