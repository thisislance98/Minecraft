import { Client, Room } from 'colyseus.js';

/**
 * ColyseusManager - Handles all multiplayer via Colyseus
 * Replaces the old PeerJS NetworkManager
 */
export class ColyseusManager {
    constructor(game) {
        this.game = game;
        this.client = null;
        this.room = null;
        this.connected = false;
        this.sessionId = null;

        // Callbacks
        this.onPlayerJoin = null;
        this.onPlayerLeave = null;
        this.onBlockChange = null;
        this.onWorldSeedReceived = null;
    }

    /**
     * Connect to Colyseus server
     */
    async connect(serverUrl = 'ws://localhost:2567') {
        try {
            this.client = new Client(serverUrl);
            console.log('[Colyseus] Connected to server');
            return true;
        } catch (error) {
            console.error('[Colyseus] Connection error:', error);
            return false;
        }
    }

    /**
     * Create a new room
     */
    async createRoom() {
        if (!this.client) {
            await this.connect();
        }

        try {
            console.log('[Colyseus] Creating room...');
            this.room = await this.client.create('game', {
                worldSeed: this.game.worldSeed,
                name: 'Host'
            });

            this.sessionId = this.room.sessionId;
            this.connected = true;

            this.setupRoomHandlers();

            console.log(`[Colyseus] Room created: ${this.room.id}`);
            this.game.uiManager?.showNetworkStatus(`Hosting: ${this.room.id.substring(0, 6)}`);

            return this.room.id;
        } catch (error) {
            console.error('[Colyseus] Create room error:', error);
            throw error;
        }
    }

    /**
     * Join an existing room
     */
    async joinRoom(roomId) {
        if (!this.client) {
            await this.connect();
        }

        try {
            console.log(`[Colyseus] Joining room: ${roomId}`);
            this.room = await this.client.joinById(roomId, {
                name: 'Guest'
            });

            this.sessionId = this.room.sessionId;
            this.connected = true;

            this.setupRoomHandlers();

            console.log(`[Colyseus] Joined room: ${roomId}`);
            this.game.uiManager?.showNetworkStatus('Connected');

            return roomId;
        } catch (error) {
            console.error('[Colyseus] Join room error:', error);
            this.game.uiManager?.showNetworkStatus('Connection failed');
            throw error;
        }
    }

    /**
     * Setup room event handlers
     */
    setupRoomHandlers() {
        if (!this.room) return;

        // State synchronization
        this.room.onStateChange((state) => {
            // console.log('[Colyseus] State updated');
        });

        // Listen for new players
        this.room.state.players.onAdd((player, sessionId) => {
            console.log('[Colyseus] Player joined:', sessionId);

            // Don't create remote player for ourselves
            if (sessionId !== this.sessionId && this.onPlayerJoin) {
                this.onPlayerJoin(sessionId, player);
            }
        });

        // Listen for player updates
        this.room.state.players.onChange((player, sessionId) => {
            // Position/rotation updates are automatic via state sync
        });

        // Listen for players leaving
        this.room.state.players.onRemove((player, sessionId) => {
            console.log('[Colyseus] Player left:', sessionId);

            if (this.onPlayerLeave) {
                this.onPlayerLeave(sessionId);
            }
        });

        // Listen for block changes
        this.room.state.blockChanges.onAdd((blockChange) => {
            if (this.onBlockChange) {
                this.onBlockChange(
                    blockChange.x,
                    blockChange.y,
                    blockChange.z,
                    blockChange.blockType
                );
            }
        });

        // Listen for world seed
        this.room.onMessage('worldSeed', (data) => {
            console.log('[Colyseus] Received world seed:', data.seed);
            if (this.onWorldSeedReceived) {
                this.onWorldSeedReceived(data.seed);
            }
        });

        // Error handling
        this.room.onError((code, message) => {
            console.error('[Colyseus] Room error:', code, message);
        });

        // Room leave
        this.room.onLeave((code) => {
            console.log('[Colyseus] Left room with code:', code);
            this.connected = false;
            this.game.uiManager?.showNetworkStatus(null);
        });
    }

    /**
     * Send player position update
     */
    sendPlayerUpdate(position, rotation, animation = 'idle', heldItem = '') {
        if (!this.room || !this.connected) return;

        this.room.send('playerMove', {
            x: position.x,
            y: position.y,
            z: position.z,
            rotationX: rotation.x,
            rotationY: rotation.y,
            animation,
            heldItem
        });
    }

    /**
     * Send block change
     */
    sendBlockChange(x, y, z, blockType) {
        if (!this.room || !this.connected) return;

        this.room.send('blockChange', {
            x: Math.floor(x),
            y: Math.floor(y),
            z: Math.floor(z),
            blockType: blockType || ''
        });
    }

    /**
     * Mark client as ready
     */
    sendReady() {
        if (!this.room || !this.connected) return;
        this.room.send('ready');
    }

    /**
     * Get all remote players
     */
    getRemotePlayers() {
        if (!this.room) return {};

        const remotePlayers = {};
        this.room.state.players.forEach((player, sessionId) => {
            if (sessionId !== this.sessionId) {
                remotePlayers[sessionId] = player;
            }
        });

        return remotePlayers;
    }

    /**
     * Get shareable room link
     */
    getShareableLink() {
        if (!this.room) return null;

        const url = new URL(window.location.href);
        url.searchParams.set('room', this.room.id);
        return url.toString();
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Disconnect from room
     */
    disconnect() {
        if (this.room) {
            this.room.leave();
            this.room = null;
        }
        this.connected = false;
        this.sessionId = null;
        this.game.uiManager?.showNetworkStatus(null);
    }
}
