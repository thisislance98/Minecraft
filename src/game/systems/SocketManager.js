import { io } from 'socket.io-client';

export class SocketManager {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.roomId = null;
        this.callbacks = {
            onPlayerJoin: null,
            onPlayerLeave: null,
            onPlayerUpdate: null,
            onBlockChange: null,
            onRoomJoined: null
        };
        console.log('[SocketManager] Initialized (Minimal V2)');
    }

    isConnected() {
        return this.socket && this.socket.connected;
    }

    async connect() {
        if (this.socket && this.socket.connected) return;

        // Determine URL - default to 2567 for dev
        const url = window.location.hostname === 'localhost'
            ? 'http://localhost:2567'
            : window.location.origin;

        console.log('[SocketManager] Connecting to:', url);
        this.socket = io(url);

        return new Promise((resolve) => {
            this.socket.on('connect', () => {
                console.log('[SocketManager] Connected:', this.socket.id);
                this._setupListeners();
                resolve();
            });
            this.socket.on('connect_error', (err) => {
                console.error('[SocketManager] Connection failed:', err);
            });
        });
    }

    _setupListeners() {
        if (!this.socket) return;

        // Player Events
        this.socket.on('player:joined', (data) => {
            console.log('[SocketManager] Player joined:', data.id);
            // Match legacy signature: (playerId, playerData)
            this.callbacks.onPlayerJoin?.(data.id, data);
            this._updatePlayerCount();
        });

        this.socket.on('player:left', (id) => {
            console.log('[SocketManager] Player left:', id);
            this.callbacks.onPlayerLeave?.(id);
            this._updatePlayerCount();
        });

        this.socket.on('player:update', (data) => {
            // Debug Toggle: Skip incoming updates
            if (this.game._disableRemotePlayers) return;

            if (data.id !== this.socket.id) {
                this.callbacks.onPlayerUpdate?.(data.id, data);
            }
        });

        // Room Events
        this.socket.on('room:joined', (data) => {
            console.log('[SocketManager] Room joined:', data);
            this.roomId = data.roomId;
            this.callbacks.onRoomJoined?.(data);

            // Initial player count update
            if (this.game.uiManager) {
                // UI expects count
                const count = data.players ? data.players.length : 1;
                this.game.uiManager.updatePlayerCount(count);
                this.game.uiManager.showNetworkStatus(this.roomId, data.isHost);
            }

            // Call onWorldSeed if registered, passing the worldSeed from room data
            if (this.callbacks.onWorldSeed && data.worldSeed) {
                this.callbacks.onWorldSeed(data.worldSeed);
            }
        });

        this.socket.on('block:changed', (data) => {
            this.callbacks.onBlockChange?.(data.x, data.y, data.z, data.blockType);
        });

        this.socket.on('disconnect', () => {
            console.log('[SocketManager] Disconnected');
            this.roomId = null;
            this.game.uiManager?.showNetworkStatus(null);
        });
    }

    // === Public API ===

    on(event, callback) {
        // Map simplified event names to internal callbacks
        // VoxelGame uses 'onPlayerJoin' style keys
        switch (event) {
            case 'player:join':
            case 'onPlayerJoin': // Legacy support
                this.callbacks.onPlayerJoin = callback;
                break;
            case 'player:leave':
            case 'onPlayerLeave':
                this.callbacks.onPlayerLeave = callback;
                break;
            case 'player:update':
            case 'onPlayerUpdate':
                this.callbacks.onPlayerUpdate = callback;
                break;
            case 'block:change':
            case 'onBlockChange':
                this.callbacks.onBlockChange = callback;
                break;
            case 'room:joined':
            case 'onRoomJoined': // Might be used?
                this.callbacks.onRoomJoined = callback;
                break;
            case 'onWorldSeed': // VoxelGame uses onWorldSeed which maps to room:joined? 
                // Wait, VoxelGame uses onWorldSeed separate from onPlayerJoin.
                // onRoomJoined usually carries seed.
                // If VoxelGame expects 'onWorldSeed' to be called with seed...
                // I need to check VoxelGame logic.
                // This will be called from the room:joined listener
                this.callbacks.onWorldSeed = callback;
                break;
        }
        return this; // Enable chaining
    }

    async createRoom(options = {}) {
        if (!this.isConnected()) await this.connect();

        return new Promise((resolve, reject) => {
            const payload = {
                playerName: options.playerName || 'Host',
                worldSeed: options.worldSeed || Math.floor(Math.random() * 1000000),
                roomId: options.roomId || null
            };

            this.socket.emit('room:create', payload, (res) => {
                if (res.error) {
                    console.error('Create room failed:', res.error);
                    alert(res.error);
                    reject(res.error);
                } else {
                    this.roomId = res.roomId;
                    resolve(res.roomId);
                }
            });
        });
    }

    async joinRoom(roomId, options = {}) {
        if (!this.isConnected()) await this.connect();

        return new Promise((resolve, reject) => {
            const payload = {
                roomId: roomId,
                playerName: options.playerName || 'Guest'
            };

            this.socket.emit('room:join', payload, (res) => {
                if (res.error) {
                    console.error('Join room failed:', res.error);
                    alert(res.error);
                    reject(res.error);
                } else {
                    this.roomId = res.roomId;
                    resolve(res);
                }
            });
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.roomId = null;
    }

    sendPlayerUpdate(position, rotation, animation, heldItem) {
        if (this.socket && this.roomId) { // Removed isConnected checks for speed
            // Debug Toggle: Skip outgoing
            if (this.game._disableRemotePlayers) return;

            this.socket.emit('player:update', {
                position: { x: position.x, y: position.y, z: position.z },
                rotation: { x: rotation.x, y: rotation.y },
                animation,
                heldItem
            });
        }
    }

    sendBlockChange(x, y, z, blockType) {
        if (this.socket && this.roomId) {
            this.socket.emit('block:change', { x, y, z, blockType });
        }
    }

    getShareableLink() {
        if (!this.roomId) return null;
        const url = new URL(window.location.href);
        url.searchParams.set('room', this.roomId);
        return url.toString();
    }

    _updatePlayerCount() {
        // VoxelGame maintains local players, so we might need help or just heuristic
        // The proper way is counting VoxelGame.remotePlayers map + 1
        if (this.game.uiManager) {
            const count = (this.game.remotePlayers?.size || 0) + 1;
            this.game.uiManager.updatePlayerCount(count);
        }
    }

    // Legacy getters if needed
    get remotePlayers() {
        // Return game's map to avoid breakage if something checks this
        return this.game.remotePlayers || new Map();
    }
}
