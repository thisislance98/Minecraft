#!/usr/bin/env node
/**
 * Direct test of admin delete via socket - bypasses UI
 * Tests if server-side handler is receiving and processing events
 */

import { io as ioClient } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:2567';
const CREATURE_NAME = process.argv[2] || 'Worm';

console.log(`Testing admin:delete_creature for: ${CREATURE_NAME}`);
console.log(`Connecting to: ${SERVER_URL}`);

const socket = ioClient(SERVER_URL, {
    transports: ['websocket'],
    autoConnect: true
});

socket.on('connect', () => {
    console.log('✓ Connected to server');

    // Listen for responses
    socket.on('admin:error', (data) => {
        console.log('[Server Response] admin:error:', data);
    });

    socket.on('creature_deleted', (data) => {
        console.log('✓ [Server Response] creature_deleted:', data);
    });

    socket.on('item_deleted', (data) => {
        console.log('✓ [Server Response] item_deleted:', data);
    });

    // Send delete request without token (should fail with auth error)
    console.log('\n--- Test 1: Delete without token ---');
    socket.emit('admin:delete_creature', { name: CREATURE_NAME, token: null });

    setTimeout(() => {
        // Test with fake token
        console.log('\n--- Test 2: Delete with fake token ---');
        socket.emit('admin:delete_creature', { name: CREATURE_NAME, token: 'fake-token-12345' });
    }, 1000);

    setTimeout(() => {
        console.log('\n--- Done with tests ---');
        console.log('Check the SERVER logs for [Admin] messages.');
        console.log('If you see "Received admin:delete_creature event" logs, the handlers are working.');
        socket.disconnect();
        process.exit(0);
    }, 3000);
});

socket.on('connect_error', (err) => {
    console.error('Connection error:', err.message);
    process.exit(1);
});
