
const { Villager } = await import('../src/game/entities/animals/Villager.js');
const { Blocks } = await import('../src/game/core/Blocks.js');
const THREE = await import('three');

export async function run(game) {
    console.log("Starting Villager Water Physics Debug...");

    // 1. Setup Environment
    const startX = 100;
    const startY = 80;
    const startZ = 100;

    // Clear area
    for (let x = -2; x <= 2; x++) {
        for (let y = -2; y <= 5; y++) {
            for (let z = -2; z <= 2; z++) {
                game.setBlock(startX + x, startY + y, startZ + z, Blocks.AIR);
            }
        }
    }

    // Create Pool
    for (let x = -2; x <= 2; x++) {
        for (let z = -2; z <= 2; z++) {
            game.setBlock(startX + x, startY - 1, startZ + z, Blocks.STONE); // Bottom
            // Fill with water
            game.setBlock(startX + x, startY, startZ + z, Blocks.WATER);
        }
    }

    // Create Villager
    const villager = new Villager(game, startX, startY + 2, startZ);
    game.addEntity(villager);

    console.log(`Villager Spawned at ${villager.position.x}, ${villager.position.y}, ${villager.position.z}`);

    // Monitor for 5 seconds (approx 300 ticks)
    for (let i = 0; i < 60; i++) {
        // Simulate physics update
        villager.update(0.1);

        const blockAtFeet = game.getBlock(Math.floor(villager.position.x), Math.floor(villager.position.y), Math.floor(villager.position.z));
        const blockType = (blockAtFeet && blockAtFeet.type) ? blockAtFeet.type : blockAtFeet;

        console.log(`Tick ${i}: PosY=${villager.position.y.toFixed(3)} VelY=${villager.velocity.y.toFixed(3)} OnGround=${villager.onGround} BlockAtFeet=${blockType}`);

        await new Promise(r => setTimeout(r, 50));
    }

    console.log("Test Complete");
}
