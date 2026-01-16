
import { Client } from "colyseus.js";
import WebSocket from 'ws';

// Polyfill
global.WebSocket = WebSocket;

async function checkDevRoom() {
    console.log("Checking for dev_room...");
    const client = new Client("ws://localhost:2567");

    try {
        // Try to join 'dev_room' by ID
        console.log("Attempting to joinById('dev_room')...");
        const room = await client.joinById("dev_room", { name: "Checker" });
        console.log("✅ SUCCESSFULLY joined dev_room!");
        console.log("SessionId:", room.sessionId);

        await room.leave();
        process.exit(0);
    } catch (e) {
        console.error("❌ FAILED to join dev_room:", e.message);
        process.exit(1);
    }
}

checkDevRoom();
