/**
 * MerlinPanelUI - Chat-based Merlin AI panel
 *
 * Replaces the old task-based UI with a conversational chat interface.
 * Features:
 * - Streaming AI responses (token-by-token)
 * - Collapsible inline code blocks with copy
 * - Action badges with coordinates
 * - Welcome screen with suggestion chips
 * - Follow-up suggestion chips after each response
 * - Model selector dropdown
 */

import { getRandomSuggestions } from '../ai/MerlinSuggestions.js';

export class MerlinPanelUI {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        this.fewShotClient = null;

        // Chat state
        this.messages = []; // { id, role, content, timestamp, code?, action?, costInfo?, isStreaming }
        this.messageCounter = 0;
        this.isWaitingForResponse = false;

        // Streaming state
        this.currentStreamingId = null;
        this.pendingTokens = '';
        this.rafId = null;

        // Model selection
        this.availableModels = [];
        this.currentModel = localStorage.getItem('fewshot_model') || 'anthropic/claude-haiku-4.5';

        this.createPanel();
        this.setupEventListeners();
        this.setupMerlinButton();

        console.log('[MerlinPanelUI] Chat UI initialized');
    }

    /**
     * Set the FewShotClient reference (replaces old setTaskManager)
     */
    setFewShotClient(fewShotClient) {
        // Guard against duplicate listener registration
        if (this.fewShotClient === fewShotClient && this._listenerAttached) {
            console.log('[MerlinPanelUI] FewShotClient already wired, skipping duplicate');
            return;
        }

        this.fewShotClient = fewShotClient;

        if (this.fewShotClient) {
            this._listenerAttached = true;
            this.fewShotClient.addListener((msg) => {
                this.handleFewShotMessage(msg);
            });

            // Populate models if already available
            if (this.fewShotClient.availableModels.length > 0) {
                this.updateModelList(this.fewShotClient.availableModels, this.fewShotClient.currentModel);
            }
        }
    }

    /**
     * Handle all messages from FewShotClient
     */
    handleFewShotMessage(msg) {
        switch (msg.type) {
            case 'models_list':
                this.updateModelList(msg.models, msg.current);
                break;
            case 'model_changed':
                this.updateSelectedModel(msg.model);
                break;
            case 'chat_start':
                this.startAIMessage(msg.messageId);
                break;
            case 'chat_token':
                this.appendToAIMessage(msg.messageId, msg.text);
                break;
            case 'chat_code':
                this.attachCodeBlock(msg.messageId, msg.code, msg.language, msg.description);
                break;
            case 'chat_action':
                this.attachActionBadge(msg.messageId, msg);
                break;
            case 'chat_cost':
                this.attachCostBadge(msg.messageId, msg);
                break;
            case 'chat_end':
                this.finalizeAIMessage(msg.messageId);
                break;
            case 'chat_error':
                this.handleAIError(msg.messageId, msg.error);
                break;
            case 'error':
                this.handleConnectionError(msg.message);
                break;
        }
    }

    // ============================================================
    // MODEL MANAGEMENT
    // ============================================================

    updateModelList(models, currentModel) {
        this.availableModels = models;
        if (currentModel) this.currentModel = currentModel;

        const select = document.getElementById('merlin-model-select');
        if (!select) return;

        const modelsByProvider = {};
        for (const model of models) {
            const [provider] = model.id.split('/');
            if (!modelsByProvider[provider]) modelsByProvider[provider] = [];
            modelsByProvider[provider].push(model);
        }

        let html = '';
        for (const [provider, providerModels] of Object.entries(modelsByProvider)) {
            const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
            html += `<optgroup label="${this.escapeHtml(providerName)}">`;
            for (const model of providerModels) {
                const selected = model.id === this.currentModel ? 'selected' : '';
                const costBadge = { 'very-low': '\u{1F49A}', low: '\u{1F49B}', medium: '\u{1F9E1}', high: '\u{2764}\uFE0F' }[model.cost] || '';
                html += `<option value="${this.escapeHtml(model.id)}" ${selected}>${this.escapeHtml(model.name)} ${costBadge}</option>`;
            }
            html += '</optgroup>';
        }

        select.innerHTML = html;
    }

    updateSelectedModel(modelId) {
        this.currentModel = modelId;
        const select = document.getElementById('merlin-model-select');
        if (select) select.value = modelId;
    }

    selectModel(modelId) {
        if (!this.fewShotClient) return;
        this.fewShotClient.setModel(modelId);
        this.currentModel = modelId;
    }

    // ============================================================
    // MESSAGE SENDING
    // ============================================================

    sendMessage(text) {
        if (!text.trim() || this.isWaitingForResponse) return;

        // Add user message to UI
        this.addUserMessage(text.trim());

        // Hide welcome screen
        this.hideWelcomeScreen();

        // Send to server
        this.isWaitingForResponse = true;
        this.updateSendButton();

        if (this.fewShotClient) {
            this.fewShotClient.send({
                type: 'input',
                text: text.trim(),
                context: this.fewShotClient.getContext(),
                category: 'custom'
            });
        }

        // Clear input
        const input = document.getElementById('merlin-chat-input');
        if (input) {
            input.value = '';
            input.style.height = 'auto';
        }
    }

    // ============================================================
    // CHAT MESSAGE RENDERING
    // ============================================================

    addUserMessage(text) {
        const id = `user_${++this.messageCounter}`;
        this.messages.push({
            id,
            role: 'user',
            content: text,
            timestamp: Date.now()
        });

        const container = document.getElementById('merlin-chat-messages');
        if (!container) return;

        const msgEl = document.createElement('div');
        msgEl.className = 'merlin-msg merlin-msg-user';
        msgEl.dataset.messageId = id;
        msgEl.innerHTML = `<div class="merlin-msg-bubble">${this.escapeHtml(text)}</div>`;
        container.appendChild(msgEl);

        this.scrollToBottom();
    }

    startAIMessage(messageId) {
        this.currentStreamingId = messageId;

        this.messages.push({
            id: messageId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true
        });

        const container = document.getElementById('merlin-chat-messages');
        if (!container) return;

        const msgEl = document.createElement('div');
        msgEl.className = 'merlin-msg merlin-msg-ai';
        msgEl.dataset.messageId = messageId;
        msgEl.innerHTML = `
            <div class="merlin-msg-avatar">&#x1F9D9;</div>
            <div class="merlin-msg-content">
                <div class="merlin-msg-text"></div>
                <div class="merlin-msg-attachments"></div>
                <div class="merlin-msg-streaming-indicator"><span class="streaming-orb"></span></div>
            </div>
        `;
        container.appendChild(msgEl);
        this.scrollToBottom();
    }

    appendToAIMessage(messageId, text) {
        // Update data model
        const msg = this.messages.find(m => m.id === messageId);
        if (msg) msg.content += text;

        // Batch DOM updates via requestAnimationFrame
        this.pendingTokens += text;

        if (!this.rafId) {
            this.rafId = requestAnimationFrame(() => {
                this.flushPendingTokens(messageId);
                this.rafId = null;
            });
        }
    }

    flushPendingTokens(messageId) {
        if (!this.pendingTokens) return;

        const msgEl = document.querySelector(`.merlin-msg[data-message-id="${messageId}"] .merlin-msg-text`);
        if (msgEl) {
            // Parse markdown-like bold (**text**) and newlines
            const currentHtml = msgEl.innerHTML;
            const msg = this.messages.find(m => m.id === messageId);
            if (msg) {
                msgEl.innerHTML = this.formatMessageText(msg.content);
            }
        }

        this.pendingTokens = '';
        this.scrollToBottom();
    }

    formatMessageText(text) {
        // Simple markdown: **bold**, \n -> <br>
        return this.escapeHtml(text)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }

    attachCodeBlock(messageId, code, language, description) {
        const msg = this.messages.find(m => m.id === messageId);
        if (msg) {
            msg.code = { code, language, description };
        }

        const attachments = document.querySelector(`.merlin-msg[data-message-id="${messageId}"] .merlin-msg-attachments`);
        if (!attachments) return;

        const codeId = `code_${messageId}`;
        const codeBlock = document.createElement('div');
        codeBlock.className = 'merlin-code-block';
        codeBlock.innerHTML = `
            <div class="merlin-code-header" data-code-id="${codeId}">
                <span class="code-toggle-icon">&#x25B8;</span>
                <span class="code-label">${this.escapeHtml(description || `${language} code`)}</span>
                <button class="code-copy-btn" title="Copy code">&#x1F4CB;</button>
            </div>
            <pre class="merlin-code-content hidden" id="${codeId}"><code>${this.escapeHtml(code)}</code></pre>
        `;

        // Toggle expand/collapse
        const header = codeBlock.querySelector('.merlin-code-header');
        header.addEventListener('click', (e) => {
            if (e.target.closest('.code-copy-btn')) return;
            const content = document.getElementById(codeId);
            const icon = header.querySelector('.code-toggle-icon');
            content.classList.toggle('hidden');
            icon.textContent = content.classList.contains('hidden') ? '\u25B8' : '\u25BE';
        });

        // Copy button
        const copyBtn = codeBlock.querySelector('.code-copy-btn');
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(code).then(() => {
                copyBtn.textContent = '\u2705';
                setTimeout(() => { copyBtn.textContent = '\u{1F4CB}'; }, 1500);
            });
        });

        attachments.appendChild(codeBlock);
        this.scrollToBottom();
    }

    attachActionBadge(messageId, actionData) {
        const msg = this.messages.find(m => m.id === messageId);
        if (msg) {
            msg.action = actionData;
        }

        const attachments = document.querySelector(`.merlin-msg[data-message-id="${messageId}"] .merlin-msg-attachments`);
        if (!attachments) return;

        const pos = actionData.position;
        const posStr = pos ? `(${pos.x}, ${pos.y}, ${pos.z})` : '';
        const actionLabels = {
            'spawn_creature': `\u{1F4CD} Spawned ${actionData.name} ${posStr}`,
            'give_item': `\u{1F392} Added ${actionData.name} to inventory`,
            'build_structure': `\u{1F3D7}\uFE0F Built structure ${posStr}`,
            'set_blocks': `\u{1F9F1} Placed blocks ${posStr}`
        };

        const badge = document.createElement('div');
        badge.className = 'merlin-action-badge';
        badge.textContent = actionLabels[actionData.action] || `${actionData.action}: ${actionData.name}`;
        attachments.appendChild(badge);
        this.scrollToBottom();
    }

    attachCostBadge(messageId, costData) {
        const msg = this.messages.find(m => m.id === messageId);
        if (msg) msg.costInfo = costData;

        // Cost badge is tiny, shown after message finalizes
    }

    finalizeAIMessage(messageId) {
        this.isWaitingForResponse = false;
        this.currentStreamingId = null;
        this.updateSendButton();

        // Flush any remaining tokens
        if (this.pendingTokens) {
            this.flushPendingTokens(messageId);
        }

        // Remove streaming indicator
        const indicator = document.querySelector(`.merlin-msg[data-message-id="${messageId}"] .merlin-msg-streaming-indicator`);
        if (indicator) indicator.remove();

        // Add cost badge
        const msg = this.messages.find(m => m.id === messageId);
        if (msg) {
            msg.isStreaming = false;
        }
        if (msg?.costInfo) {
            const attachments = document.querySelector(`.merlin-msg[data-message-id="${messageId}"] .merlin-msg-attachments`);
            if (attachments) {
                const costEl = document.createElement('div');
                costEl.className = 'merlin-cost-badge';
                const cost = msg.costInfo.totalCostUSD;
                costEl.textContent = `$${cost < 0.001 ? '<0.001' : cost.toFixed(3)} \u00B7 ${msg.costInfo.model?.split('/').pop() || ''}`;
                attachments.appendChild(costEl);
            }
        }

        // Show follow-up suggestions
        this.showFollowUpChips(msg);
        this.scrollToBottom();
    }

    handleAIError(messageId, error) {
        this.isWaitingForResponse = false;
        this.currentStreamingId = null;
        this.updateSendButton();

        const msgEl = document.querySelector(`.merlin-msg[data-message-id="${messageId}"]`);
        if (msgEl) {
            const textEl = msgEl.querySelector('.merlin-msg-text');
            if (textEl) {
                textEl.innerHTML += `<span class="merlin-error-text"><br>\u274C Error: ${this.escapeHtml(error)}</span>`;
            }
            const indicator = msgEl.querySelector('.merlin-msg-streaming-indicator');
            if (indicator) indicator.remove();
        }
    }

    handleConnectionError(error) {
        // Show as a system message
        const container = document.getElementById('merlin-chat-messages');
        if (!container) return;

        const errEl = document.createElement('div');
        errEl.className = 'merlin-msg merlin-msg-system';
        errEl.innerHTML = `<div class="merlin-msg-bubble merlin-msg-error">\u26A0\uFE0F ${this.escapeHtml(error)}</div>`;
        container.appendChild(errEl);
        this.scrollToBottom();
    }

    // ============================================================
    // FOLLOW-UP & SUGGESTION CHIPS
    // ============================================================

    showFollowUpChips(msg) {
        const chipsContainer = document.getElementById('merlin-followup-chips');
        if (!chipsContainer) return;

        let suggestions = [];

        if (msg?.action) {
            const action = msg.action.action;
            if (action === 'spawn_creature') {
                suggestions = ['Make it bigger', 'Change its color', 'Make it fly', 'Add more details'];
            } else if (action === 'give_item') {
                suggestions = ['Make it more powerful', 'Add particle effects', 'Change the design'];
            } else if (action === 'build_structure') {
                suggestions = ['Add windows', 'Make it taller', 'Add a roof', 'Change material'];
            }
        }

        if (suggestions.length === 0) {
            suggestions = ['Create a dragon', 'Build a house', 'Make a magic wand'];
        }

        // Show at most 3
        suggestions = suggestions.slice(0, 3);
        chipsContainer.innerHTML = suggestions.map(s =>
            `<button class="merlin-chip">${this.escapeHtml(s)}</button>`
        ).join('');
        chipsContainer.classList.remove('hidden');
    }

    showWelcomeScreen() {
        const welcome = document.getElementById('merlin-welcome');
        if (welcome) welcome.classList.remove('hidden');
        const followups = document.getElementById('merlin-followup-chips');
        if (followups) followups.classList.add('hidden');

        // Populate suggestion chips
        this.populateWelcomeSuggestions();
    }

    hideWelcomeScreen() {
        const welcome = document.getElementById('merlin-welcome');
        if (welcome) welcome.classList.add('hidden');
    }

    populateWelcomeSuggestions() {
        const container = document.getElementById('merlin-welcome-suggestions');
        if (!container) return;

        // Get mixed category suggestions
        const suggestions = [
            ...getRandomSuggestions('creature', 2),
            ...getRandomSuggestions('build', 2),
            ...getRandomSuggestions('item', 2),
            'Surprise me with something cool!',
            'What can you create?'
        ].sort(() => Math.random() - 0.5).slice(0, 8);

        const icons = ['\u{1F981}', '\u{1F3D7}\uFE0F', '\u2694\uFE0F', '\u2728', '\u{1F409}', '\u{1F3F0}', '\u{1FA84}', '\u{1F31F}'];
        container.innerHTML = suggestions.map((s, i) =>
            `<button class="merlin-welcome-chip">${icons[i % icons.length]} ${this.escapeHtml(s)}</button>`
        ).join('');
    }

    // ============================================================
    // PANEL DOM STRUCTURE
    // ============================================================

    createPanel() {
        const panel = document.createElement('div');
        panel.id = 'merlin-panel';
        panel.className = 'hidden';
        panel.innerHTML = `
            <div class="merlin-panel-content">
                <div class="merlin-panel-header">
                    <span class="merlin-title">&#x1F9D9; Merlin</span>
                    <div class="merlin-model-selector">
                        <select id="merlin-model-select" title="Select AI Model">
                            <option value="">Loading...</option>
                        </select>
                    </div>
                    <button id="merlin-panel-close" class="merlin-close-btn">&times;</button>
                </div>

                <div class="merlin-chat-area" id="merlin-chat-area">
                    <!-- Welcome screen -->
                    <div class="merlin-welcome" id="merlin-welcome">
                        <div class="merlin-welcome-icon">&#x1F9D9;</div>
                        <h3>Welcome! What would you like to create?</h3>
                        <p class="merlin-welcome-sub">I can make creatures, items, and structures.</p>
                        <div class="merlin-welcome-suggestions" id="merlin-welcome-suggestions"></div>
                    </div>

                    <!-- Chat messages -->
                    <div class="merlin-chat-messages" id="merlin-chat-messages"></div>
                </div>

                <!-- Follow-up chips -->
                <div class="merlin-followup-chips hidden" id="merlin-followup-chips"></div>

                <!-- Input area -->
                <div class="merlin-input-area">
                    <textarea id="merlin-chat-input" placeholder="Ask Merlin..." rows="1"></textarea>
                    <button id="merlin-send-btn" class="merlin-send-btn" title="Send (Enter)">
                        <span class="send-icon">&#x27A4;</span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(panel);
        this.injectStyles();
    }

    setupEventListeners() {
        const addListener = (id, event, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, handler);
        };

        // Close button
        addListener('merlin-panel-close', 'click', () => this.hide());

        // Send button
        addListener('merlin-send-btn', 'click', () => {
            const input = document.getElementById('merlin-chat-input');
            if (input) this.sendMessage(input.value);
        });

        // Input: Enter to send, Shift+Enter for newline
        addListener('merlin-chat-input', 'keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage(e.target.value);
            }
        });

        // Auto-resize textarea
        addListener('merlin-chat-input', 'input', (e) => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
        });

        // Model selector
        addListener('merlin-model-select', 'change', (e) => {
            if (e.target.value) this.selectModel(e.target.value);
        });

        // Welcome suggestion chips (delegated)
        const welcomeChips = document.getElementById('merlin-welcome-suggestions');
        if (welcomeChips) {
            welcomeChips.addEventListener('click', (e) => {
                const chip = e.target.closest('.merlin-welcome-chip');
                if (chip) {
                    // Strip emoji prefix
                    const text = chip.textContent.trim().replace(/^[^\w]*/, '').trim();
                    this.sendMessage(text);
                }
            });
        }

        // Follow-up chips (delegated)
        const followupChips = document.getElementById('merlin-followup-chips');
        if (followupChips) {
            followupChips.addEventListener('click', (e) => {
                const chip = e.target.closest('.merlin-chip');
                if (chip) {
                    this.sendMessage(chip.textContent.trim());
                }
            });
        }

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                const input = document.getElementById('merlin-chat-input');
                if (document.activeElement === input) {
                    input.blur();
                } else {
                    this.hide();
                }
            }
        });
    }

    setupMerlinButton() {
        const topRightControls = document.getElementById('top-right-controls');
        if (topRightControls) {
            const worldBtn = document.getElementById('world-btn');

            const merlinBtn = document.createElement('button');
            merlinBtn.id = 'merlin-btn';
            merlinBtn.title = "Merlin's Workshop (M)";
            merlinBtn.textContent = '\u{1F9D9}';
            merlinBtn.addEventListener('click', () => this.toggle());

            if (worldBtn && worldBtn.nextSibling) {
                topRightControls.insertBefore(merlinBtn, worldBtn.nextSibling);
            } else if (worldBtn) {
                topRightControls.appendChild(merlinBtn);
            } else {
                topRightControls.insertBefore(merlinBtn, topRightControls.firstChild);
            }
        }
    }

    // ============================================================
    // PANEL VISIBILITY
    // ============================================================

    toggle() {
        if (this.isVisible) this.hide();
        else this.show();
    }

    show() {
        const panel = document.getElementById('merlin-panel');
        if (!panel) return;

        // Close other panels
        document.querySelectorAll('.game-panel').forEach(p => p.classList.add('hidden'));

        panel.classList.remove('hidden');
        this.isVisible = true;

        // Show welcome screen if no messages
        if (this.messages.length === 0) {
            this.showWelcomeScreen();
        }

        // Focus input
        setTimeout(() => {
            const input = document.getElementById('merlin-chat-input');
            if (input) input.focus();
        }, 100);
    }

    hide() {
        const panel = document.getElementById('merlin-panel');
        if (panel) panel.classList.add('hidden');
        this.isVisible = false;

        const gameContainer = document.getElementById('game-container');
        if (gameContainer) gameContainer.focus();
    }

    scrollToBottom() {
        const chatArea = document.getElementById('merlin-chat-area');
        if (chatArea) {
            requestAnimationFrame(() => {
                chatArea.scrollTop = chatArea.scrollHeight;
            });
        }
    }

    updateSendButton() {
        const btn = document.getElementById('merlin-send-btn');
        if (btn) {
            btn.disabled = this.isWaitingForResponse;
            btn.classList.toggle('disabled', this.isWaitingForResponse);
        }
    }

    // ============================================================
    // HELPERS
    // ============================================================

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ============================================================
    // CSS STYLES
    // ============================================================

    injectStyles() {
        if (document.getElementById('merlin-chat-styles')) return;

        const style = document.createElement('style');
        style.id = 'merlin-chat-styles';
        style.textContent = `
            /* ======== PANEL CONTAINER ======== */
            #merlin-panel {
                position: fixed;
                top: 0;
                right: 0;
                width: 400px;
                height: 100vh;
                z-index: 10000;
                font-family: 'VT323', monospace;
                display: flex;
                flex-direction: column;
                background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
                border-left: 2px solid rgba(138, 43, 226, 0.4);
                box-shadow: -5px 0 30px rgba(0, 0, 0, 0.6);
                transition: transform 0.3s ease;
            }
            #merlin-panel.hidden {
                display: none;
            }

            .merlin-panel-content {
                display: flex;
                flex-direction: column;
                height: 100%;
                overflow: hidden;
            }

            /* ======== HEADER ======== */
            .merlin-panel-header {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 14px;
                background: rgba(0, 0, 0, 0.3);
                border-bottom: 1px solid rgba(138, 43, 226, 0.3);
                flex-shrink: 0;
            }
            .merlin-title {
                font-size: 22px;
                color: #e0d0ff;
                font-weight: bold;
                flex-shrink: 0;
            }
            .merlin-model-selector {
                flex: 1;
                min-width: 0;
            }
            .merlin-model-selector select {
                width: 100%;
                background: rgba(30, 30, 50, 0.8);
                border: 1px solid rgba(138, 43, 226, 0.3);
                border-radius: 6px;
                color: #ccc;
                font-family: 'VT323', monospace;
                font-size: 14px;
                padding: 4px 8px;
                cursor: pointer;
            }
            .merlin-close-btn {
                background: none;
                border: none;
                color: #999;
                font-size: 26px;
                cursor: pointer;
                padding: 0 4px;
                line-height: 1;
                flex-shrink: 0;
            }
            .merlin-close-btn:hover { color: #fff; }

            /* ======== CHAT AREA ======== */
            .merlin-chat-area {
                flex: 1;
                overflow-y: auto;
                padding: 12px;
                display: flex;
                flex-direction: column;
            }
            .merlin-chat-area::-webkit-scrollbar { width: 6px; }
            .merlin-chat-area::-webkit-scrollbar-track { background: transparent; }
            .merlin-chat-area::-webkit-scrollbar-thumb { background: rgba(138, 43, 226, 0.3); border-radius: 3px; }

            /* ======== WELCOME SCREEN ======== */
            .merlin-welcome {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 30px 20px;
                text-align: center;
                flex: 1;
            }
            .merlin-welcome.hidden { display: none; }
            .merlin-welcome-icon {
                font-size: 60px;
                margin-bottom: 12px;
                animation: welcomeFloat 3s ease-in-out infinite;
            }
            @keyframes welcomeFloat {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-8px); }
            }
            .merlin-welcome h3 {
                color: #e0d0ff;
                font-size: 22px;
                margin: 0 0 8px;
                font-family: 'VT323', monospace;
            }
            .merlin-welcome-sub {
                color: #8888aa;
                font-size: 16px;
                margin: 0 0 20px;
            }
            .merlin-welcome-suggestions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                justify-content: center;
                max-width: 350px;
            }
            .merlin-welcome-chip {
                background: rgba(138, 43, 226, 0.15);
                border: 1px solid rgba(138, 43, 226, 0.3);
                border-radius: 16px;
                padding: 6px 14px;
                color: #d0c0ee;
                font-family: 'VT323', monospace;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
            }
            .merlin-welcome-chip:hover {
                background: rgba(138, 43, 226, 0.35);
                border-color: rgba(138, 43, 226, 0.6);
                color: #fff;
                transform: translateY(-1px);
            }

            /* ======== CHAT MESSAGES ======== */
            .merlin-chat-messages {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .merlin-msg {
                display: flex;
                animation: msgFadeIn 0.2s ease;
            }
            @keyframes msgFadeIn {
                from { opacity: 0; transform: translateY(6px); }
                to { opacity: 1; transform: translateY(0); }
            }

            /* User messages - right aligned */
            .merlin-msg-user {
                justify-content: flex-end;
            }
            .merlin-msg-user .merlin-msg-bubble {
                background: rgba(59, 130, 246, 0.3);
                border: 1px solid rgba(59, 130, 246, 0.4);
                border-radius: 14px 14px 4px 14px;
                padding: 8px 14px;
                color: #d0e0ff;
                font-size: 16px;
                max-width: 85%;
                word-wrap: break-word;
            }

            /* AI messages - left aligned */
            .merlin-msg-ai {
                justify-content: flex-start;
                gap: 8px;
            }
            .merlin-msg-avatar {
                font-size: 24px;
                flex-shrink: 0;
                margin-top: 2px;
            }
            .merlin-msg-content {
                flex: 1;
                min-width: 0;
            }
            .merlin-msg-text {
                background: rgba(30, 30, 50, 0.6);
                border: 1px solid rgba(80, 80, 120, 0.3);
                border-radius: 4px 14px 14px 14px;
                padding: 10px 14px;
                color: #ccc;
                font-size: 16px;
                word-wrap: break-word;
                line-height: 1.4;
            }
            .merlin-msg-text:empty { display: none; }
            .merlin-msg-text strong { color: #e0d0ff; }

            /* System messages */
            .merlin-msg-system {
                justify-content: center;
            }
            .merlin-msg-error {
                background: rgba(244, 67, 54, 0.2) !important;
                border-color: rgba(244, 67, 54, 0.4) !important;
                color: #ffaaaa !important;
                font-size: 14px;
            }
            .merlin-error-text { color: #ff8888; }

            /* Streaming indicator */
            .merlin-msg-streaming-indicator {
                padding: 6px 0;
            }
            .streaming-orb {
                display: inline-block;
                width: 10px;
                height: 10px;
                background: #8a2be2;
                border-radius: 50%;
                animation: orbPulse 1s ease-in-out infinite;
                box-shadow: 0 0 8px rgba(138, 43, 226, 0.6);
            }
            @keyframes orbPulse {
                0%, 100% { opacity: 0.4; transform: scale(0.8); }
                50% { opacity: 1; transform: scale(1.2); }
            }

            /* ======== ATTACHMENTS ======== */
            .merlin-msg-attachments {
                display: flex;
                flex-direction: column;
                gap: 6px;
                margin-top: 6px;
            }

            /* Code blocks */
            .merlin-code-block {
                border: 1px solid rgba(138, 43, 226, 0.3);
                border-radius: 8px;
                overflow: hidden;
                background: rgba(20, 20, 40, 0.5);
            }
            .merlin-code-header {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 10px;
                background: rgba(138, 43, 226, 0.1);
                cursor: pointer;
                user-select: none;
            }
            .merlin-code-header:hover { background: rgba(138, 43, 226, 0.2); }
            .code-toggle-icon { color: #8a2be2; font-size: 14px; }
            .code-label { color: #aaa; font-size: 14px; flex: 1; }
            .code-copy-btn {
                background: none;
                border: none;
                color: #888;
                cursor: pointer;
                font-size: 14px;
                padding: 0 4px;
            }
            .code-copy-btn:hover { color: #fff; }
            .merlin-code-content {
                max-height: 300px;
                overflow-y: auto;
                padding: 10px;
                margin: 0;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                color: #b0e0b0;
                line-height: 1.4;
                background: rgba(10, 10, 20, 0.6);
            }
            .merlin-code-content.hidden { display: none; }
            .merlin-code-content code { white-space: pre-wrap; }

            /* Action badges */
            .merlin-action-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 4px 10px;
                background: rgba(76, 175, 80, 0.15);
                border: 1px solid rgba(76, 175, 80, 0.3);
                border-radius: 12px;
                color: #a0d0a0;
                font-size: 14px;
            }

            /* Cost badge */
            .merlin-cost-badge {
                font-size: 11px;
                color: #666;
                padding: 2px 0;
            }

            /* ======== FOLLOW-UP CHIPS ======== */
            .merlin-followup-chips {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                padding: 6px 12px;
                flex-shrink: 0;
            }
            .merlin-followup-chips.hidden { display: none; }
            .merlin-chip {
                background: rgba(138, 43, 226, 0.12);
                border: 1px solid rgba(138, 43, 226, 0.25);
                border-radius: 14px;
                padding: 4px 12px;
                color: #c0b0dd;
                font-family: 'VT323', monospace;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.15s;
            }
            .merlin-chip:hover {
                background: rgba(138, 43, 226, 0.3);
                color: #fff;
            }

            /* ======== INPUT AREA ======== */
            .merlin-input-area {
                display: flex;
                align-items: flex-end;
                gap: 8px;
                padding: 10px 12px;
                background: rgba(0, 0, 0, 0.3);
                border-top: 1px solid rgba(138, 43, 226, 0.2);
                flex-shrink: 0;
            }
            #merlin-chat-input {
                flex: 1;
                background: rgba(30, 30, 50, 0.6);
                border: 1px solid rgba(138, 43, 226, 0.3);
                border-radius: 10px;
                padding: 8px 12px;
                color: #ddd;
                font-family: 'VT323', monospace;
                font-size: 16px;
                resize: none;
                min-height: 36px;
                max-height: 100px;
                line-height: 1.3;
                outline: none;
            }
            #merlin-chat-input:focus {
                border-color: rgba(138, 43, 226, 0.6);
                box-shadow: 0 0 8px rgba(138, 43, 226, 0.2);
            }
            #merlin-chat-input::placeholder {
                color: #666;
            }
            .merlin-send-btn {
                background: rgba(138, 43, 226, 0.4);
                border: 1px solid rgba(138, 43, 226, 0.5);
                border-radius: 50%;
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                flex-shrink: 0;
                transition: all 0.2s;
            }
            .merlin-send-btn:hover:not(.disabled) {
                background: rgba(138, 43, 226, 0.6);
                transform: scale(1.05);
            }
            .merlin-send-btn.disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            .send-icon {
                color: #e0d0ff;
                font-size: 18px;
            }

            /* ======== RESPONSIVE ======== */
            @media (max-width: 768px) {
                #merlin-panel {
                    width: 100%;
                    border-left: none;
                }
            }
            @media (max-width: 480px) {
                #merlin-panel {
                    width: 100%;
                }
                .merlin-welcome-chip {
                    font-size: 12px;
                    padding: 4px 10px;
                }
            }

            /* ======== MERLIN BUTTON ======== */
            #merlin-btn {
                background: linear-gradient(135deg, #1a1a2e, #2a1a4e);
                border: 2px solid rgba(138, 43, 226, 0.5);
                border-radius: 8px;
                padding: 6px 10px;
                font-size: 22px;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 2px 8px rgba(138, 43, 226, 0.3);
            }
            #merlin-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 4px 15px rgba(138, 43, 226, 0.5);
            }
        `;
        document.head.appendChild(style);
    }
}
