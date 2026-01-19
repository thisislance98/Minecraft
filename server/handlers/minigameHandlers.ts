/**
 * Minigame Socket Event Handlers
 *
 * Handles minigame lobby, matchmaking, and in-game events.
 * Supports lobby-based and auto-join modes.
 */

import { Socket, Server } from 'socket.io';

// ============ Types ============

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

interface MinigameHandlerContext {
    io: Server;
    socket: Socket;
    sessions: Map<string, MinigameSession>;
}

// ============ Constants ============

const SPAWN_POINTS = [
    { x: 2, y: 4 },   // Top-left
    { x: 12, y: 4 },  // Top-right
    { x: 2, y: 2 },   // Bottom-left
    { x: 12, y: 2 }   // Bottom-right
];

const PLAYER_COLORS = ['#107c10', '#3366cc', '#cc9900', '#cc33cc'];
const MAX_PLAYERS = 4;
const MIN_PLAYERS_TO_START = 2;

// ============ Helper Functions ============

export function getMinigameSessionId(roomId: string, gameType: string): string {
    return `${roomId}:${gameType}`;
}

export function findPlayerMinigameSession(
    sessions: Map<string, MinigameSession>,
    socketId: string
): MinigameSession | null {
    for (const session of sessions.values()) {
        if (session.players.has(socketId)) {
            return session;
        }
    }
    return null;
}

function leaveCurrentSession(
    ctx: MinigameHandlerContext,
    socketId: string,
    excludeSessionId?: string
): void {
    const { io, sessions } = ctx;
    const existingSession = findPlayerMinigameSession(sessions, socketId);

    if (!existingSession || existingSession.sessionId === excludeSessionId) {
        return;
    }

    console.log(`[Minigame] Player ${socketId} leaving previous session ${existingSession.sessionId}`);
    existingSession.players.delete(socketId);

    // Notify others
    for (const [playerId] of existingSession.players) {
        io.to(playerId).emit('minigame:playerLeft', {
            sessionId: existingSession.sessionId,
            playerId: socketId
        });
    }

    // Clean up or transfer host
    if (existingSession.players.size === 0) {
        sessions.delete(existingSession.sessionId);
    } else if (existingSession.hostId === socketId) {
        transferHost(ctx, existingSession);
    }
}

function transferHost(ctx: MinigameHandlerContext, session: MinigameSession): void {
    const { io } = ctx;
    const newHost = session.players.values().next().value;

    if (newHost) {
        session.hostId = newHost.id;
        newHost.isHost = true;

        io.to(`minigame:${session.sessionId}`).emit('minigame:hostChanged', {
            sessionId: session.sessionId,
            newHostId: newHost.id
        });

        // If game in progress, new host takes over
        if (session.isActive && session.gameState) {
            io.to(newHost.id).emit('minigame:becomeHost', {
                sessionId: session.sessionId,
                gameState: session.gameState
            });
        }

        console.log(`[Minigame] Host transferred to ${newHost.id}`);
    }
}

function createPlayersArray(session: MinigameSession) {
    return Array.from(session.players.values()).map((player, index) => ({
        ...player,
        spawnPoint: SPAWN_POINTS[index % SPAWN_POINTS.length],
        color: PLAYER_COLORS[index % PLAYER_COLORS.length],
        playerIndex: index
    }));
}

function startGame(ctx: MinigameHandlerContext, session: MinigameSession): void {
    const { io } = ctx;
    session.isActive = true;

    const playersArray = createPlayersArray(session);
    console.log(`[Minigame] Starting game ${session.sessionId} with ${playersArray.length} players`);

    io.to(`minigame:${session.sessionId}`).emit('minigame:gameStart', {
        sessionId: session.sessionId,
        gameType: session.gameType,
        hostId: session.hostId,
        players: playersArray
    });
}

// ============ Handler Registration ============

