
import * as THREE from 'three';
import { LevitationProjectile } from '../src/game/entities/projectiles/LevitationProjectile.js';

// Mock Game
class MockGame {
    constructor() {
        this.blocks = new Map();
        this.floatingBlocks = [];
        this.scene = {
            add: (obj) => { },
            remove: (obj) => { }
        };
        this.blockMaterialIndices = {};
        this.assetManager = {
            materialArray: [new THREE.MeshBasicMaterial()],
            blockMaterialIndices: {}
        };
    }

    setBlock(x, y, z, type) {
        if (type === null) {
            this.blocks.delete(`${x},${y},${z}`);
        } else {
            this.blocks.set(`${x},${y},${z}`, type);
        }
    }

    getBlock(x, y, z) {
        return this.blocks.get(`${x},${y},${z}`) || null;
    }

    getBlockWorld(x, y, z) {
        return this.getBlock(x, y, z);
    }
}

function runTest() {
    console.log("Starting Levitation Test...");
    const game = new MockGame();

    // Setup: Build a tower of 5 blocks at (0, 1...5, 0)
    for (let y = 1; y <= 5; y++) {
        game.setBlock(0, y, 0, 'stone');
    }
    // Add some surrounding blocks at base to ensure radius check works
    game.setBlock(1, 1, 0, 'stone');
    game.setBlock(-1, 1, 0, 'stone');

    console.log("Initial State:");
    // Verify initial blocks
    for (let y = 1; y <= 5; y++) {
        if (game.getBlock(0, y, 0) !== 'stone') console.error(`Setup Failed: Missing block at 0,${y},0`);
    }

    // Create Projectile and Explode at bottom
    const proj = new LevitationProjectile(game, new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, -1, 0));

    // Manually trigger explode at (0, 1, 0)
    console.log("Exploding at 0,1,0...");
    proj.explode(new THREE.Vector3(0, 1, 0));

    // Verification
    // With current logic (radius ~2.5), it captures a sphere.
    // 0,1,0 is center. Radius 2.5 covers y= -1.5 to 3.5. 
    // So blocks at y=1, y=2, y=3 should be lifted.
    // y=4, y=5 should remain if logic is SPHERICAL.
    // The GOAL is for y=4 and y=5 to ALSO be lifted.

    let towerLiftedCount = 0;
    for (let y = 1; y <= 5; y++) {
        const block = game.getBlock(0, y, 0);
        if (block === null) {
            towerLiftedCount++;
        } else {
            console.log(`Block at 0,${y},0 remains.`);
        }
    }

    console.log(`Tower blocks lifted: ${towerLiftedCount}/5`);

    // Check surrounding blocks (radius check)
    if (game.getBlock(1, 1, 0) === null) console.log("Neighbor 1,1,0 lifted (Expected)");
    else console.error("Neighbor 1,1,0 NOT lifted (Unexpected for radius 2.5)");

    if (towerLiftedCount === 5) {
        console.log("SUCCESS: Entire tower levitated.");
    } else {
        console.log("PARTIAL: Only some blocks levitated (Reference behavior before fix).");
    }
}

runTest();
