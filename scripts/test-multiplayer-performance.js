#!/usr/bin/env node
/**
 * Multiplayer Performance Test Script
 * 
 * This script:
 * 1. Connects to the game server as a fake client
 * 2. Joins/creates a room
 * 3. Sends player updates at the same rate as a real client (~20Hz)
 * 4. Reports stats every few seconds
 * 
 * Usage:
 *   node scripts/test-multiplayer-performance.js [roomId]
 * 
 * If roomId is provided, joins that room. Otherwise creates a new room.
 */

const { io } = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:2567';
const ROOM_ID = process.argv[2] || null;
const UPDATE_INTERVAL_MS = 50; // 20Hz, same as client throttle
const REPORT_INTERVAL_MS = 5000;

console.log('=== Multiplayer Performance Test ===');
console.log(`Server: ${SERVER_URL}`);
console.log(`Room ID: ${ROOM_ID || '(will create new)'}`);
console.log('');

// Connect to server
const socket = io(SERVER_URL, {
    transports: ['websocket'],
    reconnection: false,
    timeout: 10000
});

let roomId = ROOM_ID;
let updatesSent = 0;
let updatesReceived = 0;
let position = { x: 32, y: 50, z: 32 };
let time = 0;

// Connection events
socket.on('connect', () => {
    console.log(`✅ Connected! Socket ID: ${socket.id}`);

    if (roomId) {
        // Join existing room
        console.log(`Joining room: ${roomId}`);
        socket.emit('room:join', { roomId, playerName: 'TestBot' }, (response) => {
            if (response.error) {
                console.error('❌ Failed to join room:', response.error);
                process.exit(1);
            }
            console.log(`✅ Joined room: ${response.roomId}`);
            startSendingUpdates();
        });
    } else {
        // Create new room
        console.log('Creating new room...');
        socket.emit('room:create', { playerName: 'TestBot' }, (response) => {
            if (response.error) {
                console.error('❌ Failed to create room:', response.error);
                process.exit(1);
            }
            roomId = response.roomId;
            console.log(`✅ Created room: ${roomId}`);
            console.log(`\n📋 Share this room ID with the browser client: ${roomId}\n`);
            startSendingUpdates();
        });
    }
});

socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error.message);
    process.exit(1);
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
    process.exit(0);
});

// Track incoming updates from other players
socket.on('player:update', (data) => {
    updatesReceived++;
});

socket.on('player:joined', (player) => {
    console.log(`👋 Player joined: ${player.id}`);
});

socket.on('player:left', (playerId) => {
    console.log(`👋 Player left: ${playerId}`);
});

function startSendingUpdates() {
    console.log(`\n🎮 Starting to send updates at ${1000 / UPDATE_INTERVAL_MS}Hz...`);
    console.log('Press Ctrl+C to stop\n');

    // Send updates at regular intervals
    const updateTimer = setInterval(() => {
        // Simulate walking in a circle
        time += 0.05;
        position.x = 32 + Math.sin(time) * 10;
        position.z = 32 + Math.cos(time) * 10;

        socket.emit('player:update', {
            position: position,
            rotation: { x: 0, y: time },
            animation: 'walking',
            heldItem: ''
        });

        updatesSent++;
    }, UPDATE_INTERVAL_MS);

    // Report stats periodically
    const reportTimer = setInterval(() => {
        console.log(`📊 Stats: Sent ${updatesSent} updates, Received ${updatesReceived} updates`);
        updatesSent = 0;
        updatesReceived = 0;
    }, REPORT_INTERVAL_MS);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\n🛑 Stopping test...');
        clearInterval(updateTimer);
        clearInterval(reportTimer);
        socket.disconnect();
        process.exit(0);
    });
}
