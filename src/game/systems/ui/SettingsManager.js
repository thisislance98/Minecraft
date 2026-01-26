/**
 * SettingsManager - Handles settings modal and preferences
 */
export class SettingsManager {
    constructor(game, uiManager) {
        this.game = game;
        this.uiManager = uiManager;

        // DOM Elements
        this.settingsModal = document.getElementById('settings-modal');
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsClose = document.getElementById('settings-close');
        this.resetWorldBtn = document.getElementById('reset-world-btn');
        this.settingsHelpBtn = document.getElementById('settings-help-btn');
        this.fullscreenBtn = document.getElementById('settings-fullscreen-btn');

        // Toggles
        this.audioToggle = document.getElementById('settings-audio-toggle');
        this.fpsToggle = document.getElementById('settings-fps-toggle');
        this.positionToggle = document.getElementById('settings-position-toggle');
        this.minimapToggle = document.getElementById('settings-minimap-toggle');
        this.mobileToggle = document.getElementById('settings-mobile-toggle');
        this.voiceToggle = document.getElementById('settings-voice-toggle');
        this.thoughtsToggle = document.getElementById('settings-thoughts-toggle');
        this.bypassTokensToggle = document.getElementById('settings-bypass-tokens-toggle');
        this.aiProviderToggle = document.getElementById('settings-ai-provider-toggle');
        this.modelModeToggle = document.getElementById('settings-model-mode-toggle');
        this.showCostToggle = document.getElementById('settings-show-cost-toggle');
        this.showNamePromptToggle = document.getElementById('settings-show-name-prompt-toggle');
        this.showHelpToggle = document.getElementById('settings-show-help-toggle');
        this.showAnnouncementsToggle = document.getElementById('settings-show-announcements-toggle');
        this.persistenceToggle = document.getElementById('settings-persistence-toggle');

        // Sliders
        this.jumpSlider = document.getElementById('settings-jump-slider');
        this.jumpValue = document.getElementById('jump-value');

        // HUD Elements
        this.fpsCounter = document.getElementById('fps-counter');
        this.debugElement = document.getElementById('debug');
    }

    initialize() {
        if (!this.settingsModal || !this.settingsBtn) {
            console.warn('[SettingsManager] Settings elements not found');
            return;
        }

        this.loadSavedPreferences();
        this.setupEventListeners();
    }

