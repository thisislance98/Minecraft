/**
 * TreasureHuntUIManager - UI for the treasure hunt mini-game.
 * Creates all DOM dynamically (no index.html changes needed).
 *
 * Components:
 *  - HUD overlay (top-right): timer, score, compass, proximity bar
 *  - Difficulty select modal (centered)
 *  - Completion screen (centered)
 */
export class TreasureHuntUIManager {
    constructor(game, uiManager) {
        this.game = game;
        this.uiManager = uiManager;

        // DOM references (lazy created)
        this.hudEl = null;
        this.timerEl = null;
        this.scoreEl = null;
        this.compassArrowEl = null;
        this.proximityBarFill = null;
        this.proximityLabel = null;
        this.distanceEl = null;
        this.hudBorder = null;

        this.difficultyModal = null;
        this.completionScreen = null;

        // Callbacks
        this.onDifficultySelect = null;
    }

    // ============ HUD ============

    createHUD() {
        if (this.hudEl) return;

        const hud = document.createElement('div');
        hud.id = 'treasure-hunt-hud';
        hud.style.cssText = `
            position: fixed;
            top: 150px;
            right: 20px;
            width: 220px;
            background: linear-gradient(135deg, rgba(30, 20, 0, 0.92), rgba(60, 40, 0, 0.92));
            border: 2px solid #FFD700;
            border-radius: 12px;
            padding: 14px 16px;
            color: #fff;
            font-family: 'VT323', monospace;
            z-index: 1000;
            display: none;
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
            transition: border-color 0.3s;
        `;

        hud.innerHTML = `
            <div style="text-align:center;font-size:20px;color:#FFD700;font-weight:bold;letter-spacing:2px;margin-bottom:8px;">
                TREASURE HUNT
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div>
                    <div style="font-size:12px;color:#aaa;">TIME</div>
                    <div id="th-timer" style="font-size:22px;color:#FFD700;">00:00.0</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:12px;color:#aaa;">CHESTS</div>
                    <div id="th-score" style="font-size:22px;color:#FFD700;">0 / 0</div>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <div id="th-compass" style="
                    width:50px;height:50px;border-radius:50%;
                    border:2px solid #FFD700;
                    background:rgba(0,0,0,0.5);
                    position:relative;flex-shrink:0;
                    display:flex;align-items:center;justify-content:center;
                ">
                    <div id="th-compass-arrow" style="
                        width:0;height:0;
                        border-left:6px solid transparent;
                        border-right:6px solid transparent;
                        border-bottom:20px solid #FFD700;
                        position:absolute;
                        transform-origin:center 70%;
                        transition:transform 0.15s ease-out;
                    "></div>
                    <div style="
                        width:6px;height:6px;border-radius:50%;
                        background:#FFD700;position:absolute;
                        bottom:6px;
                    "></div>
                </div>
                <div style="flex:1;">
                    <div id="th-prox-label" style="font-size:14px;color:#aaa;margin-bottom:3px;">Searching...</div>
                    <div style="
                        width:100%;height:10px;border-radius:5px;
                        background:rgba(255,255,255,0.15);overflow:hidden;
                    ">
                        <div id="th-prox-bar" style="
                            width:0%;height:100%;border-radius:5px;
                            background:#4488ff;
                            transition:width 0.25s ease-out, background 0.3s;
                        "></div>
                    </div>
                    <div id="th-distance" style="font-size:12px;color:#888;margin-top:2px;"></div>
                </div>
            </div>
            <div style="text-align:center;font-size:11px;color:#666;margin-top:4px;">
                Press G to cancel
            </div>
        `;

        document.body.appendChild(hud);
        this.hudEl = hud;
        this.timerEl = document.getElementById('th-timer');
        this.scoreEl = document.getElementById('th-score');
        this.compassArrowEl = document.getElementById('th-compass-arrow');
        this.proximityBarFill = document.getElementById('th-prox-bar');
        this.proximityLabel = document.getElementById('th-prox-label');
        this.distanceEl = document.getElementById('th-distance');
    }

    showHUD(visible) {
        if (visible && !this.hudEl) this.createHUD();
        if (this.hudEl) {
            this.hudEl.style.display = visible ? 'block' : 'none';
        }
    }

