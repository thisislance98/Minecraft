/**
 * XboxTank - Tank battle game with mouse-controlled turret
 * Controls: WASD/Arrow keys for directional movement (Up=up, Right=right, etc.), Mouse to aim turret, Click to fire
 * Features: Maze levels, moving enemy tanks, bullets bounce once off walls
 * Now supports multiplayer PvP via socket.io
 */
export class XboxTank {
    constructor(canvas, callbacks, socketManager = null, isMultiplayer = false) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.callbacks = callbacks;
        this.GAME_WIDTH = canvas.width;
        this.GAME_HEIGHT = canvas.height;
        this.state = null;
        this.lastTime = 0;
        this.animationId = null;

        // Grid-based maze settings
        this.TILE_SIZE = 40;
        this.COLS = Math.floor(this.GAME_WIDTH / this.TILE_SIZE);
        this.ROWS = Math.floor(this.GAME_HEIGHT / this.TILE_SIZE);

        // Multiplayer properties
        this.isMultiplayer = isMultiplayer;
        this.socketManager = socketManager;
        this.isHost = false;
        this.sessionId = null;
        this.localPlayerId = socketManager?.socketId || null;
        this.multiplayerPlayers = new Map(); // All human players by ID
        this.remoteInputs = new Map(); // Inputs from remote players (host only)
        this.lastStateBroadcast = 0;
        this.STATE_BROADCAST_INTERVAL = 50; // 20Hz = 50ms
        this.lastInputSend = 0;
        this.INPUT_SEND_INTERVAL = 16; // ~60Hz

        // Player colors for multiplayer
        this.PLAYER_COLORS = ['#107c10', '#3366cc', '#cc9900', '#cc33cc'];

