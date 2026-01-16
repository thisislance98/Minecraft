
import { Player } from '../src/game/entities/Player.js';
import * as THREE from 'three';

// Mock dependencies
const mockGame = {
    camera: {
        add: () => { },
        position: new THREE.Vector3(),
        rotation: new THREE.Euler(),
        getWorldDirection: () => new THREE.Vector3(0, 0, -1)
    },
    scene: {
        add: () => { }
    },
    inputManager: {
        isActionActive: () => false
    },
    inventory: {
        getSelectedItem: () => null
    },
    getBlock: (x, y, z) => {
        // Flat ground at y=0
        if (y < 0) return { type: 'stone' };
        // Step at x=5, y=0 (block at y=0 is solid)
        if (x > 4 && x < 6 && y < 1) return { type: 'stone' };
        return { type: 'air' };
    },
    chunkSize: 16,
    gravity: 0, // Disable gravity for this test to isolate step logic
    soundManager: { playSound: () => { } }
};

// Mock config
global.Config = {
    WORLD: { WORLD_RADIUS_CHUNKS: 1, CHUNK_SIZE: 16 },
    PLAYER: {
        SPAWN_POINT: { y: 10 },
        HEIGHT: 1.8,
        WIDTH: 0.6,
        SPEED: 5,
        SPRINT_MULTIPLIER: 1.5,
        JUMP_FORCE: 0.2,
        MAX_HEALTH: 20,
        MAX_HUNGER: 20
    }
};

import fs from 'fs';

function log(msg) {
    console.log(msg);
    fs.appendFileSync('tests/test_result.txt', msg + '\n');
}

// Test
const player = new Player(mockGame);
player.position.set(0, 1, 0); // Start on ground
player.onGround = true;

log("Initial State:");
log(`Pos Y: ${player.position.y}, Smoothing Y: ${player.stepSmoothingY}`);

// Simulate moving towards the step
// We need to trigger moveWithCollision
// Player.js:2030 (approx)

log("\nSimulating Step Up...");
// Move player into the block at x=5
// It should trigger auto-jump at x=4.7 + width/2 approx
player.moveWithCollision(5.0, 0, 0); // Move 5 units X

log(`Pos Y: ${player.position.y}, Smoothing Y: ${player.stepSmoothingY}`);

if (player.position.y > 1.5 && player.stepSmoothingY < -0.5) {
    log("PASS: Player stepped up and smoothing offset was applied.");
} else {
    log("FAIL: Player did not step up or smoothing was not applied.");
}

// Simulate frames to check decay
log("\nSimulating Decay (10 frames at 60fps)...");
const dt = 1.0 / 60.0;
for (let i = 0; i < 10; i++) {
    const prevSmooth = player.stepSmoothingY;
    player.update(dt, false); // false to disable input reading which depends on complicated mocks
    // Note: update also calls moveWithCollision, so we need to be careful. 
    // We already moved, so assume we stay still or continue?
    // MoveWithCollision with 0 velocity

    // We just want to check stepSmoothingY decay in update()
    if (Math.abs(player.stepSmoothingY) < Math.abs(prevSmooth)) {
        // Good
    } else {
        log(`Frame ${i}: Smoothing did not decay! ${prevSmooth} -> ${player.stepSmoothingY}`);
    }
}

log(`Final Smoothing Y: ${player.stepSmoothingY}`);

if (Math.abs(player.stepSmoothingY) < 1.1) {
    log("PASS: Smoothing decayed towards 0.");
} else {
    log("FAIL: Smoothing did not decay.");
}
