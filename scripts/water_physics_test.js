
// logic_test.js
// Standalone test for Animal Physics Logic regarding water

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

    getBlock(x, y, z) {
        const type = this.blocks[`${x},${y},${z}`] || Blocks.AIR;
        return type ? { type } : null;
    }
}

// Minimal Animal class copying the physics logic
class TestAnimal {
    constructor(game) {
        this.game = game;
        this.width = 0.6;
        this.depth = 0.6;
        this.height = 1.95;
        this.rotation = 0;
        this.collisionScale = 0.8;
    }

    checkSolid(x, y, z) {
        const block = this.game.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        // Log what we see for debugging
        if (block === Blocks.WATER) {
            console.log(`Checking block at ${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}: Found WATER. result=${!!block && block !== Blocks.WATER}`);
        }
        return !!block && block !== Blocks.WATER;
    }

    testGroundCheck(pos) {
        console.log(`\nTesting Ground Check at pos: ${pos.x}, ${pos.y}, ${pos.z}`);

        const hw = this.width / 2 * 0.8;
        const hd = this.depth / 2 * 0.8;

        const checkPoints = [
            { x: 0, z: 0 },
            // Simplified points
        ];

        let highestGroundY = -Infinity;
        const checkBaseY = Math.floor(pos.y + 0.1);
        console.log(`checkBaseY: ${checkBaseY}`);

        for (const pt of checkPoints) {
            const checkX = pos.x + pt.x;
            const checkZ = pos.z + pt.z;

            for (let y = checkBaseY; y >= checkBaseY - 2; y--) {
                const isSolid = this.checkSolid(checkX, y, checkZ);
                console.log(`Checking y=${y}: isSolid=${isSolid} (Block: ${this.game.getBlock(Math.floor(checkX), y, Math.floor(checkZ))})`);

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

const animal = new TestAnimal(game);

// Test 1: Entity standing on top of water (y=64)
// Should NOT find ground at 64. Should find ground at 63.
console.log("--- Test 1: On Text of Water (y=64) ---");
const ground1 = animal.testGroundCheck({ x: 0.5, y: 64.0, z: 0.5 });

// Test 2: Entity inside water (y=63)
console.log("--- Test 2: Inside Water (y=63) ---");
const ground2 = animal.testGroundCheck({ x: 0.5, y: 63.0, z: 0.5 });
