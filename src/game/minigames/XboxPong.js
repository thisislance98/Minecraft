/**
 * XboxPong - Classic Pong arcade game
 * Controls: W/S for left paddle, Arrow Up/Down for right paddle (or AI vs player)
 * Features: Multiple difficulty levels, AI opponent, score tracking
 */
export class XboxPong {
    constructor(canvas, callbacks) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.callbacks = callbacks;
        this.GAME_WIDTH = canvas.width;
        this.GAME_HEIGHT = canvas.height;
        this.state = null;
        this.lastTime = 0;
        this.animationId = null;

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
        this.state = null;
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
}
