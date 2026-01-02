
// Verification Script for Tree Variety (Acacia, Palm, Willow, Dark Oak)
// This script is evaluated continuously in the browser context by the test runner.

const game = window.__VOXEL_GAME__;
if (!game) return { success: false, message: "Game not initialized" };

console.log("[Verification] Starting Tree Variety Verification...");

const playerPos = game.player.position;
const basePos = {
    x: Math.floor(playerPos.x) + 10,
    y: Math.floor(playerPos.y),
    z: Math.floor(playerPos.z)
};

const structureGen = game.worldGen.structureGenerator;

// Test Acacia
const acaciaPos = { x: basePos.x, y: basePos.y, z: basePos.z };
console.log(`[Verification] Spawning Acacia at ${acaciaPos.x}, ${acaciaPos.y}, ${acaciaPos.z}`);
structureGen.generateAcaciaTree(acaciaPos.x, acaciaPos.y, acaciaPos.z);

// Test Palm
const palmPos = { x: basePos.x + 10, y: basePos.y, z: basePos.z };
console.log(`[Verification] Spawning Palm at ${palmPos.x}, ${palmPos.y}, ${palmPos.z}`);
structureGen.generatePalmTree(palmPos.x, palmPos.y, palmPos.z);

// Test Willow
const willowPos = { x: basePos.x + 20, y: basePos.y, z: basePos.z };
console.log(`[Verification] Spawning Willow at ${willowPos.x}, ${willowPos.y}, ${willowPos.z}`);
structureGen.generateWillowTree(willowPos.x, willowPos.y, willowPos.z);

// Test Dark Oak
const darkOakPos = { x: basePos.x + 30, y: basePos.y, z: basePos.z };
console.log(`[Verification] Spawning Dark Oak at ${darkOakPos.x}, ${darkOakPos.y}, ${darkOakPos.z}`);
structureGen.generateDarkOakTree(darkOakPos.x, darkOakPos.y, darkOakPos.z);

// Verification Logic (Check for new block types)
// 1. Check Acacia Base (should be acacia_wood now)
const acaciaBase = game.getBlock(acaciaPos.x, acaciaPos.y, acaciaPos.z);
if (!acaciaBase || (acaciaBase.id && acaciaBase.id !== 'acacia_wood') && (acaciaBase.type && acaciaBase.type !== 'acacia_wood')) {
    return { success: false, message: `Acacia tree base not found (expected acacia_wood), got ${JSON.stringify(acaciaBase)}` };
}

// 2. Check Palm Base (still uses log)
const palmBase = game.getBlock(palmPos.x, palmPos.y, palmPos.z);
if (!palmBase || (palmBase.id && palmBase.id !== 'log') && (palmBase.type && palmBase.type !== 'log')) {
    return { success: false, message: `Palm tree base not found (expected log), got ${JSON.stringify(palmBase)}` };
}

// 3. Check Willow Base (should be willow_wood now)
const willowBase = game.getBlock(willowPos.x, willowPos.y, willowPos.z);
if (!willowBase || (willowBase.id && willowBase.id !== 'willow_wood') && (willowBase.type && willowBase.type !== 'willow_wood')) {
    return { success: false, message: `Willow tree base not found (expected willow_wood), got ${JSON.stringify(willowBase)}` };
}

// 4. Check Dark Oak Base (2x2, should be dark_oak_wood now)
const darkOakBase1 = game.getBlock(darkOakPos.x, darkOakPos.y, darkOakPos.z);
const darkOakBase2 = game.getBlock(darkOakPos.x + 1, darkOakPos.y, darkOakPos.z);
if (!darkOakBase1 || (darkOakBase1.id && darkOakBase1.id !== 'dark_oak_wood') && (darkOakBase1.type && darkOakBase1.type !== 'dark_oak_wood')) {
    return { success: false, message: `Dark Oak tree base (0,0) not found (expected dark_oak_wood).` };
}
if (!darkOakBase2 || (darkOakBase2.id && darkOakBase2.id !== 'dark_oak_wood') && (darkOakBase2.type && darkOakBase2.type !== 'dark_oak_wood')) {
    return { success: false, message: `Dark Oak tree base (1,0) not found (expected dark_oak_wood).` };
}

console.log("[Verification] All tree bases found with correct new block types. Visual verification recommended for distinct colors.");
return { success: true, message: "Tree variety generation with new block types (Acacia, Willow, Dark Oak) succeeded." };
