
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3000/api/antigravity');

ws.on('open', function open() {
    console.log('Connected to WebSocket');
    ws.send(JSON.stringify({
        type: 'input',
        text: 'Hello, are you using the CLI?',
        context: { position: { x: 0, y: 0, z: 0 } }
    }));
});

ws.on('message', function message(data) {
    const msg = JSON.parse(data);
    console.log('Received:', msg);

    if (msg.type === 'token' || msg.type === 'tool_start') {
        console.log('SUCCESS: Received response from AI');
        process.exit(0);
    }

    if (msg.type === 'error') {
        console.error('FAILURE: Received error:', msg.payload);
        process.exit(1);
    }
});

ws.on('error', function error(err) {
    console.error('WebSocket Error:', err);
    process.exit(1);
});

// Timeout
setTimeout(() => {
    console.error('TIMEOUT: No response received in 20s');
    process.exit(1);
}, 20000);
