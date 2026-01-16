/**
 * Xbox Joust Mini-Game
 * Extracted from UIManager.js for better code organization
 */
export class XboxJoust {
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
    }

    start(levelIndex = 0) {
        this.stop();

        const level = this.levelData[levelIndex % this.levelData.length];

        this.state = {
            levelIndex,
            player: {
                x: this.GAME_WIDTH / 2 - 12,
                y: this.GAME_HEIGHT - 50,
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

        this.handleKeyDown = (e) => {
            if (!this.state) return;
            this.state.keys[e.code] = true;
            if (['Space', 'KeyW', 'ArrowUp'].includes(e.code)) {
                if (this.state.active) {
                    const p = this.state.player;
                    p.vy = p.powerups.flap ? p.flapPower * 1.4 : p.flapPower;
                }
            }
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
        p.vx *= Math.pow(0.95, speedScale);

        if (Math.abs(p.vx) > currentMaxSpeed) p.vx = Math.sign(p.vx) * currentMaxSpeed;
        p.x += p.vx * speedScale;

        // Wrap horizontally
        if (p.x < -p.width) p.x = this.GAME_WIDTH;
        if (p.x > this.GAME_WIDTH) p.x = -p.width;

        // Gravity
        p.vy += p.gravity * speedScale;
        p.y += p.vy * speedScale;

        // Floor & Platform collision
        for (const plat of this.state.platforms) {
            if (p.x + p.width > plat.x && p.x < plat.x + plat.width &&
                p.y + p.height > plat.y && p.y + p.height < plat.y + p.vy * speedScale + 5 && p.vy >= 0) {

                if (plat.type === 'bouncy') {
                    p.vy = -10;
                } else {
                    p.y = plat.y - p.height;
                    p.vy = 0;
                }
            }
        }
        if (p.y + p.height > this.GAME_HEIGHT) {
            p.y = this.GAME_HEIGHT - p.height;
            p.vy = 0;
        }

        // Powerup collection
        for (const pu of this.state.powerups) {
            if (!pu.collected && p.x < pu.x + pu.width && p.x + p.width > pu.x &&
                p.y < pu.y + pu.height && p.y + p.height > pu.y) {
                pu.collected = true;
                p.powerups[pu.type] = 8000;
            }
        }

        // Enemies
        for (let i = this.state.enemies.length - 1; i >= 0; i--) {
            const e = this.state.enemies[i];

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
                if (e.x < 0 || e.x + e.width > this.GAME_WIDTH) e.vx *= -1;
            }

            if (e.x < -e.width) e.x = this.GAME_WIDTH;
            if (e.x > this.GAME_WIDTH) e.x = -e.width;

            // Collision
            if (p.x < e.x + e.width && p.x + p.width > e.x &&
                p.y < e.y + e.height && p.y + p.height > e.y) {

                if (p.y + p.height < e.y + e.height / 2 && p.vy > 0) {
                    this.state.enemies.splice(i, 1);
                    p.vy = -4;

                    if (this.state.enemies.length === 0) {
                        this.state.active = false;
                        const nextLvl = this.state.levelIndex + 1;
                        if (nextLvl < this.levelData.length) {
                            this.draw();
                            this.ctx.fillStyle = '#fff';
                            this.ctx.font = '24px "Segoe UI"';
                            this.ctx.fillText(`LEVEL ${this.state.levelIndex + 1} COMPLETE!`, this.GAME_WIDTH / 2 - 100, this.GAME_HEIGHT / 2);
                            setTimeout(() => this.callbacks.onLevelComplete?.(nextLvl), 2000);
                        } else {
                            this.draw();
                            this.ctx.fillStyle = '#fff';
                            this.ctx.font = '24px "Segoe UI"';
                            this.ctx.fillText('JOUST CHAMPION!', this.GAME_WIDTH / 2 - 100, this.GAME_HEIGHT / 2);
                            setTimeout(() => this.callbacks.onAllLevelsComplete?.(), 3000);
                        }
                    }
                } else {
                    this.state.active = false;
                    this.callbacks.onGameOver?.();
                }
            }
        }
    }

    draw() {
        if (!this.state) return;

        const ctx = this.ctx;
        const p = this.state.player;

        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);

        // Platforms
        for (const plat of this.state.platforms) {
            ctx.fillStyle = plat.type === 'bouncy' ? '#107c10' : '#333';
            ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
            if (plat.type === 'bouncy') {
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillRect(plat.x, plat.y, plat.width, 2);
            }
        }

        // Powerups
        for (const pu of this.state.powerups) {
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
        for (const e of this.state.enemies) {
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
        ctx.fillStyle = p.color;
        if (p.powerups.speed) ctx.fillStyle = '#ffff00';

        if (p.powerups.flap) {
            ctx.fillStyle = '#00ffff';
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(p.x - 2, p.y - 2, p.width + 4, p.height + 4);
        }

        ctx.fillRect(p.x, p.y, p.width, p.height);

        // Eyes
        ctx.fillStyle = '#fff';
        const eyeX = p.vx >= 0 ? 14 : 2;
        ctx.fillRect(p.x + eyeX, p.y + 6, 4, 4);
        ctx.fillRect(p.x + eyeX + 4, p.y + 6, 4, 4);

        // UI
        ctx.fillStyle = '#888';
        ctx.font = '12px Arial';
        ctx.fillText(`Level ${this.state.levelIndex + 1}`, 10, 20);

        // Powerup UI
        let puCount = 0;
        for (const type in p.powerups) {
            ctx.fillStyle = type === 'speed' ? '#ffff00' : '#00ffff';
            ctx.fillRect(10, 35 + puCount * 10, (p.powerups[type] / 8000) * 100, 4);
            puCount++;
        }
    }

    loop(timestamp) {
        if (!this.state || !this.state.active) return;

        if (!this.lastTime) this.lastTime = timestamp;
        const dt = Math.min(0.1, (timestamp - this.lastTime) / 1000);
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
