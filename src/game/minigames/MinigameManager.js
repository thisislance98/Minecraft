import { XboxPlatformer } from './XboxPlatformer.js';
import { XboxJoust } from './XboxJoust.js';
import { XboxTank } from './XboxTank.js';
import { XboxPong } from './XboxPong.js';

/**
 * MinigameManager handles the Xbox overlay and minigame lifecycle.
 * Extracted from UIManager.js.
 * Now includes multiplayer lobby system for PvP/co-op minigames.
 */
export class MinigameManager {
    constructor(game) {
        this.game = game;
        this.xboxModal = null;
        this.currentXboxGame = null;

        // State holders
        this.xboxPlatformer = null;
        this.platformerState = null;
        this.xboxJoust = null;
        this.joustState = null;
        this.xboxTank = null;
        this.tankState = null;
        this.xboxPong = null;
        this.pongState = null;
        this.snakeState = null;
        this.bricksState = null;
        this.invadersState = null;

        // Global escape key handler for Xbox UI
        this.escapeHandler = null;

        // Multiplayer lobby state
        this.lobbyState = null;
        this.isInLobby = false;
        this.multiplayerEnabled = true; // Can be toggled for single-player mode
        this.socketListenersSetup = false;
    }

    /**
     * Get the socket manager from the game
     */
    get socketManager() {
        return this.game.socketManager;
    }

    /**
     * Get the current room ID from socket manager
     */
    get roomId() {
        return this.socketManager?.roomId;
    }

    /**
     * Get local player name
     */
    get playerName() {
        return localStorage.getItem('communityUsername') || `Player_${Date.now().toString(36).slice(-4)}`;
    }

    /**
     * Setup socket event listeners for minigame multiplayer
     */
    setupSocketListeners() {
        if (this.socketListenersSetup || !this.socketManager?.socket) return;

        const socket = this.socketManager.socket;
        console.log('[MinigameManager] Setting up socket listeners for multiplayer');

        // Lobby state received when joining
        socket.on('minigame:lobbyState', (data) => {
            console.log('[MinigameManager] Received lobby state:', data);
            this.lobbyState = {
                sessionId: data.sessionId,
                gameType: data.gameType,
                players: data.players,
                hostId: data.hostId,
                isActive: data.isActive
            };
            this.updateLobbyUI();
        });

        // Player joined the lobby
        socket.on('minigame:playerJoined', (data) => {
            console.log('[MinigameManager] Player joined:', data.player);
            if (this.lobbyState) {
                this.lobbyState.players.push(data.player);
                this.updateLobbyUI();
            }
        });

        // Player left the lobby
        socket.on('minigame:playerLeft', (data) => {
            console.log('[MinigameManager] Player left:', data.playerId);
            if (this.lobbyState) {
                this.lobbyState.players = this.lobbyState.players.filter(p => p.id !== data.playerId);
                this.updateLobbyUI();
            }
        });

        // Player ready state changed
        socket.on('minigame:playerReady', (data) => {
            console.log('[MinigameManager] Player ready state:', data);
            if (this.lobbyState) {
                const player = this.lobbyState.players.find(p => p.id === data.playerId);
                if (player) {
                    player.isReady = data.isReady;
                    this.updateLobbyUI();
                }
            }
        });

        // Host changed
        socket.on('minigame:hostChanged', (data) => {
            console.log('[MinigameManager] Host changed to:', data.newHostId);
            if (this.lobbyState) {
                this.lobbyState.hostId = data.newHostId;
                this.lobbyState.players.forEach(p => {
                    p.isHost = (p.id === data.newHostId);
                });
                this.updateLobbyUI();
            }
        });

        // Game start
        socket.on('minigame:gameStart', (data) => {
            console.log('[MinigameManager] Game starting!', data);
            this.isInLobby = false;

            // Remove waiting UI if present
            const waitingDiv = document.getElementById('xbox-waiting');
            if (waitingDiv) waitingDiv.remove();

            this.startMultiplayerGame(data);
        });

        // Waiting for players (auto-join mode)
        socket.on('minigame:waiting', (data) => {
            console.log('[MinigameManager] Waiting for players:', data);
            const waitingMessage = document.getElementById('waiting-message');
            if (waitingMessage) {
                waitingMessage.textContent = data.message || 'Waiting for another player...';
            }
        });

        // Error handling
        socket.on('minigame:error', (data) => {
            console.error('[MinigameManager] Error:', data.message);
            this.showLobbyError(data.message);
        });

        // Host migration - we need to take over as host
        socket.on('minigame:becomeHost', (data) => {
            console.log('[MinigameManager] Becoming host with state:', data);
            if (this.xboxTank && this.xboxTank.isActive) {
                this.xboxTank.becomeHost(data.gameState);
            }
            if (this.xboxPong && this.xboxPong.isActive) {
                this.xboxPong.becomeHost(data.gameState);
            }
        });

        this.socketListenersSetup = true;
    }

    /**
     * Show the minigame lobby for a specific game type
     */
    showMinigameLobby(gameType) {
        if (!this.socketManager || !this.roomId) {
            console.warn('[MinigameManager] No socket connection, starting single-player');
            this.startSinglePlayerGame(gameType);
            return;
        }

        this.setupSocketListeners();
        this.isInLobby = true;

        // Hide game menu, show lobby
        const menuDiv = document.getElementById('xbox-menu');
        if (menuDiv) menuDiv.style.display = 'none';

        // Show lobby UI
        this.createLobbyUI(gameType);

        // Join the lobby on the server
        this.socketManager.socket.emit('minigame:join', {
            gameType,
            roomId: this.roomId,
            playerName: this.playerName
        });

        console.log(`[MinigameManager] Joining ${gameType} lobby in room ${this.roomId}`);
    }

    /**
     * Auto-join a minigame without showing a lobby
     * Will join an existing game or wait for another player
     */
    autoJoinMinigame(gameType) {
        if (!this.socketManager || !this.roomId) {
            console.warn('[MinigameManager] No socket connection, starting single-player');
            this.startSinglePlayerGame(gameType);
            return;
        }

        this.setupSocketListeners();
        this.currentXboxGame = gameType;

        // Hide game menu
        const menuDiv = document.getElementById('xbox-menu');
        if (menuDiv) menuDiv.style.display = 'none';

        // Show waiting UI
        this.showWaitingUI(gameType);

        // Auto-join on the server
        this.socketManager.socket.emit('minigame:autoJoin', {
            gameType,
            roomId: this.roomId,
            playerName: this.playerName
        });

        console.log(`[MinigameManager] Auto-joining ${gameType} in room ${this.roomId}`);
    }

    /**
     * Show a simple waiting UI while looking for other players
     */
    showWaitingUI(gameType) {
        const gameScreen = document.getElementById('xbox-game-screen');
        if (!gameScreen) return;

        // Remove any existing waiting UI
        const existingWaiting = document.getElementById('xbox-waiting');
        if (existingWaiting) existingWaiting.remove();

        const gameNames = {
            tank: 'TANK BATTLE',
            joust: 'JOUST',
            pong: 'PONG',
            platformer: 'PLATFORMER'
        };

        const waitingDiv = document.createElement('div');
        waitingDiv.id = 'xbox-waiting';
        waitingDiv.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: #0a0a0a; display: flex; flex-direction: column;
            align-items: center; justify-content: center; padding: 20px;
            box-sizing: border-box; color: white; font-family: 'Segoe UI', sans-serif;
        `;

        waitingDiv.innerHTML = `
            <div style="font-size: 28px; color: #107c10; margin-bottom: 20px; font-weight: bold;">
                ${gameNames[gameType] || gameType.toUpperCase()}
            </div>
            <div id="waiting-spinner" style="
                width: 50px; height: 50px; border: 4px solid #333;
                border-top-color: #107c10; border-radius: 50%;
                animation: spin 1s linear infinite; margin-bottom: 20px;
            "></div>
            <div id="waiting-message" style="font-size: 18px; color: #888; text-align: center;">
                Waiting for another player...
            </div>
            <div style="margin-top: 30px;">
                <button id="waiting-cancel-btn" style="
                    background: #333; color: white; border: 1px solid #555;
                    padding: 10px 25px; font-size: 16px; cursor: pointer;
                    border-radius: 5px; transition: all 0.2s;
                ">Cancel</button>
            </div>
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;

        gameScreen.appendChild(waitingDiv);

        // Cancel button handler
        const cancelBtn = document.getElementById('waiting-cancel-btn');
        cancelBtn.onclick = () => {
            this.cancelAutoJoin();
        };

        // Update controls hint
        const hintDiv = document.getElementById('xbox-controls-hint');
        if (hintDiv) {
            hintDiv.innerHTML = `
                Looking for other players in the same room
                <span style="color:#666">(ESC to cancel)</span>
            `;
        }
    }

