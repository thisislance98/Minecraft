import { ColyseusTestServer, boot } from '@colyseus/testing';
import { Server } from '@colyseus/core';
import { GameRoom } from '../rooms/GameRoom';

/**
 * GameRoom Tests
 * Tests for core game room functionality and AI command routing
 * 
 * Uses a single Colyseus test server instance for all tests to avoid
 * port conflicts and connection issues.
 */

let colyseus: ColyseusTestServer;

beforeAll(async () => {
    // Create a single server instance for all tests
    const server = new Server();
    server.define('game', GameRoom);
    colyseus = await boot(server);
});

afterAll(async () => {
    await colyseus.shutdown();
});

describe('GameRoom', () => {
    it('players can join room', async () => {
        const room = await colyseus.createRoom('game');
        const client = await colyseus.connectTo(room, { name: 'Player1' });
        expect(client.sessionId).toBeDefined();
    });

    it('world seed is assigned and sent to players', async () => {
        const room = await colyseus.createRoom('game');
        const client = await colyseus.connectTo(room);

        await new Promise<void>((resolve) => {
            client.onMessage('worldSeed', (data) => {
                expect(data.seed).toBeDefined();
                expect(typeof data.seed).toBe('number');
                resolve();
            });
        });
    });

    it('player positions sync correctly', async () => {
        const room = await colyseus.createRoom('game');
        const client1 = await colyseus.connectTo(room, { name: 'Player1' });
        const client2 = await colyseus.connectTo(room, { name: 'Player2' });

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
        const player1State = client2.state.players.get(client1.sessionId);
        expect(player1State).toBeDefined();
        expect(player1State!.x).toBe(100);
        expect(player1State!.y).toBe(50);
        expect(player1State!.z).toBe(200);
    });

    it('block changes sync to all players', async () => {
        const room = await colyseus.createRoom('game');
        const client1 = await colyseus.connectTo(room);
        const client2 = await colyseus.connectTo(room);

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
        const blockChanges = client2.state.blockChanges;
        expect(blockChanges.length).toBeGreaterThan(0);

        const lastChange = blockChanges[blockChanges.length - 1];
        expect(lastChange.x).toBe(10);
        expect(lastChange.y).toBe(20);
        expect(lastChange.z).toBe(30);
        expect(lastChange.blockType).toBe('stone');
    });

    it('players can leave without breaking room', async () => {
        const room = await colyseus.createRoom('game');
        const client1 = await colyseus.connectTo(room, { name: 'Player1' });
        const client2 = await colyseus.connectTo(room, { name: 'Player2' });

        // Client1 leaves
        await client1.leave();

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));

        // Client2 should still be connected
        expect(client2.state).toBeDefined();

        // Player1 should be marked as disconnected
        const player1State = client2.state.players.get(client1.sessionId);
        expect(player1State?.connected).toBe(false);
    });
});

/**
 * AI Debug Command Tests
 * Tests for the debug command/response routing used by CLI testing tools
 */
