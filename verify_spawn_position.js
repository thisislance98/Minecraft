import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cliPath = path.resolve(__dirname, 'ai-test-cli/bin/cli.js');
console.log(`Starting CLI from: ${cliPath}`);

const proc = spawn('node', [cliPath, 'drive'], {
    stdio: ['pipe', 'pipe', 'inherit']
});

const logicScript = `
    (function() {
        const game = window.__VOXEL_GAME__;
        if (!game || !game.player) return { error: 'Game not ready' };
        
        // Find closest Cow
        const cows = game.animals.filter(a => a.constructor.name === 'Cow');
        if (cows.length === 0) return { error: 'No cows found' };
        
        const playerPos = game.player.position;
        // Sort by distance
        cows.sort((a, b) => a.mesh.position.distanceTo(playerPos) - b.mesh.position.distanceTo(playerPos));
        const cow = cows[0];
        
        const cowPos = cow.mesh.position;
        const dist = playerPos.distanceTo(cowPos);
        
        // Use camera quaternion for look direction
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(game.camera.quaternion);
        const toCow = new THREE.Vector3().subVectors(cowPos, playerPos).normalize();
        const dot = forward.dot(toCow); 
        
        return {
            result: {
                success: true,
                dist: dist,
                dot: dot,
                isInFront: dot > 0.5,
                message: \`Distance: \${dist.toFixed(2)}, Alignment: \${dot.toFixed(2)}\`
            }
        };
    })()
`;

const commands = [
    { tool: 'browser_launch', session_id: 'check_spawn', args: { headless: true } },
    { tool: 'wait', session_id: 'check_spawn', args: { ms: 8000 } },
    { tool: 'spawn_creature', session_id: 'check_spawn', args: { type: 'Cow', count: 1 } },
    { tool: 'wait', session_id: 'check_spawn', args: { ms: 1000 } },
    { tool: 'execute_script', session_id: 'check_spawn', args: { code: logicScript } },
    { tool: 'browser_close', session_id: 'check_spawn' },
    { tool: 'exit' }
];

let cmdIndex = 0;
let sessionReady = false;
let outBuffer = '';

console.log('--- Starting Spawn Verification Test ---');

proc.stdout.on('data', (data) => {
    const chunk = data.toString();
    outBuffer += chunk;

    // Process line by line to handle events and JSON
    const lines = outBuffer.split('\n');
    outBuffer = lines.pop();

    for (const line of lines) {
        const trimmed = line.trim();
        console.log(`[RAW] ${trimmed}`);

        if (trimmed.includes('Session check_spawn ready')) {
            console.log('>>> Session Ready Detected');
            sessionReady = true;
            setTimeout(sendNext, 500);
        }
        else if (trimmed.includes('Game Driver Interactive Mode')) {
            setTimeout(sendNext, 500);
        }
        else if (trimmed.includes('"waited":') || trimmed.includes('"success":') || trimmed.includes('"player":') || trimmed.includes('"error":')) {
            console.log('>>> Command Response Detected');
            // Avoid double-advancing if we are already doing so via other checks, 
            // but here simple debounce or check would be good. 
            // For now, relies on the fact that these keys are distinct per step.
            if (sessionReady) setTimeout(sendNext, 500);
        }
    }

    if (chunk.includes('"isInFront":')) {
        try {
            const match = chunk.match(/\{[\s\S]*"isInFront"[\s\S]*?\}/);
            if (match || chunk) {
                const dotMatch = chunk.match(/"dot":\s*([\d\.\-]+)/);
                const distMatch = chunk.match(/"dist":\s*([\d\.\-]+)/);
                const frontMatch = chunk.match(/"isInFront":\s*(true|false)/);

                if (dotMatch && distMatch && frontMatch) {
                    const dot = parseFloat(dotMatch[1]);
                    const dist = parseFloat(distMatch[1]);
                    const isInFront = frontMatch[1] === 'true';

                    if (isInFront) {
                        console.log('✅ TEST PASSED: Creature spawned in front.');
                        console.log(`   Distance: ${dist.toFixed(2)}`);
                        console.log(`   Alignment: ${dot.toFixed(2)}`);
                    } else {
                        console.log('❌ TEST FAILED: Creature NOT in front.');
                        console.log(`   Distance: ${dist.toFixed(2)}`);
                        console.log(`   Alignment: ${dot.toFixed(2)}`);
                    }
                }
            }
        } catch (e) {
            console.log('Error parsing result:', e);
        }
    }
});

function sendNext() {
    if (cmdIndex >= commands.length) return;
    if (cmdIndex > 0 && !sessionReady) return;

    const cmd = commands[cmdIndex++];
    console.log(`Sending: ${cmd.tool}`);
    proc.stdin.write(JSON.stringify(cmd) + '\n');
}

proc.on('close', (code) => {
    console.log(`Process exited with code ${code}`);
});
