
// Verification for Multi-Material House
const game = window.__VOXEL_GAME__;
if (!game || !game.player) return { success: false, message: 'Game/Player not ready' };

const center = game.player.position;
const radius = 20;

const mats = {
    'plank': 0,
    'log': 0,
    'glass': 0,
    'stone': 0
};

// Scan area
for (let x = Math.floor(center.x - radius); x <= Math.floor(center.x + radius); x++) {
    for (let y = Math.floor(center.y - 5); y <= Math.floor(center.y + 20); y++) {
        for (let z = Math.floor(center.z - radius); z <= Math.floor(center.z + radius); z++) {
            const b = game.getBlock(x, y, z);
            if (b) {
                for (const m in mats) {
                    if (b.id.includes(m)) mats[m]++;
                }
            }
        }
    }
}

console.log('[Verification] House materials:', JSON.stringify(mats));

// Require at least 2 types of materials significant amount
let typesFound = 0;
if (mats.plank > 10) typesFound++;
if (mats.log > 5) typesFound++;
if (mats.glass > 5) typesFound++;
if (mats.stone > 10) typesFound++;

if (typesFound < 2) {
    return { success: false, message: `Not multi-material. Found counts: ${JSON.stringify(mats)}` };
}

return { success: true, message: `Found multi-material structure (${typesFound} types).` };
