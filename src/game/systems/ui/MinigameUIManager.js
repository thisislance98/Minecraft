/**
 * MinigameUIManager - Handles survival mode UI, soccer scoreboard, and other minigame UIs
 */
export class MinigameUIManager {
    constructor(game, uiManager) {
        this.game = game;
        this.uiManager = uiManager;

        // Survival UI
        this.survivalUI = null;
        this.survivalTimerElement = null;
        this.survivalWaveElement = null;

        // Soccer UI
        this.soccerScoreboard = null;
        this.soccerWinScreen = null;
    }

    initialize() {
        // UI is created on demand
    }

    // --- Survival Mode UI ---

    createSurvivalUI() {
        if (this.survivalUI) return;

        const div = document.createElement('div');
        div.id = 'survival-ui';
        div.style.cssText = `
            position: fixed;
            top: 60px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, rgba(40, 0, 0, 0.9), rgba(80, 20, 20, 0.9));
            border: 2px solid #ff4444;
            border-radius: 8px;
            padding: 15px 25px;
            color: white;
            font-family: 'VT323', monospace;
            text-align: center;
            z-index: 1000;
            display: none;
            box-shadow: 0 0 20px rgba(255, 0, 0, 0.3);
        `;

        div.innerHTML = `
            <div style="font-size: 14px; color: #ff6666; margin-bottom: 5px;">SURVIVAL MODE</div>
            <div id="survival-timer" style="font-size: 36px; font-weight: bold; color: #fff;">0:00</div>
            <div id="survival-wave" style="font-size: 16px; color: #ffaa44; margin-top: 5px;">Wave 1</div>
        `;

        document.body.appendChild(div);
        this.survivalUI = div;
        this.survivalTimerElement = document.getElementById('survival-timer');
        this.survivalWaveElement = document.getElementById('survival-wave');
    }

