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

        // Voice input state
        this.isRecording = false;
        this.recognition = null;

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
            case 'chat_code_token':
                this.appendCodeToken(msg.messageId, msg.code);
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
    // VOICE INPUT
    // ============================================================

    toggleVoiceInput() {
        if (this.isRecording) {
            this.stopVoiceInput();
        } else {
            this.startVoiceInput();
        }
    }

    startVoiceInput() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('[MerlinPanelUI] Speech recognition not supported in this browser');
            this.addSystemMessage('Voice input is not supported in this browser. Try Chrome or Edge.');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        const input = document.getElementById('merlin-chat-input');
        const voiceBtn = document.getElementById('merlin-voice-btn');
        // Save any existing text so we can append to it
        const existingText = input ? input.value : '';

        this.recognition.onstart = () => {
            this.isRecording = true;
            if (voiceBtn) voiceBtn.classList.add('recording');
            if (input) input.placeholder = 'Listening...';
            console.log('[MerlinPanelUI] Voice recording started');
        };

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            // Loop through ALL results (from 0) to rebuild full transcript
            for (let i = 0; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (input) {
                // Combine existing text + all finalized phrases + current interim
                const base = existingText ? existingText + ' ' : '';
                const spaceBeforeInterim = (finalTranscript && interimTranscript) ? ' ' : '';
                input.value = (base + finalTranscript + spaceBeforeInterim + interimTranscript).trimEnd();
                // Auto-resize
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 100) + 'px';
            }
        };

        this.recognition.onerror = (event) => {
            console.warn('[MerlinPanelUI] Voice recognition error:', event.error);
            if (event.error === 'not-allowed') {
                this.addSystemMessage('Microphone access denied. Please allow microphone permissions.');
            }
            this.stopVoiceInput();
        };

        this.recognition.onend = () => {
            // Recognition can end on its own (e.g. silence timeout)
            if (this.isRecording) {
                this.stopVoiceInput();
            }
        };

        try {
            this.recognition.start();
        } catch (e) {
            console.error('[MerlinPanelUI] Failed to start voice recognition:', e);
            this.stopVoiceInput();
        }
    }

    stopVoiceInput() {
        this.isRecording = false;
        const voiceBtn = document.getElementById('merlin-voice-btn');
        const input = document.getElementById('merlin-chat-input');

        if (voiceBtn) voiceBtn.classList.remove('recording');
        if (input) input.placeholder = 'Ask Merlin...';

        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) {
                // Already stopped
            }
            this.recognition = null;
        }

        // Focus the input so user can edit or send
        if (input) input.focus();
        console.log('[MerlinPanelUI] Voice recording stopped');
    }

    addSystemMessage(text) {
        const container = document.getElementById('merlin-chat-messages');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'merlin-message merlin-system-message';
        div.textContent = text;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // ============================================================
    // MESSAGE SENDING
    // ============================================================

    sendMessage(text) {
        if (!text.trim() || this.isWaitingForResponse) return;

        // Stop voice recording if active
        if (this.isRecording) this.stopVoiceInput();

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

        // Check if a streaming code block already exists for this message
        const streamingId = `streaming-code_${messageId}`;
        const existingStreaming = document.getElementById(streamingId);

        const codeId = `code_${messageId}`;

        if (existingStreaming) {
            // Replace streaming block with final code block (collapsed)
            existingStreaming.className = 'merlin-code-block';
            existingStreaming.id = '';
            existingStreaming.innerHTML = `
                <div class="merlin-code-header" data-code-id="${codeId}">
                    <span class="code-toggle-icon">&#x25B8;</span>
                    <span class="code-label">${this.escapeHtml(description || `${language} code`)}</span>
                    <button class="code-copy-btn" title="Copy code">&#x1F4CB;</button>
                </div>
                <pre class="merlin-code-content hidden" id="${codeId}"><code>${this.escapeHtml(code)}</code></pre>
            `;

            // Re-attach event listeners
            const header = existingStreaming.querySelector('.merlin-code-header');
            header.addEventListener('click', (e) => {
                if (e.target.closest('.code-copy-btn')) return;
                const content = document.getElementById(codeId);
                const icon = header.querySelector('.code-toggle-icon');
                content.classList.toggle('hidden');
                icon.textContent = content.classList.contains('hidden') ? '\u25B8' : '\u25BE';
            });

            const copyBtn = existingStreaming.querySelector('.code-copy-btn');
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(code).then(() => {
                    copyBtn.textContent = '\u2705';
                    setTimeout(() => { copyBtn.textContent = '\u{1F4CB}'; }, 1500);
                });
            });
        } else {
            // No streaming block — create fresh (original behavior)
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

            const header = codeBlock.querySelector('.merlin-code-header');
            header.addEventListener('click', (e) => {
                if (e.target.closest('.code-copy-btn')) return;
                const content = document.getElementById(codeId);
                const icon = header.querySelector('.code-toggle-icon');
                content.classList.toggle('hidden');
                icon.textContent = content.classList.contains('hidden') ? '\u25B8' : '\u25BE';
            });

            const copyBtn = codeBlock.querySelector('.code-copy-btn');
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(code).then(() => {
                    copyBtn.textContent = '\u2705';
                    setTimeout(() => { copyBtn.textContent = '\u{1F4CB}'; }, 1500);
                });
            });

            attachments.appendChild(codeBlock);
        }

        this.scrollToBottom();
    }

    /**
     * Append streaming code tokens to a live code block.
     * On first call for a messageId, creates the streaming code block (expanded).
     * On subsequent calls, appends text to the <code> element.
     */
    appendCodeToken(messageId, code) {
        const attachments = document.querySelector(`.merlin-msg[data-message-id="${messageId}"] .merlin-msg-attachments`);
        if (!attachments) return;

        const streamingId = `streaming-code_${messageId}`;
        let codeBlock = document.getElementById(streamingId);

        if (!codeBlock) {
            // First token — create the streaming code block (expanded by default)
            codeBlock = document.createElement('div');
            codeBlock.id = streamingId;
            codeBlock.className = 'merlin-code-block merlin-code-streaming';
            codeBlock.innerHTML = `
                <div class="merlin-code-header streaming-code-header">
                    <span class="streaming-code-indicator"></span>
                    <span class="code-label">Generating code...</span>
                </div>
                <pre class="merlin-code-content" id="${streamingId}-pre"><code></code></pre>
            `;
            attachments.appendChild(codeBlock);
        }

        // Append text to the <code> element
        const codeEl = codeBlock.querySelector('code');
        if (codeEl) {
            codeEl.textContent += code;
        }

        // Auto-scroll the code container
        const pre = document.getElementById(`${streamingId}-pre`);
        if (pre) {
            pre.scrollTop = pre.scrollHeight;
        }

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
                const modelName = msg.costInfo.model?.split('/').pop() || '';
                costEl.textContent = `$${cost < 0.001 ? '<0.001' : cost.toFixed(3)} · ${modelName}`;
                costEl.title = 'Click for cost breakdown';

                // Build breakdown popup
                const popup = document.createElement('div');
                popup.className = 'merlin-cost-popup';
                const ci = msg.costInfo;
                const fmtTokens = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
                const fmtUSD = (n) => n === undefined || n === null ? '—' : n < 0.001 ? '<$0.001' : `$${n.toFixed(4)}`;

                let rows = `
                    <div class="merlin-cost-popup-title">Cost Breakdown</div>
                    <div class="merlin-cost-popup-row"><span>Model</span><span>${this.escapeHtml(modelName)}</span></div>
                    <div class="merlin-cost-popup-divider"></div>
                    <div class="merlin-cost-popup-row"><span>Input tokens</span><span>${fmtTokens(ci.inputTokens || 0)}</span></div>
                    <div class="merlin-cost-popup-row"><span>Output tokens</span><span>${fmtTokens(ci.outputTokens || 0)}</span></div>`;
                if (ci.cachedTokens > 0) {
                    rows += `<div class="merlin-cost-popup-row"><span>Cache read</span><span>${fmtTokens(ci.cachedTokens)}</span></div>`;
                }
                if (ci.cacheCreationTokens > 0) {
                    rows += `<div class="merlin-cost-popup-row"><span>Cache create</span><span>${fmtTokens(ci.cacheCreationTokens)}</span></div>`;
                }
                rows += `
                    <div class="merlin-cost-popup-divider"></div>
                    <div class="merlin-cost-popup-row"><span>Input cost</span><span>${fmtUSD(ci.inputCostUSD)}</span></div>
                    <div class="merlin-cost-popup-row"><span>Output cost</span><span>${fmtUSD(ci.outputCostUSD)}</span></div>
                    <div class="merlin-cost-popup-divider"></div>
                    <div class="merlin-cost-popup-row merlin-cost-popup-total"><span>Total</span><span>${fmtUSD(ci.totalCostUSD)}</span></div>`;
                popup.innerHTML = rows;

                costEl.appendChild(popup);

                // Toggle popup on click
                costEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isOpen = popup.classList.contains('open');
                    // Close any other open popups
                    document.querySelectorAll('.merlin-cost-popup.open').forEach(p => p.classList.remove('open'));
                    if (!isOpen) popup.classList.add('open');
                });

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
                    <button id="merlin-voice-btn" class="merlin-voice-btn" title="Voice input">
                        <span class="voice-icon">&#x1F3A4;</span>
                    </button>
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

        // Send / Stop button
        addListener('merlin-send-btn', 'click', () => {
            if (this.isWaitingForResponse) {
                this.stopGeneration();
            } else {
                const input = document.getElementById('merlin-chat-input');
                if (input) this.sendMessage(input.value);
            }
        });

        // Voice input button
        addListener('merlin-voice-btn', 'click', () => this.toggleVoiceInput());

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

        // Close cost popups when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.merlin-cost-badge')) {
                document.querySelectorAll('.merlin-cost-popup.open').forEach(p => p.classList.remove('open'));
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
        // Stop voice recording if active
        if (this.isRecording) this.stopVoiceInput();

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
        if (!btn) return;

        const icon = btn.querySelector('.send-icon');
        if (this.isWaitingForResponse) {
            btn.disabled = false;
            btn.classList.remove('disabled');
            btn.classList.add('stop-mode');
            btn.title = 'Stop generating';
            if (icon) icon.innerHTML = '&#x25A0;'; // filled square
        } else {
            btn.disabled = false;
            btn.classList.remove('stop-mode');
            btn.title = 'Send (Enter)';
            if (icon) icon.innerHTML = '&#x27A4;'; // arrow
        }
    }

    stopGeneration() {
        if (!this.isWaitingForResponse) return;

        // Send interrupt to server
        if (this.fewShotClient) {
            this.fewShotClient.interrupt();
        }

        // Append stopped indicator to current message
        if (this.currentStreamingId) {
            const msgEl = document.querySelector(`.merlin-msg[data-message-id="${this.currentStreamingId}"] .merlin-msg-text`);
            if (msgEl) {
                msgEl.innerHTML += '<span class="merlin-stopped-text"> (stopped)</span>';
            }

            // Remove streaming indicator
            const indicator = document.querySelector(`.merlin-msg[data-message-id="${this.currentStreamingId}"] .merlin-msg-streaming-indicator`);
            if (indicator) indicator.remove();

            const msg = this.messages.find(m => m.id === this.currentStreamingId);
            if (msg) msg.isStreaming = false;
        }

        // Reset state
        this.isWaitingForResponse = false;
        this.currentStreamingId = null;
        this.pendingTokens = '';
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.updateSendButton();
        this.scrollToBottom();
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

            /* Streaming code block */
            .merlin-code-streaming {
                border-color: rgba(138, 43, 226, 0.5);
            }
            .merlin-code-streaming .merlin-code-content {
                max-height: 200px;
            }
            .merlin-code-streaming .merlin-code-content code::after {
                content: '\u2588';
                animation: codeCursorBlink 0.8s step-end infinite;
                color: #8a2be2;
            }
            @keyframes codeCursorBlink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0; }
            }
            .streaming-code-header {
                background: rgba(138, 43, 226, 0.15);
                cursor: default;
            }
            .streaming-code-header .code-label {
                color: #c0a0ee;
            }
            .streaming-code-indicator {
                display: inline-block;
                width: 8px;
                height: 8px;
                background: #8a2be2;
                border-radius: 50%;
                animation: orbPulse 1s ease-in-out infinite;
                flex-shrink: 0;
            }

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
                font-size: 13px;
                color: #999;
                padding: 4px 0;
                cursor: pointer;
                position: relative;
                display: inline-block;
                user-select: none;
            }
            .merlin-cost-badge:hover {
                color: #ccc;
            }

            /* Cost breakdown popup */
            .merlin-cost-popup {
                display: none;
                position: absolute;
                bottom: calc(100% + 6px);
                left: 0;
                background: #1e1e2e;
                border: 1px solid #444;
                border-radius: 8px;
                padding: 10px 14px;
                min-width: 220px;
                z-index: 100;
                box-shadow: 0 4px 16px rgba(0,0,0,0.5);
                font-size: 12px;
                color: #ccc;
            }
            .merlin-cost-popup.open {
                display: block;
            }
            .merlin-cost-popup-title {
                font-weight: 600;
                font-size: 13px;
                color: #fff;
                margin-bottom: 8px;
            }
            .merlin-cost-popup-row {
                display: flex;
                justify-content: space-between;
                padding: 3px 0;
            }
            .merlin-cost-popup-row span:first-child {
                color: #888;
            }
            .merlin-cost-popup-row span:last-child {
                color: #ddd;
                font-family: monospace;
            }
            .merlin-cost-popup-total span {
                font-weight: 600;
                color: #fff !important;
            }
            .merlin-cost-popup-divider {
                border-top: 1px solid #333;
                margin: 5px 0;
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
            .merlin-send-btn.stop-mode {
                background: rgba(220, 60, 60, 0.5);
                border-color: rgba(220, 60, 60, 0.7);
            }
            .merlin-send-btn.stop-mode:hover {
                background: rgba(220, 60, 60, 0.75);
                transform: scale(1.05);
            }
            .merlin-send-btn.stop-mode .send-icon {
                color: #ffcccc;
                font-size: 14px;
            }
            .send-icon {
                color: #e0d0ff;
                font-size: 18px;
            }

            /* Voice button */
            .merlin-voice-btn {
                background: rgba(60, 60, 80, 0.5);
                border: 1px solid rgba(138, 43, 226, 0.3);
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
            .merlin-voice-btn:hover {
                background: rgba(138, 43, 226, 0.4);
                transform: scale(1.05);
            }
            .merlin-voice-btn.recording {
                background: rgba(220, 50, 50, 0.6);
                border-color: rgba(255, 80, 80, 0.8);
                animation: merlin-pulse-recording 1s ease-in-out infinite;
            }
            .merlin-voice-btn.recording:hover {
                background: rgba(220, 50, 50, 0.8);
            }
            .voice-icon {
                font-size: 16px;
                line-height: 1;
            }
            @keyframes merlin-pulse-recording {
                0%, 100% { box-shadow: 0 0 4px rgba(255, 60, 60, 0.4); }
                50% { box-shadow: 0 0 12px rgba(255, 60, 60, 0.8); }
            }

            /* System messages */
            .merlin-system-message {
                color: #999;
                font-style: italic;
                font-size: 13px;
                padding: 4px 12px;
                text-align: center;
            }

            .merlin-stopped-text {
                color: #888;
                font-style: italic;
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
