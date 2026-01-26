/**
 * ChatManager - Handles chat panel, messages, modes (AI, Group, Player)
 */
export class ChatManager {
    constructor(game, uiManager) {
        this.game = game;
        this.uiManager = uiManager;

        // Chat Panel elements
        this.chatPanel = document.getElementById('chat-panel');
        this.chatMessagesAI = document.getElementById('chat-messages-ai');
        this.chatMessagesGroup = document.getElementById('chat-messages-group');
        this.chatMessagesPlayer = document.getElementById('chat-messages-player');
        this.chatMessages = this.chatMessagesGroup; // Default to Group
        this.chatInput = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('send-chat');
        this.closeBtn = document.getElementById('close-chat');
        this.copyChatBtn = document.getElementById('copy-chat');
        this.clearChatBtn = document.getElementById('clear-chat');

        // Chat mode state: 'ai', 'group', 'player'
        this.chatMode = 'group';

        // Chat scroll state
        this.userHasScrolledUp = false;

        // Player chat overlay
        this.playerChatOverlay = null;
        this.playerChatInputField = null;
        this.isPlayerChatOpen = false;

        // Thinking indicator
        this.thinkingDiv = null;

        // Chat mode indicator
        this.chatModeIndicator = null;
    }

    initialize() {
        this.setupChatTabListeners();
        this.setupChatPanelListeners();
        this.setupChatListener();
    }