    updateSurvivalUI(seconds, wave) {
        if (!this.survivalUI) this.createSurvivalUI();

        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (this.survivalTimerElement) {
            this.survivalTimerElement.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        if (this.survivalWaveElement && wave !== undefined) {
            this.survivalWaveElement.textContent = `Wave ${wave}`;
        }
    }

    showSurvivalUI(show) {
        if (!this.survivalUI && show) this.createSurvivalUI();
        if (this.survivalUI) {
            this.survivalUI.style.display = show ? 'block' : 'none';
        }
    }

    showHighscoreBoard(scores, currentScore) {
        // Remove existing board if any
        const existing = document.getElementById('highscore-board');
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.id = 'highscore-board';
        div.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, rgba(20, 20, 40, 0.95), rgba(40, 20, 60, 0.95));
            border: 3px solid #ffd700;
            border-radius: 12px;
            padding: 30px 40px;
            color: white;
            font-family: 'VT323', monospace;
            text-align: center;
            z-index: 2500;
            min-width: 350px;
            box-shadow: 0 0 40px rgba(255, 215, 0, 0.3);
        `;

        const scoreList = scores.slice(0, 10).map((score, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            const isNew = score.time === currentScore;
            return `
                <div style="
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 15px;
                    background: ${isNew ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
                    border-radius: 4px;
                    margin-bottom: 5px;
                    ${isNew ? 'border: 1px solid #ffd700; animation: pulse-score 1s infinite;' : ''}
                ">
                    <span>${medal} ${score.name || 'Anonymous'}</span>
                    <span style="color: #ffd700;">${Math.floor(score.time / 60)}:${(score.time % 60).toString().padStart(2, '0')}</span>
                </div>
            `;
        }).join('');

        div.innerHTML = `
            <style>
                @keyframes pulse-score {
                    0%, 100% { box-shadow: 0 0 5px rgba(255, 215, 0, 0.5); }
                    50% { box-shadow: 0 0 15px rgba(255, 215, 0, 0.8); }
                }
            </style>
            <h2 style="color: #ffd700; margin: 0 0 5px 0; font-size: 28px;">GAME OVER</h2>
            <p style="color: #ff6666; margin: 0 0 20px 0; font-size: 18px;">You survived ${Math.floor(currentScore / 60)}:${(currentScore % 60).toString().padStart(2, '0')}</p>
            <h3 style="color: #aaa; margin: 0 0 15px 0; font-size: 18px; border-bottom: 1px solid #444; padding-bottom: 10px;">High Scores</h3>
            <div style="max-height: 300px; overflow-y: auto;">
                ${scoreList || '<div style="color: #666;">No scores yet</div>'}
            </div>
            <button id="highscore-close" style="
                margin-top: 20px;
                padding: 10px 30px;
                background: linear-gradient(135deg, #ffd700, #ff8c00);
                border: none;
                border-radius: 6px;
                color: #000;
                font-family: 'VT323', monospace;
                font-size: 18px;
                font-weight: bold;
                cursor: pointer;
            ">Play Again</button>
        `;

        document.body.appendChild(div);

        document.getElementById('highscore-close').onclick = () => {
            div.remove();
            // Restart survival mode
            if (this.game.survivalGameManager) {
                this.game.survivalGameManager.startGame();
            }
        };

        // Unlock pointer for interaction
        if (this.game.inputManager) {
            this.game.inputManager.unlock();
        }
    }

    // --- Soccer Scoreboard ---

    showSoccerScoreboard() {
        if (this.soccerScoreboard) return; // Already visible

        const scoreboard = document.createElement('div');
        scoreboard.id = 'soccer-scoreboard';
        scoreboard.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, rgba(30, 30, 50, 0.9), rgba(20, 20, 40, 0.9));
            border: 2px solid #ffd700;
            border-radius: 10px;
            padding: 8px 16px;
            color: white;
            font-family: 'VT323', monospace;
            text-align: center;
            z-index: 1000;
            min-width: 140px;
            box-shadow: 0 0 15px rgba(255, 215, 0, 0.2);
        `;

        scoreboard.innerHTML = `
            <div style="font-size: 11px; color: #ffd700; margin-bottom: 4px; letter-spacing: 1px;">SOCCER</div>
            <div style="display: flex; justify-content: center; align-items: center; gap: 16px;">
                <div style="text-align: center;">
                    <div style="width: 20px; height: 20px; background: #4488ff; border-radius: 50%; margin: 0 auto 2px; display: flex; align-items: center; justify-content: center; font-size: 10px;">🔵</div>
                    <div id="soccer-blue-score" style="font-size: 24px; font-weight: bold; color: #88aaff;">0</div>
                </div>
                <div style="font-size: 14px; color: #666;">-</div>
                <div style="text-align: center;">
                    <div style="width: 20px; height: 20px; background: #ff8844; border-radius: 50%; margin: 0 auto 2px; display: flex; align-items: center; justify-content: center; font-size: 10px;">🟠</div>
                    <div id="soccer-orange-score" style="font-size: 24px; font-weight: bold; color: #ffaa88;">0</div>
                </div>
            </div>
            <div style="margin-top: 4px; font-size: 10px; color: #888;">First to 5</div>
        `;

        document.body.appendChild(scoreboard);
        this.soccerScoreboard = scoreboard;
    }

    hideSoccerScoreboard() {
        if (this.soccerScoreboard) {
            this.soccerScoreboard.remove();
            this.soccerScoreboard = null;
        }
    }

    updateSoccerScoreboard(blueScore, orangeScore) {
        if (!this.soccerScoreboard) return;

        const blueEl = document.getElementById('soccer-blue-score');
        const orangeEl = document.getElementById('soccer-orange-score');

        if (blueEl) blueEl.textContent = blueScore;
        if (orangeEl) orangeEl.textContent = orangeScore;

        // Check for win condition (first to 5)
        if (blueScore >= 5 || orangeScore >= 5) {
            const winner = blueScore >= 5 ? 'blue' : 'orange';
            this.showSoccerWinScreen(winner);
        }
    }

    showSoccerWinScreen(winner) {
        if (this.soccerWinScreen) return;

        const screen = document.createElement('div');
        screen.id = 'soccer-win-screen';
        screen.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 3000;
            animation: fadeIn 0.5s ease-out;
        `;

        const color = winner === 'blue' ? '#4488ff' : '#ff8844';
        const emoji = winner === 'blue' ? '🔵' : '🟠';
        const teamName = winner === 'blue' ? 'BLUE' : 'ORANGE';

        screen.innerHTML = `
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes bounce {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
                @keyframes confetti {
                    0% { transform: translateY(-100%) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                }
            </style>
            <div style="text-align: center; font-family: 'VT323', monospace;">
                <div style="font-size: 80px; animation: bounce 0.5s ease-in-out infinite;">${emoji}</div>
                <h1 style="font-size: 64px; color: ${color}; margin: 20px 0; text-shadow: 0 0 20px ${color};">${teamName} WINS!</h1>
                <p style="font-size: 24px; color: #aaa; margin-bottom: 30px;">Congratulations!</p>
                <button id="soccer-play-again" style="
                    padding: 15px 40px;
                    font-size: 24px;
                    background: ${color};
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-family: 'VT323', monospace;
                    cursor: pointer;
                    transition: transform 0.2s;
                ">Play Again</button>
            </div>
        `;

        document.body.appendChild(screen);
        this.soccerWinScreen = screen;

        document.getElementById('soccer-play-again').onclick = () => {
            this.hideSoccerWinScreen();
            // Reset scores and restart
            this.updateSoccerScoreboard(0, 0);
            // Reset ball position if soccer manager exists
            if (this.game.soccerManager) {
                this.game.soccerManager.resetBall();
            }
        };

        // Unlock pointer for interaction
        if (this.game.inputManager) {
            this.game.inputManager.unlock();
        }
    }

    hideSoccerWinScreen() {
        if (this.soccerWinScreen) {
            this.soccerWinScreen.remove();
            this.soccerWinScreen = null;
        }

        // Re-lock pointer
        if (this.game.inputManager) {
            this.game.inputManager.lock();
        }
    }

    cleanup() {
        if (this.survivalUI) {
            this.survivalUI.remove();
        }
        if (this.soccerScoreboard) {
            this.soccerScoreboard.remove();
        }
        if (this.soccerWinScreen) {
            this.soccerWinScreen.remove();
        }
    }
}
