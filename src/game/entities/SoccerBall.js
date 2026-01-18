import * as THREE from 'three';
import { Blocks } from '../core/Blocks.js';
import { Config } from '../core/Config.js';

/**
 * SoccerBall - A large physics-enabled ball for Rocket League style gameplay
 * Features:
 * - Realistic bouncing physics off walls and floor
 * - Player collision detection - ball gets pushed when players run into it
 * - Large size for visibility and gameplay
 * - Soccer ball texture pattern
 */
export class SoccerBall {
    constructor(game, x, y, z) {
        this.game = game;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);

        // Physics Properties - tuned for fun Rocket League style gameplay
        this.radius = 2.0;  // Large ball (2 blocks radius)
        this.gravity = -25.0;  // Strong gravity
        this.restitution = 0.75;  // Good bounciness
        this.drag = 0.995;  // Low air resistance
        this.friction = 0.92;  // Ground friction
        this.isDead = false;

        // Player kick properties
        this.kickStrength = 25.0;  // How hard players can kick the ball
        this.minKickVelocity = 5.0;  // Minimum kick velocity
        this.lastKickTime = 0;
        this.kickCooldown = 0.1;  // Seconds between kicks

        // Rolling effect
        this.rotationAxis = new THREE.Vector3(1, 0, 0);
        this.rotationAngle = 0;

        // Create the mesh with soccer ball pattern
        this.createMesh();

        // World boundaries for Soccer World arena
        this.soccerBaseY = Config.WORLD.SOCCER_WORLD_Y_START * 16 + 32;
        this.arenaHalfLengthX = 80;
        this.arenaHalfWidthZ = 50;
        this.wallHeight = 15;
        this.goalWidth = 20;
        this.goalDepth = 8;
        this.goalHeight = 10;

        // Score tracking
        this.lastGoalTime = 0;
        this.goalCooldown = 3.0;  // Seconds before ball can score again

        // Game score state
        this.scores = { blue: 0, orange: 0 };
        this.winScore = 10;  // First to 10 wins
        this.gameOver = false;
        this.winner = null;

        // Multiplayer sync
        this.isNetworked = !!this.game.socketManager;

