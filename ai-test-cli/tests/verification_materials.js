
// Verification for Materials (Mossy Stone & Glowstone)
// Expected context: this function is run in browser

const game = window.__VOXEL_GAME__;
if (!game || !game.player) return { success: false, message: 'Game/Player not ready' };

console.log("[Verification] Checking for mossy_stone and glowstone...");

const checkRadius = 20;
const playerPos = game.player.position;

let foundMossyStone = false;
let foundGlowstone = false;
let mossyCount = 0;
let glowCount = 0;

const startX = Math.floor(playerPos.x - checkRadius);
const endX = Math.floor(playerPos.x + checkRadius);
const startY = Math.floor(playerPos.y - 10);
const endY = Math.floor(playerPos.y + 20);
const startZ = Math.floor(playerPos.z - checkRadius);
const endZ = Math.floor(playerPos.z + checkRadius);

for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
        for (let z = startZ; z <= endZ; z++) {
            const block = game.getBlock(x, y, z);
            if (block) {
                // getBlock returns { type: 'block_name' } not { id: 'block_name' }
                if (block.type === 'mossy_stone') {
                    foundMossyStone = true;
                    mossyCount++;
                } else if (block.type === 'glowstone') {
                    foundGlowstone = true;
                    glowCount++;
                }
            }
        }
    }
}

console.log(`[Verification] Found ${mossyCount} mossy_stone blocks.`);
console.log(`[Verification] Found ${glowCount} glowstone blocks.`);

if (!foundMossyStone) {
    return { success: false, message: "No mossy_stone blocks found. (Be sure to skip persisted blocks if any)" };
}

if (!foundGlowstone) {
    return { success: false, message: "No glowstone blocks found." };
}

return { success: true, message: `Found ${mossyCount} mossy_stone and ${glowCount} glowstone blocks.` };
