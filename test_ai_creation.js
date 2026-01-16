/**
 * End-to-End Test: AI Creature Creation
 * 
 * This test verifies the full AI-driven creature creation flow:
 * 1. Launch a browser session
 * 2. Connect to the Antigravity AI
 * 3. Send a prompt to create a unique creature (not a pig or cow)
 * 4. Wait for the creature to be registered
 * 5. Spawn it
 * 6. Verify it spawns in front of the player
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cliPath = path.resolve(__dirname, 'ai-test-cli/bin/cli.js');

// Unique creature name to avoid confusion with existing types
const CREATURE_NAME = `TestCritter_${Date.now()}`;

console.log(`\n🧪 AI Creature Creation Test`);
console.log(`   Creature Name: ${CREATURE_NAME}`);
console.log(`   ---------------------------\n`);

// Phase 1: Launch browser session via driver
const proc = spawn('node', [cliPath, 'drive'], {
    stdio: ['pipe', 'pipe', 'inherit']
});

let sessionReady = false;
let creatureRegistered = false;
let testPassed = false;
let outBuffer = '';

const commands = [
    { tool: 'browser_launch', session_id: 'ai_test', args: { headless: true } }
];

let cmdIndex = 0;

proc.stdout.on('data', (data) => {
    const chunk = data.toString();
    outBuffer += chunk;

    const lines = outBuffer.split('\n');
    outBuffer = lines.pop();

    for (const line of lines) {
        const trimmed = line.trim();

        // Log key events
        if (trimmed.includes('Registered creature:') ||
            trimmed.includes('TEST') ||
            trimmed.includes('Error') ||
            trimmed.includes('isInFront')) {
            console.log(`[LOG] ${trimmed}`);
        }

        if (trimmed.includes('Session ai_test ready')) {
            console.log('✓ Browser session ready');
            sessionReady = true;
            // Now connect to AI and send creation prompt
            setTimeout(startAICreation, 1000);
        }
        else if (trimmed.includes('Game Driver Interactive Mode')) {
            setTimeout(sendNext, 500);
        }
        if (trimmed.includes(`Registered creature: ${CREATURE_NAME}`)) {
            console.log(`✓ Creature "${CREATURE_NAME}" registered in client`);
            creatureRegistered = true;
            // Spawn the creature using the driver, then verify
            console.log(`\n--- Phase 3: Spawning Creature ---`);
            proc.stdin.write(JSON.stringify({
                tool: 'spawn_creature',
                session_id: 'ai_test',
                args: { type: CREATURE_NAME, count: 1 }
            }) + '\n');
            // Give it time to spawn, then verify
            setTimeout(() => verifySpawnPosition(CREATURE_NAME), 2000);
        }

        // Handle spawn response
        if (trimmed.includes('"success": true') && trimmed.includes('"type"')) {
            console.log(`✓ Creature spawned`);
        }

        // Check for verification result
        if (chunk.includes('"isInFront":')) {
            const frontMatch = chunk.match(/"isInFront":\s*(true|false)/);
            const distMatch = chunk.match(/"dist":\s*([\d\.\-]+)/);

            if (frontMatch && distMatch) {
                const isInFront = frontMatch[1] === 'true';
                const dist = parseFloat(distMatch[1]);

                if (isInFront) {
                    console.log(`\n✅ TEST PASSED: "${CREATURE_NAME}" spawned in front.`);
                    console.log(`   Distance: ${dist.toFixed(2)} blocks`);
                    testPassed = true;
                } else {
                    console.log(`\n❌ TEST FAILED: Creature NOT in front.`);
                    console.log(`   Distance: ${dist.toFixed(2)} blocks`);
                }

                // Cleanup
                proc.stdin.write(JSON.stringify({ tool: 'browser_close', session_id: 'ai_test' }) + '\n');
                setTimeout(() => {
                    proc.stdin.write(JSON.stringify({ tool: 'exit' }) + '\n');
                }, 1000);
            }
        }
    }
});

function sendNext() {
    if (cmdIndex >= commands.length) return;
    const cmd = commands[cmdIndex++];
    console.log(`Sending: ${cmd.tool}`);
    proc.stdin.write(JSON.stringify(cmd) + '\n');
}

async function startAICreation() {
    console.log('\n--- Phase 2: AI Creature Creation ---');

    // Connect to Antigravity AI
    const ws = new WebSocket('ws://localhost:2567/api/antigravity', {
        headers: {
            'x-antigravity-client': 'cli',
            'x-antigravity-secret': 'asdf123'
        }
    });

    ws.on('open', () => {
        console.log('✓ Connected to Antigravity AI');

        // Send creation prompt - be VERY specific to avoid unwanted creations
        const prompt = `Create a creature called "${CREATURE_NAME}". It should be:
- A simple glowing blue cube that floats
- Size: 1 block
- Health: 10
- It just floats in place and glows
- DO NOT create any other creatures like pigs, cows, or anything else
- Only create this one specific creature`;

        console.log(`Sending prompt: "${prompt.substring(0, 50)}..."`);

        ws.send(JSON.stringify({
            type: 'input',
            text: prompt,
            context: {
                position: { x: 32, y: 37, z: 32 },
                rotation: { x: 0, y: 0, z: 0 },
                biome: 'Plains'
            }
        }));
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());

            if (msg.type === 'tool_call') {
                console.log(`[AI] Tool: ${msg.tool}`);
                if (msg.tool === 'spawn_creature') {
                    console.log(`[AI] Spawning: ${msg.args?.type || 'unknown'}`);
                }
            }

            if (msg.type === 'tool_result') {
                if (msg.tool === 'create_creature' && msg.result?.success) {
                    console.log(`✓ AI created creature: ${msg.result.name}`);
                    creatureRegistered = true;

                    // Wait a bit for client registration, then verify spawn position
                    setTimeout(() => verifySpawnPosition(msg.result.name), 3000);
                }

                if (msg.tool === 'spawn_creature' && msg.result?.success) {
                    console.log(`✓ AI spawned creature`);
                }
            }

            if (msg.type === 'complete') {
                console.log('✓ AI task complete');
                ws.close();
            }

            if (msg.type === 'error') {
                console.log(`❌ AI Error: ${msg.message}`);
            }
        } catch (e) {
            // Ignore parse errors
        }
    });

    ws.on('error', (err) => {
        console.log(`❌ WebSocket Error: ${err.message}`);
    });
}

function verifySpawnPosition(creatureName) {
    console.log(`\n--- Phase 3: Verifying Spawn Position ---`);

    const verifyScript = `
        (function() {
            const game = window.__VOXEL_GAME__;
            if (!game || !game.player) return { error: 'Game not ready' };
            
            // Find the spawned creature by class name (partial match)
            const creatures = game.animals.filter(a => 
                a.constructor.name.toLowerCase().includes('${creatureName.toLowerCase().replace('testcritter_', '')}')
            );
            
            if (creatures.length === 0) return { error: 'Creature not found: ${creatureName}' };
            
            const playerPos = game.player.position;
            creatures.sort((a, b) => a.mesh.position.distanceTo(playerPos) - b.mesh.position.distanceTo(playerPos));
            const creature = creatures[0];
            
            const creaturePos = creature.mesh.position;
            const dist = playerPos.distanceTo(creaturePos);
            
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(game.camera.quaternion);
            const toCreature = new THREE.Vector3().subVectors(creaturePos, playerPos).normalize();
            const dot = forward.dot(toCreature);
            
            return {
                result: {
                    creatureName: creature.constructor.name,
                    dist: dist,
                    dot: dot,
                    isInFront: dot > 0.3
                }
            };
        })()
    `;

    proc.stdin.write(JSON.stringify({
        tool: 'execute_script',
        session_id: 'ai_test',
        args: { code: verifyScript }
    }) + '\n');
}

proc.on('close', (code) => {
    console.log(`\nProcess exited with code ${code}`);
    process.exit(testPassed ? 0 : 1);
});

// Timeout after 2 minutes
setTimeout(() => {
    console.log('\n⏱️ Test timed out after 2 minutes');
    proc.stdin.write(JSON.stringify({ tool: 'exit' }) + '\n');
    setTimeout(() => process.exit(1), 2000);
}, 120000);
