
const { io } = require('socket.io-client');

async function testHealthAndDeath(game) {
    console.log('Starting Health and Death Verification Test...');

    const serverUrl = 'http://localhost:2567';
    const fakeSocket = io(serverUrl);
    const fakeId = 'FakeRemotePlayer_' + Math.floor(Math.random() * 1000);

    // Wait for connection
    await new Promise(resolve => fakeSocket.on('connect', resolve));
    console.log('Fake player connected:', fakeSocket.id);

    fakeSocket.emit('join_game', { name: fakeId });

    // Wait a bit for the main client to receive the join event
    await new Promise(resolve => setTimeout(resolve, 500));

    // Send movement with health update
    console.log('Sending move with health 15/20');
    fakeSocket.emit('player:move', {
        pos: { x: 32, y: 80, z: 32 },
        rotY: 0,
        isCrouching: false,
        health: 15,
        maxHealth: 20
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify health update on main client
    const remoteMesh = game.socketManager.playerMeshes.get(fakeSocket.id);
    if (!remoteMesh) {
        console.error('Remote mesh not found on main client!');
        process.exit(1);
    }

    if (remoteMesh.health !== 15) {
        console.error(`Health mismatch! Expected 15 but got ${remoteMesh.health}`);
        process.exit(1);
    }
    console.log('Health update verified!');

    // Send death event
    console.log('Sending death event');
    fakeSocket.emit('player:death', { id: fakeSocket.id }); // Payload might be ignored but good practice

    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify death state
    if (!remoteMesh.isDying) {
        console.error('Death state not set on main client!');
        process.exit(1);
    }
    console.log('Death state verified!');

    console.log('Disconnecting fake player');
    fakeSocket.disconnect();

    console.log('TEST PASSED');
    return true;
}

module.exports = testHealthAndDeath;
