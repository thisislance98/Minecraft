
import { Pathfinder } from '../src/game/ai/Pathfinder.js';
import { Blocks } from '../src/game/core/Blocks.js';
import * as THREE from 'three';

// Mock Game
class MockGame {
    constructor() {
        this.blocks = new Map();
    }

    setBlock(x, y, z, type) {
        this.blocks.set(`${x},${y},${z}`, type);
    }

    getBlock(x, y, z) {
        return this.blocks.get(`${x},${y},${z}`) || null;
    }
}

function runTest() {
    console.log("Starting Pathfinder Test...");
    const game = new MockGame();

    // Setup Ground (flat plane at y=0)
    for (let x = 0; x < 20; x++) {
        for (let z = 0; z < 20; z++) {
            game.setBlock(x, 0, z, Blocks.GRASS);
        }
    }

    // Build House (Walls at x=5, x=9, z=5, z=9)
    // Interior: 6,7,8
    for (let x = 5; x <= 9; x++) {
        game.setBlock(x, 1, 5, Blocks.STONE); // Wall
        game.setBlock(x, 1, 9, Blocks.STONE); // Wall
        game.setBlock(x, 2, 5, Blocks.STONE); // Wall (2 high)
        game.setBlock(x, 2, 9, Blocks.STONE);
    }
    for (let z = 5; z <= 9; z++) {
        game.setBlock(5, 1, z, Blocks.STONE);
        game.setBlock(9, 1, z, Blocks.STONE);
        game.setBlock(5, 2, z, Blocks.STONE);
        game.setBlock(9, 2, z, Blocks.STONE);
    }

    // Door at (5, 1, 7) - West wall center
    // Clear blocks
    game.setBlock(5, 1, 7, Blocks.DOOR_CLOSED); // Closed door is passable
    game.setBlock(5, 2, 7, Blocks.DOOR_CLOSED);

    const pf = new Pathfinder(game);

    // Test 1: Simple Path (Outside to Outside)
    console.log("Test 1: Simple Walk");
    const start1 = new THREE.Vector3(1, 1, 1);
    const end1 = new THREE.Vector3(3, 1, 3);
    const path1 = pf.findPath(start1, end1);
    if (path1) {
        console.log("Test 1 Passed: Path found.");
    } else {
        console.error("Test 1 Failed: No path.");
    }

    // Test 2: Inside to Outside through Door
    console.log("Test 2: Escape House");
    const start2 = new THREE.Vector3(7.5, 1, 7.5); // Inside center
    const end2 = new THREE.Vector3(2.5, 1, 7.5); // Outside West
    const path2 = pf.findPath(start2, end2);

    if (path2) {
        console.log("Test 2 Passed: Path found.");
        // Verify path goes through door (5, 1, 7)
        const goesThroughDoor = path2.some(p => Math.floor(p.x) === 5 && Math.floor(p.z) === 7);
        if (goesThroughDoor) {
            console.log("Test 2 Details: Path correctly goes through door.");
        } else {
            console.warn("Test 2 Warning: Path found but didn't go through expected door coord? Path:", path2);
        }
    } else {
        console.error("Test 2 Failed: No path found out of house.");
    }

    // Test 3: Path blocked (No door)
    console.log("Test 3: Trapped");
    // Close door with stone
    game.setBlock(5, 1, 7, Blocks.STONE);
    game.setBlock(5, 2, 7, Blocks.STONE);
    const path3 = pf.findPath(start2, end2);
    if (!path3) {
        console.log("Test 3 Passed: No path found (correctly blocked).");
    } else {
        console.error("Test 3 Failed: Path found through wall!", path3);
    }
}

runTest();
