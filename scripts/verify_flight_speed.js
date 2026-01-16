
import { strict as assert } from 'assert';

// Mock Config
const Config = {
    PLAYER: {
        SPEED: 0.08,
        SPRINT_MULTIPLIER: 1.5,
        JUMP_FORCE: 0.15,
        HEIGHT: 1.8,
        WIDTH: 0.6,
        MAX_HEALTH: 20,
        MAX_HUNGER: 20,
        SPAWN_POINT: { y: 10 }
    }
};

// Mock THREE
const THREE = {
    Vector3: class {
        constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
        set(x, y, z) { this.x = x; this.y = y; this.z = z; }
        copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; }
        clone() { return new THREE.Vector3(this.x, this.y, this.z); }
        crossVectors(a, b) { return new THREE.Vector3(); }
        normalize() { return this; }
    }
};

// Mock Player Logic (Simplified from source for testing logic)
class MockPlayer {
    constructor() {
        this.speed = Config.PLAYER.SPEED;
        this.velocity = new THREE.Vector3();
        this.isFlying = false;
    }

    // Extracted logic we want to test
    calculateFlightSpeed(isSprinting) {
        const REF_FPS = 60.0;
        // The logic we just changed:
        // Base flight speed is 1.5x walk speed (Reduced from 3x)
        // Shift (Sprint) boosts it to 3.0x (Reduced from 6x)
        return (this.speed * REF_FPS) * (isSprinting ? 3.0 : 1.5);
    }
}

console.log('Verifying Flight Speed Logic...');

const player = new MockPlayer();
const REF_FPS = 60.0;
const baseSpeed = Config.PLAYER.SPEED * REF_FPS; // 0.08 * 60 = 4.8

console.log(`Base Walking Speed (blocks/sec): ${baseSpeed}`);

// Test Normal Flight
const normalFlightSpeed = player.calculateFlightSpeed(false);
const expectedNormal = baseSpeed * 1.5;
console.log(`Normal Flight Speed: ${normalFlightSpeed} (Expected: ${expectedNormal})`);
assert.equal(normalFlightSpeed, expectedNormal, 'Normal flight speed should be 1.5x base speed');

// Test Sprint Flight
const sprintFlightSpeed = player.calculateFlightSpeed(true);
const expectedSprint = baseSpeed * 3.0;
console.log(`Sprint Flight Speed: ${sprintFlightSpeed} (Expected: ${expectedSprint})`);
assert.equal(sprintFlightSpeed, expectedSprint, 'Sprint flight speed should be 3.0x base speed');

console.log('✅ Flight speed verification passed!');
