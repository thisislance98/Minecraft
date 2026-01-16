
import { Client } from "colyseus.js";
import { v4 as uuidv4 } from 'uuid';

// Node.js WebSocket polyfill for Colyseus
import WebSocket from 'ws';
global.WebSocket = WebSocket;

const SERVER_URL = "http://localhost:2567";

async function runTest() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log("Usage: node scripts/test-ai.js \"<prompt>\"");
        console.log("Example: node scripts/test-ai.js \"create a zebra\"");
        return;
    }

    const prompt = args.join(" ");
    const debugId = uuidv4();

    console.log(`\n🤖 Connecting to Game Server at ${SERVER_URL}...`);
    console.log(`📡 Sending Prompt: "${prompt}"`);
    console.log("----------------------------------------");

    const client = new Client(SERVER_URL);

    try {
        // First, check for existing rooms via HTTP API
        let rooms = [];
        try {
            const response = await fetch(`${SERVER_URL}/matchmake/game`);
            if (response.ok) {
                rooms = await response.json();
            }
        } catch (e) {
            // API may not be available, that's ok
        }

        let room;
        if (rooms.length > 0) {
            // Join the first available room (where the browser is)
            const targetRoom = rooms[0];
            console.log(`📍 Found existing room: ${targetRoom.roomId} (${targetRoom.clients} clients)`);
            room = await client.joinById(targetRoom.roomId, { name: "CLI_Tester" });
        } else {
            // No rooms found via API, try joinOrCreate which will find or create
            console.log("📍 Checking for existing rooms via joinOrCreate...");
            room = await client.joinOrCreate("game", { name: "CLI_Tester" });
        }

        console.log(`✅ Connected to Room: ${room.id}`);

        // Listen for the response
        room.onMessage("debugResponse", (data) => {
            if (data.debugId === debugId) {
                console.log(`\n📩 RESPONSE RECEIVED:`);
                console.dir(data, { depth: null, colors: true });

                verifyResponse(data, prompt);

                console.log("\n----------------------------------------");
                process.exit(0);
            }
        });

        // Send the command
        room.send("debugCommand", {
            debugId: debugId,
            prompt: prompt
        });

        // Timeout if no response
        setTimeout(() => {
            console.error("\n❌ Timeout: No response received from game client within 30s.");
            console.error("Make sure the game is running in a browser window!");
            process.exit(1);
        }, 30000);

    } catch (e) {
        console.error("\n❌ Connection Error:", e);
        process.exit(1);
    }
}

function verifyResponse(data, prompt) {
    console.log(`\n✅ VERIFICATION:`);

    if (data.error) {
        console.log(`   ❌ Error returned: ${data.error}`);
        return;
    }

    if (data.tool === 'spawn_creature') {
        console.log(`   - Tool: spawn_creature`);
        console.log(`   - Creature: ${data.creature}`);
        console.log(`   - Count: ${data.count}`);

        if (data.approxSpawnX !== undefined) {
            console.log(`   - 📍 Spawn Position: (${data.approxSpawnX.toFixed(1)}, ${data.approxSpawnZ.toFixed(1)})`);
            console.log(`   - (User verified logic: Spawned "in front" of player)`);
        }
    } else if (data.tool === 'teleport_player') {
        console.log(`   - Tool: teleport_player`);
        console.log(`   - Location: ${data.location}`);
    } else if (data.tool === 'perform_task') {
        console.log(`   - Tool: perform_task`);
        console.log(`   - Request: ${data.request}`);
    } else {
        console.log(`   - Tool: ${data.tool}`);
    }
}

runTest();
