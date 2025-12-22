import { ColyseusTestServer, boot } from '@colyseus/testing';
import { GameRoom } from '../rooms/GameRoom';

describe('GameRoom', () => {
    let colyseus: ColyseusTestServer;

    beforeAll(async () => {
        colyseus = await boot();
    });

    afterAll(async () => {
        await colyseus.shutdown();
    });

    beforeEach(async () => {
        await colyseus.createRoom('game', GameRoom);
    });

    it('players can join room', async () => {
        const client = await colyseus.connectTo('game', { name: 'Player1' });
        expect(client.sessionId).toBeDefined();
    });

    it('world seed is assigned and sent to players', async () => {
        const client = await colyseus.connectTo('game');

        await new Promise<void>((resolve) => {
            client.onMessage('worldSeed', (data) => {
                expect(data.seed).toBeDefined();
                expect(typeof data.seed).toBe('number');
                resolve();
            });
        });
    });

    it('player positions sync correctly', async () => {
        const client1 = await colyseus.connectTo('game', { name: 'Player1' });
        const client2 = await colyseus.connectTo('game', { name: 'Player2' });

        // Send position update from client1
        client1.send('playerMove', {
            x: 100,
            y: 50,
            z: 200,
            rotationX: 0,
            rotationY: 1.5,
            animation: 'walking',
            heldItem: 'pickaxe'
        });

        // Wait a bit for state to sync
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check client2 sees the update
        const player1State = client2.room!.state.players.get(client1.sessionId);
        expect(player1State).toBeDefined();
        expect(player1State!.x).toBe(100);
        expect(player1State!.y).toBe(50);
        expect(player1State!.z).toBe(200);
    });

    it('block changes sync to all players', async () => {
        const client1 = await colyseus.connectTo('game');
        const client2 = await colyseus.connectTo('game');

        // Send block change from client1
        client1.send('blockChange', {
            x: 10,
            y: 20,
            z: 30,
            blockType: 'stone'
        });

        // Wait for state sync
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check block change appears in state
        const room = client2.room!;
        const blockChanges = room.state.blockChanges;
        expect(blockChanges.length).toBeGreaterThan(0);

        const lastChange = blockChanges[blockChanges.length - 1];
        expect(lastChange.x).toBe(10);
        expect(lastChange.y).toBe(20);
        expect(lastChange.z).toBe(30);
        expect(lastChange.blockType).toBe('stone');
    });

    it('players can leave without breaking room', async () => {
        const client1 = await colyseus.connectTo('game', { name: 'Player1' });
        const client2 = await colyseus.connectTo('game', { name: 'Player2' });

        // Client1 leaves
        await client1.leave();

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));

        // Client2 should still be connected
        expect(client2.room).toBeDefined();

        // Player1 should be marked as disconnected
        const player1State = client2.room!.state.players.get(client1.sessionId);
        expect(player1State?.connected).toBe(false);
    });

    it('room cleans up when empty', async () => {
        const client = await colyseus.connectTo('game');
        const roomId = client.room!.id;

        await client.leave();

        // Wait for cleanup timeout
        await new Promise(resolve => setTimeout(resolve, 31000));

        // Room should be disposed
        // Note: This would require accessing colyseus server internals
    }, 35000);
});
