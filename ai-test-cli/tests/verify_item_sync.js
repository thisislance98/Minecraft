import { io } from 'socket.io-client';
import assert from 'assert';

async function runTest() {
    // Determine server URL - check if running in a container or local
    const serverUrl = 'http://localhost:2567';
    console.log(`Connecting Client 1 to ${serverUrl}...`);

    const client1 = io(serverUrl);
    const client2 = io(serverUrl, { autoConnect: false });

    try {
        await new Promise(resolve => client1.on('connect', resolve));
        console.log('Client 1 Connected:', client1.id);

        // Client 1 joins
        client1.emit('join_game', { name: 'Player1' });
        await new Promise(resolve => client1.on('room:joined', resolve));
        console.log('Client 1 Joined Room');

        // Client 1 holds an item
        const testItem = 'diamond_sword';
        client1.emit('player:hold', { itemType: testItem });
        console.log('Client 1 holding:', testItem);

        // Wait a bit for server state to update
        await new Promise(resolve => setTimeout(resolve, 500));

        // Connect Client 2
        console.log('Connecting Client 2...');
        client2.connect();
        await new Promise(resolve => client2.on('connect', resolve));
        console.log('Client 2 Connected:', client2.id);

        // Client 2 joins and should receive Client 1's state
        client2.emit('join_game', { name: 'Player2' });

        const joinData = await new Promise(resolve => client2.on('room:joined', resolve));
        console.log('Client 2 Joined Room. Checking playerStates...');

        // Verify Client 1's state in joinData
        const player1State = joinData.playerStates[client1.id];

        if (!player1State) {
            throw new Error('Player 1 state not found in room:joined data');
        }

        console.log('Player 1 State seen by Client 2:', player1State);

        assert.strictEqual(player1State.heldItem, testItem, `Expected heldItem to be ${testItem}, got ${player1State.heldItem}`);
        console.log('✅ VERIFICATION PASSED: Held item correctly synced to new joiner.');

    } catch (err) {
        console.error('❌ TEST FAILED:', err);
        process.exit(1);
    } finally {
        client1.close();
        client2.close();
        process.exit(0);
    }
}

runTest();
