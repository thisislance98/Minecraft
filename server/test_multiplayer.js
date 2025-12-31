const io = require('socket.io-client');

// Use the port defined in start.sh/server index.ts (2567 defined in server/index.ts)
const SERVER_URL = 'http://localhost:2567';

async function testMultiplayerVisibility() {
    console.log('🧪 Starting Multiplayer Visibility Test...');
    console.log(`Target Server: ${SERVER_URL}`);

    let client1 = null;
    let client2 = null;

    // State trackers
    const c1 = { id: null, room: null, peersSeen: [] };
    const c2 = { id: null, room: null, peersSeen: [] };

    let testFailed = false;

    // Helper to wrap events in promises
    const waitFor = (socket, event, timeout = 5000) => {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Timeout waiting for '${event}' on ${socket.id}`));
            }, timeout);

            socket.once(event, (data) => {
                clearTimeout(timer);
                resolve(data);
            });
        });
    };

    try {
        // ==========================================
        // STEP 1: Client 1 Connects and Joins
        // ==========================================
        console.log('\n[Step 1] Connecting Client 1...');

        client1 = io(SERVER_URL, { forceNew: true });
        await waitFor(client1, 'connect');

        c1.id = client1.id;
        console.log(`✅ Client 1 Connected: ${c1.id}`);

        client1.emit('join_game');
        const c1Join = await waitFor(client1, 'room:joined');
        c1.room = c1Join.roomId;
        console.log(`✅ Client 1 Joined Room: ${c1.room}`);

        // Client 1 sends initial position (simulating standard behavior)
        const c1Pos = { x: 10, y: 5, z: 10 };
        client1.emit('player:move', { pos: c1Pos, rotY: 1.5 });
        console.log(`✅ Client 1 sent initial position: ${JSON.stringify(c1Pos)}`);

        // Set up listener for when Client 2 joins (from Client 1's perspective)
        const c1SeePlayerPromise = new Promise(resolve => {
            client1.on('player:joined', (data) => {
                console.log(`[Client 1] Detected new player joined: ${data.id}`);
                resolve(data);
            });
        });

        // ==========================================
        // STEP 2: Client 2 Connects and Joins
        // ==========================================
        console.log('\n[Step 2] Connecting Client 2...');

        client2 = io(SERVER_URL, { forceNew: true });
        await waitFor(client2, 'connect');

        c2.id = client2.id;
        console.log(`✅ Client 2 Connected: ${c2.id}`);

        client2.emit('join_game');
        const c2Join = await waitFor(client2, 'room:joined');
        c2.room = c2Join.roomId;
        console.log(`✅ Client 2 Joined Room: ${c2.room}`);

        // VERIFY ROOM MATCH
        if (c1.room !== c2.room) {
            throw new Error(`Clients are in different rooms! C1: ${c1.room}, C2: ${c2.room}`);
        }
        console.log('✅ Both clients are in the same room.');

        // ==========================================
        // STEP 3: Verify Initial Sync (The Fix)
        // ==========================================
        console.log('\n[Step 3] Verifying Initial State Sync...');

        // Check if Client 2 received Client 1's state in the 'room:joined' payload
        const playerStates = c2Join.playerStates;
        if (!playerStates) {
            console.error('❌ FAIL: No playerStates in room:joined event!');
            testFailed = true;
        } else {
            const c1State = playerStates[c1.id];
            if (c1State) {
                console.log(`✅ PASS: Client 2 received Client 1's state immediately on join.`);
                console.log(`   - Position: ${JSON.stringify(c1State.pos)}`);
                console.log(`   - Rotation: ${c1State.rotY}`);

                if (c1State.pos && c1State.pos.x === 10) {
                    console.log('   - Data matches what Client 1 sent.');
                } else {
                    console.warn('   ⚠️ Data mismatch or empty (expected x=10).');
                }
            } else {
                console.error(`❌ FAIL: Client 1 (${c1.id}) not found in playerStates payload:`, Object.keys(playerStates));
                testFailed = true;
            }
        }

        // ==========================================
        // STEP 4: Real-time Movement Sync
        // ==========================================
        console.log('\n[Step 4] Verifying Real-time Sync...');

        // Client 2 moves, Client 1 should see it
        const c2MovePromise = new Promise(resolve => {
            client1.on('player:move', (data) => {
                if (data.id === c2.id) {
                    console.log(`✅ PASS: Client 1 received Client 2 move event.`);
                    resolve(data);
                }
            });
        });

        const c2Pos = { x: 20, y: 5, z: 20 };
        console.log(`[Client 2] Moving to ${JSON.stringify(c2Pos)}...`);
        client2.emit('player:move', { pos: c2Pos, rotY: 0.5 });

        // Wait for it
        await Promise.race([
            c2MovePromise,
            new Promise((_, r) => setTimeout(() => r(new Error('Timeout waiting for C2 move on C1')), 2000))
        ]);

        console.log('\n----------------------------------------');
        if (testFailed) {
            console.log('❌ TEST FAILED: See errors above.');
            process.exit(1);
        } else {
            console.log('🎉 TEST PASSED: Multiplayer visibility is correct.');
            process.exit(0);
        }

    } catch (e) {
        console.error('\n❌ TEST CRASHED:', e.message);
        process.exit(1);
    } finally {
        client1.close();
        client2.close();
    }
}

testMultiplayerVisibility();
