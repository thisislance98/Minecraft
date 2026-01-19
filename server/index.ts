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
import { announcementRoutes } from './routes/announcements';
import { worldRoutes } from './routes/worlds';
import { auth } from './config'; // Initialize config
import { worldManagementService } from './services/WorldManagementService';
import { worldPersistence } from './services/WorldPersistence';
import { loadAllCreatures, sendCreaturesToSocket, deleteCreature, getAllCreatures, getCreature } from './services/DynamicCreatureService';
import { loadAllItems, sendItemsToSocket, deleteItem } from './services/DynamicItemService';
import { initKnowledgeService } from './services/KnowledgeService';
import { WebSocketServer } from 'ws';
import { MerlinSession } from './services/MerlinSession';
import { logError } from './utils/logger';
import * as fs from 'fs';
import * as path from 'path';

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

// Request logging
app.use((req, res, next) => {
    console.log(`[Express] ${req.method} ${req.url}`);
    console.error('!!! DEBUG ACCESS LOG HIT !!! ' + req.url);
    try {
        const logPath = '/tmp/debug_access.log';
        const entry = `[${new Date().toISOString()}] ${req.method} ${req.url}\n`;
        fs.appendFileSync(logPath, entry);
    } catch (e) { console.error('Failed to write access log', e); }
    next();
});

