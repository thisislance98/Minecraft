
// logic_test_fixed.js
// Standalone test for Animal Physics Logic regarding water, using the FIXED logic

const Blocks = {
    AIR: 'air',
    WATER: 'water',
    DIRT: 'dirt'
};

class MockGame {
    constructor() {
        this.blocks = {}; // "x,y,z" -> blockId
    }

    setBlock(x, y, z, block) {
        this.blocks[`${x},${y},${z}`] = block;
    }

    // Matches VoxelGame.jsx behavior
    getBlock(x, y, z) {
        const type = this.blocks[`${x},${y},${z}`] || Blocks.AIR;
        return type ? { type } : null;
    }
}

// Fixed Animal class
class TestAnimal {
    constructor(game) {
        this.game = game;
        this.width = 0.6;
        this.depth = 0.6;
        this.height = 1.95;
    }

    // FIXED LOGIC
    checkSolid(x, y, z) {
        const block = this.game.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        const type = (block && block.type) ? block.type : block;

        // Ensure we don't treat Air as solid even if it's a string 'air'
        const isSolid = !!type && type !== Blocks.WATER && type !== Blocks.AIR;
        console.log(`Debug checkSolid(${x},${y},${z}): Block=${JSON.stringify(block)}, Type=${type}, Result=${isSolid}`);
        return isSolid;
    }

    // FIXED LOGIC
    checkWater(x, y, z) {
        const block = this.game.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        const type = (block && block.type) ? block.type : block;
        const result = type === Blocks.WATER;
        console.log(`Debug checkWater(${x},${y},${z}): Block=${JSON.stringify(block)}, Type=${type}, Result=${result}`);
        return result;
    }

    testGroundCheck(pos) {
        console.log(`\nTesting Ground Check at pos: ${pos.x}, ${pos.y}, ${pos.z}`);

        const checkPoints = [{ x: 0, z: 0 }];
        let highestGroundY = -Infinity;
        const checkBaseY = Math.floor(pos.y + 0.1);

        for (const pt of checkPoints) {
            const checkX = pos.x + pt.x;
            const checkZ = pos.z + pt.z;

            // Scan down looking for solid ground
            for (let y = checkBaseY; y >= checkBaseY - 2; y--) {
                const isSolid = this.checkSolid(checkX, y, checkZ);
                if (isSolid) {
                    const blockTop = y + 1;
                    if (blockTop > highestGroundY) {
                        highestGroundY = blockTop;
                    }
                    break;
                }
            }
        }

        console.log(`Highest Ground Y: ${highestGroundY}`);
        return highestGroundY;
    }
}

// Run Test
const game = new MockGame();
game.setBlock(0, 62, 0, Blocks.DIRT);
game.setBlock(0, 63, 0, Blocks.WATER);
game.setBlock(0, 64, 0, Blocks.AIR);

const animal = new TestAnimal(game);

console.log("--- Test 1: On Top of Water (y=64) ---");
// Should ignore water as ground. Ground should be y=63 (dirt top)?
// No, setBlock(0,62,0,DIRT) -> Dirt is at 62. Top is 63.
// Water is at 63. 
// If water is NOT solid, ground check at 64 scans:
// y=64 (AIR) -> Solid? NO.
// y=63 (WATER) -> Solid? NO.
// y=62 (DIRT) -> Solid? YES. Top = 63.
// Result: 63.
// Animal is at 64. 64 > 63. Should FALL into water.
const ground1 = animal.testGroundCheck({ x: 0.5, y: 64.0, z: 0.5 });

console.log("\n--- Test 2: Checking Water Detection ---");
animal.checkWater(0.5, 63, 0.5); // Should be True
animal.checkSolid(0.5, 63, 0.5); // Should be False