        this.levelData = this.createLevels();
    }

    createLevels() {
        // 0 = empty, 1 = wall
        return [
            // Level 1 - Open field with center obstacles
            {
                name: "Open Field",
                maze: [
                    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
                    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
                    [1,0,0,0,0,1,1,1,1,1,0,0,0,0,1],
                    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
                    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
                    [1,0,0,0,0,1,1,1,1,1,0,0,0,0,1],
                    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
                    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                ],
                playerStart: { x: 2, y: 4 },
                enemyStart: { x: 12, y: 4 },
                enemyCount: 1
            },
            // Level 2 - Easy maze
            {
                name: "Easy Maze",
                maze: [
                    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                    [1,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
                    [1,0,1,1,0,1,0,1,0,1,0,1,1,0,1],
                    [1,0,0,0,0,1,0,0,0,1,0,0,0,0,1],
                    [1,1,1,0,1,1,0,1,0,1,1,0,1,1,1],
                    [1,0,0,0,0,1,0,0,0,1,0,0,0,0,1],
                    [1,0,1,1,0,1,0,1,0,1,0,1,1,0,1],
                    [1,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
                    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                ],
                playerStart: { x: 1, y: 1 },
                enemyStart: { x: 13, y: 7 },
                enemyCount: 1
            },
            // Level 3 - Complex maze
            {
                name: "Complex Maze",
                maze: [
                    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                    [1,0,0,0,1,0,0,0,0,0,1,0,0,0,1],
                    [1,0,1,0,1,0,1,1,1,0,1,0,1,0,1],
                    [1,0,1,0,0,0,0,0,0,0,0,0,1,0,1],
                    [1,0,1,1,1,0,1,0,1,0,1,1,1,0,1],
                    [1,0,0,0,0,0,1,0,1,0,0,0,0,0,1],
                    [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
                    [1,0,0,0,1,0,0,0,0,0,1,0,0,0,1],
                    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                ],
                playerStart: { x: 1, y: 4 },
                enemyStart: { x: 13, y: 4 },
                enemyCount: 1
            },
            // Level 4 - Two enemies
            {
                name: "Double Trouble",
                maze: [
                    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                    [1,0,0,0,0,0,1,0,1,0,0,0,0,0,1],
                    [1,0,1,1,1,0,0,0,0,0,1,1,1,0,1],
                    [1,0,0,0,1,0,1,0,1,0,1,0,0,0,1],
                    [1,0,1,0,0,0,0,0,0,0,0,0,1,0,1],
                    [1,0,0,0,1,0,1,0,1,0,1,0,0,0,1],
                    [1,0,1,1,1,0,0,0,0,0,1,1,1,0,1],
                    [1,0,0,0,0,0,1,0,1,0,0,0,0,0,1],
                    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                ],
                playerStart: { x: 1, y: 4 },
                enemyStart: { x: 13, y: 1 },
                enemyCount: 2
            },
            // Level 5 - Three enemies
            {
                name: "Surrounded",
                maze: [
                    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
                    [1,0,0,1,0,0,0,0,0,0,0,1,0,0,1],
                    [1,0,0,1,0,0,1,1,1,0,0,1,0,0,1],
                    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
                    [1,0,0,1,0,0,1,1,1,0,0,1,0,0,1],
                    [1,0,0,1,0,0,0,0,0,0,0,1,0,0,1],
                    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
                    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                ],
                playerStart: { x: 7, y: 4 },
                enemyStart: { x: 2, y: 2 },
                enemyCount: 3
            }
        ];
    }

    start(levelIndex = 0) {
        this.stop();

        const level = this.levelData[levelIndex % this.levelData.length];
        const actualLevel = levelIndex % this.levelData.length;

        // Create enemies
        const enemies = [];
        const enemyPositions = [
            level.enemyStart,
            { x: level.enemyStart.x, y: level.maze.length - 2 - level.enemyStart.y },
            { x: Math.floor(level.maze[0].length / 2), y: 1 }
        ];

        for (let i = 0; i < level.enemyCount; i++) {
            const pos = enemyPositions[i % enemyPositions.length];
            enemies.push({
                x: pos.x * this.TILE_SIZE + this.TILE_SIZE / 2,
                y: pos.y * this.TILE_SIZE + this.TILE_SIZE / 2,
                angle: Math.PI, // Body angle
                turretAngle: Math.PI, // Turret angle (same as body for enemies)
                size: 14,
                speed: 1.2 + (actualLevel * 0.15),
                rotationSpeed: 0.03,
                health: 3,
                maxHealth: 3,
                bullet: null,
                lastShot: 0,
                fireRate: 2000 - (actualLevel * 200),
                // AI state
                targetAngle: Math.PI,
                moveTimer: 0,
                state: 'patrol',
                patrolDir: 1
            });
        }

        this.state = {
            levelIndex: actualLevel,
            levelName: level.name,
            maze: level.maze,
            player: {
                x: level.playerStart.x * this.TILE_SIZE + this.TILE_SIZE / 2,
                y: level.playerStart.y * this.TILE_SIZE + this.TILE_SIZE / 2,
                angle: 0, // Body angle (movement direction)
                turretAngle: 0, // Turret angle (mouse controlled)
                size: 14,
                speed: 2,
                rotationSpeed: 0.05,
                health: 3,
                maxHealth: 3,
                bullet: null,
                lastShot: 0,
                fireRate: 400,
                score: 0
            },
            enemies,
            keys: {},
            mouseX: this.GAME_WIDTH / 2,
            mouseY: this.GAME_HEIGHT / 2,
            active: true,
            gameTime: 120,
            showLevelBanner: false,
            hitFlash: 0
        };

        // Keyboard handlers
        this.handleKeyDown = (e) => {
            if (!this.state) return;
            this.state.keys[e.code] = true;

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
                e.preventDefault();
            }
        };

        this.handleKeyUp = (e) => {
            if (!this.state) return;
            this.state.keys[e.code] = false;
        };

        // Mouse handlers
        this.handleMouseMove = (e) => {
            if (!this.state) return;
            const rect = this.canvas.getBoundingClientRect();
            this.state.mouseX = e.clientX - rect.left;
            this.state.mouseY = e.clientY - rect.top;
        };

        this.handleMouseDown = (e) => {
            if (!this.state || !this.state.active) return;
            if (e.button === 0) { // Left click
                this.shootPlayer();
            }
        };

        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mousedown', this.handleMouseDown);

        this.lastTime = 0;
        this.loop = this.loop.bind(this);
        this.animationId = requestAnimationFrame(this.loop);
    }

    stop() {
        if (this.handleKeyDown) {
            window.removeEventListener('keydown', this.handleKeyDown);
            window.removeEventListener('keyup', this.handleKeyUp);
        }
        if (this.handleMouseMove) {
            this.canvas.removeEventListener('mousemove', this.handleMouseMove);
            this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        }
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.state) {
            this.state.active = false;
        }

        // Clean up multiplayer socket listeners
        if (this.isMultiplayer && this.socketManager?.socket) {
            this.socketManager.socket.off('minigame:state');
            this.socketManager.socket.off('minigame:input');
            this.socketManager.socket.off('minigame:event');
            this.socketManager.socket.off('minigame:playerLeft');
        }

        this.state = null;
        this.multiplayerPlayers.clear();
        this.remoteInputs.clear();
    }

    /**
     * Start a multiplayer game
     */
    startMultiplayer(gameData, isHost, localPlayer) {
        this.stop();

        this.isMultiplayer = true;
        this.isHost = isHost;
        this.sessionId = gameData.sessionId;
        this.localPlayerId = localPlayer?.id || this.socketManager?.socketId;

        console.log(`[XboxTank] Starting multiplayer - Host: ${isHost}, SessionId: ${this.sessionId}, LocalPlayer: ${this.localPlayerId}`);

        // Use the first level for multiplayer (open arena is best)
        const level = this.levelData[0];

        // Initialize multiplayer players from game data
        this.multiplayerPlayers.clear();
        for (const playerData of gameData.players) {
            const spawnX = playerData.spawnPoint.x * this.TILE_SIZE + this.TILE_SIZE / 2;
            const spawnY = playerData.spawnPoint.y * this.TILE_SIZE + this.TILE_SIZE / 2;

            this.multiplayerPlayers.set(playerData.id, {
                id: playerData.id,
                name: playerData.name,
                x: spawnX,
                y: spawnY,
                angle: playerData.playerIndex < 2 ? 0 : Math.PI, // Face center
                turretAngle: playerData.playerIndex < 2 ? 0 : Math.PI,
                size: 14,
                speed: 2,
                rotationSpeed: 0.05,
                health: 3,
                maxHealth: 3,
                bullet: null,
                lastShot: 0,
                fireRate: 400,
                score: 0,
                color: playerData.color,
                playerIndex: playerData.playerIndex,
                isAlive: true,
                respawnTimer: 0,
                spawnPoint: playerData.spawnPoint
            });
        }

        // Get local player reference
        const localPlayerState = this.multiplayerPlayers.get(this.localPlayerId);

        this.state = {
            levelIndex: 0,
            levelName: 'PvP Arena',
            maze: level.maze,
            player: localPlayerState, // Local player reference
            enemies: [], // No AI enemies in multiplayer PvP
            keys: {},
            mouseX: this.GAME_WIDTH / 2,
            mouseY: this.GAME_HEIGHT / 2,
            active: true,
            gameTime: 120, // 2 minute matches
            showLevelBanner: false,
            hitFlash: 0,
            isMultiplayer: true,
            hostId: gameData.hostId
        };

        // Setup input handlers
        this.setupInputHandlers();

        // Setup socket listeners for multiplayer
        this.setupMultiplayerSocketListeners();

        this.lastTime = 0;
        this.loop = this.loop.bind(this);
        this.animationId = requestAnimationFrame(this.loop);

        console.log(`[XboxTank] Multiplayer game started with ${this.multiplayerPlayers.size} players`);
    }

    /**
     * Setup input handlers (shared between single and multiplayer)
     */
    setupInputHandlers() {
        this.handleKeyDown = (e) => {
            if (!this.state) return;
            this.state.keys[e.code] = true;

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
                e.preventDefault();
            }
        };

        this.handleKeyUp = (e) => {
            if (!this.state) return;
            this.state.keys[e.code] = false;
        };

        this.handleMouseMove = (e) => {
            if (!this.state) return;
            const rect = this.canvas.getBoundingClientRect();
            this.state.mouseX = e.clientX - rect.left;
            this.state.mouseY = e.clientY - rect.top;
        };

        this.handleMouseDown = (e) => {
            if (!this.state || !this.state.active) return;
            if (e.button === 0) { // Left click
                if (this.isMultiplayer) {
                    this.shootMultiplayerPlayer(this.localPlayerId);
                } else {
                    this.shootPlayer();
                }
            }
        };

        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
    }

    /**
     * Setup socket listeners for multiplayer game events
     */
    setupMultiplayerSocketListeners() {
        if (!this.socketManager?.socket) return;

        const socket = this.socketManager.socket;

        // Receive game state from host (clients only)
        socket.on('minigame:state', (data) => {
            if (!this.isHost && data.sessionId === this.sessionId) {
                this.applyHostState(data.state);
            }
        });

        // Receive player input (host only)
        socket.on('minigame:input', (data) => {
            if (this.isHost && data.sessionId === this.sessionId) {
                this.remoteInputs.set(data.playerId, data.input);
            }
        });

        // Handle game events
        socket.on('minigame:event', (data) => {
            if (data.sessionId === this.sessionId) {
                this.handleMultiplayerEvent(data.event, data.payload, data.fromPlayerId);
            }
        });

        // Handle player joining mid-game (host receives this)
        socket.on('minigame:playerJoined', (data) => {
            if (data.sessionId === this.sessionId && this.isHost) {
                console.log(`[XboxTank] Player joined mid-game:`, data.player);
                this.addMultiplayerPlayer(data.player);
            }
        });

        // Handle player leaving mid-game
        socket.on('minigame:playerLeft', (data) => {
            if (data.sessionId === this.sessionId) {
                console.log(`[XboxTank] Player left: ${data.playerId}`);
                this.multiplayerPlayers.delete(data.playerId);
                this.remoteInputs.delete(data.playerId);
            }
        });
    }

    /**
     * Add a new player to the multiplayer game (mid-game join)
     */
    addMultiplayerPlayer(playerData) {
        if (this.multiplayerPlayers.has(playerData.id)) {
            console.log(`[XboxTank] Player ${playerData.id} already exists`);
            return;
        }

        const spawnX = playerData.spawnPoint.x * this.TILE_SIZE + this.TILE_SIZE / 2;
        const spawnY = playerData.spawnPoint.y * this.TILE_SIZE + this.TILE_SIZE / 2;

        this.multiplayerPlayers.set(playerData.id, {
            id: playerData.id,
            name: playerData.name,
            x: spawnX,
            y: spawnY,
            angle: playerData.playerIndex < 2 ? 0 : Math.PI,
            turretAngle: playerData.playerIndex < 2 ? 0 : Math.PI,
            size: 14,
            speed: 2,
            rotationSpeed: 0.05,
            health: 3,
            maxHealth: 3,
            bullet: null,
            lastShot: 0,
            fireRate: 400,
            score: 0,
            color: playerData.color,
            playerIndex: playerData.playerIndex,
            isAlive: true,
            respawnTimer: 0,
            spawnPoint: playerData.spawnPoint
        });

        console.log(`[XboxTank] Added player ${playerData.id}, total players: ${this.multiplayerPlayers.size}`);
    }

    /**
     * Shoot for a multiplayer player
     */
    shootMultiplayerPlayer(playerId) {
        const player = this.multiplayerPlayers.get(playerId);
        if (!player || !player.isAlive || player.bullet) return;

        const now = Date.now();
        if (now - player.lastShot < player.fireRate) return;

        player.lastShot = now;

        const bulletSpeed = 5;
        player.bullet = {
            x: player.x + Math.cos(player.turretAngle) * (player.size + 5),
            y: player.y + Math.sin(player.turretAngle) * (player.size + 5),
            vx: Math.cos(player.turretAngle) * bulletSpeed,
            vy: Math.sin(player.turretAngle) * bulletSpeed,
            bounces: 0,
            maxBounces: 1,
            ownerId: playerId
        };
    }

    /**
     * Broadcast game state to all clients (host only)
     */
    broadcastGameState() {
        if (!this.isHost || !this.socketManager?.socket) return;

        const now = Date.now();
        if (now - this.lastStateBroadcast < this.STATE_BROADCAST_INTERVAL) return;
        this.lastStateBroadcast = now;

        // Serialize player states
        const playersState = {};
        for (const [id, player] of this.multiplayerPlayers) {
            playersState[id] = {
                x: player.x,
                y: player.y,
                angle: player.angle,
                turretAngle: player.turretAngle,
                health: player.health,
                score: player.score,
                isAlive: player.isAlive,
                respawnTimer: player.respawnTimer,
                bullet: player.bullet ? {
                    x: player.bullet.x,
                    y: player.bullet.y,
                    vx: player.bullet.vx,
                    vy: player.bullet.vy,
                    bounces: player.bullet.bounces
                } : null
            };
        }

        const stateData = {
            players: playersState,
            gameTime: this.state.gameTime,
            timestamp: now
        };

        this.socketManager.socket.emit('minigame:state', {
            sessionId: this.sessionId,
            state: stateData
        });
    }

    /**
     * Send local input to host (clients only)
     */
    sendLocalInput() {
        if (this.isHost || !this.socketManager?.socket) return;

        const now = Date.now();
        if (now - this.lastInputSend < this.INPUT_SEND_INTERVAL) return;
        this.lastInputSend = now;

        const input = {
            keys: { ...this.state.keys },
            mouseX: this.state.mouseX,
            mouseY: this.state.mouseY,
            shoot: false // Will be set by click handler
        };

        this.socketManager.socket.emit('minigame:input', {
            sessionId: this.sessionId,
            input
        });
    }

    /**
     * Apply authoritative state from host (clients only)
     */
    applyHostState(hostState) {
        if (!hostState || !hostState.players) return;

        // Update game time
        this.state.gameTime = hostState.gameTime;

        // Update all players from host state
        for (const [id, playerState] of Object.entries(hostState.players)) {
            const player = this.multiplayerPlayers.get(id);
            if (player) {
                // For local player, only update certain things (let local prediction handle movement)
                if (id === this.localPlayerId) {
                    // Reconcile health, score, alive status from server
                    player.health = playerState.health;
                    player.score = playerState.score;
                    player.isAlive = playerState.isAlive;
                    player.respawnTimer = playerState.respawnTimer;
                    // Don't override position/angle for local player - use prediction
                } else {
                    // For remote players, interpolate towards host state
                    player.x += (playerState.x - player.x) * 0.3;
                    player.y += (playerState.y - player.y) * 0.3;

                    // Angle interpolation (shortest path)
                    let angleDiff = playerState.angle - player.angle;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                    player.angle += angleDiff * 0.3;

                    let turretDiff = playerState.turretAngle - player.turretAngle;
                    while (turretDiff > Math.PI) turretDiff -= Math.PI * 2;
                    while (turretDiff < -Math.PI) turretDiff += Math.PI * 2;
                    player.turretAngle += turretDiff * 0.3;

                    player.health = playerState.health;
                    player.score = playerState.score;
                    player.isAlive = playerState.isAlive;
                    player.respawnTimer = playerState.respawnTimer;

                    // Update bullet state
                    if (playerState.bullet) {
                        player.bullet = {
                            ...playerState.bullet,
                            ownerId: id
                        };
                    } else {
                        player.bullet = null;
                    }
                }
            }
        }
    }

    /**
     * Handle multiplayer game events
     */
    handleMultiplayerEvent(event, payload, fromPlayerId) {
        console.log(`[XboxTank] Event: ${event}`, payload);

        switch (event) {
            case 'hit':
                this.state.hitFlash = 10;
                break;
            case 'playerDeath':
                // Show death effect
                break;
            case 'gameEnd':
                this.state.active = false;
                this.showMultiplayerResults(payload);
                break;
        }
    }

    /**
     * Show multiplayer results screen
     */
    showMultiplayerResults(results) {
        // Sort players by score
        const sortedPlayers = Array.from(this.multiplayerPlayers.values())
            .sort((a, b) => b.score - a.score);

        // Draw results overlay
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);

        ctx.fillStyle = '#107c10';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', this.GAME_WIDTH / 2, 60);

        ctx.font = 'bold 24px Arial';
        ctx.fillText(`Winner: ${sortedPlayers[0]?.name || 'Unknown'}`, this.GAME_WIDTH / 2, 100);

        ctx.font = '18px Arial';
        ctx.fillStyle = '#fff';
        sortedPlayers.forEach((player, index) => {
            const y = 150 + index * 40;
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
            ctx.fillStyle = player.color;
            ctx.fillText(`${medal} ${player.name}: ${player.score} pts`, this.GAME_WIDTH / 2, y);
        });

        // Trigger callback after delay
        setTimeout(() => {
            this.callbacks.onGameOver?.();
        }, 3000);
    }

    /**
     * Update multiplayer logic
     */
    updateMultiplayer(dt) {
        if (!this.state || !this.state.active) return;

        // Update game timer
        this.state.gameTime -= dt;
        if (this.state.gameTime <= 0) {
            this.endMultiplayerGame();
            return;
        }

        // Update hit flash
        if (this.state.hitFlash > 0) this.state.hitFlash--;

        if (this.isHost) {
            // Host: process all player inputs and physics
            this.updateHostLogic(dt);
            this.broadcastGameState();
        } else {
            // Client: predict local movement, send inputs
            this.updateLocalPlayerPrediction(dt);
            this.sendLocalInput();
        }
    }

    /**
     * Host-only: Update all game logic
     */
    updateHostLogic(dt) {
        // Update local player with local input
        this.updatePlayerMovement(this.localPlayerId, this.state.keys, this.state.mouseX, this.state.mouseY, dt);

        // Update remote players with their inputs
        for (const [playerId, input] of this.remoteInputs) {
            if (playerId !== this.localPlayerId) {
                this.updatePlayerMovement(playerId, input.keys, input.mouseX, input.mouseY, dt);
            }
        }

        // Update all bullets
        for (const [playerId, player] of this.multiplayerPlayers) {
            if (player.bullet) {
                player.bullet = this.updateMultiplayerBullet(player.bullet, playerId);
            }

            // Handle respawn timer
            if (!player.isAlive) {
                player.respawnTimer -= dt;
                if (player.respawnTimer <= 0) {
                    this.respawnPlayer(playerId);
                }
            }
        }

        // Check win condition - if only one player alive (and more than 1 player in game)
        if (this.multiplayerPlayers.size > 1) {
            const alivePlayers = Array.from(this.multiplayerPlayers.values()).filter(p => p.isAlive);
            if (alivePlayers.length <= 1 && this.state.gameTime < 115) { // Give a few seconds at start
                // Check if there's a clear winner or it's a draw
                // For now, continue until timer runs out
            }
        }
    }

    /**
     * Update a specific player's movement
     * Uses Xbox-style directional controls: Up moves up, Right moves right, etc.
     */
    updatePlayerMovement(playerId, keys, mouseX, mouseY, dt) {
        const player = this.multiplayerPlayers.get(playerId);
        if (!player || !player.isAlive) return;

        // Update turret angle to follow mouse
        const dx = mouseX - player.x;
        const dy = mouseY - player.y;
        player.turretAngle = Math.atan2(dy, dx);

        // Xbox-style directional movement (Up=up, Right=right, etc.)
        let moveX = 0, moveY = 0;
        if (keys['KeyW'] || keys['ArrowUp']) {
            moveY = -player.speed; // Up on screen
        }
        if (keys['KeyS'] || keys['ArrowDown']) {
            moveY = player.speed; // Down on screen
        }
        if (keys['KeyA'] || keys['ArrowLeft']) {
            moveX = -player.speed; // Left on screen
        }
        if (keys['KeyD'] || keys['ArrowRight']) {
            moveX = player.speed; // Right on screen
        }

        // Normalize diagonal movement to prevent faster diagonal speed
        if (moveX !== 0 && moveY !== 0) {
            const diagonalFactor = 1 / Math.sqrt(2);
            moveX *= diagonalFactor;
            moveY *= diagonalFactor;
        }

        // Update tank body angle to face movement direction (if moving)
        if (moveX !== 0 || moveY !== 0) {
            player.angle = Math.atan2(moveY, moveX);
        }

        // Apply movement with collision check
        const newX = player.x + moveX;
        const newY = player.y + moveY;

        if (!this.checkWallCollision(newX, player.y, player.size)) {
            player.x = newX;
        }
        if (!this.checkWallCollision(player.x, newY, player.size)) {
            player.y = newY;
        }
    }

    /**
     * Client-only: Predict local player movement
     */
    updateLocalPlayerPrediction(dt) {
        const player = this.multiplayerPlayers.get(this.localPlayerId);
        if (!player || !player.isAlive) return;

        this.updatePlayerMovement(this.localPlayerId, this.state.keys, this.state.mouseX, this.state.mouseY, dt);

        // Update local bullet (for visual feedback, authoritative state comes from host)
        if (player.bullet) {
            player.bullet = this.updateMultiplayerBullet(player.bullet, this.localPlayerId);
        }
    }

    /**
     * Update bullet for multiplayer
     */
    updateMultiplayerBullet(bullet, ownerId) {
        if (!bullet) return null;

        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        // Check wall collision
        const tileX = Math.floor(bullet.x / this.TILE_SIZE);
        const tileY = Math.floor(bullet.y / this.TILE_SIZE);

        let hitWall = false;
        if (tileY < 0 || tileY >= this.state.maze.length ||
            tileX < 0 || tileX >= this.state.maze[0].length ||
            this.state.maze[tileY][tileX] === 1) {
            hitWall = true;
        }

        if (hitWall) {
            if (bullet.bounces < bullet.maxBounces) {
                // Bounce off wall
                const prevTileX = Math.floor((bullet.x - bullet.vx) / this.TILE_SIZE);
                const prevTileY = Math.floor((bullet.y - bullet.vy) / this.TILE_SIZE);

                if (prevTileX !== tileX) bullet.vx *= -1;
                if (prevTileY !== tileY) bullet.vy *= -1;

                bullet.x += bullet.vx * 2;
                bullet.y += bullet.vy * 2;
                bullet.bounces++;
            } else {
                return null; // Destroy bullet
            }
        }

        // Check hit on other players (host only handles this authoritatively)
        if (this.isHost) {
            for (const [playerId, player] of this.multiplayerPlayers) {
                if (playerId === ownerId || !player.isAlive) continue;

                const hitDx = bullet.x - player.x;
                const hitDy = bullet.y - player.y;
                const dist = Math.sqrt(hitDx * hitDx + hitDy * hitDy);

                if (dist < player.size + 4) {
                    // Hit!
                    player.health--;
                    this.state.hitFlash = 10;

                    // Award score to shooter
                    const shooter = this.multiplayerPlayers.get(ownerId);
                    if (shooter) {
                        shooter.score += 200; // PvP hit
                    }

                    // Check if player died
                    if (player.health <= 0) {
                        player.isAlive = false;
                        player.respawnTimer = 3; // 3 second respawn

                        // Broadcast death event
                        this.socketManager?.socket?.emit('minigame:event', {
                            sessionId: this.sessionId,
                            event: 'playerDeath',
                            payload: { playerId, killerId: ownerId }
                        });
                    }

                    return null; // Destroy bullet
                }
            }
        }

        return bullet;
    }

    /**
     * Respawn a player at their spawn point
     */
    respawnPlayer(playerId) {
        const player = this.multiplayerPlayers.get(playerId);
        if (!player) return;

        player.x = player.spawnPoint.x * this.TILE_SIZE + this.TILE_SIZE / 2;
        player.y = player.spawnPoint.y * this.TILE_SIZE + this.TILE_SIZE / 2;
        player.health = player.maxHealth;
        player.isAlive = true;
        player.bullet = null;
        player.angle = player.playerIndex < 2 ? 0 : Math.PI;
        player.turretAngle = player.angle;

        console.log(`[XboxTank] Player ${playerId} respawned at`, player.spawnPoint);
    }

    /**
     * End the multiplayer game
     */
    endMultiplayerGame() {
        this.state.active = false;

        // Find winner (highest score)
        const sortedPlayers = Array.from(this.multiplayerPlayers.values())
            .sort((a, b) => b.score - a.score);

        const results = {
            winner: sortedPlayers[0]?.id,
            scores: Object.fromEntries(
                Array.from(this.multiplayerPlayers.entries()).map(([id, p]) => [id, p.score])
            )
        };

        // Host broadcasts game end
        if (this.isHost) {
            this.socketManager?.socket?.emit('minigame:event', {
                sessionId: this.sessionId,
                event: 'gameEnd',
                payload: results
            });
        }

        this.showMultiplayerResults(results);
    }

    /**
     * Become the host (host migration)
     */
    becomeHost(gameState) {
        console.log('[XboxTank] Becoming host due to host migration');
        this.isHost = true;
        this.state.hostId = this.localPlayerId;

        // Apply the last known game state
        if (gameState) {
            this.applyHostState(gameState);
        }
    }

    // Check if a position collides with maze walls
    checkWallCollision(x, y, size) {
        const margin = size;
        const points = [
            { x: x - margin, y: y - margin },
            { x: x + margin, y: y - margin },
            { x: x - margin, y: y + margin },
            { x: x + margin, y: y + margin }
        ];

        for (const p of points) {
            const tileX = Math.floor(p.x / this.TILE_SIZE);
            const tileY = Math.floor(p.y / this.TILE_SIZE);

            if (tileY < 0 || tileY >= this.state.maze.length ||
                tileX < 0 || tileX >= this.state.maze[0].length) {
                return true;
            }

            if (this.state.maze[tileY][tileX] === 1) {
                return true;
            }
        }
        return false;
    }

    // Player shoots with turret angle
    shootPlayer() {
        const p = this.state.player;
        if (p.bullet) return; // Only one bullet at a time

        const now = Date.now();
        if (now - p.lastShot < p.fireRate) return;

        p.lastShot = now;

        const bulletSpeed = 5;
        p.bullet = {
            x: p.x + Math.cos(p.turretAngle) * (p.size + 5),
            y: p.y + Math.sin(p.turretAngle) * (p.size + 5),
            vx: Math.cos(p.turretAngle) * bulletSpeed,
            vy: Math.sin(p.turretAngle) * bulletSpeed,
            bounces: 0,
            maxBounces: 1, // All bullets bounce once
            isEnemy: false
        };
    }

    // Enemy shoots
    shootEnemy(enemy) {
        if (enemy.bullet) return;

        const now = Date.now();
        if (now - enemy.lastShot < enemy.fireRate) return;

        enemy.lastShot = now;

        const bulletSpeed = 4;
        enemy.bullet = {
            x: enemy.x + Math.cos(enemy.turretAngle) * (enemy.size + 5),
            y: enemy.y + Math.sin(enemy.turretAngle) * (enemy.size + 5),
            vx: Math.cos(enemy.turretAngle) * bulletSpeed,
            vy: Math.sin(enemy.turretAngle) * bulletSpeed,
            bounces: 0,
            maxBounces: 1, // All bullets bounce once
            isEnemy: true
        };
    }

    // Update bullet position and check collisions
    updateBullet(bullet, owner, targets) {
        if (!bullet) return null;

        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        // Check wall collision
        const tileX = Math.floor(bullet.x / this.TILE_SIZE);
        const tileY = Math.floor(bullet.y / this.TILE_SIZE);

        let hitWall = false;
        if (tileY < 0 || tileY >= this.state.maze.length ||
            tileX < 0 || tileX >= this.state.maze[0].length ||
            this.state.maze[tileY][tileX] === 1) {
            hitWall = true;
        }

        if (hitWall) {
            if (bullet.bounces < bullet.maxBounces) {
                // Bounce off wall
                const prevTileX = Math.floor((bullet.x - bullet.vx) / this.TILE_SIZE);
                const prevTileY = Math.floor((bullet.y - bullet.vy) / this.TILE_SIZE);

                if (prevTileX !== tileX) bullet.vx *= -1;
                if (prevTileY !== tileY) bullet.vy *= -1;

                bullet.x += bullet.vx * 2;
                bullet.y += bullet.vy * 2;
                bullet.bounces++;
            } else {
                return null; // Destroy bullet
            }
        }

        // Check hit on targets
        for (const target of targets) {
            const dx = bullet.x - target.x;
            const dy = bullet.y - target.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < target.size + 4) {
                target.health--;
                this.state.hitFlash = 10;

                if (!bullet.isEnemy) {
                    this.state.player.score += 100;
                }

                return null; // Destroy bullet
            }
        }

        return bullet;
    }

    // AI for enemy tanks
    updateEnemyAI(enemy, dt) {
        const p = this.state.player;
        const dx = p.x - enemy.x;
        const dy = p.y - enemy.y;
        const distToPlayer = Math.sqrt(dx * dx + dy * dy);
        const angleToPlayer = Math.atan2(dy, dx);

        enemy.moveTimer += dt;

        // State machine AI
        if (distToPlayer < 180) {
            enemy.state = 'chase';
        } else if (distToPlayer > 280) {
            enemy.state = 'patrol';
        }

        let targetAngle = enemy.angle;
        let shouldMove = true;

        // Turret always aims at player
        enemy.turretAngle = angleToPlayer;

        if (enemy.state === 'chase') {
            // Move towards player
            targetAngle = angleToPlayer;

            // Shoot if roughly aimed at player
            let angleDiff = angleToPlayer - enemy.turretAngle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            if (Math.abs(angleDiff) < 0.4) {
                this.shootEnemy(enemy);
            }
        } else {
            // Patrol - move around randomly
            if (enemy.moveTimer > 2) {
                enemy.moveTimer = 0;
                enemy.targetAngle = enemy.angle + (Math.random() - 0.5) * Math.PI;
            }
            targetAngle = enemy.targetAngle;

            // Occasionally shoot in patrol mode
            if (Math.random() < 0.008) {
                this.shootEnemy(enemy);
            }
        }

        // Rotate body towards target angle
        let angleDiff = targetAngle - enemy.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const rotateAmount = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), enemy.rotationSpeed);
        enemy.angle += rotateAmount;

        // Move forward if not blocked
        if (shouldMove && Math.abs(angleDiff) < 0.5) {
            const newX = enemy.x + Math.cos(enemy.angle) * enemy.speed;
            const newY = enemy.y + Math.sin(enemy.angle) * enemy.speed;

            if (!this.checkWallCollision(newX, newY, enemy.size)) {
                enemy.x = newX;
                enemy.y = newY;
            } else {
                // Hit wall - turn around
                enemy.targetAngle = enemy.angle + Math.PI / 2 * enemy.patrolDir;
                enemy.patrolDir *= -1;
            }
        }

        // Update enemy bullet
        if (enemy.bullet) {
            enemy.bullet = this.updateBullet(enemy.bullet, enemy, [p]);
        }
    }

    update(dt) {
        if (!this.state || !this.state.active) return;

        // Handle multiplayer update separately
        if (this.isMultiplayer) {
            this.updateMultiplayer(dt);
            return;
        }

        const p = this.state.player;
        const keys = this.state.keys;

        // Update game timer
        this.state.gameTime -= dt;
        if (this.state.gameTime <= 0) {
            this.state.active = false;
            if (this.state.enemies.every(e => e.health <= 0)) {
                const nextLvl = this.state.levelIndex + 1;
                if (nextLvl < this.levelData.length) {
                    this.callbacks.onLevelComplete?.(nextLvl);
                } else {
                    this.callbacks.onAllLevelsComplete?.();
                }
            } else {
                this.callbacks.onGameOver?.();
            }
            return;
        }

        // Update hit flash
        if (this.state.hitFlash > 0) this.state.hitFlash--;

        // Update turret angle to follow mouse
        const dx = this.state.mouseX - p.x;
        const dy = this.state.mouseY - p.y;
        p.turretAngle = Math.atan2(dy, dx);

        // Xbox-style directional movement (Up=up, Right=right, etc.)
        let moveX = 0, moveY = 0;
        if (keys['KeyW'] || keys['ArrowUp']) {
            moveY = -p.speed; // Up on screen
        }
        if (keys['KeyS'] || keys['ArrowDown']) {
            moveY = p.speed; // Down on screen
        }
        if (keys['KeyA'] || keys['ArrowLeft']) {
            moveX = -p.speed; // Left on screen
        }
        if (keys['KeyD'] || keys['ArrowRight']) {
            moveX = p.speed; // Right on screen
        }

        // Normalize diagonal movement to prevent faster diagonal speed
        if (moveX !== 0 && moveY !== 0) {
            const diagonalFactor = 1 / Math.sqrt(2);
            moveX *= diagonalFactor;
            moveY *= diagonalFactor;
        }

        // Update tank body angle to face movement direction (if moving)
        if (moveX !== 0 || moveY !== 0) {
            p.angle = Math.atan2(moveY, moveX);
        }

        // Apply movement with collision check
        const newX = p.x + moveX;
        const newY = p.y + moveY;

        if (!this.checkWallCollision(newX, p.y, p.size)) {
            p.x = newX;
        }
        if (!this.checkWallCollision(p.x, newY, p.size)) {
            p.y = newY;
        }

        // Update player bullet
        if (p.bullet) {
            p.bullet = this.updateBullet(p.bullet, p, this.state.enemies.filter(e => e.health > 0));
        }

        // Update enemies
        for (const enemy of this.state.enemies) {
            if (enemy.health > 0) {
                this.updateEnemyAI(enemy, dt);
            }
        }

        // Check if player is dead
        if (p.health <= 0) {
            this.state.active = false;
            this.callbacks.onGameOver?.();
            return;
        }

        // Check if all enemies are dead
        if (this.state.enemies.every(e => e.health <= 0)) {
            this.state.active = false;
            const nextLvl = this.state.levelIndex + 1;
            if (nextLvl < this.levelData.length) {
                this.callbacks.onLevelComplete?.(nextLvl);
            } else {
                this.callbacks.onAllLevelsComplete?.();
            }
        }
    }

    draw() {
        if (!this.state) return;

        const ctx = this.ctx;

        // Use multiplayer draw if in multiplayer mode
        if (this.isMultiplayer) {
            this.drawMultiplayer();
            return;
        }

        const p = this.state.player;

        // Background
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);

        // Draw maze walls
        for (let y = 0; y < this.state.maze.length; y++) {
            for (let x = 0; x < this.state.maze[y].length; x++) {
                if (this.state.maze[y][x] === 1) {
                    const wx = x * this.TILE_SIZE;
                    const wy = y * this.TILE_SIZE;

                    ctx.fillStyle = '#444';
                    ctx.fillRect(wx, wy, this.TILE_SIZE, this.TILE_SIZE);

                    ctx.fillStyle = '#555';
                    ctx.fillRect(wx + 2, wy + 2, this.TILE_SIZE - 4, this.TILE_SIZE - 4);

                    ctx.fillStyle = '#333';
                    ctx.fillRect(wx + 4, wy + 4, this.TILE_SIZE - 6, this.TILE_SIZE - 6);
                }
            }
        }

        // Draw player tank with separate turret
        this.drawTank(ctx, p, '#107c10', '#0d5a0d', true);

        // Draw player bullet
        if (p.bullet) {
            ctx.fillStyle = '#ffff00';
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(p.bullet.x, p.bullet.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Draw enemies
        for (const enemy of this.state.enemies) {
            if (enemy.health > 0) {
                this.drawTank(ctx, enemy, '#cc3333', '#992222', true);

                // Draw enemy bullet
                if (enemy.bullet) {
                    ctx.fillStyle = '#ff6600';
                    ctx.shadowColor = '#ff6600';
                    ctx.shadowBlur = 6;
                    ctx.beginPath();
                    ctx.arc(enemy.bullet.x, enemy.bullet.y, 5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            }
        }

        // Draw crosshair at mouse position
        ctx.strokeStyle = '#107c10';
        ctx.lineWidth = 2;
        const mx = this.state.mouseX;
        const my = this.state.mouseY;
        ctx.beginPath();
        ctx.moveTo(mx - 10, my);
        ctx.lineTo(mx + 10, my);
        ctx.moveTo(mx, my - 10);
        ctx.lineTo(mx, my + 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(mx, my, 8, 0, Math.PI * 2);
        ctx.stroke();

        // Hit flash effect
        if (this.state.hitFlash > 0) {
            ctx.fillStyle = `rgba(255, 0, 0, ${this.state.hitFlash / 20})`;
            ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
        }

        // UI - Background bar for better visibility
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.GAME_WIDTH, 30);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Level ${this.state.levelIndex + 1}: ${this.state.levelName}`, 10, 20);

        // Timer
        const mins = Math.floor(this.state.gameTime / 60);
        const secs = Math.floor(this.state.gameTime % 60);
        ctx.textAlign = 'center';
        ctx.fillStyle = this.state.gameTime < 30 ? '#ff4444' : '#fff';
        ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, this.GAME_WIDTH / 2, 20);

        // Score
        ctx.fillStyle = '#ffff00';
        ctx.textAlign = 'right';
        ctx.fillText(`Score: ${p.score}`, this.GAME_WIDTH - 10, 20);

        // Health indicators
        ctx.textAlign = 'left';
        ctx.fillStyle = '#107c10';
        ctx.fillText(`Player: ${'🛡️'.repeat(p.health)}${'💀'.repeat(p.maxHealth - p.health)}`, 10, this.GAME_HEIGHT - 10);

        const aliveEnemies = this.state.enemies.filter(e => e.health > 0);
        if (aliveEnemies.length > 0) {
            ctx.fillStyle = '#cc3333';
            ctx.textAlign = 'right';
            const enemyHealth = aliveEnemies.reduce((sum, e) => sum + e.health, 0);
            const enemyMaxHealth = aliveEnemies.reduce((sum, e) => sum + e.maxHealth, 0);
            ctx.fillText(`Enemy: ${'🛡️'.repeat(enemyHealth)}${'💀'.repeat(enemyMaxHealth - enemyHealth)}`, this.GAME_WIDTH - 10, this.GAME_HEIGHT - 10);
        }

        // Level banner
        if (this.state.showLevelBanner) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(0, this.GAME_HEIGHT / 2 - 50, this.GAME_WIDTH, 100);

            ctx.fillStyle = '#107c10';
            ctx.font = 'bold 28px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`Level ${this.state.levelIndex + 1}`, this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 - 10);

            ctx.fillStyle = '#fff';
            ctx.font = '18px Arial';
            ctx.fillText(this.state.levelName, this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 + 20);

            ctx.fillStyle = '#888';
            ctx.font = '12px Arial';
            ctx.fillText('Arrow keys/WASD to move • Mouse to aim • Click to fire', this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 + 45);
        }
    }

    /**
     * Draw multiplayer game
     */
    drawMultiplayer() {
        const ctx = this.ctx;

        // Background
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);

        // Draw maze walls
        for (let y = 0; y < this.state.maze.length; y++) {
            for (let x = 0; x < this.state.maze[y].length; x++) {
                if (this.state.maze[y][x] === 1) {
                    const wx = x * this.TILE_SIZE;
                    const wy = y * this.TILE_SIZE;

                    ctx.fillStyle = '#444';
                    ctx.fillRect(wx, wy, this.TILE_SIZE, this.TILE_SIZE);

                    ctx.fillStyle = '#555';
                    ctx.fillRect(wx + 2, wy + 2, this.TILE_SIZE - 4, this.TILE_SIZE - 4);

                    ctx.fillStyle = '#333';
                    ctx.fillRect(wx + 4, wy + 4, this.TILE_SIZE - 6, this.TILE_SIZE - 6);
                }
            }
        }

        // Draw all players
        for (const [playerId, player] of this.multiplayerPlayers) {
            if (!player.isAlive) {
                // Draw respawn ghost
                ctx.globalAlpha = 0.3;
                this.drawTank(ctx, player, player.color, this.darkenColor(player.color), true);
                ctx.globalAlpha = 1;

                // Draw respawn timer
                ctx.fillStyle = player.color;
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${Math.ceil(player.respawnTimer)}`, player.x, player.y - 25);
                continue;
            }

            const isLocal = playerId === this.localPlayerId;
            const darkColor = this.darkenColor(player.color);

            // Draw tank
            this.drawTank(ctx, player, player.color, darkColor, true);

            // Draw player name above tank
            ctx.fillStyle = player.color;
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(player.name + (isLocal ? ' (You)' : ''), player.x, player.y - 25);

            // Draw health bar above tank
            const healthBarWidth = 30;
            const healthBarHeight = 4;
            const healthX = player.x - healthBarWidth / 2;
            const healthY = player.y - 35;

            ctx.fillStyle = '#333';
            ctx.fillRect(healthX, healthY, healthBarWidth, healthBarHeight);
            ctx.fillStyle = player.health > 1 ? player.color : '#ff4444';
            ctx.fillRect(healthX, healthY, healthBarWidth * (player.health / player.maxHealth), healthBarHeight);

            // Draw bullet
            if (player.bullet) {
                ctx.fillStyle = player.color;
                ctx.shadowColor = player.color;
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(player.bullet.x, player.bullet.y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        // Draw crosshair for local player
        const localPlayer = this.multiplayerPlayers.get(this.localPlayerId);
        if (localPlayer) {
            ctx.strokeStyle = localPlayer.color;
            ctx.lineWidth = 2;
            const mx = this.state.mouseX;
            const my = this.state.mouseY;
            ctx.beginPath();
            ctx.moveTo(mx - 10, my);
            ctx.lineTo(mx + 10, my);
            ctx.moveTo(mx, my - 10);
            ctx.lineTo(mx, my + 10);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(mx, my, 8, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Hit flash effect
        if (this.state.hitFlash > 0) {
            ctx.fillStyle = `rgba(255, 0, 0, ${this.state.hitFlash / 20})`;
            ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
        }

        // Multiplayer UI - Background bar for better visibility
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.GAME_WIDTH, 30);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('PvP Arena', 10, 20);

        // Timer
        const mins = Math.floor(Math.max(0, this.state.gameTime) / 60);
        const secs = Math.floor(Math.max(0, this.state.gameTime) % 60);
        ctx.textAlign = 'center';
        const timerColor = this.state.gameTime < 30 ? '#ff4444' : '#fff';
        ctx.fillStyle = timerColor;
        ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, this.GAME_WIDTH / 2, 20);

        // Scoreboard (sorted by score) - positioned below the top bar
        const sortedPlayers = Array.from(this.multiplayerPlayers.values())
            .sort((a, b) => b.score - a.score);

        // Draw scoreboard background
        const scoreboardHeight = sortedPlayers.length * 22 + 10;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(this.GAME_WIDTH - 140, 35, 135, scoreboardHeight);

        ctx.textAlign = 'right';
        ctx.font = 'bold 14px Arial';
        sortedPlayers.forEach((player, index) => {
            const y = 52 + index * 22;
            ctx.fillStyle = player.color;
            const indicator = player.id === this.localPlayerId ? '► ' : '';
            ctx.fillText(`${indicator}${player.name}: ${player.score}`, this.GAME_WIDTH - 10, y);
        });

        // Level banner
        if (this.state.showLevelBanner) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(0, this.GAME_HEIGHT / 2 - 50, this.GAME_WIDTH, 100);

            ctx.fillStyle = '#107c10';
            ctx.font = 'bold 28px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('TANK BATTLE', this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 - 10);

            ctx.fillStyle = '#fff';
            ctx.font = '18px Arial';
            ctx.fillText(`${this.multiplayerPlayers.size} Players • 2 Minutes`, this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 + 20);

            ctx.fillStyle = '#888';
            ctx.font = '12px Arial';
            ctx.fillText('Arrow keys/WASD to move • Mouse to aim • Click to fire', this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 + 45);
        }
    }

    /**
     * Helper to darken a color for tank shadows/tracks
     */
    darkenColor(color) {
        // Simple darkening - parse hex and reduce values
        if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            const dark = (v) => Math.floor(v * 0.7).toString(16).padStart(2, '0');
            return `#${dark(r)}${dark(g)}${dark(b)}`;
        }
        return color;
    }

    drawTank(ctx, tank, bodyColor, darkColor, hasSeparateTurret = false) {
        // Draw body
        ctx.save();
        ctx.translate(tank.x, tank.y);
        ctx.rotate(tank.angle);

        // Tank body (rectangle)
        ctx.fillStyle = bodyColor;
        ctx.fillRect(-tank.size, -tank.size * 0.7, tank.size * 2, tank.size * 1.4);

        // Tracks
        ctx.fillStyle = darkColor;
        ctx.fillRect(-tank.size, -tank.size * 0.7 - 3, tank.size * 2, 4);
        ctx.fillRect(-tank.size, tank.size * 0.7 - 1, tank.size * 2, 4);

        ctx.restore();

        // Draw turret separately
        ctx.save();
        ctx.translate(tank.x, tank.y);

        if (hasSeparateTurret) {
            ctx.rotate(tank.turretAngle);
        } else {
            ctx.rotate(tank.angle);
        }

        // Turret base (circle)
        ctx.fillStyle = darkColor;
        ctx.beginPath();
        ctx.arc(0, 0, tank.size * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Barrel
        ctx.fillStyle = darkColor;
        ctx.fillRect(0, -3, tank.size + 10, 6);

        ctx.restore();
    }

    loop(timestamp) {
        if (!this.state || !this.state.active) return;

        if (!this.lastTime) this.lastTime = timestamp;
        const dt = Math.min(0.05, (timestamp - this.lastTime) / 1000);
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        if (this.state && this.state.active) {
            this.animationId = requestAnimationFrame(this.loop);
        }
    }

    get isActive() {
        return this.state?.active ?? false;
    }
}
