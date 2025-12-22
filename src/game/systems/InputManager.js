/**
 * InputManager handles global keyboard and mouse inputs.
 * It replaces the old Controls.js and centralizes input logic.
 */
export class InputManager {
    constructor(game) {
        this.game = game;
        this.keys = {};
        this.actions = {};
        this.bindings = {
            'KeyW': 'FORWARD',
            'KeyS': 'BACKWARD',
            'KeyA': 'LEFT',
            'KeyD': 'RIGHT',
            'Space': 'JUMP',
            'ShiftLeft': 'SPRINT',
            'KeyF': 'INTERACT', // or Dismount
            'KeyC': 'CAMERA',
        };
        this.isLocked = false;
        this.mouseDownInterval = null;

        this.setupEventListeners();
    }

    isActionActive(action) {
        return !!this.actions[action];
    }

    setupEventListeners() {
        // Keyboard Down
        document.addEventListener('keydown', (e) => {
            if (this.game.agent && this.game.agent.isChatOpen) return; // Ignore game inputs when chatting

            this.keys[e.code] = true;
            if (this.bindings[e.code]) {
                this.actions[this.bindings[e.code]] = true;
            }

            // Debug Toggle (P)
            if (e.code === 'KeyP') {
                this.game.toggleDebugPanel();
            }

            // Inventory Toggle (I)
            if (e.code === 'KeyI') {
                if (!this.game.agent.isChatOpen) {
                    this.game.toggleInventory();
                }
            }

            // E for Secondary Action (Place / Interact / Use)
            if (e.code === 'KeyE' && !this.game.agent.isChatOpen) {
                // Land if flying (Broom)
                if (this.game.player && this.game.player.isFlying) {
                    if (!e.repeat) {
                        this.game.player.toggleFlying();
                    }
                    return;
                }
                this.handleSecondaryAction();
            }

            // R - Unused for now or reload?
            // User requested E for using things. 
            // Previous code had R for secondary action. 

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

            // K for Spell Creator
            if (e.code === 'KeyK') {
                if (!this.game.agent.isChatOpen) {
                    const item = this.game.inventory.getSelectedItem();
                    if (item && item.item === 'omni_wand') {
                        // get actual item instance
                        // inventory item is { item: 'id', count: 1 }
                        // we need the item instance from ItemManager
                        const wandItem = this.game.itemManager.getItem('omni_wand');
                        if (wandItem) {
                            this.game.uiManager.openSpellCreator(wandItem);
                        }
                    } else {
                        this.game.uiManager.addChatMessage('system', "Hold an Omni Wand to create spells.");
                    }
                }
            }

            // V for Voice (Handled in Agent.js directly via document listener, ideally move here later)
        });

        // Keyboard Up
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (this.bindings[e.code]) {
                this.actions[this.bindings[e.code]] = false;
            }

            if (e.code === 'KeyE') {
                if (this.isLocked) {
                    this.game.onRightClickUp();
                }
            }
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

                }
                // Right Click removed
                /* else if (e.button === 2) { // Right Click
                    this.handleSecondaryAction();
                } */
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
            }
            // Right click (button 2) release ignored
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

        // 0. Interaction (Entity Click - e.g. NPC)
        // Check for entity hits first!
        const hitAnimal = this.game.physicsManager.getHitAnimal();
        if (hitAnimal && hitAnimal.interact) {
            // If the animal has an interact method, use it!
            hitAnimal.interact(this.game.player);
            // Don't break blocks if we interacted
            return;
        }

        // 1. Food (Eat)
        if (item && item.type === 'food') {
            this.game.player.startEating();
            if (this.mouseDownInterval) {
                clearInterval(this.mouseDownInterval);
                this.mouseDownInterval = null;
            }
            return;
        }

        // 2. Usable Items (Wand, Bow) - Fire
        if (item && (item.item === 'bow' || item.item === 'wand' || item.item === 'shrink_wand' || item.item === 'omni_wand')) {
            this.game.onRightClickDown();
            return;
        }

        // 3. Blocks (Place)
        // Note: Standard Minecraft left click is break, right click is place/interact.
        // But here we had some mix. Keeping placement if item is block for now?
        // Wait, current logic had placement here. 
        if (item && item.type === 'block') {
            this.game.physicsManager.placeBlock();
            return;
        }

        // 4. Interaction (Crafting Table)
        const target = this.game.physicsManager.getTargetBlock();
        if (target) {
            const block = this.game.getBlock(target.x, target.y, target.z);
            if (block && block.type === 'crafting_table') {
                this.game.toggleCraftingTable();
                if (this.mouseDownInterval) {
                    clearInterval(this.mouseDownInterval);
                    this.mouseDownInterval = null;
                }
                return;
            }
        }

        // 5. Default: Break Block
        this.game.physicsManager.breakBlock();
    }

    handleSecondaryAction() {
        // Trigger item usage (Secondary Action)
        this.game.onRightClickDown();
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
