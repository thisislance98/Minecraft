/**
 * Controls module
 * Handles user input for keyboard and mouse
 */
export class Controls {
    constructor(game) {
        this.game = game;
        this.keys = {};
        this.isLocked = false;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Keyboard
        document.addEventListener('keydown', (e) => {
            console.log('Key received:', e.code);
            this.keys[e.code] = true;

            // Number keys for block selection
            if (e.code.startsWith('Digit')) {
                const num = parseInt(e.code.replace('Digit', ''));
                if (num >= 1 && num <= 9) {
                    this.game.selectSlot(num - 1);
                }
            }

            // Q and E for break/place blocks (keyboard alternative)
            if (e.code === 'KeyQ' && this.isLocked) {
                this.game.breakBlock();
            }
            if (e.code === 'KeyE' && this.isLocked) {
                this.game.placeBlock();
            }

            // T for Agent Interaction
            if (e.code === 'KeyT') {
                console.log('T key pressed. Checking agent:', this.game.agent);
                if (this.game.agent) {
                    this.game.agent.toggleChat();
                } else {
                    console.error('Game Agent not found!');
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // Mouse look using Pointer Lock API
        document.addEventListener('mousemove', (e) => {
            if (this.isLocked && document.pointerLockElement === this.game.container) {
                const deltaX = e.movementX || 0;
                const deltaY = e.movementY || 0;

                this.game.player.rotation.y -= deltaX * 0.002;
                this.game.player.rotation.x -= deltaY * 0.002;
                this.game.player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.game.player.rotation.x));
            }
        });

        // Mouse clicks for block actions - listen on document for when pointer is locked
        document.addEventListener('mousedown', (e) => {
            console.log('[DEBUG mousedown] button:', e.button, 'isLocked:', this.isLocked);

            if (document.pointerLockElement === this.game.container) {
                if (e.button === 0) { // Left Click (Primary)
                    console.log('[DEBUG] Left click detected');

                    const selectedItem = this.game.inventory.getSelectedItem();
                    const itemType = selectedItem ? selectedItem.type : null;
                    const itemName = selectedItem ? selectedItem.item : null;

                    // Context-sensitive action
                    if (itemType === 'block') {
                        // Place block
                        this.game.placeBlock();

                        // Auto-place (slower than break)
                        if (this.mouseDownInterval) clearInterval(this.mouseDownInterval);
                        this.mouseDownInterval = setInterval(() => {
                            this.game.placeBlock();
                        }, 250);

                    } else if (itemType === 'food') {
                        // Eat food
                        this.game.useItem();
                        // Auto-eat? Maybe not.
                    } else {
                        // Default to Mining/Attacking (Pickaxe, Hand, etc.)
                        this.game.breakBlock();

                        // Auto-swing
                        if (this.mouseDownInterval) clearInterval(this.mouseDownInterval);
                        this.mouseDownInterval = setInterval(() => {
                            this.game.breakBlock();
                        }, 300);
                    }

                } else if (e.button === 2) { // Right Click (Secondary)
                    console.log('[DEBUG] Right click detected');
                    e.preventDefault();

                    // Bow aiming or interacting
                    const item = this.game.inventory.getSelectedItem();
                    if (item && item.item === 'bow') {
                        this.game.onRightClickDown();
                    } else {
                        // Fallback or specific interactions (like opening doors, chests, not implemented yet)
                    }
                }
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                if (this.mouseDownInterval) {
                    clearInterval(this.mouseDownInterval);
                    this.mouseDownInterval = null;
                }
            } else if (e.button === 2) {
                if (this.isLocked) {
                    this.game.onRightClickUp();
                }
            }
        });

        this.game.renderer.domElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Prevent context menu
        document.addEventListener('contextmenu', (e) => e.preventDefault());

        // Mouse wheel for block selection
        document.addEventListener('wheel', (e) => {
            if (this.isLocked) {
                const direction = e.deltaY > 0 ? 1 : -1;
                let newSlot = this.game.selectedSlot + direction;
                if (newSlot < 0) newSlot = 8;
                if (newSlot > 8) newSlot = 0;
                this.game.selectSlot(newSlot);
            }
        });

        // Click to lock pointer
        this.game.container.addEventListener('click', () => {
            console.log('[DEBUG click] Requesting pointer lock');
            if (document.pointerLockElement !== this.game.container) {
                this.game.container.requestPointerLock && this.game.container.requestPointerLock().catch((err) => {
                    console.log('[DEBUG] Pointer lock request failed:', err);
                });
            }
        });

        // Handle pointer lock change (e.g., user pressed Escape)
        document.addEventListener('pointerlockchange', () => {
            const isNowLocked = document.pointerLockElement === this.game.container;
            console.log('[DEBUG pointerlockchange] isNowLocked:', isNowLocked, 'pointerLockElement:', document.pointerLockElement);
            this.isLocked = isNowLocked;

            // Clear auto-swing if unlocked
            if (!this.isLocked && this.mouseDownInterval) {
                clearInterval(this.mouseDownInterval);
                this.mouseDownInterval = null;
            }
        });

        // Hotbar clicks
        document.querySelectorAll('.hotbar-slot').forEach((slot, index) => {
            slot.addEventListener('click', () => this.game.selectSlot(index));
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.game.camera.aspect = window.innerWidth / window.innerHeight;
            this.game.camera.updateProjectionMatrix();
            this.game.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
}
