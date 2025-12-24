import * as THREE from 'three';
import { DebugPanel } from '../ui/DebugPanel.js';
import { IdeasButton } from '../ui/IdeasButton.js';

/**
 * UIManager centralizes all HUD/UI updates.
 * This decouples UI manipulation from game logic.
 */
export class UIManager {
    constructor(game) {
        this.game = game;

        // Cache DOM elements
        this.fpsElement = document.getElementById('fps');
        this.fpsCounter = document.getElementById('fps-counter');
        this.positionElement = document.getElementById('position');
        this.blockCountElement = document.getElementById('block-count');

        // Debug panel
        this.debugPanel = new DebugPanel(game);

        // Ideas Button
        this.ideasButton = new IdeasButton(game);

        // Chat button
        this.setupChatListener();

        // FPS tracking
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();

        // Agent UI elements
        this.statusDiv = null;
        this.voiceIndicator = null;
        this.statusText = null;
        this.taskItemsDiv = null;
        this.tasks = [];

        // Chat Panel elements
        this.chatPanel = document.getElementById('chat-panel');
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('send-chat');
        this.closeBtn = document.getElementById('close-chat');

        this.setupChatPanelListeners();

        const mpBtn = document.getElementById('multiplayer-btn');
        if (mpBtn) {
            mpBtn.addEventListener('click', () => this.showMultiplayerMenu());
        }

        this.createMuteButton();
    }

    createMuteButton() {
        const btn = document.createElement('button');
        btn.id = 'mute-btn';
        // Initial state
        const isMuted = this.game.soundManager ? this.game.soundManager.isMuted : false;
        btn.textContent = isMuted ? '🔇' : '🔊';

        btn.style.cssText = `
            position: fixed; top: 10px; right: 80px;
            background: rgba(0,0,0,0.6); color: #fff;
            border: 1px solid rgba(255,255,255,0.2);
            padding: 8px 12px; border-radius: 4px;
            cursor: pointer; font-size: 20px; z-index: 2000;
        `;

        // If network status exists, move this left of it or below it.
        // For simplicity, let's put it at top-right, but adjust if network status is there.
        // Network status is at top: 10px; right: 10px; (in showNetworkStatus)
        // Let's create a container or just offset heavily.
        // Actually, let's put it top-right, but update showNetworkStatus to be lower.

        btn.onclick = () => {
            if (this.game.soundManager) {
                const muted = this.game.soundManager.toggleMute();
                btn.textContent = muted ? '🔇' : '🔊';
                // Remove focus to prevent capturing keyboard input
                btn.blur();
            }
        };

        document.body.appendChild(btn);
        this.muteBtn = btn;
    }

    // --- Agent UI ---

    createStatusIndicator() {
        // Small, unobtrusive status indicator in corner
        if (this.statusDiv) return;

        const div = document.createElement('div');
        div.id = 'voice-status';
        div.style.cssText = `
            position: fixed; bottom: 20px; right: 20px;
            background: rgba(0,0,0,0.8); border: 2px solid #00ffcc;
            padding: 10px 15px; border-radius: 20px; z-index: 1000;
            font-family: 'VT323', monospace; color: #00ffcc; font-size: 14px;
            display: flex; align-items: center; gap: 10px;
        `;
        div.innerHTML = `
            <div id="voice-indicator" style="width: 12px; height: 12px; border-radius: 50%; background: #333;"></div>
            <span id="voice-status-text">Voice Off (V)</span>
        `;
        document.body.appendChild(div);
        this.statusDiv = div;
        this.voiceIndicator = div.querySelector('#voice-indicator');
        this.statusText = div.querySelector('#voice-status-text');

        this.createTaskListUI();
    }

