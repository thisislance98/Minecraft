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
import { feedbackRoutes } from './routes/feedback';
import { channelRoutes } from './routes/channels';
import { destinationRoutes } from './routes/destinations';
import './config'; // Initialize config
import { worldPersistence } from './services/WorldPersistence';
import { WebSocketServer } from 'ws';
import { AntigravitySession } from './services/AntigravitySession';

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
app.use('/api/feedback', feedbackRoutes); // Deprecated but kept for compatibility during migration
app.use('/api/channels', channelRoutes);
app.use('/api/destinations', destinationRoutes);

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

// ============ Antigravity AI Agent Setup ============
const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (request, socket, head) => {
    const pathname = request.url || '';
    if (pathname.startsWith('/api/antigravity')) {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    }
});

wss.on('connection', (ws, req) => {
    console.log('[Antigravity] Client connected to Agent Brain. Verifying configuration...');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('[Antigravity] CRITICAL: Missing GEMINI_API_KEY in environment variables.');
        ws.close(1011, 'Server configuration error: Missing API Key');
        return;
    }
    console.log('[Antigravity] API Key present. Initializing session...');
    new AntigravitySession(ws, apiKey, req);
});

// Simple in-memory room storage
const MAX_PLAYERS_PER_ROOM = 4;
const DAY_DURATION_SECONDS = 1800; // 30 minutes per day
const TIME_INCREMENT_PER_SEC = 0; // Frozen at 0 to keep the game bright per user request

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

interface PlayerState {
    pos: { x: number; y: number; z: number };
    rotY: number;
}

