
import WebSocket from 'ws';
import readline from 'readline';

// Deployed Server URL
const WS_URL = 'wss://minecraft-server-600817915451.us-central1.run.app/api/antigravity';

const ws = new WebSocket(WS_URL);
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'YOU> '
});

console.log(`Connecting to ${WS_URL}...`);

ws.on('open', () => {
    console.log('Connected! Type your message and press Enter.');
    // Send initial config to disable CLI mode explicitly (though server defaults to false for API)
    ws.send(JSON.stringify({
        type: 'config',
        config: { useCLI: false }
    }));
    rl.prompt();
});

ws.on('message', (data) => {
    try {
        const msg = JSON.parse(data);
        handleMessage(msg);
    } catch (e) {
        console.error('Error parsing message:', e);
    }
});

ws.on('close', () => {
    console.log('\nDisconnected.');
    process.exit(0);
});

ws.on('error', (err) => {
    console.error('\nWebSocket Error:', err.message);
    process.exit(1);
});

rl.on('line', (line) => {
    const text = line.trim();
    if (text) {
        // Send message with mock context
        ws.send(JSON.stringify({
            type: 'input',
            text: text,
            context: {
                position: { x: 10, y: 64, z: -10 },
                rotation: { x: 0, y: 0 },
                biome: 'PLAINS'
            }
        }));
        console.log('AI> Waiting for response...');
    }
    rl.prompt();
});

function handleMessage(msg) {
    switch (msg.type) {
        case 'token':
            process.stdout.write(msg.text);
            break;
        case 'tool_start':
            console.log(`\n[TOOL] Calling ${msg.name} with args:`, JSON.stringify(msg.args));
            break;
        case 'tool_end':
            console.log(`\n[TOOL] Result:`, JSON.stringify(msg.result));
            rl.prompt();
            break;
        case 'error':
            console.error('\n[ERROR]', msg.message);
            rl.prompt();
            break;
        default:
            console.log('\n[Unknown Msg]', msg);
    }
}
