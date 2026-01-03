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
            'ControlLeft': 'SNEAK',
            'KeyQ': 'DROP',
            'KeyF': 'INTERACT', // Kept for Interact
            'KeyC': 'CAMERA',
            'AltLeft': 'VOICE',
            'AltRight': 'VOICE',
        };
        this.lastSpaceTime = 0; // For double-jump detection
        this.isLocked = false;
        this.mouseDownInterval = null;

        // Configurable Hotkeys (load from localStorage or use defaults)
        this.hotkeys = {
            secondaryAction: localStorage.getItem('hotkey_secondary_action') || 'KeyE'
        };

        // Mobile / Touch Support
        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        this.touchLookSensitivity = 0.005;

        this.setupEventListeners();
        if (this.isTouchDevice) {
            this.setupTouchListeners();
        }
    }

    /**
     * Set a hotkey binding and persist to localStorage
     * @param {string} name - Hotkey name (e.g., 'secondaryAction')
     * @param {string} keyCode - Key code (e.g., 'KeyE', 'KeyK')
     */
    setHotkey(name, keyCode) {
        if (this.hotkeys.hasOwnProperty(name)) {
            this.hotkeys[name] = keyCode;
            localStorage.setItem(`hotkey_${name.replace(/([A-Z])/g, '_$1').toLowerCase()}`, keyCode);
        }
    }

    /**
     * Get a hotkey binding
     * @param {string} name - Hotkey name
     * @returns {string} Key code
     */
    getHotkey(name) {
        return this.hotkeys[name] || null;
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

                // 2. Close generic UI states (skip if mobile controls - no ESC key on mobile)
                if (this.game.agent && this.game.agent.isChatOpen) {
                    this.game.agent.toggleChat(); // Close Chat
                    this.game.container.focus(); // Return focus to game
                    return;
                }

                // Skip inventory/debug panel handling when mobile controls are enabled
                if (!this.game.gameState.flags.mobileControls) {
                    if (this.game.gameState.flags.inventoryOpen) {
                        this.game.toggleInventory(); // Close Inventory
                        this.game.container.focus(); // Return focus to game
                    }

                    // Close Debug Panel if open
                    const debugPanel = document.getElementById('debug-panel');
                    if (debugPanel && !debugPanel.classList.contains('hidden')) {
                        this.game.toggleDebugPanel();
                        this.game.container.focus();
                    }
                }

                // 3. Ensure Pointer is Unlocked (Browser does this natively, but we sync state)
                this.unlock();

                // 4. Force focus to game container so next click works
                this.game.container.focus();

                return;
            }

            // Block game inputs when typing in chat input (check if chat input is focused)
            const commInput = document.getElementById('comm-input');
            const aiChatInput = document.getElementById('chat-input');
            if ((commInput && document.activeElement === commInput) ||
                (aiChatInput && document.activeElement === aiChatInput)) return;

            // Tab toggles chat open/closed
            if (e.code === 'Tab') {
                e.preventDefault();
                if (this.game.agent) {
                    this.game.agent.toggleChat();
                }
                return;
            }

            // Arrow keys for profiler test scene
            if (this.game.profilerTestScene && this.game.profilerTestScene.isActive) {
                if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
                    e.preventDefault();
                    this.game.profilerTestScene.handleKeyDown(e.code);
                    return;
                }
            }

            // Debug Toggle (P) - REMOVED
            if (e.code === 'KeyP') {
                this.game.toggleDebugPanel();
            }

            // T for Chat - opens chat and switches to player tab
            if (e.code === 'KeyT') {
                if (this.game.agent && !this.game.agent.isChatOpen) {
                    e.preventDefault();
                    if (this.game.uiManager) {
                        this.game.uiManager.setChatMode('player');
                    }
                    this.game.agent.toggleChat();
                }
                return;
            }

            this.keys[e.code] = true;
            if (this.bindings[e.code]) {
                this.actions[this.bindings[e.code]] = true;
            }

            // Spawn Panel Toggle (R)
            if (e.code === 'KeyR' && !this.game.agent.isChatOpen) {
                if (window.spawnUI) {
                    window.spawnUI.togglePanel();
                }
            }

            // Inventory Toggle (I)
            if (e.code === 'KeyI') {
                if (!this.game.agent.isChatOpen) {
                    this.game.toggleInventory();
                }
            }

            // Minimap Toggle (M)
            if (e.code === 'KeyM' && !this.game.agent.isChatOpen) {
                if (this.game.uiManager && this.game.uiManager.minimap) {
                    this.game.uiManager.minimap.toggleVisibility();
                }
            }

            // Flying Toggle (moved from E) - let's put it on F for (F)ly or something, 
            // but F is Interact... 
            // Wait, standard creative flight is Double Jump space.
            // The broom flight was on E. Let's move Broom dismount/toggle to 'F' (Interact/Dismount).
            // Current F key:
            // 17:             'KeyF': 'INTERACT', // or Dismount

            if (e.code === 'KeyF') {
                if (this.game.player.mount) {
                    this.game.player.dismount();
                } else {
                    const animal = this.game.physicsManager.getHitAnimal();
                    if (animal && animal.interact) {
                        animal.interact();
                    }
                }
            }

            // E for Dismount and Inventory toggle
            if (e.code === 'KeyE') {
                if (!this.game.agent.isChatOpen) {

                    // Priority 0: Debug Spawning (Hover spawning)
                    if (this.game.uiManager && this.game.uiManager.debugPanel && this.game.uiManager.debugPanel.isVisible) {
                        e.preventDefault();
                        const select = document.getElementById('dbg-spawn-select');
                        if (select && select.value && this.game.spawnManager) {
                            this.game.uiManager.debugPanel.handleSpawn(select.value, "1");
                        }
                        return;
                    }

                    // E dismounts if mounted (highest priority after debug spawn)
                    if (this.game.player.mount) {
                        this.game.player.dismount();
                        return;
                    }

                    // If inventory is open, E closes it
                    if (this.game.gameState.flags.inventoryOpen) {
                        this.game.toggleInventory();
                        return;
                    }

                    // Otherwise, E triggers secondary action (place block / use item)
                    this.handleSecondaryAction();
                    return;
                }
            }



            // U - Use Selected Item (for wands/tools that can be activated with a key)
            if (e.code === 'KeyU' && !e.repeat && !this.game.agent.isChatOpen) {
                const item = this.game.inventory.getSelectedItem();
                if (item && item.item) {
                    const itemInstance = this.game.itemManager.getItem(item.item);
                    if (itemInstance && itemInstance.isTool) {
                        this.game.itemManager.handleItemPrimary(item.item);
                    }
                }
            }

            // Q for Drop Item (was Break, but Break is Left Click)
            if (e.code === 'KeyQ' && !this.game.agent.isChatOpen) {
                if (this.game.inventoryManager) {
                    this.game.inventoryManager.dropSelected();
                }
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

            // Secondary Action Key (configurable, default 'E') - Spell Creator or Stop flying
            if (e.code === this.hotkeys.secondaryAction) {
                if (!this.game.agent.isChatOpen) {
                    // If flying, stop flying (regardless of held item)
                    if (this.game.player.isFlying) {
                        this.game.player.toggleFlying();
                        return;
                    }

                    // For all other items (including flying_broom), fall through to secondary action
                }
            }

            // H for Voice Echo (Debug)
            if (e.code === 'KeyH') {
                if (this.game.socketManager) {
                    this.game.socketManager.toggleEcho();
                }
            }

            // V for Voice (Handled in Agent.js directly via document listener, ideally move here later)



            // Accessibility for Trackpad users:
            // L for Left Click (Primary Action)
            if (e.code === 'KeyL' && !this.game.agent.isChatOpen) {
                this.handlePrimaryAction();
            }

            // Secondary Action Key (configurable, default 'E') for Right Click equivalent
            if (e.code === this.hotkeys.secondaryAction && !this.game.agent.isChatOpen) {
                this.handleSecondaryAction();
            }
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
                    console.log('[InputManager] mousedown Left Click detected');
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

            // Only lock if not already locked and NOT using mobile controls
            if (document.pointerLockElement !== this.game.container &&
                !this.game.gameState.flags.inventoryOpen &&
                !this.game.gameState.flags.mobileControls) {

                // If it's a right click (button 2), we might want to allow it to pass through?
                // Standard Minecraft: Right click can also lock.

                this.game.container.requestPointerLock().catch((err) => {
                    // Ignore SecurityError when user exits lock before request completes
                    // Ignore WrongDocumentError when container is not part of active document (e.g. automated tests, tab switch)
                    if (err.name !== 'SecurityError' && err.name !== 'WrongDocumentError') {
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

    setupTouchListeners() {
        let touchStartX = 0;
        let touchStartY = 0;

        this.game.container.addEventListener('touchstart', (e) => {
            if (!this.game.gameState.flags.mobileControls) return;
            if (e.touches.length > 0) {
                // If touching the right half of the screen, start looking
                const touch = e.touches[0];
                if (touch.clientX > window.innerWidth / 2) {
                    touchStartX = touch.clientX;
                    touchStartY = touch.clientY;
                }
            }
        }, { passive: false });

        this.game.container.addEventListener('touchmove', (e) => {
            if (!this.game.gameState.flags.mobileControls) return;
            e.preventDefault(); // Prevent scrolling

            if (e.touches.length > 0) {
                const touch = e.touches[0];
                // Only process look if we started on the right half
                if (touch.clientX > window.innerWidth / 2) {
                    const deltaX = (touch.clientX - touchStartX) * 1.5; // Scale up for touch
                    const deltaY = (touch.clientY - touchStartY) * 1.5;

                    this.game.player.rotate(deltaX, deltaY);

                    touchStartX = touch.clientX;
                    touchStartY = touch.clientY;
                }
            }
        }, { passive: false });

        this.game.container.addEventListener('touchend', (e) => {
            if (!this.game.gameState.flags.mobileControls) return;
            // Reset look state if needed
        }, { passive: false });

        // Mouse listeners for "swipe look" when mobile controls are enabled (active on desktop)
        let mouseLookActive = false;
        this.game.container.addEventListener('mousedown', (e) => {
            if (!this.game.gameState.flags.mobileControls) return;
            // Only if clicking on the right half of the screen
            if (e.clientX > window.innerWidth / 2) {
                mouseLookActive = true;
                touchStartX = e.clientX;
                touchStartY = e.clientY;
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.game.gameState.flags.mobileControls || !mouseLookActive) return;

            const deltaX = (e.clientX - touchStartX) * 1.5;
            const deltaY = (e.clientY - touchStartY) * 1.5;

            this.game.player.rotate(deltaX, deltaY);

            touchStartX = e.clientX;
            touchStartY = e.clientY;
        });

        window.addEventListener('mouseup', () => {
            mouseLookActive = false;
        });
    }

    handlePrimaryAction() {
        console.log('[InputManager] handlePrimaryAction called');
        if (!this.game.physicsManager) return;
        const item = this.game.inventory.getSelectedItem();
        console.log('[InputManager] Selected item:', item ? JSON.stringify(item) : 'null');

        if (item) {
            const instance = this.game.itemManager.getItem(item.item);
            console.log('[InputManager] Item instance:', instance ? `Found (isTool: ${instance.isTool})` : 'Not Found');
        }

        // 0. Food (Eat) - Check first as eating shouldn't be interrupted
        if (item && item.type === 'food') {
            this.game.player.startEating();
            if (this.mouseDownInterval) {
                clearInterval(this.mouseDownInterval);
                this.mouseDownInterval = null;
            }
            return;
        }

        // 1. Tool Items (Wands, Bow, etc.) - Check BEFORE attack so wands fire instead of attacking
        if (item && item.item) {
            const itemInstance = this.game.itemManager.getItem(item.item);
            if (itemInstance && itemInstance.isTool) {
                const handled = this.game.itemManager.handleItemPrimary(item.item);
                if (handled) {
                    if (this.mouseDownInterval) {
                        clearInterval(this.mouseDownInterval);
                        this.mouseDownInterval = null;
                    }
                    return;
                }
            }
        }

        // 2. Attack (Entity Click) - Only if not using a tool
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

        // 2. Default: Break Block (or Interact with Door / Sign)
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

            // Left click on sign opens editor
            if (block && block.type === 'sign') {
                const key = this.game.getBlockKey(targetBlock.x, targetBlock.y, targetBlock.z);
                const currentText = this.game.signData.get(key) || '';

                if (this.game.uiManager) {
                    this.game.uiManager.showSignInput((text) => {
                        if (text !== null) {
                            this.game.setSignText(targetBlock.x, targetBlock.y, targetBlock.z, text);
                        }
                    }, currentText);
                }
                if (this.mouseDownInterval) {
                    clearInterval(this.mouseDownInterval);
                    this.mouseDownInterval = null;
                }
                return;
            }

            // Left click on survival block starts survival game
            if (block && block.type === 'survival_block') {
                if (this.game.survivalGameManager && !this.game.survivalGameManager.isActive) {
                    this.game.survivalGameManager.start();
                    if (this.game.soundManager) {
                        this.game.soundManager.playSound('click');
                    }
                }
                if (this.mouseDownInterval) {
                    clearInterval(this.mouseDownInterval);
                    this.mouseDownInterval = null;
                }
                return;
            }



            // Left click on parkour block starts parkour challenge
            if (block && block.type === 'parkour_block') {
                if (this.game.parkourManager && !this.game.parkourManager.isActive) {
                    this.game.parkourManager.start(new THREE.Vector3(targetBlock.x, targetBlock.y, targetBlock.z));
                    if (this.game.soundManager) {
                        this.game.soundManager.playSound('click');
                    }
                }
                if (this.mouseDownInterval) {
                    clearInterval(this.mouseDownInterval);
                    this.mouseDownInterval = null;
                }
                return;
            }
        }

        // 6. Sign item placement (before break block)
        if (item && item.item === 'sign') {
            // Trigger sign item behavior
            const handled = this.game.itemManager.handleItemDown('sign');
            if (handled) {
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
        if (!this.game.physicsManager) return;
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
        if (this.game.gameState.flags.mobileControls) return;
        this.game.container.requestPointerLock().catch((err) => {
            // Ignore SecurityError when user exits lock before request completes
            if (err.name !== 'SecurityError' && err.name !== 'WrongDocumentError') {
                console.error('Pointer lock error:', err);
            }
        });
    }
    unlock() { document.exitPointerLock(); }
}

