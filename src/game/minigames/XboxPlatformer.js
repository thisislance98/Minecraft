/**
 * Xbox Platformer Mini-Game
 * Extracted from UIManager.js for better code organization
 * Now supports multiplayer co-op/race mode via socket.io
 */
export class XboxPlatformer {
    constructor(canvas, callbacks, socketManager = null, isMultiplayer = false) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.callbacks = callbacks; // { onGameOver, onLevelComplete, onAllLevelsComplete }
        this.GAME_WIDTH = canvas.width;
        this.GAME_HEIGHT = canvas.height;
        this.state = null;
        this.lastTime = 0;
        this.animationId = null;

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
        const GAME_HEIGHT = this.GAME_HEIGHT;
        const GAME_WIDTH = this.GAME_WIDTH;

        return [
            {
                platforms: [
                    { x: 0, y: GAME_HEIGHT - 20, width: GAME_WIDTH, height: 20 },
                    { x: 150, y: 260, width: 100, height: 15 },
                    { x: 300, y: 200, width: 100, height: 15 },
                    { x: 450, y: 140, width: 100, height: 15 },
                    { x: 200, y: 100, width: 150, height: 15 },
                    { x: 50, y: 160, width: 80, height: 15 }
                ],
                enemies: [
                    { x: 200, y: 80, width: 20, height: 20, vx: 1, range: [200, 330] }
                ],
                goal: { x: 60, y: 140, width: 25, height: 20 }
            },
            {
                platforms: [
                    { x: 0, y: GAME_HEIGHT - 20, width: 200, height: 20 },
                    { x: 250, y: GAME_HEIGHT - 60, width: 100, height: 15 },
                    { x: 400, y: GAME_HEIGHT - 100, width: 100, height: 15 },
                    { x: 200, y: 150, width: 100, height: 15 },
                    { x: 50, y: 100, width: 100, height: 15 },
                    { x: 350, y: 80, width: 150, height: 15 },
                    { x: 550, y: 120, width: 50, height: 15 }
                ],
                enemies: [
                    { x: 250, y: GAME_HEIGHT - 80, width: 20, height: 20, vx: 1.5, range: [250, 330] },
                    { x: 350, y: 60, width: 20, height: 20, vx: -1, range: [350, 480] }
                ],
                goal: { x: 560, y: 100, width: 25, height: 20 }
            },
            {
                platforms: [
                    { x: 0, y: GAME_HEIGHT - 20, width: 100, height: 20 },
                    { x: 150, y: 280, width: 100, height: 15 },
                    { x: 300, y: 240, width: 100, height: 15 },
                    { x: 450, y: 200, width: 100, height: 15 },
                    { x: 300, y: 130, width: 100, height: 15 },
                    { x: 150, y: 90, width: 100, height: 15 },
                    { x: 0, y: 50, width: 100, height: 15 }
                ],
                enemies: [
                    { x: 150, y: 260, width: 20, height: 20, vx: 1, range: [150, 230] },
                    { x: 450, y: 180, width: 20, height: 20, vx: 2, range: [450, 530] },
                    { x: 150, y: 70, width: 20, height: 20, vx: -1.5, range: [150, 230] }
                ],
                goal: { x: 10, y: 30, width: 25, height: 20 }
            }
        ];
    }

    start(levelIndex = 0) {
        this.stop();

        const currentLevel = this.levelData[levelIndex % this.levelData.length];

        this.state = {
            levelIndex: levelIndex,
            player: {
                x: 20,
                y: this.GAME_HEIGHT - 60,
                width: 20,
                height: 20,
                vx: 0,
                vy: 0,
                speed: 5,
                jumpPower: -12,
                grounded: false,
                color: '#107c10'
            },
            platforms: currentLevel.platforms,
            enemies: currentLevel.enemies.map(e => ({ ...e })),
            goal: currentLevel.goal,
            keys: {},
            gravity: 0.35,
            active: true
        };

        this.handleKeyDown = (e) => {
            if (!this.state) return;
            this.state.keys[e.code] = true;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
        };

        this.handleKeyUp = (e) => {
            if (!this.state) return;
            this.state.keys[e.code] = false;
        };

        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);

        this.lastTime = 0;
        this.loop = this.loop.bind(this);
        this.animationId = requestAnimationFrame(this.loop);
    }

    stop() {
        if (this.handleKeyDown) {
            window.removeEventListener('keydown', this.handleKeyDown);
            window.removeEventListener('keyup', this.handleKeyUp);
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

    update(dt) {
        if (!this.state || !this.state.active) return;

        // Handle multiplayer update separately
        if (this.isMultiplayer) {
            this.updateMultiplayer(dt);
            return;
        }

        const p = this.state.player;
        const keys = this.state.keys;
        const speedScale = dt * 60;

        // Horizontal movement
        if (keys['KeyA'] || keys['ArrowLeft']) p.vx = -p.speed * speedScale;
        else if (keys['KeyD'] || keys['ArrowRight']) p.vx = p.speed * speedScale;
        else p.vx *= Math.pow(0.8, speedScale);

        p.x += p.vx;

        // Bounds
        if (p.x < 0) p.x = 0;
        if (p.x + p.width > this.GAME_WIDTH) p.x = this.GAME_WIDTH - p.width;

        // Gravity & Vertical movement
        p.vy += this.state.gravity * speedScale;
        p.y += p.vy * speedScale;
        p.grounded = false;

        // Collision with platforms
        for (const plat of this.state.platforms) {
            if (p.x + p.width > plat.x && p.x < plat.x + plat.width &&
                p.y + p.height > plat.y && p.y + p.height < plat.y + p.vy * speedScale + 5) {
                p.y = plat.y - p.height;
                p.vy = 0;
                p.grounded = true;
            }
        }

        // Enemies movement & collision
        for (const enemy of this.state.enemies) {
            enemy.x += enemy.vx * speedScale;
            if (enemy.x < enemy.range[0] || enemy.x + enemy.width > enemy.range[1]) {
                enemy.vx *= -1;
            }

            // Player collision with enemy
            if (p.x < enemy.x + enemy.width && p.x + p.width > enemy.x &&
                p.y < enemy.y + enemy.height && p.y + p.height > enemy.y) {
                this.state.active = false;
                this.callbacks.onGameOver?.();
            }
        }

        // Goal collision
        const goal = this.state.goal;
        if (p.x < goal.x + goal.width && p.x + p.width > goal.x &&
            p.y < goal.y + goal.height && p.y + p.height > goal.y) {
            this.state.active = false;
            if (this.state.levelIndex + 1 < this.levelData.length) {
                this.callbacks.onLevelComplete?.(this.state.levelIndex + 1);
            } else {
                this.draw(); // Draw win state
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '30px Arial';
                this.ctx.fillText('YOU WIN!', this.GAME_WIDTH / 2 - 60, this.GAME_HEIGHT / 2);
                this.callbacks.onAllLevelsComplete?.();
            }
        }

        // Jump
        if (p.grounded && (keys['KeyW'] || keys['Space'] || keys['ArrowUp'])) {
            p.vy = p.jumpPower;
            p.grounded = false;
        }

        // Fall off screen
        if (p.y > this.GAME_HEIGHT) {
            this.state.active = false;
            this.callbacks.onGameOver?.();
        }
    }

    draw() {
        if (!this.state) return;

        // Use multiplayer draw if in multiplayer mode
        if (this.isMultiplayer) {
            this.drawMultiplayer();
            return;
        }

        const ctx = this.ctx;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);

        // Draw Platforms
        for (const plat of this.state.platforms) {
            ctx.fillStyle = '#333';
            ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
            ctx.fillStyle = '#107c10';
            ctx.fillRect(plat.x, plat.y + plat.height - 2, plat.width, 2);
        }

        // Draw Enemies
        ctx.fillStyle = '#ff3333';
        for (const enemy of this.state.enemies) {
            ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            ctx.fillStyle = '#fff';
            ctx.fillRect(enemy.x + 4, enemy.y + 4, 3, 3);
            ctx.fillRect(enemy.x + 13, enemy.y + 4, 3, 3);
            ctx.fillStyle = '#ff3333';
        }

        // Draw Goal
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(this.state.goal.x, this.state.goal.y, this.state.goal.width, this.state.goal.height);

        // Draw Player
        const p = this.state.player;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.width, p.height);

        // Player eyes
        ctx.fillStyle = '#fff';
        const eyeX = p.vx >= 0 ? 12 : 2;
        ctx.fillRect(p.x + eyeX, p.y + 4, 4, 4);
        ctx.fillRect(p.x + eyeX + 3, p.y + 4, 4, 4);

        // Draw Level Text
        ctx.fillStyle = '#888';
        ctx.font = '12px Arial';
        ctx.fillText(`Level ${this.state.levelIndex + 1}`, 10, 20);
    }

    loop(timestamp) {
        if (!this.state || !this.state.active) return;

        if (!this.lastTime) this.lastTime = timestamp;
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.update(Math.min(dt, 0.1));
        this.draw();

        if (this.state && this.state.active) {
            this.animationId = requestAnimationFrame(this.loop);
        }
    }

    get isActive() {
        return this.state?.active ?? false;
    }

    // ============ MULTIPLAYER METHODS ============

    /**
     * Start a multiplayer game
     */
    startMultiplayer(gameData, isHost, localPlayer) {
        this.stop();

        this.isMultiplayer = true;
        this.isHost = isHost;
        this.sessionId = gameData.sessionId;
        this.localPlayerId = localPlayer?.id || this.socketManager?.socketId;

        console.log(`[XboxPlatformer] Starting multiplayer - Host: ${isHost}, SessionId: ${this.sessionId}, LocalPlayer: ${this.localPlayerId}`);

        // Use level 0 for multiplayer (first level is good for racing)
        const currentLevel = this.levelData[0];

        // Initialize multiplayer players from game data
        this.multiplayerPlayers.clear();
        for (const playerData of gameData.players) {
            // Spawn players at different x positions
            const spawnX = 20 + playerData.playerIndex * 60;
            const spawnY = this.GAME_HEIGHT - 60;

            this.multiplayerPlayers.set(playerData.id, {
                id: playerData.id,
                name: playerData.name,
                x: spawnX,
                y: spawnY,
                width: 20,
                height: 20,
                vx: 0,
                vy: 0,
                speed: 5,
                jumpPower: -12,
                grounded: false,
                color: playerData.color || this.PLAYER_COLORS[playerData.playerIndex % this.PLAYER_COLORS.length],
                playerIndex: playerData.playerIndex,
                score: 0,
                finishTime: null, // Time when player reached the goal
                isAlive: true,
                respawnTimer: 0,
                spawnX: spawnX,
                spawnY: spawnY
            });
        }

        // Get local player reference
        const localPlayerState = this.multiplayerPlayers.get(this.localPlayerId);

        this.state = {
            levelIndex: 0,
            player: localPlayerState, // Local player reference
            platforms: currentLevel.platforms,
            enemies: currentLevel.enemies.map(e => ({ ...e })),
            goal: currentLevel.goal,
            keys: {},
            gravity: 0.35,
            active: true,
            isMultiplayer: true,
            hostId: gameData.hostId,
            gameTime: 0, // Count up for race time
            raceFinished: false,
            finishOrder: [] // Array of player IDs in finish order
        };

        // Setup input handlers
        this.setupInputHandlers();

        // Setup socket listeners for multiplayer
        this.setupMultiplayerSocketListeners();

        this.lastTime = 0;
        this.loop = this.loop.bind(this);
        this.animationId = requestAnimationFrame(this.loop);

        console.log(`[XboxPlatformer] Multiplayer game started with ${this.multiplayerPlayers.size} players`);
    }

    /**
     * Setup input handlers (shared between single and multiplayer)
     */
    setupInputHandlers() {
        this.handleKeyDown = (e) => {
            if (!this.state) return;
            this.state.keys[e.code] = true;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
        };

        this.handleKeyUp = (e) => {
            if (!this.state) return;
            this.state.keys[e.code] = false;
        };

        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
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

        // Handle player leaving mid-game
        socket.on('minigame:playerLeft', (data) => {
            if (data.sessionId === this.sessionId) {
                console.log(`[XboxPlatformer] Player left: ${data.playerId}`);
                this.multiplayerPlayers.delete(data.playerId);
                this.remoteInputs.delete(data.playerId);
            }
        });
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
                vx: player.vx,
                vy: player.vy,
                grounded: player.grounded,
                score: player.score,
                finishTime: player.finishTime,
                isAlive: player.isAlive,
                respawnTimer: player.respawnTimer
            };
        }

        // Serialize enemies
        const enemiesState = this.state.enemies.map(e => ({
            x: e.x,
            vx: e.vx
        }));

        const stateData = {
            players: playersState,
            enemies: enemiesState,
            gameTime: this.state.gameTime,
            raceFinished: this.state.raceFinished,
            finishOrder: this.state.finishOrder,
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
            keys: { ...this.state.keys }
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

        // Update game time and race status
        this.state.gameTime = hostState.gameTime;
        this.state.raceFinished = hostState.raceFinished;
        this.state.finishOrder = hostState.finishOrder || [];

        // Update enemies
        if (hostState.enemies) {
            hostState.enemies.forEach((enemyState, index) => {
                if (this.state.enemies[index]) {
                    this.state.enemies[index].x = enemyState.x;
                    this.state.enemies[index].vx = enemyState.vx;
                }
            });
        }

        // Update all players from host state
        for (const [id, playerState] of Object.entries(hostState.players)) {
            const player = this.multiplayerPlayers.get(id);
            if (player) {
                // For local player, only update certain things (let local prediction handle movement)
                if (id === this.localPlayerId) {
                    // Reconcile important state from server
                    player.score = playerState.score;
                    player.finishTime = playerState.finishTime;
                    player.isAlive = playerState.isAlive;
                    player.respawnTimer = playerState.respawnTimer;
                    // Don't override position for local player - use prediction
                } else {
                    // For remote players, interpolate towards host state
                    player.x += (playerState.x - player.x) * 0.3;
                    player.y += (playerState.y - player.y) * 0.3;
                    player.vx = playerState.vx;
                    player.vy = playerState.vy;
                    player.grounded = playerState.grounded;
                    player.score = playerState.score;
                    player.finishTime = playerState.finishTime;
                    player.isAlive = playerState.isAlive;
                    player.respawnTimer = playerState.respawnTimer;
                }
            }
        }
    }

    /**
     * Handle multiplayer game events
     */
    handleMultiplayerEvent(event, payload, fromPlayerId) {
        console.log(`[XboxPlatformer] Event: ${event}`, payload);

        switch (event) {
            case 'playerDeath':
                // Show death effect
                break;
            case 'playerFinished':
                // Player reached the goal
                break;
            case 'levelEnd':
                // Race ended - show results (client receives this from host)
                if (!this.isHost) {
                    this.state.raceFinished = true;
                    this.state.winner = payload.winner;
                    this.showMultiplayerResults(payload);
                }
                break;
            case 'levelStart':
                // New level starting (client receives this from host)
                if (!this.isHost) {
                    this.startNextLevel(payload.levelIndex);
                }
                break;
            case 'gameEnd':
                this.state.active = false;
                this.showFinalResults();
                break;
        }
    }

    /**
     * Update multiplayer logic
     */
    updateMultiplayer(dt) {
        if (!this.state || !this.state.active) return;

        // Don't update game when showing results
        if (this.state.showingResults || this.state.raceFinished) return;

        // Update game timer (count up for race)
        this.state.gameTime += dt;

        if (this.isHost) {
            // Host: process all player inputs and physics
            this.updateHostLogic(dt);
            this.broadcastGameState();
        } else {
            // Client: predict local movement, send inputs
            this.updateLocalPlayerPrediction(dt);
            this.sendLocalInput();
        }

        // Update enemies (same on both host and client for visual smoothness)
        this.updateEnemies(dt);
    }

    /**
     * Host-only: Update all game logic
     */
    updateHostLogic(dt) {
        // Update local player with local input
        this.updatePlayerMovement(this.localPlayerId, this.state.keys, dt);

        // Update remote players with their inputs
        for (const [playerId, input] of this.remoteInputs) {
            if (playerId !== this.localPlayerId) {
                this.updatePlayerMovement(playerId, input.keys, dt);
            }
        }

        // Check if all players have finished or died
        const activePlayers = Array.from(this.multiplayerPlayers.values()).filter(p => p.isAlive && !p.finishTime);
        if (activePlayers.length === 0 && this.multiplayerPlayers.size > 0) {
            this.endMultiplayerGame();
        }
    }

    /**
     * Update a specific player's movement
     */
    updatePlayerMovement(playerId, keys, dt) {
        const player = this.multiplayerPlayers.get(playerId);
        if (!player || !player.isAlive || player.finishTime) return;

        const speedScale = dt * 60;

        // Horizontal movement
        if (keys['KeyA'] || keys['ArrowLeft']) player.vx = -player.speed * speedScale;
        else if (keys['KeyD'] || keys['ArrowRight']) player.vx = player.speed * speedScale;
        else player.vx *= Math.pow(0.8, speedScale);

        player.x += player.vx;

        // Bounds
        if (player.x < 0) player.x = 0;
        if (player.x + player.width > this.GAME_WIDTH) player.x = this.GAME_WIDTH - player.width;

        // Gravity & Vertical movement
        player.vy += this.state.gravity * speedScale;
        player.y += player.vy * speedScale;
        player.grounded = false;

        // Collision with platforms
        for (const plat of this.state.platforms) {
            if (player.x + player.width > plat.x && player.x < plat.x + plat.width &&
                player.y + player.height > plat.y && player.y + player.height < plat.y + player.vy * speedScale + 5) {
                player.y = plat.y - player.height;
                player.vy = 0;
                player.grounded = true;
            }
        }

        // Enemy collision
        for (const enemy of this.state.enemies) {
            if (player.x < enemy.x + enemy.width && player.x + player.width > enemy.x &&
                player.y < enemy.y + enemy.height && player.y + player.height > enemy.y) {
                // Player hit enemy - respawn
                this.respawnPlayer(playerId);
                return;
            }
        }

        // Goal collision
        const goal = this.state.goal;
        if (player.x < goal.x + goal.width && player.x + player.width > goal.x &&
            player.y < goal.y + goal.height && player.y + player.height > goal.y) {
            // Player reached the goal - first player wins and ends the race!
            if (!player.finishTime && !this.state.raceFinished) {
                player.finishTime = this.state.gameTime;
                player.score = 1000 - Math.floor(this.state.gameTime * 10); // Faster = more points
                this.state.finishOrder.push(playerId);
                this.state.winner = playerId;

                console.log(`[XboxPlatformer] Player ${player.name} WON! Time: ${player.finishTime.toFixed(2)}s`);

                // End the race immediately - first to goal wins
                if (this.isHost) {
                    this.endMultiplayerGame();
                }
            }
        }

        // Jump
        if (player.grounded && (keys['KeyW'] || keys['Space'] || keys['ArrowUp'])) {
            player.vy = player.jumpPower;
            player.grounded = false;
        }

        // Fall off screen
        if (player.y > this.GAME_HEIGHT) {
            this.respawnPlayer(playerId);
        }
    }

    /**
     * Update enemies movement
     */
    updateEnemies(dt) {
        const speedScale = dt * 60;
        for (const enemy of this.state.enemies) {
            enemy.x += enemy.vx * speedScale;
            if (enemy.x < enemy.range[0] || enemy.x + enemy.width > enemy.range[1]) {
                enemy.vx *= -1;
            }
        }
    }

    /**
     * Respawn a player at their spawn point
     */
    respawnPlayer(playerId) {
        const player = this.multiplayerPlayers.get(playerId);
        if (!player) return;

        player.x = player.spawnX;
        player.y = player.spawnY;
        player.vx = 0;
        player.vy = 0;
        player.grounded = false;

        console.log(`[XboxPlatformer] Player ${player.name} respawned`);
    }

    /**
     * Client-only: Predict local player movement
     */
    updateLocalPlayerPrediction(dt) {
        const player = this.multiplayerPlayers.get(this.localPlayerId);
        if (!player || !player.isAlive || player.finishTime) return;

        this.updatePlayerMovement(this.localPlayerId, this.state.keys, dt);
    }

    /**
     * End the multiplayer race (first to goal wins)
     */
    endMultiplayerGame() {
        if (this.state.raceFinished) return;
        this.state.raceFinished = true;

        // Get the winner (first player who finished)
        const winner = this.multiplayerPlayers.get(this.state.winner);

        const results = {
            winner: this.state.winner,
            winnerName: winner?.name || 'Unknown',
            winnerTime: winner?.finishTime,
            levelIndex: this.state.levelIndex,
            nextLevel: this.state.levelIndex + 1,
            hasMoreLevels: this.state.levelIndex + 1 < this.levelData.length
        };

        console.log(`[XboxPlatformer] Race ended! Winner: ${results.winnerName}, Level: ${results.levelIndex + 1}`);

        // Host broadcasts level end
        if (this.isHost) {
            this.socketManager?.socket?.emit('minigame:event', {
                sessionId: this.sessionId,
                event: 'levelEnd',
                payload: results
            });
        }

        // Show results screen
        this.showMultiplayerResults(results);
    }

    /**
     * Show multiplayer results screen, then advance to next level
     */
    showMultiplayerResults(results) {
        // Pause the game but keep drawing
        this.state.showingResults = true;
        this.resultsData = results;

        const winner = this.multiplayerPlayers.get(results.winner);
        const hasMoreLevels = results.hasMoreLevels;
        const nextLevelIndex = results.nextLevel;

        // Draw results overlay
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);

        ctx.fillStyle = '#107c10';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`LEVEL ${results.levelIndex + 1} COMPLETE!`, this.GAME_WIDTH / 2, 50);

        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = winner?.color || '#fff';
        ctx.fillText(`${winner?.name || 'Unknown'} WINS!`, this.GAME_WIDTH / 2, 95);

        ctx.font = '16px Arial';
        ctx.fillStyle = '#888';
        ctx.fillText(`Time: ${results.winnerTime?.toFixed(2) || '???'}s`, this.GAME_WIDTH / 2, 125);

        // Show next level or game over message
        ctx.font = '14px Arial';
        ctx.fillStyle = '#666';
        if (hasMoreLevels) {
            ctx.fillText(`Next level starting in 3 seconds...`, this.GAME_WIDTH / 2, 170);
        } else {
            ctx.fillText(`All levels complete!`, this.GAME_WIDTH / 2, 170);
        }

        // After 3 seconds, either advance to next level or end game
        setTimeout(() => {
            if (hasMoreLevels) {
                // Advance to next level
                this.startNextLevel(nextLevelIndex);
            } else {
                // All levels complete
                this.state.active = false;
                this.showFinalResults();
            }
        }, 3000);
    }

    /**
     * Start the next level in multiplayer mode
     */
    startNextLevel(levelIndex) {
        console.log(`[XboxPlatformer] Starting level ${levelIndex + 1}`);

        if (levelIndex >= this.levelData.length) {
            // No more levels
            this.state.active = false;
            this.showFinalResults();
            return;
        }

        const currentLevel = this.levelData[levelIndex];

        // Reset all players to their spawn positions
        let playerIndex = 0;
        for (const [id, player] of this.multiplayerPlayers) {
            const spawnX = 20 + playerIndex * 60;
            const spawnY = this.GAME_HEIGHT - 60;
            player.x = spawnX;
            player.y = spawnY;
            player.vx = 0;
            player.vy = 0;
            player.grounded = false;
            player.finishTime = null;
            player.spawnX = spawnX;
            player.spawnY = spawnY;
            playerIndex++;
        }

        // Update state for new level
        this.state.levelIndex = levelIndex;
        this.state.platforms = currentLevel.platforms;
        this.state.enemies = currentLevel.enemies.map(e => ({ ...e }));
        this.state.goal = currentLevel.goal;
        this.state.gameTime = 0;
        this.state.raceFinished = false;
        this.state.showingResults = false;
        this.state.finishOrder = [];
        this.state.winner = null;
        this.resultsData = null;

        // Clear remote inputs
        this.remoteInputs.clear();

        // Broadcast new level start to all clients
        if (this.isHost) {
            this.socketManager?.socket?.emit('minigame:event', {
                sessionId: this.sessionId,
                event: 'levelStart',
                payload: {
                    levelIndex,
                    platforms: currentLevel.platforms,
                    enemies: currentLevel.enemies,
                    goal: currentLevel.goal
                }
            });
        }

        console.log(`[XboxPlatformer] Level ${levelIndex + 1} started!`);
    }

    /**
     * Show final results after all levels complete
     */
    showFinalResults() {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);

        ctx.fillStyle = '#107c10';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('ALL LEVELS COMPLETE!', this.GAME_WIDTH / 2, 60);

        // Show total scores
        const sortedPlayers = Array.from(this.multiplayerPlayers.values())
            .sort((a, b) => b.score - a.score);

        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText('Final Scores:', this.GAME_WIDTH / 2, 100);

        ctx.font = '16px Arial';
        sortedPlayers.forEach((player, index) => {
            const y = 135 + index * 30;
            const medal = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            ctx.fillStyle = player.color;
            ctx.fillText(`${medal} ${player.name}: ${player.score} pts`, this.GAME_WIDTH / 2, y);
        });

        // Return to menu after delay
        setTimeout(() => {
            this.callbacks.onAllLevelsComplete?.();
        }, 4000);
    }

    /**
     * Draw multiplayer game
     */
    drawMultiplayer() {
        if (!this.state) return;

        const ctx = this.ctx;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);

        // Draw Platforms
        for (const plat of this.state.platforms) {
            ctx.fillStyle = '#333';
            ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
            ctx.fillStyle = '#107c10';
            ctx.fillRect(plat.x, plat.y + plat.height - 2, plat.width, 2);
        }

        // Draw Enemies
        ctx.fillStyle = '#ff3333';
        for (const enemy of this.state.enemies) {
            ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            ctx.fillStyle = '#fff';
            ctx.fillRect(enemy.x + 4, enemy.y + 4, 3, 3);
            ctx.fillRect(enemy.x + 13, enemy.y + 4, 3, 3);
            ctx.fillStyle = '#ff3333';
        }

        // Draw Goal
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(this.state.goal.x, this.state.goal.y, this.state.goal.width, this.state.goal.height);
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GOAL', this.state.goal.x + this.state.goal.width / 2, this.state.goal.y + 14);

        // Draw all players
        for (const [playerId, player] of this.multiplayerPlayers) {
            if (player.finishTime) {
                // Draw faded if already finished
                ctx.globalAlpha = 0.4;
            }

            const isLocal = playerId === this.localPlayerId;

            // Draw player body
            ctx.fillStyle = player.color;
            ctx.fillRect(player.x, player.y, player.width, player.height);

            // Player eyes
            ctx.fillStyle = '#fff';
            const eyeX = player.vx >= 0 ? 12 : 2;
            ctx.fillRect(player.x + eyeX, player.y + 4, 4, 4);
            ctx.fillRect(player.x + eyeX + 3, player.y + 4, 4, 4);

            // Draw player name above
            ctx.fillStyle = player.color;
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(player.name + (isLocal ? ' (You)' : ''), player.x + player.width / 2, player.y - 5);

            ctx.globalAlpha = 1;
        }

        // Draw UI
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.GAME_WIDTH, 25);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('PLATFORMER RACE', 10, 17);

        // Timer
        ctx.textAlign = 'center';
        ctx.fillText(`Time: ${this.state.gameTime.toFixed(1)}s`, this.GAME_WIDTH / 2, 17);

        // Finish count
        const finishedCount = Array.from(this.multiplayerPlayers.values()).filter(p => p.finishTime).length;
        ctx.textAlign = 'right';
        ctx.fillText(`Finished: ${finishedCount}/${this.multiplayerPlayers.size}`, this.GAME_WIDTH - 10, 17);

        // Draw leaderboard on the right
        const sortedPlayers = Array.from(this.multiplayerPlayers.values())
            .sort((a, b) => {
                if (a.finishTime && !b.finishTime) return -1;
                if (!a.finishTime && b.finishTime) return 1;
                if (a.finishTime && b.finishTime) return a.finishTime - b.finishTime;
                return b.x - a.x; // Furthest right = closest to goal (for this level layout)
            });

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(this.GAME_WIDTH - 120, 30, 115, sortedPlayers.length * 18 + 10);

        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        sortedPlayers.forEach((player, index) => {
            const y = 45 + index * 18;
            ctx.fillStyle = player.color;
            const status = player.finishTime ? `${player.finishTime.toFixed(1)}s` : 'Racing';
            const indicator = player.id === this.localPlayerId ? '► ' : '';
            ctx.fillText(`${indicator}${player.name}: ${status}`, this.GAME_WIDTH - 10, y);
        });
    }

    /**
     * Become the host (host migration)
     */
    becomeHost(gameState) {
        console.log('[XboxPlatformer] Becoming host due to host migration');
        this.isHost = true;
        this.state.hostId = this.localPlayerId;

        // Apply the last known game state
        if (gameState) {
            this.applyHostState(gameState);
        }
    }
}
