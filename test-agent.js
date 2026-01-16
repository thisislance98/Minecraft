
import WebSocket from 'ws';
import dotenv from 'dotenv';
dotenv.config();

const ws = new WebSocket('ws://localhost:3000/api/antigravity');

ws.on('open', () => {
    console.log('Connected to Antigravity Brain!');

    const prompt = process.argv[2] || "Who are you?";
    console.log(`Sending prompt: "${prompt}"`);

    ws.send(JSON.stringify({
        type: 'input',
        text: prompt,
        context: {
            position: { x: 0, y: 10, z: 0 },
            biome: 'Plains'
        }
    }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());

    if (msg.type === 'token') {
        process.stdout.write(msg.text);
    } else if (msg.type === 'tool_request') {
        console.log(`\n\n[Client Tool Request] Server asked to run: ${msg.name}`);
        console.log(`[Args] ${JSON.stringify(msg.args)}`);

        // Mock success response
        setTimeout(() => {
            console.log(`[Mock Client] Sending result for ${msg.name}...`);
            ws.send(JSON.stringify({
                type: 'tool_response',
                id: msg.id,
                result: { success: true, message: `Mock execution of ${msg.name} completed.` }
            }));
        }, 500); // Small delay to simulate work

    } else if (msg.type === 'tool_start') {
        console.log(`\n[Server Tool Start] ${msg.name}`);
    } else if (msg.type === 'tool_end') {
        console.log(`\n[Server Tool Result] ${JSON.stringify(msg.result)}`);
    } else if (msg.type === 'task_boundary') {
        console.log(`\n[Task Boundary] ${msg.TaskStatus} (${msg.Mode})`);
    } else if (msg.type === 'error') {
        console.error(`\n[Error] ${msg.message}`);
    }
});

ws.on('close', () => {
    console.log('\nDisconnected.');
});

ws.on('error', (err) => {
    console.error('Connection error:', err);
});
