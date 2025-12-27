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
import { stripeRoutes } from './routes/stripe';
import { authRoutes } from './routes/auth';
import './config'; // Initialize config
import { worldPersistence } from './services/WorldPersistence';

// ============ Types ============


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

// ============ Socket.IO Setup ============
import { Server } from 'socket.io';

const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all origins for simplicity
        methods: ["GET", "POST"]
    }
});

// Simple in-memory room storage
const MAX_PLAYERS_PER_ROOM = 4;
const DAY_DURATION_SECONDS = 600; // 10 minutes per day
const TIME_INCREMENT_PER_SEC = 1 / DAY_DURATION_SECONDS;

// Global Game Loop (Low frequency for sync)
// We tick time for all rooms here
setInterval(() => {
    rooms.forEach((room, roomId) => {
        // Increment time
        room.time += TIME_INCREMENT_PER_SEC;
        if (room.time > 1.0) room.time -= 1.0;

        // Broadcast time every 2 seconds roughly (or every tick? 1 sec is fine)
        // To save bandwidth, we could only sync occasionally, but 1Hz is low overhead.
        io.to(roomId).emit('world:time', room.time);
    });
}, 1000);

interface Room {
    id: string;
    players: string[];
    worldSeed: number;
    createdAt: number;
    time: number; // 0.0 to 1.0
}

const rooms = new Map<string, Room>();

io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('join_game', async () => {
        let roomToJoin: Room | undefined;

        // 1. Try to find an existing room with space
        for (const [id, room] of rooms) {
            if (room.players.length < MAX_PLAYERS_PER_ROOM) {
                roomToJoin = room;
                break;
            }
        }

        // 2. If no available room, create one or restore from Firebase
        if (!roomToJoin) {
            const newRoomId = Math.random().toString(36).substring(2, 9);

            // Check if this room exists in Firebase (for persistence)
            let existingMetadata = null;
            try {
                existingMetadata = await Promise.race([
                    worldPersistence.getRoomMetadata(newRoomId),
                    new Promise<null>(resolve => setTimeout(() => resolve(null), 1000)) // 1s timeout
                ]);
            } catch (e) { console.error('Failed to load room metadata', e); }

            const worldSeed = existingMetadata?.worldSeed ?? Math.floor(Math.random() * 1000000);

            roomToJoin = {
                id: newRoomId,
                players: [],
                worldSeed,
                createdAt: existingMetadata?.createdAt ?? Date.now(),
                time: 0.25 // Default to Noon
            };
            rooms.set(newRoomId, roomToJoin);

            // Save room metadata to Firebase for persistence (don't await this critical step)
            worldPersistence.saveRoomMetadata(newRoomId, worldSeed).catch(e => console.error('Failed to save room metadata', e));
            console.log(`[Socket] Created new room: ${newRoomId} with seed: ${worldSeed}`);
        }

        // 3. Join the room
        const roomId = roomToJoin.id;
        socket.join(roomId);
        roomToJoin.players.push(socket.id);

        console.log(`[Socket] Player ${socket.id} joined room ${roomId} (${roomToJoin.players.length}/${MAX_PLAYERS_PER_ROOM})`);

        // 4. Emit success event
        socket.emit('room:joined', {
            roomId: roomId,
            worldSeed: roomToJoin.worldSeed,
            players: roomToJoin.players,
            isHost: roomToJoin.players.length === 1, // First player is host
            time: roomToJoin.time
        });

        // Send persisted block changes to the new player
        try {
            // Use race to prevent hanging
            const blockChanges = await Promise.race([
                worldPersistence.getBlockChanges(roomId),
                new Promise<Map<string, string | null>>(resolve => setTimeout(() => resolve(new Map()), 1000))
            ]) || new Map();

            if (blockChanges.size > 0) {
                const blocksArray: { x: number; y: number; z: number; type: string | null }[] = [];
                for (const [key, type] of blockChanges) {
                    const [x, y, z] = key.split('_').map(Number);
                    blocksArray.push({ x, y, z, type });
                }
                socket.emit('blocks:initial', blocksArray);
                console.log(`[Socket] Sent ${blocksArray.length} persisted blocks to ${socket.id}`);
            }
        } catch (e) {
            console.error('Failed to load/send persisted blocks', e);
        }

        // Notify others
        socket.to(roomId).emit('player:joined', { id: socket.id });

        // Handle player movement
        socket.on('player:move', (data) => {
            // Relay to others in the room
            if (roomId) {
                socket.to(roomId).emit('player:move', { id: socket.id, pos: data.pos, rotY: data.rotY });
            }
        });

        // Handle block changes (place/break)
        socket.on('block:change', async (data: { x: number; y: number; z: number; type: string | null }) => {
            console.log(`[DEBUG] Received block:change from ${socket.id}:`, data);
            if (!roomId) {
                console.log(`[DEBUG] No roomId for socket ${socket.id}, skipping block change`);
                return;
            }

            // 1. Broadcast to all other players in the room (real-time sync)
            socket.to(roomId).emit('block:change', {
                id: socket.id,
                x: data.x,
                y: data.y,
                z: data.z,
                type: data.type
            });
            console.log(`[DEBUG] Broadcasted block:change to room ${roomId}`);

            // 2. Persist to Firebase (durable storage)
            console.log(`[DEBUG] Calling worldPersistence.saveBlockChange for room ${roomId}`);
            await worldPersistence.saveBlockChange(roomId, data.x, data.y, data.z, data.type);
            console.log(`[DEBUG] Completed worldPersistence.saveBlockChange call`);
        });

        // Handle time changes (e.g. from "K" key)
        socket.on('world:set_time', (time: number) => {
            if (!roomId) return;
            const room = rooms.get(roomId);
            if (room) {
                room.time = time;
                // Immediate broadcast
                io.to(roomId).emit('world:time', room.time);
                console.log(`[Socket] Room ${roomId} time set to ${time} by ${socket.id}`);
            }
        });

        // WebRTC Signaling relay
        socket.on('signal', (data) => {
            if (data.to) {
                io.to(data.to).emit('signal', {
                    from: socket.id,
                    signal: data.signal
                });
            }
        });
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
        // Cleanup logic
        for (const [id, room] of rooms) {
            const index = room.players.indexOf(socket.id);
            if (index !== -1) {
                room.players.splice(index, 1);
                io.to(id).emit('player:left', socket.id);

                // If room empty, delete after a delay (or immediately for simplicity)
                if (room.players.length === 0) {
                    rooms.delete(id);
                    console.log(`[Socket] Room ${id} deleted (empty)`);
                }
                break;
            }
        }
    });
});

// ============ REST API ============

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        activeRooms: rooms.size,
        connectedClients: io.engine.clientsCount
    });
});

// ============ Start Server ============

httpServer.listen(port, () => {
    console.log(`[Server] Listening on http://localhost:${port}`);
});