    updateHUD(data) {
        if (!this.hudEl) this.createHUD();
        if (this.hudEl.style.display === 'none') return;

        // Timer (MM:SS.s)
        if (this.timerEl) {
            const mins = Math.floor(data.time / 60);
            const secs = Math.floor(data.time % 60);
            const tenths = Math.floor((data.time * 10) % 10);
            this.timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
        }

        // Score
        if (this.scoreEl) {
            this.scoreEl.textContent = `${data.found} / ${data.total}`;
        }

        // Compass arrow rotation
        if (this.compassArrowEl) {
            const deg = (data.compassAngle * 180 / Math.PI);
            this.compassArrowEl.style.transform = `rotate(${-deg}deg)`;
        }

        // Proximity bar
        if (this.proximityBarFill) {
            this.proximityBarFill.style.width = `${data.proximityPercent}%`;

            // Color based on level
            const colors = {
                none: '#4488ff',
                cold: '#4488ff',
                warm: '#ffaa22',
                hot: '#ff4422',
                burning: '#ff0000'
            };
            this.proximityBarFill.style.background = colors[data.proximityLevel] || '#4488ff';
        }

        // Proximity label
        if (this.proximityLabel) {
            const labels = {
                none: 'Searching...',
                cold: 'Cold',
                warm: 'Getting Warm',
                hot: 'HOT!',
                burning: 'ON FIRE!!'
            };
            const label = labels[data.proximityLevel] || 'Searching...';
            this.proximityLabel.textContent = label;

            const labelColors = {
                none: '#aaa',
                cold: '#4488ff',
                warm: '#ffaa22',
                hot: '#ff4422',
                burning: '#ff0000'
            };
            this.proximityLabel.style.color = labelColors[data.proximityLevel] || '#aaa';
        }

        // Distance readout
        if (this.distanceEl) {
            if (data.distance < 100) {
                this.distanceEl.textContent = `~${Math.round(data.distance)}m`;
            } else {
                this.distanceEl.textContent = '';
            }
        }

        // Border glow color
        if (this.hudEl) {
            const glowColors = {
                none: 'rgba(255, 215, 0, 0.3)',
                cold: 'rgba(68, 136, 255, 0.5)',
                warm: 'rgba(255, 170, 34, 0.6)',
                hot: 'rgba(255, 68, 34, 0.7)',
                burning: 'rgba(255, 0, 0, 0.9)'
            };
            const borderColors = {
                none: '#FFD700',
                cold: '#4488ff',
                warm: '#ffaa22',
                hot: '#ff4422',
                burning: '#ff0000'
            };
            this.hudEl.style.boxShadow = `0 0 20px ${glowColors[data.proximityLevel] || glowColors.none}`;
            this.hudEl.style.borderColor = borderColors[data.proximityLevel] || borderColors.none;
        }
    }

    // ============ Difficulty Select Modal ============

    showDifficultySelect(onSelect) {
        this.onDifficultySelect = onSelect;

        if (this.difficultyModal) {
            this.difficultyModal.style.display = 'flex';
        } else {
            this.createDifficultyModal();
        }

        // Unlock pointer for mouse interaction
        if (this.game.inputManager) {
            this.game.inputManager.unlock();
        }
    }

