import { XboxPlatformer } from './XboxPlatformer.js';
import { XboxJoust } from './XboxJoust.js';

/**
 * MinigameManager handles the Xbox overlay and minigame lifecycle.
 * Extracted from UIManager.js.
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
        this.snakeState = null;
        this.bricksState = null;
        this.invadersState = null;
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
            this.stopAllXboxGames();
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

    stopAllXboxGames() {
        this.stopXboxPlatformer();
        this.stopXboxJoust();
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
            `;
        }

        canvas.style.display = 'block';
        document.getElementById('xbox-game-over').style.display = 'none';

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
            `;
        }

        canvas.style.display = 'block';
        document.getElementById('xbox-game-over').style.display = 'none';

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

    // --- Snake ---

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

    // --- Brick Breaker ---

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

    // --- Invaders ---

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

    closeXboxUI() {
        this.stopAllXboxGames();
        if (this.xboxModal) {
            this.xboxModal.classList.add('hidden');
        }
    }
}