app.use('/api', stripeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/feedback', feedbackRoutes); // Deprecated but kept for compatibility during migration
app.use('/api/channels', channelRoutes);
app.use('/api/destinations', destinationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/worlds', worldRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Express] Uncaught Global Error:', err);
    logError('GlobalExpress', err);
    if (!res.headersSent) {
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Create HTTP server
const httpServer = createServer(app);

// ============ Socket.IO Setup ============
import { Server } from 'socket.io';

export const io = new Server(httpServer, {
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
    console.log('[AI] Client connected to AI Agent. Checking provider...');

    // Parse URL to determine which provider to use
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const provider = url.searchParams.get('provider') || 'gemini'; // Default to gemini

    console.log(`[AI] Provider requested: ${provider}`);

    if (provider === 'claude') {
        // Claude provider not available - fall through to Gemini
        console.log('[Claude] Claude provider not available, using Gemini instead');
    }

    // Use Gemini (Google AI API)
    {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('[Gemini] CRITICAL: Missing GEMINI_API_KEY in environment variables.');
            ws.close(1011, 'Server configuration error: Missing Gemini API Key');
            return;
        }
        console.log('[Gemini] API Key present. Initializing MerlinSession...');
        new MerlinSession(ws, apiKey, req);
    }
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
    name: string;
    heldItem?: string | null;
    shirtColor?: number | null;
}

interface Room {
    id: string;
    worldId: string; // The world this room belongs to
    players: string[];
    playerStates: Record<string, PlayerState>;
    worldSeed: number;
    createdAt: number;
    time: number; // 0.0 to 1.0
    soccerBallHost?: string | null; // Socket ID of the player controlling soccer ball physics
}

const rooms = new Map<string, Room>();

// Track which world each socket is in (for cleanup)
const socketToWorld = new Map<string, string>();

// Track which user each socket belongs to (for ownership verification)
const socketToUser = new Map<string, string>();

// Store conversation history: key = "socketId:villagerId", value = Array of message objects
const conversationHistory = new Map<string, Array<{ role: string, parts: { text: string }[] }>>();

// ============ Minigame Multiplayer Sessions ============

interface MinigamePlayer {
    id: string;
    name: string;
    isReady: boolean;
    isHost: boolean;
}

interface MinigameSession {
    gameType: string;
    sessionId: string;
    roomId: string;
    hostId: string;
    players: Map<string, MinigamePlayer>;
    isActive: boolean;
    gameState: any;
}

// Key: sessionId (roomId:gameType), Value: MinigameSession
const minigameSessions = new Map<string, MinigameSession>();

// Helper to get session ID from room ID and game type
function getMinigameSessionId(roomId: string, gameType: string): string {
    return `${roomId}:${gameType}`;
}

// Helper to find a player's current minigame session
function findPlayerMinigameSession(socketId: string): MinigameSession | null {
    for (const session of minigameSessions.values()) {
        if (session.players.has(socketId)) {
            return session;
        }
    }
    return null;
}

// Helper to setup room event handlers for a socket
function setupRoomEventHandlers(socket: any, roomId: string, worldId: string) {
    // Handle player movement
    socket.on('player:move', (data: any) => {
        const room = rooms.get(roomId);
        if (room && room.playerStates[socket.id]) {
            room.playerStates[socket.id].pos = data.pos;
            room.playerStates[socket.id].rotY = data.rotY;
        }

        const playerState = room?.playerStates[socket.id];
        socket.to(roomId).emit('player:move', {
            id: socket.id,
            pos: data.pos,
            rotY: data.rotY,
            name: playerState?.name,
            isCrouching: data.isCrouching,
            isFlying: data.isFlying,
            health: data.health,
            maxHealth: data.maxHealth,
            shirtColor: playerState?.shirtColor
        });
    });

    // Handle player held item changes
    socket.on('player:hold', (data: { itemType: string | null }) => {
        const room = rooms.get(roomId);
        if (room && room.playerStates[socket.id]) {
            room.playerStates[socket.id].heldItem = data.itemType;
        }
        socket.to(roomId).emit('player:hold', {
            id: socket.id,
            itemType: data.itemType
        });
    });

    // Handle player damage (PvP combat)
    socket.on('player:damage', (data: { targetId: string, amount: number }) => {
        console.log(`[Socket] Player ${socket.id} dealing ${data.amount} damage to ${data.targetId}`);
        io.to(roomId).emit('player:damage', {
            targetId: data.targetId,
            amount: data.amount,
            sourceId: socket.id
        });
    });

    // Handle generic player actions
    socket.on('player:action', (data: { action: string }) => {
        socket.to(roomId).emit('player:action', {
            id: socket.id,
            action: data.action
        });
    });

    // Handle projectile spawns
    socket.on('projectile:spawn', (data: { type: string; pos: { x: number; y: number; z: number }; vel: { x: number; y: number; z: number } }) => {
        console.log(`[Socket] Projectile spawn from ${socket.id}: ${data.type}`);
        socket.to(roomId).emit('projectile:spawn', {
            id: socket.id,
            type: data.type,
            pos: data.pos,
            vel: data.vel
        });
    });

    // Handle block changes - now uses worldId for persistence
    socket.on('block:change', async (data: { x: number; y: number; z: number; type: string | null }) => {
        console.log(`[DEBUG] Received block:change from ${socket.id} in world ${worldId}:`, data);

        // Broadcast to all other players in the room
        socket.to(roomId).emit('block:change', {
            id: socket.id,
            x: data.x,
            y: data.y,
            z: data.z,
            type: data.type
        });

        // Persist to Firebase using worldId
        await worldPersistence.saveBlockChange(worldId, data.x, data.y, data.z, data.type);
    });

    // Handle entity updates - now uses worldId
    socket.on('entity:spawn', async (data: any) => {
        socket.to(roomId).emit('entity:spawn', { ...data, sourceId: socket.id });
        if (data.id && data.persist !== false) {
            await worldPersistence.saveEntity(worldId, data.id, data);
        }
    });

    socket.on('entity:update', async (data: any) => {
        socket.to(roomId).emit('entity:update', data);
        if (data.id && data.persist !== false) {
            await worldPersistence.saveEntity(worldId, data.id, data);
        }
    });

    socket.on('entity:remove', async (data: { id: string }) => {
        socket.to(roomId).emit('entity:remove', data);
        await worldPersistence.saveEntity(worldId, data.id, null);
    });

    // Handle sign updates - now uses worldId
    socket.on('sign:update', async (data: { x: number; y: number; z: number; text: string }) => {
        socket.to(roomId).emit('sign:update', {
            id: socket.id,
            ...data
        });
        await worldPersistence.saveSignText(worldId, data.x, data.y, data.z, data.text);
    });

    // Handle player color change
    socket.on('player:color', (data: { shirtColor: number }) => {
        const room = rooms.get(roomId);
        if (room && room.playerStates[socket.id]) {
            room.playerStates[socket.id].shirtColor = data.shirtColor;
        }
        socket.to(roomId).emit('player:color', {
            id: socket.id,
            shirtColor: data.shirtColor
        });
    });

    // Handle time changes
    socket.on('world:set_time', (time: number) => {
        const room = rooms.get(roomId);
        if (room) {
            room.time = time;
            console.log(`[Socket] Room ${roomId} time set to ${time} by ${socket.id}`);
        }
    });

    // Handle voice activity
    socket.on('player:voice', (active: boolean) => {
        socket.to(roomId).emit('player:voice', { id: socket.id, active });
    });

    // PeerJS ID sharing
    socket.on('peerjs:id', (data: { peerId: string }) => {
        socket.to(roomId).emit('peerjs:id', {
            socketId: socket.id,
            peerId: data.peerId
        });
        console.log(`[Socket] PeerJS ID shared: ${socket.id} -> ${data.peerId}`);
    });

    // Soccer events
    socket.on('soccer:ball_state', (data: any) => {
        socket.to(roomId).emit('soccer:ball_state', data);
    });

    socket.on('soccer:ball_kick', (data: { playerId: string }) => {
        socket.to(roomId).emit('soccer:ball_kick', data);
    });

    socket.on('soccer:goal', (data: { scoringSide: string; scores: { blue: number; orange: number } }) => {
        socket.to(roomId).emit('soccer:goal', data);
    });

    socket.on('soccer:game_over', (data: { winner: string; scores: { blue: number; orange: number } }) => {
        socket.to(roomId).emit('soccer:game_over', data);
        console.log(`[Socket] Soccer game over in room ${roomId}: ${data.winner} wins`);
    });

    socket.on('soccer:game_reset', (data: {}) => {
        socket.to(roomId).emit('soccer:game_reset', data);
    });

    socket.on('soccer:ball_reset', (data: { pos: { x: number; y: number; z: number } }) => {
        socket.to(roomId).emit('soccer:ball_reset', data);
    });

    socket.on('soccer:request_host', () => {
        const room = rooms.get(roomId);
        if (!room) return;

        if (!room.soccerBallHost) {
            room.soccerBallHost = socket.id;
            socket.emit('soccer:request_host_response', { isHost: true });
            socket.to(roomId).emit('soccer:host_assigned', { hostId: socket.id });
            console.log(`[Socket] Soccer ball host assigned to ${socket.id}`);
        } else {
            socket.emit('soccer:request_host_response', { isHost: false });
        }
    });

    socket.on('soccer:release_host', () => {
        const room = rooms.get(roomId);
        if (room && room.soccerBallHost === socket.id) {
            room.soccerBallHost = null;
            console.log(`[Socket] Soccer ball host released by ${socket.id}`);
        }
    });

    // Handle world settings changes from owner
    socket.on('world:settings_changed', (data: { worldId: string; settings: any }) => {
        console.log(`[Socket] World settings changed for ${data.worldId} by ${socket.id}`);
        // Broadcast to all other players in this world
        socket.to(`world:${data.worldId}`).emit('world:settings_changed', data);
    });
}

// Helper to send world-specific data to a socket
async function sendWorldDataToSocket(socket: any, worldId: string, roomId: string) {
    // Send persisted entities
    try {
        const entities = await worldPersistence.getEntities(worldId);
        const entityList: any[] = [];
        for (const [id, data] of entities) {
            entityList.push({ id, ...data });
        }
        socket.emit('entities:initial', entityList);
        console.log(`[Socket] Sent ${entityList.length} persisted entities to ${socket.id} for world ${worldId}`);
    } catch (e) {
        console.error('Failed to load/send persisted entities', e);
        socket.emit('entities:initial', []);
    }

    // Send dynamic creature definitions (world-scoped + global)
    await sendCreaturesToSocket(socket, worldId);

    // Send dynamic item definitions (world-scoped + global)
    await sendItemsToSocket(socket, worldId);

    // Send persisted block changes
    try {
        const blockChanges = await Promise.race([
            worldPersistence.getBlockChanges(worldId),
            new Promise<Map<string, string | null>>(resolve => setTimeout(() => resolve(new Map()), 1000))
        ]) || new Map();

        if (blockChanges.size > 0) {
            const blocksArray: { x: number; y: number; z: number; type: string | null }[] = [];
            for (const [key, type] of blockChanges) {
                const [x, y, z] = key.split('_').map(Number);
                blocksArray.push({ x, y, z, type });
            }
            socket.emit('blocks:initial', blocksArray);
            console.log(`[Socket] Sent ${blocksArray.length} persisted blocks to ${socket.id} for world ${worldId}`);
        }
    } catch (e) {
        console.error('Failed to load/send persisted blocks', e);
    }

    // Send persisted signs
    try {
        const signsMap = await Promise.race([
            worldPersistence.getSignTexts(worldId),
            new Promise<Map<string, string>>(resolve => setTimeout(() => resolve(new Map()), 1000))
        ]) || new Map();

        if (signsMap.size > 0) {
            const signsArray: { x: number; y: number; z: number; text: string }[] = [];
            for (const [key, text] of signsMap) {
                const [x, y, z] = key.split('_').map(Number);
                signsArray.push({ x, y, z, text });
            }
            socket.emit('signs:initial', signsArray);
            console.log(`[Socket] Sent ${signsArray.length} persisted signs to ${socket.id} for world ${worldId}`);
        }
    } catch (e) {
        console.error('Failed to load/send persisted signs', e);
    }
}

io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Cleanup history on disconnect
    socket.on('disconnect', () => {
        for (const key of conversationHistory.keys()) {
            if (key.startsWith(socket.id + ':')) {
                conversationHistory.delete(key);
            }
        }

        // Track player leaving their world (for player count)
        const worldId = socketToWorld.get(socket.id);
        if (worldId) {
            worldManagementService.playerLeft(worldId);
            socketToWorld.delete(socket.id);
            console.log(`[Socket] Player ${socket.id} left world ${worldId}`);
        }

        // Clean up user mapping
        socketToUser.delete(socket.id);
    });

    // ============ Admin Events (registered immediately on connection) ============

    const ADMIN_EMAIL = 'thisislance98@gmail.com';

    socket.on('admin:delete_creature', async (data: { name: string, token: string }) => {
        console.log(`[Admin] Received admin:delete_creature event from ${socket.id}:`, { name: data.name, tokenLength: data.token?.length });
        try {
            if (!auth) throw new Error('Auth service unavailable');
            console.log('[Admin] Verifying token...');
            const decodedToken = await auth.verifyIdToken(data.token);
            console.log('[Admin] Token verified for:', decodedToken.email);

            if (decodedToken.email !== ADMIN_EMAIL) {
                throw new Error('Unauthorized: Admin access required');
            }

            console.log(`[Admin] User ${decodedToken.email} deleting creature: ${data.name}`);
            const result = await deleteCreature(data.name);
            console.log('[Admin] Delete creature result:', result);

            if (!result.success) {
                socket.emit('admin:error', { message: result.error });
            }
        } catch (error: any) {
            console.error('[Admin] Delete creature failed:', error);
            socket.emit('admin:error', { message: error.message });
        }
    });

    socket.on('admin:delete_item', async (data: { name: string, token: string }) => {
        console.log(`[Admin] Received admin:delete_item event from ${socket.id}:`, { name: data.name, tokenLength: data.token?.length });
        try {
            if (!auth) throw new Error('Auth service unavailable');
            console.log('[Admin] Verifying token...');
            const decodedToken = await auth.verifyIdToken(data.token);
            console.log('[Admin] Token verified for:', decodedToken.email);

            if (decodedToken.email !== ADMIN_EMAIL) {
                throw new Error('Unauthorized: Admin access required');
            }

            console.log(`[Admin] User ${decodedToken.email} deleting item: ${data.name}`);
            const result = await deleteItem(data.name);
            console.log('[Admin] Delete item result:', result);

            if (!result.success) {
                socket.emit('admin:error', { message: result.error });
            }
        } catch (error: any) {
            console.error('[Admin] Delete item failed:', error);
            socket.emit('admin:error', { message: error.message });
        }
    });

    // Admin Announcement System
    socket.on('admin:announce', async (data: { message: string, type?: string, token: string }) => {
        console.log(`[Admin] Received admin:announce event from ${socket.id}:`, { messageLength: data.message?.length, type: data.type });
        try {
            if (!auth) throw new Error('Auth service unavailable');
            console.log('[Admin] Verifying token for announcement...');
            const decodedToken = await auth.verifyIdToken(data.token);
            console.log('[Admin] Token verified for:', decodedToken.email);

            if (decodedToken.email !== ADMIN_EMAIL) {
                throw new Error('Unauthorized: Admin access required');
            }

            const announcement = {
                id: `ann-${Date.now()}`,
                message: data.message,
                type: data.type || 'info', // 'info', 'warning', 'success', 'error'
                timestamp: Date.now(),
                sender: decodedToken.email
            };

            console.log(`[Admin] Broadcasting announcement: "${data.message}" to all clients`);

            // Broadcast to ALL connected clients
            io.emit('announcement', announcement);

            // Confirm success to admin
            socket.emit('admin:announce:success', { id: announcement.id });

        } catch (error: any) {
            console.error('[Admin] Announcement failed:', error);
            socket.emit('admin:error', { message: error.message });
        }
    });


    // ============ Minigame Multiplayer Events ============

    // Join or create a minigame lobby
    socket.on('minigame:join', (data: { gameType: string, roomId: string, playerName: string }) => {
        console.log(`[Minigame] ${socket.id} joining ${data.gameType} in room ${data.roomId}`);

        const sessionId = getMinigameSessionId(data.roomId, data.gameType);
        let session = minigameSessions.get(sessionId);

        // Check if player is already in another minigame session
        const existingSession = findPlayerMinigameSession(socket.id);
        if (existingSession && existingSession.sessionId !== sessionId) {
            console.log(`[Minigame] Player ${socket.id} leaving previous session ${existingSession.sessionId}`);
            existingSession.players.delete(socket.id);

            // Notify others in the old session
            for (const [playerId] of existingSession.players) {
                io.to(playerId).emit('minigame:playerLeft', {
                    sessionId: existingSession.sessionId,
                    playerId: socket.id
                });
            }

            // Clean up empty sessions
            if (existingSession.players.size === 0) {
                minigameSessions.delete(existingSession.sessionId);
            } else if (existingSession.hostId === socket.id) {
                // Transfer host to another player
                const newHost = existingSession.players.values().next().value;
                if (newHost) {
                    existingSession.hostId = newHost.id;
                    newHost.isHost = true;
                    for (const [playerId] of existingSession.players) {
                        io.to(playerId).emit('minigame:hostChanged', {
                            sessionId: existingSession.sessionId,
                            newHostId: newHost.id
                        });
                    }
                }
            }
        }

        if (!session) {
            // Create new session - this player becomes host
            session = {
                gameType: data.gameType,
                sessionId,
                roomId: data.roomId,
                hostId: socket.id,
                players: new Map(),
                isActive: false,
                gameState: null
            };
            minigameSessions.set(sessionId, session);
            console.log(`[Minigame] Created new session ${sessionId}, host: ${socket.id}`);
        }

        // Check if game is already active
        if (session.isActive) {
            socket.emit('minigame:error', { message: 'Game already in progress' });
            return;
        }

        // Check max players (4 for tank)
        if (session.players.size >= 4) {
            socket.emit('minigame:error', { message: 'Lobby is full' });
            return;
        }

        // Add player to session
        const isHost = session.players.size === 0 || session.hostId === socket.id;
        session.players.set(socket.id, {
            id: socket.id,
            name: data.playerName || `Player_${socket.id.substring(0, 4)}`,
            isReady: false,
            isHost
        });

        if (isHost) {
            session.hostId = socket.id;
        }

        // Join socket.io room for this minigame session
        socket.join(`minigame:${sessionId}`);

        // Send current lobby state to the joining player
        const playersArray = Array.from(session.players.values());
        socket.emit('minigame:lobbyState', {
            sessionId,
            gameType: data.gameType,
            players: playersArray,
            hostId: session.hostId,
            isActive: session.isActive
        });

        // Notify all other players in the session
        socket.to(`minigame:${sessionId}`).emit('minigame:playerJoined', {
            sessionId,
            player: session.players.get(socket.id)
        });

        console.log(`[Minigame] Session ${sessionId} now has ${session.players.size} players`);
    });

    // Leave minigame lobby
    socket.on('minigame:leave', () => {
        const session = findPlayerMinigameSession(socket.id);
        if (!session) return;

        console.log(`[Minigame] ${socket.id} leaving session ${session.sessionId}`);

        const wasHost = session.hostId === socket.id;
        session.players.delete(socket.id);
        socket.leave(`minigame:${session.sessionId}`);

        // Notify remaining players
        io.to(`minigame:${session.sessionId}`).emit('minigame:playerLeft', {
            sessionId: session.sessionId,
            playerId: socket.id
        });

        if (session.players.size === 0) {
            // Clean up empty session
            minigameSessions.delete(session.sessionId);
            console.log(`[Minigame] Session ${session.sessionId} deleted (empty)`);
        } else if (wasHost) {
            // Transfer host
            const newHost = session.players.values().next().value;
            if (newHost) {
                session.hostId = newHost.id;
                newHost.isHost = true;
                io.to(`minigame:${session.sessionId}`).emit('minigame:hostChanged', {
                    sessionId: session.sessionId,
                    newHostId: newHost.id
                });
                console.log(`[Minigame] Host transferred to ${newHost.id}`);
            }
        }
    });

    // Toggle ready state
    socket.on('minigame:ready', (data: { isReady: boolean }) => {
        const session = findPlayerMinigameSession(socket.id);
        if (!session) return;

        const player = session.players.get(socket.id);
        if (player) {
            player.isReady = data.isReady;

            // Broadcast to all players in session
            io.to(`minigame:${session.sessionId}`).emit('minigame:playerReady', {
                sessionId: session.sessionId,
                playerId: socket.id,
                isReady: data.isReady
            });

            console.log(`[Minigame] ${socket.id} ready: ${data.isReady}`);
        }
    });

    // Host starts the game
    socket.on('minigame:start', () => {
        const session = findPlayerMinigameSession(socket.id);
        if (!session) {
            socket.emit('minigame:error', { message: 'Not in a session' });
            return;
        }

        if (session.hostId !== socket.id) {
            socket.emit('minigame:error', { message: 'Only host can start the game' });
            return;
        }

        if (session.players.size < 2) {
            socket.emit('minigame:error', { message: 'Need at least 2 players' });
            return;
        }

        // Check if all players are ready (except host who starts)
        for (const [playerId, player] of session.players) {
            if (playerId !== socket.id && !player.isReady) {
                socket.emit('minigame:error', { message: 'Not all players are ready' });
                return;
            }
        }

        session.isActive = true;

        // Assign spawn positions and colors
        const spawnPoints = [
            { x: 2, y: 4 },   // Top-left
            { x: 12, y: 4 },  // Top-right
            { x: 2, y: 2 },   // Bottom-left
            { x: 12, y: 2 }   // Bottom-right
        ];
        const colors = ['#107c10', '#3366cc', '#cc9900', '#cc33cc']; // Green, Blue, Gold, Purple

        const playersArray = Array.from(session.players.values()).map((player, index) => ({
            ...player,
            spawnPoint: spawnPoints[index % spawnPoints.length],
            color: colors[index % colors.length],
            playerIndex: index
        }));

        console.log(`[Minigame] Starting game ${session.sessionId} with ${playersArray.length} players`);

        // Broadcast game start to all players
        io.to(`minigame:${session.sessionId}`).emit('minigame:gameStart', {
            sessionId: session.sessionId,
            gameType: session.gameType,
            hostId: session.hostId,
            players: playersArray
        });
    });

    // Auto-join: Join an existing game or create/start one automatically (no lobby)
    socket.on('minigame:autoJoin', (data: { gameType: string, roomId: string, playerName: string }) => {
        console.log(`[Minigame] ${socket.id} auto-joining ${data.gameType} in room ${data.roomId}`);

        const sessionId = getMinigameSessionId(data.roomId, data.gameType);
        let session = minigameSessions.get(sessionId);

        // Check if player is already in another minigame session
        const existingSession = findPlayerMinigameSession(socket.id);
        if (existingSession && existingSession.sessionId !== sessionId) {
            console.log(`[Minigame] Player ${socket.id} leaving previous session ${existingSession.sessionId}`);
            existingSession.players.delete(socket.id);

            // Notify others in the old session
            for (const [playerId] of existingSession.players) {
                io.to(playerId).emit('minigame:playerLeft', {
                    sessionId: existingSession.sessionId,
                    playerId: socket.id
                });
            }

            // Clean up empty sessions
            if (existingSession.players.size === 0) {
                minigameSessions.delete(existingSession.sessionId);
            } else if (existingSession.hostId === socket.id) {
                // Transfer host to another player
                const newHost = existingSession.players.values().next().value;
                if (newHost) {
                    existingSession.hostId = newHost.id;
                    newHost.isHost = true;
                    for (const [playerId] of existingSession.players) {
                        io.to(playerId).emit('minigame:hostChanged', {
                            sessionId: existingSession.sessionId,
                            newHostId: newHost.id
                        });
                    }
                }
            }
        }

        // If session exists and is active, join mid-game
        if (session && session.isActive) {
            // Check max players
            if (session.players.size >= 4) {
                socket.emit('minigame:error', { message: 'Game is full' });
                return;
            }

            // Add player to session
            session.players.set(socket.id, {
                id: socket.id,
                name: data.playerName || `Player_${socket.id.substring(0, 4)}`,
                isReady: true,
                isHost: false
            });

            socket.join(`minigame:${sessionId}`);

            // Assign spawn point and color for joining player
            const spawnPoints = [
                { x: 2, y: 4 },   // Top-left
                { x: 12, y: 4 },  // Top-right
                { x: 2, y: 2 },   // Bottom-left
                { x: 12, y: 2 }   // Bottom-right
            ];
            const colors = ['#107c10', '#3366cc', '#cc9900', '#cc33cc'];
            const playerIndex = session.players.size - 1;

            const playersArray = Array.from(session.players.values()).map((player, index) => ({
                ...player,
                spawnPoint: spawnPoints[index % spawnPoints.length],
                color: colors[index % colors.length],
                playerIndex: index
            }));

            console.log(`[Minigame] Player ${socket.id} joining active game ${sessionId}`);

            // Send game start to the joining player
            socket.emit('minigame:gameStart', {
                sessionId: session.sessionId,
                gameType: session.gameType,
                hostId: session.hostId,
                players: playersArray
            });

            // Notify existing players about the new player
            socket.to(`minigame:${sessionId}`).emit('minigame:playerJoined', {
                sessionId,
                player: {
                    ...session.players.get(socket.id),
                    spawnPoint: spawnPoints[playerIndex % spawnPoints.length],
                    color: colors[playerIndex % colors.length],
                    playerIndex: playerIndex
                }
            });
            return;
        }

        // No active session - create or join waiting session
        if (!session) {
            session = {
                gameType: data.gameType,
                sessionId,
                roomId: data.roomId,
                hostId: socket.id,
                players: new Map(),
                isActive: false,
                gameState: null
            };
            minigameSessions.set(sessionId, session);
            console.log(`[Minigame] Created new session ${sessionId}, host: ${socket.id}`);
        }

        // Add player to session (auto-ready)
        const isHost = session.players.size === 0 || session.hostId === socket.id;
        session.players.set(socket.id, {
            id: socket.id,
            name: data.playerName || `Player_${socket.id.substring(0, 4)}`,
            isReady: true, // Auto-ready for auto-join
            isHost
        });

        if (isHost) {
            session.hostId = socket.id;
        }

        socket.join(`minigame:${sessionId}`);

        // Check if we have enough players to start (2+)
        if (session.players.size >= 2) {
            // Auto-start the game!
            session.isActive = true;

            const spawnPoints = [
                { x: 2, y: 4 },
                { x: 12, y: 4 },
                { x: 2, y: 2 },
                { x: 12, y: 2 }
            ];
            const colors = ['#107c10', '#3366cc', '#cc9900', '#cc33cc'];

            const playersArray = Array.from(session.players.values()).map((player, index) => ({
                ...player,
                spawnPoint: spawnPoints[index % spawnPoints.length],
                color: colors[index % colors.length],
                playerIndex: index
            }));

            console.log(`[Minigame] Auto-starting game ${session.sessionId} with ${playersArray.length} players`);

            // Broadcast game start to all players
            io.to(`minigame:${session.sessionId}`).emit('minigame:gameStart', {
                sessionId: session.sessionId,
                gameType: session.gameType,
                hostId: session.hostId,
                players: playersArray
            });
        } else {
            // Waiting for more players - notify this player they're waiting
            console.log(`[Minigame] Session ${sessionId} waiting for players (${session.players.size}/2 minimum)`);
            socket.emit('minigame:waiting', {
                sessionId,
                gameType: data.gameType,
                playerCount: session.players.size,
                message: 'Waiting for another player to join...'
            });

            // Notify others if any
            socket.to(`minigame:${sessionId}`).emit('minigame:playerJoined', {
                sessionId,
                player: session.players.get(socket.id)
            });
        }
    });

    // Host broadcasts authoritative game state (20Hz)
    socket.on('minigame:state', (data: { sessionId: string, state: any }) => {
        const session = minigameSessions.get(data.sessionId);
        if (!session || session.hostId !== socket.id) return;

        // Store latest state for potential host migration
        session.gameState = data.state;

        // Relay to all other players
        socket.to(`minigame:${data.sessionId}`).emit('minigame:state', {
            sessionId: data.sessionId,
            state: data.state,
            timestamp: Date.now()
        });
    });

    // Client sends input to host
    socket.on('minigame:input', (data: { sessionId: string, input: any }) => {
        const session = minigameSessions.get(data.sessionId);
        if (!session) return;

        // Relay input to host
        io.to(session.hostId).emit('minigame:input', {
            sessionId: data.sessionId,
            playerId: socket.id,
            input: data.input,
            timestamp: Date.now()
        });
    });

    // Game events (hit, death, levelComplete, etc.)
    socket.on('minigame:event', (data: { sessionId: string, event: string, payload: any }) => {
        const session = minigameSessions.get(data.sessionId);
        if (!session) return;

        console.log(`[Minigame] Event in ${data.sessionId}: ${data.event}`);

        // Broadcast to all players in session
        io.to(`minigame:${data.sessionId}`).emit('minigame:event', {
            sessionId: data.sessionId,
            event: data.event,
            payload: data.payload,
            fromPlayerId: socket.id
        });

        // Handle game end
        if (data.event === 'gameEnd') {
            session.isActive = false;
            session.gameState = null;
        }
    });

    // Clean up minigame session on disconnect
    socket.on('disconnect', () => {
        const session = findPlayerMinigameSession(socket.id);
        if (session) {
            const wasHost = session.hostId === socket.id;
            session.players.delete(socket.id);

            io.to(`minigame:${session.sessionId}`).emit('minigame:playerLeft', {
                sessionId: session.sessionId,
                playerId: socket.id
            });

            if (session.players.size === 0) {
                minigameSessions.delete(session.sessionId);
            } else if (wasHost) {
                // Transfer host and notify
                const newHost = session.players.values().next().value;
                if (newHost) {
                    session.hostId = newHost.id;
                    newHost.isHost = true;
                    io.to(`minigame:${session.sessionId}`).emit('minigame:hostChanged', {
                        sessionId: session.sessionId,
                        newHostId: newHost.id
                    });

                    // If game was in progress, the new host needs to take over
                    if (session.isActive && session.gameState) {
                        io.to(newHost.id).emit('minigame:becomeHost', {
                            sessionId: session.sessionId,
                            gameState: session.gameState
                        });
                    }
                }
            }
        }
    });

    // New: Join a specific world by ID
    socket.on('join_world', async (payload: { worldId: string; name?: string; shirtColor?: number; userId?: string }) => {
        const { worldId, name, shirtColor, userId } = payload;

        console.log(`[Socket] Player ${socket.id} requesting to join world: ${worldId} (userId: ${userId || 'anonymous'})`);

        // Get world data
        const world = await worldManagementService.getWorld(worldId);
        if (!world) {
            socket.emit('world:error', { code: 'WORLD_NOT_FOUND', message: 'World not found' });
            return;
        }

        // Check if player has access to this world
        // For now, public and unlisted worlds are accessible to anyone
        // TODO: Add proper auth check for private worlds
        const canAccess = await worldManagementService.canUserAccess(worldId, null);
        if (!canAccess) {
            socket.emit('world:error', { code: 'ACCESS_DENIED', message: 'You do not have access to this world' });
            return;
        }

        // Find or create a room for this world
        let roomToJoin: Room | undefined;

        // Look for an existing room for this world with space
        for (const [id, room] of rooms) {
            if (room.worldId === worldId && room.players.length < MAX_PLAYERS_PER_ROOM) {
                roomToJoin = room;
                break;
            }
        }

        // If no available room for this world, create one
        if (!roomToJoin) {
            const newRoomId = `${worldId}-${Math.random().toString(36).substring(2, 6)}`;

            roomToJoin = {
                id: newRoomId,
                worldId: worldId,
                players: [],
                playerStates: {},
                worldSeed: world.seed,
                createdAt: Date.now(),
                time: world.settings.timeOfDay
            };
            rooms.set(newRoomId, roomToJoin);
            console.log(`[Socket] Created new room ${newRoomId} for world ${worldId} with seed: ${world.seed}`);
        }

        // Track which world this socket is in
        socketToWorld.set(socket.id, worldId);

        // Track which user this socket belongs to (for ownership verification)
        if (userId) {
            socketToUser.set(socket.id, userId);
        }

        // Track player joined the world
        worldManagementService.playerJoined(worldId);

        // Get permissions for this player in this world
        const isOwner = userId ? world.ownerId === userId : false;
        const permissions = {
            canBuild: await worldManagementService.canUserPerformAction(worldId, userId || null, 'build'),
            canSpawnCreatures: await worldManagementService.canUserPerformAction(worldId, userId || null, 'spawn'),
            canPvP: await worldManagementService.canUserPerformAction(worldId, userId || null, 'pvp'),
            isOwner: isOwner
        };

        console.log(`[Socket] Player ${socket.id} permissions in world ${worldId}:`, { isOwner, ownerId: world.ownerId, userId });

        // Join the socket room
        const roomId = roomToJoin.id;
        socket.join(roomId);
        socket.join(`world:${worldId}`); // Also join world-level room for broadcasts
        roomToJoin.players.push(socket.id);

        // Initialize player state
        const playerName = name || `Player_${socket.id.substring(0, 4)}`;
        const playerColor = shirtColor !== undefined ? shirtColor : null;
        roomToJoin.playerStates[socket.id] = {
            pos: world.settings.spawnPoint,
            rotY: 0,
            name: playerName,
            heldItem: null,
            shirtColor: playerColor
        };

        // Setup all socket event handlers for this room
        setupRoomEventHandlers(socket, roomId, worldId);

        console.log(`[Socket] Player ${socket.id} joined world ${worldId} room ${roomId} (${roomToJoin.players.length}/${MAX_PLAYERS_PER_ROOM})`);

        // Send world:joined event with world-specific data
        socket.emit('world:joined', {
            roomId: roomId,
            worldId: worldId,
            world: world,
            worldSeed: world.seed,
            players: roomToJoin.players,
            playerStates: roomToJoin.playerStates,
            isHost: roomToJoin.players.length === 1,
            time: roomToJoin.time,
            permissions: permissions
        });

        // Notify other players in the world
        socket.to(roomId).emit('player:joined', {
            id: socket.id,
            name: playerName,
            shirtColor: playerColor
        });

        // Send persisted data for this world
        await sendWorldDataToSocket(socket, worldId, roomId);
    });

    // Legacy: Join any available game (for backward compatibility)
    socket.on('join_game', async (payload?: { name?: string, shirtColor?: number }) => {
        // Default to the global world for backward compatibility
        const defaultWorldId = 'global';

        // Ensure the global world exists
        await worldManagementService.getOrCreateDefaultWorld();

        let roomToJoin: Room | undefined;

        // 1. Try to find an existing room for the global world with space
        for (const [id, room] of rooms) {
            if (room.worldId === defaultWorldId && room.players.length < MAX_PLAYERS_PER_ROOM) {
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

            const worldSeed = existingMetadata?.worldSeed ?? 1337; // Use original seed for global world

            roomToJoin = {
                id: newRoomId,
                worldId: defaultWorldId,
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

        // Track which world this socket is in
        socketToWorld.set(socket.id, defaultWorldId);

        // 3. Join the room
        const roomId = roomToJoin.id;
        socket.join(roomId);
        roomToJoin.players.push(socket.id);

        // Initialize player state to avoid null checks, though position is unknown until first move
        const playerName = payload?.name || `Player_${socket.id.substring(0, 4)}`;
        const shirtColor = payload?.shirtColor !== undefined ? payload.shirtColor : null;
        roomToJoin.playerStates[socket.id] = { pos: { x: 0, y: 0, z: 0 }, rotY: 0, name: playerName, heldItem: null, shirtColor: shirtColor };

        // Handle player movement
        socket.on('player:move', (data) => {
            // Update server state
            if (roomId) {
                const room = rooms.get(roomId);
                if (room && room.playerStates[socket.id]) {
                    room.playerStates[socket.id].pos = data.pos;
                    room.playerStates[socket.id].rotY = data.rotY;
                }

                // Relay to others in the room (include name, crouch state, flying state, and health so clients can display it)
                const playerState = room?.playerStates[socket.id];
                socket.to(roomId).emit('player:move', {
                    id: socket.id,
                    pos: data.pos,
                    rotY: data.rotY,
                    name: playerState?.name,
                    isCrouching: data.isCrouching,
                    isFlying: data.isFlying,
                    health: data.health,
                    maxHealth: data.maxHealth,
                    shirtColor: playerState?.shirtColor
                });
            }
        });

        // Handle player held item changes - MUST be registered early before any async operations
        socket.on('player:hold', (data: { itemType: string | null }) => {
            if (!roomId) return;

            // Update server state
            const room = rooms.get(roomId);
            if (room && room.playerStates[socket.id]) {
                room.playerStates[socket.id].heldItem = data.itemType;
            }

            // Broadcast to all other players in the room
            socket.to(roomId).emit('player:hold', {
                id: socket.id,
                itemType: data.itemType
            });
        });

        // Handle player damage (PvP combat) - MUST be registered early before any async operations
        socket.on('player:damage', (data: { targetId: string, amount: number }) => {
            if (!roomId) return;
            console.log(`[Socket] Player ${socket.id} dealing ${data.amount} damage to ${data.targetId}`);
            io.to(roomId).emit('player:damage', {
                targetId: data.targetId,
                amount: data.amount,
                sourceId: socket.id
            });
        });

        // Handle generic player actions (e.g. swing)
        socket.on('player:action', (data: { action: string }) => {
            if (!roomId) return;
            // Broadcast to others in room
            socket.to(roomId).emit('player:action', {
                id: socket.id,
                action: data.action
            });
        });

        // Handle projectile spawns (arrows, magic wands, etc.)
        socket.on('projectile:spawn', (data: { type: string; pos: { x: number; y: number; z: number }; vel: { x: number; y: number; z: number } }) => {
            if (!roomId) return;
            console.log(`[Socket] Projectile spawn from ${socket.id}: ${data.type}`);
            // Broadcast to all other players in the room
            socket.to(roomId).emit('projectile:spawn', {
                id: socket.id,
                type: data.type,
                pos: data.pos,
                vel: data.vel
            });
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

        // Handle player shirt color change
        socket.on('player:color', (data: { shirtColor: number }) => {
            if (!roomId) return;
            const room = rooms.get(roomId);
            if (room && room.playerStates[socket.id]) {
                room.playerStates[socket.id].shirtColor = data.shirtColor;
            }
            // Broadcast to others
            socket.to(roomId).emit('player:color', {
                id: socket.id,
                shirtColor: data.shirtColor
            });
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

        // === Soccer Ball Sync Events ===

        // Handle soccer ball state updates (from host)
        socket.on('soccer:ball_state', (data: { pos: { x: number; y: number; z: number }; vel: { x: number; y: number; z: number } }) => {
            if (!roomId) return;
            // Broadcast to all other players in the room
            socket.to(roomId).emit('soccer:ball_state', data);
        });

        // Handle soccer ball kick event (for sound sync)
        socket.on('soccer:ball_kick', (data: { playerId: string }) => {
            if (!roomId) return;
            socket.to(roomId).emit('soccer:ball_kick', data);
        });

        // Handle goal scored event (includes scores)
        socket.on('soccer:goal', (data: { scoringSide: string; scores: { blue: number; orange: number } }) => {
            if (!roomId) return;
            socket.to(roomId).emit('soccer:goal', data);
        });

        // Handle game over event
        socket.on('soccer:game_over', (data: { winner: string; scores: { blue: number; orange: number } }) => {
            if (!roomId) return;
            socket.to(roomId).emit('soccer:game_over', data);
            console.log(`[Socket] Soccer game over in room ${roomId}: ${data.winner} wins (${data.scores.blue}-${data.scores.orange})`);
        });

        // Handle game reset event
        socket.on('soccer:game_reset', (data: {}) => {
            if (!roomId) return;
            socket.to(roomId).emit('soccer:game_reset', data);
            console.log(`[Socket] Soccer game reset in room ${roomId}`);
        });

        // Handle ball reset event
        socket.on('soccer:ball_reset', (data: { pos: { x: number; y: number; z: number } }) => {
            if (!roomId) return;
            socket.to(roomId).emit('soccer:ball_reset', data);
        });

        // Handle soccer host request (first player in Soccer World becomes host)
        socket.on('soccer:request_host', () => {
            if (!roomId) return;
            const room = rooms.get(roomId);
            if (!room) return;

            // If no current soccer host, this player becomes host
            if (!room.soccerBallHost) {
                room.soccerBallHost = socket.id;
                socket.emit('soccer:request_host_response', { isHost: true });
                console.log(`[Socket] Soccer ball host assigned to ${socket.id} in room ${roomId}`);

                // Notify all other players
                socket.to(roomId).emit('soccer:host_assigned', { hostId: socket.id });
            } else {
                socket.emit('soccer:request_host_response', { isHost: false });
            }
        });

        // Handle soccer host release
        socket.on('soccer:release_host', () => {
            if (!roomId) return;
            const room = rooms.get(roomId);
            if (!room) return;

            if (room.soccerBallHost === socket.id) {
                room.soccerBallHost = null;
                console.log(`[Socket] Soccer ball host released by ${socket.id} in room ${roomId}`);
            }
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

        // Handle world reset request - only allowed for world owners
        socket.on('world:reset', async () => {
            if (!roomId) return;

            // Get the world this socket is currently in
            const currentWorldId = socketToWorld.get(socket.id) || defaultWorldId;
            const userId = socketToUser.get(socket.id);

            console.log(`[Socket] World reset requested by ${socket.id} for world ${currentWorldId} (userId: ${userId || 'anonymous'})`);

            try {
                // Verify ownership - get the world and check if user owns it
                const world = await worldManagementService.getWorld(currentWorldId);
                if (!world) {
                    console.log(`[Socket] World reset denied - world ${currentWorldId} not found`);
                    socket.emit('world:reset:error', { message: 'World not found' });
                    return;
                }

                const isOwner = userId && world.ownerId === userId;
                if (!isOwner) {
                    console.log(`[Socket] World reset denied - user ${userId} is not owner of world ${currentWorldId} (owner: ${world.ownerId})`);
                    socket.emit('world:reset:error', { message: 'Only the world owner can reset the world' });
                    return;
                }

                // Clear all persisted data for THIS world specifically
                await worldPersistence.resetWorld(currentWorldId);

                // Keep the same world seed - only clear added content
                const room = rooms.get(roomId);
                const currentSeed = room?.worldSeed;
                if (room) {
                    room.time = 0.25; // Reset time to noon
                }

                // Send reset to the initiator (they will respawn)
                socket.emit('world:reset', {
                    worldSeed: currentSeed,
                    time: 0.25,
                    isInitiator: true
                });

                // Broadcast reset to all OTHER clients in the same world (they should NOT respawn)
                // Use the world-level room for broadcasting to all players in this world
                socket.to(`world:${currentWorldId}`).emit('world:reset', {
                    worldSeed: currentSeed,
                    time: 0.25,
                    isInitiator: false
                });

                console.log(`[Socket] World ${currentWorldId} reset complete - keeping seed: ${currentSeed}`);
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

        // Send dynamic creature definitions to the new player (global for legacy join)
        await sendCreaturesToSocket(socket, 'global');

        // Send dynamic item definitions to the new player (global for legacy join)
        await sendItemsToSocket(socket, 'global');

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
        // Include player name in the joined broadcast
        const joiningPlayerState = roomToJoin.playerStates[socket.id];
        socket.to(roomId).emit('player:joined', {
            id: socket.id,
            name: joiningPlayerState?.name,
            heldItem: joiningPlayerState?.heldItem,
            shirtColor: joiningPlayerState?.shirtColor
        });

        // NOTE: All socket event handlers (player:move, block:change, etc.) are registered earlier 
        // (lines 269-419) before async operations to prevent race conditions.
        // DO NOT add duplicate handlers here!

        // Handle villager chat requests (LLM-powered dialogue)
        socket.on('villager:chat', async (data: {
            villagerId: string,
            profession: string,
            professionName: string,
            name?: string,
            job?: string,
            backstory?: string,
            playerMessage: string | null,
            isGreeting: boolean,
            quest?: {
                id: string,
                title: string,
                description: string,
                dialogueIntro: string,
                isAccepted: boolean,
                isCompleted: boolean,
                canComplete: boolean
            } | null
        }) => {
            console.log(`[Villager Chat] Request from ${socket.id}:`, { ...data, quest: data.quest ? data.quest.title : 'None' });

            try {
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                    throw new Error('No Gemini API key');
                }

                // Dynamic import of GoogleGenerativeAI
                const { GoogleGenerativeAI } = await import('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

                // Conversation Key
                const historyKey = `${socket.id}:${data.villagerId}`;

                // Reset history if it's a new greeting
                if (data.isGreeting) {
                    conversationHistory.delete(historyKey);
                }

                // Initialize history if needed
                if (!conversationHistory.has(historyKey)) {
                    conversationHistory.set(historyKey, []);
                }

                const history = conversationHistory.get(historyKey)!;

                // Build prompt based on profession and context
                const professionPersona: Record<string, string> = {
                    'FARMER': 'You are a friendly village farmer who loves talking about crops, weather, and animals. You wear overalls and a straw hat.',
                    'BLACKSMITH': 'You are a gruff but kind blacksmith who takes pride in your metalwork. You speak in short, practical sentences.',
                    'GUARD': 'You are a vigilant village guard who keeps the peace. You are stern but protective of villagers.',
                    'LIBRARIAN': 'You are a wise and bookish librarian who loves sharing knowledge. You speak in an educated, thoughtful manner.'
                };

                const persona = professionPersona[data.profession] || 'You are a friendly villager.';

                // Build detailed system instruction
                let systemInstruction = `You are ${data.name || 'a Villager'}, a ${data.job || data.professionName}. `;
                if (data.backstory) {
                    systemInstruction += `Your backstory: ${data.backstory} `;
                }
                systemInstruction += `\n${persona}`;

                // Quest Context
                if (data.quest && !data.quest.isCompleted) {
                    if (!data.quest.isAccepted) {
                        systemInstruction += `\nIMPORTANT: You have a quest for the player: "${data.quest.title}" - ${data.quest.description}.
                        Mention this naturally using your own words or something like: "${data.quest.dialogueIntro}".
                        If the player says "yes", "I accept", "sure", or "okay" to the quest, start your response with the tag [QUEST_ACCEPTED].
                        Do NOT use the tag unless they explicitly agree to help.`;
                    } else if (data.quest.canComplete) {
                        systemInstruction += `\nIMPORTANT: The player has completed your quest "${data.quest.title}"! 
                        Thank them warmly and tell them you are giving them a reward.
                        Start your response with the tag [QUEST_COMPLETED].`;
                    } else {
                        systemInstruction += `\nThe player has accepted your quest "${data.quest.title}" but hasn't finished it yet.
                         Encourage them to finish it. Do NOT offer it again.`;
                    }
                }

                // Construct System Instruction as the first part of the conversation or as a separate system instruction if supported
                // For simplicity with this model, we'll prepend persona to the first message or treat as context.
                // We will build the full content array for Gemini.

                const contents = [...history]; // Copy existing history

                let nextUserMessage = '';
                if (data.isGreeting) {
                    nextUserMessage = `${systemInstruction}\n\nThe player just approached you. Give a short, friendly greeting (1-2 sentences max). Be in character.`;
                } else {
                    // For subsequent turns, we assume the persona is already established in context, 
                    // but reinforcing it lightly or relying on history is fine. 
                    // To be safe, if history is empty (shouldn't be, but edge case), we include persona.
                    if (contents.length === 0) {
                        nextUserMessage = `${systemInstruction}\n\nThe player said: "${data.playerMessage}". Give a short, friendly response (1-2 sentences max). Stay in character.`;
                    } else {
                        nextUserMessage = `The player said: "${data.playerMessage}". (Remember to stay in character as ${data.name})`;
                    }
                }

                const userContentObj = { role: 'user', parts: [{ text: nextUserMessage }] };
                contents.push(userContentObj);

                const result = await model.generateContent({
                    contents: contents,
                    generationConfig: {
                        maxOutputTokens: 150, // Increased for quest descriptions
                        temperature: 0.9
                    }
                });

                let response = result.response.text().trim();
                console.log(`[Villager Chat] ${data.professionName} raw response: "${response}"`);

                // Parse Tags
                let questAccepted = false;
                let questCompleted = false;

                if (response.includes('[QUEST_ACCEPTED]')) {
                    questAccepted = true;
                    response = response.replace('[QUEST_ACCEPTED]', '').trim();
                }

                if (response.includes('[QUEST_COMPLETED]')) {
                    questCompleted = true;
                    response = response.replace('[QUEST_COMPLETED]', '').trim();
                }

                console.log(`[Villager Chat] Processed response: "${response}" (Accepted: ${questAccepted}, Completed: ${questCompleted})`);

                // Update History
                // Add the user message we effectively sent (simplifying the prompt part for history key if needed, but Gemini handles it)
                // Actually, for history consistency, we should store what we sent.
                history.push(userContentObj);

                // Add the model response (clean version + tags maybe? keeping clean for history is better)
                history.push({ role: 'model', parts: [{ text: response }] });

                // Keep history size manageable (last 10 turns = 20 messages)
                if (history.length > 20) {
                    history.splice(0, history.length - 20);
                }

                // Determine if conversation should end
                const lowerMsg = data.playerMessage?.toLowerCase() || '';
                const isGoodbye = lowerMsg.includes('bye') || lowerMsg.includes('goodbye') || lowerMsg.includes('see ya');

                socket.emit('villager:chat:response', {
                    villagerId: data.villagerId,
                    message: response,
                    endConversation: isGoodbye, // Keep open unless player says bye
                    questAccepted: questAccepted,
                    questCompleted: questCompleted
                });

            } catch (error: any) {
                console.error('[Villager Chat] Error:', error.message);

                // Fallback to static phrases
                const fallbackPhrases: Record<string, string[]> = {
                    'FARMER': ['Nice weather for farming!', 'The crops look good this season.'],
                    'BLACKSMITH': ['Need something forged?', 'Hot work, but honest.'],
                    'GUARD': ['Stay safe, traveler.', 'All quiet here.'],
                    'LIBRARIAN': ['Knowledge awaits.', 'Have you read any good books?']
                };

                const phrases = fallbackPhrases[data.profession] || ['Hello there!'];
                const fallback = phrases[Math.floor(Math.random() * phrases.length)];

                socket.emit('villager:chat:response', {
                    villagerId: data.villagerId,
                    message: fallback,
                    endConversation: true
                });
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

        // Handle world reset request - only allowed for world owners
        socket.on('world:reset', async () => {
            if (!roomId) return;

            // Get the world this socket is currently in
            const currentWorldId = socketToWorld.get(socket.id) || defaultWorldId;
            const userId = socketToUser.get(socket.id);

            console.log(`[Socket] World reset requested by ${socket.id} for world ${currentWorldId} (userId: ${userId || 'anonymous'})`);

            try {
                // Verify ownership - get the world and check if user owns it
                const world = await worldManagementService.getWorld(currentWorldId);
                if (!world) {
                    console.log(`[Socket] World reset denied - world ${currentWorldId} not found`);
                    socket.emit('world:reset:error', { message: 'World not found' });
                    return;
                }

                const isOwner = userId && world.ownerId === userId;
                if (!isOwner) {
                    console.log(`[Socket] World reset denied - user ${userId} is not owner of world ${currentWorldId} (owner: ${world.ownerId})`);
                    socket.emit('world:reset:error', { message: 'Only the world owner can reset the world' });
                    return;
                }

                // Clear all persisted data for THIS world specifically
                await worldPersistence.resetWorld(currentWorldId);

                // Keep the same world seed - only clear added content
                const room = rooms.get(roomId);
                const currentSeed = room?.worldSeed;
                if (room) {
                    room.time = 0.25; // Reset time to noon
                }

                // Send reset to the initiator (they will respawn)
                socket.emit('world:reset', {
                    worldSeed: currentSeed,
                    time: 0.25,
                    isInitiator: true
                });

                // Broadcast reset to all OTHER clients in the same world (they should NOT respawn)
                // Use the world-level room for broadcasting to all players in this world
                socket.to(`world:${currentWorldId}`).emit('world:reset', {
                    worldSeed: currentSeed,
                    time: 0.25,
                    isInitiator: false
                });

                console.log(`[Socket] World ${currentWorldId} reset complete - keeping seed: ${currentSeed}`);
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

                // If this player was the soccer ball host, release it
                if (room.soccerBallHost === socket.id) {
                    room.soccerBallHost = null;
                    console.log(`[Socket] Soccer ball host released (player disconnected) in room ${id}`);
                    // Notify remaining players so they can request host status
                    io.to(id).emit('soccer:host_assigned', { hostId: null });
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

// Debug: List all dynamic creatures
app.get('/api/creatures', (req, res) => {
    const creatures = getAllCreatures();
    res.json({
        count: creatures.length,
        creatures: creatures.map(c => ({
            name: c.name,
            description: c.description,
            codePreview: c.code.slice(0, 200) + '...',
            createdBy: c.createdBy,
            createdAt: c.createdAt
        }))
    });
});

// Debug: Get full creature code
app.get('/api/creatures/:name', (req, res) => {
    const creature = getCreature(req.params.name);
    if (!creature) {
        return res.status(404).json({ error: 'Creature not found' });
    }
    res.json(creature);
});

// Debug: Delete a creature (no auth for dev convenience)
app.delete('/api/creatures/:name', async (req, res) => {
    const result = await deleteCreature(req.params.name);
    if (result.success) {
        res.json({ success: true, message: `Deleted creature: ${req.params.name}` });
    } else {
        res.status(400).json({ error: result.error });
    }
});

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

// Load dynamic content before starting server
Promise.all([
    loadAllCreatures(),
    loadAllItems(),
    initKnowledgeService()
]).then(() => {
    httpServer.listen(port, '0.0.0.0', () => {
        console.log(`[Server] Listening on http://0.0.0.0:${port}`);
        console.log('[Server] Startup: complete');
    });
}).catch(e => {
    console.error('[Server] Failed to load dynamic content:', e);
    // Start anyway
    httpServer.listen(port, '0.0.0.0', () => {
        console.log(`[Server] Listening on http://0.0.0.0:${port}`);
        console.log('[Server] Startup: complete (with content load error)');
    });
});
