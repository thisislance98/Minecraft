import Peer from 'peerjs';
import { Config } from '../core/Config.js';

/**
 * NetworkManager handles all multiplayer functionality.
 * Uses PeerJS (WebRTC) for peer-to-peer connections.
 * 
 * Flow:
 * - Host: createRoom() → shares ?room=PEER_ID link
 * - Guest: joinRoom(peerId) → connects to host
 */
export class NetworkManager {
    constructor(game) {
        this.game = game;
        this.peer = null;
        this.connections = new Map(); // peerId -> DataConnection
        this.isHost = false;
        this.roomId = null;
        this.worldSeed = null;
        this.remotePlayers = new Map(); // peerId -> RemotePlayer

        // Callbacks
        this.onPlayerJoin = null;
        this.onPlayerLeave = null;
        this.onRemoteBlockChange = null;
        this.onRemotePlayerState = null;

        // State broadcast rate limiting
        this.lastBroadcast = 0;
        this.broadcastInterval = 50; // ms between broadcasts (20 Hz)

        // Flag to prevent world generation before seed is received
        this.isJoiningViaUrl = false;

        // Check URL for room parameter on init
        this.checkUrlForRoom();
    }

    /**
     * Check URL for ?room= parameter and auto-join
     */
    checkUrlForRoom() {
        const params = new URLSearchParams(window.location.search);
        const roomId = params.get('room');
        if (roomId) {
            console.log('[Network] Found room in URL:', roomId);
            // Set flag to prevent world initialization before seed is received
            this.isJoiningViaUrl = true;
            // Delay join until game is ready
            setTimeout(() => this.joinRoom(roomId), 1000);
        }
    }

    /**
     * Generate a unique room ID
     */
    generateRoomId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars
        let id = '';
        for (let i = 0; i < 6; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    }

    /**
     * Create a new room as host
     */
    async createRoom() {
        return new Promise((resolve, reject) => {
            this.roomId = this.generateRoomId();
            this.isHost = true;
            this.worldSeed = this.game.worldSeed || Math.random();

            console.log('[Network] Creating room:', this.roomId);

            // Create peer with our room ID as the peer ID
            this.peer = new Peer(this.roomId, {
                debug: 1
            });

            this.peer.on('open', (id) => {
                console.log('[Network] Room created with ID:', id);
                this.game.uiManager?.showNetworkStatus(`Hosting: ${id}`);
                resolve(id);
            });

            this.peer.on('connection', (conn) => {
                this.handleIncomingConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('[Network] Peer error:', err);
                reject(err);
            });
        });
    }

    /**
     * Join an existing room
     */
    async joinRoom(roomId) {
        return new Promise((resolve, reject) => {
            this.roomId = roomId;
            this.isHost = false;

            console.log('[Network] Joining room:', roomId);
            this.game.uiManager?.showNetworkStatus('Connecting...');

            // Create our own peer
            this.peer = new Peer(undefined, {
                debug: 1
            });

            this.peer.on('open', (myId) => {
                console.log('[Network] My peer ID:', myId);

                // Connect to host
                const conn = this.peer.connect(roomId, {
                    reliable: true
                });

                conn.on('open', () => {
                    console.log('[Network] Connected to host');
                    this.connections.set(roomId, conn);
                    this.setupConnectionHandlers(conn);
                    this.game.uiManager?.showNetworkStatus(`Connected (${this.connections.size + 1} players)`);

                    // Request world seed from host
                    conn.send({
                        type: 'request_seed'
                    });

                    resolve(roomId);
                });

                conn.on('error', (err) => {
                    console.error('[Network] Connection error:', err);
                    reject(err);
                });
            });

            this.peer.on('error', (err) => {
                console.error('[Network] Peer error:', err);
                this.game.uiManager?.showNetworkStatus('Connection failed');
                reject(err);
            });
        });
    }

