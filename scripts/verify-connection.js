
import { Client } from "colyseus.js";
import WebSocket from 'ws';

// Polyfill
global.WebSocket = WebSocket;

async function main() {
    console.log("Creating client...");
    const client = new Client("ws://localhost:2567");

    try {
        console.log("Joining...");
        const room = await client.joinOrCreate("game", { name: "Verifier" });
        console.log("✅ Joined room:", room.roomId);
        console.log("SessionId:", room.sessionId);

        room.leave();
        process.exit(0);
    } catch (e) {
        console.error("❌ Failed:", e);
        process.exit(1);
    }
}

main();
