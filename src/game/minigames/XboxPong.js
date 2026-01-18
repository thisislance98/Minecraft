/**
 * XboxPong - Classic Pong arcade game
 * Controls: W/S for left paddle, Arrow Up/Down for right paddle (or AI vs player)
 * Features: Multiple difficulty levels, AI opponent, score tracking
 * Now supports multiplayer PvP via socket.io
 */
export class XboxPong {
    constructor(canvas, callbacks, socketManager = null, isMultiplayer = false) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.callbacks = callbacks;
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
        this.multiplayerPlayers = new Map(); // Player data by ID
        this.remoteInputs = new Map(); // Inputs from remote players (host only)
        this.lastStateBroadcast = 0;
        this.STATE_BROADCAST_INTERVAL = 33; // 30Hz for smoother Pong
        this.lastInputSend = 0;
        this.INPUT_SEND_INTERVAL = 16; // ~60Hz

        // Player colors for multiplayer
        this.PLAYER_COLORS = ['#107c10', '#3366cc'];

        this.levelData = this.createLevels();
    }

    createLevels() {
        return [
            {
                name: "Rookie",
                aiSpeed: 1.8,
                ballSpeed: 3,
                paddleSpeed: 5,
                winScore: 5
            },
            {
                name: "Amateur",
                aiSpeed: 2.5,
                ballSpeed: 3.5,
                paddleSpeed: 5,
                winScore: 5
            },
            {
                name: "Pro",
                aiSpeed: 3.2,
                ballSpeed: 4,
                paddleSpeed: 5.5,
                winScore: 7
            },
            {
                name: "Legend",
                aiSpeed: 4,
                ballSpeed: 5,
                paddleSpeed: 6,
                winScore: 7
            },
            {
                name: "Impossible",
                aiSpeed: 5,
                ballSpeed: 6,
                paddleSpeed: 6,
                winScore: 9
            }
        ];
    }

    start(levelIndex = 0) {
        this.stop();

        const level = this.levelData[levelIndex % this.levelData.length];
        const actualLevel = levelIndex % this.levelData.length;

        const paddleHeight = 60;
        const paddleWidth = 12;
        const paddleMargin = 20;

        this.state = {
            levelIndex: actualLevel,
            levelName: level.name,
            aiSpeed: level.aiSpeed,
            ballSpeed: level.ballSpeed,
            paddleSpeed: level.paddleSpeed,
            winScore: level.winScore,

            // Paddles
            leftPaddle: {
                x: paddleMargin,
                y: this.GAME_HEIGHT / 2 - paddleHeight / 2,
                width: paddleWidth,
                height: paddleHeight,
                score: 0
            },
            rightPaddle: {
                x: this.GAME_WIDTH - paddleMargin - paddleWidth,
                y: this.GAME_HEIGHT / 2 - paddleHeight / 2,
                width: paddleWidth,
                height: paddleHeight,
                score: 0,
                isAI: true
            },

            // Ball
            ball: {
                x: this.GAME_WIDTH / 2,
                y: this.GAME_HEIGHT / 2,
                radius: 8,
                vx: level.ballSpeed * (Math.random() > 0.5 ? 1 : -1),
                vy: (Math.random() - 0.5) * level.ballSpeed
            },

            keys: {},
            active: true,
            paused: false,
            showLevelBanner: false,
            hitFlash: 0,
            lastScore: null, // Track who scored last
            serveDelay: 0,   // Delay before ball moves after score
            rallyCount: 0    // Track rally length for bonus effects
        };

        this.handleKeyDown = (e) => {
            if (!this.state) return;
            this.state.keys[e.code] = true;

            if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'Space'].includes(e.code)) {
                e.preventDefault();
            }

            // Pause with P
            if (e.code === 'KeyP') {
                this.state.paused = !this.state.paused;
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

    resetBall(scoredBy) {
        const ball = this.state.ball;
        ball.x = this.GAME_WIDTH / 2;
        ball.y = this.GAME_HEIGHT / 2;

        // Ball goes towards whoever just got scored on
        const direction = scoredBy === 'left' ? 1 : -1;
        ball.vx = this.state.ballSpeed * direction;
        ball.vy = (Math.random() - 0.5) * this.state.ballSpeed * 0.5;

        this.state.serveDelay = 60; // 1 second delay at 60fps
        this.state.rallyCount = 0;
    }

    updateAI(paddle, dt) {
        const ball = this.state.ball;
        const targetY = ball.y - paddle.height / 2;

        // Add some prediction based on ball velocity
        const predictedY = ball.y + ball.vy * 10;
        const adjustedTarget = predictedY - paddle.height / 2;

        // AI has reaction delay and imperfection
        const diff = adjustedTarget - paddle.y;
        const aiSpeedScale = dt * 60;

        // Add some randomness to make AI beatable
        const reactionThreshold = 5;

        if (Math.abs(diff) > reactionThreshold) {
            if (diff > 0) {
                paddle.y += Math.min(diff, this.state.aiSpeed * aiSpeedScale);
            } else {
                paddle.y += Math.max(diff, -this.state.aiSpeed * aiSpeedScale);
            }
        }

        // Keep paddle in bounds
        if (paddle.y < 0) paddle.y = 0;
        if (paddle.y + paddle.height > this.GAME_HEIGHT) {
            paddle.y = this.GAME_HEIGHT - paddle.height;
        }
    }

    update(dt) {
        if (!this.state || !this.state.active || this.state.paused) return;

        // Handle multiplayer update separately
        if (this.isMultiplayer) {
            this.updateMultiplayer(dt);
            return;
        }

        const keys = this.state.keys;
        const leftPaddle = this.state.leftPaddle;
        const rightPaddle = this.state.rightPaddle;
        const ball = this.state.ball;
        const speedScale = dt * 60;

        // Update hit flash
        if (this.state.hitFlash > 0) this.state.hitFlash--;

        // Serve delay countdown
        if (this.state.serveDelay > 0) {
            this.state.serveDelay--;
            return; // Don't update ball during serve delay
        }

        // Left paddle controls (W/S)
        if (keys['KeyW']) {
            leftPaddle.y -= this.state.paddleSpeed * speedScale;
        }
        if (keys['KeyS']) {
            leftPaddle.y += this.state.paddleSpeed * speedScale;
        }

        // Keep left paddle in bounds
        if (leftPaddle.y < 0) leftPaddle.y = 0;
        if (leftPaddle.y + leftPaddle.height > this.GAME_HEIGHT) {
            leftPaddle.y = this.GAME_HEIGHT - leftPaddle.height;
        }

        // Right paddle - AI or player controlled
        if (rightPaddle.isAI) {
            this.updateAI(rightPaddle, dt);
        } else {
            // Arrow keys for player 2
            if (keys['ArrowUp']) {
                rightPaddle.y -= this.state.paddleSpeed * speedScale;
            }
            if (keys['ArrowDown']) {
                rightPaddle.y += this.state.paddleSpeed * speedScale;
            }
            if (rightPaddle.y < 0) rightPaddle.y = 0;
            if (rightPaddle.y + rightPaddle.height > this.GAME_HEIGHT) {
                rightPaddle.y = this.GAME_HEIGHT - rightPaddle.height;
            }
        }

        // Update ball position
        ball.x += ball.vx * speedScale;
        ball.y += ball.vy * speedScale;

        // Ball collision with top/bottom walls
        if (ball.y - ball.radius < 0) {
            ball.y = ball.radius;
            ball.vy *= -1;
        }
        if (ball.y + ball.radius > this.GAME_HEIGHT) {
            ball.y = this.GAME_HEIGHT - ball.radius;
            ball.vy *= -1;
        }

        // Ball collision with left paddle
        if (ball.x - ball.radius < leftPaddle.x + leftPaddle.width &&
            ball.x + ball.radius > leftPaddle.x &&
            ball.y > leftPaddle.y &&
            ball.y < leftPaddle.y + leftPaddle.height &&
            ball.vx < 0) {

            // Calculate hit position on paddle (-1 to 1)
            const hitPos = (ball.y - (leftPaddle.y + leftPaddle.height / 2)) / (leftPaddle.height / 2);

            // Apply stronger angle at edges: use exponential curve for more dramatic edge angles
            // hitPos near 0 (center) = small angle, hitPos near ±1 (edges) = big angle
            const angleMultiplier = 0.5 + Math.abs(hitPos) * 1.2; // 0.5 at center, 1.7 at edges

            ball.vx = Math.abs(ball.vx) * 1.03; // Speed up slightly (reduced from 1.05)
            ball.vy = hitPos * this.state.ballSpeed * angleMultiplier;
            ball.x = leftPaddle.x + leftPaddle.width + ball.radius;

            this.state.hitFlash = 5;
            this.state.rallyCount++;

            // Cap ball speed
            const maxSpeed = this.state.ballSpeed * 1.8;
            if (Math.abs(ball.vx) > maxSpeed) ball.vx = maxSpeed * Math.sign(ball.vx);
        }

        // Ball collision with right paddle
        if (ball.x + ball.radius > rightPaddle.x &&
            ball.x - ball.radius < rightPaddle.x + rightPaddle.width &&
            ball.y > rightPaddle.y &&
            ball.y < rightPaddle.y + rightPaddle.height &&
            ball.vx > 0) {

            const hitPos = (ball.y - (rightPaddle.y + rightPaddle.height / 2)) / (rightPaddle.height / 2);

            // Apply stronger angle at edges
            const angleMultiplier = 0.5 + Math.abs(hitPos) * 1.2;

            ball.vx = -Math.abs(ball.vx) * 1.03;
            ball.vy = hitPos * this.state.ballSpeed * angleMultiplier;
            ball.x = rightPaddle.x - ball.radius;

            this.state.hitFlash = 5;
            this.state.rallyCount++;

            const maxSpeed = this.state.ballSpeed * 1.8;
            if (Math.abs(ball.vx) > maxSpeed) ball.vx = maxSpeed * Math.sign(ball.vx);
        }

        // Scoring - ball goes past paddles
        if (ball.x < 0) {
            // Right player scores
            rightPaddle.score++;
            this.state.lastScore = 'right';
            this.resetBall('right');
            this.checkWinCondition();
        }
        if (ball.x > this.GAME_WIDTH) {
            // Left player scores
            leftPaddle.score++;
            this.state.lastScore = 'left';
            this.resetBall('left');
            this.checkWinCondition();
        }
    }

    checkWinCondition() {
        const leftScore = this.state.leftPaddle.score;
        const rightScore = this.state.rightPaddle.score;
        const winScore = this.state.winScore;

        if (leftScore >= winScore) {
            // Player wins!
            this.state.active = false;
            const nextLevel = this.state.levelIndex + 1;
            if (nextLevel < this.levelData.length) {
                this.callbacks.onLevelComplete?.(nextLevel);
            } else {
                this.callbacks.onAllLevelsComplete?.();
            }
        } else if (rightScore >= winScore) {
            // AI wins - game over
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
        const leftPaddle = this.state.leftPaddle;
        const rightPaddle = this.state.rightPaddle;
        const ball = this.state.ball;

        // Background - classic black
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);

        // Center line (dashed)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;
        ctx.setLineDash([15, 15]);
        ctx.beginPath();
        ctx.moveTo(this.GAME_WIDTH / 2, 0);
        ctx.lineTo(this.GAME_WIDTH / 2, this.GAME_HEIGHT);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw paddles
        ctx.fillStyle = '#107c10'; // Xbox green for player
        ctx.fillRect(leftPaddle.x, leftPaddle.y, leftPaddle.width, leftPaddle.height);

        // Paddle glow effect
        ctx.shadowColor = '#107c10';
        ctx.shadowBlur = 10;
        ctx.fillRect(leftPaddle.x, leftPaddle.y, leftPaddle.width, leftPaddle.height);
        ctx.shadowBlur = 0;

        ctx.fillStyle = rightPaddle.isAI ? '#cc3333' : '#107c10'; // Red for AI
        ctx.fillRect(rightPaddle.x, rightPaddle.y, rightPaddle.width, rightPaddle.height);

        ctx.shadowColor = rightPaddle.isAI ? '#cc3333' : '#107c10';
        ctx.shadowBlur = 10;
        ctx.fillRect(rightPaddle.x, rightPaddle.y, rightPaddle.width, rightPaddle.height);
        ctx.shadowBlur = 0;

        // Draw ball
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw ball trail effect
        const trailAlpha = 0.3;
        for (let i = 1; i <= 3; i++) {
            ctx.fillStyle = `rgba(255, 255, 255, ${trailAlpha / i})`;
            ctx.beginPath();
            ctx.arc(ball.x - ball.vx * i * 2, ball.y - ball.vy * i * 2, ball.radius * (1 - i * 0.2), 0, Math.PI * 2);
            ctx.fill();
        }

        // Score display
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(leftPaddle.score.toString(), this.GAME_WIDTH / 4, 60);
        ctx.fillText(rightPaddle.score.toString(), (this.GAME_WIDTH * 3) / 4, 60);

        // Level info
        ctx.font = '14px Arial';
        ctx.fillStyle = '#888';
        ctx.textAlign = 'center';
        ctx.fillText(`Level ${this.state.levelIndex + 1}: ${this.state.levelName}`, this.GAME_WIDTH / 2, 25);

        // Win score indicator
        ctx.font = '12px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText(`First to ${this.state.winScore}`, this.GAME_WIDTH / 2, this.GAME_HEIGHT - 10);

        // Rally counter (if rally is getting long)
        if (this.state.rallyCount >= 5) {
            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = '#ffcc00';
            ctx.fillText(`Rally: ${this.state.rallyCount}`, this.GAME_WIDTH / 2, this.GAME_HEIGHT - 30);
        }

        // Hit flash effect
        if (this.state.hitFlash > 0) {
            ctx.fillStyle = `rgba(16, 124, 16, ${this.state.hitFlash / 10})`;
            ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
        }

        // Serve delay indicator
        if (this.state.serveDelay > 0) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(this.GAME_WIDTH / 2 - 50, this.GAME_HEIGHT / 2 - 20, 100, 40);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('READY', this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 + 7);
        }

        // Pause screen
        if (this.state.paused) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('PAUSED', this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2);
            ctx.font = '16px Arial';
            ctx.fillText('Press P to resume', this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 + 30);
        }

        // Level banner
        if (this.state.showLevelBanner) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.fillRect(0, this.GAME_HEIGHT / 2 - 60, this.GAME_WIDTH, 120);

            ctx.fillStyle = '#107c10';
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('PONG', this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 - 20);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(`Level ${this.state.levelIndex + 1}: ${this.state.levelName}`, this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 + 10);

            ctx.fillStyle = '#888';
            ctx.font = '14px Arial';
            ctx.fillText('W/S to move paddle | First to ' + this.state.winScore + ' wins', this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 + 40);
        }
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

    // ==================== MULTIPLAYER METHODS ====================

    /**
     * Start a multiplayer game
     */
    startMultiplayer(gameData, isHost, localPlayer) {
        this.stop();

        this.isMultiplayer = true;
        this.isHost = isHost;
        this.sessionId = gameData.sessionId;
        this.localPlayerId = localPlayer?.id || this.socketManager?.socketId;

        console.log(`[XboxPong] Starting multiplayer - Host: ${isHost}, SessionId: ${this.sessionId}, LocalPlayer: ${this.localPlayerId}`);

        const paddleHeight = 60;
        const paddleWidth = 12;
        const paddleMargin = 20;

        // Initialize multiplayer players from game data
        this.multiplayerPlayers.clear();
        for (const playerData of gameData.players) {
            const isLeftPaddle = playerData.playerIndex === 0;
            const paddleX = isLeftPaddle ? paddleMargin : this.GAME_WIDTH - paddleMargin - paddleWidth;

            this.multiplayerPlayers.set(playerData.id, {
                id: playerData.id,
                name: playerData.name,
                paddleIndex: playerData.playerIndex, // 0 = left, 1 = right
                paddleX: paddleX,
                paddleY: this.GAME_HEIGHT / 2 - paddleHeight / 2,
                paddleWidth: paddleWidth,
                paddleHeight: paddleHeight,
                score: 0,
                color: playerData.color,
                playerIndex: playerData.playerIndex
            });
        }

        // Get local player's paddle index
        const localPlayerData = this.multiplayerPlayers.get(this.localPlayerId);
        const isLeftPlayer = localPlayerData?.paddleIndex === 0;

        this.state = {
            levelIndex: 0,
            levelName: 'Multiplayer',
            ballSpeed: 4,
            paddleSpeed: 5,
            winScore: 7,

            // Paddles - reference multiplayer players
            leftPaddle: {
                x: paddleMargin,
                y: this.GAME_HEIGHT / 2 - paddleHeight / 2,
                width: paddleWidth,
                height: paddleHeight,
                score: 0,
                isAI: false,
                playerId: gameData.players[0]?.id
            },
            rightPaddle: {
                x: this.GAME_WIDTH - paddleMargin - paddleWidth,
                y: this.GAME_HEIGHT / 2 - paddleHeight / 2,
                width: paddleWidth,
                height: paddleHeight,
                score: 0,
                isAI: false,
                playerId: gameData.players[1]?.id
            },

            // Ball
            ball: {
                x: this.GAME_WIDTH / 2,
                y: this.GAME_HEIGHT / 2,
                radius: 8,
                vx: 4 * (Math.random() > 0.5 ? 1 : -1),
                vy: (Math.random() - 0.5) * 4
            },

            keys: {},
            active: true,
            paused: false,
            showLevelBanner: false,
            hitFlash: 0,
            lastScore: null,
            serveDelay: 60,
            rallyCount: 0,
            isMultiplayer: true,
            hostId: gameData.hostId,
            localPaddleIndex: localPlayerData?.paddleIndex ?? 0,
            gameTime: 180 // 3 minute matches
        };

        // Setup input handlers
        this.setupMultiplayerInputHandlers();

        // Setup socket listeners for multiplayer
        this.setupMultiplayerSocketListeners();

        this.lastTime = 0;
        this.loop = this.loop.bind(this);
        this.animationId = requestAnimationFrame(this.loop);

        console.log(`[XboxPong] Multiplayer game started - Local player controls ${isLeftPlayer ? 'LEFT' : 'RIGHT'} paddle`);
    }

    /**
     * Setup input handlers for multiplayer
     */
    setupMultiplayerInputHandlers() {
        this.handleKeyDown = (e) => {
            if (!this.state) return;
            this.state.keys[e.code] = true;

            if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) {
                e.preventDefault();
            }

            // Pause with P
            if (e.code === 'KeyP' && this.isHost) {
                this.state.paused = !this.state.paused;
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
                console.log(`[XboxPong] Player left: ${data.playerId}`);
                this.multiplayerPlayers.delete(data.playerId);
                this.remoteInputs.delete(data.playerId);
                // End the game if a player leaves
                this.endMultiplayerGame('Player disconnected');
            }
        });
    }

    /**
     * Update method that handles multiplayer logic
     */
    updateMultiplayer(dt) {
        if (!this.state || !this.state.active || this.state.paused) return;

        // Update hit flash
        if (this.state.hitFlash > 0) this.state.hitFlash--;

        // Serve delay countdown
        if (this.state.serveDelay > 0) {
            this.state.serveDelay--;
            if (this.isHost) {
                this.broadcastGameState();
            }
            return;
        }

        if (this.isHost) {
            // Host: process all player inputs and physics
            this.updateHostLogic(dt);
            this.broadcastGameState();
        } else {
            // Client: predict local movement, send inputs
            this.updateLocalPaddlePrediction(dt);
            this.sendLocalInput();
        }
    }

    /**
     * Host-only: Update all game logic
     */
    updateHostLogic(dt) {
        const keys = this.state.keys;
        const leftPaddle = this.state.leftPaddle;
        const rightPaddle = this.state.rightPaddle;
        const ball = this.state.ball;
        const speedScale = dt * 60;

        // Update local player's paddle
        const localPaddleIndex = this.state.localPaddleIndex;
        const localPaddle = localPaddleIndex === 0 ? leftPaddle : rightPaddle;

        if (keys['KeyW'] || keys['ArrowUp']) {
            localPaddle.y -= this.state.paddleSpeed * speedScale;
        }
        if (keys['KeyS'] || keys['ArrowDown']) {
            localPaddle.y += this.state.paddleSpeed * speedScale;
        }

        // Clamp local paddle
        if (localPaddle.y < 0) localPaddle.y = 0;
        if (localPaddle.y + localPaddle.height > this.GAME_HEIGHT) {
            localPaddle.y = this.GAME_HEIGHT - localPaddle.height;
        }

        // Update remote player's paddle from their inputs
        for (const [playerId, input] of this.remoteInputs) {
            const playerData = this.multiplayerPlayers.get(playerId);
            if (!playerData || playerId === this.localPlayerId) continue;

            const remotePaddle = playerData.paddleIndex === 0 ? leftPaddle : rightPaddle;

            if (input.keys['KeyW'] || input.keys['ArrowUp']) {
                remotePaddle.y -= this.state.paddleSpeed * speedScale;
            }
            if (input.keys['KeyS'] || input.keys['ArrowDown']) {
                remotePaddle.y += this.state.paddleSpeed * speedScale;
            }

            // Clamp remote paddle
            if (remotePaddle.y < 0) remotePaddle.y = 0;
            if (remotePaddle.y + remotePaddle.height > this.GAME_HEIGHT) {
                remotePaddle.y = this.GAME_HEIGHT - remotePaddle.height;
            }
        }

        // Update ball position
        ball.x += ball.vx * speedScale;
        ball.y += ball.vy * speedScale;

        // Ball collision with top/bottom walls
        if (ball.y - ball.radius < 0) {
            ball.y = ball.radius;
            ball.vy *= -1;
        }
        if (ball.y + ball.radius > this.GAME_HEIGHT) {
            ball.y = this.GAME_HEIGHT - ball.radius;
            ball.vy *= -1;
        }

        // Ball collision with left paddle
        if (ball.x - ball.radius < leftPaddle.x + leftPaddle.width &&
            ball.x + ball.radius > leftPaddle.x &&
            ball.y > leftPaddle.y &&
            ball.y < leftPaddle.y + leftPaddle.height &&
            ball.vx < 0) {

            const hitPos = (ball.y - (leftPaddle.y + leftPaddle.height / 2)) / (leftPaddle.height / 2);
            const angleMultiplier = 0.5 + Math.abs(hitPos) * 1.2;

            ball.vx = Math.abs(ball.vx) * 1.03;
            ball.vy = hitPos * this.state.ballSpeed * angleMultiplier;
            ball.x = leftPaddle.x + leftPaddle.width + ball.radius;

            this.state.hitFlash = 5;
            this.state.rallyCount++;

            const maxSpeed = this.state.ballSpeed * 1.8;
            if (Math.abs(ball.vx) > maxSpeed) ball.vx = maxSpeed * Math.sign(ball.vx);
        }

        // Ball collision with right paddle
        if (ball.x + ball.radius > rightPaddle.x &&
            ball.x - ball.radius < rightPaddle.x + rightPaddle.width &&
            ball.y > rightPaddle.y &&
            ball.y < rightPaddle.y + rightPaddle.height &&
            ball.vx > 0) {

            const hitPos = (ball.y - (rightPaddle.y + rightPaddle.height / 2)) / (rightPaddle.height / 2);
            const angleMultiplier = 0.5 + Math.abs(hitPos) * 1.2;

            ball.vx = -Math.abs(ball.vx) * 1.03;
            ball.vy = hitPos * this.state.ballSpeed * angleMultiplier;
            ball.x = rightPaddle.x - ball.radius;

            this.state.hitFlash = 5;
            this.state.rallyCount++;

            const maxSpeed = this.state.ballSpeed * 1.8;
            if (Math.abs(ball.vx) > maxSpeed) ball.vx = maxSpeed * Math.sign(ball.vx);
        }

        // Scoring - ball goes past paddles
        if (ball.x < 0) {
            // Right player scores
            rightPaddle.score++;
            this.state.lastScore = 'right';
            this.resetBallMultiplayer('right');
            this.checkMultiplayerWinCondition();
        }
        if (ball.x > this.GAME_WIDTH) {
            // Left player scores
            leftPaddle.score++;
            this.state.lastScore = 'left';
            this.resetBallMultiplayer('left');
            this.checkMultiplayerWinCondition();
        }
    }

    /**
     * Client-only: Predict local paddle movement
     */
    updateLocalPaddlePrediction(dt) {
        const keys = this.state.keys;
        const speedScale = dt * 60;
        const localPaddleIndex = this.state.localPaddleIndex;
        const localPaddle = localPaddleIndex === 0 ? this.state.leftPaddle : this.state.rightPaddle;

        if (keys['KeyW'] || keys['ArrowUp']) {
            localPaddle.y -= this.state.paddleSpeed * speedScale;
        }
        if (keys['KeyS'] || keys['ArrowDown']) {
            localPaddle.y += this.state.paddleSpeed * speedScale;
        }

        // Clamp paddle
        if (localPaddle.y < 0) localPaddle.y = 0;
        if (localPaddle.y + localPaddle.height > this.GAME_HEIGHT) {
            localPaddle.y = this.GAME_HEIGHT - localPaddle.height;
        }
    }

    /**
     * Reset ball for multiplayer
     */
    resetBallMultiplayer(scoredBy) {
        const ball = this.state.ball;
        ball.x = this.GAME_WIDTH / 2;
        ball.y = this.GAME_HEIGHT / 2;

        const direction = scoredBy === 'left' ? 1 : -1;
        ball.vx = this.state.ballSpeed * direction;
        ball.vy = (Math.random() - 0.5) * this.state.ballSpeed * 0.5;

        this.state.serveDelay = 60;
        this.state.rallyCount = 0;
    }

    /**
     * Check win condition for multiplayer
     */
    checkMultiplayerWinCondition() {
        const leftScore = this.state.leftPaddle.score;
        const rightScore = this.state.rightPaddle.score;
        const winScore = this.state.winScore;

        if (leftScore >= winScore || rightScore >= winScore) {
            const winner = leftScore >= winScore ? 'left' : 'right';
            this.endMultiplayerGame(winner);
        }
    }

    /**
     * Broadcast game state to all clients (host only)
     */
    broadcastGameState() {
        if (!this.isHost || !this.socketManager?.socket) return;

        const now = Date.now();
        if (now - this.lastStateBroadcast < this.STATE_BROADCAST_INTERVAL) return;
        this.lastStateBroadcast = now;

        const stateData = {
            leftPaddle: {
                y: this.state.leftPaddle.y,
                score: this.state.leftPaddle.score
            },
            rightPaddle: {
                y: this.state.rightPaddle.y,
                score: this.state.rightPaddle.score
            },
            ball: {
                x: this.state.ball.x,
                y: this.state.ball.y,
                vx: this.state.ball.vx,
                vy: this.state.ball.vy
            },
            serveDelay: this.state.serveDelay,
            rallyCount: this.state.rallyCount,
            hitFlash: this.state.hitFlash,
            paused: this.state.paused,
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
        if (!hostState) return;

        // Update paddles (interpolate for smooth movement)
        const localPaddleIndex = this.state.localPaddleIndex;

        // For remote paddle, fully apply host state
        // For local paddle, only reconcile if significantly different
        if (localPaddleIndex === 0) {
            // We control left, host controls right
            this.state.rightPaddle.y += (hostState.rightPaddle.y - this.state.rightPaddle.y) * 0.5;
            this.state.rightPaddle.score = hostState.rightPaddle.score;
            this.state.leftPaddle.score = hostState.leftPaddle.score;
        } else {
            // We control right, host controls left
            this.state.leftPaddle.y += (hostState.leftPaddle.y - this.state.leftPaddle.y) * 0.5;
            this.state.leftPaddle.score = hostState.leftPaddle.score;
            this.state.rightPaddle.score = hostState.rightPaddle.score;
        }

        // Update ball (always authoritative from host)
        this.state.ball.x = hostState.ball.x;
        this.state.ball.y = hostState.ball.y;
        this.state.ball.vx = hostState.ball.vx;
        this.state.ball.vy = hostState.ball.vy;

        // Update game state
        this.state.serveDelay = hostState.serveDelay;
        this.state.rallyCount = hostState.rallyCount;
        this.state.hitFlash = hostState.hitFlash;
        this.state.paused = hostState.paused;
    }

    /**
     * Handle multiplayer game events
     */
    handleMultiplayerEvent(event, payload, fromPlayerId) {
        console.log(`[XboxPong] Event: ${event}`, payload);

        switch (event) {
            case 'hit':
                this.state.hitFlash = 5;
                break;
            case 'gameEnd':
                this.state.active = false;
                this.showMultiplayerResults(payload);
                break;
        }
    }

    /**
     * End the multiplayer game
     */
    endMultiplayerGame(winner) {
        this.state.active = false;

        // Determine winner player
        const leftPlayer = Array.from(this.multiplayerPlayers.values()).find(p => p.paddleIndex === 0);
        const rightPlayer = Array.from(this.multiplayerPlayers.values()).find(p => p.paddleIndex === 1);

        let winnerPlayer;
        if (winner === 'left') {
            winnerPlayer = leftPlayer;
        } else if (winner === 'right') {
            winnerPlayer = rightPlayer;
        } else {
            winnerPlayer = null; // Disconnection or error
        }

        const results = {
            winner: winner,
            winnerName: winnerPlayer?.name || 'Unknown',
            leftScore: this.state.leftPaddle.score,
            rightScore: this.state.rightPaddle.score,
            leftPlayer: leftPlayer?.name,
            rightPlayer: rightPlayer?.name
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
     * Show multiplayer results screen
     */
    showMultiplayerResults(results) {
        const ctx = this.ctx;

        // Draw results overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);

        ctx.fillStyle = '#107c10';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', this.GAME_WIDTH / 2, 80);

        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText(`Winner: ${results.winnerName}`, this.GAME_WIDTH / 2, 130);

        // Draw final scores
        ctx.font = '48px Arial';
        ctx.fillStyle = '#107c10';
        ctx.fillText(results.leftScore, this.GAME_WIDTH / 4, 200);
        ctx.fillStyle = '#3366cc';
        ctx.fillText(results.rightScore, (this.GAME_WIDTH * 3) / 4, 200);

        ctx.font = '16px Arial';
        ctx.fillStyle = '#888';
        ctx.fillText(results.leftPlayer || 'Player 1', this.GAME_WIDTH / 4, 230);
        ctx.fillText(results.rightPlayer || 'Player 2', (this.GAME_WIDTH * 3) / 4, 230);

        // Trigger callback after delay
        setTimeout(() => {
            this.callbacks.onGameOver?.();
        }, 3000);
    }

    /**
     * Draw multiplayer game
     */
    drawMultiplayer() {
        if (!this.state) return;

        const ctx = this.ctx;
        const leftPaddle = this.state.leftPaddle;
        const rightPaddle = this.state.rightPaddle;
        const ball = this.state.ball;

        // Background - classic black
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);

        // Center line (dashed)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;
        ctx.setLineDash([15, 15]);
        ctx.beginPath();
        ctx.moveTo(this.GAME_WIDTH / 2, 0);
        ctx.lineTo(this.GAME_WIDTH / 2, this.GAME_HEIGHT);
        ctx.stroke();
        ctx.setLineDash([]);

        // Get player info for colors
        const leftPlayer = Array.from(this.multiplayerPlayers.values()).find(p => p.paddleIndex === 0);
        const rightPlayer = Array.from(this.multiplayerPlayers.values()).find(p => p.paddleIndex === 1);
        const leftColor = leftPlayer?.color || '#107c10';
        const rightColor = rightPlayer?.color || '#3366cc';

        // Highlight which paddle is local
        const localPaddleIndex = this.state.localPaddleIndex;

        // Draw left paddle
        ctx.fillStyle = leftColor;
        ctx.fillRect(leftPaddle.x, leftPaddle.y, leftPaddle.width, leftPaddle.height);
        ctx.shadowColor = leftColor;
        ctx.shadowBlur = 10;
        ctx.fillRect(leftPaddle.x, leftPaddle.y, leftPaddle.width, leftPaddle.height);
        ctx.shadowBlur = 0;

        // Draw right paddle
        ctx.fillStyle = rightColor;
        ctx.fillRect(rightPaddle.x, rightPaddle.y, rightPaddle.width, rightPaddle.height);
        ctx.shadowColor = rightColor;
        ctx.shadowBlur = 10;
        ctx.fillRect(rightPaddle.x, rightPaddle.y, rightPaddle.width, rightPaddle.height);
        ctx.shadowBlur = 0;

        // Draw ball
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw ball trail effect
        const trailAlpha = 0.3;
        for (let i = 1; i <= 3; i++) {
            ctx.fillStyle = `rgba(255, 255, 255, ${trailAlpha / i})`;
            ctx.beginPath();
            ctx.arc(ball.x - ball.vx * i * 2, ball.y - ball.vy * i * 2, ball.radius * (1 - i * 0.2), 0, Math.PI * 2);
            ctx.fill();
        }

        // Score display
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = leftColor;
        ctx.fillText(leftPaddle.score.toString(), this.GAME_WIDTH / 4, 60);
        ctx.fillStyle = rightColor;
        ctx.fillText(rightPaddle.score.toString(), (this.GAME_WIDTH * 3) / 4, 60);

        // Player names
        ctx.font = '12px Arial';
        ctx.fillStyle = leftColor;
        ctx.fillText((leftPlayer?.name || 'Player 1') + (localPaddleIndex === 0 ? ' (You)' : ''), this.GAME_WIDTH / 4, 80);
        ctx.fillStyle = rightColor;
        ctx.fillText((rightPlayer?.name || 'Player 2') + (localPaddleIndex === 1 ? ' (You)' : ''), (this.GAME_WIDTH * 3) / 4, 80);

        // Mode indicator
        ctx.font = '14px Arial';
        ctx.fillStyle = '#888';
        ctx.textAlign = 'center';
        ctx.fillText('Multiplayer', this.GAME_WIDTH / 2, 25);

        // Win score indicator
        ctx.font = '12px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText(`First to ${this.state.winScore}`, this.GAME_WIDTH / 2, this.GAME_HEIGHT - 10);

        // Rally counter
        if (this.state.rallyCount >= 5) {
            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = '#ffcc00';
            ctx.fillText(`Rally: ${this.state.rallyCount}`, this.GAME_WIDTH / 2, this.GAME_HEIGHT - 30);
        }

        // Hit flash effect
        if (this.state.hitFlash > 0) {
            ctx.fillStyle = `rgba(16, 124, 16, ${this.state.hitFlash / 10})`;
            ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
        }

        // Serve delay indicator
        if (this.state.serveDelay > 0) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(this.GAME_WIDTH / 2 - 50, this.GAME_HEIGHT / 2 - 20, 100, 40);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('READY', this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 + 7);
        }

        // Pause screen
        if (this.state.paused) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('PAUSED', this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2);
            ctx.font = '16px Arial';
            ctx.fillText('Host can press P to resume', this.GAME_WIDTH / 2, this.GAME_HEIGHT / 2 + 30);
        }
    }

    /**
     * Become the host (host migration)
     */
    becomeHost(gameState) {
        console.log('[XboxPong] Becoming host due to host migration');
        this.isHost = true;
        this.state.hostId = this.localPlayerId;

        // Apply the last known game state
        if (gameState) {
            this.applyHostState(gameState);
        }
    }
}
