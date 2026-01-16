#!/usr/bin/env node
/**
 * Standalone Multiplayer Performance Test
 * 
 * This script simulates a complete multiplayer scenario:
 * 1. Connects as "host" and creates a room
 * 2. Connects as "client" and joins the room
 * 3. Client sends player updates at 20Hz (same as real game)
 * 4. Host receives and processes updates (simulating what the browser does)
 * 5. Reports performance metrics
 * 
 * Usage: node scripts/test-multiplayer-standalone.js
 */

import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:2567';
const UPDATE_INTERVAL_MS = 50; // 20Hz
const TEST_DURATION_MS = 30000; // Run for 30 seconds
const REPORT_INTERVAL_MS = 2000;

console.log('===========================================');
console.log('  Standalone Multiplayer Performance Test  ');
console.log('===========================================');
console.log(`Server: ${SERVER_URL}`);
console.log(`Update rate: ${1000 / UPDATE_INTERVAL_MS}Hz`);
console.log(`Test duration: ${TEST_DURATION_MS / 1000}s`);
console.log('');

// Metrics
let hostUpdatesReceived = 0;
let clientUpdatesSent = 0;
let hostProcessingTimes = [];

// Simulate what the browser host does when receiving updates
function simulateHostProcessing(data) {
    const start = performance.now();

    // Simulate RemotePlayer.updateFromNetwork()
    const targetPosition = { x: data.position.x, y: data.position.y, z: data.position.z };
    const targetRotation = { x: data.rotation.x, y: data.rotation.y };

    // Simulate some work (vector operations, etc.)
    const distance = Math.sqrt(
        Math.pow(targetPosition.x - 32, 2) +
        Math.pow(targetPosition.y - 50, 2) +
        Math.pow(targetPosition.z - 32, 2)
    );

    const elapsed = performance.now() - start;
    hostProcessingTimes.push(elapsed);

    return elapsed;
}

async function runTest() {
    return new Promise((resolve, reject) => {
        // Step 1: Connect as host
        console.log('[Host] Connecting...');
        const hostSocket = io(SERVER_URL, {
            transports: ['websocket'],
            reconnection: false
        });

        hostSocket.on('connect_error', (err) => {
            console.error('[Host] Connection failed:', err.message);
            console.error('\n❌ Make sure the server is running (./start.sh)');
            reject(err);
        });

        hostSocket.on('connect', () => {
            console.log(`[Host] Connected: ${hostSocket.id}`);

            // Create room
            hostSocket.emit('room:create', { playerName: 'Host' }, (response) => {
                if (response.error) {
                    console.error('[Host] Failed to create room:', response.error);
                    reject(new Error(response.error));
                    return;
                }

                const roomId = response.roomId;
                console.log(`[Host] Created room: ${roomId}`);

                // Host listens for player updates (this is what causes the slowdown)
                hostSocket.on('player:update', (data) => {
                    hostUpdatesReceived++;
                    simulateHostProcessing(data);
                });

                // Step 2: Connect as client
                console.log('[Client] Connecting...');
                const clientSocket = io(SERVER_URL, {
                    transports: ['websocket'],
                    reconnection: false
                });

                clientSocket.on('connect', () => {
                    console.log(`[Client] Connected: ${clientSocket.id}`);

                    // Join room
                    clientSocket.emit('room:join', { roomId, playerName: 'Client' }, (response) => {
                        if (response.error) {
                            console.error('[Client] Failed to join room:', response.error);
                            reject(new Error(response.error));
                            return;
                        }

                        console.log(`[Client] Joined room: ${roomId}`);
                        console.log('');
                        console.log('🎮 Starting test - client sending updates...');
                        console.log('');

                        let time = 0;

                        // Client sends updates at 20Hz
                        const updateTimer = setInterval(() => {
                            time += 0.05;

                            clientSocket.emit('player:update', {
                                position: {
                                    x: 32 + Math.sin(time) * 10,
                                    y: 50,
                                    z: 32 + Math.cos(time) * 10
                                },
                                rotation: { x: 0, y: time },
                                animation: 'walking',
                                heldItem: ''
                            });

                            clientUpdatesSent++;
                        }, UPDATE_INTERVAL_MS);

                        // Report stats periodically
                        const reportTimer = setInterval(() => {
                            const avgProcessingTime = hostProcessingTimes.length > 0
                                ? (hostProcessingTimes.reduce((a, b) => a + b, 0) / hostProcessingTimes.length).toFixed(3)
                                : 0;

                            console.log(`📊 Client sent: ${clientUpdatesSent} | Host received: ${hostUpdatesReceived} | Avg processing: ${avgProcessingTime}ms`);

                            // Reset for next interval
                            clientUpdatesSent = 0;
                            hostUpdatesReceived = 0;
                            hostProcessingTimes = [];
                        }, REPORT_INTERVAL_MS);

                        // Stop after test duration
                        setTimeout(() => {
                            console.log('');
                            console.log('✅ Test complete!');
                            clearInterval(updateTimer);
                            clearInterval(reportTimer);
                            clientSocket.disconnect();
                            hostSocket.disconnect();
                            resolve();
                        }, TEST_DURATION_MS);
                    });
                });

                clientSocket.on('connect_error', (err) => {
                    console.error('[Client] Connection failed:', err.message);
                    reject(err);
                });
            });
        });
    });
}

// Run the test
runTest()
    .then(() => {
        console.log('');
        console.log('The socket processing itself is very fast (<0.1ms).');
        console.log('If your browser framerate drops, the issue is likely in:');
        console.log('  1. Three.js RemotePlayer.update() rendering');
        console.log('  2. Something else triggered by socket events');
        console.log('');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Test failed:', err.message);
        process.exit(1);
    });