    createDifficultyModal() {
        const overlay = document.createElement('div');
        overlay.id = 'th-difficulty-modal';
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            font-family: 'VT323', monospace;
        `;

        const panel = document.createElement('div');
        panel.style.cssText = `
            background: linear-gradient(135deg, rgba(30, 20, 0, 0.97), rgba(50, 35, 0, 0.97));
            border: 2px solid #FFD700;
            border-radius: 16px;
            padding: 30px 40px;
            text-align: center;
            min-width: 340px;
            box-shadow: 0 0 40px rgba(255, 215, 0, 0.4);
        `;

        panel.innerHTML = `
            <div style="font-size:28px;color:#FFD700;font-weight:bold;letter-spacing:3px;margin-bottom:6px;">
                TREASURE HUNT
            </div>
            <div style="font-size:16px;color:#ccc;margin-bottom:24px;">
                Choose your difficulty
            </div>
        `;

        const difficulties = [
            { key: 'easy', label: 'Easy', desc: '3 chests, small area', color: '#44cc44', hoverBg: 'rgba(68,204,68,0.15)' },
            { key: 'medium', label: 'Medium', desc: '5 chests, medium area', color: '#ffaa22', hoverBg: 'rgba(255,170,34,0.15)' },
            { key: 'hard', label: 'Hard', desc: '8 chests, large area', color: '#ff4444', hoverBg: 'rgba(255,68,68,0.15)' }
        ];

        for (const d of difficulties) {
            const btn = document.createElement('button');
            btn.style.cssText = `
                display: block;
                width: 100%;
                padding: 12px 20px;
                margin-bottom: 10px;
                background: rgba(255, 255, 255, 0.05);
                border: 2px solid ${d.color};
                border-radius: 8px;
                color: ${d.color};
                font-family: 'VT323', monospace;
                font-size: 20px;
                cursor: pointer;
                transition: all 0.2s;
                text-align: left;
            `;
            btn.innerHTML = `
                <span style="font-weight:bold;">${d.label}</span>
                <span style="font-size:14px;color:#aaa;margin-left:10px;">${d.desc}</span>
            `;

            btn.onmouseover = () => {
                btn.style.background = d.hoverBg;
                btn.style.transform = 'scale(1.02)';
            };
            btn.onmouseout = () => {
                btn.style.background = 'rgba(255,255,255,0.05)';
                btn.style.transform = 'scale(1)';
            };
            btn.onclick = () => {
                this.hideDifficultyModal();
                if (this.game.inputManager) {
                    this.game.inputManager.lock();
                }
                if (this.onDifficultySelect) {
                    this.onDifficultySelect(d.key);
                }
            };

            panel.appendChild(btn);
        }

        // Cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.style.cssText = `
            display: block;
            width: 100%;
            padding: 10px;
            margin-top: 8px;
            background: transparent;
            border: 1px solid #666;
            border-radius: 8px;
            color: #888;
            font-family: 'VT323', monospace;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.2s;
        `;
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onmouseover = () => { cancelBtn.style.color = '#ccc'; cancelBtn.style.borderColor = '#aaa'; };
        cancelBtn.onmouseout = () => { cancelBtn.style.color = '#888'; cancelBtn.style.borderColor = '#666'; };
        cancelBtn.onclick = () => {
            this.hideDifficultyModal();
            if (this.game.inputManager) {
                this.game.inputManager.lock();
            }
        };
        panel.appendChild(cancelBtn);

        overlay.appendChild(panel);

        // Click outside to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.hideDifficultyModal();
                if (this.game.inputManager) {
                    this.game.inputManager.lock();
                }
            }
        });

        document.body.appendChild(overlay);
        this.difficultyModal = overlay;
    }

    hideDifficultyModal() {
        if (this.difficultyModal) {
            this.difficultyModal.style.display = 'none';
        }
    }

    // ============ Completion Screen ============

    showCompletionScreen(time, difficulty, scores) {
        // Hide HUD
        this.showHUD(false);

        if (this.completionScreen) {
            this.completionScreen.remove();
            this.completionScreen = null;
        }

        // Unlock pointer for interaction
        if (this.game.inputManager) {
            this.game.inputManager.unlock();
        }

        const overlay = document.createElement('div');
        overlay.id = 'th-completion-screen';
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.75);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            font-family: 'VT323', monospace;
        `;

        const panel = document.createElement('div');
        panel.style.cssText = `
            background: linear-gradient(135deg, rgba(30, 20, 0, 0.97), rgba(50, 35, 0, 0.97));
            border: 2px solid #FFD700;
            border-radius: 16px;
            padding: 30px 40px;
            text-align: center;
            min-width: 360px;
            box-shadow: 0 0 60px rgba(255, 215, 0, 0.5);
        `;

        // Format time
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        const tenths = Math.floor((time * 10) % 10);
        const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;

        const diffLabels = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
        const diffColors = { easy: '#44cc44', medium: '#ffaa22', hard: '#ff4444' };

        let scoresHTML = '';
        if (scores && scores.length > 0) {
            scoresHTML = `
                <div style="margin-top:16px;text-align:left;">
                    <div style="font-size:16px;color:#FFD700;margin-bottom:8px;text-align:center;">Best Times</div>
                    ${scores.map((s, i) => {
                        const m = Math.floor(s.time / 60);
                        const sc = Math.floor(s.time % 60);
                        const t = Math.floor((s.time * 10) % 10);
                        const tStr = `${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}.${t}`;
                        const isCurrent = Math.abs(s.time - time) < 0.05;
                        const highlight = isCurrent ? 'color:#FFD700;font-weight:bold;' : 'color:#ccc;';
                        return `<div style="display:flex;justify-content:space-between;padding:3px 0;${highlight}">
                            <span>${i + 1}. ${tStr}</span>
                            ${isCurrent ? '<span style="color:#FFD700;">  NEW!</span>' : ''}
                        </div>`;
                    }).join('')}
                </div>
            `;
        }

        panel.innerHTML = `
            <div style="font-size:32px;color:#FFD700;font-weight:bold;letter-spacing:3px;margin-bottom:8px;">
                ALL TREASURES FOUND!
            </div>
            <div style="font-size:18px;color:${diffColors[difficulty] || '#ccc'};margin-bottom:16px;">
                ${diffLabels[difficulty] || difficulty} Mode
            </div>
            <div style="font-size:42px;color:#FFD700;margin-bottom:8px;">
                ${timeStr}
            </div>
            ${scoresHTML}
        `;

        // Play Again button
        const playAgainBtn = document.createElement('button');
        playAgainBtn.style.cssText = `
            display: inline-block;
            padding: 12px 30px;
            margin-top: 20px;
            margin-right: 10px;
            background: linear-gradient(135deg, #FFD700, #FFA500);
            border: none;
            border-radius: 8px;
            color: #1a1000;
            font-family: 'VT323', monospace;
            font-size: 20px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 0 15px rgba(255, 215, 0, 0.4);
        `;
        playAgainBtn.textContent = 'Play Again';
        playAgainBtn.onmouseover = () => { playAgainBtn.style.transform = 'scale(1.05)'; playAgainBtn.style.boxShadow = '0 0 25px rgba(255,215,0,0.6)'; };
        playAgainBtn.onmouseout = () => { playAgainBtn.style.transform = 'scale(1)'; playAgainBtn.style.boxShadow = '0 0 15px rgba(255,215,0,0.4)'; };
        playAgainBtn.onclick = () => {
            this.hideCompletionScreen();
            if (this.game.inputManager) {
                this.game.inputManager.lock();
            }
            // Re-open difficulty select
            if (this.game.treasureHuntManager) {
                this.game.treasureHuntManager.toggle();
            }
        };

        // Done button
        const doneBtn = document.createElement('button');
        doneBtn.style.cssText = `
            display: inline-block;
            padding: 12px 30px;
            margin-top: 20px;
            background: transparent;
            border: 2px solid #888;
            border-radius: 8px;
            color: #ccc;
            font-family: 'VT323', monospace;
            font-size: 20px;
            cursor: pointer;
            transition: all 0.2s;
        `;
        doneBtn.textContent = 'Done';
        doneBtn.onmouseover = () => { doneBtn.style.borderColor = '#ccc'; doneBtn.style.color = '#fff'; };
        doneBtn.onmouseout = () => { doneBtn.style.borderColor = '#888'; doneBtn.style.color = '#ccc'; };
        doneBtn.onclick = () => {
            this.hideCompletionScreen();
            if (this.game.inputManager) {
                this.game.inputManager.lock();
            }
        };

        panel.appendChild(playAgainBtn);
        panel.appendChild(doneBtn);
        overlay.appendChild(panel);

        document.body.appendChild(overlay);
        this.completionScreen = overlay;
    }

    hideCompletionScreen() {
        if (this.completionScreen) {
            this.completionScreen.remove();
            this.completionScreen = null;
        }
    }

    // ============ Cleanup ============

    cleanup() {
        this.showHUD(false);
        this.hideDifficultyModal();
        this.hideCompletionScreen();
        if (this.hudEl) {
            this.hudEl.remove();
            this.hudEl = null;
        }
        if (this.difficultyModal) {
            this.difficultyModal.remove();
            this.difficultyModal = null;
        }
    }
}
