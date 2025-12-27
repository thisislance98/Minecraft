/**
 * Minecraft Server - Socket.IO Multiplayer
 * 
 * Based on official Socket.IO v4 documentation patterns:
 * - https://socket.io/docs/v4/rooms/
 * - https://socket.io/get-started/chat
 */

import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { stripeRoutes } from './routes/stripe';
import { authRoutes } from './routes/auth';
import './config'; // Initialize config

// ============ Types ============

interface PlayerState {
    id: string;
    name: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number };
    animation: string;
    heldItem: string;
    joinedAt: number;
}

interface RoomState {
    id: string;
    worldSeed: number;
    hostId: string;
    players: Map<string, PlayerState>;
    createdAt: number;
}

// ============ Server Setup ============

const port = Number(process.env.PORT || 2567);
const app = express();

// Enable CORS
app.use(cors());

// Use raw body for Stripe webhooks, json for everything else
app.use((req, res, next) => {
    if (req.originalUrl === '/api/webhook') {
        next();
    } else {
        express.json()(req, res, next);
    }
});

app.use('/api', stripeRoutes);
app.use('/api/auth', authRoutes);

// Request logging
app.use((req, res, next) => {
    console.log(`[Express] ${req.method} ${req.url}`);
    next();
});

// Create HTTP server
const httpServer = createServer(app);

// ============ Socket.IO Server ============

const io = new SocketIOServer(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    // Connection settings
    pingTimeout: 60000,
    pingInterval: 25000
});

// Room storage
const rooms = new Map<string, RoomState>();

// Generate unique room ID
function generateRoomId(): string {
    return Math.random().toString(36).substring(2, 10);
}