    /**
     * Cancel auto-join and return to menu
     */
    cancelAutoJoin() {
        console.log('[MinigameManager] Canceling auto-join');

        if (this.socketManager?.socket) {
            this.socketManager.socket.emit('minigame:leave');
        }

        // Remove waiting UI
        const waitingDiv = document.getElementById('xbox-waiting');
        if (waitingDiv) waitingDiv.remove();

        // Show menu again
        this.showXboxMenu();
    }

    /**
     * Create the lobby UI elements
     */
    createLobbyUI(gameType) {
        const gameScreen = document.getElementById('xbox-game-screen');
        if (!gameScreen) return;

        // Remove any existing lobby
        const existingLobby = document.getElementById('xbox-lobby');
        if (existingLobby) existingLobby.remove();

        const gameNames = {
            tank: 'TANK BATTLE',
            joust: 'JOUST',
            pong: 'PONG',
            platformer: 'PLATFORMER',
            snake: 'SNAKE',
            invaders: 'INVADERS'
        };

        const lobbyDiv = document.createElement('div');
        lobbyDiv.id = 'xbox-lobby';
        lobbyDiv.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: #0a0a0a; display: flex; flex-direction: column;
            align-items: center; padding: 20px; box-sizing: border-box;
            color: white; font-family: 'Segoe UI', sans-serif;
        `;

        lobbyDiv.innerHTML = `
            <div style="font-size: 24px; color: #107c10; margin-bottom: 15px; font-weight: bold;">
                ${gameNames[gameType] || gameType.toUpperCase()} LOBBY
            </div>
            <div id="lobby-players" style="
                width: 90%; flex: 1; background: #1a1a1a; border: 2px solid #333;
                border-radius: 8px; padding: 15px; overflow-y: auto;
            ">
                <div style="color: #888; text-align: center;">Connecting...</div>
            </div>
            <div id="lobby-error" style="color: #ff4444; margin: 10px 0; display: none;"></div>
            <div style="display: flex; gap: 15px; margin-top: 15px;">
                <button id="lobby-ready-btn" style="
                    background: #444; color: white; border: 2px solid #666;
                    padding: 10px 25px; font-size: 16px; cursor: pointer;
                    border-radius: 5px; transition: all 0.2s;
                ">READY</button>
                <button id="lobby-start-btn" style="
                    background: #107c10; color: white; border: none;
                    padding: 10px 25px; font-size: 16px; cursor: pointer;
                    border-radius: 5px; opacity: 0.5; transition: all 0.2s;
                " disabled>START GAME</button>
                <button id="lobby-leave-btn" style="
                    background: #333; color: white; border: 1px solid #555;
                    padding: 10px 25px; font-size: 16px; cursor: pointer;
                    border-radius: 5px; transition: all 0.2s;
                ">LEAVE</button>
            </div>
            <div style="color: #666; font-size: 12px; margin-top: 10px;">
                Waiting for players... (Min 2 to start)
            </div>
        `;

        gameScreen.appendChild(lobbyDiv);

        // Setup button handlers
        const readyBtn = document.getElementById('lobby-ready-btn');
        const startBtn = document.getElementById('lobby-start-btn');
        const leaveBtn = document.getElementById('lobby-leave-btn');

        let isReady = false;

        readyBtn.onclick = () => {
            isReady = !isReady;
            readyBtn.textContent = isReady ? 'NOT READY' : 'READY';
            readyBtn.style.background = isReady ? '#107c10' : '#444';
            readyBtn.style.borderColor = isReady ? '#107c10' : '#666';
            this.socketManager.socket.emit('minigame:ready', { isReady });
        };

        startBtn.onclick = () => {
            if (!startBtn.disabled) {
                this.socketManager.socket.emit('minigame:start');
            }
        };

        leaveBtn.onclick = () => {
            this.leaveMinigameLobby();
        };

        // Update controls hint
        const hintDiv = document.getElementById('xbox-controls-hint');
        if (hintDiv) {
            hintDiv.innerHTML = `
                Waiting for players to join from the same game room
                <span style="color:#666">(ESC to leave)</span>
            `;
        }
    }

    /**
     * Update the lobby UI with current player list
     */
    updateLobbyUI() {
        if (!this.lobbyState || !this.isInLobby) return;

        const playersDiv = document.getElementById('lobby-players');
        if (!playersDiv) return;

        const localSocketId = this.socketManager?.socketId;
        const isHost = this.lobbyState.hostId === localSocketId;

        // Render player list
        if (this.lobbyState.players.length === 0) {
            playersDiv.innerHTML = '<div style="color: #888; text-align: center;">Connecting...</div>';
        } else {
            playersDiv.innerHTML = this.lobbyState.players.map((player, index) => {
                const isLocal = player.id === localSocketId;
                const colors = ['#107c10', '#3366cc', '#cc9900', '#cc33cc'];
                const color = colors[index % colors.length];

                return `
                    <div style="
                        display: flex; align-items: center; justify-content: space-between;
                        padding: 10px; margin: 5px 0; background: ${isLocal ? '#252' : '#222'};
                        border-radius: 5px; border-left: 4px solid ${color};
                    ">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="
                                width: 30px; height: 30px; background: ${color};
                                border-radius: 5px; display: flex; align-items: center;
                                justify-content: center; font-weight: bold;
                            ">${index + 1}</div>
                            <span style="font-weight: ${isLocal ? 'bold' : 'normal'};">
                                ${player.name}${player.isHost ? ' (Host)' : ''}${isLocal ? ' (You)' : ''}
                            </span>
                        </div>
                        <div style="
                            padding: 5px 12px; border-radius: 3px;
                            background: ${player.isReady ? '#107c10' : '#444'};
                            color: ${player.isReady ? '#fff' : '#888'};
                            font-size: 12px;
                        ">
                            ${player.isReady ? '✓ READY' : '⏳ Waiting'}
                        </div>
                    </div>
                `;
            }).join('');

            // Add empty slots
            for (let i = this.lobbyState.players.length; i < 4; i++) {
                playersDiv.innerHTML += `
                    <div style="
                        display: flex; align-items: center; padding: 10px; margin: 5px 0;
                        background: #1a1a1a; border-radius: 5px; border: 1px dashed #333;
                        color: #555;
                    ">
                        <span style="margin-left: 45px;">Empty Slot</span>
                    </div>
                `;
            }
        }

        // Update start button state
        const startBtn = document.getElementById('lobby-start-btn');
        if (startBtn) {
            const allReady = this.lobbyState.players
                .filter(p => p.id !== localSocketId)
                .every(p => p.isReady);
            const enoughPlayers = this.lobbyState.players.length >= 2;
            const canStart = isHost && allReady && enoughPlayers;

            startBtn.disabled = !canStart;
            startBtn.style.opacity = canStart ? '1' : '0.5';
            startBtn.style.cursor = canStart ? 'pointer' : 'not-allowed';
            startBtn.style.display = isHost ? 'block' : 'none';
        }
    }

    /**
     * Show an error message in the lobby
     */
    showLobbyError(message) {
        const errorDiv = document.getElementById('lobby-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 3000);
        }
    }

    /**
     * Leave the minigame lobby
     */
    leaveMinigameLobby() {
        console.log('[MinigameManager] Leaving lobby');

        if (this.socketManager?.socket) {
            this.socketManager.socket.emit('minigame:leave');
        }

        this.lobbyState = null;
        this.isInLobby = false;

        // Remove lobby UI
        const lobbyDiv = document.getElementById('xbox-lobby');
        if (lobbyDiv) lobbyDiv.remove();

        // Show menu again
        this.showXboxMenu();
    }

    /**
     * Start a multiplayer game with the received game data
     */
    startMultiplayerGame(data) {
        console.log('[MinigameManager] Starting multiplayer game:', data);

        // Remove lobby UI
        const lobbyDiv = document.getElementById('xbox-lobby');
        if (lobbyDiv) lobbyDiv.remove();

        const localSocketId = this.socketManager?.socketId;
        const isHost = data.hostId === localSocketId;

        // Find local player's data
        const localPlayer = data.players.find(p => p.id === localSocketId);

        if (data.gameType === 'tank') {
            this.currentXboxGame = 'tank';
            this.startXboxTankMultiplayer(data, isHost, localPlayer);
        } else if (data.gameType === 'pong') {
            this.currentXboxGame = 'pong';
            this.startXboxPongMultiplayer(data, isHost, localPlayer);
        } else if (data.gameType === 'platformer') {
            this.currentXboxGame = 'platformer';
            this.startXboxPlatformerMultiplayer(data, isHost, localPlayer);
        } else {
            // For other games, fall back to single-player for now
            console.log(`[MinigameManager] ${data.gameType} multiplayer not yet implemented, starting single-player`);
            this.startSinglePlayerGame(data.gameType);
        }
    }

    /**
     * Start a single-player game (fallback when no multiplayer)
     */
    startSinglePlayerGame(gameType) {
        switch (gameType) {
            case 'tank':
                this.currentXboxGame = 'tank';
                this.startXboxTank(0);
                break;
            case 'joust':
                this.currentXboxGame = 'joust';
                this.startXboxJoust();
                break;
            case 'pong':
                this.currentXboxGame = 'pong';
                this.startXboxPong();
                break;
            case 'platformer':
                this.currentXboxGame = 'platformer';
                this.startXboxPlatformer(0);
                break;
            case 'snake':
                this.currentXboxGame = 'snake';
                this.startXboxSnake();
                break;
            case 'invaders':
                this.currentXboxGame = 'invaders';
                this.startXboxInvaders();
                break;
            case 'bricks':
                this.currentXboxGame = 'bricks';
                this.startXboxBrickBreaker();
                break;
        }
    }

    /**
     * Start multiplayer Tank Battle
     */
    startXboxTankMultiplayer(data, isHost, localPlayer) {
        this.stopAllXboxGames();

        const canvas = document.getElementById('xbox-canvas');
        if (!canvas) return;

        const menuDiv = document.getElementById('xbox-menu');
        if (menuDiv) menuDiv.style.display = 'none';

        const hintDiv = document.getElementById('xbox-controls-hint');
        if (hintDiv) {
            hintDiv.innerHTML = `
                <b style="color: #fff;">WASD</b> Move | <b style="color: #fff;">Mouse</b> Aim |
                <b style="color: #fff;">Click</b> Fire |
                <span style="color: ${localPlayer?.color || '#107c10'};">●</span> You
                <span style="color:#666">(ESC for menu)</span>
            `;
        }

        canvas.style.display = 'block';
        document.getElementById('xbox-game-over').style.display = 'none';
        this.showBackToMenuButton();

        const self = this;
        this.xboxTank = new XboxTank(canvas, {
            onGameOver: () => {
                document.getElementById('xbox-game-over').style.display = 'flex';
            },
            onLevelComplete: (nextLevel) => {
                setTimeout(() => self.startXboxTank(nextLevel), 2000);
            },
            onAllLevelsComplete: () => {
                setTimeout(() => self.showXboxMenu(), 3000);
            }
        }, this.socketManager, true); // Pass socketManager and isMultiplayer=true

        this.xboxTank.startMultiplayer(data, isHost, localPlayer);
        this.tankState = this.xboxTank.state;
    }

    /**
     * Start multiplayer Pong
     */
    startXboxPongMultiplayer(data, isHost, localPlayer) {
        this.stopAllXboxGames();

        const canvas = document.getElementById('xbox-canvas');
        if (!canvas) return;

        const menuDiv = document.getElementById('xbox-menu');
        if (menuDiv) menuDiv.style.display = 'none';

        const hintDiv = document.getElementById('xbox-controls-hint');
        if (hintDiv) {
            const paddleSide = localPlayer?.playerIndex === 0 ? 'LEFT' : 'RIGHT';
            hintDiv.innerHTML = `
                <b style="color: #fff;">W/S</b> Move paddle |
                <span style="color: ${localPlayer?.color || '#107c10'};">●</span> You (${paddleSide})
                <span style="color:#666">(ESC for menu)</span>
            `;
        }

        canvas.style.display = 'block';
        document.getElementById('xbox-game-over').style.display = 'none';
        this.showBackToMenuButton();

        const self = this;
        this.xboxPong = new XboxPong(canvas, {
            onGameOver: () => {
                document.getElementById('xbox-game-over').style.display = 'flex';
            },
            onLevelComplete: (nextLevel) => {
                setTimeout(() => self.startXboxPong(nextLevel), 2000);
            },
            onAllLevelsComplete: () => {
                setTimeout(() => self.showXboxMenu(), 3000);
            }
        }, this.socketManager, true); // Pass socketManager and isMultiplayer=true

        this.xboxPong.startMultiplayer(data, isHost, localPlayer);
        this.pongState = this.xboxPong.state;
    }

    /**
     * Start multiplayer Platformer Race
     */
    startXboxPlatformerMultiplayer(data, isHost, localPlayer) {
        this.stopAllXboxGames();

        const canvas = document.getElementById('xbox-canvas');
        if (!canvas) return;

        const menuDiv = document.getElementById('xbox-menu');
        if (menuDiv) menuDiv.style.display = 'none';

        const hintDiv = document.getElementById('xbox-controls-hint');
        if (hintDiv) {
            hintDiv.innerHTML = `
                <b style="color: #fff;">A/D</b> Move | <b style="color: #fff;">W/Space</b> Jump |
                <span style="color: ${localPlayer?.color || '#107c10'};">●</span> You
                <span style="color:#666">(ESC for menu)</span>
            `;
        }

        canvas.style.display = 'block';
        document.getElementById('xbox-game-over').style.display = 'none';
        this.showBackToMenuButton();

        const self = this;
        this.xboxPlatformer = new XboxPlatformer(canvas, {
            onGameOver: () => {
                document.getElementById('xbox-game-over').style.display = 'flex';
            },
            onLevelComplete: (nextLevel) => {
                setTimeout(() => self.startXboxPlatformer(nextLevel), 500);
            },
            onAllLevelsComplete: () => {
                setTimeout(() => self.showXboxMenu(), 3000);
            }
        }, this.socketManager, true); // Pass socketManager and isMultiplayer=true

        this.xboxPlatformer.startMultiplayer(data, isHost, localPlayer);
        this.platformerState = this.xboxPlatformer.state;
    }

    showXboxUI() {
        if (this.xboxModal) {
            this.xboxModal.classList.remove('hidden');
            if (this.game.inputManager) this.game.inputManager.unlock();
            this.showXboxMenu();
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'xbox-modal';
        modal.className = 'ui-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.9); display: flex; align-items: center;
            justify-content: center; z-index: 3000; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: #101010; border: 4px solid #107c10; padding: 40px;
            border-radius: 10px; text-align: center; color: white; width: 640px;
            box-shadow: 0 0 50px rgba(16, 124, 16, 0.5);
        `;

        content.innerHTML = `
            <div style="font-size: 48px; font-weight: bold; color: #107c10; margin-bottom: 20px; letter-spacing: 5px;">XBOX</div>
            <div id="xbox-game-screen" style="background: #000; height: 360px; border: 4px solid #333; margin-bottom: 30px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                <canvas id="xbox-canvas" width="600" height="340" style="display: none;"></canvas>
                
                <div id="xbox-boot" style="display: flex; flex-direction: column; align-items: center; width: 100%;">
                    <div style="font-size: 24px; margin-bottom: 20px; color: #107c10;">Xbox Live</div>
                    <div id="xbox-loading-bar" style="width: 70%; height: 8px; background: #222; border-radius: 4px; overflow: hidden;">
                        <div id="xbox-progress" style="width: 0%; height: 100%; background: #107c10; transition: width 0.3s;"></div>
                    </div>
                    <div id="xbox-status" style="margin-top: 15px; color: #888; font-size: 14px;">Initializing...</div>
                </div>

                <div id="xbox-menu" style="display: none; flex-direction: column; align-items: center; gap: 15px; width: 100%; overflow-y: auto; max-height: 330px; padding: 10px 0;">
                    <div style="font-size: 24px; margin-bottom: 5px;">Select Game</div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; width: 90%;">
                        <div class="xbox-game-card" id="play-platformer" style="cursor: pointer; background: #222; border: 2px solid #333; padding: 12px; border-radius: 8px; transition: all 0.2s; text-align: center;">
                            <div style="font-size: 32px; margin-bottom: 5px;">🏃</div>
                            <div style="font-weight: bold; color: #107c10; font-size: 14px;">Platformer</div>
                        </div>
                        <div class="xbox-game-card" id="play-joust" style="cursor: pointer; background: #222; border: 2px solid #333; padding: 12px; border-radius: 8px; transition: all 0.2s; text-align: center;">
                            <div style="font-size: 32px; margin-bottom: 5px;">🛡️</div>
                            <div style="font-weight: bold; color: #107c10; font-size: 14px;">Joust</div>
                        </div>
                        <div class="xbox-game-card" id="play-snake" style="cursor: pointer; background: #222; border: 2px solid #333; padding: 12px; border-radius: 8px; transition: all 0.2s; text-align: center;">
                            <div style="font-size: 32px; margin-bottom: 5px;">🐍</div>
                            <div style="font-weight: bold; color: #107c10; font-size: 14px;">Snake</div>
                        </div>
                        <div class="xbox-game-card" id="play-bricks" style="cursor: pointer; background: #222; border: 2px solid #333; padding: 12px; border-radius: 8px; transition: all 0.2s; text-align: center;">
                            <div style="font-size: 32px; margin-bottom: 5px;">🧱</div>
                            <div style="font-weight: bold; color: #107c10; font-size: 14px;">Bricks</div>
                        </div>
                        <div class="xbox-game-card" id="play-invaders" style="cursor: pointer; background: #222; border: 2px solid #333; padding: 12px; border-radius: 8px; transition: all 0.2s; text-align: center;">
                            <div style="font-size: 32px; margin-bottom: 5px;">👾</div>
                            <div style="font-weight: bold; color: #107c10; font-size: 14px;">Invaders</div>
                        </div>
                        <div class="xbox-game-card" id="play-tank" style="cursor: pointer; background: #222; border: 2px solid #333; padding: 12px; border-radius: 8px; transition: all 0.2s; text-align: center;">
                            <div style="font-size: 32px; margin-bottom: 5px;">🎖️</div>
                            <div style="font-weight: bold; color: #107c10; font-size: 14px;">Tank Battle</div>
                        </div>
                        <div class="xbox-game-card" id="play-pong" style="cursor: pointer; background: #222; border: 2px solid #333; padding: 12px; border-radius: 8px; transition: all 0.2s; text-align: center;">
                            <div style="font-size: 32px; margin-bottom: 5px;">🏓</div>
                            <div style="font-weight: bold; color: #107c10; font-size: 14px;">Pong</div>
                        </div>
                    </div>
                </div>

                <div id="xbox-game-over" style="display: none; position: absolute; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.8); flex-direction: column; align-items: center; justify-content: center; z-index: 10;">
                    <div style="font-size: 40px; color: #ff3333; margin-bottom: 20px; font-weight: bold;">GAME OVER</div>
                    <div style="display: flex; gap: 15px;">
                        <button id="xbox-restart" style="background: #107c10; color: white; border: none; padding: 10px 20px; font-size: 18px; cursor: pointer; border-radius: 5px;">Try Again</button>
                        <button id="xbox-back-menu" style="background: #444; color: white; border: none; padding: 10px 20px; font-size: 18px; cursor: pointer; border-radius: 5px;">Menu</button>
                    </div>
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div id="xbox-controls-hint" style="text-align: left; font-size: 14px; color: #888;">
                    Select a game to start!
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="xbox-back-to-menu" style="background: #444; color: white; border: 1px solid #555; padding: 10px 20px; font-size: 16px; cursor: pointer; border-radius: 5px; display: none;">◀ Menu</button>
                    <button id="xbox-close" style="background: #333; color: white; border: 1px solid #555; padding: 10px 20px; font-size: 16px; cursor: pointer; border-radius: 5px;">Turn Off</button>
                </div>
            </div>
            <style>
                .xbox-game-card:hover { border-color: #107c10 !important; background: #333 !important; transform: translateY(-5px); }
            </style>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);
        this.xboxModal = modal;

        const closeBtn = document.getElementById('xbox-close');
        closeBtn.onclick = () => {
            this.stopAllXboxGames();
            modal.classList.add('hidden');
            if (this.game.inputManager) this.game.inputManager.lock();
        };

        // Escape key handler - returns to menu if in game, or closes Xbox UI if on menu
        this.escapeHandler = (e) => {
            if (e.code === 'Escape' && this.xboxModal && !this.xboxModal.classList.contains('hidden')) {
                e.preventDefault();
                e.stopPropagation();

                // If currently playing a game, go back to menu
                if (this.currentXboxGame) {
                    console.log('[Xbox] Escape pressed - returning to game menu');
                    this.showXboxMenu();
                } else {
                    // If on the menu, close the Xbox UI entirely
                    console.log('[Xbox] Escape pressed - closing Xbox UI');
                    this.stopAllXboxGames();
                    modal.classList.add('hidden');
                    if (this.game.inputManager) this.game.inputManager.lock();
                }
            }
        };
        window.addEventListener('keydown', this.escapeHandler);

        // Back to menu button (visible during gameplay)
        const backToMenuBtn = document.getElementById('xbox-back-to-menu');
        backToMenuBtn.onclick = () => {
            if (this.currentXboxGame) {
                console.log('[Xbox] Back button clicked - returning to game menu');
                this.showXboxMenu();
            }
        };

        const restartBtn = document.getElementById('xbox-restart');
        restartBtn.onclick = () => {
            if (this.currentXboxGame === 'platformer') {
                this.startXboxPlatformer(this.platformerState ? this.platformerState.levelIndex : 0);
            } else if (this.currentXboxGame === 'joust') {
                this.startXboxJoust();
            } else if (this.currentXboxGame === 'snake') {
                this.startXboxSnake();
            } else if (this.currentXboxGame === 'bricks') {
                this.startXboxBrickBreaker();
            } else if (this.currentXboxGame === 'invaders') {
                this.startXboxInvaders();
            } else if (this.currentXboxGame === 'tank') {
                this.startXboxTank(this.tankState ? this.tankState.levelIndex : 0);
            } else if (this.currentXboxGame === 'pong') {
                this.startXboxPong(this.pongState ? this.pongState.levelIndex : 0);
            }
        };

        const backMenuBtn = document.getElementById('xbox-back-menu');
        backMenuBtn.onclick = () => this.showXboxMenu();

        document.getElementById('play-platformer').onclick = () => {
            // Show mode selection for Platformer
            this.showPlatformerModeSelection();
        };
        document.getElementById('play-joust').onclick = () => {
            this.currentXboxGame = 'joust';
            this.startXboxJoust();
        };
        document.getElementById('play-snake').onclick = () => {
            this.currentXboxGame = 'snake';
            this.startXboxSnake();
        };
        document.getElementById('play-bricks').onclick = () => {
            this.currentXboxGame = 'bricks';
            this.startXboxBrickBreaker();
        };
        document.getElementById('play-invaders').onclick = () => {
            this.currentXboxGame = 'invaders';
            this.startXboxInvaders();
        };
        document.getElementById('play-tank').onclick = () => {
            // Show mode selection for Tank Battle
            this.showTankModeSelection();
        };
        document.getElementById('play-pong').onclick = () => {
            // Show mode selection for Pong
            this.showPongModeSelection();
        };

        this.startXboxBootSequence();
        if (this.game.inputManager) this.game.inputManager.unlock();
    }

    startXboxBootSequence() {
        const progressBar = document.getElementById('xbox-progress');
        const statusText = document.getElementById('xbox-status');
        const bootDiv = document.getElementById('xbox-boot');

        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                setTimeout(() => {
                    this.showXboxMenu();
                }, 500);
            }
            if (progressBar) progressBar.style.width = progress + '%';
            if (statusText) {
                if (progress < 30) statusText.innerHTML = "Signing in as MasterChief...";
                else if (progress < 60) statusText.innerHTML = "Connecting to Xbox Live...";
                else if (progress < 90) statusText.innerHTML = "Syncing achievements...";
                else statusText.innerHTML = "Welcome back!";
            }
        }, 150);
    }

    showXboxMenu() {
        this.stopAllXboxGames();

        // Leave any active lobby or waiting state
        if (this.isInLobby || this.currentXboxGame) {
            if (this.socketManager?.socket) {
                this.socketManager.socket.emit('minigame:leave');
            }
            this.lobbyState = null;
            this.isInLobby = false;
        }

        const bootDiv = document.getElementById('xbox-boot');
        const menuDiv = document.getElementById('xbox-menu');
        const canvas = document.getElementById('xbox-canvas');
        const gameOverDiv = document.getElementById('xbox-game-over');
        const hintDiv = document.getElementById('xbox-controls-hint');
        const backToMenuBtn = document.getElementById('xbox-back-to-menu');
        const lobbyDiv = document.getElementById('xbox-lobby');
        const waitingDiv = document.getElementById('xbox-waiting');
        const modeSelectDiv = document.getElementById('xbox-tank-mode-select');
        const pongModeSelectDiv = document.getElementById('xbox-pong-mode-select');
        const platformerModeSelectDiv = document.getElementById('xbox-platformer-mode-select');

        if (bootDiv) bootDiv.style.display = 'none';
        if (canvas) canvas.style.display = 'none';
        if (gameOverDiv) gameOverDiv.style.display = 'none';
        if (lobbyDiv) lobbyDiv.remove();
        if (waitingDiv) waitingDiv.remove();
        if (modeSelectDiv) modeSelectDiv.remove();
        if (pongModeSelectDiv) pongModeSelectDiv.remove();
        if (platformerModeSelectDiv) platformerModeSelectDiv.remove();
        if (menuDiv) menuDiv.style.display = 'flex';
        if (hintDiv) hintDiv.innerHTML = 'Select a game to start! <span style="color:#666">(ESC to close)</span>';
        if (backToMenuBtn) backToMenuBtn.style.display = 'none';

        this.currentXboxGame = null;
    }

    showBackToMenuButton() {
        const backToMenuBtn = document.getElementById('xbox-back-to-menu');
        if (backToMenuBtn) backToMenuBtn.style.display = 'block';
    }

    stopAllXboxGames() {
        this.stopXboxPlatformer();
        this.stopXboxJoust();
        this.stopXboxTank();
        this.stopXboxPong();
        this.stopXboxSnake();
        this.stopXboxBrickBreaker();
        this.stopXboxInvaders();
    }

    // --- Platformer ---

    startXboxPlatformer(levelIndex = 0) {
        this.stopAllXboxGames();
        const canvas = document.getElementById('xbox-canvas');
        if (!canvas) return;

        const menuDiv = document.getElementById('xbox-menu');
        if (menuDiv) menuDiv.style.display = 'none';

        const hintDiv = document.getElementById('xbox-controls-hint');
        if (hintDiv) {
            hintDiv.innerHTML = `
                <b style="color: #fff;">W / Space</b> Jump, <b style="color: #fff;">A / D</b> Move |
                Avoid <b style="color: #ff3333;">Red</b> enemies | Reach <b style="color: #ffff00;">Gold</b> goal
                <span style="color:#666">(ESC for menu)</span>
            `;
        }

        canvas.style.display = 'block';
        document.getElementById('xbox-game-over').style.display = 'none';
        this.showBackToMenuButton();

        const self = this;
        this.xboxPlatformer = new XboxPlatformer(canvas, {
            onGameOver: () => {
                document.getElementById('xbox-game-over').style.display = 'flex';
            },
            onLevelComplete: (nextLevel) => {
                setTimeout(() => self.startXboxPlatformer(nextLevel), 500);
            },
            onAllLevelsComplete: () => {
                setTimeout(() => self.startXboxPlatformer(0), 2000);
            }
        });
        this.xboxPlatformer.start(levelIndex);
        this.platformerState = this.xboxPlatformer.state;
    }

    stopXboxPlatformer() {
        if (this.xboxPlatformer) {
            this.xboxPlatformer.stop();
            this.xboxPlatformer = null;
        }
        this.platformerState = null;
    }

    // --- Joust ---

    startXboxJoust(levelIndex = 0) {
        this.stopAllXboxGames();

        const canvas = document.getElementById('xbox-canvas');
        if (!canvas) return;

        const menuDiv = document.getElementById('xbox-menu');
        if (menuDiv) menuDiv.style.display = 'none';

        const hintDiv = document.getElementById('xbox-controls-hint');
        if (hintDiv) {
            hintDiv.innerHTML = `
                <b style="color: #fff;">W / Space</b> Flap, <b style="color: #fff;">A / D</b> Move |
                Hit <b style="color: #ff3333;">Enemies</b> from <b style="color: #fff;">Above</b>
                <span style="color:#666">(ESC for menu)</span>
            `;
        }

        canvas.style.display = 'block';
        document.getElementById('xbox-game-over').style.display = 'none';
        this.showBackToMenuButton();

        const self = this;
        this.xboxJoust = new XboxJoust(canvas, {
            onGameOver: () => {
                document.getElementById('xbox-game-over').style.display = 'flex';
            },
            onLevelComplete: (nextLevel) => {
                setTimeout(() => self.startXboxJoust(nextLevel), 2000);
            },
            onAllLevelsComplete: () => {
                setTimeout(() => self.showXboxMenu(), 3000);
            }
        });
        this.xboxJoust.start(levelIndex);
        this.joustState = this.xboxJoust.state;
    }

    stopXboxJoust() {
        if (this.xboxJoust) {
            this.xboxJoust.stop();
            this.xboxJoust = null;
        }
        this.joustState = null;
    }

    // --- Tank Battle ---

    startXboxTank(levelIndex = 0) {
        this.stopAllXboxGames();

        const canvas = document.getElementById('xbox-canvas');
        if (!canvas) return;

        const menuDiv = document.getElementById('xbox-menu');
        if (menuDiv) menuDiv.style.display = 'none';

        const hintDiv = document.getElementById('xbox-controls-hint');
        if (hintDiv) {
            hintDiv.innerHTML = `
                <b style="color: #fff;">WASD</b> Move | <b style="color: #fff;">Mouse</b> Aim |
                <b style="color: #fff;">Click</b> Fire
                <span style="color:#666">(ESC for menu)</span>
            `;
        }

        canvas.style.display = 'block';
        document.getElementById('xbox-game-over').style.display = 'none';
        this.showBackToMenuButton();

        const self = this;
        this.xboxTank = new XboxTank(canvas, {
            onGameOver: () => {
                document.getElementById('xbox-game-over').style.display = 'flex';
            },
            onLevelComplete: (nextLevel) => {
                setTimeout(() => self.startXboxTank(nextLevel), 2000);
            },
            onAllLevelsComplete: () => {
                setTimeout(() => self.showXboxMenu(), 3000);
            }
        });
        this.xboxTank.start(levelIndex);
        this.tankState = this.xboxTank.state;
    }

    stopXboxTank() {
        if (this.xboxTank) {
            this.xboxTank.stop();
            this.xboxTank = null;
        }
        this.tankState = null;
    }

    /**
     * Show mode selection UI for Tank Battle (Single Player vs Multiplayer)
     */
    showTankModeSelection() {
        const gameScreen = document.getElementById('xbox-game-screen');
        if (!gameScreen) return;

        // Hide the main menu
        const menuDiv = document.getElementById('xbox-menu');
        if (menuDiv) menuDiv.style.display = 'none';

        // Remove any existing mode selection UI
        const existingModeSelect = document.getElementById('xbox-tank-mode-select');
        if (existingModeSelect) existingModeSelect.remove();

        const modeSelectDiv = document.createElement('div');
        modeSelectDiv.id = 'xbox-tank-mode-select';
        modeSelectDiv.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: #0a0a0a; display: flex; flex-direction: column;
            align-items: center; justify-content: center; padding: 20px;
            box-sizing: border-box; color: white; font-family: 'Segoe UI', sans-serif;
        `;

        const multiplayerAvailable = this.multiplayerEnabled && this.socketManager?.isConnected();

        modeSelectDiv.innerHTML = `
            <div style="font-size: 32px; color: #107c10; margin-bottom: 10px; font-weight: bold;">
                🎖️ TANK BATTLE
            </div>
            <div style="font-size: 14px; color: #888; margin-bottom: 30px;">
                Select Game Mode
            </div>
            <div style="display: flex; flex-direction: column; gap: 15px; width: 80%; max-width: 300px;">
                <button id="tank-mode-single" style="
                    background: linear-gradient(180deg, #1a5a1a 0%, #107c10 100%);
                    color: white; border: 2px solid #2a8a2a;
                    padding: 20px 30px; font-size: 18px; cursor: pointer;
                    border-radius: 8px; transition: all 0.2s; text-align: left;
                    display: flex; align-items: center; gap: 15px;
                ">
                    <span style="font-size: 28px;">🤖</span>
                    <div>
                        <div style="font-weight: bold;">Single Player</div>
                        <div style="font-size: 12px; opacity: 0.8;">Battle against the computer</div>
                    </div>
                </button>
                <button id="tank-mode-multiplayer" style="
                    background: ${multiplayerAvailable ? 'linear-gradient(180deg, #1a4a7a 0%, #3366cc 100%)' : '#333'};
                    color: ${multiplayerAvailable ? 'white' : '#666'};
                    border: 2px solid ${multiplayerAvailable ? '#4477dd' : '#444'};
                    padding: 20px 30px; font-size: 18px;
                    cursor: ${multiplayerAvailable ? 'pointer' : 'not-allowed'};
                    border-radius: 8px; transition: all 0.2s; text-align: left;
                    display: flex; align-items: center; gap: 15px;
                " ${multiplayerAvailable ? '' : 'disabled'}>
                    <span style="font-size: 28px;">👥</span>
                    <div>
                        <div style="font-weight: bold;">Multiplayer</div>
                        <div style="font-size: 12px; opacity: 0.8;">
                            ${multiplayerAvailable ? 'Battle other players in your room' : 'Not connected to server'}
                        </div>
                    </div>
                </button>
            </div>
            <button id="tank-mode-back" style="
                margin-top: 30px; background: #333; color: white; border: 1px solid #555;
                padding: 10px 25px; font-size: 14px; cursor: pointer;
                border-radius: 5px; transition: all 0.2s;
            ">◀ Back to Menu</button>
            <style>
                #tank-mode-single:hover { transform: scale(1.02); box-shadow: 0 0 20px rgba(16, 124, 16, 0.5); }
                #tank-mode-multiplayer:not([disabled]):hover { transform: scale(1.02); box-shadow: 0 0 20px rgba(51, 102, 204, 0.5); }
            </style>
        `;

        gameScreen.appendChild(modeSelectDiv);

        // Update controls hint
        const hintDiv = document.getElementById('xbox-controls-hint');
        if (hintDiv) {
            hintDiv.innerHTML = `Choose your game mode <span style="color:#666">(ESC to go back)</span>`;
        }

        // Button handlers
        document.getElementById('tank-mode-single').onclick = () => {
            modeSelectDiv.remove();
            this.currentXboxGame = 'tank';
            this.startXboxTank(0);
        };

        if (multiplayerAvailable) {
            document.getElementById('tank-mode-multiplayer').onclick = () => {
                modeSelectDiv.remove();
                this.autoJoinMinigame('tank');
            };
        }

        document.getElementById('tank-mode-back').onclick = () => {
            modeSelectDiv.remove();
            this.showXboxMenu();
        };
    }

