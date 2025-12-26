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
        this.onBlockChange = null;
        this.onWorldSeedReceived = null;
        this.onDebugCommand = null;
    }

    /**
     * Connect to Colyseus server
     */
    async connect(serverUrl = 'ws://localhost:2567') {
        try {
            this.client = new Client(serverUrl);
            console.log('[Colyseus] Connected to server (Client created)');
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

        // --- State Synchronization (Subject to Schema Version Mismatch) ---

        // Track if we've already set up player handlers
        let playerHandlersSetup = false;

        const setupPlayerHandlers = () => {
            if (playerHandlersSetup) return;
            if (!this.room.state || !this.room.state.players) return;

            playerHandlersSetup = true;
            console.log('[Colyseus] Setting up player handlers');
            console.log('[Colyseus] Players object type:', this.room.state.players?.constructor?.name);

            // First, add any existing players (important for clients joining after host)
            this.room.state.players.forEach((player, sessionId) => {
                console.log('[Colyseus] Found existing player:', sessionId);
                if (sessionId !== this.sessionId && this.onPlayerJoin) {
                    this.onPlayerJoin(sessionId, player);
                }
            });

            // Update initial player count
            this.updatePlayerCount();

            // Check if onAdd/onRemove are available
            if (typeof this.room.state.players?.onAdd === 'function') {
                // STANDARD: Use schema callbacks
                this.room.state.players.onAdd((player, sessionId) => {
                    console.log('[Colyseus] Player joined:', sessionId);
                    if (sessionId !== this.sessionId && this.onPlayerJoin) {
                        this.onPlayerJoin(sessionId, player);
                    }
                    this.updatePlayerCount();
                });

                this.room.state.players.onRemove((player, sessionId) => {
                    console.log('[Colyseus] Player left:', sessionId);
                    if (this.onPlayerLeave) {
                        this.onPlayerLeave(sessionId);
                    }
                    this.updatePlayerCount();
                });
            } else {
                // FALLBACK: Manual sync
                console.warn('[Colyseus] WARNING: players.onAdd is missing! Using manual sync fallback.');
                this.manualPlayerSync = true;
                this.knownPlayers = new Set();
                this.room.state.players.forEach((_, sessionId) => {
                    this.knownPlayers.add(sessionId);
                });
            }

            // Listen for block changes (assuming this schema part is standard)
            if (this.room.state.blockChanges?.onAdd) {
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
            }
        };

        this.room.onStateChange((state) => {
            // console.log('[Colyseus] State updated, players:', state?.players?.size);

            // Try to set up player handlers when state becomes available
            setupPlayerHandlers();

            // Always update player count on state change
            this.updatePlayerCount();

            // Handle Manual Sync
            if (this.manualPlayerSync && state.players) {
                const currentSessionIds = new Set();

                // key is sessionId
                state.players.forEach((player, sessionId) => {
                    currentSessionIds.add(sessionId);

                    // Check for new joiners
                    if (!this.knownPlayers.has(sessionId)) {
                        console.log('[Colyseus] Fallback: Found new player:', sessionId);
                        this.knownPlayers.add(sessionId);
                        if (sessionId !== this.sessionId && this.onPlayerJoin) {
                            this.onPlayerJoin(sessionId, player);
                        }
                    }
                });

                // Check for leavers
                for (const sessionId of this.knownPlayers) {
                    if (!currentSessionIds.has(sessionId)) {
                        console.log('[Colyseus] Fallback: Player left:', sessionId);
                        this.knownPlayers.delete(sessionId);
                        if (this.onPlayerLeave) {
                            this.onPlayerLeave(sessionId);
                        }
                    }
                }
            }
        });

        // Also try immediately in case state is already ready
        setupPlayerHandlers();
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
