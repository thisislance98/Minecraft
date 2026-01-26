import * as THREE from 'three';
import { DebugPanel } from '../ui/DebugPanel.js';
import { CommunityUI } from '../ui/CommunityUI.js';
import { Minimap } from '../ui/Minimap.js';
import { MinigameManager } from '../minigames/MinigameManager.js';
import { MerlinPanelUI } from '../ui/MerlinPanelUI.js';
import { auth } from '../../config/firebase-client.js';

// Sub-managers (extracted for modularity)
import { NotificationManager } from './ui/NotificationManager.js';
import { HUDManager } from './ui/HUDManager.js';
import { DialogueManager } from './ui/DialogueManager.js';
import { MobileControlsManager } from './ui/MobileControlsManager.js';
import { ChatManager } from './ui/ChatManager.js';
import { SettingsManager } from './ui/SettingsManager.js';
import { GraphicsSettingsManager } from './ui/GraphicsSettingsManager.js';
import { ModalManager } from './ui/ModalManager.js';
import { VoiceUIManager } from './ui/VoiceUIManager.js';
import { SpellUIManager } from './ui/SpellUIManager.js';
import { MinigameUIManager } from './ui/MinigameUIManager.js';
import { SignEditorManager } from './ui/SignEditorManager.js';
import { SpaceshipUIManager } from './ui/SpaceshipUIManager.js';

/**
 * UIManager centralizes all HUD/UI updates.
 * This decouples UI manipulation from game logic.
 *
 * The UIManager coordinates sub-managers for specific UI concerns:
 * - NotificationManager: Toast notifications and refresh prompts
 * - HUDManager: FPS counter, position display, block count
 * - DialogueManager: Speech bubbles and dialogue boxes
 * - MobileControlsManager: Touch joysticks and mobile buttons
 * - ChatManager: Chat panel, messages, modes (AI, Group, Player)
 * - SettingsManager: Settings modal and preferences
 * - GraphicsSettingsManager: Graphics quality presets and toggles
 * - ModalManager: Tutorial, help, death screen modals
 * - VoiceUIManager: Voice chat buttons and indicators
 * - SpellUIManager: Spell selector and spell creator
 * - MinigameUIManager: Survival mode, soccer scoreboard UIs
 * - SignEditorManager: Sign text input modal
 * - SpaceshipUIManager: Spaceship control deck UI
 */
export class UIManager {
    constructor(game) {
        this.game = game;

        // Initialize sub-managers
        this.notificationManager = new NotificationManager(game, this);
        this.hudManager = new HUDManager(game, this);
        this.dialogueManager = new DialogueManager(game, this);
        this.mobileControlsManager = new MobileControlsManager(game, this);
        this.chatManager = new ChatManager(game, this);
        this.settingsManager = new SettingsManager(game, this);
        this.graphicsSettingsManager = new GraphicsSettingsManager(game, this);
        this.modalManager = new ModalManager(game, this);
        this.voiceUIManager = new VoiceUIManager(game, this);
        this.spellUIManager = new SpellUIManager(game, this);
        this.minigameUIManager = new MinigameUIManager(game, this);
        this.signEditorManager = new SignEditorManager(game, this);
        this.spaceshipUIManager = new SpaceshipUIManager(game, this);

        // Cache DOM elements (legacy - some still needed for direct access)
        this.fpsElement = document.getElementById('fps');
        this.fpsCounter = document.getElementById('fps-counter');
        this.positionElement = document.getElementById('position');
        this.blockCountElement = document.getElementById('block-count');

        // Debug panel
        this.debugPanel = new DebugPanel(game);

        // Community/Feedback UI
        this.communityUI = new CommunityUI(game);

        // Minimap
        this.minimap = new Minimap(game);

        // Merlin Panel UI
        this.merlinPanel = new MerlinPanelUI(game);
        window.merlinPanelUI = this.merlinPanel;

        // Wire up TaskManager to MerlinPanel
        if (window.merlinClient && window.merlinClient.taskManager) {
            this.merlinPanel.setTaskManager(window.merlinClient.taskManager);
        }

        // Feedback button
        this.createFeedbackButton();

        // FPS tracking
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();

        // Legacy chat references (delegate to chatManager)
        this.chatPanel = this.chatManager.chatPanel;
        this.chatMessages = this.chatManager.chatMessages;
        this.chatInput = this.chatManager.chatInput;
        this.sendBtn = this.chatManager.sendBtn;

        // Idea Button
        const ideaBtn = document.getElementById('idea-btn');
        if (ideaBtn) {
            ideaBtn.onclick = () => {
                this.game.agent?.requestIdea();
            };
        }

        // Minigame Manager (xbox UI)
        this.minigameManager = new MinigameManager(game);

        // Initialize sub-managers
        this.chatManager.initialize();
        this.settingsManager.initialize();
        this.graphicsSettingsManager.initialize();
        this.modalManager.initialize();
        this.voiceUIManager.initialize();
        this.signEditorManager.initialize();

        // Mobile Controls - use sub-manager
        if (this.game.inputManager && this.game.inputManager.isTouchDevice) {
            this.mobileControlsManager.initialize();
        }

        // Listen for world join events
        window.addEventListener('worldJoined', (e) => {
            this.onWorldJoined(e.detail);
        });
    }

