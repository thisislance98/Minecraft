import WebSocket from 'ws';

const MAIN_WS_URL = 'ws://localhost:2567/api/antigravity';

const SCENARIOS = [
    { name: "Edit Entity", prompt: "make the snowman bigger" },
    { name: "Create Creature", prompt: "create a new creature called FireFox that leaves a trail of fire" },
    { name: "Modify System", prompt: "make gravity lower" }
];

async function runScenario(scenario) {
    return new Promise((resolve) => {
        console.log(`\n--- Running Scenario: ${scenario.name} ---`);
        const ws = new WebSocket(MAIN_WS_URL);
        const stats = { toolCalls: 0, distinctTools: new Set(), toolLog: [] };

        let resolved = false;
        const finish = (result) => {
            if (resolved) return;
            resolved = true;
            ws.close();
            resolve({ ...stats, result });
        };

        ws.on('open', () => {
            ws.send(JSON.stringify({
                type: 'input',
                text: scenario.prompt,
                context: { position: { x: 0, y: 0, z: 0 }, biome: 'Plains' }
            }));
        });

        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());

            if (msg.type === 'tool_start' || msg.type === 'tool_request') {
                stats.toolCalls++;
                stats.distinctTools.add(msg.name);
                stats.toolLog.push(`${msg.name}(${JSON.stringify(msg.args)})`);
                process.stdout.write('.'); // Progress dot
            } else if (msg.type === 'error') {
                console.error(`\n❌ Error: ${msg.message}`);
                finish('Error');
            }
        });

        // Heuristic: If we get more than 10 tool calls, it's inefficient. 
        // Or if it processes for > 20 seconds.
        setTimeout(() => {
            console.log('\n(Timeout/Completed)');
            finish('Timeout/Done');
        }, 20000);
    });
}

(async () => {
    console.log("Starting Stress Test...");
    for (const scenario of SCENARIOS) {
        const result = await runScenario(scenario);
        console.log(`\nResults for '${scenario.name}':`);
        console.log(`  - Total Tool Calls: ${result.toolCalls}`);
        console.log(`  - Unique Tools: ${Array.from(result.distinctTools).join(', ')}`);
        console.log(`  - Tool Log:\n    ${result.toolLog.join('\n    ')}`);
    }
})();
