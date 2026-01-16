/**
 * PhotonManager - Handles all multiplayer via Photon Realtime JavaScript SDK
 * Replaces the old Colyseus-based NetworkManager
 * NOTE: Photon SDK must be loaded via script tag in index.html before this module
 */

// Event codes for different message types
const EventCodes = {
    PLAYER_MOVE: 1,
    BLOCK_CHANGE: 2,
    CHAT_MESSAGE: 3,
    WORLD_SEED: 4
};

export class PhotonManager {
    constructor(game) {
        this.game = game;
        this.client = null;
        this.connected = false;
        this.myActorNr = null;

        // Configuration - SET YOUR APP ID HERE
        this.appId = 'f720d415-bd69-4c31-8f4f-cc8161d3b1d0';
        this.appVersion = '1.0';
        this.region = 'us'; // us, eu, asia, jp, etc.

        // Callbacks
        this.onPlayerJoin = null;
        this.onPlayerLeave = null;
        this.onBlockChange = null;
        this.onWorldSeedReceived = null;

        // Track remote players by actorNr
        this.remotePlayers = new Map();

        // Ensure we disconnect when the window closes
        window.addEventListener('beforeunload', () => {
            this.disconnect();
        });
    }

    /**
     * Initialize and connect to Photon Cloud
     */
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                // Check if Photon SDK is loaded (from script tag)
                if (typeof Photon === 'undefined' || !Photon.LoadBalancing) {
                    throw new Error('Photon SDK not loaded. Make sure photon-sdk.min.js is included in index.html');
                }

                console.log('[Photon] Initializing LoadBalancingClient...');

                // Create the LoadBalancing client
                // Protocol: 1 = Wss (secure), 0 = Ws
                this.client = new Photon.LoadBalancing.LoadBalancingClient(
                    1, // Use WSS (secure WebSocket)
                    this.appId,
                    this.appVersion
                );

                // Setup callbacks
                this.setupCallbacks();

                // Connect to the region master server
                console.log(`[Photon] Connecting to region: ${this.region}`);
                this.client.connectToRegionMaster(this.region);

                // We'll resolve when we join a room (in onJoinRoom callback)
                this._connectResolve = resolve;
                this._connectReject = reject;

