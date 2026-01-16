
import WebSocket from 'ws';
import readline from 'readline';

const WS_URL = 'ws://localhost:3000/api/antigravity';

const ws = new WebSocket(WS_URL);
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'YOU> '
});

console.log(`Connecting to ${WS_URL}...`);

ws.on('open', () => {
    console.log('Connected! Type your message and press Enter.');
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
        if (text.startsWith('/mode')) {
            const mode = text.split(' ')[1];
            const useCLI = mode === 'cli';
            console.log(`[Test] Switching to ${useCLI ? 'CLI' : 'API'}`);
            ws.send(JSON.stringify({
                type: 'config',
                config: { useCLI }
            }));
        } else {
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
    }
    rl.prompt();
});

function handleMessage(msg) {
    switch (msg.type) {
        case 'token':
            // Streaming text
            process.stdout.write(msg.text);
            break;
        case 'tool_start':
            console.log(`\n[TOOL] Calling ${msg.name} with args:`, JSON.stringify(msg.args));
            break;
        case 'tool_end':
            console.log(`\n[TOOL] Result:`, JSON.stringify(msg.result));
            // Re-prompt after tool execution as usually text follows or it's done
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
