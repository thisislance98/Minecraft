import { Room, Client } from 'colyseus';
import { GameState, PlayerState, BlockChange } from '../schema/GameState';
import { saveBlockChanges, loadBlockChanges, WORLD_SEED, BlockChangeData } from '../services/worldService';

/**
 * GameRoom - Main multiplayer room
 * Handles player connections, state synchronization, and game logic
 */
export class GameRoom extends Room<GameState> {
    maxClients = 10;
    private autoSaveInterval: ReturnType<typeof setInterval> | null = null;
    private readonly AUTO_SAVE_INTERVAL_MS = 60000; // 60 seconds

    async onCreate(options: any) {
        console.log('[GameRoom] onCreate called with options:', options);

        // Allow requesting a specific Room ID (for development)
        if (options.requestedRoomId) {
            this.roomId = options.requestedRoomId;
            console.log(`[GameRoom] Setting static Room ID: ${this.roomId}`);
        }

        this.setState(new GameState());

        // Use fixed world seed for deterministic terrain generation
        this.state.worldSeed = WORLD_SEED;

        // Load saved block changes from Firestore (non-blocking)
        // If Firebase fails, room still works - just without saved changes
        this.loadBlockChangesFromFirestore().catch(err => {
            console.warn('[GameRoom] Failed to load block changes from Firebase (non-blocking):', err.message);
        });

        console.log(`[GameRoom] Created with fixed seed: ${this.state.worldSeed}`);

        // Register message handlers
        this.setupMessageHandlers();

        // Setup auto-save
        this.setupAutoSave();
    }

    async onJoin(client: Client, options: any) {
        console.log(`[GameRoom] 1. onJoin start for ${client.sessionId}`);

        try {
            console.log(`[GameRoom] 2. Creating player state for ${client.sessionId}`);
            // Create player state
            const player = new PlayerState();
            player.id = client.sessionId;
            player.name = options.name || `Player_${client.sessionId.substring(0, 6)}`;

            console.log(`[GameRoom] 3. Calculating spawn position`);
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

            console.log(`[GameRoom] 4. Adding player to state map`);
            this.state.players.set(client.sessionId, player);

            console.log(`[GameRoom] 5. Sending world seed`);
            // Send world seed to client
            client.send('worldSeed', { seed: this.state.worldSeed });

            console.log(`[GameRoom] 6. onJoin complete for ${client.sessionId}`);
        } catch (e) {
            console.error(`[GameRoom] ❌ ERROR in onJoin:`, e);
            throw e; // Rethrow to ensure client gets the error
        }
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

    async onDispose() {
        console.log('[GameRoom] Disposing room...');

        // Clear auto-save interval
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }

        // Save block changes to Firestore before disposing
        await this.saveBlockChangesToFirestore();
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
            this.state.addBlockChange(data.x, data.y, data.z, data.blockType);
        });

        // Player ready (finished loading)
        this.onMessage('ready', (client) => {
            console.log(`[GameRoom] ${client.sessionId} is ready`);
        });

        // Debug Command (CLI -> Server -> Clients)
        this.onMessage('debugCommand', (client, data) => {
            console.log(`[GameRoom] Debug command from ${client.sessionId}:`, data);
            this.broadcast('debugCommand', data);
        });

        // Debug Response (Client -> Server -> CLI)
        this.onMessage('debugResponse', (client, data) => {
            console.log(`[GameRoom] Debug response from ${client.sessionId}:`, data);
            this.broadcast('debugResponse', data);
        });

        // Manual save world
        this.onMessage('saveWorld', async (client) => {
            console.log(`[GameRoom] Manual save requested by ${client.sessionId}`);
            await this.saveBlockChangesToFirestore();
            client.send('worldSaved', { success: true });
        });
    }

    /**
     * Setup auto-save interval
     */
    private setupAutoSave() {
        this.autoSaveInterval = setInterval(async () => {
            console.log('[GameRoom] Auto-saving block changes...');
            await this.saveBlockChangesToFirestore();
        }, this.AUTO_SAVE_INTERVAL_MS);
    }

    /**
     * Save block changes to Firestore
     */
    private async saveBlockChangesToFirestore(): Promise<void> {
        try {
            const blockChanges: BlockChangeData[] = this.state.blockChanges.map((bc: BlockChange) => ({
                x: bc.x,
                y: bc.y,
                z: bc.z,
                blockType: bc.blockType,
                timestamp: bc.timestamp
            }));

            await saveBlockChanges(blockChanges);
            console.log(`[GameRoom] Saved ${blockChanges.length} block changes`);
        } catch (error) {
            console.error('[GameRoom] Failed to save block changes:', error);
        }
    }

    /**
     * Load block changes from Firestore
     */
    private async loadBlockChangesFromFirestore(): Promise<void> {
        try {
            const blockChanges = await loadBlockChanges();

            if (blockChanges.length > 0) {
                for (const bc of blockChanges) {
                    this.state.addBlockChange(bc.x, bc.y, bc.z, bc.blockType);
                }
                console.log(`[GameRoom] Restored ${blockChanges.length} block changes`);
            } else {
                console.log('[GameRoom] No saved block changes, starting fresh');
            }
        } catch (error) {
            console.error('[GameRoom] Failed to load block changes:', error);
        }
    }
}