    /**
     * Show mode selection UI for Pong (Single Player vs Multiplayer)
     */
    showPongModeSelection() {
        const gameScreen = document.getElementById('xbox-game-screen');
        if (!gameScreen) return;

        // Hide the main menu
        const menuDiv = document.getElementById('xbox-menu');
        if (menuDiv) menuDiv.style.display = 'none';

        // Remove any existing mode selection UI
        const existingModeSelect = document.getElementById('xbox-pong-mode-select');
        if (existingModeSelect) existingModeSelect.remove();

        const modeSelectDiv = document.createElement('div');
        modeSelectDiv.id = 'xbox-pong-mode-select';
        modeSelectDiv.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: #0a0a0a; display: flex; flex-direction: column;
            align-items: center; justify-content: center; padding: 20px;
            box-sizing: border-box; color: white; font-family: 'Segoe UI', sans-serif;
        `;

        const multiplayerAvailable = this.multiplayerEnabled && this.socketManager?.isConnected();

        modeSelectDiv.innerHTML = `
            <div style="font-size: 32px; color: #107c10; margin-bottom: 10px; font-weight: bold;">
                🏓 PONG
            </div>
            <div style="font-size: 14px; color: #888; margin-bottom: 30px;">
                Select Game Mode
            </div>
            <div style="display: flex; flex-direction: column; gap: 15px; width: 80%; max-width: 300px;">
                <button id="pong-mode-single" style="
                    background: linear-gradient(180deg, #1a5a1a 0%, #107c10 100%);
                    color: white; border: 2px solid #2a8a2a;
                    padding: 20px 30px; font-size: 18px; cursor: pointer;
                    border-radius: 8px; transition: all 0.2s; text-align: left;
                    display: flex; align-items: center; gap: 15px;
                ">
                    <span style="font-size: 28px;">🤖</span>
                    <div>
                        <div style="font-weight: bold;">Single Player</div>
                        <div style="font-size: 12px; opacity: 0.8;">Play against the AI</div>
                    </div>
                </button>
                <button id="pong-mode-multiplayer" style="
                    background: ${multiplayerAvailable ? 'linear-gradient(180deg, #1a4a7a 0%, #3366cc 100%)' : '#333'};
                    color: ${multiplayerAvailable ? 'white' : '#666'};
                    border: 2px solid ${multiplayerAvailable ? '#4477dd' : '#444'};
                    padding: 20px 30px; font-size: 18px;
                    cursor: ${multiplayerAvailable ? 'pointer' : 'not-allowed'};
                    border-radius: 8px; transition: all 0.2s; text-align: left;
                    display: flex; align-items: center; gap: 15px;
                " ${multiplayerAvailable ? '' : 'disabled'}>
                    <span style="font-size: 28px;">👥</span>
                    <div>
                        <div style="font-weight: bold;">Multiplayer</div>
                        <div style="font-size: 12px; opacity: 0.8;">
                            ${multiplayerAvailable ? 'Play against another player' : 'Not connected to server'}
                        </div>
                    </div>
                </button>
            </div>
            <button id="pong-mode-back" style="
                margin-top: 30px; background: #333; color: white; border: 1px solid #555;
                padding: 10px 25px; font-size: 14px; cursor: pointer;
                border-radius: 5px; transition: all 0.2s;
            ">◀ Back to Menu</button>
            <style>
                #pong-mode-single:hover { transform: scale(1.02); box-shadow: 0 0 20px rgba(16, 124, 16, 0.5); }
                #pong-mode-multiplayer:not([disabled]):hover { transform: scale(1.02); box-shadow: 0 0 20px rgba(51, 102, 204, 0.5); }
            </style>
        `;

        gameScreen.appendChild(modeSelectDiv);

        // Update controls hint
        const hintDiv = document.getElementById('xbox-controls-hint');
        if (hintDiv) {
            hintDiv.innerHTML = `Choose your game mode <span style="color:#666">(ESC to go back)</span>`;
        }

        // Button handlers
        document.getElementById('pong-mode-single').onclick = () => {
            modeSelectDiv.remove();
            this.currentXboxGame = 'pong';
            this.startXboxPong(0);
        };

        if (multiplayerAvailable) {
            document.getElementById('pong-mode-multiplayer').onclick = () => {
                modeSelectDiv.remove();
                this.autoJoinMinigame('pong');
            };
        }

        document.getElementById('pong-mode-back').onclick = () => {
            modeSelectDiv.remove();
            this.showXboxMenu();
        };
    }

    /**
     * Show mode selection UI for Platformer (Single Player vs Multiplayer Race)
     */
    showPlatformerModeSelection() {
        const gameScreen = document.getElementById('xbox-game-screen');
        if (!gameScreen) return;

        // Hide the main menu
        const menuDiv = document.getElementById('xbox-menu');
        if (menuDiv) menuDiv.style.display = 'none';

        // Remove any existing mode selection UI
        const existingModeSelect = document.getElementById('xbox-platformer-mode-select');
        if (existingModeSelect) existingModeSelect.remove();

        const modeSelectDiv = document.createElement('div');
        modeSelectDiv.id = 'xbox-platformer-mode-select';
        modeSelectDiv.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: #0a0a0a; display: flex; flex-direction: column;
            align-items: center; justify-content: center; padding: 20px;
            box-sizing: border-box; color: white; font-family: 'Segoe UI', sans-serif;
        `;

        const multiplayerAvailable = this.multiplayerEnabled && this.socketManager?.isConnected();

        modeSelectDiv.innerHTML = `
            <div style="font-size: 32px; color: #107c10; margin-bottom: 10px; font-weight: bold;">
                🏃 PLATFORMER
            </div>
            <div style="font-size: 14px; color: #888; margin-bottom: 30px;">
                Select Game Mode
            </div>
            <div style="display: flex; flex-direction: column; gap: 15px; width: 80%; max-width: 300px;">
                <button id="platformer-mode-single" style="
                    background: linear-gradient(180deg, #1a5a1a 0%, #107c10 100%);
                    color: white; border: 2px solid #2a8a2a;
                    padding: 20px 30px; font-size: 18px; cursor: pointer;
                    border-radius: 8px; transition: all 0.2s; text-align: left;
                    display: flex; align-items: center; gap: 15px;
                ">
                    <span style="font-size: 28px;">🎮</span>
                    <div>
                        <div style="font-weight: bold;">Single Player</div>
                        <div style="font-size: 12px; opacity: 0.8;">Complete all levels</div>
                    </div>
                </button>
                <button id="platformer-mode-multiplayer" style="
                    background: ${multiplayerAvailable ? 'linear-gradient(180deg, #1a4a7a 0%, #3366cc 100%)' : '#333'};
                    color: ${multiplayerAvailable ? 'white' : '#666'};
                    border: 2px solid ${multiplayerAvailable ? '#4477dd' : '#444'};
                    padding: 20px 30px; font-size: 18px;
                    cursor: ${multiplayerAvailable ? 'pointer' : 'not-allowed'};
                    border-radius: 8px; transition: all 0.2s; text-align: left;
                    display: flex; align-items: center; gap: 15px;
                " ${multiplayerAvailable ? '' : 'disabled'}>
                    <span style="font-size: 28px;">🏁</span>
                    <div>
                        <div style="font-weight: bold;">Multiplayer Race</div>
                        <div style="font-size: 12px; opacity: 0.8;">
                            ${multiplayerAvailable ? 'Race to the goal against others' : 'Not connected to server'}
                        </div>
                    </div>
                </button>
            </div>
            <button id="platformer-mode-back" style="
                margin-top: 30px; background: #333; color: white; border: 1px solid #555;
                padding: 10px 25px; font-size: 14px; cursor: pointer;
                border-radius: 5px; transition: all 0.2s;
            ">◀ Back to Menu</button>
            <style>
                #platformer-mode-single:hover { transform: scale(1.02); box-shadow: 0 0 20px rgba(16, 124, 16, 0.5); }
                #platformer-mode-multiplayer:not([disabled]):hover { transform: scale(1.02); box-shadow: 0 0 20px rgba(51, 102, 204, 0.5); }
            </style>
        `;

        gameScreen.appendChild(modeSelectDiv);

        // Update controls hint
        const hintDiv = document.getElementById('xbox-controls-hint');
        if (hintDiv) {
            hintDiv.innerHTML = `Choose your game mode <span style="color:#666">(ESC to go back)</span>`;
        }

        // Button handlers
        document.getElementById('platformer-mode-single').onclick = () => {
            modeSelectDiv.remove();
            this.currentXboxGame = 'platformer';
            this.startXboxPlatformer(0);
        };

        if (multiplayerAvailable) {
            document.getElementById('platformer-mode-multiplayer').onclick = () => {
                modeSelectDiv.remove();
                this.autoJoinMinigame('platformer');
            };
        }

        document.getElementById('platformer-mode-back').onclick = () => {
            modeSelectDiv.remove();
            this.showXboxMenu();
        };
    }

    // --- Pong ---

    startXboxPong(levelIndex = 0) {
        this.stopAllXboxGames();

        const canvas = document.getElementById('xbox-canvas');
        if (!canvas) return;

        const menuDiv = document.getElementById('xbox-menu');
        if (menuDiv) menuDiv.style.display = 'none';

        const hintDiv = document.getElementById('xbox-controls-hint');
        if (hintDiv) {
            hintDiv.innerHTML = `
                <b style="color: #fff;">W/S</b> Move paddle | <b style="color: #fff;">P</b> Pause |
                Beat the <b style="color: #ff3333;">AI</b>
                <span style="color:#666">(ESC for menu)</span>
            `;
        }

        canvas.style.display = 'block';
        document.getElementById('xbox-game-over').style.display = 'none';
        this.showBackToMenuButton();

        const self = this;
        this.xboxPong = new XboxPong(canvas, {
            onGameOver: () => {
                document.getElementById('xbox-game-over').style.display = 'flex';
            },
            onLevelComplete: (nextLevel) => {
                setTimeout(() => self.startXboxPong(nextLevel), 2000);
            },
            onAllLevelsComplete: () => {
                setTimeout(() => self.showXboxMenu(), 3000);
            }
        });
        this.xboxPong.start(levelIndex);
        this.pongState = this.xboxPong.state;
    }

    stopXboxPong() {
        if (this.xboxPong) {
            this.xboxPong.stop();
            this.xboxPong = null;
        }
        this.pongState = null;
    }

    // --- Snake ---

    startXboxSnake() {
        this.stopAllXboxGames();

        const canvas = document.getElementById('xbox-canvas');
        if (!canvas) return;

        const menuDiv = document.getElementById('xbox-menu');
        const hintDiv = document.getElementById('xbox-controls-hint');
        if (menuDiv) menuDiv.style.display = 'none';
        if (hintDiv) {
            hintDiv.innerHTML = `<b style="color: #fff;">WASD / Arrows</b> Move | Eat <b style="color: #00ff00;">Green</b> Food <span style="color:#666">(ESC for menu)</span>`;
        }

        canvas.style.display = 'block';
        const gameOverDiv = document.getElementById('xbox-game-over');
        gameOverDiv.style.display = 'none';
        this.showBackToMenuButton();

        const ctx = canvas.getContext('2d');
        const GRID_SIZE = 20;
        const width = canvas.width;
        const height = canvas.height;
        const cols = Math.floor(width / GRID_SIZE);
        const rows = Math.floor(height / GRID_SIZE);

        this.snakeState = {
            snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
            direction: { x: 1, y: 0 },
            nextDirection: { x: 1, y: 0 },
            food: { x: 15, y: 15 },
            score: 0,
            active: true,
            lastUpdate: 0,
            updateInterval: 0.15
        };

        const handleKeyDown = (e) => {
            const s = this.snakeState;
            if (!s) return;
            if ((e.code === 'KeyW' || e.code === 'ArrowUp') && s.direction.y === 0) s.nextDirection = { x: 0, y: -1 };
            if ((e.code === 'KeyS' || e.code === 'ArrowDown') && s.direction.y === 0) s.nextDirection = { x: 0, y: 1 };
            if ((e.code === 'KeyA' || e.code === 'ArrowLeft') && s.direction.x === 0) s.nextDirection = { x: -1, y: 0 };
            if ((e.code === 'KeyD' || e.code === 'ArrowRight') && s.direction.x === 0) s.nextDirection = { x: 1, y: 0 };
        };

        window.addEventListener('keydown', handleKeyDown);
        this.snakeState.cleanup = () => {
            window.removeEventListener('keydown', handleKeyDown);
        };

        const spawnFood = () => {
            let newFood;
            while (true) {
                newFood = {
                    x: Math.floor(Math.random() * cols),
                    y: Math.floor(Math.random() * rows)
                };
                if (!this.snakeState || !this.snakeState.snake.some(seg => seg.x === newFood.x && seg.y === newFood.y)) break;
            }
            this.snakeState.food = newFood;
        };

        const self = this;
        let lastTimestamp = 0;

        function update(dt) {
            const s = self.snakeState;
            if (!s || !s.active) return;

            s.lastUpdate += dt;
            if (s.lastUpdate >= s.updateInterval) {
                s.lastUpdate = 0;
                s.direction = s.nextDirection;

                const head = { x: s.snake[0].x + s.direction.x, y: s.snake[0].y + s.direction.y };

                // Collisions
                if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows ||
                    s.snake.some(seg => seg.x === head.x && seg.y === head.y)) {
                    s.active = false;
                    gameOverDiv.style.display = 'flex';
                    return;
                }

                s.snake.unshift(head);
                if (head.x === s.food.x && head.y === s.food.y) {
                    s.score += 10;
                    s.updateInterval = Math.max(0.05, 0.15 - (s.score / 500));
                    spawnFood();
                } else {
                    s.snake.pop();
                }
            }
        }

        function draw() {
            const s = self.snakeState;
            if (!s) return;

            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, width, height);

            // Food
            ctx.fillStyle = '#107c10';
            ctx.fillRect(s.food.x * GRID_SIZE, s.food.y * GRID_SIZE, GRID_SIZE - 2, GRID_SIZE - 2);

            // Snake
            s.snake.forEach((seg, i) => {
                ctx.fillStyle = i === 0 ? '#1eb51e' : '#107c10';
                ctx.fillRect(seg.x * GRID_SIZE, seg.y * GRID_SIZE, GRID_SIZE - 2, GRID_SIZE - 2);
            });

            ctx.fillStyle = '#fff';
            ctx.font = '14px "Segoe UI"';
            ctx.fillText(`Score: ${s.score}`, 10, 20);
        }

