/**
 * SignEditorManager - Handles sign text input UI
 */
export class SignEditorManager {
    constructor(game, uiManager) {
        this.game = game;
        this.uiManager = uiManager;

        this.signInputOverlay = null;
        this.signTextInput = null;
        this.signSaveCallback = null;
    }

    initialize() {
        this.createSignInputUI();
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
            font-family: 'VT323', monospace; font-size: 18px;
            background: #DEB887; border: 2px solid #8B4513;
            border-radius: 4px; color: #333; resize: none;
        `;
        input.addEventListener('keydown', (e) => {
            e.stopPropagation(); // Prevent game controls
            if (e.key === 'Escape') {
                this.toggleSignInput(false);
            }
        });

        const buttonRow = document.createElement('div');
        buttonRow.style.cssText = 'display: flex; gap: 10px; justify-content: center;';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.cssText = `
            padding: 10px 30px; background: #228B22; color: white;
            border: 2px solid #155315; border-radius: 4px;
            font-family: 'Minecraft', monospace; font-size: 16px;
            cursor: pointer;
        `;
        saveBtn.addEventListener('click', () => {
            const text = this.signTextInput.value.trim();
            if (this.signSaveCallback) {
                this.signSaveCallback(text);
            }
            this.toggleSignInput(false);
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            padding: 10px 30px; background: #8B0000; color: white;
            border: 2px solid #5c0000; border-radius: 4px;
            font-family: 'Minecraft', monospace; font-size: 16px;
            cursor: pointer;
        `;
        cancelBtn.addEventListener('click', () => {
            this.toggleSignInput(false);
        });

        buttonRow.appendChild(saveBtn);
        buttonRow.appendChild(cancelBtn);

        container.appendChild(title);
        container.appendChild(input);
        container.appendChild(buttonRow);

        overlay.appendChild(container);
        document.body.appendChild(overlay);

        this.signInputOverlay = overlay;
        this.signTextInput = input;
    }

    showSignInput(callback, initialText = '') {
        if (!this.signInputOverlay) this.createSignInputUI();

        this.signSaveCallback = callback;
        this.signTextInput.value = initialText;
        this.toggleSignInput(true);
        this.signTextInput.focus();
    }

    toggleSignInput(show) {
        if (!this.signInputOverlay) return;

        this.signInputOverlay.style.display = show ? 'flex' : 'none';

        if (show) {
            if (this.game.inputManager) {
                this.game.inputManager.unlock();
            }
        } else {
            this.signSaveCallback = null;
            if (this.game.inputManager) {
                this.game.inputManager.lock();
            }
        }
    }

    cleanup() {
        if (this.signInputOverlay) {
            this.signInputOverlay.remove();
        }
    }
}