        console.log(`[SoccerBall] Created at ${x}, ${y}, ${z}, networked: ${this.isNetworked}`);
    }

    createMesh() {
        const geometry = new THREE.SphereGeometry(this.radius, 32, 32);

        // Create soccer ball pattern with black pentagons and white hexagons
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // White base
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 256, 256);

        // Draw black pentagons pattern (simplified)
        ctx.fillStyle = '#222222';

        // Center pentagon
        this.drawPentagon(ctx, 128, 128, 40);

        // Surrounding pentagons
        const angles = [0, 72, 144, 216, 288];
        const radius = 85;
        angles.forEach(angle => {
            const rad = (angle * Math.PI) / 180;
            const x = 128 + Math.cos(rad) * radius;
            const y = 128 + Math.sin(rad) * radius;
            this.drawPentagon(ctx, x, y, 25);
        });

        // Edge pattern
        for (let i = 0; i < 8; i++) {
            const angle = (i * 45 * Math.PI) / 180;
            const x = 128 + Math.cos(angle) * 120;
            const y = 128 + Math.sin(angle) * 120;
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, Math.PI * 2);
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;

        const material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.6,
            metalness: 0.1
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.copy(this.position);

        this.game.scene.add(this.mesh);
    }

    drawPentagon(ctx, cx, cy, size) {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 72 - 90) * Math.PI / 180;
            const x = cx + Math.cos(angle) * size;
            const y = cy + Math.sin(angle) * size;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();
    }

    update(dt) {
        if (this.isDead) return;

        // Check if we're the physics host for networked play
        const isHost = !this.isNetworked || this.game.socketManager?.isSoccerBallHost;

        // Only run physics simulation if we're the host (or single player)
        if (isHost) {
            // Apply Gravity
            this.velocity.y += this.gravity * dt;

            // Apply air drag
            this.velocity.multiplyScalar(this.drag);

            // Check for player collision and apply kick force
            this.checkPlayerCollision(dt);

            // Check for remote player collisions (host processes all collisions)
            this.checkRemotePlayerCollisions(dt);

            // Check collision with world (arena walls, floor, goals)
            this.checkArenaCollision(dt);

            // Update position
            this.position.add(this.velocity.clone().multiplyScalar(dt));

            // Check for goals
            this.checkGoal(dt);

            // Broadcast state to other players
            if (this.isNetworked && this.game.socketManager) {
                this.game.socketManager.sendSoccerBallState(this);
            }
        }

        // Update Mesh position (always, whether host or not)
        this.mesh.position.copy(this.position);

        // Rotate mesh based on velocity (Visual rolling)
        const speed = this.velocity.length();
        if (speed > 0.5) {
            // axis is perpendicular to movement and up
            const moveDir = this.velocity.clone().normalize();
            const up = new THREE.Vector3(0, 1, 0);
            const axis = new THREE.Vector3().crossVectors(up, moveDir).normalize();

            if (axis.lengthSq() > 0.01) {
                const rotSpeed = speed / this.radius;
                this.mesh.rotateOnWorldAxis(axis, rotSpeed * dt);
            }
        }
    }

    checkPlayerCollision(dt) {
        const player = this.game.player;
        if (!player) return;

        // Calculate distance from player to ball center
        const playerPos = player.position.clone();
        playerPos.y += Config.PLAYER.HEIGHT / 2;  // Player center

        const distance = this.position.distanceTo(playerPos);
        const collisionDist = this.radius + Config.PLAYER.WIDTH / 2;

        if (distance < collisionDist) {
            // Player is touching the ball - apply kick force
            const now = performance.now() / 1000;
            if (now - this.lastKickTime > this.kickCooldown) {
                this.lastKickTime = now;

                // Calculate kick direction (from player to ball)
                const kickDir = new THREE.Vector3()
                    .subVectors(this.position, playerPos)
                    .normalize();

                // Get player's velocity for momentum transfer
                const playerVel = player.velocity ? player.velocity.clone() : new THREE.Vector3();
                const playerSpeed = playerVel.length();

                // Calculate kick strength based on player speed
                let kickPower = this.minKickVelocity;
                if (playerSpeed > 0.1) {
                    // More speed = stronger kick
                    kickPower = Math.min(this.kickStrength, this.minKickVelocity + playerSpeed * 50);

                    // Add player's momentum direction to kick
                    const momentumDir = playerVel.clone().normalize();
                    kickDir.lerp(momentumDir, 0.5);
                    kickDir.normalize();
                }

                // Add slight upward component for satisfying kicks
                kickDir.y = Math.max(kickDir.y, 0.2);
                kickDir.normalize();

                // Apply kick force
                this.velocity.add(kickDir.multiplyScalar(kickPower));

                // Push ball out of player
                const overlap = collisionDist - distance;
                this.position.add(kickDir.clone().normalize().multiplyScalar(overlap + 0.1));

                // Play sound effect
                if (this.game.soundManager) {
                    this.game.soundManager.playSound('hit');
                }

                // Broadcast kick event for sound sync
                if (this.isNetworked && this.game.socketManager) {
                    this.game.socketManager.sendSoccerBallKick();
                }
            }
        }
    }

    checkRemotePlayerCollisions(dt) {
        // Check both possible sources of remote players:
        // 1. game.remotePlayers (PhotonManager)
        // 2. game.socketManager.playerMeshes (SocketManager)
        const remotePlayers = this.game.remotePlayers ||
            (this.game.socketManager && this.game.socketManager.playerMeshes);

        if (!remotePlayers || remotePlayers.size === 0) {
            return;
        }

        const now = performance.now() / 1000;
        if (now - this.lastKickTime < this.kickCooldown) return;

        // Debug: log remote player count and positions periodically
        if (!this._lastDebugLog || now - this._lastDebugLog > 2) {
            this._lastDebugLog = now;
            console.log(`[SoccerBall] Checking ${remotePlayers.size} remote player(s), ball at (${this.position.x.toFixed(1)}, ${this.position.y.toFixed(1)}, ${this.position.z.toFixed(1)})`);
            for (const [pid, rp] of remotePlayers) {
                const m = rp?.group || rp?.mesh || rp;
                if (m && m.position) {
                    const dist = this.position.distanceTo(m.position);
                    console.log(`  - Player ${pid.substring(0,8)}: pos=(${m.position.x.toFixed(1)}, ${m.position.y.toFixed(1)}, ${m.position.z.toFixed(1)}), dist=${dist.toFixed(1)}`);
                } else {
                    console.log(`  - Player ${pid.substring(0,8)}: NO VALID MESH (group=${!!rp?.group}, mesh=${!!rp?.mesh})`);
                }
            }
        }

        for (const [playerId, remotePlayer] of remotePlayers) {
            // Handle different mesh structures:
            // - PhotonManager: remotePlayer.mesh
            // - SocketManager: remotePlayer.group (meshInfo object has .group property)
            const mesh = remotePlayer?.group || remotePlayer?.mesh || remotePlayer;
            if (!mesh || !mesh.position) continue;

            const playerPos = mesh.position.clone();
            playerPos.y += Config.PLAYER.HEIGHT / 2;

            const distance = this.position.distanceTo(playerPos);
            const collisionDist = this.radius + Config.PLAYER.WIDTH / 2;

            if (distance < collisionDist) {
                this.lastKickTime = now;

                console.log(`[SoccerBall] Remote player ${playerId} kicked the ball! Distance: ${distance.toFixed(2)}, collisionDist: ${collisionDist.toFixed(2)}`);

                // Calculate kick direction
                const kickDir = new THREE.Vector3()
                    .subVectors(this.position, playerPos)
                    .normalize();

                kickDir.y = Math.max(kickDir.y, 0.2);
                kickDir.normalize();

                // Apply kick force
                this.velocity.add(kickDir.multiplyScalar(this.minKickVelocity * 1.5));

                // Push ball out
                const overlap = collisionDist - distance;
                this.position.add(kickDir.clone().normalize().multiplyScalar(overlap + 0.1));

                if (this.game.soundManager) {
                    this.game.soundManager.playSound('hit');
                }

                // Broadcast kick event for sound sync
                if (this.isNetworked && this.game.socketManager) {
                    this.game.socketManager.sendSoccerBallKick();
                }
                break;
            }
        }
    }

    checkArenaCollision(dt) {
        const floorY = this.soccerBaseY + this.radius + 1;

        // Floor collision
        if (this.position.y <= floorY) {
            this.position.y = floorY;
            if (Math.abs(this.velocity.y) < 2.0) {
                this.velocity.y = 0;
                // Apply friction
                this.velocity.x *= this.friction;
                this.velocity.z *= this.friction;
            } else {
                this.velocity.y *= -this.restitution;
            }
        }

        // Check if in goal area (don't collide with end walls in goal opening)
        const inGoalZ = Math.abs(this.position.z) <= this.goalWidth / 2;
        const belowGoalHeight = this.position.y <= this.soccerBaseY + this.goalHeight + this.radius;

        // Side walls (Z boundaries)
        if (Math.abs(this.position.z) >= this.arenaHalfWidthZ - this.radius) {
            const sign = Math.sign(this.position.z);
            this.position.z = sign * (this.arenaHalfWidthZ - this.radius);
            this.velocity.z *= -this.restitution;

            if (this.game.soundManager) {
                this.game.soundManager.playSound('hit');
            }
        }

        // End walls (X boundaries) - with goal openings
        if (Math.abs(this.position.x) >= this.arenaHalfLengthX - this.radius) {
            // Check if ball is in goal opening
            if (inGoalZ && belowGoalHeight) {
                // Ball can pass through goal opening - check back wall of goal
                if (Math.abs(this.position.x) >= this.arenaHalfLengthX + this.goalDepth - this.radius) {
                    const sign = Math.sign(this.position.x);
                    this.position.x = sign * (this.arenaHalfLengthX + this.goalDepth - this.radius);
                    this.velocity.x *= -this.restitution;
                }
            } else {
                // Ball hits the end wall
                const sign = Math.sign(this.position.x);
                this.position.x = sign * (this.arenaHalfLengthX - this.radius);
                this.velocity.x *= -this.restitution;

                if (this.game.soundManager) {
                    this.game.soundManager.playSound('hit');
                }
            }
        }

        // Ceiling (optional - for dramatic plays)
        const ceilingY = this.soccerBaseY + this.wallHeight + 50;  // High ceiling
        if (this.position.y >= ceilingY - this.radius) {
            this.position.y = ceilingY - this.radius;
            this.velocity.y *= -this.restitution;
        }

        // Goal posts collision
        if (Math.abs(this.position.x) > this.arenaHalfLengthX - this.radius * 2) {
            // Check goal post collision (sides of goal opening)
            if (Math.abs(this.position.z) >= this.goalWidth / 2 - this.radius &&
                Math.abs(this.position.z) <= this.goalWidth / 2 + this.radius * 2) {
                // Near goal post
                if (this.position.y <= this.soccerBaseY + this.goalHeight + this.radius) {
                    // Bounce off post
                    const sign = Math.sign(this.position.z);
                    this.position.z = sign * (this.goalWidth / 2 + this.radius);
                    this.velocity.z *= -this.restitution * 0.8;

                    if (this.game.soundManager) {
                        this.game.soundManager.playSound('hit');
                    }
                }
            }

            // Crossbar collision
            if (inGoalZ &&
                this.position.y >= this.soccerBaseY + this.goalHeight - this.radius &&
                this.position.y <= this.soccerBaseY + this.goalHeight + this.radius * 2) {
                this.position.y = this.soccerBaseY + this.goalHeight + this.radius;
                this.velocity.y *= -this.restitution * 0.8;

                if (this.game.soundManager) {
                    this.game.soundManager.playSound('hit');
                }
            }
        }
    }

    checkGoal(dt) {
        if (this.gameOver) return;

        const now = performance.now() / 1000;
        if (now - this.lastGoalTime < this.goalCooldown) return;

        // Check if ball is inside a goal
        const inGoalX = Math.abs(this.position.x) > this.arenaHalfLengthX + 1;
        const inGoalZ = Math.abs(this.position.z) <= this.goalWidth / 2;
        const inGoalY = this.position.y <= this.soccerBaseY + this.goalHeight;

        if (inGoalX && inGoalZ && inGoalY) {
            this.lastGoalTime = now;

            // Determine which goal (ball in positive X = Blue scores, negative X = Orange scores)
            const scoringSide = this.position.x > 0 ? 'blue' : 'orange';

            // Update score
            this.scores[scoringSide]++;

            // Update scoreboard UI
            if (this.game.uiManager) {
                this.game.uiManager.updateSoccerScoreboard(this.scores.blue, this.scores.orange);
                this.game.uiManager.addChatMessage('system', `GOAL! ${scoringSide.charAt(0).toUpperCase() + scoringSide.slice(1)} team scores! (${this.scores.blue} - ${this.scores.orange})`);
            }

            // Play celebration sound
            if (this.game.soundManager) {
                this.game.soundManager.playSound('levelup');
            }

            // Broadcast goal to other players (includes new scores)
            if (this.isNetworked && this.game.socketManager) {
                this.game.socketManager.sendSoccerGoal(scoringSide, this.scores);
            }

            // Check for win condition
            if (this.scores[scoringSide] >= this.winScore) {
                this.gameOver = true;
                this.winner = scoringSide;

                if (this.game.uiManager) {
                    this.game.uiManager.showSoccerWinScreen(scoringSide);
                    this.game.uiManager.addChatMessage('system', `GAME OVER! ${scoringSide.charAt(0).toUpperCase() + scoringSide.slice(1)} team wins!`);
                }

                // Broadcast game over
                if (this.isNetworked && this.game.socketManager) {
                    this.game.socketManager.sendSoccerGameOver(scoringSide, this.scores);
                }
            } else {
                // Reset ball to center after short delay
                setTimeout(() => {
                    this.resetToCenter();
                }, 2000);
            }
        }
    }

    resetToCenter() {
        const resetPos = { x: 0, y: this.soccerBaseY + this.radius + 10, z: 0 };
        this.position.set(resetPos.x, resetPos.y, resetPos.z);
        this.velocity.set(0, 0, 0);

        if (this.mesh) {
            this.mesh.position.copy(this.position);
        }

        // Only show local message if we're the host (others get it via network)
        const isHost = !this.isNetworked || this.game.socketManager?.isSoccerBallHost;
        if (isHost && this.game.uiManager) {
            this.game.uiManager.addChatMessage('system', 'Ball reset to center!');
        }

        // Broadcast reset to other players
        if (this.isNetworked && this.game.socketManager && isHost) {
            this.game.socketManager.sendSoccerBallReset(resetPos);
        }
    }

    /**
     * Reset the entire game (scores and ball position)
     * @param {boolean} broadcast - Whether to broadcast to other players
     */
    resetGame(broadcast = true) {
        // Reset scores
        this.scores = { blue: 0, orange: 0 };
        this.gameOver = false;
        this.winner = null;
        this.lastGoalTime = 0;

        // Reset ball position
        this.resetToCenter();

        // Update UI
        if (this.game.uiManager) {
            this.game.uiManager.updateSoccerScoreboard(0, 0);
            this.game.uiManager.hideSoccerWinScreen();
            this.game.uiManager.addChatMessage('system', 'New game started! First to 10 wins!');
        }

        // Broadcast reset to other players
        const isHost = !this.isNetworked || this.game.socketManager?.isSoccerBallHost;
        if (broadcast && this.isNetworked && this.game.socketManager && isHost) {
            this.game.socketManager.sendSoccerGameReset();
        }

        console.log('[SoccerBall] Game reset');
    }

    /**
     * Apply score update from network (for non-host clients)
     */
    applyScoreUpdate(scores) {
        this.scores = { ...scores };
        if (this.game.uiManager) {
            this.game.uiManager.updateSoccerScoreboard(this.scores.blue, this.scores.orange);
        }
    }

    /**
     * Apply game over state from network
     */
    applyGameOver(winner, scores) {
        this.scores = { ...scores };
        this.gameOver = true;
        this.winner = winner;

        if (this.game.uiManager) {
            this.game.uiManager.updateSoccerScoreboard(this.scores.blue, this.scores.orange);
            this.game.uiManager.showSoccerWinScreen(winner);
        }
    }

    remove() {
        if (this.mesh) {
            this.game.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) {
                if (this.mesh.material.map) this.mesh.material.map.dispose();
                this.mesh.material.dispose();
            }
        }
        this.isDead = true;
    }
}
