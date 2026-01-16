
import { Client } from 'colyseus.js';
import { WebSocket } from 'ws';

// Shim WebSocket for Node.js environment if needed by colyseus.js
if (!global.WebSocket) {
    global.WebSocket = WebSocket;
}

const SERVER_URL = 'ws://localhost:2567';

async function testMultiplayer() {
    console.log('🧪 Starting Multiplayer Join Test...');

    const hostClient = new Client(SERVER_URL);
    const guestClient = new Client(SERVER_URL);

    try {
        // 1. Host creates room
        console.log('1️⃣  Host connecting...');
        const hostRoom = await hostClient.create('game', { name: 'Host' });
        console.log(`✅ Host created room: ${hostRoom.roomId} (Session: ${hostRoom.sessionId})`);

        // Verify initial state
        console.log('   Host room state keys:', Object.keys(hostRoom.state || {}));
        if (hostRoom.state.players) {
            console.log(`   Host initial players: ${hostRoom.state.players.size}`);
        } else {
            console.log('   ⚠️ Host state.players is undefined');
        }

        // 2. Guest joins room
        console.log(`\n2️⃣  Guest joining room ${hostRoom.roomId}...`);
        const guestRoom = await guestClient.joinById(hostRoom.roomId, { name: 'Guest' });
        console.log(`✅ Guest joined room: ${guestRoom.roomId} (Session: ${guestRoom.sessionId})`);

        // 3. Verify connection
        if (hostRoom.roomId !== guestRoom.roomId) {
            throw new Error('❌ Room IDs do not match!');
        }

        // Wait for state sync
        console.log('\n⏳ Waiting for state synchronization...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 4. Verify player counts
        console.log('\n📊 Checking Player Counts:');
        console.log(`   Host sees: ${hostRoom.state.players.size} players`);
        console.log(`   Guest sees: ${guestRoom.state.players.size} players`);

        if (hostRoom.state.players.size === 2 && guestRoom.state.players.size === 2) {
            console.log('\n✅ SUCCESS: Both players connected and visible to each other!');
        } else {
            console.error('\n❌ FAILURE: Player counts are incorrect (Expected 2)');
            process.exit(1);
        }

        // Cleanup
        hostRoom.leave();
        guestRoom.leave();
        process.exit(0);

    } catch (e) {
        console.error('\n❌ TEST FAILED:', e.message);
        console.error(e);
        process.exit(1);
    }
}

testMultiplayer();