    loadSavedPreferences() {
        // Load and apply saved preferences
        const savedAudio = localStorage.getItem('settings_audio') !== 'false';
        const savedFps = localStorage.getItem('settings_fps') !== 'false';
        const savedPosition = localStorage.getItem('settings_position') !== 'false';
        const savedMinimap = localStorage.getItem('settings_minimap') === 'true';

        // Mobile Controls: default to auto-detected state if not previously set
        let savedMobile = localStorage.getItem('settings_mobile');
        if (savedMobile === null) {
            savedMobile = this.game.inputManager ? this.game.inputManager.isTouchDevice : false;
        } else {
            savedMobile = savedMobile === 'true';
        }

        // Apply initial states
        if (this.audioToggle) {
            this.audioToggle.checked = savedAudio;
            if (!savedAudio && this.game.soundManager) {
                this.game.soundManager.setMuted(true);
            }
        }

        if (this.fpsToggle) {
            this.fpsToggle.checked = savedFps;
        }
        if (this.fpsCounter) {
            this.fpsCounter.style.display = savedFps ? 'block' : 'none';
        }

        if (this.positionToggle) {
            this.positionToggle.checked = savedPosition;
            if (this.debugElement) {
                this.debugElement.style.display = savedPosition ? 'block' : 'none';
            }
        }

        if (this.minimapToggle) {
            this.minimapToggle.checked = savedMinimap;
            if (this.uiManager.minimap) {
                this.uiManager.minimap.setVisible(savedMinimap);
            }
        }

        if (this.mobileToggle) {
            this.mobileToggle.checked = savedMobile;
            this.game.gameState.flags.mobileControls = savedMobile;
            this.uiManager.mobileControlsManager.setVisible(savedMobile);
        }

        // Voice Chat toggle
        if (this.voiceToggle) {
            const savedVoice = localStorage.getItem('settings_voice') === 'true';
            this.voiceToggle.checked = savedVoice;
            if (this.game.socketManager) {
                this.game.socketManager.voiceChatManager.setVoiceChatEnabled(savedVoice);
            }
        }

        // Merlin Thoughts toggle
        if (this.thoughtsToggle) {
            const savedThoughts = localStorage.getItem('settings_thoughts') === 'true';
            this.thoughtsToggle.checked = savedThoughts;
            if (window.merlinClient) {
                window.merlinClient.thinkingEnabled = savedThoughts;
            }
        }

        // Bypass Tokens toggle
        if (this.bypassTokensToggle) {
            const savedBypassTokens = localStorage.getItem('settings_bypass_tokens') !== 'false';
            this.bypassTokensToggle.checked = savedBypassTokens;
            if (window.merlinClient) {
                window.merlinClient.bypassTokens = savedBypassTokens;
            }
        }

        // AI Provider toggle
        if (this.aiProviderToggle) {
            const savedProvider = localStorage.getItem('settings_ai_provider') || 'gemini';
            this.aiProviderToggle.checked = savedProvider === 'claude';
            if (window.merlinClient) {
                window.merlinClient.aiProvider = savedProvider;
            }
        }

        // Model Mode toggle
        if (this.modelModeToggle) {
            const savedModelMode = localStorage.getItem('settings_model_mode') || 'smart';
            this.modelModeToggle.checked = savedModelMode === 'smart';
            if (window.merlinClient) {
                window.merlinClient.modelMode = savedModelMode;
            }
        }

        // Show Cost toggle
        if (this.showCostToggle) {
            const savedShowCost = localStorage.getItem('settings_show_cost') === 'true';
            this.showCostToggle.checked = savedShowCost;
            if (window.merlinClient) {
                window.merlinClient.showCost = savedShowCost;
            }
        }

        // Startup toggles
        if (this.showNamePromptToggle) {
            const savedShowNamePrompt = localStorage.getItem('settings_show_name_prompt') === 'true';
            this.showNamePromptToggle.checked = savedShowNamePrompt;
        }

        if (this.showHelpToggle) {
            const savedShowHelp = localStorage.getItem('settings_show_help') === 'true';
            this.showHelpToggle.checked = savedShowHelp;
        }

        if (this.showAnnouncementsToggle) {
            const savedShowAnnouncements = localStorage.getItem('settings_show_announcements') === 'true';
            this.showAnnouncementsToggle.checked = savedShowAnnouncements;
        }

        // Persistence toggle
        if (this.persistenceToggle) {
            const savedPersistence = localStorage.getItem('settings_persistence') === 'true';
            this.persistenceToggle.checked = savedPersistence;
        }

        // Jump slider
        if (this.jumpSlider) {
            const savedJump = localStorage.getItem('settings_jump');
            const jumpForce = savedJump !== null ? parseFloat(savedJump) : 0.15;
            this.jumpSlider.value = jumpForce;
            if (this.jumpValue) this.jumpValue.textContent = jumpForce.toFixed(2);
            if (this.game.player) {
                this.game.player.jumpForce = jumpForce;
            }
        }
    }

