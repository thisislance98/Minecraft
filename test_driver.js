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

const commands = [
    { tool: 'browser_launch', session_id: 'test_sess', args: { headless: true } },
    { tool: 'get_game_state', session_id: 'test_sess' },
    { tool: 'browser_close', session_id: 'test_sess' },
    { tool: 'exit' }
];

let cmdIndex = 0;
let processing = false;

proc.stdout.on('data', (data) => {
    const str = data.toString();
    console.log(`[OUT] ${str.trim()}`);

    // Simple heuristic to drive the conversation
    if (str.includes('Game Driver Interactive Mode')) {
        setTimeout(sendNext, 500);
    } else if (str.includes('_screenshot.png') || str.includes('connected') || str.includes('player')) {
        // Responses that indicate success
        setTimeout(sendNext, 1000);
    } else if (str.includes('ready')) {
        // Session ready
        setTimeout(sendNext, 1000);
    }
});

function sendNext() {
    if (cmdIndex >= commands.length) return;
    const cmd = commands[cmdIndex++];
    console.log(`Sending: ${JSON.stringify(cmd)}`);
    proc.stdin.write(JSON.stringify(cmd) + '\n');
}

proc.on('close', (code) => {
    console.log(`Process exited with code ${code}`);
});
