/**
 * InputManager handles global keyboard and mouse inputs.
 * It replaces the old Controls.js and centralizes input logic.
 */
export class InputManager {
    constructor(game) {
        this.game = game;
        this.keys = {};
        this.isLocked = false;
        this.mouseDownInterval = null;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Keyboard Down
        document.addEventListener('keydown', (e) => {
            if (this.game.agent && this.game.agent.isChatOpen) return; // Ignore game inputs when chatting

            this.keys[e.code] = true;

            // Debug Toggle (P)
            if (e.code === 'KeyP') {
                this.game.toggleDebugPanel();
            }

            // Inventory Toggle (E or I)
            if (e.code === 'KeyE' || e.code === 'KeyI') {
                if (!this.game.agent.isChatOpen) {
                    this.game.toggleInventory();
                }
            }

            // R for Place (formerly Crafting)
            if (e.code === 'KeyR' && !this.game.agent.isChatOpen) {
                this.game.physicsManager.placeBlock();
            }

            // Q for break
            if (e.code === 'KeyQ' && this.isLocked) {
                this.game.physicsManager.breakBlock();
            }

            // Number keys for hotbar
            if (e.code.startsWith('Digit')) {
                const num = parseInt(e.code.replace('Digit', ''));
                if (num >= 1 && num <= 9) {
                    this.game.selectSlot(num - 1);
                }
            }

            // T for Chat
            if (e.code === 'KeyT') {
                if (this.game.agent) {
                    this.game.agent.toggleChat();
                }
            }

            // O for Weather Toggle (Debug)
            if (e.code === 'KeyO') {
                if (this.game.weatherSystem) {
                    console.log('Toggling Weather...');
                    // Cycle: Clear -> Rain -> Storm -> Clear
                    const current = this.game.weatherSystem.currentWeather;
                    if (current === 'clear') this.game.weatherSystem.setWeather('rain');
                    else if (current === 'rain') this.game.weatherSystem.setWeather('storm');
                    else this.game.weatherSystem.setWeather('clear');
                }
            }

            // V for Voice (Handled in Agent.js directly via document listener, ideally move here later)
        });

        // Keyboard Up
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // Mouse Look
        document.addEventListener('mousemove', (e) => {
            if (this.isLocked && document.pointerLockElement === this.game.container) {
                const deltaX = e.movementX || 0;
                const deltaY = e.movementY || 0;
                this.game.player.rotate(deltaX, deltaY);
            }
        });

        // Mouse Down
        document.addEventListener('mousedown', (e) => {
            if (document.pointerLockElement === this.game.container) {
                if (e.button === 0) { // Left Click
                    this.handlePrimaryAction();

                    // Auto-repeat
                    if (this.mouseDownInterval) clearInterval(this.mouseDownInterval);
                    this.mouseDownInterval = setInterval(() => this.handlePrimaryAction(), 250);

                } else if (e.button === 2) { // Right Click
                    this.handleSecondaryAction();
                }
            }
        });

        // Mouse Up
        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.game.player.stopEating();
                if (this.mouseDownInterval) {
                    clearInterval(this.mouseDownInterval);
                    this.mouseDownInterval = null;
                }
            } else if (e.button === 2) {
                if (this.isLocked) {
                    this.game.onRightClickUp(); // Delegate to game for now
                }
            }
        });

        // Pointer Lock
        this.game.container.addEventListener('click', () => {
            if (document.pointerLockElement !== this.game.container && !this.game.gameState.flags.inventoryOpen) {
                this.game.container.requestPointerLock().catch((err) => {
                    // Ignore SecurityError when user exits lock before request completes
                    if (err.name !== 'SecurityError') {
                        console.error('Pointer lock error:', err);
                    }
                });
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isLocked = (document.pointerLockElement === this.game.container);
            if (!this.isLocked) {
                if (this.mouseDownInterval) {
                    clearInterval(this.mouseDownInterval);
                    this.mouseDownInterval = null;
                }
            }
        });

        // Scroll
        document.addEventListener('wheel', (e) => {
            if (this.isLocked) {
                const direction = e.deltaY > 0 ? 1 : -1;
                this.game.cycleSlot(direction);
            }
        });
    }

    handlePrimaryAction() {
        const item = this.game.inventory.getSelectedItem();

        if (item && item.type === 'food') {
            this.game.player.startEating();
            if (this.mouseDownInterval) {
                clearInterval(this.mouseDownInterval);
                this.mouseDownInterval = null;
            }
        } else {
            // Left click is Break/Attack (standard)
            this.game.physicsManager.breakBlock();
        }
    }

    handleSecondaryAction() {
        // 1. Check for Block Interaction (Crafting Table)
        const target = this.game.physicsManager.getTargetBlock();
        if (target) {
            const blockType = this.game.getBlock(target.x, target.y, target.z);
            if (blockType === 'crafting_table') {
                this.game.toggleCraftingTable();
                return;
            }
        }

        // 2. Item Usage
        const item = this.game.inventory.getSelectedItem();
        if (item) {
            if (item.item === 'bow' || item.item === 'wand') {
                this.game.onRightClickDown();
            } else if (item.type === 'block') {
                this.game.physicsManager.placeBlock();
            }
        }
    }

    // Helper to unlock/lock
    lock() {
        this.game.container.requestPointerLock().catch((err) => {
            // Ignore SecurityError when user exits lock before request completes
            if (err.name !== 'SecurityError') {
                console.error('Pointer lock error:', err);
            }
        });
    }
    unlock() { document.exitPointerLock(); }
}