// Generate deterministic seed from room ID
// This ensures the same room ID always produces the same world
function getSeedFromRoomId(roomId: string): number {
    let hash = 0;
    for (let i = 0; i < roomId.length; i++) {
        const char = roomId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 1000000;
}

// Get player's current room
function getPlayerRoom(socket: Socket): RoomState | null {
    for (const [, room] of rooms) {
        if (room.players.has(socket.id)) {
            return room;
        }
    }
    return null;
}

// Create default player state
function createPlayerState(socket: Socket, name: string): PlayerState {
    return {
        id: socket.id,
        name: name || `Player_${socket.id.substring(0, 6)}`,
        position: { x: 32, y: 80, z: 32 },
        rotation: { x: 0, y: 0 },
        animation: 'idle',
        heldItem: '',
        joinedAt: Date.now()
    };
}

// ============ Connection Handler ============

io.on('connection', (socket: Socket) => {
    console.log('[Socket.IO] Client connected:', socket.id);

    // === Room: Create ===
    socket.on('room:create', (data, callback) => {
        try {
            const roomId = data.roomId || generateRoomId();

            if (rooms.has(roomId)) {
                if (callback) callback({ error: 'Room already exists' });
                return;
            }

            // Use deterministic seed from room ID for consistent worlds
            const worldSeed = data.worldSeed || getSeedFromRoomId(roomId);

            // Create room
            const room: RoomState = {
                id: roomId,
                worldSeed,
                hostId: socket.id,
                players: new Map(),
                createdAt: Date.now()
            };

            // Add host as first player
            const player = createPlayerState(socket, data.playerName);
            room.players.set(socket.id, player);
            rooms.set(roomId, room);

            // Store roomId on socket
            socket.data.roomId = roomId;

            // Join Socket.IO room
            socket.join(roomId);

            console.log(`[Socket.IO] Room created: ${roomId} by ${socket.id}`);

            // Send acknowledgment
            if (callback) {
                callback({ roomId, worldSeed });
            }

            // Emit room joined event
            socket.emit('room:joined', {
                roomId,
                worldSeed,
                isHost: true,
                players: [player]
            });

        } catch (error) {
            console.error('[Socket.IO] Room create error:', error);
            if (callback) {
                callback({ error: 'Failed to create room' });
            }
        }
    });

    // === Room: Join ===
    socket.on('room:join', (data, callback) => {
        try {
            const roomId = data.roomId;
            let room = rooms.get(roomId);

            // Auto-create room if it doesn't exist
            if (!room) {
                const worldSeed = getSeedFromRoomId(roomId);
                room = {
                    id: roomId,
                    worldSeed,
                    hostId: socket.id,
                    players: new Map(),
                    createdAt: Date.now()
                };
                rooms.set(roomId, room);
                console.log(`[Socket.IO] Room auto-created: ${roomId}`);
            }

            // Check if player is already in this room
            if (room.players.has(socket.id)) {
                console.log(`[Socket.IO] Player ${socket.id} already in room ${roomId}`);
                if (callback) {
                    callback({
                        roomId,
                        worldSeed: room.worldSeed,
                        playerCount: room.players.size
                    });
                }
                return;
            }

            // Create player state
            const player = createPlayerState(socket, data.playerName);
            room.players.set(socket.id, player);

            // Store roomId on socket for robust disconnect handling
            socket.data.roomId = roomId;

            // Join Socket.IO room
            socket.join(roomId);

            console.log(`[Socket.IO] Player ${socket.id} joined room ${roomId} (${room.players.size} players)`);

            // Send acknowledgment
            if (callback) {
                callback({
                    roomId,
                    worldSeed: room.worldSeed,
                    playerCount: room.players.size
                });
            }

            // Emit room joined to the joining player
            socket.emit('room:joined', {
                roomId,
                worldSeed: room.worldSeed,
                isHost: room.hostId === socket.id,
                players: Array.from(room.players.values())
            });

            // Notify other players in the room
            socket.to(roomId).emit('player:joined', player);

        } catch (error) {
            console.error('[Socket.IO] Room join error:', error);
            if (callback) {
                callback({ error: 'Failed to join room' });
            }
        }
    });

    // ... (other handlers) ...

    // Use socket.data.roomId in helper
    function getPlayerRoom(socket: Socket): RoomState | null {
        if (socket.data.roomId) {
            return rooms.get(socket.data.roomId) || null;
        }
        // Fallback to iteration
        for (const [, room] of rooms) {
            if (room.players.has(socket.id)) return room;
        }
        return null;
    }

    // === Room: Leave ===
    socket.on('room:leave', () => {
        handlePlayerLeave(socket);
    });

    // === Player: Update ===
    socket.on('player:update', (data) => {
        const room = getPlayerRoom(socket);
        if (!room) return;

        const player = room.players.get(socket.id);
        if (!player) return;

        // Update player state
        if (data.position) {
            player.position = data.position;
        }
        if (data.rotation) {
            player.rotation = data.rotation;
        }
        if (data.animation !== undefined) {
            player.animation = data.animation;
        }
        if (data.heldItem !== undefined) {
            player.heldItem = data.heldItem;
        }

        // Broadcast to other players in room (excluding sender)
        socket.to(room.id).emit('player:update', {
            id: socket.id,
            position: player.position,
            rotation: player.rotation,
            animation: player.animation,
            heldItem: player.heldItem
        });
    });

    // === Block: Change ===
    socket.on('block:change', (data) => {
        const room = getPlayerRoom(socket);
        if (!room) return;

        // Broadcast to all other players in room
        socket.to(room.id).emit('block:changed', {
            x: data.x,
            y: data.y,
            z: data.z,
            blockType: data.blockType,
            playerId: socket.id
        });
    });

    // === Disconnect ===
    socket.on('disconnect', (reason) => {
        console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
        handlePlayerLeave(socket);
    });

    // === Error ===
    socket.on('error', (error) => {
        console.error('[Socket.IO] Socket error:', socket.id, error);
    });
});

// Handle player leaving (disconnect or explicit leave)
function handlePlayerLeave(socket: Socket) {
    const room = getPlayerRoom(socket);
    if (!room) return;

    // Remove player from room
    room.players.delete(socket.id);
    socket.leave(room.id);

    // Notify other players
    io.to(room.id).emit('player:left', socket.id);

    console.log(`[Socket.IO] Player ${socket.id} left room ${room.id} (${room.players.size} remaining)`);

    // Clean up empty rooms
    if (room.players.size === 0) {
        rooms.delete(room.id);
        console.log(`[Socket.IO] Room ${room.id} deleted (empty)`);
    } else if (room.hostId === socket.id) {
        // Transfer host to another player
        const newHost = room.players.keys().next().value;
        if (newHost) {
            room.hostId = newHost;
            console.log(`[Socket.IO] Room ${room.id} host transferred to ${newHost}`);
        }
    }
}

// ============ REST API ============

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        connections: io.engine.clientsCount
    });
});

// Get active rooms
app.get('/api/rooms', (req, res) => {
    const roomList = Array.from(rooms.values()).map(room => ({
        id: room.id,
        playerCount: room.players.size,
        worldSeed: room.worldSeed,
        createdAt: room.createdAt
    }));
    res.json(roomList);
});

// Get room info
app.get('/api/rooms/:roomId', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
        id: room.id,
        playerCount: room.players.size,
        worldSeed: room.worldSeed,
        createdAt: room.createdAt,
        players: Array.from(room.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            joinedAt: p.joinedAt
        }))
    });
});

// ============ Start Server ============

httpServer.listen(port, () => {
    console.log(`[Server] Listening on http://localhost:${port}`);
    console.log(`[Socket.IO] Multiplayer ready`);
});