export function registerMinigameHandlers(ctx: MinigameHandlerContext): void {
    const { io, socket, sessions } = ctx;

    // Join or create lobby
    socket.on('minigame:join', (data: { gameType: string; roomId: string; playerName: string }) => {
        console.log(`[Minigame] ${socket.id} joining ${data.gameType} in room ${data.roomId}`);

        const sessionId = getMinigameSessionId(data.roomId, data.gameType);
        leaveCurrentSession(ctx, socket.id, sessionId);

        let session = sessions.get(sessionId);

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
            sessions.set(sessionId, session);
            console.log(`[Minigame] Created new session ${sessionId}, host: ${socket.id}`);
        }

        if (session.isActive) {
            socket.emit('minigame:error', { message: 'Game already in progress' });
            return;
        }

        if (session.players.size >= MAX_PLAYERS) {
            socket.emit('minigame:error', { message: 'Lobby is full' });
            return;
        }

        const isHost = session.players.size === 0 || session.hostId === socket.id;
        session.players.set(socket.id, {
            id: socket.id,
            name: data.playerName || `Player_${socket.id.substring(0, 4)}`,
            isReady: false,
            isHost
        });

        if (isHost) session.hostId = socket.id;

        socket.join(`minigame:${sessionId}`);

        socket.emit('minigame:lobbyState', {
            sessionId,
            gameType: data.gameType,
            players: Array.from(session.players.values()),
            hostId: session.hostId,
            isActive: session.isActive
        });

        socket.to(`minigame:${sessionId}`).emit('minigame:playerJoined', {
            sessionId,
            player: session.players.get(socket.id)
        });

        console.log(`[Minigame] Session ${sessionId} now has ${session.players.size} players`);
    });

    // Leave lobby
    socket.on('minigame:leave', () => {
        const session = findPlayerMinigameSession(sessions, socket.id);
        if (!session) return;

        console.log(`[Minigame] ${socket.id} leaving session ${session.sessionId}`);

        const wasHost = session.hostId === socket.id;
        session.players.delete(socket.id);
        socket.leave(`minigame:${session.sessionId}`);

        io.to(`minigame:${session.sessionId}`).emit('minigame:playerLeft', {
            sessionId: session.sessionId,
            playerId: socket.id
        });

        if (session.players.size === 0) {
            sessions.delete(session.sessionId);
            console.log(`[Minigame] Session ${session.sessionId} deleted (empty)`);
        } else if (wasHost) {
            transferHost(ctx, session);
        }
    });

    // Toggle ready state
    socket.on('minigame:ready', (data: { isReady: boolean }) => {
        const session = findPlayerMinigameSession(sessions, socket.id);
        if (!session) return;

        const player = session.players.get(socket.id);
        if (player) {
            player.isReady = data.isReady;
            io.to(`minigame:${session.sessionId}`).emit('minigame:playerReady', {
                sessionId: session.sessionId,
                playerId: socket.id,
                isReady: data.isReady
            });
            console.log(`[Minigame] ${socket.id} ready: ${data.isReady}`);
        }
    });

    // Host starts game
    socket.on('minigame:start', () => {
        const session = findPlayerMinigameSession(sessions, socket.id);
        if (!session) {
            socket.emit('minigame:error', { message: 'Not in a session' });
            return;
        }

        if (session.hostId !== socket.id) {
            socket.emit('minigame:error', { message: 'Only host can start the game' });
            return;
        }

        if (session.players.size < MIN_PLAYERS_TO_START) {
            socket.emit('minigame:error', { message: `Need at least ${MIN_PLAYERS_TO_START} players` });
            return;
        }

        // Check all non-host players are ready
        for (const [playerId, player] of session.players) {
            if (playerId !== socket.id && !player.isReady) {
                socket.emit('minigame:error', { message: 'Not all players are ready' });
                return;
            }
        }

        startGame(ctx, session);
    });

    // Auto-join (no lobby, auto-start)
    socket.on('minigame:autoJoin', (data: { gameType: string; roomId: string; playerName: string }) => {
        console.log(`[Minigame] ${socket.id} auto-joining ${data.gameType} in room ${data.roomId}`);

        const sessionId = getMinigameSessionId(data.roomId, data.gameType);
        leaveCurrentSession(ctx, socket.id, sessionId);

        let session = sessions.get(sessionId);

        // Join active game
        if (session && session.isActive) {
            if (session.players.size >= MAX_PLAYERS) {
                socket.emit('minigame:error', { message: 'Game is full' });
                return;
            }

            session.players.set(socket.id, {
                id: socket.id,
                name: data.playerName || `Player_${socket.id.substring(0, 4)}`,
                isReady: true,
                isHost: false
            });

            socket.join(`minigame:${sessionId}`);

            const playersArray = createPlayersArray(session);
            const playerIndex = session.players.size - 1;

            socket.emit('minigame:gameStart', {
                sessionId: session.sessionId,
                gameType: session.gameType,
                hostId: session.hostId,
                players: playersArray
            });

            socket.to(`minigame:${sessionId}`).emit('minigame:playerJoined', {
                sessionId,
                player: {
                    ...session.players.get(socket.id),
                    spawnPoint: SPAWN_POINTS[playerIndex % SPAWN_POINTS.length],
                    color: PLAYER_COLORS[playerIndex % PLAYER_COLORS.length],
                    playerIndex
                }
            });

            console.log(`[Minigame] Player ${socket.id} joining active game ${sessionId}`);
            return;
        }

        // Create or join waiting session
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
            sessions.set(sessionId, session);
            console.log(`[Minigame] Created new session ${sessionId}, host: ${socket.id}`);
        }

        const isHost = session.players.size === 0 || session.hostId === socket.id;
        session.players.set(socket.id, {
            id: socket.id,
            name: data.playerName || `Player_${socket.id.substring(0, 4)}`,
            isReady: true,
            isHost
        });

        if (isHost) session.hostId = socket.id;
        socket.join(`minigame:${sessionId}`);

        // Auto-start if enough players
        if (session.players.size >= MIN_PLAYERS_TO_START) {
            startGame(ctx, session);
        } else {
            console.log(`[Minigame] Session ${sessionId} waiting for players (${session.players.size}/${MIN_PLAYERS_TO_START})`);
            socket.emit('minigame:waiting', {
                sessionId,
                gameType: data.gameType,
                playerCount: session.players.size,
                message: 'Waiting for another player to join...'
            });

            socket.to(`minigame:${sessionId}`).emit('minigame:playerJoined', {
                sessionId,
                player: session.players.get(socket.id)
            });
        }
    });

    // Host broadcasts game state
    socket.on('minigame:state', (data: { sessionId: string; state: any }) => {
        const session = sessions.get(data.sessionId);
        if (!session || session.hostId !== socket.id) return;

        session.gameState = data.state;
        socket.to(`minigame:${data.sessionId}`).emit('minigame:state', {
            sessionId: data.sessionId,
            state: data.state,
            timestamp: Date.now()
        });
    });

    // Client sends input to host
    socket.on('minigame:input', (data: { sessionId: string; input: any }) => {
        const session = sessions.get(data.sessionId);
        if (!session) return;

        io.to(session.hostId).emit('minigame:input', {
            sessionId: data.sessionId,
            playerId: socket.id,
            input: data.input,
            timestamp: Date.now()
        });
    });

    // Game events
    socket.on('minigame:event', (data: { sessionId: string; event: string; payload: any }) => {
        const session = sessions.get(data.sessionId);
        if (!session) return;

        console.log(`[Minigame] Event in ${data.sessionId}: ${data.event}`);

        io.to(`minigame:${data.sessionId}`).emit('minigame:event', {
            sessionId: data.sessionId,
            event: data.event,
            payload: data.payload,
            fromPlayerId: socket.id
        });

        if (data.event === 'gameEnd') {
            session.isActive = false;
            session.gameState = null;
        }
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
        const session = findPlayerMinigameSession(sessions, socket.id);
        if (!session) return;

        const wasHost = session.hostId === socket.id;
        session.players.delete(socket.id);

        io.to(`minigame:${session.sessionId}`).emit('minigame:playerLeft', {
            sessionId: session.sessionId,
            playerId: socket.id
        });

        if (session.players.size === 0) {
            sessions.delete(session.sessionId);
        } else if (wasHost) {
            transferHost(ctx, session);
        }
    });
}