    setupEventListeners() {
        // Settings button click - open modal
        this.settingsBtn.addEventListener('click', () => {
            this.openSettings();
        });

        // Help button in settings
        if (this.settingsHelpBtn) {
            this.settingsHelpBtn.addEventListener('click', () => {
                if (this.uiManager.helpModal) {
                    this.uiManager.helpModal.classList.remove('hidden');
                }
            });
        }

        // Close button
        if (this.settingsClose) {
            this.settingsClose.addEventListener('click', () => {
                this.settingsModal.classList.add('hidden');
            });
        }

        // Click outside to close
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.settingsModal.classList.add('hidden');
            }
        });

        // Audio toggle
        if (this.audioToggle) {
            this.audioToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_audio', enabled);
                if (this.game.soundManager) {
                    this.game.soundManager.setMuted(!enabled);
                }
                if (this.uiManager.muteBtn) {
                    this.uiManager.muteBtn.textContent = enabled ? '🔊' : '🔇';
                }
            });
        }

        // Voice Chat toggle
        if (this.voiceToggle) {
            this.voiceToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_voice', enabled);
                if (this.game.socketManager) {
                    this.game.socketManager.voiceChatManager.setVoiceChatEnabled(enabled);
                }
                this.uiManager.updateVoiceButtonState(enabled);
            });
        }

        // Merlin Thoughts toggle
        if (this.thoughtsToggle) {
            this.thoughtsToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_thoughts', enabled);
                if (window.merlinClient) {
                    window.merlinClient.thinkingEnabled = enabled;
                    console.log('[SettingsManager] Merlin thoughts', enabled ? 'enabled' : 'disabled');
                }
            });
        }

        // Bypass Tokens toggle
        if (this.bypassTokensToggle) {
            this.bypassTokensToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_bypass_tokens', enabled);
                if (window.merlinClient) {
                    window.merlinClient.bypassTokens = enabled;
                    console.log('[SettingsManager] Bypass tokens', enabled ? 'enabled' : 'disabled');
                }
            });
        }

        // AI Provider toggle
        if (this.aiProviderToggle) {
            this.aiProviderToggle.addEventListener('change', (e) => {
                const useClaude = e.target.checked;
                const provider = useClaude ? 'claude' : 'gemini';
                localStorage.setItem('settings_ai_provider', provider);

                if (window.merlinClient) {
                    window.merlinClient.aiProvider = provider;
                    console.log('[SettingsManager] AI Provider switched to:', provider);
                    window.merlinClient.connect();
                }

                if (useClaude) {
                    alert('🧙 Claude Code mode enabled!\n\nMerlin will now use Claude Code with custom skills.\n\nTo interact:\n1. Use the Claude Code terminal where you started the game\n2. Merlin has skills for creating creatures, items, and structures\n3. Example: "Create a bouncing slime creature"');
                }
            });
        }

        // Model Mode toggle
        if (this.modelModeToggle) {
            this.modelModeToggle.addEventListener('change', (e) => {
                const useSmart = e.target.checked;
                const mode = useSmart ? 'smart' : 'cheap';
                localStorage.setItem('settings_model_mode', mode);

                if (window.merlinClient) {
                    window.merlinClient.modelMode = mode;
                    console.log('[SettingsManager] Model mode switched to:', mode);
                }
            });
        }

        // Show Cost toggle
        if (this.showCostToggle) {
            this.showCostToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_show_cost', enabled);
                if (window.merlinClient) {
                    window.merlinClient.showCost = enabled;
                    console.log('[SettingsManager] Show cost', enabled ? 'enabled' : 'disabled');
                }
            });
        }

        // Startup Settings toggles
        if (this.showNamePromptToggle) {
            this.showNamePromptToggle.addEventListener('change', (e) => {
                localStorage.setItem('settings_show_name_prompt', e.target.checked);
            });
        }

        if (this.showHelpToggle) {
            this.showHelpToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_show_help', enabled);
                if (enabled) {
                    localStorage.removeItem('hasSeenHelp');
                }
            });
        }

        if (this.showAnnouncementsToggle) {
            this.showAnnouncementsToggle.addEventListener('change', (e) => {
                localStorage.setItem('settings_show_announcements', e.target.checked);
            });
        }

        // FPS toggle
        if (this.fpsToggle) {
            this.fpsToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_fps', enabled);
                if (this.fpsCounter) {
                    this.fpsCounter.style.display = enabled ? 'block' : 'none';
                }
            });
        }

        // Position toggle
        if (this.positionToggle) {
            this.positionToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_position', enabled);
                if (this.debugElement) {
                    this.debugElement.style.display = enabled ? 'block' : 'none';
                }
            });
        }

        // Minimap toggle
        if (this.minimapToggle) {
            this.minimapToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_minimap', enabled);
                if (this.uiManager.minimap) {
                    this.uiManager.minimap.setVisible(enabled);
                }
            });
        }

        // Mobile Toggle
        if (this.mobileToggle) {
            this.mobileToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_mobile', enabled);
                this.game.gameState.flags.mobileControls = enabled;
                this.uiManager.mobileControlsManager.setVisible(enabled);
                this.uiManager.updateFeedbackButtonState();
            });
        }

        // Persistence Toggle
        if (this.persistenceToggle) {
            this.persistenceToggle.addEventListener('change', (e) => {
                localStorage.setItem('settings_persistence', e.target.checked);
            });
        }

        // Jump slider
        if (this.jumpSlider) {
            this.jumpSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (this.jumpValue) this.jumpValue.textContent = value.toFixed(2);
                localStorage.setItem('settings_jump', value);
                if (this.game.player) {
                    this.game.player.jumpForce = value;
                }
            });
        }

        // Fullscreen Toggle (Mobile Only)
        if (this.fullscreenBtn) {
            if (this.game.inputManager && this.game.inputManager.isTouchDevice) {
                this.fullscreenBtn.classList.remove('hidden');
            }

            const updateFullscreenBtnText = () => {
                const isFullscreen = document.fullscreenElement ||
                    document.webkitFullscreenElement ||
                    document.mozFullScreenElement ||
                    document.msFullscreenElement;
                this.fullscreenBtn.innerHTML = isFullscreen ? '⛶ Exit Fullscreen' : '⛶ Go Fullscreen';
            };

            this.fullscreenBtn.addEventListener('click', () => {
                const doc = window.document;
                const docEl = doc.documentElement;

                const requestFullScreen = docEl.requestFullscreen ||
                    docEl.mozRequestFullScreen ||
                    docEl.webkitRequestFullScreen ||
                    docEl.msRequestFullscreen;

                const cancelFullScreen = doc.exitFullscreen ||
                    doc.mozCancelFullScreen ||
                    doc.webkitExitFullscreen ||
                    doc.msExitFullscreen;

                if (!document.fullscreenElement && !document.mozFullScreenElement &&
                    !document.webkitFullscreenElement && !document.msFullscreenElement) {
                    if (requestFullScreen) requestFullScreen.call(docEl);
                } else {
                    if (cancelFullScreen) cancelFullScreen.call(doc);
                }
            });

            document.addEventListener('fullscreenchange', updateFullscreenBtnText);
            document.addEventListener('webkitfullscreenchange', updateFullscreenBtnText);
            document.addEventListener('mozfullscreenchange', updateFullscreenBtnText);
            document.addEventListener('MSFullscreenChange', updateFullscreenBtnText);

            updateFullscreenBtnText();
        }

        // Reset World button
        if (this.resetWorldBtn) {
            this.resetWorldBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleResetWorld();
            });
        }

        // World Warp buttons
        this.setupWarpButtons();
    }

    setupWarpButtons() {
        const warpButtons = {
            'settings-warp-earth': 'earth',
            'settings-warp-crystal': 'crystal',
            'settings-warp-lava': 'lava',
            'settings-warp-moon': 'moon',
            'settings-warp-soccer': 'soccer'
        };

        for (const [buttonId, worldType] of Object.entries(warpButtons)) {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', () => {
                    console.log(`[SettingsManager] Warp button clicked: ${worldType}`);
                    this.warpToWorld(worldType);
                });
            } else {
                console.warn(`[SettingsManager] Warp button not found: ${buttonId}`);
            }
        }
    }

    warpToWorld(worldType) {
        console.log(`[SettingsManager] Warping to world: ${worldType}`);

        // Close settings modal
        if (this.settingsModal) {
            this.settingsModal.classList.add('hidden');
        }

        // Use SpaceShipManager if available
        if (this.game.spaceShipManager && typeof this.game.spaceShipManager.warpToWorld === 'function') {
            this.game.spaceShipManager.warpToWorld(worldType);
        } else {
            console.error('[SettingsManager] SpaceShipManager not available for warp');
            alert('World warp is not available right now. Try again after the game fully loads.');
        }
    }

    openSettings() {
        if (!this.settingsModal) return;
        this.settingsModal.classList.remove('hidden');

        // Sync toggle states with current settings
        if (this.audioToggle && this.game.soundManager) {
            this.audioToggle.checked = !this.game.soundManager.isMuted;
        }
        if (this.minimapToggle) {
            this.minimapToggle.checked = this.uiManager.minimap ? this.uiManager.minimap.visible : false;
        }
    }

    toggleSettingsModal() {
        if (!this.settingsModal) return false;

        const isHidden = this.settingsModal.classList.contains('hidden');
        if (isHidden) {
            this.openSettings();
        } else {
            this.settingsModal.classList.add('hidden');
        }
        return isHidden;
    }

    handleResetWorld() {
        if (!confirm('Are you sure you want to reset this world to its default state? This cannot be undone.')) {
            return;
        }

        // Close settings modal
        this.settingsModal.classList.add('hidden');

        // Request world reset from socket manager
        if (this.game.socketManager) {
            this.game.socketManager.requestWorldReset();
        }
    }

    cleanup() {
        // Nothing to clean up
    }
}