    /**
     * Handle world join event - show/hide reset button based on ownership
     */
    onWorldJoined(data) {
        const isOwner = data.permissions?.isOwner === true;
        const resetBtn = document.getElementById('reset-world-btn');
        if (resetBtn) {
            resetBtn.style.display = isOwner ? 'block' : 'none';
        }
        console.log(`[UIManager] World joined: ${data.world?.name}, isOwner: ${isOwner}`);
    }

    /**
     * Check if any panel/modal is currently open that should block hotkeys
     */
    isAnyPanelOpen() {
        if (this.merlinPanel && this.merlinPanel.isVisible) return true;
        if (this.debugPanel && this.debugPanel.isVisible) return true;
        if (window.spawnUI && window.spawnUI.isOpen) return true;
        if (window.worldSettingsUI && window.worldSettingsUI.isVisible) return true;
        if (this.communityUI && this.communityUI.isOpen) return true;
        if (window.feedbackUI && window.feedbackUI.isOpen) return true;

        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal && !settingsModal.classList.contains('hidden')) return true;

        const helpModal = document.getElementById('help-modal');
        if (helpModal && !helpModal.classList.contains('hidden')) return true;

        if (this.game && this.game.gameState && this.game.gameState.flags.inventoryOpen) return true;

        return false;
    }

    closeAllMenus(exclude = null) {
        if (this.chatManager.chatPanel) this.chatManager.chatPanel.classList.add('hidden');
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) settingsModal.classList.add('hidden');
        const helpModal = document.getElementById('help-modal');
        if (helpModal) helpModal.classList.add('hidden');
        if (this.minigameManager) this.minigameManager.closeXboxUI();
        if (window.spawnUI && window.spawnUI !== exclude) window.spawnUI.closePanel();
    }

    showXboxUI() {
        if (this.minigameManager) {
            this.minigameManager.showXboxUI();
        }
    }

    // ============ Delegation Methods to Sub-Managers ============

    // Chat Manager delegations
    toggleChatPanel(show) { this.chatManager.toggleChatPanel(show); }
    setChatMode(mode) { this.chatManager.setChatMode(mode); }
    addChatMessage(type, message, options) { return this.chatManager.addChatMessage(type, message, options); }
    updateChatMessageContent(msgId, text) { this.chatManager.updateChatMessageContent(msgId, text); }
    showThinking() { this.chatManager.showThinking(); }
    hideThinking() { this.chatManager.hideThinking(); }
    toggleStopButton(visible) { this.chatManager.toggleStopButton(visible); }
    showSuggestions(suggestions) { this.chatManager.showSuggestions(suggestions); }
    handleSendMessage() { this.chatManager.handleSendMessage(); }
    updateChatModeIndicator(isTypingMode) { this.chatManager.updateChatModeIndicator(isTypingMode); }
    removeChatModeIndicator() { this.chatManager.removeChatModeIndicator(); }
    setupChatListener() { /* handled in chatManager.initialize() */ }
    setupChatTabListeners() { /* handled in chatManager.initialize() */ }
    setupChatPanelListeners() { /* handled in chatManager.initialize() */ }

    // Notification Manager delegations
    showNotification(message, type, duration) {
        this.notificationManager.showGameNotification(message, type, duration);
    }
    showRefreshPrompt() { this.notificationManager.showRefreshPrompt(); }

    // Settings Manager delegations
    openSettings() { this.settingsManager.openSettings(); }
    toggleSettingsModal() { return this.settingsManager.toggleSettingsModal(); }
    setupSettingsMenu() { /* handled in settingsManager.initialize() */ }

    // Graphics Settings Manager delegations
    setupGraphicsSettings() { /* handled in graphicsSettingsManager.initialize() */ }
    applyGraphicsPreset(preset) { this.graphicsSettingsManager.applyGraphicsPreset(preset); }
    applyGraphicsSettings(settings) { this.graphicsSettingsManager.applyGraphicsSettings(settings); }
    updatePresetButtonState(preset) { this.graphicsSettingsManager.updatePresetButtonState(preset); }

    // Modal Manager delegations
    setupTutorialModal() { /* handled on demand */ }
    showTutorialModal() { this.modalManager.showTutorialModal(); }
    hideTutorialModal() { this.modalManager.hideTutorialModal(); }
    setupHelpModal() { /* handled in modalManager.initialize() */ }
    createDeathScreen() { this.modalManager.createDeathScreen(); }
    showDeathScreen() { this.modalManager.showDeathScreen(); }
    hideDeathScreen() { this.modalManager.hideDeathScreen(); }
    handleRespawn() { this.modalManager.handleRespawn(); }
    get helpModal() { return this.modalManager.helpModal; }

    // Voice UI Manager delegations
    setupVoiceButton() { /* handled in voiceUIManager.initialize() */ }
    setupMerlinVoiceButton() { /* handled in voiceUIManager.initialize() */ }
    createMuteButton() { /* handled in voiceUIManager.initialize() */ }
    updateVoiceButtonState(enabled) { this.voiceUIManager.updateVoiceButtonState(enabled); }
    toggleVoiceTransmitIndicator(active) { this.voiceUIManager.toggleVoiceTransmitIndicator(active); }
    get muteBtn() { return this.voiceUIManager.muteBtn; }

    // Spell UI Manager delegations
    createSpellSelector() { this.spellUIManager.createSpellSelector(); }
    updateSpellSelector(spells, currentIndex) { this.spellUIManager.updateSpellSelector(spells, currentIndex); }
    toggleSpellSelector(show) { this.spellUIManager.toggleSpellSelector(show); }
    createSpellCreator() { this.spellUIManager.createSpellCreator(); }
    openSpellCreator(wandItem) { this.spellUIManager.openSpellCreator(wandItem); }
    closeSpellCreator() { this.spellUIManager.closeSpellCreator(); }
    handleCreateSpell() { this.spellUIManager.handleCreateSpell(); }

    // Minigame UI Manager delegations
    createSurvivalUI() { this.minigameUIManager.createSurvivalUI(); }
    updateSurvivalUI(seconds, wave) { this.minigameUIManager.updateSurvivalUI(seconds, wave); }
    showSurvivalUI(show) { this.minigameUIManager.showSurvivalUI(show); }
    showHighscoreBoard(scores, currentScore) { this.minigameUIManager.showHighscoreBoard(scores, currentScore); }
    showSoccerScoreboard() { this.minigameUIManager.showSoccerScoreboard(); }
    hideSoccerScoreboard() { this.minigameUIManager.hideSoccerScoreboard(); }
    updateSoccerScoreboard(blueScore, orangeScore) { this.minigameUIManager.updateSoccerScoreboard(blueScore, orangeScore); }
    showSoccerWinScreen(winner) { this.minigameUIManager.showSoccerWinScreen(winner); }
    hideSoccerWinScreen() { this.minigameUIManager.hideSoccerWinScreen(); }

    // Sign Editor Manager delegations
    createSignInputUI() { /* handled in signEditorManager.initialize() */ }
    showSignInput(callback, initialText) { this.signEditorManager.showSignInput(callback, initialText); }
    toggleSignInput(show) { this.signEditorManager.toggleSignInput(show); }

    // Spaceship UI Manager delegations
    showSpaceShipControls(visible) { this.spaceshipUIManager.showSpaceShipControls(visible); }

    // Dialogue Manager delegations
    showVillagerSpeech(villager, text) { this.dialogueManager.showVillagerSpeech(villager, text); }
    showVillagerChatPrompt(villager) { this.dialogueManager.showVillagerChatPrompt(villager); }
    hideVillagerChatPrompt() { this.dialogueManager.hideVillagerChatPrompt(); }
    hideVillagerSpeech() { this.dialogueManager.hideVillagerSpeech(); }

    // HUD Manager delegations
    updateNetworkStatus(status, role, roomId) { this.hudManager.updateNetworkStatus(status, role, roomId); }
    updateRemotePlayerStatus(id, pos, rotY, name) { this.hudManager.updateRemotePlayerStatus(id, pos, rotY, name); }
    createRemotePlayersHUD() { this.hudManager.createRemotePlayersHUD(); }

    // Debug Panel
    toggleDebugPanel() {
        if (this.debugPanel) {
            this.debugPanel.toggle();
            return this.debugPanel.isVisible;
        }
        return false;
    }

    // ============ Direct UIManager Methods ============

    update(dt) {
        // Update speech bubbles via sub-manager
        this.dialogueManager.update(dt);
    }

    updateFeedbackButtonState() {
        if (!this.feedbackBtn) return;

        const isMobile = this.game.gameState.flags.mobileControls;
        const isProfilerVisible = this.game.perf && this.game.perf.visible;
        const isPerfTabActive = this.debugPanel?.container?.querySelector('.debug-tab[data-tab="perf"]')?.classList.contains('active') || false;
        const shouldHide = isMobile || isProfilerVisible || isPerfTabActive;

        this.feedbackBtn.style.display = shouldHide ? 'none' : 'block';
    }

    createFeedbackButton() {
        const btn = document.createElement('button');
        btn.id = 'feedback-btn';
        btn.innerHTML = '💬 Community';
        btn.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.6);
            color: #ffcc00;
            border: 2px solid #ffcc00;
            border-radius: 20px;
            padding: 8px 16px;
            font-family: 'VT323', monospace;
            font-size: 18px;
            cursor: pointer;
            z-index: 1000;
            transition: all 0.2s;
            box-shadow: 0 0 10px rgba(255, 204, 0, 0.2);
        `;

        btn.onmouseover = () => {
            btn.style.background = 'rgba(0, 0, 0, 0.8)';
            btn.style.boxShadow = '0 0 15px rgba(255, 204, 0, 0.4)';
            btn.style.transform = 'scale(1.05)';
        };
        btn.onmouseout = () => {
            btn.style.background = 'rgba(0, 0, 0, 0.6)';
            btn.style.boxShadow = '0 0 10px rgba(255, 204, 0, 0.2)';
            btn.style.transform = 'scale(1)';
        };

        btn.onclick = () => {
            this.communityUI.toggle();
            btn.blur();
        };

        document.body.appendChild(btn);
        this.feedbackBtn = btn;
    }

    // ============ Legacy AI Task Methods ============
    // These are kept for backward compatibility with Agent code

    createStatusIndicator() {
        // Legacy - not used with new MerlinPanel
    }

    createTaskListUI() {
        // Legacy - task UI now handled by MerlinPanel
    }

    updateAIStatus(status) {
        // Legacy - delegate to MerlinPanel if needed
        // Note: updateStatus is optional on MerlinPanel
        if (this.merlinPanel && typeof this.merlinPanel.updateStatus === 'function') {
            this.merlinPanel.updateStatus(status);
        }
    }

    updateVoiceStatus(active, text) {
        // Legacy - handled by MerlinPanel
    }

    updateTask(taskId, status, message) {
        // Legacy - handled by MerlinPanel TaskManager
    }

    // ============ Cleanup ============

    cleanup() {
        // Cleanup all sub-managers
        this.notificationManager.cleanup();
        this.chatManager.cleanup();
        this.modalManager.cleanup();
        this.voiceUIManager.cleanup();
        this.spellUIManager.cleanup();
        this.minigameUIManager.cleanup();
        this.signEditorManager.cleanup();
        this.spaceshipUIManager.cleanup();

        // Cleanup direct elements
        if (this.feedbackBtn) this.feedbackBtn.remove();
    }
}
