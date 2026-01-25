/**
 * MobileControlsManager - Handles touch controls for mobile devices
 * Includes joysticks, action buttons, and mobile top bar
 */
export class MobileControlsManager {
    constructor(game, uiManager) {
        this.game = game;
        this.uiManager = uiManager;

        // Control elements
        this.joystickContainer = null;
        this.joystickKnob = null;
        this.lookJoystickContainer = null;
        this.lookJoystickKnob = null;
        this.jumpBtn = null;
        this.interactBtn = null;
        this.dropBtn = null;
        this.mobileTopBar = null;
        this.mobileInventoryBtn = null;
        this.mobileDebugBtn = null;
        this.mobileChatBtn = null;
        this.mobileSettingsBtn = null;
        this.mobileCameraBtn = null;
        this.mobileSprintBtn = null;
        this.mobileFlyBtn = null;

        // State
        this.isInitialized = false;
        this.sprintEnabled = false;
        this.flyEnabled = false;
    }

    /**
     * Initialize touch controls - only call if on touch device
     */
    initialize() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        this.createMovementJoystick();
        this.createLookJoystick();
        this.createActionButtons();
        this.createMobileTopBar();

        console.log('[MobileControlsManager] Touch controls initialized');
    }

    createMovementJoystick() {
        this.joystickContainer = document.createElement('div');
        this.joystickContainer.id = 'touch-joystick';
        this.joystickContainer.style.cssText = `
            position: fixed;
            bottom: 40px;
            left: 40px;
            width: 150px;
            height: 150px;
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            z-index: 1000;
            touch-action: none;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        this.joystickKnob = document.createElement('div');
        this.joystickKnob.style.cssText = `
            width: 60px;
            height: 60px;
            background: rgba(255, 255, 255, 0.5);
            border-radius: 50%;
            transition: transform 0.1s ease;
            pointer-events: none;
        `;
        this.joystickContainer.appendChild(this.joystickKnob);
        document.body.appendChild(this.joystickContainer);

        this.setupMovementJoystickEvents();
    }

    setupMovementJoystickEvents() {
        let joystickActive = false;
        let joystickTouchId = null;
        let rect = null;
        let centerX = 0;
        let centerY = 0;
        let maxRadius = 0;

        const updateRect = () => {
            rect = this.joystickContainer.getBoundingClientRect();
            centerX = rect.left + rect.width / 2;
            centerY = rect.top + rect.height / 2;
            maxRadius = rect.width / 2;
        };

        const handleJoystick = (clientX, clientY) => {
            const dx = clientX - centerX;
            const dy = clientY - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const angle = Math.atan2(dy, dx);
            const moveDist = Math.min(dist, maxRadius);

            const knobX = Math.cos(angle) * moveDist;
            const knobY = Math.sin(angle) * moveDist;

            this.joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;

            // Update InputManager actions
            const deadzone = 10;
            this.game.inputManager.actions['FORWARD'] = dy < -deadzone;
            this.game.inputManager.actions['BACKWARD'] = dy > deadzone;
            this.game.inputManager.actions['LEFT'] = dx < -deadzone;
            this.game.inputManager.actions['RIGHT'] = dx > deadzone;
        };

        const stopJoystick = () => {
            joystickActive = false;
            joystickTouchId = null;
            if (this.joystickKnob) this.joystickKnob.style.transform = `translate(0px, 0px)`;
            this.game.inputManager.actions['FORWARD'] = false;
            this.game.inputManager.actions['BACKWARD'] = false;
            this.game.inputManager.actions['LEFT'] = false;
            this.game.inputManager.actions['RIGHT'] = false;
        };

        // Touch Listeners
        this.joystickContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (joystickActive) return;

            const touch = e.changedTouches[0];
            joystickTouchId = touch.identifier;
            joystickActive = true;
            updateRect();
            handleJoystick(touch.clientX, touch.clientY);
        }, { passive: false });

        this.joystickContainer.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!joystickActive) return;

            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joystickTouchId) {
                    const touch = e.changedTouches[i];
                    handleJoystick(touch.clientX, touch.clientY);
                    break;
                }
            }
        }, { passive: false });

        const onTouchEnd = (e) => {
            if (!joystickActive) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joystickTouchId) {
                    stopJoystick();
                    break;
                }
            }
        };

        this.joystickContainer.addEventListener('touchend', onTouchEnd, { passive: false });
        this.joystickContainer.addEventListener('touchcancel', onTouchEnd, { passive: false });

        // Mouse Listeners (for testing on desktop)
        this.joystickContainer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            updateRect();
            joystickActive = true;
            joystickTouchId = 'mouse';
            handleJoystick(e.clientX, e.clientY);

            const onMouseMove = (moveEvent) => {
                if (joystickActive && joystickTouchId === 'mouse') {
                    handleJoystick(moveEvent.clientX, moveEvent.clientY);
                }
            };

            const onMouseUp = () => {
                if (joystickTouchId === 'mouse') {
                    stopJoystick();
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                }
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    }

    createLookJoystick() {
        this.lookJoystickContainer = document.createElement('div');
        this.lookJoystickContainer.id = 'touch-look-joystick';
        this.lookJoystickContainer.style.cssText = `
            position: fixed;
            bottom: 40px;
            right: 140px;
            width: 120px;
            height: 120px;
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            z-index: 1000;
            touch-action: none;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        this.lookJoystickKnob = document.createElement('div');
        this.lookJoystickKnob.style.cssText = `
            width: 50px;
            height: 50px;
            background: rgba(255, 255, 255, 0.5);
            border-radius: 50%;
            pointer-events: none;
        `;
        this.lookJoystickContainer.appendChild(this.lookJoystickKnob);
        document.body.appendChild(this.lookJoystickContainer);

        this.setupLookJoystickEvents();
    }

    setupLookJoystickEvents() {
        let lookJoystickActive = false;
        let lookJoystickTouchId = null;
        let lookRect = null;
        let lookCenterX = 0;
        let lookCenterY = 0;
        let lookMaxRadius = 0;
        let lookDeltaX = 0;
        let lookDeltaY = 0;
        let lookAnimationFrame = null;

        const updateLookRect = () => {
            lookRect = this.lookJoystickContainer.getBoundingClientRect();
            lookCenterX = lookRect.left + lookRect.width / 2;
            lookCenterY = lookRect.top + lookRect.height / 2;
            lookMaxRadius = lookRect.width / 2;
        };

        // Continuous rotation loop
        const lookRotationLoop = () => {
            if (!lookJoystickActive) {
                lookAnimationFrame = null;
                return;
            }

            if (this.game.player && (Math.abs(lookDeltaX) > 0.01 || Math.abs(lookDeltaY) > 0.01)) {
                this.game.player.rotate(lookDeltaX, lookDeltaY);
            }

            lookAnimationFrame = requestAnimationFrame(lookRotationLoop);
        };

        const handleLookJoystick = (clientX, clientY) => {
            const dx = clientX - lookCenterX;
            const dy = clientY - lookCenterY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const angle = Math.atan2(dy, dx);
            const moveDist = Math.min(dist, lookMaxRadius);

            const knobX = Math.cos(angle) * moveDist;
            const knobY = Math.sin(angle) * moveDist;

            this.lookJoystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;

            const sensitivity = 3.0;
            lookDeltaX = (dx / lookMaxRadius) * sensitivity;
            lookDeltaY = (dy / lookMaxRadius) * sensitivity;
        };

        const startLookJoystick = () => {
            if (!lookAnimationFrame) {
                lookAnimationFrame = requestAnimationFrame(lookRotationLoop);
            }
        };

        const stopLookJoystick = () => {
            lookJoystickActive = false;
            lookJoystickTouchId = null;
            lookDeltaX = 0;
            lookDeltaY = 0;
            if (this.lookJoystickKnob) this.lookJoystickKnob.style.transform = `translate(0px, 0px)`;
            if (lookAnimationFrame) {
                cancelAnimationFrame(lookAnimationFrame);
                lookAnimationFrame = null;
            }
        };

        // Touch Listeners
        this.lookJoystickContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (lookJoystickActive) return;

            const touch = e.changedTouches[0];
            lookJoystickTouchId = touch.identifier;
            lookJoystickActive = true;
            updateLookRect();
            handleLookJoystick(touch.clientX, touch.clientY);
            startLookJoystick();
        }, { passive: false });

        this.lookJoystickContainer.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!lookJoystickActive) return;

            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === lookJoystickTouchId) {
                    const touch = e.changedTouches[i];
                    handleLookJoystick(touch.clientX, touch.clientY);
                    break;
                }
            }
        }, { passive: false });

        const onLookTouchEnd = (e) => {
            if (!lookJoystickActive) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === lookJoystickTouchId) {
                    stopLookJoystick();
                    break;
                }
            }
        };

        this.lookJoystickContainer.addEventListener('touchend', onLookTouchEnd, { passive: false });
        this.lookJoystickContainer.addEventListener('touchcancel', onLookTouchEnd, { passive: false });

        // Mouse Listeners
        this.lookJoystickContainer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            updateLookRect();
            lookJoystickActive = true;
            lookJoystickTouchId = 'mouse';
            handleLookJoystick(e.clientX, e.clientY);
            startLookJoystick();

            const onMouseMove = (moveEvent) => {
                if (lookJoystickActive && lookJoystickTouchId === 'mouse') {
                    handleLookJoystick(moveEvent.clientX, moveEvent.clientY);
                }
            };

            const onMouseUp = () => {
                if (lookJoystickTouchId === 'mouse') {
                    stopLookJoystick();
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                }
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    }

    createActionButtons() {
        // Jump Button
        this.jumpBtn = document.createElement('div');
        this.jumpBtn.id = 'touch-jump';
        this.jumpBtn.innerText = 'JUMP';
        this.jumpBtn.style.cssText = `
            position: fixed;
            bottom: 40px;
            right: 40px;
            width: 80px;
            height: 80px;
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.4);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            z-index: 1000;
            touch-action: manipulation;
            user-select: none;
        `;
        document.body.appendChild(this.jumpBtn);

        const startJump = (e) => {
            if (e && e.cancelable) e.preventDefault();
            this.game.inputManager.actions['JUMP'] = true;
        };
        const stopJump = (e) => {
            if (e && e.cancelable) e.preventDefault();
            this.game.inputManager.actions['JUMP'] = false;
        };

        this.jumpBtn.addEventListener('touchstart', startJump, { passive: false });
        this.jumpBtn.addEventListener('touchend', stopJump, { passive: false });
        this.jumpBtn.addEventListener('mousedown', startJump);
        this.jumpBtn.addEventListener('mouseup', stopJump);
        this.jumpBtn.addEventListener('mouseleave', stopJump);

        // Interact Button
        this.interactBtn = document.createElement('div');
        this.interactBtn.id = 'touch-interact';
        this.interactBtn.innerText = 'E';
        this.interactBtn.style.cssText = `
            position: fixed;
            bottom: 140px;
            right: 40px;
            width: 60px;
            height: 60px;
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.4);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            z-index: 1000;
            touch-action: manipulation;
            user-select: none;
        `;
        document.body.appendChild(this.interactBtn);

        const triggerInteract = (e) => {
            if (e && e.cancelable) e.preventDefault();
            this.game.onRightClickDown();
        };

        this.interactBtn.addEventListener('touchstart', triggerInteract, { passive: false });
        this.interactBtn.addEventListener('mousedown', triggerInteract);

        // Drop Button
        this.dropBtn = document.createElement('div');
        this.dropBtn.id = 'touch-drop';
        this.dropBtn.innerHTML = '🗑️';
        this.dropBtn.style.cssText = `
            position: fixed;
            bottom: 220px;
            right: 50px;
            width: 40px;
            height: 40px;
            background: rgba(255, 68, 68, 0.2);
            border: 2px solid rgba(255, 68, 68, 0.5);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            z-index: 1000;
            touch-action: manipulation;
            cursor: pointer;
        `;
        this.dropBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.game.inventory) {
                this.game.inventory.dropCurrentItem();
            }
        }, { passive: false });
        document.body.appendChild(this.dropBtn);
    }

    createMobileTopBar() {
        this.mobileTopBar = document.createElement('div');
        this.mobileTopBar.id = 'mobile-top-bar';
        this.mobileTopBar.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 15px;
            z-index: 2500;
        `;

        const buttonStyle = `
            width: 50px;
            height: 50px;
            background: rgba(0, 0, 0, 0.6);
            border: 2px solid rgba(255, 255, 255, 0.4);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            touch-action: manipulation;
            user-select: none;
            cursor: pointer;
        `;

        // Inventory Button
        this.mobileInventoryBtn = this.createTopBarButton('📦', 'mobile-inventory-btn', buttonStyle, () => {
            this.game.toggleInventory();
        });
        this.mobileTopBar.appendChild(this.mobileInventoryBtn);

        // Debug Panel Button
        this.mobileDebugBtn = this.createTopBarButton('🔧', 'mobile-debug-btn', buttonStyle, () => {
            this.game.toggleDebugPanel();
        });
        this.mobileTopBar.appendChild(this.mobileDebugBtn);

        // Chat Panel Button
        this.mobileChatBtn = this.createTopBarButton('💬', 'mobile-chat-btn', buttonStyle, () => {
            if (this.game.agent) {
                this.game.agent.toggleChat();
            }
        });
        this.mobileTopBar.appendChild(this.mobileChatBtn);

        // Settings Button
        this.mobileSettingsBtn = this.createTopBarButton('⚙️', 'mobile-settings-btn', buttonStyle, () => {
            this.uiManager.toggleSettingsModal();
        });
        this.mobileTopBar.appendChild(this.mobileSettingsBtn);

        // Camera Button
        this.mobileCameraBtn = this.createTopBarButton('🎥', 'mobile-camera-btn', buttonStyle, () => {
            this.game.cycleCamera();
        });
        this.mobileTopBar.appendChild(this.mobileCameraBtn);

        // Sprint Toggle Button
        this.mobileSprintBtn = this.createTopBarButton('🏃', 'mobile-sprint-btn', buttonStyle, () => {
            this.toggleSprint();
        });
        this.mobileTopBar.appendChild(this.mobileSprintBtn);

        // Fly Toggle Button
        this.mobileFlyBtn = this.createTopBarButton('🕊️', 'mobile-fly-btn', buttonStyle, () => {
            this.toggleFly();
        });
        this.mobileTopBar.appendChild(this.mobileFlyBtn);

        document.body.appendChild(this.mobileTopBar);
    }

    createTopBarButton(icon, id, style, handler) {
        const btn = document.createElement('div');
        btn.id = id;
        btn.innerHTML = icon;
        btn.style.cssText = style;
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handler();
        }, { passive: false });
        btn.addEventListener('click', handler);
        return btn;
    }

    toggleSprint() {
        this.sprintEnabled = !this.sprintEnabled;
        if (this.game.player) {
            this.game.player.isSprinting = this.sprintEnabled;
        }
        if (this.mobileSprintBtn) {
            this.mobileSprintBtn.style.background = this.sprintEnabled
                ? 'rgba(0, 255, 0, 0.3)'
                : 'rgba(0, 0, 0, 0.6)';
        }
        console.log(`[MobileControlsManager] Sprint: ${this.sprintEnabled ? 'ON' : 'OFF'}`);
    }

    toggleFly() {
        this.flyEnabled = !this.flyEnabled;
        if (this.game.player) {
            this.game.player.isFlying = this.flyEnabled;
        }
        if (this.mobileFlyBtn) {
            this.mobileFlyBtn.style.background = this.flyEnabled
                ? 'rgba(100, 200, 255, 0.3)'
                : 'rgba(0, 0, 0, 0.6)';
        }
        console.log(`[MobileControlsManager] Fly: ${this.flyEnabled ? 'ON' : 'OFF'}`);
    }

    /**
     * Show or hide mobile controls
     * @param {boolean} visible
     */
    setVisible(visible) {
        console.log(`[MobileControlsManager] setVisible(${visible})`);

        if (visible && !this.isInitialized) {
            this.initialize();
        }

        // Toggle body class for CSS targeting
        if (visible) {
            document.body.classList.add('mobile-controls-active');
        } else {
            document.body.classList.remove('mobile-controls-active');
        }

        const display = visible ? 'flex' : 'none';
        if (this.joystickContainer) this.joystickContainer.style.display = display;
        if (this.lookJoystickContainer) this.lookJoystickContainer.style.display = display;
        if (this.jumpBtn) this.jumpBtn.style.display = display;
        if (this.interactBtn) this.interactBtn.style.display = display;
        if (this.dropBtn) this.dropBtn.style.display = display;
        if (this.mobileTopBar) this.mobileTopBar.style.display = display;

        // Toggle Desktop UI elements
        const desktopSettingsBtn = document.getElementById('settings-btn');
        const desktopChatBtn = document.getElementById('chat-button');

        const desktopDisplay = visible ? 'none' : 'block';
        if (desktopSettingsBtn) desktopSettingsBtn.style.display = desktopDisplay;
        if (desktopChatBtn) desktopChatBtn.style.display = desktopDisplay;

        // Let UIManager handle feedback button state
        if (this.uiManager.updateFeedbackButtonState) {
            this.uiManager.updateFeedbackButtonState();
        }
    }

    cleanup() {
        if (this.joystickContainer) this.joystickContainer.remove();
        if (this.lookJoystickContainer) this.lookJoystickContainer.remove();
        if (this.jumpBtn) this.jumpBtn.remove();
        if (this.interactBtn) this.interactBtn.remove();
        if (this.dropBtn) this.dropBtn.remove();
        if (this.mobileTopBar) this.mobileTopBar.remove();

        document.body.classList.remove('mobile-controls-active');

        this.isInitialized = false;
    }
}