    createTaskListUI() {
        if (this.taskListDiv) return;

        // CSS for spinner animation and task items
        if (!document.getElementById('agent-spinner-style')) {
            const style = document.createElement('style');
            style.id = 'agent-spinner-style';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .task-spinner {
                    width: 16px; height: 16px;
                    border: 2px solid #00ffcc;
                    border-top: 2px solid transparent;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                .task-done { color: #00ff00; }
                .task-error { color: #ff0000; }
                .task-logs-btn {
                    background: rgba(0, 255, 204, 0.2);
                    border: 1px solid #00ffcc;
                    color: #00ffcc;
                    font-size: 12px;
                    padding: 2px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: 'VT323', monospace;
                    margin-left: auto;
                }
                .task-logs-btn:hover {
                    background: rgba(0, 255, 204, 0.4);
                }
                #task-logs-modal {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(10, 10, 20, 0.95);
                    border: 2px solid #00ffcc;
                    border-radius: 12px;
                    padding: 20px;
                    max-width: 80vw;
                    max-height: 70vh;
                    overflow: auto;
                    z-index: 3000;
                    font-family: monospace;
                    color: #e0e0e0;
                    font-size: 12px;
                    white-space: pre-wrap;
                    word-break: break-all;
                }
                #task-logs-modal-backdrop {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.7);
                    z-index: 2999;
                }
                .task-logs-close {
                    position: absolute;
                    top: 10px;
                    right: 15px;
                    color: #fff;
                    font-size: 24px;
                    cursor: pointer;
                }
                #task-list {
                    background: rgba(0, 0, 0, 0.4);
                    border-top: 1px solid rgba(0, 255, 204, 0.2);
                    padding: 15px 20px;
                    font-family: 'VT323', monospace;
                    color: #fff;
                    font-size: 16px;
                    display: none;
                    flex-direction: column;
                    gap: 10px;
                    order: 2; /* Position it between messages and input or after messages */
                }
            `;
            document.head.appendChild(style);
        }

        const taskList = document.createElement('div');
        taskList.id = 'task-list';
        taskList.innerHTML = `
            <div style="color: #00ffcc; font-size: 18px; border-bottom: 1px solid rgba(0, 255, 204, 0.2); padding-bottom: 8px; margin-bottom: 5px;">
                🤖 AI Working...
            </div>
            <div id="task-items"></div>
        `;

        // Append to chat panel instead of document.body
        if (this.chatPanel) {
            // Insert before the input container
            const inputContainer = this.chatPanel.querySelector('.chat-input-container');
            if (inputContainer) {
                this.chatPanel.insertBefore(taskList, inputContainer);
            } else {
                this.chatPanel.appendChild(taskList);
            }
        } else {
            document.body.appendChild(taskList);
        }

        // Suggestions Container
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.id = 'chat-suggestions';
        suggestionsDiv.style.cssText = `
            display: flex; gap: 8px; padding: 10px; overflow-x: auto;
            white-space: nowrap; scrollbar-width: none;
            border-top: 1px solid rgba(0, 255, 204, 0.2);
            background: rgba(0, 0, 0, 0.2);
        `;
        // Insert before input container, but after task list (or before it? Order implies tasks above suggestions usually)
        // Let's put it above the input container
        if (this.chatPanel) {
            const inputContainer = this.chatPanel.querySelector('.chat-input-container');
            if (inputContainer) {
                this.chatPanel.insertBefore(suggestionsDiv, inputContainer);
            } else {
                this.chatPanel.appendChild(suggestionsDiv);
            }
        }
        this.suggestionsDiv = suggestionsDiv;

        this.taskListDiv = taskList;
        this.taskItemsDiv = taskList.querySelector('#task-items');
    }

    updateVoiceStatus(active, text) {
        // Ensure UI exists
        if (!this.statusDiv) this.createStatusIndicator();

        this.voiceIndicator.style.background = active ? '#00ff00' : '#333';
        if (!active && text === 'Error') {
            this.voiceIndicator.style.background = '#ff0000';
        }
        this.statusText.textContent = text;
    }

    addTask(name, backendTaskId = null) {
        if (!this.taskListDiv) this.createTaskListUI();

        const taskId = 'task-' + Date.now();
        const taskEl = document.createElement('div');
        taskEl.id = taskId;
        taskEl.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 5px 0;';
        taskEl.innerHTML = `
            <div class="task-spinner"></div>
            <span style="flex: 1;">${name}</span>
            <button class="task-logs-btn" data-backend-id="${backendTaskId || ''}">Logs</button>
        `;

        // Add click handler for logs button
        const logsBtn = taskEl.querySelector('.task-logs-btn');
        logsBtn.addEventListener('click', () => this.showTaskLogs(backendTaskId));

        this.taskItemsDiv.appendChild(taskEl);
        this.tasks.push({ id: taskId, name, status: 'working', backendTaskId });
        this.taskListDiv.style.display = 'flex';
        return taskId;
    }

    async showTaskLogs(backendTaskId) {
        if (!backendTaskId) {
            this.displayLogsModal('No logs available - backend task ID not found.', null);
            return;
        }

        // Start polling and display modal
        this.displayLogsModal('Loading logs...', backendTaskId);
    }

    async fetchAndUpdateLogs(backendTaskId) {
        const modal = document.getElementById('task-logs-modal');
        if (!modal) return null; // Modal was closed

        try {
            const res = await fetch(`/api/god-mode/task/${backendTaskId}`);
            const data = await res.json();

            let logsText;
            if (data.status === 'not_found') {
                logsText = `Task ID: ${backendTaskId}\nStatus: Not Found (Expired or Server Restarted)\n`;
            } else {
                logsText = `Task ID: ${backendTaskId}\nStatus: ${data.status}\n`;
                if (data.startTime) {
                    const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
                    logsText += `Elapsed: ${elapsed}s\n`;
                }
                logsText += `\n--- LOGS ---\n${data.logs || 'No output yet...'}\n`;
                if (data.error) {
                    logsText += `\n--- ERROR ---\n${data.error}\n`;
                }
                if (data.message) {
                    logsText += `\n--- MESSAGE ---\n${data.message}\n`;
                }
            }

            // Update modal content
            const preEl = modal.querySelector('pre');
            if (preEl) {
                preEl.textContent = logsText;
                // Auto-scroll to bottom
                modal.scrollTop = modal.scrollHeight;
            }

            return data.status; // Return status so we know if task is done
        } catch (e) {
            const preEl = modal?.querySelector('pre');
            if (preEl) {
                preEl.textContent = `Failed to fetch logs: ${e.message}`;
            }
            return 'error';
        }
    }

    displayLogsModal(initialText, backendTaskId) {
        // Clear any existing polling interval
        if (this.logsPollingInterval) {
            clearInterval(this.logsPollingInterval);
            this.logsPollingInterval = null;
        }

        // Remove existing modal if present
        const existing = document.getElementById('task-logs-modal');
        const existingBackdrop = document.getElementById('task-logs-modal-backdrop');
        if (existing) existing.remove();
        if (existingBackdrop) existingBackdrop.remove();

        const closeModal = () => {
            // Stop polling when modal closes
            if (this.logsPollingInterval) {
                clearInterval(this.logsPollingInterval);
                this.logsPollingInterval = null;
            }
            modal.remove();
            backdrop.remove();
        };

        const backdrop = document.createElement('div');
        backdrop.id = 'task-logs-modal-backdrop';
        backdrop.addEventListener('click', closeModal);

        const modal = document.createElement('div');
        modal.id = 'task-logs-modal';
        modal.innerHTML = `
            <span class="task-logs-close">&times;</span>
            <h3 style="margin-top: 0; color: #00ffcc;">Task Logs ${backendTaskId ? '<span style="font-size: 12px; color: #666;">(auto-refreshing)</span>' : ''}</h3>
            <pre style="margin: 0;">${this.escapeHTML(initialText)}</pre>
        `;

        modal.querySelector('.task-logs-close').addEventListener('click', closeModal);

        document.body.appendChild(backdrop);
        document.body.appendChild(modal);

        // Start polling if we have a backend task ID
        if (backendTaskId) {
            // Fetch immediately
            this.fetchAndUpdateLogs(backendTaskId);

            // Then poll every 2 seconds
            this.logsPollingInterval = setInterval(async () => {
                const status = await this.fetchAndUpdateLogs(backendTaskId);
                // Keep polling even if done so user can see final state
                // They can close the modal when they're ready
            }, 2000);
        }
    }

    updateTask(taskId, status, message) {
        console.log('[UIManager] updateTask called:', { taskId, status, message });
        const taskEl = document.getElementById(taskId);
        if (!taskEl) {
            console.warn('[UIManager] Task element not found:', taskId);
            return;
        }
        console.log('[UIManager] Found task element, updating to status:', status);

        const task = this.tasks.find(t => t.id === taskId);
        if (task) task.status = status;

        if (status === 'done') {
            taskEl.innerHTML = `
                <span class="task-done">✓</span>
                <span class="task-done">${message || task?.name || 'Complete'}</span>
            `;
        } else if (status === 'error') {
            taskEl.innerHTML = `
                <span class="task-error">✗</span>
                <span class="task-error">${message || 'Error'}</span>
            `;
        }

        // Hide task list after all tasks complete (with delay)
        const allDone = this.tasks.every(t => t.status === 'done' || t.status === 'error');
        if (allDone) {
            setTimeout(() => {
                if (this.taskListDiv) this.taskListDiv.style.display = 'none';
                if (this.taskItemsDiv) this.taskItemsDiv.innerHTML = '';
                this.tasks = [];
            }, 3000);
        }
    }

    /**
     * Show a prominent refresh prompt when changes require browser reload
     */
    showRefreshPrompt() {
        // Remove existing prompt if any
        const existing = document.getElementById('refresh-prompt');
        if (existing) existing.remove();

        const prompt = document.createElement('div');
        prompt.id = 'refresh-prompt';
        prompt.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, rgba(20, 20, 40, 0.95), rgba(40, 20, 60, 0.95));
            border: 2px solid #ff9900;
            border-radius: 16px;
            padding: 30px 40px;
            z-index: 3000;
            text-align: center;
            font-family: 'VT323', monospace;
            box-shadow: 0 0 30px rgba(255, 153, 0, 0.3);
            animation: pulse-glow 2s ease-in-out infinite;
        `;

        prompt.innerHTML = `
            <style>
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 30px rgba(255, 153, 0, 0.3); }
                    50% { box-shadow: 0 0 50px rgba(255, 153, 0, 0.5); }
                }
            </style>
            <div style="font-size: 48px; margin-bottom: 15px;">🔄</div>
            <h2 style="color: #ff9900; margin: 0 0 10px 0; font-size: 28px;">Refresh Required</h2>
            <p style="color: #ccc; margin: 0 0 20px 0; font-size: 18px;">
                Some changes require a browser refresh to take effect.
            </p>
            <button id="refresh-now-btn" style="
                background: linear-gradient(135deg, #ff9900, #ff6600);
                border: none;
                color: white;
                padding: 12px 30px;
                font-size: 20px;
                font-family: 'VT323', monospace;
                border-radius: 8px;
                cursor: pointer;
                margin-right: 10px;
                transition: all 0.2s;
            ">Refresh Now</button>
            <button id="refresh-later-btn" style="
                background: transparent;
                border: 1px solid #666;
                color: #aaa;
                padding: 12px 20px;
                font-size: 18px;
                font-family: 'VT323', monospace;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
            ">Later</button>
        `;

        document.body.appendChild(prompt);

        // Button handlers
        document.getElementById('refresh-now-btn').onclick = () => {
            window.location.reload();
        };

        document.getElementById('refresh-later-btn').onclick = () => {
            prompt.remove();
        };

        // Auto-dismiss after 30 seconds
        setTimeout(() => {
            if (document.getElementById('refresh-prompt')) {
                prompt.remove();
            }
        }, 30000);
    }

    // --- Multiplayer UI ---

    showNetworkStatus(status) {
        if (!status) {
            if (this.networkStatusDiv) this.networkStatusDiv.remove();
            this.networkStatusDiv = null;
            return;
        }

        if (!this.networkStatusDiv) {
            const div = document.createElement('div');
            div.style.cssText = `
                position: fixed; top: 60px; right: 10px;
                background: rgba(0,0,0,0.6); padding: 8px 12px;
                border-radius: 4px; color: #fff; font-family: 'VT323', monospace;
                font-size: 16px; border: 1px solid rgba(255,255,255,0.2);
                display: flex; gap: 10px; align-items: center;
            `;
            document.body.appendChild(div);
            this.networkStatusDiv = div;

            // Add Share Button
            const shareBtn = document.createElement('button');
            shareBtn.textContent = 'Share Link';
            shareBtn.style.cssText = `
                background: #4CAF50; color: white; border: none;
                padding: 4px 8px; border-radius: 2px; cursor: pointer;
                font-family: inherit; font-size: 14px;
            `;
            shareBtn.onclick = () => {
                const link = this.game.networkManager.getShareableLink();
                if (link) {
                    navigator.clipboard.writeText(link);
                    shareBtn.textContent = 'Copied!';
                    setTimeout(() => shareBtn.textContent = 'Share Link', 2000);
                }
            };
            div.appendChild(shareBtn);

            this.networkStatusText = document.createElement('span');
            div.appendChild(this.networkStatusText);
        }

        this.networkStatusText.textContent = status;
    }

    showMultiplayerMenu() {
        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.9); padding: 20px; border-radius: 8px;
            border: 2px solid #fff; color: #fff; font-family: 'VT323', monospace;
            text-align: center; z-index: 2000;
        `;

        div.innerHTML = `
            <h2>Multiplayer</h2>
            <button id="mp-host-btn" style="padding: 10px 20px; font-size: 18px; margin: 10px; cursor: pointer;">Host Game</button>
            <button id="mp-close-btn" style="padding: 10px 20px; font-size: 18px; margin: 10px; cursor: pointer;">Close</button>
        `;

        document.body.appendChild(div);

        document.getElementById('mp-host-btn').onclick = async () => {
            const hostBtn = document.getElementById('mp-host-btn');
            hostBtn.disabled = true;
            hostBtn.textContent = 'Creating room...';

            try {
                await this.game.networkManager.createRoom();
                const link = this.game.networkManager.getShareableLink();

                // Update the dialog to show the shareable link
                div.innerHTML = `
                    <h2>Room Created!</h2>
                    <p style="margin: 15px 0; color: #aaa;">Share this link with friends:</p>
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 4px; margin: 10px 0; word-break: break-all; font-size: 14px;">
                        ${link}
                    </div>
                    <button id="mp-copy-btn" style="padding: 10px 20px; font-size: 18px; margin: 10px; cursor: pointer; background: #4CAF50; color: white; border: none; border-radius: 4px;">Copy Link</button>
                    <button id="mp-done-btn" style="padding: 10px 20px; font-size: 18px; margin: 10px; cursor: pointer;">Done</button>
                `;

                // Copy button handler
                document.getElementById('mp-copy-btn').onclick = () => {
                    navigator.clipboard.writeText(link).then(() => {
                        const copyBtn = document.getElementById('mp-copy-btn');
                        copyBtn.textContent = 'Copied!';
                        copyBtn.style.background = '#45a049';
                        setTimeout(() => {
                            copyBtn.textContent = 'Copy Link';
                            copyBtn.style.background = '#4CAF50';
                        }, 2000);
                    }).catch(err => {
                        console.error('Failed to copy:', err);
                        alert('Failed to copy link. Please copy it manually.');
                    });
                };

                // Done button handler
                document.getElementById('mp-done-btn').onclick = () => div.remove();

            } catch (e) {
                hostBtn.disabled = false;
                hostBtn.textContent = 'Host Game';
                alert('Failed to create room: ' + e);
            }
        };

        document.getElementById('mp-close-btn').onclick = () => div.remove();
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
    }

    setupChatPanelListeners() {
        if (!this.chatPanel) return;

        this.sendBtn.addEventListener('click', () => this.handleSendMessage());
        this.closeBtn.addEventListener('click', () => {
            if (this.game.agent) this.game.agent.toggleChat();
        });

        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleSendMessage();
            }
        });
    }

    handleSendMessage() {
        const text = this.chatInput.value.trim();
        if (text && this.game.agent) {
            this.game.agent.sendTextMessage(text);
            this.chatInput.value = '';
            // Clear suggestions on sending a message? Maybe desirable.
            this.clearSuggestions();
        }
    }

    showSuggestions(suggestions) {
        if (!this.suggestionsDiv) return;

        this.suggestionsDiv.innerHTML = '';
        this.suggestionsDiv.style.display = 'flex';

        suggestions.forEach(text => {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.style.cssText = `
                background: rgba(0, 255, 204, 0.1);
                border: 1px solid #00ffcc;
                color: #00ffcc;
                padding: 5px 10px;
                border-radius: 15px;
                cursor: pointer;
                font-family: 'VT323', monospace;
                font-size: 14px;
                transition: all 0.2s;
            `;
            btn.onmouseover = () => btn.style.background = 'rgba(0, 255, 204, 0.3)';
            btn.onmouseout = () => btn.style.background = 'rgba(0, 255, 204, 0.1)';

            btn.onclick = () => {
                if (this.game.agent) {
                    this.game.agent.sendTextMessage(text);
                    this.clearSuggestions();
                }
            };
            this.suggestionsDiv.appendChild(btn);
        });

        // Auto-scroll chat to make room if needed? 
        // The flex container handles itself.
    }

    clearSuggestions() {
        if (this.suggestionsDiv) {
            this.suggestionsDiv.innerHTML = '';
            this.suggestionsDiv.style.display = 'none';
        }
    }

    addChatMessage(sender, text) {
        if (!this.chatMessages) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        msgDiv.innerHTML = `<div class="message-content">${this.escapeHTML(text)}</div>`;
        this.chatMessages.appendChild(msgDiv);

        // Auto-scroll
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    toggleChatPanel(show) {
        if (!this.chatPanel) return;

        if (show) {
            this.chatPanel.classList.remove('hidden');
        } else {
            this.chatPanel.classList.add('hidden');
            this.chatInput.blur();
        }
    }

    focusChatInput() {
        if (this.chatInput) {
            this.chatInput.focus();
        }
    }

    blurChatInput() {
        if (this.chatInput) {
            this.chatInput.blur();
        }
    }

    updateChatModeIndicator(isTypingMode) {
        // Create or update a small indicator showing current mode
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
                this.chatPanel.style.position = 'relative'; // Ensure positioning works
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

    toggleDebugPanel() {
        if (this.debugPanel) {
            this.debugPanel.toggle();
            return this.debugPanel.isVisible;
        }
        return false;
    }

    /**
     * Update FPS counter (call every frame, updates display once per second)
     */
    updateFPS() {
        this.frameCount++;
        const now = performance.now();

        if (now - this.lastFpsUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = now;

            if (this.fpsElement) {
                this.fpsElement.textContent = this.fps;
            }

            if (this.fpsCounter) {
                this.fpsCounter.classList.remove('low', 'medium');
                if (this.fps < 30) {
                    this.fpsCounter.classList.add('low');
                } else if (this.fps < 50) {
                    this.fpsCounter.classList.add('medium');
                }
            }
        }
    }

    /**
     * Update player position display
     * @param {THREE.Vector3} pos - Player position
     */
    updatePosition(pos) {
        if (this.positionElement) {
            this.positionElement.textContent =
                `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
        }
    }

    /**
     * Update block count display
     * @param {number} count - Number of blocks
     */
    updateBlockCount(count) {
        if (this.blockCountElement) {
            this.blockCountElement.textContent = count;
        }
        if (this.debugPanel) this.debugPanel.updateStats();
    }

    // --- Dialogue System ---

    createDialogueBox() {
        if (this.dialogueBox) return;

        const div = document.createElement('div');
        div.className = 'dialogue-box';
        div.innerHTML = `
            <div class="dialogue-close">✕</div>
            <h3 id="dialogue-speaker">Speaker</h3>
            <p id="dialogue-text">...</p>
        `;
        document.body.appendChild(div);

        div.querySelector('.dialogue-close').addEventListener('click', () => {
            this.hideDialogue();
        });

        this.dialogueBox = div;
        this.dialogueSpeaker = div.querySelector('#dialogue-speaker');
        this.dialogueText = div.querySelector('#dialogue-text');
    }

    showDialogue(speaker, text) {
        if (!this.dialogueBox) this.createDialogueBox();

        this.dialogueSpeaker.textContent = speaker;
        this.dialogueText.textContent = text;
        this.dialogueBox.style.display = 'block';

        // Auto hide after 5 seconds if not interactive? 
        // For now, let user close it or clicking away closes it.
        // Or simply overwrite if new dialogue comes.
    }

    hideDialogue() {
        if (this.dialogueBox) {
            this.dialogueBox.style.display = 'none';
        }
    }

    // --- Speech Bubbles ---

    addSpeechBubble(entity, text, duration = 3000) {
        // Remove existing bubble for this entity if any
        this.removeSpeechBubble(entity);

        const bubble = document.createElement('div');
        bubble.className = 'speech-bubble';
        bubble.textContent = text;
        document.body.appendChild(bubble);

        const bubbleData = {
            element: bubble,
            entity: entity,
            timer: duration
        };

        if (!this.speechBubbles) this.speechBubbles = [];
        this.speechBubbles.push(bubbleData);
    }

    removeSpeechBubble(entity) {
        if (!this.speechBubbles) return;
        const idx = this.speechBubbles.findIndex(b => b.entity === entity);
        if (idx !== -1) {
            const b = this.speechBubbles[idx];
            b.element.remove();
            this.speechBubbles.splice(idx, 1);
        }
    }

    update(dt) {
        if (this.speechBubbles) {
            // Update bubble positions
            const camera = this.game.camera;
            const width = window.innerWidth;
            const height = window.innerHeight;
            const widthHalf = width / 2;
            const heightHalf = height / 2;

            for (let i = this.speechBubbles.length - 1; i >= 0; i--) {
                const b = this.speechBubbles[i];
                b.timer -= dt * 1000;

                if (b.timer <= 0) {
                    b.element.remove();
                    this.speechBubbles.splice(i, 1);
                    continue;
                }

                if (!b.entity || b.entity.isDead || !b.entity.mesh.parent) {
                    b.element.remove();
                    this.speechBubbles.splice(i, 1);
                    continue;
                }

                // Project position
                const pos = new THREE.Vector3().copy(b.entity.position);
                pos.y += b.entity.height + 0.5; // Above head

                pos.project(camera);

                // Check if behind camera
                if (pos.z > 1) {
                    b.element.style.display = 'none';
                } else {
                    b.element.style.display = 'block';
                    const x = (pos.x * widthHalf) + widthHalf;
                    const y = -(pos.y * heightHalf) + heightHalf;

                    b.element.style.left = `${x}px`;
                    b.element.style.top = `${y}px`;
                }
            }
        }
    }

    // --- Omni Wand Spell Selector ---

    createSpellSelector() {
        if (this.spellSelector) return;
        const div = document.createElement('div');
        div.id = 'spell-selector';
        div.style.cssText = `
            position: fixed; right: 20px; top: 50%; transform: translateY(-50%);
            background: rgba(0, 0, 0, 0.7);
            border: 2px solid #a0522d;
            border-radius: 8px;
            padding: 10px;
            color: white;
            font-family: monospace;
            display: none;
            flex-direction: column;
            gap: 5px;
            min-width: 150px;
            z-index: 1000;
        `;
        document.body.appendChild(div);
        this.spellSelector = div;
    }

    updateSpellSelector(spells, currentIndex) {
        if (!this.spellSelector) this.createSpellSelector();
        this.spellSelector.innerHTML = '';

        // Header
        const title = document.createElement('div');
        title.textContent = 'Spells (Press R)';
        title.style.cssText = 'text-align: center; border-bottom: 1px solid #777; margin-bottom: 5px; padding-bottom: 5px; color: #ffd700; font-weight: bold;';
        this.spellSelector.appendChild(title);

        if (!spells || spells.length === 0) {
            const el = document.createElement('div');
            el.textContent = "No spells";
            el.style.color = "#aaa";
            this.spellSelector.appendChild(el);
            return;
        }

        spells.forEach((spell, index) => {
            const el = document.createElement('div');
            el.textContent = spell.name;
            el.style.cssText = `
                padding: 5px;
                background: ${index === currentIndex ? 'rgba(255, 215, 0, 0.3)' : 'transparent'};
                border: 1px solid ${index === currentIndex ? '#ffd700' : 'transparent'};
                border-radius: 4px;
            `;
            if (index === currentIndex) {
                el.textContent = '> ' + spell.name;
            }
            this.spellSelector.appendChild(el);
        });
    }

    toggleSpellSelector(show) {
        if (!this.spellSelector && show) this.createSpellSelector();
        if (this.spellSelector) {
            this.spellSelector.style.display = show ? 'flex' : 'none';
        }
    }
    // --- Spell Creator UI ---

    createSpellCreator() {
        if (this.spellCreatorDiv) return;

        const div = document.createElement('div');
        div.id = 'spell-creator';
        div.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.9); padding: 20px; border-radius: 8px;
            border: 2px solid #a020f0; color: #fff; font-family: 'VT323', monospace;
            text-align: center; z-index: 2500; display: none; min-width: 300px;
        `;

        div.innerHTML = `
            <h2 style="color: #d050ff; margin-top: 0;">Spell Creator</h2>
            <div style="margin-bottom: 15px; text-align: left; font-size: 14px; color: #aaa;">
                Keywords: levitate, damage, fire, push, self, ray
            </div>
            <input type="text" id="spell-input" placeholder="e.g. 'fireball damage'" 
                style="width: 100%; padding: 8px; font-family: inherit; font-size: 16px; margin-bottom: 15px; background: #222; color: #fff; border: 1px solid #555;">
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="spell-create-btn" style="padding: 8px 16px; background: #a020f0; color: white; border: none; cursor: pointer;">Craft Spell</button>
                <button id="spell-cancel-btn" style="padding: 8px 16px; background: #555; color: white; border: none; cursor: pointer;">Cancel</button>
            </div>
        `;

        document.body.appendChild(div);

        this.spellCreatorDiv = div;
        this.spellInput = div.querySelector('#spell-input');

        // Handlers
        div.querySelector('#spell-create-btn').onclick = () => this.handleCreateSpell();
        div.querySelector('#spell-cancel-btn').onclick = () => this.closeSpellCreator();

        this.spellInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleCreateSpell();
            if (e.key === 'Escape') this.closeSpellCreator();
        });
    }

    openSpellCreator(wandItem) {
        if (!this.spellCreatorDiv) this.createSpellCreator();

        this.currentWandItem = wandItem;
        this.spellCreatorDiv.style.display = 'block';
        this.spellInput.value = '';
        this.spellInput.focus();

        // Unlock pointer
        this.game.inputManager.unlock();
        this.game.gameState.flags.inventoryOpen = true; // Use this flag to prevent other inputs
    }

    closeSpellCreator() {
        if (this.spellCreatorDiv) {
            this.spellCreatorDiv.style.display = 'none';
        }
        this.currentWandItem = null;
        this.game.gameState.flags.inventoryOpen = false;

        // Lock pointer back if we click on game, but user usually clicks to lock.
        // We can try to auto-lock if they were playing? 
        // Better to let them click to resume.
    }

    handleCreateSpell() {
        if (!this.currentWandItem) return;

        const text = this.spellInput.value.trim();
        if (!text) return;

        // Use AI to create the spell
        if (this.game.agent) {
            const prompt = `Create a new spell for the OmniWandItem.js based on this description: "${text}". Add it to the default spells list in the constructor.`;
            this.game.agent.sendTextMessage(prompt);
            this.closeSpellCreator();
            this.addChatMessage('system', 'Request sent to AI Agent...');
        } else {
            console.error("No agent found");
            this.addChatMessage('system', "Error: AI Agent not found.");
        }
    }

    // --- Death Screen ---

    createDeathScreen() {
        if (this.deathScreen) return;

        const screen = document.createElement('div');
        screen.id = 'death-screen';
        screen.className = 'hidden';
        screen.innerHTML = `
            <div class="death-title">YOU DIED</div>
            <div class="death-subtitle">Your adventure has come to an end...</div>
            <button class="death-restart-btn" id="respawn-btn">RESPAWN</button>
            <div class="death-hint">Press [SPACE] or click to respawn</div>
        `;

        document.body.appendChild(screen);
        this.deathScreen = screen;

        // Respawn button click handler
        const respawnBtn = screen.querySelector('#respawn-btn');
        respawnBtn.addEventListener('click', () => this.handleRespawn());

        // Keyboard handler for space to respawn
        this.deathKeyHandler = (e) => {
            if (e.code === 'Space' && this.deathScreen && !this.deathScreen.classList.contains('hidden')) {
                e.preventDefault();
                this.handleRespawn();
            }
        };
        document.addEventListener('keydown', this.deathKeyHandler);
    }

    showDeathScreen() {
        if (!this.deathScreen) this.createDeathScreen();

        this.deathScreen.classList.remove('hidden');
        // Force a reflow to restart animation
        this.deathScreen.offsetHeight;

        // Unlock pointer so player can click the button
        if (this.game.inputManager) {
            this.game.inputManager.unlock();
        }
    }

    hideDeathScreen() {
        if (this.deathScreen) {
            this.deathScreen.classList.add('hidden');
        }
    }

    handleRespawn() {
        this.hideDeathScreen();

        if (this.game.player) {
            this.game.player.respawn();
        }

        // Re-lock pointer for gameplay
        if (this.game.inputManager) {
            this.game.inputManager.lock();
        }
    }
}