    /**
     * Handle incoming connection (host only)
     */
    handleIncomingConnection(conn) {
        console.log('[Network] Incoming connection from:', conn.peer);

        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
            this.setupConnectionHandlers(conn);
            this.game.uiManager?.showNetworkStatus(`Hosting (${this.connections.size + 1} players)`);

            // Send host's current player state immediately
            if (this.game.player) {
                conn.send({
                    type: 'initial_state',
                    position: {
                        x: this.game.player.position.x,
                        y: this.game.player.position.y,
                        z: this.game.player.position.z
                    },
                    rotation: {
                        x: this.game.player.rotation.x,
                        y: this.game.player.rotation.y
                    }
                });
            }

            // Notify about new player
            if (this.onPlayerJoin) {
                this.onPlayerJoin(conn.peer);
            }

            // Broadcast to all other peers about this new player
            this.broadcast({
                type: 'player_join',
                peerId: conn.peer
            }, conn.peer);
        });
    }

    /**
     * Setup message handlers for a connection
     */
    setupConnectionHandlers(conn) {
        conn.on('data', (data) => {
            this.handleMessage(conn.peer, data);
        });

        conn.on('close', () => {
            console.log('[Network] Connection closed:', conn.peer);
            this.connections.delete(conn.peer);
            this.remotePlayers.delete(conn.peer);
            this.game.uiManager?.showNetworkStatus(
                this.isHost
                    ? `Hosting (${this.connections.size + 1} players)`
                    : `Connected (${this.connections.size + 1} players)`
            );

            if (this.onPlayerLeave) {
                this.onPlayerLeave(conn.peer);
            }
        });
    }

    /**
     * Handle incoming messages
     */
    handleMessage(peerId, data) {
        switch (data.type) {
            case 'request_seed':
                // Send world seed to requester
                const conn = this.connections.get(peerId);
                if (conn && this.isHost) {
                    conn.send({
                        type: 'world_seed',
                        seed: this.worldSeed
                    });

                    // Send global spawn point (calculated by host)
                    conn.send({
                        type: 'spawn_position',
                        position: this.game.spawnPoint || Config.PLAYER.SPAWN_POINT
                    });
                }
                break;

            case 'world_seed':
                // Received world seed from host
                console.log('[Network] Received world seed:', data.seed);
                this.worldSeed = data.seed;

                // If we haven't generated the world yet (joining via URL), just set the seed
                if (!this.game.generatedChunks || this.game.generatedChunks.size === 0) {
                    console.log('[Network] Setting world seed before generation:', data.seed);
                    this.game.worldSeed = data.seed;
                    this.game.worldGen.setSeed(data.seed);
                    // Now trigger world initialization
                    if (this.game.initializeWorld) {
                        this.game.initializeWorld();
                    }
                } else {
                    // World already generated - need to regenerate
                    console.log('[Network] Regenerating world with seed:', data.seed);
                    if (this.game.regenerateWithSeed) {
                        this.game.regenerateWithSeed(data.seed);
                    }
                }
                break;

            case 'spawn_position':
                // Received spawn position from host
                console.log('[Network] Received spawn position:', data.position);
                if (this.game.player && data.position) {
                    this.game.player.position.set(
                        data.position.x,
                        data.position.y,
                        data.position.z
                    );
                    this.game.player.velocity.set(0, 0, 0);
                }
                break;

            case 'initial_state':
                // Received initial state from host
                console.log('[Network] Received initial state from host');
                if (this.onRemotePlayerState) {
                    this.onRemotePlayerState(peerId, data);
                }
                break;

            case 'player_state':
                // Remote player position/rotation update
                if (this.onRemotePlayerState) {
                    this.onRemotePlayerState(peerId, data);
                }
                break;

            case 'block_change':
                // Remote block change
                if (this.onRemoteBlockChange) {
                    this.onRemoteBlockChange(data.x, data.y, data.z, data.blockType);
                }
                // If host, relay to all other peers
                if (this.isHost) {
                    this.broadcast(data, peerId);
                }
                break;

            case 'player_join':
                if (this.onPlayerJoin) {
                    this.onPlayerJoin(data.peerId);
                }
                break;
        }
    }

    /**
     * Broadcast message to all connected peers
     */
    broadcast(data, excludePeerId = null) {
        for (const [peerId, conn] of this.connections) {
            if (peerId !== excludePeerId && conn.open) {
                conn.send(data);
            }
        }
    }

    /**
     * Broadcast local player state (rate-limited)
     */
    broadcastPlayerState(position, rotation, animation = 'idle', heldItem = null) {
        const now = Date.now();
        if (now - this.lastBroadcast < this.broadcastInterval) return;
        this.lastBroadcast = now;

        this.broadcast({
            type: 'player_state',
            position: { x: position.x, y: position.y, z: position.z },
            rotation: { x: rotation.x, y: rotation.y },
            animation,
            heldItem,
            timestamp: now
        });
    }

    /**
     * Broadcast a block change
     */
    broadcastBlockChange(x, y, z, blockType) {
        const data = {
            type: 'block_change',
            x, y, z,
            blockType,
            timestamp: Date.now()
        };

        if (this.isHost) {
            // Host broadcasts to all
            this.broadcast(data);
        } else {
            // Guest sends to host, who will relay
            const hostConn = this.connections.get(this.roomId);
            if (hostConn && hostConn.open) {
                hostConn.send(data);
            }
        }
    }

    /**
     * Get shareable link for this room
     */
    getShareableLink() {
        if (!this.roomId) return null;
        const url = new URL(window.location.href);
        url.searchParams.set('room', this.roomId);
        return url.toString();
    }

    /**
     * Check if connected to any peers
     */
    isConnected() {
        return this.connections.size > 0 || this.isHost;
    }

    /**
     * Disconnect from all peers
     */
    disconnect() {
        for (const conn of this.connections.values()) {
            conn.close();
        }
        this.connections.clear();

        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }

        this.isHost = false;
        this.roomId = null;
        this.game.uiManager?.showNetworkStatus(null);
    }
}
