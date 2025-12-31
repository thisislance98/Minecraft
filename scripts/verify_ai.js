import WebSocket from 'ws';

const MAIN_WS_URL = 'ws://localhost:2567/api/antigravity';

// Mock context
const context = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    biome: 'Forest'
};

const ws = new WebSocket(MAIN_WS_URL);

ws.on('open', () => {
    console.log('Connected to AI Brain');

    // Simulate user request
    const payload = {
        type: 'input',
        text: 'make the snowman blocky',
        context: context
    };

    ws.send(JSON.stringify(payload));
    console.log('Sent request: make the snowman blocky');
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());

    // Log meaningful events
    if (msg.type === 'tool_start' || msg.type === 'tool_request') {
        console.log('TOOL CALL:', msg.name, msg.args);

        // Success Criteria: AI attempts to read the correct path
        // Success Criteria: AI attempts to read the correct path
        if ((msg.name === 'list_dir' || msg.name === 'view_file' || msg.name === 'replace_file_content') &&
            (msg.args.DirectoryPath?.includes('../src') || msg.args.AbsolutePath?.includes('../src') || msg.args.TargetFile?.includes('../src'))) {
            console.log(`✅ SUCCESS: AI is correctly accessing parent directory ../src via ${msg.name}`);
            // Don't exit yet, wait to see text output
        }
    } else if (msg.type === 'thought') {
        process.stdout.write(`\nThought: ${msg.text}`);
    } else if (msg.type === 'token') {
        process.stdout.write(msg.text); // Stream text to console
    } else if (msg.type === 'error') {
        console.error('❌ Error from AI:', msg.message);
        process.exit(1);
    }
});

// Timeout
setTimeout(() => {
    console.log('\n--- Timeout/End ---');
    process.exit(0);
}, 20000);
