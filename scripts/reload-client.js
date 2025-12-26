import { Client } from "colyseus.js";
import WebSocket from 'ws';
global.WebSocket = WebSocket;

const SERVER_URL = "http://localhost:2567";

async function reloadClient() {
    console.log(`🤖 Connecting to Game Server at ${SERVER_URL}...`);
    const client = new Client(SERVER_URL);

    try {
        // Try to join existing "game" room (HTTP fetch for matchmaking)
        console.log("📍 Checking for existing rooms...");
        let room;

        try {
            // First list rooms
            const listUrl = `${SERVER_URL}/matchmake/game`; // This endpoint might vary depending on Colyseus setup, but usually client.join methods handle it.
            // Let's use the same logic as test-ai.js which uses fetch to find rooms?
            // Actually, client.join("game") might create a new one.
            // We want to find the existing room.

            // NOTE: test-ai.js uses:
            // const response = await fetch(`${SERVER_URL}/matchmake/game`);
            // But wait, /matchmake/<name> is POST usually?
            // Let's use getAvailableRooms logic from client if possible, or just reproduce test-ai.js logic.
            // test-ai.js logic seems to work for finding rooms (Step 520).

            const response = await fetch(`${SERVER_URL}/matchmake/game`, {
                method: 'GET', // Or POST?
                headers: { 'Accept': 'application/json' }
            });
            // Actually test-ai.js uses GET (default fetch) in line 32.

            let rooms = [];
            if (response.ok) {
                rooms = await response.json();
            }

            if (rooms.length > 0) {
                console.log(`✅ Found existing room: ${rooms[0].roomId}`);
                room = await client.joinById(rooms[0].roomId);
            }

        } catch (e) {
            console.log("ℹ️ Could not join existing room via HTTP check", e);
        }

        if (!room) {
            console.log("❌ No active game room found. Cannot reload client. (Browser might not be open)");
            process.exit(1);
        }

        console.log(`✅ Connected to Room: ${room.name}`);

        // Send reload command
        console.log("🔄 Sending RELOAD command...");
        room.send("debugCommand", { action: 'reload' });

        console.log("✅ Command sent. Exiting...");
        setTimeout(() => process.exit(0), 1000);

    } catch (e) {
        console.error("❌ Connection Error:", e);
        process.exit(1);
    }
}

reloadClient();
