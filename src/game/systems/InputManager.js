import * as THREE from 'three';

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
            // Escape Key Handler - High Priority
            if (e.code === 'Escape') {
                e.preventDefault();

                // 1. Clear Focus from any input elements
                if (document.activeElement && document.activeElement !== document.body && document.activeElement !== this.game.container) {
                    document.activeElement.blur();
                }

                // 2. Close generic UI states
                if (this.game.agent && this.game.agent.isChatOpen) {
                    this.game.agent.toggleChat(); // Close Chat
                    this.game.container.focus(); // Return focus to game
                    return;
                }

                if (this.game.gameState.flags.inventoryOpen) {
                    this.game.toggleInventory(); // Close Inventory
                    this.game.container.focus(); // Return focus to game
                    // We don't return here because we might want to also ensure unlocks happen
                }

                // Close Debug Panel if open (optional, maybe P handles it?)
                // If we want Esc to close debug panel:
                const debugPanel = document.getElementById('debug-panel');
                if (debugPanel && !debugPanel.classList.contains('hidden')) {
                    this.game.toggleDebugPanel();
                    this.game.container.focus();
                }

                // 3. Ensure Pointer is Unlocked (Browser does this natively, but we sync state)
                this.unlock();

                // 4. Force focus to game container so next click works
                this.game.container.focus();

                return;
            }

            // Tab toggles chat open/closed
            if (e.code === 'Tab') {
                e.preventDefault();
                if (this.game.agent) {
                    this.game.agent.toggleChat();
                }
                return;
            }

            // T for Chat - also opens chat (legacy)
            if (e.code === 'KeyT') {
                if (this.game.agent && !this.game.agent.isChatOpen) {
                    e.preventDefault();
                    this.game.agent.toggleChat();
                }
                return;
            }

            // Block game inputs when typing in chat input (check if chat input is focused)
            const chatInput = document.getElementById('chat-input');
            if (chatInput && document.activeElement === chatInput) return;

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

            // Flying Toggle (moved from E) - let's put it on F for (F)ly or something, 
            // but F is Interact... 
            // Wait, standard creative flight is Double Jump space.
            // The broom flight was on E. Let's move Broom dismount/toggle to 'F' (Interact/Dismount).
            // Current F key:
            // 17:             'KeyF': 'INTERACT', // or Dismount

            if (e.code === 'KeyF') {
                if (this.game.player && this.game.player.isFlying) {
                    if (!e.repeat) {
                        this.game.player.toggleFlying();
                    }
                }
            }

            // E for Broom activation only (use I for inventory)
            if (e.code === 'KeyE') {
                if (!this.game.agent.isChatOpen) {
                    // If inventory is open, E closes it
                    if (this.game.gameState.flags.inventoryOpen) {
                        this.game.toggleInventory();
                    } else {
                        // E only toggles flight if holding Broom
                        const item = this.game.inventory.getSelectedItem();
                        if (item && item.item === 'flying_broom') {
                            this.game.player.toggleFlying();
                        }
                        // Otherwise E does nothing (use I for inventory)
                    }
                }
            }

            // R - Cycle Spells (Omni Wand)
            if (e.code === 'KeyR' && !this.game.agent.isChatOpen) {
                const item = this.game.inventory.getSelectedItem();
                if (item && item.item === 'omni_wand') {
                    const wandItem = this.game.itemManager.getItem('omni_wand');
                    if (wandItem) {
                        wandItem.cycleSpell();
                    }
                }
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
                // Removed specific KeyE up logic as it's now Inventory toggle
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
            }
            if (e.button === 2) {
                this.game.onRightClickUp();
            }
        });

        // Pointer Lock
        this.game.container.addEventListener('mousedown', (e) => {
            // Ensure container has focus so keydowns work immediately
            this.game.container.focus();

            // Only lock if not already locked
            if (document.pointerLockElement !== this.game.container && !this.game.gameState.flags.inventoryOpen) {
                // If it's a right click (button 2), we might want to allow it to pass through?
                // Standard Minecraft: Right click can also lock.

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
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    handlePrimaryAction() {
        const item = this.game.inventory.getSelectedItem();

        // 0. Attack (Entity Click)
        // Check for entity hits first!
        const hitAnimal = this.game.physicsManager.getHitAnimal();
        if (hitAnimal) {
            // Left click attacks
            // Calculate damage based on item? For now just 1.
            // TODO: check held item for damage
            hitAnimal.takeDamage(1, this.game.player);

            // Apply knockback based on player direction
            const dir = this.game.camera.getWorldDirection(new THREE.Vector3());
            dir.y = 0;
            dir.normalize();
            hitAnimal.knockback(dir, 10.0);

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
        if (item && (item.item === 'bow' || item.item === 'wand' || item.item === 'shrink_wand' || item.item === 'omni_wand' || item.item === 'levitation_wand' || item.item === 'giant_wand' || item.item === 'wizard_tower_wand' || item.item === 'water_bucket')) {

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

        // 5. Default: Break Block (or Interact with Door)
        // User requested Left Click on Door -> Open
        const targetBlock = this.game.physicsManager.getTargetBlock();
        if (targetBlock) {
            const block = this.game.getBlock(targetBlock.x, targetBlock.y, targetBlock.z);
            if (block && (block.type === 'door_closed' || block.type === 'door_open')) {
                this.game.toggleDoor(targetBlock.x, targetBlock.y, targetBlock.z);
                if (this.mouseDownInterval) {
                    clearInterval(this.mouseDownInterval);
                    this.mouseDownInterval = null;
                }
                return;
            }
        }

        this.game.physicsManager.breakBlock();
    }

    handleSecondaryAction() {
        // 0. Interact (Entity Click)
        const hitAnimal = this.game.physicsManager.getHitAnimal();
        if (hitAnimal && hitAnimal.interact) {
            hitAnimal.interact(this.game.player);
            return;
        }

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
