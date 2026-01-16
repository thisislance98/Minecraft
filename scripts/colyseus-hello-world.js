#!/usr/bin/env node
/**
 * Colyseus Hello World Test
 * 
 * Simple tests to verify basic Colyseus client-server connectivity.
 * Run with: node scripts/colyseus-hello-world.js
 */

import { Client } from "colyseus.js";
import WebSocket from 'ws';

// Node.js WebSocket polyfill
global.WebSocket = WebSocket;

const SERVER_URL = process.env.SERVER_URL || "http://localhost:2567";
const TIMEOUT = 10000; // 10 seconds

console.log('\n🧪 Colyseus Hello World Tests');
console.log('═'.repeat(50));
console.log(`📡 Server: ${SERVER_URL}`);
console.log('═'.repeat(50));

let passed = 0;
let failed = 0;

async function test(name, fn) {
    process.stdout.write(`  ${name.padEnd(35)} `);
    try {
        await Promise.race([
            fn(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), TIMEOUT)
            )
        ]);
        console.log('✅ PASS');
        passed++;
    } catch (e) {
        console.log(`❌ FAIL: ${e.message}`);
        failed++;
    }
}

async function main() {
    // Test 1: Health endpoint
    await test('Health endpoint responds', async () => {
        const res = await fetch(`${SERVER_URL}/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.status !== 'ok') throw new Error('Status not ok');
    });

    // Test 2: Create client
    let client;
    await test('Create Colyseus client', async () => {
        client = new Client(SERVER_URL);
        if (!client) throw new Error('Client is null');
    });

    // Test 3: Create a room
    let room;
    await test('Create room', async () => {
        room = await client.create("game", { name: 'HelloWorld_Test' });
        if (!room) throw new Error('Room is null');
        if (!room.id) throw new Error('Room has no ID');
        console.log(`(room: ${room.id.substring(0, 8)}...)`);
    });

    // Test 4: Room receives worldSeed message
    await test('Receive worldSeed message', async () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('No worldSeed received')), 5000);
            room.onMessage('worldSeed', (data) => {
                clearTimeout(timeout);
                if (data.seed === undefined) reject(new Error('No seed in message'));
                resolve();
            });
        });
    });

    // Test 5: Send and receive debug command
    await test('Send/receive debugCommand', async () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('No debugCommand echo')), 5000);
            room.onMessage('debugCommand', (data) => {
                clearTimeout(timeout);
                if (data.test !== 'hello') reject(new Error('Wrong data'));
                resolve();
            });
            room.send('debugCommand', { test: 'hello' });
        });
    });

    // Test 6: Leave room cleanly
    await test('Leave room', async () => {
        await room.leave();
    });

    // Test 7: Join existing room (create new, then join by ID)
    let room2, room3;
    await test('Join room by ID', async () => {
        room2 = await client.create("game", { name: 'JoinTest' });
        room3 = await client.joinById(room2.id, { name: 'Joiner' });
        if (!room3) throw new Error('Failed to join');
        console.log(`(joined: ${room3.id.substring(0, 8)}...)`);
    });

    // Cleanup
    if (room2) await room2.leave().catch(() => { });
    if (room3) await room3.leave().catch(() => { });

    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log(`📊 Results: ${passed} passed, ${failed} failed`);
    console.log('═'.repeat(50));

    if (failed > 0) {
        console.log('\n💥 Some tests failed.\n');
        process.exit(1);
    } else {
        console.log('\n🎉 All tests passed!\n');
        process.exit(0);
    }
}

main().catch(e => {
    console.error('\n❌ Fatal error:', e.message);
    process.exit(1);
});
