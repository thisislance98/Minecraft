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

// We will launch two headed sessions and perform different actions
const commands = [
    // Launch Browser A
    { tool: 'browser_launch', session_id: 'session_A', args: { headless: false } },
    // Launch Browser B
    { tool: 'browser_launch', session_id: 'session_B', args: { headless: false } },

    // Give them time to load
    { tool: 'wait', session_id: 'session_A', args: { ms: 15000 } },

    // Action 1: Spawn Cow in Session A
    { tool: 'spawn_creature', session_id: 'session_A', args: { type: 'Cow', count: 1 } },

    // Action 2: Teleport Session B (so they don't overlap)
    { tool: 'teleport', session_id: 'session_B', args: { x: 50, y: 50, z: 50 } },
    { tool: 'wait', session_id: 'session_B', args: { ms: 1000 } },

    // Action 3: Spawn Pig in Session B
    { tool: 'spawn_creature', session_id: 'session_B', args: { type: 'Pig', count: 3 } },

    // Verification: Get stats from both
    { tool: 'get_game_state', session_id: 'session_A' },
    { tool: 'get_game_state', session_id: 'session_B' },

    // Cleanup
    { tool: 'wait', session_id: 'session_A', args: { ms: 5000 } }, // Observe result
    { tool: 'browser_close', session_id: 'session_A' },
    { tool: 'browser_close', session_id: 'session_B' },
    { tool: 'exit' }
];

let cmdIndex = 0;

proc.stdout.on('data', (data) => {
    const str = data.toString();
    console.log(`[OUT] ${str.trim()}`);

    if (str.includes('Game Driver Interactive Mode')) {
        setTimeout(sendNext, 500);
    } else if (str.trim().startsWith('{')) {
        setTimeout(sendNext, 1000);
    } else if (str.includes('ready')) {
        setTimeout(sendNext, 1000);
    }
});

function sendNext() {
    if (cmdIndex >= commands.length) return;
    const cmd = commands[cmdIndex++];
    console.log(`Sending: ${JSON.stringify(cmd)}`);
    proc.stdin.write(JSON.stringify(cmd) + '\n');
}
