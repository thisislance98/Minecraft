
import * as THREE from 'three';
import { Arrow } from '../../src/game/entities/projectiles/Arrow.js';

// Mock Game
const mockGame = {
    gravity: 0.0032,
    scene: {
        add: () => { },
        remove: () => { }
    },
    socketManager: {
        playerMeshes: new Map(),
        sendDamage: (id, amount) => {
            console.log(`[MockSocket] sendDamage called. ID: ${id}, Amount: ${amount}`);
            mockGame.lastDamage = { id, amount };
        }
    },
    player: {
        position: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Euler(0, 0, 0)
    },
    getBlock: () => null // No blocks
};

function runTest() {
    console.log("Starting Arrow Damage Verification...");

    // 1. Setup Remote Player
    const targetId = 'target_player_123';
    const targetPos = new THREE.Vector3(0, 0, 10); // 10 units away on Z
    const targetGroup = new THREE.Group();
    targetGroup.position.copy(targetPos);

    mockGame.socketManager.playerMeshes.set(targetId, {
        group: targetGroup,
        isDead: false
    });

    // 2. Fire Arrow at Target
    // Owner is null (not the player) or consistent
    const startPos = new THREE.Vector3(0, 1, 0); // Eye height-ish
    // Velocity towards target: (0, 0, 1) * speed
    // Speed roughly 1.0 per frame? Arrow update uses specific scaling.
    // Arrow.update does: movement = velocity * dt * 60.
    // Let's give it a velocity that will reach target.
    const direction = new THREE.Vector3(0, 0, 1).normalize();
    const speed = 2.0;
    const velocity = direction.multiplyScalar(speed);

    const arrow = new Arrow(mockGame, startPos, velocity, mockGame.player);

    // 3. Update Loop until collision
    let hit = false;
    const dt = 1 / 60;

    for (let i = 0; i < 600; i++) { // Max 10 seconds sim
        arrow.update(dt);

        if (arrow.isStuck) {
            console.log(`Arrow stuck at frame ${i}. Pos: ${arrow.position.x.toFixed(2)}, ${arrow.position.y.toFixed(2)}, ${arrow.position.z.toFixed(2)}`);
            hit = true;
            break;
        }
    }

    if (!hit) {
        throw new Error("Arrow did not hit the target (passed through or stopped short).");
    }

    // 4. Verify Damage
    if (!mockGame.lastDamage) {
        throw new Error("No damage sent to socket manager.");
    }

    if (mockGame.lastDamage.id !== targetId) {
        throw new Error(`Wrong target ID. Expected ${targetId}, got ${mockGame.lastDamage.id}`);
    }

    const expectedDamage = 7;
    if (mockGame.lastDamage.amount !== expectedDamage) {
        throw new Error(`Wrong damage amount. Expected ${expectedDamage}, got ${mockGame.lastDamage.amount}`);
    }

    console.log(`Verification Passed! Arrow hit target and dealt ${mockGame.lastDamage.amount} damage.`);
}

runTest();
