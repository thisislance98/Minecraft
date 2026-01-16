import { Client, Room, getStateCallbacks } from 'colyseus.js';

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
        this.onBlockChange = null;
        this.onDebugCommand = null;

        // Ensure we disconnect when the window closes
        window.addEventListener('beforeunload', () => {
            this.disconnect();
        });
    }

    /**
     * Connect to Colyseus server
     */
    async connect(serverUrl = 'ws://localhost:2567') {
        try {
            // Add a timeout to the connection attempt to prevent infinite hangs
            const connectionPromise = new Promise((resolve, reject) => {
                this.client = new Client(serverUrl);
                // Client constructor is synchronous, but we treat it as the start of the process.
                // Colyseus client doesn't actually "connect" until we call join/create.
                // However, we can basic check.
                resolve(true);
            });

            await connectionPromise;

            console.log('[Colyseus] Client instance created');
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

            const options = {
                worldSeed: this.game.worldSeed,
                name: 'Host'
            };

            // Developer Experience: Use static room ID on localhost
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                options.requestedRoomId = 'dev_room';
            }

            if (options.requestedRoomId) {
                this.room = await this.client.joinOrCreate('game', options);
            } else {
                this.room = await this.client.create('game', options);
            }

            this.sessionId = this.room?.sessionId;
            this.connected = true;

            this.setupRoomHandlers();

            const roomId = this.room?.roomId || 'unknown';
            console.log(`[Colyseus] Room created: ${roomId}`);
            this.game.uiManager?.showNetworkStatus(`Hosting: ${roomId.substring(0, 6)}`);

            return roomId;
        } catch (error) {
            console.error('[Colyseus] Create room error:', error);
            throw error;
        }
    }

    /**
     * Join an existing room
     */
    async joinRoom(roomId) {
        console.log('[Colyseus] joinRoom called with:', roomId);
        if (!this.client) {
            console.log('[Colyseus] Client not ready, connecting...');
            await this.connect();
            console.log('[Colyseus] Connection finished from joinRoom');
        } else {
            console.log('[Colyseus] Client already ready');
        }

        try {
            console.log(`[Colyseus] Attempting joinById: ${roomId}`);
            this.room = await this.client.joinById(roomId, {
                name: 'Guest'
            });
            console.log(`[Colyseus] joinById completed, sessionId:`, this.room?.sessionId);

            this.sessionId = this.room.sessionId;
            this.connected = true;

            this.setupRoomHandlers();

            console.log(`[Colyseus] Joined room: ${roomId}`);
            this.game.uiManager?.showNetworkStatus(`Connected: ${roomId.substring(0, 6)}`);

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

        // --- Message Handlers (Register these FIRST so they work even if schema fails) ---

        // Listen for world seed
        this.room.onMessage('worldSeed', (data) => {
            console.log('[Colyseus] Received world seed:', data.seed);
            if (this.onWorldSeedReceived) {
                this.onWorldSeedReceived(data.seed);
            }
        });

        // Listen for debug commands (from CLI)
        this.room.onMessage('debugCommand', (data) => {
            console.log('[Colyseus] Received debug command:', data);

            // Handle remote reload
            if (data.action === 'reload') {
                console.log('🔄 Remote reload requested!');
                window.location.reload();
                return;
            }

            // Handle remote teleport (for testing)
            if (data.action === 'teleport') {
                console.log('Moved by remote test:', data);
                if (this.game.player) {
                    this.game.player.position.set(data.x, data.y, data.z);
                    this.game.player.velocity.set(0, 0, 0);
                }
                return;
            }

            if (this.onDebugCommand) {
                this.onDebugCommand(data);
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

        // --- State Synchronization using modern getStateCallbacks API ---

        // Track if we've already set up player handlers
        let playerHandlersSetup = false;

        const setupPlayerHandlers = () => {
            if (playerHandlersSetup) return;
            // Wait for state and players map to be available
            if (!this.room.state || !this.room.state.players) return;

            playerHandlersSetup = true;
            console.log('[Colyseus] Setting up player handlers with getStateCallbacks');

            // Create the callback helper using the modern API
            const $ = getStateCallbacks(this.room);

            // 1. Handle existing players (already in the map)
            this.room.state.players.forEach((player, sessionId) => {
                console.log('[Colyseus] Found existing player:', sessionId);
                if (sessionId !== this.sessionId && this.onPlayerJoin) {
                    this.onPlayerJoin(sessionId, player);
                }
            });

            this.updatePlayerCount();

            // 2. Handle future joins using $() callback helper
            $(this.room.state).players.onAdd((player, sessionId) => {
                console.log('[Colyseus] Player joined:', sessionId);
                if (sessionId !== this.sessionId && this.onPlayerJoin) {
                    this.onPlayerJoin(sessionId, player);
                }
                this.updatePlayerCount();
            });

            // 3. Handle leaves using $() callback helper
            $(this.room.state).players.onRemove((player, sessionId) => {
                console.log('[Colyseus] Player left:', sessionId);
                if (this.onPlayerLeave) {
                    this.onPlayerLeave(sessionId);
                }
                this.updatePlayerCount();
            });

            // Block changes using $() callback helper
            if (this.room.state.blockChanges) {
                $(this.room.state).blockChanges.onAdd((blockChange) => {
                    if (this.onBlockChange) {
                        this.onBlockChange(
                            blockChange.x,
                            blockChange.y,
                            blockChange.z,
                            blockChange.blockType
                        );
                    }
                });
            }
        };

        // Try to setup immediately
        setupPlayerHandlers();

        // If not ready, wait for state change (or first patch)
        this.room.onStateChange.once((state) => {
            console.log('[Colyseus] First state change received');
            setupPlayerHandlers();
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
     * Send debug response back to server (-> CLI)
     */
    sendDebugResponse(data) {
        if (!this.room || !this.connected) return;
        this.room.send('debugResponse', data);
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
        url.searchParams.set('room', this.room.roomId);
        return url.toString();
    }

    /**
     * Update the player count in the UI
     */
    updatePlayerCount() {
        if (!this.room?.state?.players) return;
        const count = this.room.state.players.size;
        this.game.uiManager?.updatePlayerCount(count);
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