interface Room {
    id: string;
    players: string[];
    playerStates: Record<string, PlayerState>;
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
                playerStates: {},
                worldSeed,
                createdAt: existingMetadata?.createdAt ?? Date.now(),
                time: 0.25 // Default to Noon
            };
            rooms.set(newRoomId, roomToJoin);

            // Save room metadata to Firebase for persistence (don't await this critical step)
            worldPersistence.saveRoomMetadata(newRoomId, worldSeed).catch(e => console.error('Failed to save room metadata', e));
            console.log(`[Socket] Created new room: ${newRoomId} with seed: ${worldSeed} (initialized to Noon)`);
        }

        // 3. Join the room
        const roomId = roomToJoin.id;
        socket.join(roomId);
        roomToJoin.players.push(socket.id);

        // Initialize player state to avoid null checks, though position is unknown until first move
        roomToJoin.playerStates[socket.id] = { pos: { x: 0, y: 0, z: 0 }, rotY: 0 };

        // ATTACH HANDLERS IMMEDIATELY to prevent race conditions with async DB calls

        // Handle player movement
        socket.on('player:move', (data) => {
            // Update server state
            if (roomId) {
                const room = rooms.get(roomId);
                if (room && room.playerStates[socket.id]) {
                    room.playerStates[socket.id].pos = data.pos;
                    room.playerStates[socket.id].rotY = data.rotY;
                }

                // Relay to others in the room
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

        // Handle sign text update
        socket.on('sign:update', async (data: { x: number; y: number; z: number; text: string }) => {
            if (!roomId) return;

            // Broadcast
            socket.to(roomId).emit('sign:update', data);

            // Persist
            await worldPersistence.saveSignText(roomId, data.x, data.y, data.z, data.text);
        });

        // Handle entity updates (movement, health, state)
        socket.on('entity:update', async (data: { id: string;[key: string]: any }) => {
            if (!roomId) return;

            // Broadcast to others (skip sender?)
            // Usually entity updates are authoritative from one client (e.g. host or owner)
            // Ideally we broadcast to everyone else so they see it move.
            socket.to(roomId).emit('entity:update', data);

            // Persist
            await worldPersistence.saveEntity(roomId, data.id, data);
        });

        // Handle entity spawn (manual or initial)
        socket.on('entity:spawn', async (data: { id: string; type: string; x: number; y: number; z: number; seed?: number;[key: string]: any }) => {
            if (!roomId) return;

            // Broadcast
            socket.to(roomId).emit('entity:spawn', data);
            console.log(`[Socket] Entity spawned by ${socket.id}: ${data.type} (${data.id})`);

            // Persist
            await worldPersistence.saveEntity(roomId, data.id, data);
        });

        // Handle PeerJS ID sharing for voice chat
        socket.on('peerjs:id', (data: { peerId: string }) => {
            if (!roomId) return;
            // Broadcast to others in room so they can call this peer
            socket.to(roomId).emit('peerjs:id', {
                socketId: socket.id,
                peerId: data.peerId
            });
            console.log(`[Socket] PeerJS ID shared: ${socket.id} -> ${data.peerId}`);
        });

        // Handle time changes (e.g. from "K" key)
        socket.on('world:set_time', (time: number) => {
            if (!roomId) return;
            const room = rooms.get(roomId);
            if (room) {
                room.time = time;
                // Immediate broadcast
                console.log(`[Socket] Room ${roomId} time set to ${time} by ${socket.id}`);
            }
        });

        // Handle voice activity state change
        socket.on('player:voice', (active: boolean) => {
            if (roomId) {
                socket.to(roomId).emit('player:voice', { id: socket.id, active });
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

        // Handle world reset request
        socket.on('world:reset', async () => {
            if (!roomId) return;

            console.log(`[Socket] World reset requested by ${socket.id} in room ${roomId}`);

            try {
                // Clear all persisted data
                await worldPersistence.resetWorld();

                // Generate a new world seed
                const newSeed = Math.floor(Math.random() * 1000000);
                const room = rooms.get(roomId);
                if (room) {
                    room.worldSeed = newSeed;
                    room.time = 0.25; // Reset to noon
                }

                // Save new metadata
                await worldPersistence.saveRoomMetadata(roomId, newSeed);

                // Broadcast reset to ALL clients in the room (including sender)
                io.to(roomId).emit('world:reset', {
                    worldSeed: newSeed,
                    time: 0.25
                });

                console.log(`[Socket] World reset complete - new seed: ${newSeed}`);
            } catch (error) {
                console.error('[Socket] Failed to reset world:', error);
                socket.emit('world:reset:error', { message: 'Failed to reset world' });
            }
        });

        console.log(`[Socket] Player ${socket.id} joined room ${roomId} (${roomToJoin.players.length}/${MAX_PLAYERS_PER_ROOM}) starting at time: ${roomToJoin.time}`);

        // 4. Emit success event - SEND CURRENT PLAYERS AND STATES
        socket.emit('room:joined', {
            roomId: roomId,
            worldSeed: roomToJoin.worldSeed,
            players: roomToJoin.players,
            playerStates: roomToJoin.playerStates, // Send full state of existing players
            isHost: roomToJoin.players.length === 1, // First player is host
            time: roomToJoin.time
        });

        // Send persisted entities to the new player
        // ALWAYS send this event (even if empty) so client knows persistence was checked
        try {
            const entities = await worldPersistence.getEntities(roomId);
            const entityList: any[] = [];
            for (const [id, data] of entities) {
                entityList.push({ id, ...data });
            }
            socket.emit('entities:initial', entityList);
            console.log(`[Socket] Sent ${entityList.length} persisted entities to ${socket.id}`);
        } catch (e) {
            console.error('Failed to load/send persisted entities', e);
            // Send empty list on error so client knows we tried
            socket.emit('entities:initial', []);
        }

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

        // Send persisted signs
        try {
            // Use race...
            const signsMap = await Promise.race([
                worldPersistence.getSignTexts(roomId),
                new Promise<Map<string, string>>(resolve => setTimeout(() => resolve(new Map()), 1000))
            ]) || new Map();

            if (signsMap.size > 0) {
                const signsArray: { x: number; y: number; z: number; text: string }[] = [];
                for (const [key, text] of signsMap) {
                    const [x, y, z] = key.split('_').map(Number);
                    signsArray.push({ x, y, z, text });
                }
                socket.emit('signs:initial', signsArray);
                console.log(`[Socket] Sent ${signsArray.length} persisted signs to ${socket.id}`);
            }
        } catch (e) {
            console.error('Failed to load/send persisted signs', e);
        }

        // Notify others
        socket.to(roomId).emit('player:joined', { id: socket.id });

        // Handle player movement
        socket.on('player:move', (data) => {
            // Update server state
            if (roomId) {
                const room = rooms.get(roomId);
                if (room && room.playerStates[socket.id]) {
                    room.playerStates[socket.id].pos = data.pos;
                    room.playerStates[socket.id].rotY = data.rotY;
                }

                // Relay to others in the room
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

        // Handle sign text update
        socket.on('sign:update', async (data: { x: number; y: number; z: number; text: string }) => {
            if (!roomId) return;

            // Broadcast
            socket.to(roomId).emit('sign:update', data);

            // Persist
            await worldPersistence.saveSignText(roomId, data.x, data.y, data.z, data.text);
        });

        // Handle entity updates (movement, health, state)
        socket.on('entity:update', async (data: { id: string;[key: string]: any }) => {
            if (!roomId) return;

            // Broadcast to others (skip sender?)
            // Usually entity updates are authoritative from one client (e.g. host or owner)
            // Ideally we broadcast to everyone else so they see it move.
            socket.to(roomId).emit('entity:update', data);

            // Persist
            await worldPersistence.saveEntity(roomId, data.id, data);
        });

        // Handle entity spawn (manual or initial)
        socket.on('entity:spawn', async (data: { id: string; type: string; x: number; y: number; z: number; seed?: number;[key: string]: any }) => {
            if (!roomId) return;

            // Broadcast
            socket.to(roomId).emit('entity:spawn', data);
            console.log(`[Socket] Entity spawned by ${socket.id}: ${data.type} (${data.id})`);

            // Persist
            await worldPersistence.saveEntity(roomId, data.id, data);
        });

        // Handle PeerJS ID sharing for voice chat
        socket.on('peerjs:id', (data: { peerId: string }) => {
            if (!roomId) return;
            // Broadcast to others in room so they can call this peer
            socket.to(roomId).emit('peerjs:id', {
                socketId: socket.id,
                peerId: data.peerId
            });
            console.log(`[Socket] PeerJS ID shared: ${socket.id} -> ${data.peerId}`);
        });

        // Handle time changes (e.g. from "K" key)
        socket.on('world:set_time', (time: number) => {
            if (!roomId) return;
            const room = rooms.get(roomId);
            if (room) {
                room.time = time;
                // Immediate broadcast
                console.log(`[Socket] Room ${roomId} time set to ${time} by ${socket.id}`);
            }
        });

        // Handle voice activity state change
        socket.on('player:voice', (active: boolean) => {
            if (roomId) {
                socket.to(roomId).emit('player:voice', { id: socket.id, active });
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

        // Handle world reset request
        socket.on('world:reset', async () => {
            if (!roomId) return;

            console.log(`[Socket] World reset requested by ${socket.id} in room ${roomId}`);

            try {
                // Clear all persisted data
                await worldPersistence.resetWorld();

                // Generate a new world seed
                const newSeed = Math.floor(Math.random() * 1000000);
                const room = rooms.get(roomId);
                if (room) {
                    room.worldSeed = newSeed;
                    room.time = 0.25; // Reset to noon
                }

                // Save new metadata
                await worldPersistence.saveRoomMetadata(roomId, newSeed);

                // Broadcast reset to ALL clients in the room (including sender)
                io.to(roomId).emit('world:reset', {
                    worldSeed: newSeed,
                    time: 0.25
                });

                console.log(`[Socket] World reset complete - new seed: ${newSeed}`);
            } catch (error) {
                console.error('[Socket] Failed to reset world:', error);
                socket.emit('world:reset:error', { message: 'Failed to reset world' });
            }
        });

        // ============ Chat / Channels Events ============

        socket.on('chat:join_channel', (channelId: string) => {
            // Leave previous channels if needed, or just allow multiple subscriptions
            // For now, let's just join the room for this channel
            socket.join(`channel:${channelId}`);
            console.log(`[Socket] ${socket.id} joined channel:${channelId}`);
        });

        socket.on('chat:leave_channel', (channelId: string) => {
            socket.leave(`channel:${channelId}`);
        });

        socket.on('chat:message', (data: { channelId: string, message: any }) => {
            // Broadcast to everyone in channel
            // Note: data.message should look like the Message interface
            socket.to(`channel:${data.channelId}`).emit('chat:message', data.message);
        });

        socket.on('chat:reaction', (data: { channelId: string, messageId: string, reactions: any }) => {
            socket.to(`channel:${data.channelId}`).emit('chat:reaction', {
                messageId: data.messageId,
                reactions: data.reactions
            });
        });
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
        // Cleanup logic
        for (const [id, room] of rooms) {
            const index = room.players.indexOf(socket.id);
            if (index !== -1) {
                room.players.splice(index, 1);

                // Cleanup state
                if (room.playerStates[socket.id]) {
                    delete room.playerStates[socket.id];
                }

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

console.log('[Server] Startup: initializing...');
httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[Server] Listening on http://0.0.0.0:${port}`);
    console.log('[Server] Startup: complete');
});
