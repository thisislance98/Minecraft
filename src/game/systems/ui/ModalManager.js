/**
 * ModalManager - Handles tutorial, help, death screen modals
 */
export class ModalManager {
    constructor(game, uiManager) {
        this.game = game;
        this.uiManager = uiManager;

        // Modal elements
        this.tutorialModal = null;
        this.helpModal = document.getElementById('help-modal');
        this.deathScreen = null;

        // Death screen key handler reference
        this.deathKeyHandler = null;
    }

    initialize() {
        this.setupHelpModal();
    }

    // --- Tutorial Modal ---

    setupTutorialModal() {
        const modal = document.createElement('div');
        modal.id = 'tutorial-modal';
        modal.className = 'ui-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.85); display: none; align-items: center;
            justify-content: center; z-index: 4000; font-family: 'Segoe UI', sans-serif;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: #1e1e1e; border: 2px solid #4169e1; padding: 40px;
            border-radius: 12px; text-align: left; color: #e0e0e0; width: 600px;
            box-shadow: 0 0 30px rgba(65, 105, 225, 0.3); max-height: 80vh; overflow-y: auto;
        `;

        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 1px solid #333; padding-bottom: 15px;">
                <h2 style="margin: 0; color: #4169e1; font-size: 28px;">Antigravity User Guide</h2>
                <button id="tutorial-close" style="background: transparent; border: none; color: #888; font-size: 24px; cursor: pointer;">&times;</button>
            </div>

            <div style="margin-bottom: 30px;">
                <h3 style="color: #fff; margin-bottom: 10px;">Welcome to Antigravity!</h3>
                <p style="line-height: 1.6; color: #aaa;">
                    Antigravity allows you to create, edit, and control your world using natural language.
                    You have an AI assistant ready to help you build anything you can imagine.
                </p>
            </div>

            <div style="background: #252526; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                <h4 style="margin-top: 0; color: #81a1c1;">How to use the AI:</h4>
                <ol style="padding-left: 20px; line-height: 1.8; color: #ccc;">
                    <li>Press <b style="color: #fff; background: #333; padding: 2px 6px; border-radius: 4px;">T</b> to open the Chat Panel.</li>
                    <li>Ensure the <b style="color: #4169e1;">AI Agent</b> tab is selected.</li>
                    <li>Type your request in plain English and press Enter!</li>
                </ol>
            </div>

            <div style="margin-bottom: 25px;">
                <h4 style="color: #81a1c1; margin-bottom: 15px;">Try these commands:</h4>
                <div style="display: grid; gap: 10px;">
                    <div style="background: #2d2d30; padding: 12px; border-radius: 6px; border-left: 3px solid #4caf50;">
                        <div style="font-weight: bold; color: #fff; margin-bottom: 4px;">Create Structures</div>
                        <div style="color: #aaa; font-style: italic;">"Build a modern house with a pool"</div>
                    </div>
                    <div style="background: #2d2d30; padding: 12px; border-radius: 6px; border-left: 3px solid #ff9800;">
                        <div style="font-weight: bold; color: #fff; margin-bottom: 4px;">Spawn Entities</div>
                        <div style="color: #aaa; font-style: italic;">"Spawn a herd of cows nearby"</div>
                    </div>
                    <div style="background: #2d2d30; padding: 12px; border-radius: 6px; border-left: 3px solid #f44336;">
                        <div style="font-weight: bold; color: #fff; margin-bottom: 4px;">Change Environment</div>
                        <div style="color: #aaa; font-style: italic;">"Make it night time and rainy"</div>
                    </div>
                    <div style="background: #2d2d30; padding: 12px; border-radius: 6px; border-left: 3px solid #ce9178;">
                        <div style="font-weight: bold; color: #fff; margin-bottom: 4px;">Modify Code</div>
                        <div style="color: #aaa; font-style: italic;">"Make the gravity low"</div>
                    </div>
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <button id="tutorial-ok" style="background: #4169e1; color: white; border: none; padding: 12px 30px; font-size: 16px; cursor: pointer; border-radius: 6px; font-weight: bold; transition: background 0.2s;">Got it!</button>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);
        this.tutorialModal = modal;

        // Event Listeners
        const closeAction = () => this.hideTutorialModal();
        document.getElementById('tutorial-close').onclick = closeAction;
        document.getElementById('tutorial-ok').onclick = closeAction;
    }

    showTutorialModal() {
        if (!this.tutorialModal) {
            this.setupTutorialModal();
        }
        this.uiManager.closeAllMenus(this.tutorialModal);
        this.tutorialModal.style.display = 'flex';

        if (this.game.inputManager) {
            this.game.inputManager.unlock();
        }
    }

    hideTutorialModal() {
        if (this.tutorialModal) {
            this.tutorialModal.style.display = 'none';
        }
    }

    // --- Help Modal ---

    setupHelpModal() {
        this.helpModal = document.getElementById('help-modal');
        const helpBtn = document.getElementById('help-btn');
        const closeBtn = document.getElementById('help-close');
        const okBtn = document.getElementById('help-ok-btn');

        const closeHelp = () => {
            if (this.helpModal) {
                this.helpModal.classList.add('hidden');
            }
            localStorage.setItem('hasSeenHelp', 'true');

            if (this.game.inputManager && !this.game.inputManager.isLocked) {
                const settingsModal = document.getElementById('settings-modal');
                const settingsOpen = settingsModal && !settingsModal.classList.contains('hidden');
                if (!settingsOpen) {
                    this.game.inputManager.lock();
                }
            }
        };

        if (closeBtn) closeBtn.onclick = closeHelp;
        if (okBtn) okBtn.onclick = closeHelp;

        // Auto-show on first run (only if setting is enabled)
        const showHelpEnabled = localStorage.getItem('settings_show_help') === 'true';
        if (showHelpEnabled && !localStorage.getItem('hasSeenHelp') && !this.game.isCLI) {
            setTimeout(() => {
                if (this.helpModal) {
                    this.helpModal.classList.remove('hidden');
                }
            }, 500);
        }

        if (helpBtn) {
            helpBtn.onclick = () => {
                if (this.helpModal) {
                    this.helpModal.classList.remove('hidden');
                }
                if (this.game.inputManager) {
                    this.game.inputManager.unlock();
                }
            };
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
        this.deathScreen.offsetHeight; // Force reflow

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

        if (this.game.inputManager) {
            this.game.inputManager.lock();
        }
    }

    cleanup() {
        if (this.tutorialModal) {
            this.tutorialModal.remove();
        }
        if (this.deathScreen) {
            this.deathScreen.remove();
        }
        if (this.deathKeyHandler) {
            document.removeEventListener('keydown', this.deathKeyHandler);
        }
    }
}