                // Timeout after 10 seconds
                setTimeout(() => {
                    if (!this.connected) {
                        reject(new Error('Connection timeout'));
                    }
                }, 10000);

            } catch (error) {
                console.error('[Photon] Connection error:', error);
                reject(error);
            }
        });
    }

    /**
     * Setup all Photon callbacks
     */
    setupCallbacks() {
        const client = this.client;

        // Called when connected to lobby (room list available)
        client.onRoomList = () => {
            console.log('[Photon] Connected to lobby, joining or creating room...');
            // Auto join a random room or create one
            client.joinRandomOrCreateRoom();
        };

        // Called when successfully joined a room
        client.onJoinRoom = (createdByMe) => {
            console.log(`[Photon] Joined room (created: ${createdByMe})`);
            this.connected = true;
            this.myActorNr = client.myActor().actorNr;

            // Get room name for UI
            const roomName = client.myRoom().name || 'Photon Room';
            this.game.uiManager?.showNetworkStatus(`Connected: ${roomName.substring(0, 8)}`);

            // Add existing players in the room
            client.myRoomActorsArray().forEach((actor) => {
                if (!actor.isLocal && this.onPlayerJoin) {
                    this.onPlayerJoin(actor.actorNr, { name: actor.name || `Player_${actor.actorNr}` });
                }
            });

            this.updatePlayerCount();

            // Broadcast our world seed if we created the room
            if (createdByMe && this.game.worldSeed) {
                this.raiseEvent(EventCodes.WORLD_SEED, { seed: this.game.worldSeed });
            }

            // Resolve the connect promise
            if (this._connectResolve) {
                this._connectResolve(true);
                this._connectResolve = null;
            }
        };

        // Called when a new player joins the room
        client.onActorJoin = (actor) => {
            console.log(`[Photon] Actor joined: ${actor.actorNr}`);
            if (actor.isLocal) return;

            if (this.onPlayerJoin) {
                this.onPlayerJoin(actor.actorNr, { name: actor.name || `Player_${actor.actorNr}` });
            }

            // Send our current position to the new player
            this.sendPlayerUpdate(
                this.game.player.position,
                { x: this.game.inputManager.pitch, y: this.game.inputManager.yaw }
            );

            // Send world seed to new player
            if (this.game.worldSeed) {
                this.raiseEvent(EventCodes.WORLD_SEED, { seed: this.game.worldSeed });
            }

            this.updatePlayerCount();
        };

        // Called when a player leaves the room
        client.onActorLeave = (actor) => {
            console.log(`[Photon] Actor left: ${actor.actorNr}`);
            if (actor.isLocal) return;

            if (this.onPlayerLeave) {
                this.onPlayerLeave(actor.actorNr);
            }
            this.updatePlayerCount();
        };

        // Called when receiving events from other players
        client.onEvent = (code, content, actorNr) => {
            this.handleEvent(code, content, actorNr);
        };

        // Error handling
        client.onError = (errorCode, errorMsg) => {
            console.error(`[Photon] Error ${errorCode}: ${errorMsg}`);
            this.game.uiManager?.showNetworkStatus('Connection Error');

            if (this._connectReject) {
                this._connectReject(new Error(errorMsg));
                this._connectReject = null;
            }
        };

        // State change logging
        client.onStateChange = (state) => {
            console.log(`[Photon] State: ${Photon.LoadBalancing.LoadBalancingClient.StateToName(state)}`);
        };
    }

    /**
     * Handle incoming events from other players
     */
    handleEvent(code, content, actorNr) {
        // Ignore our own events
        if (actorNr === this.myActorNr) return;

        switch (code) {
            case EventCodes.PLAYER_MOVE:
                // Update remote player position
                const remotePlayer = this.game.remotePlayers.get(actorNr);
                if (remotePlayer) {
                    remotePlayer.updateFromNetwork({
                        position: content.position,
                        rotation: content.rotation,
                        animation: content.animation,
                        heldItem: content.heldItem
                    });
                }
                break;

            case EventCodes.BLOCK_CHANGE:
                if (this.onBlockChange) {
                    this.onBlockChange(content.x, content.y, content.z, content.blockType);
                }
                break;

            case EventCodes.WORLD_SEED:
                console.log('[Photon] Received world seed:', content.seed);
                if (this.onWorldSeedReceived) {
                    this.onWorldSeedReceived(content.seed);
                }
                break;

            case EventCodes.CHAT_MESSAGE:
                this.game.uiManager?.addChatMessage(content.sender, content.message);
                break;

            default:
                console.log(`[Photon] Unknown event code: ${code}`, content);
        }
    }

    /**
     * Send an event to all other players in the room
     */
    raiseEvent(code, data) {
        if (!this.client || !this.connected) return;

        this.client.raiseEvent(code, data);
    }

    /**
     * Send player position update
     */
    sendPlayerUpdate(position, rotation, animation = 'idle', heldItem = '') {
        if (!this.connected) return;

        this.raiseEvent(EventCodes.PLAYER_MOVE, {
            position: { x: position.x, y: position.y, z: position.z },
            rotation: { x: rotation.x, y: rotation.y },
            animation,
            heldItem
        });
    }

    /**
     * Send block change
     */
    sendBlockChange(x, y, z, blockType) {
        if (!this.connected) return;

        this.raiseEvent(EventCodes.BLOCK_CHANGE, {
            x: Math.floor(x),
            y: Math.floor(y),
            z: Math.floor(z),
            blockType: blockType || ''
        });
    }

    /**
     * Create a room (for explicit room creation)
     */
    async createRoom(roomName = null) {
        if (!this.client) {
            await this.connect();
            return;
        }

        // If already connecting, just wait
        if (this.connected) return;

        // Connect will auto-create/join a room
        return this.connect();
    }

    /**
     * Join a specific room by name
     */
    async joinRoom(roomName) {
        if (!this.client) {
            await this.connect();
        }

        // Note: Photon's joinRandomOrCreateRoom handles this automatically
        // For explicit room joining, we'd use client.joinRoom(roomName)
        console.log('[Photon] Note: Room-specific joining not yet implemented, using auto-matchmaking');
    }

    /**
     * Update the player count in the UI
     */
    updatePlayerCount() {
        if (!this.client) return;
        const count = this.client.myRoomActorsArray().length;
        this.game.uiManager?.updatePlayerCount(count);
    }

    /**
     * Get shareable room link (for future use with named rooms)
     */
    getShareableLink() {
        // Photon uses room names, not IDs like Colyseus
        // For now, return null since we're using random matchmaking
        return null;
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Disconnect from Photon
     */
    disconnect() {
        if (this.client) {
            console.log('[Photon] Disconnecting...');
            this.client.disconnect();
            this.client = null;
        }
        this.connected = false;
        this.myActorNr = null;
        this.game.uiManager?.showNetworkStatus(null);
    }
}