        function loop(timestamp) {
            if (!lastTimestamp) lastTimestamp = timestamp;
            const dt = (timestamp - lastTimestamp) / 1000;
            lastTimestamp = timestamp;

            update(dt);
            draw();

            if (self.snakeState && self.snakeState.active) {
                requestAnimationFrame(loop);
            }
        }

        requestAnimationFrame(loop);
    }

    stopXboxSnake() {
        if (this.snakeState) {
            if (this.snakeState.cleanup) this.snakeState.cleanup();
            this.snakeState.active = false;
        }
        this.snakeState = null;
    }

    // --- Brick Breaker ---

    startXboxBrickBreaker() {
        this.stopAllXboxGames();

        const canvas = document.getElementById('xbox-canvas');
        if (!canvas) return;

        const menuDiv = document.getElementById('xbox-menu');
        const hintDiv = document.getElementById('xbox-controls-hint');
        if (menuDiv) menuDiv.style.display = 'none';
        if (hintDiv) {
            hintDiv.innerHTML = `<b style="color: #fff;">A / D</b> Move Paddle | Clear all <b style="color: #ffd700;">Bricks</b> <span style="color:#666">(ESC for menu)</span>`;
        }

        canvas.style.display = 'block';
        const gameOverDiv = document.getElementById('xbox-game-over');
        gameOverDiv.style.display = 'none';
        this.showBackToMenuButton();

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        this.bricksState = {
            active: true,
            paddle: { x: width / 2 - 40, y: height - 20, w: 80, h: 10 },
            ball: { x: width / 2, y: height - 40, vx: 3, vy: -3, r: 6 },
            bricks: [],
            score: 0,
            keys: {}
        };

        const brickRows = 5;
        const brickCols = 8;
        const brickW = 65;
        const brickH = 20;
        const brickPadding = 10;
        const offsetTop = 40;
        const offsetLeft = 5;

        for (let r = 0; r < brickRows; r++) {
            for (let c = 0; c < brickCols; c++) {
                this.bricksState.bricks.push({
                    x: c * (brickW + brickPadding) + offsetLeft,
                    y: r * (brickH + brickPadding) + offsetTop,
                    active: true
                });
            }
        }

        const handleKeyDown = (e) => { if (this.bricksState) this.bricksState.keys[e.code] = true; };
        const handleKeyUp = (e) => { if (this.bricksState) this.bricksState.keys[e.code] = false; };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        this.bricksState.cleanup = () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };

        const self = this;
        let lastTime = 0;

        function update(dt) {
            const s = self.bricksState;
            if (!s || !s.active) return;
            const speedScale = dt * 60;

            // Paddle move
            if (s.keys['KeyA'] || s.keys['ArrowLeft']) s.paddle.x -= 7 * speedScale;
            if (s.keys['KeyD'] || s.keys['ArrowRight']) s.paddle.x += 7 * speedScale;
            if (s.paddle.x < 0) s.paddle.x = 0;
            if (s.paddle.x + s.paddle.w > width) s.paddle.x = width - s.paddle.w;

            // Ball move
            s.ball.x += s.ball.vx * speedScale;
            s.ball.y += s.ball.vy * speedScale;

            // Walls
            if (s.ball.x - s.ball.r < 0 || s.ball.x + s.ball.r > width) s.ball.vx *= -1;
            if (s.ball.y - s.ball.r < 0) s.ball.vy *= -1;

            // Paddle collision
            if (s.ball.y + s.ball.r > s.paddle.y && s.ball.x > s.paddle.x && s.ball.x < s.paddle.x + s.paddle.w) {
                s.ball.vy = -Math.abs(s.ball.vy);
            }

            // Floor
            if (s.ball.y + s.ball.r > height) {
                s.active = false;
                gameOverDiv.style.display = 'flex';
            }

            // Bricks
            let allCleared = true;
            for (const b of s.bricks) {
                if (b.active) {
                    allCleared = false;
                    if (s.ball.x > b.x && s.ball.x < b.x + brickW && s.ball.y > b.y && s.ball.y < b.y + brickH) {
                        b.active = false;
                        s.ball.vy *= -1;
                        s.score += 10;
                        break;
                    }
                }
            }

            if (allCleared) {
                s.active = false;
                ctx.fillStyle = '#fff';
                ctx.font = '24px Arial';
                ctx.fillText('BRICKS CLEARED!', width / 2 - 80, height / 2);
                setTimeout(() => self.showXboxMenu(), 2000);
            }
        }

        function draw() {
            const s = self.bricksState;
            if (!s) return;
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, width, height);

            // Bricks
            s.bricks.forEach(b => {
                if (b.active) {
                    ctx.fillStyle = '#ffd700';
                    ctx.fillRect(b.x, b.y, brickW, brickH);
                }
            });

            // Paddle
            ctx.fillStyle = '#107c10';
            ctx.fillRect(s.paddle.x, s.paddle.y, s.paddle.w, s.paddle.h);

            // Ball
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(s.ball.x, s.ball.y, s.ball.r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#888';
            ctx.font = '14px Arial';
            ctx.fillText(`Score: ${s.score}`, 10, 20);
        }

        function loop(timestamp) {
            if (!lastTime) lastTime = timestamp;
            const dt = (timestamp - lastTime) / 1000;
            lastTime = timestamp;
            update(dt);
            draw();
            if (self.bricksState && self.bricksState.active) requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
    }

    stopXboxBrickBreaker() {
        if (this.bricksState) {
            if (this.bricksState.cleanup) this.bricksState.cleanup();
            this.bricksState.active = false;
        }
        this.bricksState = null;
    }

    // --- Invaders ---

    startXboxInvaders() {
        this.stopAllXboxGames();

        const canvas = document.getElementById('xbox-canvas');
        if (!canvas) return;

        const menuDiv = document.getElementById('xbox-menu');
        const hintDiv = document.getElementById('xbox-controls-hint');
        if (menuDiv) menuDiv.style.display = 'none';
        if (hintDiv) {
            hintDiv.innerHTML = `<b style="color: #fff;">A / D</b> Move | <b style="color: #fff;">Space</b> Shoot (max 3) | Repel the <b style="color: #ff3333;">Invaders</b> <span style="color:#666">(ESC for menu)</span>`;
        }

        canvas.style.display = 'block';
        const gameOverDiv = document.getElementById('xbox-game-over');
        gameOverDiv.style.display = 'none';
        this.showBackToMenuButton();

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        this.invadersState = {
            active: true,
            player: { x: width / 2 - 15, y: height - 30, w: 30, h: 20 },
            bullets: [],
            enemies: [],
            enemyDir: 1,
            enemyStep: 0,
            score: 0,
            keys: {},
            // Shooting cooldown - can only shoot every 400ms
            lastShotTime: 0,
            shootCooldown: 400, // milliseconds between shots
            maxBullets: 3 // Maximum bullets on screen at once
        };

        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 10; c++) {
                this.invadersState.enemies.push({ x: c * 45 + 50, y: r * 35 + 40, w: 30, h: 20 });
            }
        }

        const handleKeyDown = (e) => {
            if (!this.invadersState) return;
            this.invadersState.keys[e.code] = true;
            // Shooting is now handled in the update loop with cooldown
        };
        const handleKeyUp = (e) => { if (this.invadersState) this.invadersState.keys[e.code] = false; };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        this.invadersState.cleanup = () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };

        const self = this;
        let lastTime = 0;

        function update(dt) {
            const s = self.invadersState;
            if (!s || !s.active) return;
            const speedScale = dt * 60;

            if (s.keys['KeyA'] || s.keys['ArrowLeft']) s.player.x -= 5 * speedScale;
            if (s.keys['KeyD'] || s.keys['ArrowRight']) s.player.x += 5 * speedScale;
            if (s.player.x < 0) s.player.x = 0;
            if (s.player.x + s.player.w > width) s.player.x = width - s.player.w;

            // Shooting with cooldown - no more holding space to win!
            const now = performance.now();
            if (s.keys['Space'] &&
                (now - s.lastShotTime >= s.shootCooldown) &&
                s.bullets.length < s.maxBullets) {
                s.bullets.push({ x: s.player.x + 15, y: s.player.y, r: 3 });
                s.lastShotTime = now;
            }

            // Bullets
            for (let i = s.bullets.length - 1; i >= 0; i--) {
                s.bullets[i].y -= 7 * speedScale;
                if (s.bullets[i].y < 0) {
                    s.bullets.splice(i, 1);
                    continue;
                }

                for (let j = s.enemies.length - 1; j >= 0; j--) {
                    const e = s.enemies[j];
                    if (s.bullets[i] && s.bullets[i].x > e.x && s.bullets[i].x < e.x + e.w && s.bullets[i].y > e.y && s.bullets[i].y < e.y + e.h) {
                        s.enemies.splice(j, 1);
                        s.bullets.splice(i, 1);
                        s.score += 20;
                        break;
                    }
                }
            }

            // Enemies move
            s.enemyStep += speedScale;
            if (s.enemyStep > 30) {
                s.enemyStep = 0;
                let hitEdge = false;
                for (const e of s.enemies) {
                    e.x += 15 * s.enemyDir;
                    if (e.x < 10 || e.x + e.w > width - 10) hitEdge = true;
                }
                if (hitEdge) {
                    s.enemyDir *= -1;
                    for (const e of s.enemies) e.y += 20;
                }
            }

            // Lose condition
            for (const e of s.enemies) {
                if (e.y + e.h > s.player.y) {
                    s.active = false;
                    gameOverDiv.style.display = 'flex';
                }
            }

            if (s.enemies.length === 0) {
                s.active = false;
                ctx.fillStyle = '#fff';
                ctx.font = '24px Arial';
                ctx.fillText('INVADERS REPELLED!', width / 2 - 100, height / 2);
                setTimeout(() => self.showXboxMenu(), 2000);
            }
        }

        function draw() {
            const s = self.invadersState;
            if (!s) return;
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, width, height);

            // Player
            ctx.fillStyle = '#107c10';
            ctx.fillRect(s.player.x, s.player.y, s.player.w, s.player.h);

            // Enemies
            ctx.fillStyle = '#ff3333';
            s.enemies.forEach(e => ctx.fillRect(e.x, e.y, e.w, e.h));

            // Bullets
            ctx.fillStyle = '#ffd700';
            s.bullets.forEach(b => {
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.fillStyle = '#888';
            ctx.font = '14px Arial';
            ctx.fillText(`Score: ${s.score}`, 10, 20);
        }

        function loop(timestamp) {
            if (!lastTime) lastTime = timestamp;
            const dt = (timestamp - lastTime) / 1000;
            lastTime = timestamp;
            update(dt);
            draw();
            if (self.invadersState && self.invadersState.active) requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
    }

    stopXboxInvaders() {
        if (this.invadersState) {
            if (this.invadersState.cleanup) this.invadersState.cleanup();
            this.invadersState.active = false;
        }
        this.invadersState = null;
    }

    closeXboxUI() {
        this.stopAllXboxGames();
        if (this.xboxModal) {
            this.xboxModal.classList.add('hidden');
        }
    }
}