describe('AI Debug Commands', () => {
    it('debugCommand message is broadcast to all clients', async () => {
        const room = await colyseus.createRoom('game');
        // CLI client (sender)
        const cliClient = await colyseus.connectTo(room, { name: 'CLI_Tester' });
        // Game client (receiver - simulates browser)
        const gameClient = await colyseus.connectTo(room, { name: 'Game_Client' });

        // Wait for connections to stabilize
        await new Promise(r => setTimeout(r, 100));

        const testCommand = {
            debugId: 'test-command-123',
            prompt: 'spawn a pig'
        };

        // Set up listener on game client before sending
        const receivedPromise = new Promise<any>((resolve) => {
            gameClient.onMessage('debugCommand', (data) => {
                resolve(data);
            });
        });

        // CLI sends debug command
        cliClient.send('debugCommand', testCommand);

        // Game client should receive the broadcast
        const received = await receivedPromise;
        expect(received.debugId).toBe('test-command-123');
        expect(received.prompt).toBe('spawn a pig');
    });

    it('debugResponse message is broadcast to CLI', async () => {
        const room = await colyseus.createRoom('game');
        const cliClient = await colyseus.connectTo(room, { name: 'CLI_Tester' });
        const gameClient = await colyseus.connectTo(room, { name: 'Game_Client' });

        // Wait for connections to stabilize
        await new Promise(r => setTimeout(r, 50));

        const testResponse = {
            debugId: 'test-response-456',
            tool: 'spawn_creature',
            creature: 'Pig',
            count: 1
        };

        // Set up listener on CLI client before sending
        const receivedPromise = new Promise<any>((resolve) => {
            cliClient.onMessage('debugResponse', (data) => {
                resolve(data);
            });
        });

        // Game client sends debug response
        gameClient.send('debugResponse', testResponse);

        // CLI should receive the broadcast
        const received = await receivedPromise;
        expect(received.debugId).toBe('test-response-456');
        expect(received.tool).toBe('spawn_creature');
        expect(received.creature).toBe('Pig');
        expect(received.count).toBe(1);
    });

    it('full debug command/response cycle works', async () => {
        const room = await colyseus.createRoom('game');
        const cliClient = await colyseus.connectTo(room, { name: 'CLI_Tester' });
        const gameClient = await colyseus.connectTo(room, { name: 'Game_Client' });

        // Wait for connections to stabilize
        await new Promise(r => setTimeout(r, 50));

        const debugId = 'full-cycle-test-789';

        // CLI waits for response
        const responsePromise = new Promise<any>((resolve) => {
            cliClient.onMessage('debugResponse', (data) => {
                if (data.debugId === debugId) {
                    resolve(data);
                }
            });
        });

        // Game client listens for command and responds
        gameClient.onMessage('debugCommand', (data) => {
            if (data.debugId === debugId) {
                // Simulate AI processing and tool execution
                gameClient.send('debugResponse', {
                    debugId: data.debugId,
                    tool: 'teleport_player',
                    location: 'desert',
                    result: 'Teleported to desert biome'
                });
            }
        });

        // CLI sends command
        cliClient.send('debugCommand', {
            debugId: debugId,
            prompt: 'teleport me to the desert'
        });

        // Verify full cycle
        const response = await responsePromise;
        expect(response.debugId).toBe(debugId);
        expect(response.tool).toBe('teleport_player');
        expect(response.location).toBe('desert');
    });

    it('handles spawn_creature response format', async () => {
        const room = await colyseus.createRoom('game');
        const cliClient = await colyseus.connectTo(room);
        const gameClient = await colyseus.connectTo(room);

        // Wait for connections to stabilize
        await new Promise(r => setTimeout(r, 50));

        const receivedPromise = new Promise<any>((resolve) => {
            cliClient.onMessage('debugResponse', resolve);
        });

        gameClient.send('debugResponse', {
            debugId: 'spawn-test',
            tool: 'spawn_creature',
            creature: 'Wolf',
            count: 3,
            approxSpawnX: 100.5,
            approxSpawnZ: 200.5
        });

        const response = await receivedPromise;
        expect(response.tool).toBe('spawn_creature');
        expect(response.creature).toBe('Wolf');
        expect(response.count).toBe(3);
        expect(response.approxSpawnX).toBeCloseTo(100.5);
        expect(response.approxSpawnZ).toBeCloseTo(200.5);
    });

    it('handles get_scene_info response format', async () => {
        const room = await colyseus.createRoom('game');
        const cliClient = await colyseus.connectTo(room);
        const gameClient = await colyseus.connectTo(room);

        // Wait for connections to stabilize
        await new Promise(r => setTimeout(r, 50));

        const receivedPromise = new Promise<any>((resolve) => {
            cliClient.onMessage('debugResponse', resolve);
        });

        gameClient.send('debugResponse', {
            debugId: 'scene-test',
            tool: 'get_scene_info',
            sceneInfo: {
                position: { x: 32, y: 80, z: 32 },
                biome: 'plains',
                timeOfDay: 'day',
                nearbyCreatures: ['Pig', 'Cow']
            }
        });

        const response = await receivedPromise;
        expect(response.tool).toBe('get_scene_info');
        expect(response.sceneInfo.biome).toBe('plains');
        expect(response.sceneInfo.nearbyCreatures).toContain('Pig');
    });

    it('handles error responses', async () => {
        const room = await colyseus.createRoom('game');
        const cliClient = await colyseus.connectTo(room);
        const gameClient = await colyseus.connectTo(room);

        // Wait for connections to stabilize
        await new Promise(r => setTimeout(r, 50));

        const receivedPromise = new Promise<any>((resolve) => {
            cliClient.onMessage('debugResponse', resolve);
        });

        gameClient.send('debugResponse', {
            debugId: 'error-test',
            error: 'Failed to execute tool: Unknown creature type'
        });

        const response = await receivedPromise;
        expect(response.error).toBe('Failed to execute tool: Unknown creature type');
    });
});
