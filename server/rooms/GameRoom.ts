import { Room, Client } from 'colyseus';
import { GameState, PlayerState } from '../schema/GameState';

/**
 * GameRoom - Main multiplayer room
 * Handles player connections, state synchronization, and game logic
 */
export class GameRoom extends Room<GameState> {
    maxClients = 10;

    onCreate(options: any) {
        this.setState(new GameState());

        // Set world seed (from options or generate new)
        if (options.worldSeed) {
            this.state.worldSeed = options.worldSeed;
        }

        console.log(`[GameRoom] Created with seed: ${this.state.worldSeed}`);

        // Register message handlers
        this.setupMessageHandlers();
    }

    onJoin(client: Client, options: any) {
        console.log(`[GameRoom] ${client.sessionId} joined`);

        // Create player state
        const player = new PlayerState();
        player.id = client.sessionId;
        player.name = options.name || `Player_${client.sessionId.substring(0, 6)}`;

        // Spawn position - in front of existing players or default
        const existingPlayers = Array.from(this.state.players.values());
        if (existingPlayers.length > 0) {
            // Spawn near first player
            const host = existingPlayers[0];
            player.x = host.x + 4;
            player.y = host.y;
            player.z = host.z;
        } else {
            // Default spawn
            player.x = 32;
            player.y = 80;
            player.z = 32;
        }

        this.state.players.set(client.sessionId, player);

        // Send world seed to client
        client.send('worldSeed', { seed: this.state.worldSeed });
    }

    onLeave(client: Client, consented: boolean) {
        console.log(`[GameRoom] ${client.sessionId} left (consented: ${consented})`);

        // Mark player as disconnected
        const player = this.state.players.get(client.sessionId);
        if (player) {
            player.connected = false;
        }

        // Remove player after 30 seconds if not reconnected
        this.clock.setTimeout(() => {
            if (this.state.players.has(client.sessionId)) {
                this.state.players.delete(client.sessionId);
                console.log(`[GameRoom] Removed ${client.sessionId} from room`);
            }
        }, 30000);
    }

    onDispose() {
        console.log('[GameRoom] Disposing room...');
    }

    /**
     * Setup message handlers for client communication
     */
    private setupMessageHandlers() {
        // Player movement
        this.onMessage('playerMove', (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                player.x = data.x;
                player.y = data.y;
                player.z = data.z;
                player.rotationX = data.rotationX;
                player.rotationY = data.rotationY;
                player.animation = data.animation || 'idle';
                player.heldItem = data.heldItem || '';
            }
        });

        // Block changes
        this.onMessage('blockChange', (client, data) => {
            console.log(`[GameRoom] Block change from ${client.sessionId}:`, data);
            this.state.addBlockChange(data.x, data.y, data.z, data.blockType);
        });

        // Player ready (finished loading)
        this.onMessage('ready', (client) => {
            console.log(`[GameRoom] ${client.sessionId} is ready`);
            // Could trigger game start logic here
        });

        // Debug Command (CLI -> Server -> Clients)
        this.onMessage('debugCommand', (client, data) => {
            console.log(`[GameRoom] Debug command from ${client.sessionId}:`, data);
            // Broadcast to all clients (except sender if needed, but usually sender is CLI)
            // We want the Game Client (browser) to receive this
            this.broadcast('debugCommand', data);
        });

        // Debug Response (Client -> Server -> CLI)
        this.onMessage('debugResponse', (client, data) => {
            console.log(`[GameRoom] Debug response from ${client.sessionId}:`, data);
            // Broadcast to all clients (CLI will pick this up)
            this.broadcast('debugResponse', data);
        });
    }
}
