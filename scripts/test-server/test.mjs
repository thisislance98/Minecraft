#!/usr/bin/env node
/**
 * Colyseus Client-Server Connectivity Tests
 * 
 * Tests against the minimal test server to verify basic Colyseus functionality.
 * Run with: node scripts/test-server/test.mjs
 */

import { Client } from "colyseus.js";
import WebSocket from "ws";

// Node.js WebSocket polyfill
global.WebSocket = WebSocket;

const SERVER_URL = "http://localhost:2568";
const TIMEOUT = 5000;

let passed = 0;
let failed = 0;

async function test(name, fn) {
    process.stdout.write(`  ${name.padEnd(40)} `);
    try {
        await Promise.race([
            fn(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), TIMEOUT))
        ]);
        console.log("✅");
        passed++;
    } catch (e) {
        console.log(`❌ ${e.message}`);
        failed++;
    }
}

async function main() {
    console.log("\n🧪 Colyseus Connectivity Tests");
    console.log("═".repeat(50));
    console.log(`📡 Server: ${SERVER_URL}`);
    console.log("═".repeat(50) + "\n");

    // Test 1: Health endpoint
    await test("Health endpoint responds", async () => {
        const res = await fetch(`${SERVER_URL}/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.status !== "ok") throw new Error("Status not ok");
    });

    // Test 2: Create client
    const client = new Client(SERVER_URL);
    await test("Create Colyseus client", async () => {
        if (!client) throw new Error("Client is null");
    });

    // Test 3: Create room
    let room;
    await test("Create room", async () => {
        room = await client.create("test", { name: "Tester1" });
        if (!room) throw new Error("Room is null");
        // room.id might be available as room.roomId in some versions
        const roomId = room.id || room.roomId;
        if (!roomId) {
            // Wait a bit for connection to establish
            await new Promise(r => setTimeout(r, 500));
        }
    });

    // Test 4: Receive welcome message on join
    await test("Receive welcome message", async () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("No welcome")), 3000);
            room.onMessage("welcome", (data) => {
                clearTimeout(timeout);
                if (!data.sessionId) reject(new Error("No sessionId in welcome"));
                resolve();
            });
        });
    });

    // Test 5: Ping-pong
    await test("Ping-pong message exchange", async () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("No pong")), 3000);
            room.onMessage("pong", (data) => {
                clearTimeout(timeout);
                if (data.test !== "hello") reject(new Error("Wrong data"));
                if (!data.serverTime) reject(new Error("No serverTime"));
                resolve();
            });
            room.send("ping", { test: "hello" });
        });
    });

    // Test 6: Counter broadcast
    await test("Counter increment broadcast", async () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("No counter update")), 3000);
            room.onMessage("counter", (data) => {
                clearTimeout(timeout);
                if (typeof data.value !== "number") reject(new Error("Invalid counter"));
                resolve();
            });
            room.send("increment");
        });
    });

    // Test 7: Leave room
    await test("Leave room cleanly", async () => {
        await room.leave();
    });

    // Test 8: Join by ID
    let room2, room3;
    await test("Create and join room by ID", async () => {
        room2 = await client.create("test", { name: "Host" });
        // Wait for room to be fully established
        await new Promise(r => setTimeout(r, 300));
        const roomId = room2.id || room2.roomId;
        if (!roomId) throw new Error("Host room has no ID");
        room3 = await client.joinById(roomId, { name: "Guest" });
        if (!room3) throw new Error("Failed to join");
    });

    // Test 9: Broadcast between clients
    await test("Broadcast between clients", async () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("No broadcast received")), 3000);
            room2.onMessage("broadcast", (data) => {
                clearTimeout(timeout);
                if (data.msg !== "hello") reject(new Error("Wrong broadcast data"));
                resolve();
            });
            room3.send("broadcast", { msg: "hello" });
        });
    });

    // Cleanup
    await room2?.leave().catch(() => { });
    await room3?.leave().catch(() => { });

    // Summary
    console.log("\n" + "═".repeat(50));
    console.log(`📊 Results: ${passed} passed, ${failed} failed`);
    console.log("═".repeat(50));

    if (failed > 0) {
        console.log("\n💥 Some tests failed.\n");
        process.exit(1);
    } else {
        console.log("\n🎉 All tests passed!\n");
        process.exit(0);
    }
}

main().catch((e) => {
    console.error("\n❌ Fatal error:", e.message);
    process.exit(1);
});
