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
    { tool: 'wait', session_id: 'test_sess', args: { ms: 10000 } }, // Give it time to load
    { tool: 'spawn_creature', session_id: 'test_sess', args: { type: 'Cow', count: 1 } },
    { tool: 'wait', session_id: 'test_sess', args: { ms: 2000 } },
    { tool: 'get_game_state', session_id: 'test_sess' },
    { tool: 'browser_close', session_id: 'test_sess' },
    { tool: 'exit' }
];

let cmdIndex = 0;

proc.stdout.on('data', (data) => {
    const str = data.toString();
    console.log(`[OUT] ${str.trim()}`);

    if (str.includes('Game Driver Interactive Mode')) {
        setTimeout(sendNext, 500);
    } else if (str.trim().startsWith('{')) {
        setTimeout(sendNext, 1000); // Got a JSON response
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

proc.on('close', (code) => {
    console.log(`Process exited with code ${code}`);
});