    setupChatListener() {
        const chatBtn = document.getElementById('chat-button');
        if (chatBtn) {
            chatBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.game.agent) {
                    this.game.agent.toggleChat();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            // Only trigger if not already in an input and game is active
            if (e.code === 'KeyT' && !this.isPlayerChatOpen &&
                document.activeElement.tagName !== 'INPUT' &&
                document.activeElement.tagName !== 'TEXTAREA') {
                e.preventDefault();
                this.toggleChatPanel(true);
                // Always default to Merlin (AI) tab when pressing 't'
                this.setChatMode('ai');
                console.log('[ChatManager] T key pressed - opening chat with AI (Merlin) mode');
                setTimeout(() => this.chatInput?.focus(), 100);
            } else if (e.code === 'Escape' && !this.chatPanel.classList.contains('hidden')) {
                e.preventDefault();
                this.toggleChatPanel(false);
            }
        });
    }

    setupChatTabListeners() {
        const tabs = document.querySelectorAll('.chat-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const mode = tab.dataset.mode;
                this.setChatMode(mode);
            });
        });
    }

    /**
     * Switch between chat modes
     * @param {'ai' | 'group' | 'player'} mode - The chat mode to switch to
     */
    setChatMode(mode) {
        this.chatMode = mode;

        // Update tab active states
        const tabs = document.querySelectorAll('.chat-tab');
        tabs.forEach(tab => {
            if (tab.dataset.mode === mode) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Show/hide message containers
        if (this.chatMessagesAI) {
            this.chatMessagesAI.classList.toggle('active', mode === 'ai');
        }
        if (this.chatMessagesGroup) {
            this.chatMessagesGroup.classList.toggle('active', mode === 'group');
        }
        if (this.chatMessagesPlayer) {
            this.chatMessagesPlayer.classList.toggle('active', mode === 'player');
        }

        // Update chatMessages reference for current mode
        if (mode === 'ai') {
            this.chatMessages = this.chatMessagesAI;
        } else if (mode === 'group') {
            this.chatMessages = this.chatMessagesGroup;
        } else if (mode === 'player') {
            this.chatMessages = this.chatMessagesPlayer;
        }

        // Update placeholder text
        if (this.chatInput) {
            const placeholders = {
                'ai': 'Ask the AI wizard...',
                'group': 'Message everyone...',
                'player': 'Say something (speech bubble)...'
            };
            this.chatInput.placeholder = placeholders[mode] || 'Type a message...';
        }

        console.log(`[ChatManager] Chat mode switched to: ${mode}`);
    }

    setupChatPanelListeners() {
        if (!this.chatPanel) return;

        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => {
                if (this.game.agent && this.game.agent.isStreaming) {
                    this.game.agent.interruptGeneration();
                } else {
                    this.handleSendMessage();
                }
            });
        }

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => {
                if (this.game.agent) this.game.agent.toggleChat();
            });
        }

        if (this.copyChatBtn) {
            this.copyChatBtn.onclick = () => this.copyChatToClipboard();
        }

        if (this.clearChatBtn) {
            this.clearChatBtn.onclick = () => this.clearChatHistory();
        }

        if (this.chatInput) {
            this.chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    if (this.game.agent && this.game.agent.isStreaming) return;
                    this.handleSendMessage();
                }
            });
        }

        // Smart Auto-scroll Listener
        if (this.chatMessages) {
            this.chatMessages.addEventListener('scroll', () => {
                const threshold = 20;
                const isAtBottom = this.chatMessages.scrollHeight -
                    this.chatMessages.scrollTop - this.chatMessages.clientHeight < threshold;
                this.userHasScrolledUp = !isAtBottom;
            });
        }
    }

    handleSendMessage() {
        const message = this.chatInput?.value?.trim();
        if (!message) return;

        // Handle differently based on chat mode
        if (this.chatMode === 'ai') {
            // Send to AI Agent
            if (this.game.agent) {
                this.addChatMessage('user', message);
                this.chatInput.value = '';
                this.game.agent.sendTextMessage(message);
            }
        } else if (this.chatMode === 'group') {
            // Send group chat via SocketManager
            if (this.game.socketManager) {
                this.game.socketManager.sendChatMessage(message);
                this.chatInput.value = '';
            }
        } else if (this.chatMode === 'player') {
            // Show as speech bubble
            if (this.game.socketManager) {
                this.game.socketManager.sendPlayerSpeech(message);
                this.chatInput.value = '';
            }
        }
    }

    toggleChatPanel(show) {
        if (!this.chatPanel) return;

        const shouldShow = show !== undefined ? show : this.chatPanel.classList.contains('hidden');

        if (shouldShow) {
            this.chatPanel.classList.remove('hidden');
            if (this.game.inputManager) this.game.inputManager.unlock();
            setTimeout(() => this.chatInput?.focus(), 100);
        } else {
            this.chatPanel.classList.add('hidden');
            this.removeChatModeIndicator();
            if (this.game.inputManager) this.game.inputManager.lock();
        }
    }

    /**
     * Add a message to the chat panel
     * @param {'user' | 'ai' | 'system' | 'player'} type - Message type
     * @param {string} message - Message content
     * @param {Object} options - Additional options (playerName, playerId)
     * @returns {HTMLElement} The message element
     */
    addChatMessage(type, message, options = {}) {
        if (!this.chatMessages) return null;

        const div = document.createElement('div');
        div.className = `message ${type}`;
        if (options.playerId) {
            div.dataset.playerId = options.playerId;
        }

        // Generate unique ID for message
        const msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        div.id = msgId;

        let prefix = '';
        if (type === 'user') prefix = '🧑 You';
        else if (type === 'ai') prefix = '🧙 Merlin';
        else if (type === 'system') prefix = '⚙️ System';
        else if (type === 'player' && options.playerName) prefix = `💬 ${options.playerName}`;
        else if (type === 'player') prefix = '💬 Player';

        div.innerHTML = `
            <span class="message-prefix">${prefix}</span>
            <span class="message-content">${message}</span>
        `;

        this.chatMessages.appendChild(div);

        // Auto-scroll to bottom (only if user hasn't scrolled up)
        if (!this.userHasScrolledUp) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }

        return div;
    }

    updateChatMessageContent(msgId, text) {
        const el = document.getElementById(msgId);
        if (!el) return;

        const contentEl = el.querySelector('.message-content');
        if (contentEl) {
            contentEl.innerHTML = text;

            // Auto-scroll to bottom (only if user hasn't scrolled up)
            if (!this.userHasScrolledUp && this.chatMessages) {
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            }
        }
    }

    copyChatToClipboard() {
        if (!this.chatMessages) return;

        let conversationText = "";
        const messages = this.chatMessages.querySelectorAll('.message');

        messages.forEach(msg => {
            const content = msg.querySelector('.message-content').innerText;
            const isUser = msg.classList.contains('user');
            const isAI = msg.classList.contains('ai');
            const isSystem = msg.classList.contains('system');

            if (isUser) conversationText += `User: ${content}\n`;
            else if (isAI) conversationText += `AI: ${content}\n`;
            else if (isSystem) conversationText += `System: ${content}\n`;
            else conversationText += `${content}\n`;
        });

        navigator.clipboard.writeText(conversationText).then(() => {
            const originalText = this.copyChatBtn.innerHTML;
            this.copyChatBtn.innerHTML = "✓";
            setTimeout(() => {
                if (this.copyChatBtn) this.copyChatBtn.innerHTML = originalText;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy chat:', err);
        });
    }

    clearChatHistory() {
        if (!this.chatMessages) return;

        if (!confirm('Clear all chat history for this tab? This cannot be undone.')) {
            return;
        }

        const messages = this.chatMessages.querySelectorAll('.message');
        messages.forEach(msg => msg.remove());

        this.addChatMessage('system', 'Chat history cleared.');

        const originalText = this.clearChatBtn.innerHTML;
        this.clearChatBtn.innerHTML = "✓";
        setTimeout(() => {
            if (this.clearChatBtn) this.clearChatBtn.innerHTML = originalText;
        }, 2000);

        console.log(`[ChatManager] Cleared chat history for mode: ${this.chatMode}`);
    }

    toggleStopButton(visible) {
        if (!this.sendBtn) return;

        if (visible) {
            this.sendBtn.innerText = "Stop";
            this.sendBtn.classList.add('stop-btn');
            if (this.game.agent) this.game.agent.isStreaming = true;
        } else {
            this.sendBtn.innerText = "Send";
            this.sendBtn.classList.remove('stop-btn');
            if (this.game.agent) this.game.agent.isStreaming = false;
        }
    }

    showThinking() {
        if (this.thinkingDiv) return;

        const div = document.createElement('div');
        div.className = 'message ai thinking';
        div.style.cssText = `
            display: flex;
            align-items: center;
            gap: 5px;
        `;
        div.innerHTML = `
            <span>Thinking</span>
            <span class="dot-flashing"></span>
            <style>
                .dot-flashing {
                    position: relative;
                    width: 4px;
                    height: 4px;
                    border-radius: 2px;
                    background-color: #aaa;
                    color: #aaa;
                    animation: dot-flashing 1s infinite linear alternate;
                    animation-delay: 0.5s;
                    margin-left: 10px;
                }
                .dot-flashing::before, .dot-flashing::after {
                    content: '';
                    display: inline-block;
                    position: absolute;
                    top: 0;
                }
                .dot-flashing::before {
                    left: -8px;
                    width: 4px;
                    height: 4px;
                    border-radius: 2px;
                    background-color: #aaa;
                    color: #aaa;
                    animation: dot-flashing 1s infinite alternate;
                    animation-delay: 0s;
                }
                .dot-flashing::after {
                    left: 8px;
                    width: 4px;
                    height: 4px;
                    border-radius: 2px;
                    background-color: #aaa;
                    color: #aaa;
                    animation: dot-flashing 1s infinite alternate;
                    animation-delay: 1s;
                }
                @keyframes dot-flashing {
                    0% { background-color: #aaa; }
                    50%, 100% { background-color: rgba(170, 170, 170, 0.2); }
                }
            </style>
        `;

        if (this.chatMessages) {
            this.chatMessages.appendChild(div);
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
        this.thinkingDiv = div;
    }

    hideThinking() {
        if (this.thinkingDiv) {
            this.thinkingDiv.remove();
            this.thinkingDiv = null;
        }
    }

    showSuggestions(suggestions) {
        if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) return;

        // Remove existing suggestion container if any
        const existing = this.chatMessages?.querySelector('.suggestion-container');
        if (existing) existing.remove();

        const container = document.createElement('div');
        container.className = 'suggestion-container';
        container.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding: 10px;
            background: rgba(65, 105, 225, 0.1);
            border-radius: 8px;
            margin-top: 10px;
        `;

        suggestions.forEach(suggestion => {
            const btn = document.createElement('button');
            btn.className = 'suggestion-btn';
            btn.textContent = suggestion;
            btn.style.cssText = `
                background: rgba(65, 105, 225, 0.2);
                border: 1px solid rgba(65, 105, 225, 0.5);
                color: #8bb4ff;
                padding: 6px 12px;
                border-radius: 16px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
            `;
            btn.onmouseover = () => {
                btn.style.background = 'rgba(65, 105, 225, 0.4)';
            };
            btn.onmouseout = () => {
                btn.style.background = 'rgba(65, 105, 225, 0.2)';
            };
            btn.onclick = () => {
                this.chatInput.value = suggestion;
                this.handleSendMessage();
                container.remove();
            };
            container.appendChild(btn);
        });

        if (this.chatMessages) {
            this.chatMessages.appendChild(container);
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }

    updateChatModeIndicator(isTypingMode) {
        if (!this.chatModeIndicator) {
            const indicator = document.createElement('div');
            indicator.id = 'chat-mode-indicator';
            indicator.style.cssText = `
                position: absolute;
                top: 8px;
                right: 50px;
                padding: 4px 8px;
                border-radius: 4px;
                font-family: 'VT323', monospace;
                font-size: 14px;
                z-index: 1001;
            `;
            if (this.chatPanel) {
                this.chatPanel.style.position = 'relative';
                this.chatPanel.appendChild(indicator);
            }
            this.chatModeIndicator = indicator;
        }

        if (isTypingMode) {
            this.chatModeIndicator.textContent = '💬 Typing (Tab to move)';
            this.chatModeIndicator.style.background = 'rgba(0, 255, 204, 0.3)';
            this.chatModeIndicator.style.color = '#00ffcc';
        } else {
            this.chatModeIndicator.textContent = '🎮 Moving (Tab to type)';
            this.chatModeIndicator.style.background = 'rgba(255, 200, 0, 0.3)';
            this.chatModeIndicator.style.color = '#ffc800';
        }
    }

    removeChatModeIndicator() {
        if (this.chatModeIndicator) {
            this.chatModeIndicator.remove();
            this.chatModeIndicator = null;
        }
    }

    // Player chat overlay methods (legacy)
    createPlayerChatInput() {
        const overlay = document.createElement('div');
        overlay.id = 'player-chat-overlay';
        overlay.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 2000;
            display: none;
        `;

        const container = document.createElement('div');
        container.style.cssText = `
            background: rgba(0, 0, 0, 0.85);
            padding: 12px 16px;
            border-radius: 8px;
            display: flex;
            gap: 10px;
            align-items: center;
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;

        const label = document.createElement('span');
        label.textContent = '💬';
        label.style.cssText = 'font-size: 18px;';
        container.appendChild(label);

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Say something...';
        input.maxLength = 100;
        input.style.cssText = `
            width: 300px;
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.15);
            color: white;
            font-size: 14px;
            outline: none;
        `;
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.code === 'Enter') {
                e.preventDefault();
                this.sendPlayerChat();
            }
        });
        container.appendChild(input);
        this.playerChatInputField = input;

        const sendBtn = document.createElement('button');
        sendBtn.textContent = 'Send';
        sendBtn.style.cssText = `
            padding: 8px 16px;
            background: #4a9eff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
        `;
        sendBtn.addEventListener('click', () => this.sendPlayerChat());
        container.appendChild(sendBtn);

        overlay.appendChild(container);
        document.body.appendChild(overlay);
        this.playerChatOverlay = overlay;
        this.isPlayerChatOpen = false;
    }

    showPlayerChatInput() {
        if (!this.playerChatOverlay) return;
        this.playerChatOverlay.style.display = 'block';
        this.playerChatInputField.value = '';
        this.playerChatInputField.focus();
        this.isPlayerChatOpen = true;

        if (this.game.inputManager) {
            this.game.inputManager.unlock();
        }
    }

    hidePlayerChatInput() {
        if (!this.playerChatOverlay) return;
        this.playerChatOverlay.style.display = 'none';
        this.isPlayerChatOpen = false;

        if (this.game.inputManager) {
            this.game.inputManager.lock();
        }
    }

    sendPlayerChat() {
        const message = this.playerChatInputField?.value?.trim();
        if (!message) {
            this.hidePlayerChatInput();
            return;
        }

        if (this.game.socketManager) {
            this.game.socketManager.sendChatMessage(message);
        }

        this.hidePlayerChatInput();
    }

    cleanup() {
        if (this.playerChatOverlay) {
            this.playerChatOverlay.remove();
        }
        if (this.chatModeIndicator) {
            this.chatModeIndicator.remove();
        }
    }
}
