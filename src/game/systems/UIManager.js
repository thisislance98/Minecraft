import * as THREE from 'three';
import { DebugPanel } from '../ui/DebugPanel.js';
import { IdeasButton } from '../ui/IdeasButton.js';
import { FeedbackUI } from '../ui/FeedbackUI.js';

/**
 * UIManager centralizes all HUD/UI updates.
 * This decouples UI manipulation from game logic.
 */
export class UIManager {
    constructor(game) {
        this.game = game;

        // Cache DOM elements
        this.fpsElement = document.getElementById('fps');
        this.fpsCounter = document.getElementById('fps-counter');
        this.positionElement = document.getElementById('position');
        this.blockCountElement = document.getElementById('block-count');

        // Debug panel
        this.debugPanel = new DebugPanel(game);

        // Ideas Button
        this.ideasButton = new IdeasButton(game);

        // Feedback UI
        this.feedbackUI = new FeedbackUI(game);
        this.createFeedbackButton();

        // Escape Room UI
        this.createEscapeRoomUI();

        // Chat button
        this.setupChatListener();

        // FPS tracking
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();

        // Agent UI elements
        this.statusDiv = null;
        this.voiceIndicator = null;
        this.statusText = null;
        this.taskItemsDiv = null;
        this.tasks = [];

        // Chat Panel elements
        this.chatPanel = document.getElementById('chat-panel');
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('send-chat');
        this.closeBtn = document.getElementById('close-chat');
        this.copyChatBtn = document.getElementById('copy-chat');


        this.setupChatPanelListeners();



        this.createMuteButton();
        this.createSignInputUI();
        this.setupSettingsMenu();

        // Chat scroll state
        this.userHasScrolledUp = false;

        // Mobile Controls
        if (this.game.inputManager && this.game.inputManager.isTouchDevice) {
            this.initTouchControls();
        }
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
                <button id="xbox-close" style="background: #333; color: white; border: 1px solid #555; padding: 10px 20px; font-size: 16px; cursor: pointer; border-radius: 5px;">Turn Off</button>
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
            this.stopXboxPlatformer();
            this.stopXboxJoust();
            modal.classList.add('hidden');
            if (this.game.inputManager) this.game.inputManager.lock();
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
            }
        };

        const backMenuBtn = document.getElementById('xbox-back-menu');
        backMenuBtn.onclick = () => this.showXboxMenu();

        document.getElementById('play-platformer').onclick = () => {
            this.currentXboxGame = 'platformer';
            this.startXboxPlatformer(0);
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
        const bootDiv = document.getElementById('xbox-boot');
        const menuDiv = document.getElementById('xbox-menu');
        const canvas = document.getElementById('xbox-canvas');
        const gameOverDiv = document.getElementById('xbox-game-over');
        const hintDiv = document.getElementById('xbox-controls-hint');

        if (bootDiv) bootDiv.style.display = 'none';
        if (canvas) canvas.style.display = 'none';
        if (gameOverDiv) gameOverDiv.style.display = 'none';
        if (menuDiv) menuDiv.style.display = 'flex';
        if (hintDiv) hintDiv.innerHTML = 'Select a game to start!';

        this.currentXboxGame = null;
    }

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
            `;
        }

        canvas.style.display = 'block';

        const gameOverDiv = document.getElementById('xbox-game-over');
        gameOverDiv.style.display = 'none';

        // Platformer Engine
        const ctx = canvas.getContext('2d');
        const GAME_WIDTH = canvas.width;
        const GAME_HEIGHT = canvas.height;

        const levelData = [
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
                    { x: 200, y: 80, width: 20, height: 20, vx: 2, range: [200, 330] }
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
                    { x: 250, y: GAME_HEIGHT - 80, width: 20, height: 20, vx: 3, range: [250, 330] },
                    { x: 350, y: 60, width: 20, height: 20, vx: -2, range: [350, 480] }
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
                    { x: 150, y: 260, width: 20, height: 20, vx: 2, range: [150, 230] },
                    { x: 450, y: 180, width: 20, height: 20, vx: 4, range: [450, 530] },
                    { x: 150, y: 70, width: 20, height: 20, vx: -3, range: [150, 230] }
                ],
                goal: { x: 10, y: 30, width: 25, height: 20 }
            }
        ];

        const currentLevel = levelData[levelIndex % levelData.length];

        this.platformerState = {
            levelIndex: levelIndex,
            player: {
                x: 20,
                y: GAME_HEIGHT - 60,
                width: 20,
                height: 20,
                vx: 0,
                vy: 0,
                speed: 4,
                jumpPower: -10,
                grounded: false,
                color: '#107c10'
            },
            platforms: currentLevel.platforms,
            enemies: currentLevel.enemies.map(e => ({ ...e })),
            goal: currentLevel.goal,
            keys: {},
            gravity: 0.5,
            active: true
        };

        const handleKeyDown = (e) => {
            this.platformerState.keys[e.code] = true;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
        };
        const handleKeyUp = (e) => {
            if (this.platformerState) this.platformerState.keys[e.code] = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        this.platformerState.cleanup = () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            this.platformerState.active = false;
        };

        const self = this;
        let lastTime = 0;

        function update(dt) {
            if (!self.platformerState || !self.platformerState.active) return;
            const p = self.platformerState.player;
            const keys = self.platformerState.keys;

            // Horizontal movement
            const speedScale = dt * 60; // Normalize to 60fps
            if (keys['KeyA'] || keys['ArrowLeft']) p.vx = -p.speed * speedScale;
            else if (keys['KeyD'] || keys['ArrowRight']) p.vx = p.speed * speedScale;
            else p.vx *= Math.pow(0.8, speedScale); // Friction scaled

            p.x += p.vx;

            // Bounds
            if (p.x < 0) p.x = 0;
            if (p.x + p.width > GAME_WIDTH) p.x = GAME_WIDTH - p.width;

            // Gravity & Vertical movement
            p.vy += self.platformerState.gravity * speedScale;
            p.y += p.vy * speedScale;
            p.grounded = false;

            // Collision with platforms
            for (const plat of self.platformerState.platforms) {
                if (p.x + p.width > plat.x && p.x < plat.x + plat.width &&
                    p.y + p.height > plat.y && p.y + p.height < plat.y + p.vy * speedScale + 5) {
                    p.y = plat.y - p.height;
                    p.vy = 0;
                    p.grounded = true;
                }
            }

            // Enemies movement & collision
            for (const enemy of self.platformerState.enemies) {
                enemy.x += enemy.vx * speedScale;
                if (enemy.x < enemy.range[0] || enemy.x + enemy.width > enemy.range[1]) {
                    enemy.vx *= -1;
                }

                // Player collision with enemy
                if (p.x < enemy.x + enemy.width && p.x + p.width > enemy.x &&
                    p.y < enemy.y + enemy.height && p.y + p.height > enemy.y) {
                    self.platformerState.active = false;
                    gameOverDiv.style.display = 'flex';
                }
            }

            // Goal collision
            const goal = self.platformerState.goal;
            if (p.x < goal.x + goal.width && p.x + p.width > goal.x &&
                p.y < goal.y + goal.height && p.y + p.height > goal.y) {
                self.platformerState.active = false;
                if (self.platformerState.levelIndex + 1 < levelData.length) {
                    // Next level
                    setTimeout(() => self.startXboxPlatformer(self.platformerState.levelIndex + 1), 500);
                } else {
                    // Win state
                    ctx.fillStyle = '#fff';
                    ctx.font = '30px Arial';
                    ctx.fillText('YOU WIN!', GAME_WIDTH / 2 - 60, GAME_HEIGHT / 2);
                    setTimeout(() => self.startXboxPlatformer(0), 2000);
                }
            }

            // Jump
            if (p.grounded && (keys['KeyW'] || keys['Space'] || keys['ArrowUp'])) {
                p.vy = p.jumpPower;
                p.grounded = false;
            }

            // Fall off screen
            if (p.y > GAME_HEIGHT) {
                self.platformerState.active = false;
                gameOverDiv.style.display = 'flex';
            }
        }

        function draw() {
            if (!self.platformerState || !self.platformerState.active) return;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

            // Draw Platforms
            ctx.fillStyle = '#333';
            for (const plat of self.platformerState.platforms) {
                ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
                ctx.shadowBlur = 5;
                ctx.shadowColor = '#107c10';
            }
            ctx.shadowBlur = 0;

            // Draw Enemies
            ctx.fillStyle = '#ff3333';
            for (const enemy of self.platformerState.enemies) {
                ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
                ctx.fillStyle = '#fff';
                ctx.fillRect(enemy.x + 4, enemy.y + 4, 3, 3);
                ctx.fillRect(enemy.x + 13, enemy.y + 4, 3, 3);
                ctx.fillStyle = '#ff3333';
            }

            // Draw Goal
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(self.platformerState.goal.x, self.platformerState.goal.y, self.platformerState.goal.width, self.platformerState.goal.height);

            // Draw Player
            ctx.fillStyle = self.platformerState.player.color;
            ctx.fillRect(self.platformerState.player.x, self.platformerState.player.y, self.platformerState.player.width, self.platformerState.player.height);

            // Player eyes
            ctx.fillStyle = '#fff';
            const eyeX = self.platformerState.player.vx >= 0 ? 12 : 2;
            ctx.fillRect(self.platformerState.player.x + eyeX, self.platformerState.player.y + 4, 4, 4);
            ctx.fillRect(self.platformerState.player.x + eyeX + 3, self.platformerState.player.y + 4, 4, 4);

            // Draw Level Text
            ctx.fillStyle = '#888';
            ctx.font = '12px Arial';
            ctx.fillText(`Level ${self.platformerState.levelIndex + 1}`, 10, 20);

            requestAnimationFrame(loop);
        }

        function loop(timestamp) {
            if (!lastTime) lastTime = timestamp;
            const dt = (timestamp - lastTime) / 1000;
            lastTime = timestamp;

            update(Math.min(dt, 0.1));
            draw();
            if (self.platformerState && self.platformerState.active) {
                requestAnimationFrame(loop);
            }
        }

        requestAnimationFrame(loop);
    }

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
            `;
        }

        canvas.style.display = 'block';

        const gameOverDiv = document.getElementById('xbox-game-over');
        gameOverDiv.style.display = 'none';

        const ctx = canvas.getContext('2d');
        const GAME_WIDTH = canvas.width;
        const GAME_HEIGHT = canvas.height;

        const joustLevels = [
            {
                enemies: [
                    { x: 100, y: 100, width: 24, height: 24, vx: 2, type: 'patrol' },
                    { x: 400, y: 150, width: 24, height: 24, vx: -2, type: 'patrol' }
                ],
                platforms: [
                    { x: 0, y: GAME_HEIGHT - 20, width: GAME_WIDTH, height: 20 },
                    { x: 100, y: 240, width: 150, height: 10 },
                    { x: 350, y: 240, width: 150, height: 10 }
                ],
                powerups: []
            },
            {
                enemies: [
                    { x: 100, y: 100, width: 24, height: 24, vx: 2.5, type: 'hunter' },
                    { x: 400, y: 50, width: 24, height: 24, vx: -2, type: 'patrol' },
                    { x: 250, y: 180, width: 30, height: 20, vx: 4, type: 'charger' }
                ],
                platforms: [
                    { x: 0, y: GAME_HEIGHT - 20, width: GAME_WIDTH, height: 20 },
                    { x: 50, y: 200, width: 100, height: 10 },
                    { x: 450, y: 200, width: 100, height: 10 },
                    { x: 250, y: 120, width: 100, height: 10, type: 'bouncy' }
                ],
                powerups: [{ x: 300, y: 80, type: 'speed' }]
            },
            {
                enemies: [
                    { x: 50, y: 50, width: 24, height: 24, vx: 3, type: 'hunter' },
                    { x: 550, y: 50, width: 24, height: 24, vx: -3, type: 'hunter' },
                    { x: 300, y: 150, width: 40, height: 20, vx: 6, type: 'charger' }
                ],
                platforms: [
                    { x: 0, y: GAME_HEIGHT - 20, width: GAME_WIDTH, height: 20 },
                    { x: 150, y: 220, width: 80, height: 10 },
                    { x: 370, y: 220, width: 80, height: 10 },
                    { x: 260, y: 100, width: 80, height: 10, type: 'bouncy' }
                ],
                powerups: [{ x: 300, y: 260, type: 'flap' }]
            }
        ];

        const level = joustLevels[levelIndex % joustLevels.length];

        this.joustState = {
            levelIndex,
            player: {
                x: GAME_WIDTH / 2 - 12,
                y: GAME_HEIGHT - 50,
                width: 24,
                height: 24,
                vx: 0,
                vy: 0,
                speed: 0.8,
                maxSpeed: 5,
                gravity: 0.25,
                flapPower: -5,
                color: '#107c10',
                powerups: {}
            },
            enemies: level.enemies.map(e => ({ ...e, vy: 0, bounceY: Math.random() * Math.PI * 2 })),
            platforms: level.platforms.map(p => ({ ...p })),
            powerups: level.powerups.map(p => ({ ...p, width: 16, height: 16, collected: false })),
            keys: {},
            active: true
        };

        const handleKeyDown = (e) => {
            this.joustState.keys[e.code] = true;
            if (['Space', 'KeyW', 'ArrowUp'].includes(e.code)) {
                if (this.joustState && this.joustState.active) {
                    const p = this.joustState.player;
                    p.vy = p.powerups.flap ? p.flapPower * 1.4 : p.flapPower;
                }
            }
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
        };
        const handleKeyUp = (e) => {
            if (this.joustState) this.joustState.keys[e.code] = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        this.joustState.cleanup = () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            this.joustState.active = false;
        };

        const self = this;
        let lastTime = 0;

        function update(dt) {
            if (!self.joustState || !self.joustState.active) return;
            const p = self.joustState.player;
            const keys = self.joustState.keys;
            const speedScale = dt * 60;

            // Powerup timers
            for (const type in p.powerups) {
                if (p.powerups[type] > 0) {
                    p.powerups[type] -= dt * 1000;
                    if (p.powerups[type] <= 0) delete p.powerups[type];
                }
            }

            // Movement
            const currentMaxSpeed = p.powerups.speed ? p.maxSpeed * 1.6 : p.maxSpeed;
            const currentAccel = p.speed * (p.powerups.speed ? 1.5 : 1) * speedScale;

            if (keys['KeyA'] || keys['ArrowLeft']) p.vx -= currentAccel;
            if (keys['KeyD'] || keys['ArrowRight']) p.vx += currentAccel;
            p.vx *= Math.pow(0.95, speedScale); // Friction

            if (Math.abs(p.vx) > currentMaxSpeed) p.vx = Math.sign(p.vx) * currentMaxSpeed;
            p.x += p.vx * speedScale;

            // Wrap horizontally
            if (p.x < -p.width) p.x = GAME_WIDTH;
            if (p.x > GAME_WIDTH) p.x = -p.width;

            // Gravity
            p.vy += p.gravity * speedScale;
            p.y += p.vy * speedScale;

            // Floor & Platform collision
            let onGround = false;
            for (const plat of self.joustState.platforms) {
                if (p.x + p.width > plat.x && p.x < plat.x + plat.width &&
                    p.y + p.height > plat.y && p.y + p.height < plat.y + p.vy * speedScale + 5 && p.vy >= 0) {

                    if (plat.type === 'bouncy') {
                        p.vy = -10;
                    } else {
                        p.y = plat.y - p.height;
                        p.vy = 0;
                        onGround = true;
                    }
                }
            }
            if (p.y + p.height > GAME_HEIGHT) {
                p.y = GAME_HEIGHT - p.height;
                p.vy = 0;
                onGround = true;
            }

            // Powerup collection
            for (const pu of self.joustState.powerups) {
                if (!pu.collected && p.x < pu.x + pu.width && p.x + p.width > pu.x &&
                    p.y < pu.y + pu.height && p.y + p.height > pu.y) {
                    pu.collected = true;
                    p.powerups[pu.type] = 8000; // 8 seconds
                }
            }

            // Enemies
            for (let i = self.joustState.enemies.length - 1; i >= 0; i--) {
                const e = self.joustState.enemies[i];

                if (e.type === 'patrol') {
                    e.x += e.vx * speedScale;
                    e.bounceY += 0.05 * speedScale;
                    e.y += Math.sin(e.bounceY) * 0.5 * speedScale;
                } else if (e.type === 'hunter') {
                    const dx = p.x - e.x;
                    const dy = p.y - e.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0) {
                        e.x += (dx / dist) * 1.2 * speedScale;
                        e.y += (dy / dist) * 1.2 * speedScale;
                    }
                } else if (e.type === 'charger') {
                    e.x += e.vx * speedScale;
                    if (e.x < 0 || e.x + e.width > GAME_WIDTH) e.vx *= -1;
                }

                if (e.x < -e.width) e.x = GAME_WIDTH;
                if (e.x > GAME_WIDTH) e.x = -e.width;

                // Collision
                if (p.x < e.x + e.width && p.x + p.width > e.x &&
                    p.y < e.y + e.height && p.y + p.height > e.y) {

                    if (p.y + p.height < e.y + e.height / 2 && p.vy > 0) {
                        self.joustState.enemies.splice(i, 1);
                        p.vy = -4;

                        if (self.joustState.enemies.length === 0) {
                            setTimeout(() => {
                                if (self.joustState) {
                                    self.joustState.active = false;
                                    ctx.fillStyle = '#fff';
                                    ctx.font = '24px "Segoe UI"';
                                    const nextLvl = self.joustState.levelIndex + 1;
                                    if (nextLvl < joustLevels.length) {
                                        ctx.fillText(`LEVEL ${self.joustState.levelIndex + 1} COMPLETE!`, GAME_WIDTH / 2 - 100, GAME_HEIGHT / 2);
                                        setTimeout(() => self.startXboxJoust(nextLvl), 2000);
                                    } else {
                                        ctx.fillText('JOUST CHAMPION!', GAME_WIDTH / 2 - 100, GAME_HEIGHT / 2);
                                        setTimeout(() => self.showXboxMenu(), 3000);
                                    }
                                }
                            }, 500);
                        }
                    } else {
                        self.joustState.active = false;
                        const gameOverDiv = document.getElementById('xbox-game-over');
                        if (gameOverDiv) gameOverDiv.style.display = 'flex';
                    }
                }
            }
        }

        function draw() {
            if (!self.joustState || !self.joustState.active) return;
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

            // Platforms
            for (const plat of self.joustState.platforms) {
                ctx.fillStyle = plat.type === 'bouncy' ? '#107c10' : '#333';
                ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
                if (plat.type === 'bouncy') {
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillRect(plat.x, plat.y, plat.width, 2);
                }
            }

            // Powerups
            for (const pu of self.joustState.powerups) {
                if (!pu.collected) {
                    ctx.fillStyle = pu.type === 'speed' ? '#ffff00' : '#00ffff';
                    ctx.beginPath();
                    ctx.arc(pu.x + 8, pu.y + 8, 6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }

            // Enemies
            for (const e of self.joustState.enemies) {
                if (e.type === 'hunter') ctx.fillStyle = '#ff00ff';
                else if (e.type === 'charger') ctx.fillStyle = '#ff8800';
                else ctx.fillStyle = '#ff3333';

                ctx.fillRect(e.x, e.y, e.width, e.height);

                // Wings 
                const wingY = Math.sin(Date.now() / 100) * 8;
                ctx.fillRect(e.x - 5, e.y + e.height / 2 + wingY, 8, 3);
                ctx.fillRect(e.x + e.width - 3, e.y + e.height / 2 + wingY, 8, 3);

                // Eyes
                ctx.fillStyle = '#000';
                ctx.fillRect(e.x + 4, e.y + 6, 3, 3);
                ctx.fillRect(e.x + e.width - 7, e.y + 6, 3, 3);
            }

            // Player
            const p = self.joustState.player;
            ctx.fillStyle = p.color;
            if (p.powerups.speed) ctx.fillStyle = '#ffff00';
            if (p.powerups.flap) ctx.shadowBlur = 10, ctx.shadowColor = '#00ffff';
            ctx.fillRect(p.x, p.y, p.width, p.height);
            ctx.shadowBlur = 0;

            // Eyes
            ctx.fillStyle = '#fff';
            const eyeX = p.vx >= 0 ? 14 : 2;
            ctx.fillRect(p.x + eyeX, p.y + 6, 4, 4);
            ctx.fillRect(p.x + eyeX + 4, p.y + 6, 4, 4);

            // UI
            ctx.fillStyle = '#888';
            ctx.font = '12px Arial';
            ctx.fillText(`Level ${self.joustState.levelIndex + 1}`, 10, 20);

            // Powerup UI
            let puCount = 0;
            for (const type in p.powerups) {
                ctx.fillStyle = type === 'speed' ? '#ffff00' : '#00ffff';
                ctx.fillRect(10, 35 + puCount * 10, (p.powerups[type] / 8000) * 100, 4);
                puCount++;
            }

            requestAnimationFrame(loop);
        }

        function loop(timestamp) {
            if (!lastTime) lastTime = timestamp;
            const dt = Math.min(0.1, (timestamp - lastTime) / 1000);
            lastTime = timestamp;

            update(dt);
            draw();

            if (self.joustState && self.joustState.active) {
                requestAnimationFrame(loop);
            }
        }

        requestAnimationFrame(loop);
    }

    stopXboxPlatformer() {
        if (this.platformerState && this.platformerState.cleanup) {
            this.platformerState.cleanup();
        }
        this.platformerState = null;
    }

    stopXboxJoust() {
        if (this.joustState && this.joustState.cleanup) {
            this.joustState.cleanup();
        }
        this.joustState = null;
    }
    setupSettingsMenu() {
        // Cache DOM elements
        this.settingsModal = document.getElementById('settings-modal');
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsClose = document.getElementById('settings-close');
        this.resetWorldBtn = document.getElementById('reset-world-btn');
        this.audioToggle = document.getElementById('settings-audio-toggle');
        this.fpsToggle = document.getElementById('settings-fps-toggle');
        this.positionToggle = document.getElementById('settings-position-toggle');
        this.mobileToggle = document.getElementById('settings-mobile-toggle');
        this.debugElement = document.getElementById('debug');

        if (!this.settingsModal || !this.settingsBtn) {
            console.warn('[UIManager] Settings elements not found');
            return;
        }

        // Load saved preferences
        const savedAudio = localStorage.getItem('settings_audio') !== 'false';
        const savedFps = localStorage.getItem('settings_fps') !== 'false';
        const savedPosition = localStorage.getItem('settings_position') !== 'false';

        // Mobile Controls: default to auto-detected state if not previously set
        let savedMobile = localStorage.getItem('settings_mobile');
        if (savedMobile === null) {
            savedMobile = this.game.inputManager ? this.game.inputManager.isTouchDevice : false;
        } else {
            savedMobile = savedMobile === 'true';
        }

        // Apply initial states
        if (this.audioToggle) {
            this.audioToggle.checked = savedAudio;
            if (!savedAudio && this.game.soundManager) {
                this.game.soundManager.setMuted(true);
            }
        }
        if (this.fpsToggle) {
            this.fpsToggle.checked = savedFps;
            if (this.fpsCounter) this.fpsCounter.style.display = savedFps ? 'block' : 'none';
        }
        if (this.positionToggle) {
            this.positionToggle.checked = savedPosition;
            if (this.debugElement) this.debugElement.style.display = savedPosition ? 'block' : 'none';
        }
        if (this.mobileToggle) {
            this.mobileToggle.checked = savedMobile;
            this.game.gameState.flags.mobileControls = savedMobile;
            this.updateMobileControlsVisibility(savedMobile);
        }

        // Settings button click - open modal
        this.settingsBtn.addEventListener('click', () => {
            this.settingsModal.classList.remove('hidden');
            // Sync toggle states with current settings
            if (this.audioToggle && this.game.soundManager) {
                this.audioToggle.checked = !this.game.soundManager.isMuted;
            }
        });

        // Close button
        this.settingsClose.addEventListener('click', () => {
            this.settingsModal.classList.add('hidden');
        });

        // Click outside to close
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.settingsModal.classList.add('hidden');
            }
        });

        // Audio toggle
        if (this.audioToggle) {
            this.audioToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_audio', enabled);
                if (this.game.soundManager) {
                    this.game.soundManager.setMuted(!enabled);
                }
                // Update mute button icon
                if (this.muteBtn) {
                    this.muteBtn.textContent = enabled ? '🔊' : '🔇';
                }
            });
        }

        // FPS toggle
        if (this.fpsToggle) {
            this.fpsToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_fps', enabled);
                if (this.fpsCounter) {
                    this.fpsCounter.style.display = enabled ? 'block' : 'none';
                }
            });
        }

        // Position toggle
        if (this.positionToggle) {
            this.positionToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_position', enabled);
                if (this.debugElement) {
                    this.debugElement.style.display = enabled ? 'block' : 'none';
                }
            });
        }

        // Mobile Toggle
        if (this.mobileToggle) {
            this.mobileToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_mobile', enabled);
                this.game.gameState.flags.mobileControls = enabled;
                this.updateMobileControlsVisibility(enabled);
            });
        }

        // Persistence Toggle
        this.persistenceToggle = document.getElementById('settings-persistence-toggle');
        if (this.persistenceToggle) {
            // Default to FALSE (Off by default as requested)
            const savedPersistence = localStorage.getItem('settings_persistence') === 'true';
            this.persistenceToggle.checked = savedPersistence;

            this.persistenceToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_persistence', enabled);
                // We might need to reload to take effect fully, or just let the next load handle it.
                // For now, it just saves the preference.
            });
        }

        // AI Streaming toggle
        this.aiStreamingToggle = document.getElementById('settings-ai-streaming-toggle');
        if (this.aiStreamingToggle) {
            const savedStreaming = localStorage.getItem('settings_ai_streaming') === 'true';
            this.aiStreamingToggle.checked = savedStreaming;
            // Notify agent of initial state
            if (this.game.agent) {
                this.game.agent.streamingMode = savedStreaming;
            }

            this.aiStreamingToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_ai_streaming', enabled);
                if (this.game.agent) {
                    this.game.agent.streamingMode = enabled;
                }
            });
        }




        // Reset World button
        if (this.resetWorldBtn) {
            this.resetWorldBtn.addEventListener('click', () => {
                if (confirm('⚠️ Are you sure you want to reset the world?\n\nThis will:\n• Clear all placed blocks\n• Remove all creatures\n• Delete all signs\n• Generate new terrain\n\nThis action cannot be undone!')) {
                    // Close settings modal
                    this.settingsModal.classList.add('hidden');

                    // Send reset request via socket
                    if (this.game.socketManager) {
                        this.game.socketManager.sendWorldReset();
                    } else {
                        console.error('[UIManager] SocketManager not available');
                        alert('Failed to reset world: Not connected to server');
                    }
                }
            });
        }

        // Hotkey Configuration
        this.setupHotkeyInputs();
    }

    /**
     * Setup hotkey input handlers for rebinding keys
     */
    setupHotkeyInputs() {
        const secondaryInput = document.getElementById('settings-hotkey-secondary');
        if (!secondaryInput) return;

        // Load saved hotkey or use default
        const currentKey = this.game.inputManager?.getHotkey('secondaryAction') || 'KeyE';
        secondaryInput.value = this.formatKeyCode(currentKey);

        // Click to start listening
        secondaryInput.addEventListener('click', () => {
            secondaryInput.classList.add('listening');
            secondaryInput.value = '...';
        });

        // Capture key press
        secondaryInput.addEventListener('keydown', (e) => {
            if (!secondaryInput.classList.contains('listening')) return;

            e.preventDefault();
            e.stopPropagation();

            // Validate: don't allow reserved keys
            const reservedKeys = ['Escape', 'Tab', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyI', 'KeyP', 'KeyT'];
            if (reservedKeys.includes(e.code)) {
                secondaryInput.value = 'Reserved!';
                setTimeout(() => {
                    secondaryInput.value = this.formatKeyCode(this.game.inputManager?.getHotkey('secondaryAction') || 'KeyE');
                    secondaryInput.classList.remove('listening');
                }, 1000);
                return;
            }

            // Set the new hotkey
            const newKeyCode = e.code;
            if (this.game.inputManager) {
                this.game.inputManager.setHotkey('secondaryAction', newKeyCode);
            }

            // Update UI
            secondaryInput.value = this.formatKeyCode(newKeyCode);
            secondaryInput.classList.remove('listening');
            secondaryInput.blur();
        });

        // Cancel listening on blur (if user clicks away without pressing a key)
        secondaryInput.addEventListener('blur', () => {
            if (secondaryInput.classList.contains('listening')) {
                secondaryInput.classList.remove('listening');
                secondaryInput.value = this.formatKeyCode(this.game.inputManager?.getHotkey('secondaryAction') || 'KeyE');
            }
        });

        // Prevent key events from bubbling to game while input is focused
        secondaryInput.addEventListener('keyup', (e) => e.stopPropagation());
    }

    /**
     * Format a key code for display (e.g., 'KeyE' -> 'E', 'Digit1' -> '1')
     */
    formatKeyCode(keyCode) {
        if (keyCode.startsWith('Key')) {
            return keyCode.replace('Key', '');
        }
        if (keyCode.startsWith('Digit')) {
            return keyCode.replace('Digit', '');
        }
        return keyCode;
    }

    // Remote players HUD - positioned next to version info
    createRemotePlayersHUD() {
        if (this.remotePlayersHUD) return;

        const div = document.createElement('div');
        div.id = 'remote-players-hud';
        div.style.cssText = `
            position: fixed; top: 20px; left: 340px;
            background: rgba(0,0,0,0.7); color: #fff;
            padding: 10px 14px; border-radius: 4px;
            font-family: 'VT323', monospace; font-size: 14px;
            z-index: 100; pointer-events: none;
            display: none;
        `;
        div.innerHTML = `<div id="remote-players-list"></div>`;

        document.body.appendChild(div);
        this.remotePlayersHUD = div;
        this.remotePlayersList = div.querySelector('#remote-players-list');
        this.remotePlayers = new Map();
    }

    updateNetworkStatus(status, role, roomId) {
        // Network status removed - no-op (only remote player positions shown)
    }

    updateRemotePlayerStatus(id, pos, rotY) {
        if (!this.remotePlayersHUD) this.createRemotePlayersHUD();
        if (!this.remotePlayers) this.remotePlayers = new Map();

        if (pos === null) {
            this.remotePlayers.delete(id);
        } else if (pos && typeof pos.x === 'number') {
            this.remotePlayers.set(id, { pos, rotY: rotY ?? 0 });
        } else {
            return;
        }

        // Update display
        let html = '';
        this.remotePlayers.forEach((data, pid) => {
            if (data && data.pos && typeof data.pos.x === 'number') {
                const sid = String(pid).substring(0, 4);
                const p = data.pos;
                html += `<p style="margin: 4px 0;">👤 ${sid}: ${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}</p>`;
            }
        });

        if (this.remotePlayersList) {
            this.remotePlayersList.innerHTML = html;
        }

        // Show/hide based on whether there are remote players
        if (this.remotePlayersHUD) {
            this.remotePlayersHUD.style.display = this.remotePlayers.size > 0 ? 'block' : 'none';
        }
    }

    toggleVoiceTransmitIndicator(active) {
        // Voice transmit indicator removed - no-op
    }

    createMuteButton() {
        const btn = document.createElement('button');
        btn.id = 'mute-btn';
        // Initial state
        const isMuted = this.game.soundManager ? this.game.soundManager.isMuted : false;
        btn.textContent = isMuted ? '🔇' : '🔊';

        btn.style.cssText = `
            position: fixed; top: 10px; right: 80px;
            background: rgba(0,0,0,0.6); color: #fff;
            border: 1px solid rgba(255,255,255,0.2);
            padding: 8px 12px; border-radius: 4px;
            cursor: pointer; font-size: 20px; z-index: 2000;
        `;

        // If network status exists, move this left of it or below it.
        // For simplicity, let's put it at top-right, but adjust if network status is there.
        // Network status is at top: 10px; right: 10px; (in showNetworkStatus)
        // Let's create a container or just offset heavily.
        // Actually, let's put it top-right, but update showNetworkStatus to be lower.

        btn.onclick = () => {
            if (this.game.soundManager) {
                const muted = this.game.soundManager.toggleMute();
                btn.textContent = muted ? '🔇' : '🔊';
                // Remove focus to prevent capturing keyboard input
                btn.blur();
            }
        };

        document.body.appendChild(btn);
        this.muteBtn = btn;
    }

    // --- Agent UI ---

    createStatusIndicator() {
        // Small, unobtrusive status indicator in corner
        if (this.statusDiv) return;

        const div = document.createElement('div');
        div.id = 'voice-status';
        div.style.cssText = `
            position: fixed; bottom: 20px; right: 20px;
            background: rgba(0,0,0,0.8); border: 2px solid #00ffcc;
            padding: 10px 15px; border-radius: 20px; z-index: 1000;
            font-family: 'VT323', monospace; color: #00ffcc; font-size: 14px;
            display: flex; align-items: center; gap: 10px;
        `;
        div.innerHTML = `
            <div id="voice-indicator" style="width: 12px; height: 12px; border-radius: 50%; background: #333;"></div>
            <span id="voice-status-text">Voice Off (V)</span>
            <select id="voice-select" style="
                background: rgba(0,0,0,0.5); border: 1px solid #00ffcc; 
                color: #00ffcc; font-family: inherit; font-size: 12px; 
                border-radius: 4px; outline: none; margin-left: 5px; cursor: pointer;
                padding: 2px 5px;
            ">
                <option value="Puck">Puck</option>
                <option value="Charon">Charon</option>
                <option value="Kore">Kore</option>
                <option value="Fenrir">Fenrir</option>
                <option value="Aoede">Aoede</option>
            </select>
        `;
        document.body.appendChild(div);
        this.statusDiv = div;
        this.voiceIndicator = div.querySelector('#voice-indicator');
        this.statusText = div.querySelector('#voice-status-text');

        // Setup voice selector
        const voiceSelect = div.querySelector('#voice-select');
        const currentVoice = localStorage.getItem('agent_voice') || 'Puck';
        voiceSelect.value = currentVoice;

        voiceSelect.addEventListener('change', (e) => {
            // Unfocus to prevent keyboard capture (like 'W' for walking) affecting the select
            e.target.blur();
            if (this.game.agent) {
                this.game.agent.setVoice(e.target.value);
            }
        });

        // Prevent key presses in the dropdown from triggering game actions
        voiceSelect.addEventListener('keydown', (e) => e.stopPropagation());
        voiceSelect.addEventListener('keyup', (e) => e.stopPropagation());

        this.createTaskListUI();
    }

    createTaskListUI() {
        if (this.taskListDiv) return;

        // CSS for spinner animation and task items
        if (!document.getElementById('agent-spinner-style')) {
            const style = document.createElement('style');
            style.id = 'agent-spinner-style';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .task-spinner {
                    width: 16px; height: 16px;
                    border: 2px solid #00ffcc;
                    border-top: 2px solid transparent;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                .task-done { color: #00ff00; }
                .task-error { color: #ff0000; }
                .task-logs-btn {
                    background: rgba(0, 255, 204, 0.2);
                    border: 1px solid #00ffcc;
                    color: #00ffcc;
                    font-size: 12px;
                    padding: 2px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: 'VT323', monospace;
                    margin-left: auto;
                }
                .task-logs-btn:hover {
                    background: rgba(0, 255, 204, 0.4);
                }
                #task-logs-modal {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(10, 10, 20, 0.95);
                    border: 2px solid #00ffcc;
                    border-radius: 12px;
                    padding: 20px;
                    max-width: 80vw;
                    max-height: 70vh;
                    overflow: auto;
                    z-index: 3000;
                    font-family: monospace;
                    color: #e0e0e0;
                    font-size: 12px;
                    white-space: pre-wrap;
                    word-break: break-all;
                }
                #task-logs-modal-backdrop {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.7);
                    z-index: 2999;
                }
                .task-logs-close {
                    position: absolute;
                    top: 10px;
                    right: 15px;
                    color: #fff;
                    font-size: 24px;
                    cursor: pointer;
                }
                #task-list {
                    background: rgba(0, 0, 0, 0.4);
                    border-top: 1px solid rgba(0, 255, 204, 0.2);
                    padding: 15px 20px;
                    font-family: 'VT323', monospace;
                    color: #fff;
                    font-size: 16px;
                    display: none;
                    flex-direction: column;
                    gap: 10px;
                    order: 2; /* Position it between messages and input or after messages */
                }
            `;
            document.head.appendChild(style);
        }

        const taskList = document.createElement('div');
        taskList.id = 'task-list';
        taskList.innerHTML = `
            <div style="color: #00ffcc; font-size: 18px; border-bottom: 1px solid rgba(0, 255, 204, 0.2); padding-bottom: 8px; margin-bottom: 5px;">
                🤖 AI Working...
            </div>
            <div id="task-items"></div>
        `;

        // Append to chat panel instead of document.body
        if (this.chatPanel) {
            // Insert before the input container
            const inputContainer = this.chatPanel.querySelector('.chat-input-container');
            if (inputContainer) {
                this.chatPanel.insertBefore(taskList, inputContainer);
            } else {
                this.chatPanel.appendChild(taskList);
            }
        } else {
            document.body.appendChild(taskList);
        }

        // Suggestions Container
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.id = 'chat-suggestions';
        suggestionsDiv.style.cssText = `
            display: flex; gap: 8px; padding: 10px; overflow-x: auto;
            white-space: nowrap; scrollbar-width: none;
            border-top: 1px solid rgba(0, 255, 204, 0.2);
            background: rgba(0, 0, 0, 0.2);
        `;
        // Insert before input container, but after task list (or before it? Order implies tasks above suggestions usually)
        // Let's put it above the input container
        if (this.chatPanel) {
            const inputContainer = this.chatPanel.querySelector('.chat-input-container');
            if (inputContainer) {
                this.chatPanel.insertBefore(suggestionsDiv, inputContainer);
            } else {
                this.chatPanel.appendChild(suggestionsDiv);
            }
        }
        this.suggestionsDiv = suggestionsDiv;

        this.taskListDiv = taskList;
        this.taskItemsDiv = taskList.querySelector('#task-items');
    }

    updateVoiceStatus(active, text) {
        // Ensure UI exists
        if (!this.statusDiv) this.createStatusIndicator();

        this.voiceIndicator.style.background = active ? '#00ff00' : '#333';
        if (!active && text === 'Error') {
            this.voiceIndicator.style.background = '#ff0000';
        }
        this.statusText.textContent = text;
    }

    addTask(name, backendTaskId = null) {
        if (!this.taskListDiv) this.createTaskListUI();

        const taskId = 'task-' + Date.now();
        const taskEl = document.createElement('div');
        taskEl.id = taskId;
        taskEl.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 5px 0;';
        taskEl.innerHTML = `
            <div class="task-spinner"></div>
            <span style="flex: 1;">${name}</span>
            <button class="task-logs-btn" data-backend-id="${backendTaskId || ''}">Logs</button>
        `;

        // Add click handler for logs button
        const logsBtn = taskEl.querySelector('.task-logs-btn');
        logsBtn.addEventListener('click', () => this.showTaskLogs(backendTaskId));

        // Add cancel button if it's a backend task
        if (backendTaskId) {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'task-logs-btn'; // reuse style
            cancelBtn.style.marginLeft = '5px';
            cancelBtn.style.color = '#ff6666';
            cancelBtn.style.borderColor = '#ff6666';
            cancelBtn.style.background = 'rgba(255, 100, 100, 0.1)';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.addEventListener('click', () => this.cancelTask(taskId, backendTaskId));
            taskEl.appendChild(cancelBtn);
        }

        this.taskItemsDiv.appendChild(taskEl);
        this.tasks.push({ id: taskId, name, status: 'working', backendTaskId });
        this.taskListDiv.style.display = 'flex';
        return taskId;
    }

    async cancelTask(uiTaskId, backendTaskId) {
        if (!confirm('Are you sure you want to stop this task?')) return;

        try {
            await fetch('/api/god-mode/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: backendTaskId })
            });
            // The polling loop will eventually catch the 'cancelled' status (Or we can update UI immediately)
            this.updateTask(uiTaskId, 'error', 'Cancelling...');
        } catch (e) {
            console.error('Failed to cancel task:', e);
            alert('Failed to cancel task');
        }
    }

    async showTaskLogs(backendTaskId) {
        if (!backendTaskId) {
            this.displayLogsModal('No logs available - backend task ID not found.', null);
            return;
        }

        // Start polling and display modal
        this.displayLogsModal('Loading logs...', backendTaskId);
    }

    async fetchAndUpdateLogs(backendTaskId) {
        const modal = document.getElementById('task-logs-modal');
        if (!modal) return null; // Modal was closed

        try {
            const res = await fetch(`/api/god-mode/task/${backendTaskId}`);
            const data = await res.json();

            let logsText;
            if (data.status === 'not_found') {
                logsText = `Task ID: ${backendTaskId}\nStatus: Not Found (Expired or Server Restarted)\n`;
            } else {
                logsText = `Task ID: ${backendTaskId}\nStatus: ${data.status}\n`;
                if (data.startTime) {
                    const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
                    logsText += `Elapsed: ${elapsed}s\n`;
                }
                logsText += `\n--- LOGS ---\n${data.logs || 'No output yet...'}\n`;
                if (data.error) {
                    logsText += `\n--- ERROR ---\n${data.error}\n`;
                }
                if (data.message) {
                    logsText += `\n--- MESSAGE ---\n${data.message}\n`;
                }
            }

            // Update modal content
            const preEl = modal.querySelector('pre');
            if (preEl) {
                preEl.textContent = logsText;
                // Auto-scroll to bottom
                modal.scrollTop = modal.scrollHeight;
            }

            return data.status; // Return status so we know if task is done
        } catch (e) {
            const preEl = modal?.querySelector('pre');
            if (preEl) {
                preEl.textContent = `Failed to fetch logs: ${e.message}`;
            }
            return 'error';
        }
    }

    displayLogsModal(initialText, backendTaskId) {
        // Clear any existing polling interval
        if (this.logsPollingInterval) {
            clearInterval(this.logsPollingInterval);
            this.logsPollingInterval = null;
        }

        // Remove existing modal if present
        const existing = document.getElementById('task-logs-modal');
        const existingBackdrop = document.getElementById('task-logs-modal-backdrop');
        if (existing) existing.remove();
        if (existingBackdrop) existingBackdrop.remove();

        const closeModal = () => {
            // Stop polling when modal closes
            if (this.logsPollingInterval) {
                clearInterval(this.logsPollingInterval);
                this.logsPollingInterval = null;
            }
            modal.remove();
            backdrop.remove();
        };

        const backdrop = document.createElement('div');
        backdrop.id = 'task-logs-modal-backdrop';
        backdrop.addEventListener('click', closeModal);

        const modal = document.createElement('div');
        modal.id = 'task-logs-modal';
        modal.innerHTML = `
            <span class="task-logs-close">&times;</span>
            <h3 style="margin-top: 0; color: #00ffcc;">Task Logs ${backendTaskId ? '<span style="font-size: 12px; color: #666;">(auto-refreshing)</span>' : ''}</h3>
            <pre style="margin: 0;">${this.escapeHTML(initialText)}</pre>
        `;

        modal.querySelector('.task-logs-close').addEventListener('click', closeModal);

        document.body.appendChild(backdrop);
        document.body.appendChild(modal);

        // Start polling if we have a backend task ID
        if (backendTaskId) {
            // Fetch immediately
            this.fetchAndUpdateLogs(backendTaskId);

            // Then poll every 2 seconds
            this.logsPollingInterval = setInterval(async () => {
                const status = await this.fetchAndUpdateLogs(backendTaskId);
                // Keep polling even if done so user can see final state
                // They can close the modal when they're ready
            }, 2000);
        }
    }

    updateTask(taskId, status, message) {
        console.log('[UIManager] updateTask called:', { taskId, status, message });
        const taskEl = document.getElementById(taskId);
        if (!taskEl) {
            console.warn('[UIManager] Task element not found:', taskId);
            return;
        }
        console.log('[UIManager] Found task element, updating to status:', status);

        const task = this.tasks.find(t => t.id === taskId);
        if (task) task.status = status;

        if (status === 'done') {
            taskEl.innerHTML = `
                <span class="task-done">✓</span>
                <span class="task-done">${message || task?.name || 'Complete'}</span>
            `;
            taskEl.innerHTML = `
                <span class="task-error">✗</span>
                <span class="task-error">${message || 'Error'}</span>
            `;
        } else if (status === 'cancelled') {
            taskEl.innerHTML = `
                <span class="task-error">🛑</span>
                <span class="task-error">Cancelled</span>
            `;
        }

        // Hide task list after all tasks complete (with delay)
        const allDone = this.tasks.every(t => t.status === 'done' || t.status === 'error');
        if (allDone) {
            setTimeout(() => {
                if (this.taskListDiv) this.taskListDiv.style.display = 'none';
                if (this.taskItemsDiv) this.taskItemsDiv.innerHTML = '';
                this.tasks = [];
            }, 3000);
        }
    }

    /**
     * Show a prominent refresh prompt when changes require browser reload
     */
    showRefreshPrompt() {
        // Remove existing prompt if any
        const existing = document.getElementById('refresh-prompt');
        if (existing) existing.remove();

        const prompt = document.createElement('div');
        prompt.id = 'refresh-prompt';
        prompt.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, rgba(20, 20, 40, 0.95), rgba(40, 20, 60, 0.95));
            border: 2px solid #ff9900;
            border-radius: 16px;
            padding: 30px 40px;
            z-index: 3000;
            text-align: center;
            font-family: 'VT323', monospace;
            box-shadow: 0 0 30px rgba(255, 153, 0, 0.3);
            animation: pulse-glow 2s ease-in-out infinite;
        `;

        prompt.innerHTML = `
            <style>
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 30px rgba(255, 153, 0, 0.3); }
                    50% { box-shadow: 0 0 50px rgba(255, 153, 0, 0.5); }
                }
            </style>
            <div style="font-size: 48px; margin-bottom: 15px;">🔄</div>
            <h2 style="color: #ff9900; margin: 0 0 10px 0; font-size: 28px;">Refresh Required</h2>
            <p style="color: #ccc; margin: 0 0 20px 0; font-size: 18px;">
                Some changes require a browser refresh to take effect.
            </p>
            <button id="refresh-now-btn" style="
                background: linear-gradient(135deg, #ff9900, #ff6600);
                border: none;
                color: white;
                padding: 12px 30px;
                font-size: 20px;
                font-family: 'VT323', monospace;
                border-radius: 8px;
                cursor: pointer;
                margin-right: 10px;
                transition: all 0.2s;
            ">Refresh Now</button>
            <button id="refresh-later-btn" style="
                background: transparent;
                border: 1px solid #666;
                color: #aaa;
                padding: 12px 20px;
                font-size: 18px;
                font-family: 'VT323', monospace;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
            ">Later</button>
        `;

        document.body.appendChild(prompt);

        // Button handlers
        document.getElementById('refresh-now-btn').onclick = () => {
            window.location.reload();
        };

        document.getElementById('refresh-later-btn').onclick = () => {
            prompt.remove();
        };

        // Auto-dismiss after 30 seconds
        setTimeout(() => {
            if (document.getElementById('refresh-prompt')) {
                prompt.remove();
            }
        }, 30000);
    }






    setupChatListener() {
        const chatBtn = document.getElementById('chat-button');
        if (chatBtn) {
            chatBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.game.agent) {
                    this.game.agent.toggleChat();
                }
            });
        }
    }

    setupChatPanelListeners() {
        if (!this.chatPanel) return;

        this.stopBtn = document.getElementById('stop-generation-btn');
        this.stopContainer = document.getElementById('chat-stop-container');

        this.sendBtn.addEventListener('click', () => this.handleSendMessage());
        this.closeBtn.addEventListener('click', () => {
            if (this.game.agent) this.game.agent.toggleChat();
        });

        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => {
                if (this.game.agent) this.game.agent.interruptGeneration();
            });
        }

        if (this.copyChatBtn) {
            this.copyChatBtn.onclick = () => this.copyChatToClipboard();
        }

        if (this.chatInput) {
            this.chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.handleSendMessage();
                }
            });
        }

        // Smart Auto-scroll Listener
        if (this.chatMessages) {
            this.chatMessages.addEventListener('scroll', () => {
                const threshold = 20;
                // If user is scrolled up more than 'threshold' pixels from the bottom
                const isAtBottom = this.chatMessages.scrollHeight - this.chatMessages.scrollTop - this.chatMessages.clientHeight < threshold;
                this.userHasScrolledUp = !isAtBottom;
            });
        }
    }

    copyChatToClipboard() {
        if (!this.chatMessages) return;

        let conversationText = "";
        const messages = this.chatMessages.querySelectorAll('.message');

        messages.forEach(msg => {
            const content = msg.querySelector('.message-content').innerText;
            const isUser = msg.classList.contains('user');
            const isAI = msg.classList.contains('ai');
            const isSystem = msg.classList.contains('system');

            if (isUser) conversationText += `User: ${content}\n`;
            else if (isAI) conversationText += `AI: ${content}\n`;
            else if (isSystem) conversationText += `System: ${content}\n`;
            else conversationText += `${content}\n`;
        });

        navigator.clipboard.writeText(conversationText).then(() => {
            const originalText = this.copyChatBtn.innerHTML;
            this.copyChatBtn.innerHTML = "✓";
            setTimeout(() => {
                if (this.copyChatBtn) this.copyChatBtn.innerHTML = originalText;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy chat:', err);
        });
    }

    toggleStopButton(visible) {
        if (this.stopContainer) {
            this.stopContainer.style.display = visible ? 'flex' : 'none';
        }
    }

    createEscapeRoomUI() {
        const div = document.createElement('div');
        div.id = 'escape-room-ui';
        div.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: #fff;
            padding: 10px 20px;
            border-radius: 8px;
            font-family: 'VT323', monospace;
            font-size: 24px;
            text-align: center;
            border: 2px solid #ff3333;
            display: none;
            z-index: 1000;
        `;
        div.innerHTML = `
            <div style="color: #ff3333; font-size: 16px; margin-bottom: 5px;">ESCAPE ROOM</div>
            <div id="escape-timer" style="font-size: 32px; color: #ff0000; font-weight: bold;">00:00</div>
            <div style="font-size: 14px; color: #ccc;">Find the Golden Block!</div>
        `;
        document.body.appendChild(div);
        this.escapeRoomUI = div;
        this.escapeTimer = div.querySelector('#escape-timer');
    }

    showEscapeRoomUI(visible) {
        if (this.escapeRoomUI) {
            this.escapeRoomUI.style.display = visible ? 'block' : 'none';
        }
    }

    updateEscapeRoomUI(timeLeft) {
        if (this.escapeTimer) {
            this.escapeTimer.textContent = this.formatTime(timeLeft);
            if (timeLeft <= 10) {
                this.escapeTimer.style.color = (timeLeft % 2 === 0) ? '#ff0000' : '#ffff00'; // Flash
            } else {
                this.escapeTimer.style.color = '#ff0000';
            }
        }
    }

    formatTime(seconds) {
        if (seconds < 0) seconds = 0;
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }


    handleSendMessage() {
        const text = this.chatInput.value.trim();
        if (text && this.game.agent) {
            this.game.agent.sendTextMessage(text);
            this.chatInput.value = '';
            // Clear suggestions on sending a message? Maybe desirable.
            this.clearSuggestions();

            // Force scroll to bottom when user sends a message
            if (this.chatMessages) {
                this.userHasScrolledUp = false;
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            }
        }
    }

    showSuggestions(suggestions) {
        if (!this.suggestionsDiv) return;

        this.suggestionsDiv.innerHTML = '';
        this.suggestionsDiv.style.display = 'flex';

        suggestions.forEach(text => {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.style.cssText = `
        background: rgba(0, 255, 204, 0.1);
        border: 1px solid #00ffcc;
        color: #00ffcc;
        padding: 5px 10px;
        border-radius: 15px;
        cursor: pointer;
        font-family: 'VT323', monospace;
        font-size: 14px;
        transition: all 0.2s;
        `;
            btn.onmouseover = () => btn.style.background = 'rgba(0, 255, 204, 0.3)';
            btn.onmouseout = () => btn.style.background = 'rgba(0, 255, 204, 0.1)';

            btn.onclick = () => {
                if (this.game.agent) {
                    this.game.agent.sendTextMessage(text);
                    this.clearSuggestions();
                }
            };
            this.suggestionsDiv.appendChild(btn);
        });

        // Auto-scroll chat to make room if needed? 
        // The flex container handles itself.
    }

    clearSuggestions() {
        if (this.suggestionsDiv) {
            this.suggestionsDiv.innerHTML = '';
            this.suggestionsDiv.style.display = 'none';
        }
    }

    addChatMessage(sender, text) {
        if (!this.chatMessages) return null;

        const msgId = 'chat-msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        const msgDiv = document.createElement('div');
        msgDiv.id = msgId;
        msgDiv.className = `message ${sender}`;
        msgDiv.innerHTML = `<div class="message-content">${this.escapeHTML(text)}</div>`;
        this.chatMessages.appendChild(msgDiv);

        // Auto-scroll only if user hasn't scrolled up
        if (!this.userHasScrolledUp) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }

        return msgId;
    }

    updateChatMessageContent(msgId, text) {
        if (!msgId) return;
        const msgDiv = document.getElementById(msgId);
        if (msgDiv) {
            const contentDiv = msgDiv.querySelector('.message-content');
            if (contentDiv) {
                contentDiv.innerHTML = this.escapeHTML(text);
                // Auto-scroll to show latest content only if user hasn't scrolled up
                if (this.chatMessages && !this.userHasScrolledUp) {
                    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                }
            }
        }
    }

    removeChatMessage(msgId) {
        if (!msgId) return;
        const msgDiv = document.getElementById(msgId);
        if (msgDiv) {
            msgDiv.remove();
        }
    }

    getLastAiMessage() {
        if (!this.chatMessages) return null;
        const messages = this.chatMessages.getElementsByClassName('message ai');
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            return lastMsg.textContent.trim();
        }
        return null;
    }

    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    toggleChatPanel(show) {
        if (!this.chatPanel) return;

        if (show) {
            this.chatPanel.classList.remove('hidden');
        } else {
            this.chatPanel.classList.add('hidden');
            this.chatInput.blur();
        }
    }

    focusChatInput() {
        if (this.chatInput) {
            this.chatInput.focus();
        }
    }

    blurChatInput() {
        if (this.chatInput) {
            this.chatInput.blur();
        }
    }

    updateChatModeIndicator(isTypingMode) {
        // Create or update a small indicator showing current mode
        if (!this.chatModeIndicator) {
            const indicator = document.createElement('div');
            indicator.id = 'chat-mode-indicator';
            indicator.style.cssText = `
        position: absolute;
        top: 8px;
        right: 50px;
        padding: 4px 8px;
        border-radius: 4px;
        font-family: 'VT323', monospace;
        font-size: 14px;
        z-index: 1001;
        `;
            if (this.chatPanel) {
                this.chatPanel.style.position = 'relative'; // Ensure positioning works
                this.chatPanel.appendChild(indicator);
            }
            this.chatModeIndicator = indicator;
        }

        if (isTypingMode) {
            this.chatModeIndicator.textContent = '💬 Typing (Tab to move)';
            this.chatModeIndicator.style.background = 'rgba(0, 255, 204, 0.3)';
            this.chatModeIndicator.style.color = '#00ffcc';
        } else {
            this.chatModeIndicator.textContent = '🎮 Moving (Tab to type)';
            this.chatModeIndicator.style.background = 'rgba(255, 200, 0, 0.3)';
            this.chatModeIndicator.style.color = '#ffc800';
        }
    }

    removeChatModeIndicator() {
        if (this.chatModeIndicator) {
            this.chatModeIndicator.remove();
            this.chatModeIndicator = null;
        }
    }

    toggleDebugPanel() {
        if (this.debugPanel) {
            this.debugPanel.toggle();
            return this.debugPanel.isVisible;
        }
        return false;
    }

    /**
     * Update FPS counter (call every frame, updates display once per second)
     */
    updateFPS() {
        this.frameCount++;
        const now = performance.now();

        if (now - this.lastFpsUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = now;

            if (this.fpsElement) {
                this.fpsElement.textContent = this.fps;
            }

            if (this.fpsCounter) {
                this.fpsCounter.classList.remove('low', 'medium');
                if (this.fps < 30) {
                    this.fpsCounter.classList.add('low');
                } else if (this.fps < 50) {
                    this.fpsCounter.classList.add('medium');
                }
            }
        }
    }

    /**
     * Update player position display
     * @param {THREE.Vector3} pos - Player position
     */
    updatePosition(pos) {
        if (this.positionElement) {
            this.positionElement.textContent =
                `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
        }
    }

    /**
     * Update block count display
     * @param {number} count - Number of blocks
     */
    updateBlockCount(count) {
        if (this.blockCountElement) {
            this.blockCountElement.textContent = count;
        }
        if (this.debugPanel) this.debugPanel.updateStats();
    }

    // --- Dialogue System ---

    createDialogueBox() {
        if (this.dialogueBox) return;

        const div = document.createElement('div');
        div.className = 'dialogue-box';
        div.innerHTML = `
            <div class="dialogue-close">✕</div>
            <h3 id="dialogue-speaker">Speaker</h3>
            <p id="dialogue-text">...</p>
        `;
        document.body.appendChild(div);

        div.querySelector('.dialogue-close').addEventListener('click', () => {
            this.hideDialogue();
        });

        this.dialogueBox = div;
        this.dialogueSpeaker = div.querySelector('#dialogue-speaker');
        this.dialogueText = div.querySelector('#dialogue-text');
    }

    showDialogue(speaker, text) {
        if (!this.dialogueBox) this.createDialogueBox();

        this.dialogueSpeaker.textContent = speaker;
        this.dialogueText.textContent = text;
        this.dialogueBox.style.display = 'block';

        // Auto hide after 5 seconds if not interactive? 
        // For now, let user close it or clicking away closes it.
        // Or simply overwrite if new dialogue comes.
    }

    hideDialogue() {
        if (this.dialogueBox) {
            this.dialogueBox.style.display = 'none';
        }
    }

    // --- Speech Bubbles ---

    addSpeechBubble(entity, text, duration = 3000) {
        // Remove existing bubble for this entity if any
        this.removeSpeechBubble(entity);

        const bubble = document.createElement('div');
        bubble.className = 'speech-bubble';
        bubble.textContent = text;
        document.body.appendChild(bubble);

        const bubbleData = {
            element: bubble,
            entity: entity,
            timer: duration
        };

        if (!this.speechBubbles) this.speechBubbles = [];
        this.speechBubbles.push(bubbleData);
    }

    removeSpeechBubble(entity) {
        if (!this.speechBubbles) return;
        const idx = this.speechBubbles.findIndex(b => b.entity === entity);
        if (idx !== -1) {
            const b = this.speechBubbles[idx];
            b.element.remove();
            this.speechBubbles.splice(idx, 1);
        }
    }

    update(dt) {
        if (this.speechBubbles) {
            // Update bubble positions
            const camera = this.game.camera;
            const width = window.innerWidth;
            const height = window.innerHeight;
            const widthHalf = width / 2;
            const heightHalf = height / 2;

            for (let i = this.speechBubbles.length - 1; i >= 0; i--) {
                const b = this.speechBubbles[i];
                b.timer -= dt * 1000;

                if (b.timer <= 0) {
                    b.element.remove();
                    this.speechBubbles.splice(i, 1);
                    continue;
                }

                if (!b.entity || b.entity.isDead || !b.entity.mesh.parent) {
                    b.element.remove();
                    this.speechBubbles.splice(i, 1);
                    continue;
                }

                // Project position
                const pos = new THREE.Vector3().copy(b.entity.position);
                pos.y += b.entity.height + 0.5; // Above head

                pos.project(camera);

                // Check if behind camera
                if (pos.z > 1) {
                    b.element.style.display = 'none';
                } else {
                    b.element.style.display = 'block';
                    const x = (pos.x * widthHalf) + widthHalf;
                    const y = -(pos.y * heightHalf) + heightHalf;

                    b.element.style.left = `${x} px`;
                    b.element.style.top = `${y} px`;
                }
            }
        }
    }

    // --- Omni Wand Spell Selector ---

    createSpellSelector() {
        if (this.spellSelector) return;
        const div = document.createElement('div');
        div.id = 'spell-selector';
        div.style.cssText = `
        position: fixed; right: 20px; top: 50%; transform: translateY(-50%);
        background: rgba(0, 0, 0, 0.7);
        border: 2px solid #a0522d;
        border-radius: 8px;
        padding: 10px;
        color: white;
        font-family: monospace;
        display: none;
        flex-direction: column;
        gap: 5px;
        min-width: 150px;
        z-index: 1000;
        `;
        document.body.appendChild(div);
        this.spellSelector = div;
    }

    updateSpellSelector(spells, currentIndex) {
        if (!this.spellSelector) this.createSpellSelector();
        this.spellSelector.innerHTML = '';

        // Header
        const title = document.createElement('div');
        title.textContent = 'Spells (Press R)';
        title.style.cssText = 'text-align: center; border-bottom: 1px solid #777; margin-bottom: 5px; padding-bottom: 5px; color: #ffd700; font-weight: bold;';
        this.spellSelector.appendChild(title);

        if (!spells || spells.length === 0) {
            const el = document.createElement('div');
            el.textContent = "No spells";
            el.style.color = "#aaa";
            this.spellSelector.appendChild(el);
            return;
        }

        spells.forEach((spell, index) => {
            const el = document.createElement('div');
            el.textContent = spell.name;
            el.style.cssText = `
        padding: 5px;
        background: ${index === currentIndex ? 'rgba(255, 215, 0, 0.3)' : 'transparent'};
        border: 1px solid ${index === currentIndex ? '#ffd700' : 'transparent'};
        border-radius: 4px;
        `;
            if (index === currentIndex) {
                el.textContent = '> ' + spell.name;
            }
            this.spellSelector.appendChild(el);
        });
    }

    toggleSpellSelector(show) {
        if (!this.spellSelector && show) this.createSpellSelector();
        if (this.spellSelector) {
            this.spellSelector.style.display = show ? 'flex' : 'none';
        }
    }
    // --- Spell Creator UI ---

    createSpellCreator() {
        if (this.spellCreatorDiv) return;

        const div = document.createElement('div');
        div.id = 'spell-creator';
        div.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9); padding: 20px; border-radius: 8px;
        border: 2px solid #a020f0; color: #fff; font-family: 'VT323', monospace;
        text-align: center; z-index: 2500; display: none; min-width: 300px;
        `;

        div.innerHTML = `
            <h2 style="color: #d050ff; margin-top: 0;">Spell Creator</h2>
            <div style="margin-bottom: 15px; text-align: left; font-size: 14px; color: #aaa;">
                Keywords: levitate, damage, fire, push, self, ray
            </div>
            <input type="text" id="spell-input" placeholder="e.g. 'fireball damage'" 
                style="width: 100%; padding: 8px; font-family: inherit; font-size: 16px; margin-bottom: 15px; background: #222; color: #fff; border: 1px solid #555;">
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="spell-create-btn" style="padding: 8px 16px; background: #a020f0; color: white; border: none; cursor: pointer;">Craft Spell</button>
                <button id="spell-cancel-btn" style="padding: 8px 16px; background: #555; color: white; border: none; cursor: pointer;">Cancel</button>
            </div>
        `;

        document.body.appendChild(div);

        this.spellCreatorDiv = div;
        this.spellInput = div.querySelector('#spell-input');

        // Handlers
        div.querySelector('#spell-create-btn').onclick = () => this.handleCreateSpell();
        div.querySelector('#spell-cancel-btn').onclick = () => this.closeSpellCreator();

        this.spellInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleCreateSpell();
            if (e.key === 'Escape') this.closeSpellCreator();
        });
    }

    openSpellCreator(wandItem) {
        if (!this.spellCreatorDiv) this.createSpellCreator();

        this.currentWandItem = wandItem;
        this.spellCreatorDiv.style.display = 'block';
        this.spellInput.value = '';
        this.spellInput.focus();

        // Unlock pointer
        this.game.inputManager.unlock();
        this.game.gameState.flags.inventoryOpen = true; // Use this flag to prevent other inputs
    }

    closeSpellCreator() {
        if (this.spellCreatorDiv) {
            this.spellCreatorDiv.style.display = 'none';
        }
        this.currentWandItem = null;
        this.game.gameState.flags.inventoryOpen = false;

        // Lock pointer back if we click on game, but user usually clicks to lock.
        // We can try to auto-lock if they were playing? 
        // Better to let them click to resume.
    }

    handleCreateSpell() {
        if (!this.currentWandItem) return;

        const text = this.spellInput.value.trim();
        if (!text) return;

        // Use AI to create the spell
        if (this.game.agent) {
            const prompt = `Create a new spell for the OmniWandItem.js based on this description: "${text}". Add it to the default spells list in the constructor.`;
            this.game.agent.sendTextMessage(prompt);
            this.closeSpellCreator();
            this.addChatMessage('system', 'Request sent to AI Agent...');
        } else {
            console.error("No agent found");
            this.addChatMessage('system', "Error: AI Agent not found.");
        }
    }

    // --- Death Screen ---

    createDeathScreen() {
        if (this.deathScreen) return;

        const screen = document.createElement('div');
        screen.id = 'death-screen';
        screen.className = 'hidden';
        screen.innerHTML = `
            <div class="death-title">YOU DIED</div>
            <div class="death-subtitle">Your adventure has come to an end...</div>
            <button class="death-restart-btn" id="respawn-btn">RESPAWN</button>
            <div class="death-hint">Press [SPACE] or click to respawn</div>
        `;

        document.body.appendChild(screen);
        this.deathScreen = screen;

        // Respawn button click handler
        const respawnBtn = screen.querySelector('#respawn-btn');
        respawnBtn.addEventListener('click', () => this.handleRespawn());

        // Keyboard handler for space to respawn
        this.deathKeyHandler = (e) => {
            if (e.code === 'Space' && this.deathScreen && !this.deathScreen.classList.contains('hidden')) {
                e.preventDefault();
                this.handleRespawn();
            }
        };
        document.addEventListener('keydown', this.deathKeyHandler);
    }

    showDeathScreen() {
        if (!this.deathScreen) this.createDeathScreen();

        this.deathScreen.classList.remove('hidden');
        // Force a reflow to restart animation
        this.deathScreen.offsetHeight;

        // Unlock pointer so player can click the button
        if (this.game.inputManager) {
            this.game.inputManager.unlock();
        }
    }

    hideDeathScreen() {
        if (this.deathScreen) {
            this.deathScreen.classList.add('hidden');
        }
    }

    handleRespawn() {
        this.hideDeathScreen();

        if (this.game.player) {
            this.game.player.respawn();
        }

        // Re-lock pointer for gameplay
        if (this.game.inputManager) {
            this.game.inputManager.lock();
        }
    }

    createSignInputUI() {
        if (this.signInputOverlay) return;

        const overlay = document.createElement('div');
        overlay.id = 'sign-input-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); display: none;
            justify-content: center; align-items: center; z-index: 5000;
        `;

        const container = document.createElement('div');
        container.style.cssText = `
            background: #6F4E37; border: 4px solid #3B2A1D;
            padding: 20px; border-radius: 8px; width: 400px;
            display: flex; flex-direction: column; gap: 15px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        `;

        const title = document.createElement('div');
        title.textContent = 'Edit Sign Message';
        title.style.cssText = `color: #fff; font-family: 'Minecraft', monospace; font-size: 20px; text-align: center;`;

        const input = document.createElement('textarea');
        input.id = 'sign-text-input';
        input.maxLength = 50;
        input.placeholder = 'Enter text...';
        input.style.cssText = `
            width: 100%; height: 100px; padding: 10px;
            font-family: 'Minecraft', monospace; font-size: 16px;
            background: #3B2A1D; color: #fff; border: none; outline: none; resize: none;
        `;

        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = `display: flex; justify-content: space-between; gap: 10px;`;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `flex: 1; padding: 8px; cursor: pointer; background: #cc4444; color: white; border: none; font-family: inherit;`;

        const doneBtn = document.createElement('button');
        doneBtn.textContent = 'Done';
        doneBtn.style.cssText = `flex: 1; padding: 8px; cursor: pointer; background: #44cc44; color: white; border: none; font-family: inherit;`;

        btnContainer.appendChild(cancelBtn);
        btnContainer.appendChild(doneBtn);
        container.appendChild(title);
        container.appendChild(input);
        container.appendChild(btnContainer);
        overlay.appendChild(container);

        document.body.appendChild(overlay);
        this.signInputOverlay = overlay;
        this.signTextInput = input;

        // Handlers
        this.onSignSubmit = null;

        doneBtn.onclick = () => {
            const text = this.signTextInput.value;
            this.toggleSignInput(false);
            if (this.onSignSubmit) this.onSignSubmit(text); // Return text
            this.game.inputManager.lock();
        };

        cancelBtn.onclick = () => {
            this.toggleSignInput(false);
            if (this.onSignSubmit) this.onSignSubmit(null); // Cancelled
            this.game.inputManager.lock();
        };
    }

    showSignInput(callback, initialText = '') {
        if (!this.signInputOverlay) this.createSignInputUI();
        this.signTextInput.value = initialText;
        this.onSignSubmit = callback;
        this.toggleSignInput(true);
        this.game.inputManager.unlock();
        setTimeout(() => this.signTextInput.focus(), 50);
    }

    toggleSignInput(show) {
        if (this.signInputOverlay) {
            this.signInputOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    // --- Survival Mini-Game UI ---

    createSurvivalUI() {
        if (this.survivalOverlay) return;

        const overlay = document.createElement('div');
        overlay.id = 'survival-ui';
        overlay.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            display: none;
            flex-direction: column;
            align-items: center;
            z-index: 1500;
            pointer-events: none;
        `;

        overlay.innerHTML = `
            <div id="survival-timer" style="
                font-family: 'VT323', monospace;
                font-size: 48px;
                color: #ff3333;
                text-shadow: 0 0 10px rgba(255, 51, 51, 0.8), 2px 2px 0 #000;
            ">00:00</div>
            <div id="survival-wave" style="
                font-family: 'VT323', monospace;
                font-size: 24px;
                color: #ffffff;
                text-shadow: 1px 1px 0 #000;
                margin-top: 5px;
            ">Wave 1</div>
            <div style="
                font-family: 'VT323', monospace;
                font-size: 14px;
                color: #ffcc00;
                margin-top: 10px;
            ">☠️ SURVIVAL MODE ☠️</div>
        `;

        document.body.appendChild(overlay);
        this.survivalOverlay = overlay;
        this.survivalTimer = overlay.querySelector('#survival-timer');
        this.survivalWave = overlay.querySelector('#survival-wave');
    }

    updateSurvivalUI(seconds, wave) {
        if (!this.survivalOverlay) this.createSurvivalUI();

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        this.survivalTimer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        this.survivalWave.textContent = `Wave ${wave}`;
    }

    showSurvivalUI(show) {
        if (!this.survivalOverlay) this.createSurvivalUI();
        console.log('[SurvivalUI] show:', show, 'overlay:', this.survivalOverlay);
        if (this.survivalOverlay) {
            this.survivalOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    showHighscoreBoard(scores, currentScore) {
        // Remove existing modal
        const existing = document.getElementById('highscore-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'highscore-modal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, rgba(40, 20, 20, 0.95), rgba(60, 20, 20, 0.95));
            border: 3px solid #ff3333;
            border-radius: 16px;
            padding: 30px 40px;
            z-index: 3000;
            text-align: center;
            font-family: 'VT323', monospace;
            box-shadow: 0 0 40px rgba(255, 51, 51, 0.5);
            min-width: 320px;
        `;

        const formatTime = (s) => {
            const m = Math.floor(s / 60);
            const sec = Math.floor(s % 60);
            return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        };

        let scoresHtml = '';
        const topScores = scores.slice(0, 5);
        topScores.forEach((entry, i) => {
            const isNew = Math.abs(entry.time - currentScore) < 0.1;
            scoresHtml += `
                <div style="
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(255, 51, 51, 0.3);
                    ${isNew ? 'background: rgba(255, 215, 0, 0.2); border-radius: 4px; padding: 8px;' : ''}
                ">
                    <span style="color: #ff6666;">#${i + 1}</span>
                    <span style="color: ${isNew ? '#ffd700' : '#fff'}; font-size: 20px;">${formatTime(entry.time)}</span>
                </div>
            `;
        });

        modal.innerHTML = `
            <div style="font-size: 36px; margin-bottom: 10px;">💀</div>
            <h2 style="color: #ff3333; margin: 0 0 5px 0; font-size: 32px;">GAME OVER</h2>
            <p style="color: #ccc; margin: 0 0 20px 0;">You survived ${formatTime(currentScore)}</p>
            <h3 style="color: #ffd700; margin: 0 0 10px 0; font-size: 20px;">🏆 HIGHSCORES 🏆</h3>
            <div style="margin-bottom: 20px;">
                ${scoresHtml || '<p style="color: #888;">No scores yet</p>'}
            </div>
            <button id="highscore-close" style="
                background: linear-gradient(135deg, #ff3333, #cc2222);
                border: none;
                color: white;
                padding: 12px 30px;
                font-size: 18px;
                font-family: 'VT323', monospace;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
            ">RESPAWN</button>
        `;

        document.body.appendChild(modal);

        document.getElementById('highscore-close').onclick = () => {
            modal.remove();
        };

        // Unlock pointer for button
        if (this.game.inputManager) {
            this.game.inputManager.unlock();
        }
    }

    stopAllXboxGames() {
        this.stopXboxPlatformer();
        this.stopXboxJoust();
        this.stopXboxSnake();
        this.stopXboxBrickBreaker();
        this.stopXboxInvaders();
    }

    startXboxSnake() {
        this.stopAllXboxGames();

        const canvas = document.getElementById('xbox-canvas');
        if (!canvas) return;

        const menuDiv = document.getElementById('xbox-menu');
        const hintDiv = document.getElementById('xbox-controls-hint');
        if (menuDiv) menuDiv.style.display = 'none';
        if (hintDiv) {
            hintDiv.innerHTML = `<b style="color: #fff;">WASD / Arrows</b> Move | Eat <b style="color: #00ff00;">Green</b> Food`;
        }

        canvas.style.display = 'block';
        const gameOverDiv = document.getElementById('xbox-game-over');
        gameOverDiv.style.display = 'none';

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

    startXboxBrickBreaker() {
        this.stopAllXboxGames();

        const canvas = document.getElementById('xbox-canvas');
        if (!canvas) return;

        const menuDiv = document.getElementById('xbox-menu');
        const hintDiv = document.getElementById('xbox-controls-hint');
        if (menuDiv) menuDiv.style.display = 'none';
        if (hintDiv) {
            hintDiv.innerHTML = `<b style="color: #fff;">A / D</b> Move Paddle | Clear all <b style="color: #ffd700;">Bricks</b>`;
        }

        canvas.style.display = 'block';
        const gameOverDiv = document.getElementById('xbox-game-over');
        gameOverDiv.style.display = 'none';

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

    startXboxInvaders() {
        this.stopAllXboxGames();

        const canvas = document.getElementById('xbox-canvas');
        if (!canvas) return;

        const menuDiv = document.getElementById('xbox-menu');
        const hintDiv = document.getElementById('xbox-controls-hint');
        if (menuDiv) menuDiv.style.display = 'none';
        if (hintDiv) {
            hintDiv.innerHTML = `<b style="color: #fff;">A / D</b> Move | <b style="color: #fff;">Space</b> Shoot | Repel the <b style="color: #ff3333;">Invaders</b>`;
        }

        canvas.style.display = 'block';
        const gameOverDiv = document.getElementById('xbox-game-over');
        gameOverDiv.style.display = 'none';

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
            keys: {}
        };

        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 10; c++) {
                this.invadersState.enemies.push({ x: c * 45 + 50, y: r * 35 + 40, w: 30, h: 20 });
            }
        }

        const handleKeyDown = (e) => {
            if (!this.invadersState) return;
            this.invadersState.keys[e.code] = true;
            if (e.code === 'Space') {
                this.invadersState.bullets.push({ x: this.invadersState.player.x + 15, y: this.invadersState.player.y, r: 3 });
            }
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

    initTouchControls() {
        if (this.joystickContainer) return;
        // 1. Create Joystick
        this.joystickContainer = document.createElement('div');
        this.joystickContainer.id = 'touch-joystick';
        this.joystickContainer.style.cssText = `
            position: fixed;
            bottom: 40px;
            left: 40px;
            width: 150px;
            height: 150px;
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            z-index: 1000;
            touch-action: none;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        this.joystickKnob = document.createElement('div');
        this.joystickKnob.style.cssText = `
            width: 60px;
            height: 60px;
            background: rgba(255, 255, 255, 0.5);
            border-radius: 50%;
            transition: transform 0.1s ease;
            pointer-events: none;
        `;
        this.joystickContainer.appendChild(this.joystickKnob);
        document.body.appendChild(this.joystickContainer);

        // 2. Create Jump Button
        this.jumpBtn = document.createElement('div');
        this.jumpBtn.id = 'touch-jump';
        this.jumpBtn.innerText = 'JUMP';
        this.jumpBtn.style.cssText = `
            position: fixed;
            bottom: 40px;
            right: 40px;
            width: 80px;
            height: 80px;
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.4);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            z-index: 1000;
            touch-action: manipulation;
            user-select: none;
        `;
        document.body.appendChild(this.jumpBtn);

        // 3. Create Interact Button
        this.interactBtn = document.createElement('div');
        this.interactBtn.id = 'touch-interact';
        this.interactBtn.innerText = 'E';
        this.interactBtn.style.cssText = `
            position: fixed;
            bottom: 140px;
            right: 40px;
            width: 60px;
            height: 60px;
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.4);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            z-index: 1000;
            touch-action: manipulation;
            user-select: none;
        `;
        document.body.appendChild(this.interactBtn);

        // 4. Create Mobile Top Bar (Inventory, Debug, Chat buttons)
        this.mobileTopBar = document.createElement('div');
        this.mobileTopBar.id = 'mobile-top-bar';
        this.mobileTopBar.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 15px;
            z-index: 1000;
        `;

        // Inventory Button
        this.mobileInventoryBtn = document.createElement('div');
        this.mobileInventoryBtn.id = 'mobile-inventory-btn';
        this.mobileInventoryBtn.innerHTML = '📦';
        this.mobileInventoryBtn.style.cssText = `
            width: 50px;
            height: 50px;
            background: rgba(0, 0, 0, 0.6);
            border: 2px solid rgba(255, 255, 255, 0.4);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            touch-action: manipulation;
            user-select: none;
            cursor: pointer;
        `;
        this.mobileInventoryBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.game.toggleInventory();
        }, { passive: false });
        this.mobileInventoryBtn.addEventListener('click', () => {
            this.game.toggleInventory();
        });
        this.mobileTopBar.appendChild(this.mobileInventoryBtn);

        // Debug Panel Button
        this.mobileDebugBtn = document.createElement('div');
        this.mobileDebugBtn.id = 'mobile-debug-btn';
        this.mobileDebugBtn.innerHTML = '🔧';
        this.mobileDebugBtn.style.cssText = `
            width: 50px;
            height: 50px;
            background: rgba(0, 0, 0, 0.6);
            border: 2px solid rgba(255, 255, 255, 0.4);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            touch-action: manipulation;
            user-select: none;
            cursor: pointer;
        `;
        this.mobileDebugBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.game.toggleDebugPanel();
        }, { passive: false });
        this.mobileDebugBtn.addEventListener('click', () => {
            this.game.toggleDebugPanel();
        });
        this.mobileTopBar.appendChild(this.mobileDebugBtn);

        // Chat Panel Button
        this.mobileChatBtn = document.createElement('div');
        this.mobileChatBtn.id = 'mobile-chat-btn';
        this.mobileChatBtn.innerHTML = '💬';
        this.mobileChatBtn.style.cssText = `
            width: 50px;
            height: 50px;
            background: rgba(0, 0, 0, 0.6);
            border: 2px solid rgba(255, 255, 255, 0.4);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            touch-action: manipulation;
            user-select: none;
            cursor: pointer;
        `;
        this.mobileChatBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.game.agent) {
                this.game.agent.toggleChat();
            }
        }, { passive: false });
        this.mobileChatBtn.addEventListener('click', () => {
            if (this.game.agent) {
                this.game.agent.toggleChat();
            }
        });
        this.mobileTopBar.appendChild(this.mobileChatBtn);

        document.body.appendChild(this.mobileTopBar);

        // Joystick Logic
        let joystickActive = false;
        let joystickTouchId = null;
        let rect = null;
        let centerX = 0;
        let centerY = 0;
        let maxRadius = 0;

        const updateRect = () => {
            rect = this.joystickContainer.getBoundingClientRect();
            centerX = rect.left + rect.width / 2;
            centerY = rect.top + rect.height / 2;
            maxRadius = rect.width / 2;
        };

        const handleJoystick = (clientX, clientY) => {
            // Note: joystickActive check is done by caller usually, but good to have here
            const dx = clientX - centerX;
            const dy = clientY - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const angle = Math.atan2(dy, dx);
            const moveDist = Math.min(dist, maxRadius);

            const knobX = Math.cos(angle) * moveDist;
            const knobY = Math.sin(angle) * moveDist;

            this.joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;

            // Update InputManager actions
            const deadzone = 10;
            this.game.inputManager.actions['FORWARD'] = dy < -deadzone;
            this.game.inputManager.actions['BACKWARD'] = dy > deadzone;
            this.game.inputManager.actions['LEFT'] = dx < -deadzone;
            this.game.inputManager.actions['RIGHT'] = dx > deadzone;
        };

        const stopJoystick = () => {
            joystickActive = false;
            joystickTouchId = null;
            if (this.joystickKnob) this.joystickKnob.style.transform = `translate(0px, 0px)`;
            this.game.inputManager.actions['FORWARD'] = false;
            this.game.inputManager.actions['BACKWARD'] = false;
            this.game.inputManager.actions['LEFT'] = false;
            this.game.inputManager.actions['RIGHT'] = false;
        };

        // Touch Listeners
        this.joystickContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (joystickActive) return;

            const touch = e.changedTouches[0];
            joystickTouchId = touch.identifier;
            joystickActive = true;
            updateRect();
            handleJoystick(touch.clientX, touch.clientY);
        }, { passive: false });

        this.joystickContainer.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!joystickActive) return;

            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joystickTouchId) {
                    const touch = e.changedTouches[i];
                    handleJoystick(touch.clientX, touch.clientY);
                    break;
                }
            }
        }, { passive: false });

        const onTouchEnd = (e) => {
            if (!joystickActive) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joystickTouchId) {
                    stopJoystick();
                    break;
                }
            }
        };

        this.joystickContainer.addEventListener('touchend', onTouchEnd, { passive: false });
        this.joystickContainer.addEventListener('touchcancel', onTouchEnd, { passive: false });

        // Mouse Listeners
        this.joystickContainer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            updateRect();
            joystickActive = true;
            joystickTouchId = 'mouse';
            handleJoystick(e.clientX, e.clientY);

            const onMouseMove = (moveEvent) => {
                if (joystickActive && joystickTouchId === 'mouse') {
                    handleJoystick(moveEvent.clientX, moveEvent.clientY);
                }
            };

            const onMouseUp = () => {
                if (joystickTouchId === 'mouse') {
                    stopJoystick();
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                }
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });

        // Jump Logic
        const startJump = (e) => {
            if (e && e.cancelable) e.preventDefault();
            this.game.inputManager.actions['JUMP'] = true;
        };
        const stopJump = (e) => {
            if (e && e.cancelable) e.preventDefault();
            this.game.inputManager.actions['JUMP'] = false;
        };

        this.jumpBtn.addEventListener('touchstart', startJump, { passive: false });
        this.jumpBtn.addEventListener('touchend', stopJump, { passive: false });
        this.jumpBtn.addEventListener('mousedown', startJump);
        this.jumpBtn.addEventListener('mouseup', stopJump);
        this.jumpBtn.addEventListener('mouseleave', stopJump);

        // Interact Logic
        const triggerInteract = (e) => {
            if (e && e.cancelable) e.preventDefault();
            this.game.onRightClickDown();
        };

        this.interactBtn.addEventListener('touchstart', triggerInteract, { passive: false });
        this.interactBtn.addEventListener('mousedown', triggerInteract);

        // =====================
        // RIGHT JOYSTICK (LOOK)
        // =====================
        this.lookJoystickContainer = document.createElement('div');
        this.lookJoystickContainer.id = 'touch-look-joystick';
        this.lookJoystickContainer.style.cssText = `
            position: fixed;
            bottom: 40px;
            right: 140px;
            width: 120px;
            height: 120px;
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            z-index: 1000;
            touch-action: none;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        this.lookJoystickKnob = document.createElement('div');
        this.lookJoystickKnob.style.cssText = `
            width: 50px;
            height: 50px;
            background: rgba(255, 255, 255, 0.5);
            border-radius: 50%;
            pointer-events: none;
        `;
        this.lookJoystickContainer.appendChild(this.lookJoystickKnob);
        document.body.appendChild(this.lookJoystickContainer);

        // Look Joystick Logic - Continuous rotation
        let lookJoystickActive = false;
        let lookJoystickTouchId = null;
        let lookRect = null;
        let lookCenterX = 0;
        let lookCenterY = 0;
        let lookMaxRadius = 0;
        let lookDeltaX = 0; // Stored delta for continuous rotation
        let lookDeltaY = 0;
        let lookAnimationFrame = null;

        const updateLookRect = () => {
            lookRect = this.lookJoystickContainer.getBoundingClientRect();
            lookCenterX = lookRect.left + lookRect.width / 2;
            lookCenterY = lookRect.top + lookRect.height / 2;
            lookMaxRadius = lookRect.width / 2;
        };

        // Continuous rotation loop
        const lookRotationLoop = () => {
            if (!lookJoystickActive) {
                lookAnimationFrame = null;
                return;
            }

            // Apply rotation continuously based on stored delta
            if (this.game.player && (Math.abs(lookDeltaX) > 0.01 || Math.abs(lookDeltaY) > 0.01)) {
                this.game.player.rotate(lookDeltaX, lookDeltaY);
            }

            lookAnimationFrame = requestAnimationFrame(lookRotationLoop);
        };

        const handleLookJoystick = (clientX, clientY) => {
            const dx = clientX - lookCenterX;
            const dy = clientY - lookCenterY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const angle = Math.atan2(dy, dx);
            const moveDist = Math.min(dist, lookMaxRadius);

            const knobX = Math.cos(angle) * moveDist;
            const knobY = Math.sin(angle) * moveDist;

            this.lookJoystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;

            // Store rotation delta based on joystick position (normalized -1 to 1)
            const sensitivity = 3.0;
            lookDeltaX = (dx / lookMaxRadius) * sensitivity;
            lookDeltaY = (dy / lookMaxRadius) * sensitivity;
        };

        const startLookJoystick = () => {
            if (!lookAnimationFrame) {
                lookAnimationFrame = requestAnimationFrame(lookRotationLoop);
            }
        };

        const stopLookJoystick = () => {
            lookJoystickActive = false;
            lookJoystickTouchId = null;
            lookDeltaX = 0;
            lookDeltaY = 0;
            if (this.lookJoystickKnob) this.lookJoystickKnob.style.transform = `translate(0px, 0px)`;
            if (lookAnimationFrame) {
                cancelAnimationFrame(lookAnimationFrame);
                lookAnimationFrame = null;
            }
        };

        // Touch Listeners for Look Joystick
        this.lookJoystickContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (lookJoystickActive) return;

            const touch = e.changedTouches[0];
            lookJoystickTouchId = touch.identifier;
            lookJoystickActive = true;
            updateLookRect();
            handleLookJoystick(touch.clientX, touch.clientY);
            startLookJoystick();
        }, { passive: false });

        this.lookJoystickContainer.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!lookJoystickActive) return;

            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === lookJoystickTouchId) {
                    const touch = e.changedTouches[i];
                    handleLookJoystick(touch.clientX, touch.clientY);
                    break;
                }
            }
        }, { passive: false });

        const onLookTouchEnd = (e) => {
            if (!lookJoystickActive) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === lookJoystickTouchId) {
                    stopLookJoystick();
                    break;
                }
            }
        };

        this.lookJoystickContainer.addEventListener('touchend', onLookTouchEnd, { passive: false });
        this.lookJoystickContainer.addEventListener('touchcancel', onLookTouchEnd, { passive: false });

        // Mouse Listeners for Look Joystick
        this.lookJoystickContainer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            updateLookRect();
            lookJoystickActive = true;
            lookJoystickTouchId = 'mouse';
            handleLookJoystick(e.clientX, e.clientY);
            startLookJoystick();

            const onMouseMove = (moveEvent) => {
                if (lookJoystickActive && lookJoystickTouchId === 'mouse') {
                    handleLookJoystick(moveEvent.clientX, moveEvent.clientY);
                }
            };

            const onMouseUp = () => {
                if (lookJoystickTouchId === 'mouse') {
                    stopLookJoystick();
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                }
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    }
    updateMobileControlsVisibility(visible) {
        if (visible && !this.joystickContainer) {
            this.initTouchControls();
        }
        const display = visible ? 'flex' : 'none';
        if (this.joystickContainer) this.joystickContainer.style.display = display;
        if (this.lookJoystickContainer) this.lookJoystickContainer.style.display = display;
        if (this.jumpBtn) this.jumpBtn.style.display = display;
        if (this.interactBtn) this.interactBtn.style.display = display;
        if (this.mobileTopBar) this.mobileTopBar.style.display = display;
    }

    createFeedbackButton() {
        const btn = document.createElement('button');
        btn.id = 'feedback-btn';
        btn.innerHTML = '📝 Feedback';
        btn.style.cssText = `
            position: fixed;
            top: 70px;
            left: 20px;
            background: rgba(0, 0, 0, 0.6);
            color: #ffcc00;
            border: 2px solid #ffcc00;
            border-radius: 20px;
            padding: 8px 16px;
            font-family: 'VT323', monospace;
            font-size: 18px;
            cursor: pointer;
            z-index: 1000;
            transition: all 0.2s;
            box-shadow: 0 0 10px rgba(255, 204, 0, 0.2);
        `;

        btn.onmouseover = () => {
            btn.style.background = 'rgba(0, 0, 0, 0.8)';
            btn.style.boxShadow = '0 0 15px rgba(255, 204, 0, 0.4)';
            btn.style.transform = 'scale(1.05)';
        };
        btn.onmouseout = () => {
            btn.style.background = 'rgba(0, 0, 0, 0.6)';
            btn.style.boxShadow = '0 0 10px rgba(255, 204, 0, 0.2)';
            btn.style.transform = 'scale(1)';
        };

        btn.onclick = () => {
            this.feedbackUI.toggle();
            btn.blur();
        };

        document.body.appendChild(btn);
        this.feedbackBtn = btn;
    }
}
