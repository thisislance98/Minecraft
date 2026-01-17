/**
 * Xbox Platformer Mini-Game
 * Extracted from UIManager.js for better code organization
 */
export class XboxPlatformer {
    constructor(canvas, callbacks) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.callbacks = callbacks; // { onGameOver, onLevelComplete, onAllLevelsComplete }
        this.GAME_WIDTH = canvas.width;
        this.GAME_HEIGHT = canvas.height;
        this.state = null;
        this.lastTime = 0;
        this.animationId = null;

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
        this.state = null;
    }

    update(dt) {
        if (!this.state || !this.state.active) return;

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
}
