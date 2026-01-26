/**
 * SpaceshipUIManager - Handles spaceship control deck UI
 */
export class SpaceshipUIManager {
    constructor(game, uiManager) {
        this.game = game;
        this.uiManager = uiManager;

        this.spaceShipModal = null;
    }

    initialize() {
        // UI is created on demand
    }

    showSpaceShipControls(visible) {
        if (this.spaceShipModal) {
            this.spaceShipModal.style.display = visible ? 'flex' : 'none';
            if (visible) {
                if (this.game.inputManager) this.game.inputManager.unlock();
            } else {
                if (this.game.inputManager) this.game.inputManager.lock();
            }
            return;
        }

        if (!visible) return;

        // Create Modal
        const modal = document.createElement('div');
        modal.id = 'spaceship-controls';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.85); display: flex; flex-direction: column;
            align-items: center; justify-content: center; z-index: 4000;
            font-family: 'Courier New', monospace; color: cyan;
        `;

        const panel = document.createElement('div');
        panel.style.cssText = `
            background: #001122; border: 2px solid cyan; padding: 40px;
            border-radius: 10px; width: 650px; text-align: center;
            box-shadow: 0 0 50px cyan;
        `;

        panel.innerHTML = `
            <h1 style="margin-bottom: 20px; text-shadow: 0 0 10px cyan;">STARSHIP CONTROL DECK</h1>

            <h3 style="color: #88ccff; margin: 20px 0 15px 0;">WARP TO WORLD</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
                <button id="warp-earth" style="padding: 20px; background: linear-gradient(135deg, #2a5d3a 0%, #1a3d2a 100%); border: 2px solid #4a8d5a; color: #8aff8a; cursor: pointer; font-size: 16px; border-radius: 8px; transition: all 0.3s;">
                    EARTH<br><small style="opacity: 0.7;">Home World</small>
                </button>
                <button id="warp-crystal" style="padding: 20px; background: linear-gradient(135deg, #4a2d5d 0%, #2a1d3d 100%); border: 2px solid #8a5daa; color: #cc88ff; cursor: pointer; font-size: 16px; border-radius: 8px; transition: all 0.3s;">
                    CRYSTAL WORLD<br><small style="opacity: 0.7;">Purple Crystals</small>
                </button>
                <button id="warp-lava" style="padding: 20px; background: linear-gradient(135deg, #5d2a2a 0%, #3d1a1a 100%); border: 2px solid #aa5d5d; color: #ff8866; cursor: pointer; font-size: 16px; border-radius: 8px; transition: all 0.3s;">
                    LAVA WORLD<br><small style="opacity: 0.7;">Volcanic Terrain</small>
                </button>
                <button id="warp-moon" style="padding: 20px; background: linear-gradient(135deg, #3d3d3d 0%, #1d1d1d 100%); border: 2px solid #7d7d7d; color: #cccccc; cursor: pointer; font-size: 16px; border-radius: 8px; transition: all 0.3s;">
                    MOON<br><small style="opacity: 0.7;">Lunar Surface</small>
                </button>
                <button id="warp-soccer" style="padding: 20px; background: linear-gradient(135deg, #1E8449 0%, #145A32 100%); border: 2px solid #27AE60; color: #ABEBC6; cursor: pointer; font-size: 16px; border-radius: 8px; transition: all 0.3s; grid-column: span 2;">
                    SOCCER WORLD<br><small style="opacity: 0.7;">Rocket League Arena</small>
                </button>
            </div>

            <h3 style="color: #88ccff; margin: 20px 0 15px 0;">SHIP CONTROLS</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
                <button id="ship-launch" style="padding: 15px; background: transparent; border: 1px solid cyan; color: cyan; cursor: pointer; font-size: 16px; transition: all 0.3s;">
                    INITIATE LAUNCH
                </button>
                <button id="ship-scan" style="padding: 15px; background: transparent; border: 1px solid lime; color: lime; cursor: pointer; font-size: 16px; transition: all 0.3s;">
                    SCAN SECTOR
                </button>
            </div>

            <button id="ship-close" style="padding: 12px 40px; background: #333; color: white; border: none; cursor: pointer; font-size: 16px; border-radius: 5px;">
                LEAVE CONTROLS
            </button>
        `;

        modal.appendChild(panel);
        document.body.appendChild(modal);
        this.spaceShipModal = modal;

        // Close handler
        document.getElementById('ship-close').onclick = () => this.showSpaceShipControls(false);

        // Hover effects for all buttons
        const buttons = panel.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.onmouseover = () => {
                btn.style.transform = 'scale(1.02)';
                btn.style.boxShadow = `0 0 20px ${btn.style.color || 'white'}`;
            };
            btn.onmouseout = () => {
                btn.style.transform = 'scale(1)';
                btn.style.boxShadow = 'none';
            };
        });

        // World warp handlers
        document.getElementById('warp-earth').onclick = () => {
            this.showSpaceShipControls(false);
            if (this.game.spaceShipManager) this.game.spaceShipManager.warpToWorld('earth');
        };

        document.getElementById('warp-crystal').onclick = () => {
            this.showSpaceShipControls(false);
            if (this.game.spaceShipManager) this.game.spaceShipManager.warpToWorld('crystal');
        };

        document.getElementById('warp-lava').onclick = () => {
            this.showSpaceShipControls(false);
            if (this.game.spaceShipManager) this.game.spaceShipManager.warpToWorld('lava');
        };

        document.getElementById('warp-moon').onclick = () => {
            this.showSpaceShipControls(false);
            if (this.game.spaceShipManager) this.game.spaceShipManager.warpToWorld('moon');
        };

        document.getElementById('warp-soccer').onclick = () => {
            this.showSpaceShipControls(false);
            if (this.game.spaceShipManager) this.game.spaceShipManager.warpToWorld('soccer');
        };

        // Ship control handlers
        document.getElementById('ship-launch').onclick = () => {
            this.showSpaceShipControls(false);
            if (this.game.spaceShipManager) this.game.spaceShipManager.launchShip();
        };

        document.getElementById('ship-scan').onclick = () => {
            this.uiManager.chatManager?.addChatMessage('system',
                'Scanning... Life signs detected: ' + this.game.animals.length);
        };

        if (this.game.inputManager) this.game.inputManager.unlock();
    }

    cleanup() {
        if (this.spaceShipModal) {
            this.spaceShipModal.remove();
        }
    }
}
