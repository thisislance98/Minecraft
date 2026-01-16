
import * as THREE from 'three';
import { MagicProjectile } from '../../src/game/entities/projectiles/MagicProjectile.js';

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
        }
    },
    animals: [], // Empty animals
    getBlock: () => null, // No blocks
    checkTreeStability: () => { },
    projectiles: [],
    gameState: { flags: { isTimeStopped: false } }
};

function runTest() {
    console.log("Starting Wand Collision Verification...");

    // 1. Setup Remote Player
    const targetId = 'target_player_magic';
    const targetPos = new THREE.Vector3(0, 0, 10);
    const targetGroup = new THREE.Group();
    targetGroup.position.copy(targetPos);

    mockGame.socketManager.playerMeshes.set(targetId, {
        group: targetGroup,
        isDead: false
    });

    // 2. Fire Wand Projectile
    const startPos = new THREE.Vector3(0, 1, 0);
    const direction = new THREE.Vector3(0, 0, 1).normalize();
    // MagicProjectile speed is 25.0 in constructor
    const velocity = direction; // Constructor normalizes and multiplies by speed

    const wandProj = new MagicProjectile(mockGame, startPos, velocity);

    // 3. Update Loop
    let hit = false;
    const dt = 1 / 60;

    // Simulate enough frames to reach target (distance 10, speed 25 -> ~0.4s -> ~24 frames)
    for (let i = 0; i < 60; i++) {
        // MagicProjectile.update returns true if alive, false if dead
        // It calls checkCollisions internally.

        // We need to spy on explode to know if it hit, or check if it stopped/died early?
        // Actually, checkCollisions calls explode() which logs "Magic Hit!"

        // Let's override explode for verification
        let exploded = false;
        wandProj.explode = (pos) => {
            console.log(`[MockProjectile] Exploded at ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`);
            exploded = true;
            wandProj.hasExploded = true;
        };

        const alive = wandProj.update(dt);

        if (exploded) {
            // Check position is close to player (0, 0, 10)
            const dist = wandProj.position.distanceTo(targetPos);
            // Height adjustment: targetPos is feet (0,0,10). Hit is likely around (0,1,10).
            // Distance (0,1,10) to (0,0,10) is 1.0. 
            // So if dist < 1.5 we are good.
            if (dist < 2.0) {
                console.log("Collision verified at correct location.");
                hit = true;
            } else {
                console.warn(`Collision too far from target? Dist: ${dist}`);
            }
            break;
        }
    }

    if (!hit) {
        throw new Error("MagicProjectile passed through target without exploding.");
    }

    console.log("Verification Passed! Wand projectile hit the target.");
}

runTest();
