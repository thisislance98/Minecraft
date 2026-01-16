
const WebSocket = require('ws');
require('dotenv').config({ path: '.env' });

const port = process.env.PORT || 2567;
const wsUrl = `ws://localhost:${port}/api/antigravity`;

console.log(`Connecting to ${wsUrl}...`);
const ws = new WebSocket(wsUrl);

ws.on('open', () => {
    console.log('✅ Connected to AI Agent.');
    // Simulate initial context
    ws.send(JSON.stringify({
        type: 'context',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        biome: 'plains'
    }));

    // Send the prompt
    setTimeout(() => {
        console.log('📤 Sending prompt: "Create a new creature called Ghost"');
        ws.send(JSON.stringify({
            type: 'input',
            text: 'Create a new creature called Ghost. It should be white and float.'
        }));
    }, 500);
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());

    if (msg.type === 'tool_start') {
        console.log('🛠️  AI Tool Call:', msg.name, msg.args);

        // FAILURE CONDITIONS (Searching)
        if (['view_file', 'list_dir', 'grep_search', 'read_url_content'].includes(msg.name)) {
            // If it looks at Animal.js, specifically fail
            if (JSON.stringify(msg.args).includes('Animal.js')) {
                console.error('❌ FAILURE: AI is reading Animal.js. Optimization failed.');
                process.exit(1);
            }
            if (JSON.stringify(msg.args).includes('create-creature.md')) {
                console.error('❌ FAILURE: AI is reading create-creature.md. Optimization failed.');
                process.exit(1);
            }
            console.log('⚠️  AI is searching...');
        }

        // SUCCESS CONDITION (Writing immediately)
        if (msg.name === 'write_to_file' && msg.args.TargetFile.includes('Ghost.js')) {
            console.log('✅ SUCCESS: AI is writing Ghost.js immediately!');
            if (msg.args.CodeContent.includes('extends Animal')) {
                console.log('   -> Content correctly extends Animal.');
                process.exit(0);
            } else {
                console.warn('   -> Warning: Code content might be missing inheritance.');
                process.exit(0); // Still a pass for optimization purposes
            }
        }
    } else if (msg.type === 'assistant_message') {
        console.log('🤖 AI Message:', msg.text);
    }
});

ws.on('error', (err) => {
    console.error('❌ Connection Error:', err);
    process.exit(1);
});

// Timeout after 20s
setTimeout(() => {
    console.log('⏰ Timeout waiting for response.');
    process.exit(1);
}, 20000);
