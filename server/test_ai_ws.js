
const WebSocket = require('ws');
require('dotenv').config({ path: '.env' });

const port = process.env.PORT || 2567;
const wsUrl = `ws://localhost:${port}/api/antigravity`;

console.log(`Connecting to ${wsUrl}...`);
const ws = new WebSocket(wsUrl);

ws.on('open', () => {
    console.log('✅ Connected to AI Agent.');

    // Simulate initial context
    const initCtx = {
        type: 'context',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        biome: 'plains'
    };
    ws.send(JSON.stringify(initCtx));

    // Send the prompt
    setTimeout(() => {
        console.log('📤 Sending prompt: "spawn a slime"');
        ws.send(JSON.stringify({
            type: 'input',
            text: 'spawn a slime'
        }));
    }, 500);
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());

    // Check for tool calls (Server sends 'tool_start')
    if (msg.type === 'tool_start') {
        console.log('🛠️  AI Tool Call:', msg.name, msg.args);

        // Check if it's spawn_creature (client tool) OR run_command (if it decided to use that)
        if (msg.name === 'spawn_creature' || (msg.name === 'run_command' && JSON.stringify(msg.args).includes('Slime'))) {
            if (msg.name === 'spawn_creature' && msg.args.type === 'Slime') {
                console.log('✅ SUCCESS: AI attempted to spawn Slime directly!');
                process.exit(0);
            }
            if (msg.name === 'run_command') {
                console.log('✅ SUCCESS: AI used run_command (acceptable).');
                process.exit(0);
            }
        }

        // If it starts searching, that's a failure
        if (msg.name === 'find_by_name' || msg.name === 'grep_search' || msg.name === 'list_dir') {
            console.log('⚠️  WARNING: AI is searching... Prompt might not be fully effective.');
            // Don't exit yet, see if it eventually finds it, but log it.
        }
    } else if (msg.type === 'assistant_message') {
        console.log('🤖 AI Message:', msg.text);
    } else if (msg.type === 'thought') {
        // console.log('Thinking...', msg.text);
    } else if (msg.type === 'error') {
        console.error('❌ AI Error:', msg.message);
    }
});

ws.on('error', (err) => {
    console.error('❌ Connection Error:', err);
    process.exit(1);
});

// Timeout after 20s (give it time to think)
setTimeout(() => {
    console.log('⏰ Timeout waiting for response.');
    process.exit(1);
}, 20000);
