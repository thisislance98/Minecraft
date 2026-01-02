
import { auth } from '../../config/firebase-client.js';


export class CommunityUI {
    constructor(game) {
        this.game = game;
        this.isOpen = false;
        this.channels = [];
        this.messages = [];
        this.currentChannelId = 'general';
        this.isLoading = false;

        // Username with localStorage persistence (no default - prompt on first use)
        this.username = localStorage.getItem('communityUsername') || null;

        // Unread message tracking per channel
        this.unreadCounts = {};

        // Thread state - which thread is currently expanded
        this.expandedThreadId = null;

        // We need access to the socket. If it's not global, we might need to get it from game.network.socket or similar.
        // For now, I'll assume game has it or we can import it.
        // Let's assume game.network.socket exists based on common patterns, or I'll try to import.
        // Actually, looking at index.ts, it uses standard socket.io-client. 
        // I'll check how other UIs access socket. 
        // But for now, I'll assume `this.game.network.socket` is safe if I check for it.

        this.injectStyles();
        this.container = this.createUI();
        document.body.appendChild(this.container);

        this.container.style.display = 'none';

        this.socketListenersSetup = false;
        this.setupSocketListeners();
    }

    injectStyles() {
        if (document.getElementById('community-ui-styles')) return;

        const style = document.createElement('style');
        style.id = 'community-ui-styles';
        style.textContent = `
            :root {
                --comm-bg: #1a1b1e;
                --comm-sidebar: #141517;
                --comm-hover: #2c2e33;
                --comm-accent: #5865f2;
                --comm-text: #dcddde;
                --comm-muted: #72767d;
                --comm-border: #202225;
            }

            #community-ui {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 900px;
                height: 600px;
                max-width: 95vw;
                max-height: 90vh;
                background: var(--comm-bg);
                border-radius: 8px;
                box-shadow: 0 0 0 1px #000, 0 8px 40px rgba(0,0,0,0.6);
                display: flex;
                flex-direction: row;
                font-family: 'gg sans', 'Segoe UI', sans-serif; /* Discord-like font or fallback */
                color: var(--comm-text);
                z-index: 5000;
                overflow: hidden;
            }

            /* Sidebar */
            .comm-sidebar {
                width: 240px;
                background: var(--comm-sidebar);
                display: flex;
                flex-direction: column;
                padding: 10px;
            }

            .comm-sidebar-header {
                padding: 10px;
                font-weight: bold;
                border-bottom: 1px solid var(--comm-border);
                margin-bottom: 10px;
                color: white;
            }

            .channel-item {
                padding: 8px 12px;
                margin-bottom: 2px;
                border-radius: 4px;
                cursor: pointer;
                color: var(--comm-muted);
                display: flex;
                align-items: center;
                gap: 6px;
                transition: background 0.1s;
            }

            .channel-item:hover {
                background: var(--comm-hover);
                color: var(--comm-text);
            }

            .channel-item.active {
                background: #393c43;
                color: white;
            }

            .channel-hash {
                font-size: 1.2em;
                color: var(--comm-muted);
            }

            /* Main Chat Area */
            .comm-main {
                flex: 1;
                display: flex;
                flex-direction: column;
                background: var(--comm-bg);
            }

            .comm-header {
                height: 48px;
                padding: 0 16px;
                border-bottom: 1px solid var(--comm-border);
                display: flex;
                align-items: center;
                justify-content: space-between;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            }

            .comm-header-title {
                font-weight: bold;
                color: white;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .comm-close-btn {
                background: none;
                border: none;
                color: var(--comm-muted);
                cursor: pointer;
                font-size: 24px;
            }

            .comm-close-btn:hover { color: white; }

            .comm-messages {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 4px; /* Cozy mode */
            }

            .comm-messages::-webkit-scrollbar {
                width: 8px;
                background: var(--comm-bg);
            }
            .comm-messages::-webkit-scrollbar-thumb {
                background: #121315;
                border-radius: 4px;
            }

            .message-group {
                margin-top: 16px;
                padding-left: 0;
            }
            
            .message-item {
                display: flex;
                gap: 16px;
                padding: 2px 0;
            }

            .message-item:hover {
                background: rgba(0,0,0,0.05); /* subtle highlight */
            }

            .avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: var(--comm-accent);
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                color: white;
                margin-top: 2px;
            }

            .message-content-wrapper {
                flex: 1;
                min-width: 0;
            }

            .message-header {
                display: flex;
                align-items: baseline;
                gap: 8px;
                margin-bottom: 2px;
            }

            .username {
                font-weight: 500;
                color: white;
            }

            .timestamp {
                font-size: 0.75rem;
                color: var(--comm-muted);
            }

            .message-body {
                color: var(--comm-text);
                white-space: pre-wrap;
                word-wrap: break-word;
                line-height: 1.375rem;
            }

            /* Reactions */
            .reactions-bar {
                display: flex;
                gap: 4px;
                margin-top: 4px;
            }
            
            .reaction-pill {
                background: var(--comm-hover);
                border-radius: 4px;
                padding: 2px 6px;
                font-size: 12px;
                cursor: pointer;
                border: 1px solid transparent;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .reaction-pill:hover {
                border-color: var(--comm-muted);
            }
            
            .reaction-pill.active {
                background: rgba(88, 101, 242, 0.15);
                border-color: var(--comm-accent);
            }

            /* Input Area */
            .comm-input-area {
                padding: 0 16px 24px 16px;
                margin-top: 8px;
            }

            .comm-input-box {
                background: #383a40;
                border-radius: 8px;
                padding: 10px;
                display: flex;
                align-items: flex-end; /* for textarea growth */
            }

            .comm-input {
                background: transparent;
                border: none;
                color: white;
                width: 100%;
                max-height: 200px;
                resize: none;
                font-family: inherit;
                outline: none;
                line-height: 1.375rem;
            }

            .comm-send-btn {
                background: transparent;
                border: none;
                color: var(--comm-muted);
                cursor: pointer;
                padding: 4px;
            }
            .comm-send-btn:hover { color: var(--comm-text); }

            /* Thread/Reply Styles */
            .reply-btn {
                background: transparent;
                border: none;
                color: var(--comm-muted);
                cursor: pointer;
                font-size: 11px;
                padding: 2px 6px;
                margin-left: 8px;
                opacity: 0;
                transition: opacity 0.15s;
            }
            .message-item:hover .reply-btn { opacity: 1; }
            .reply-btn:hover { color: var(--comm-accent); }

            .reply-count {
                color: var(--comm-accent);
                font-size: 12px;
                cursor: pointer;
                margin-top: 4px;
            }
            .reply-count:hover { text-decoration: underline; }

            .thread-replies {
                margin-left: 56px;
                border-left: 2px solid var(--comm-border);
                padding-left: 12px;
                margin-top: 4px;
            }

            .thread-replies .message-item .avatar {
                width: 24px;
                height: 24px;
                font-size: 10px;
            }

            /* Notification Badge */
            .channel-badge {
                background: #ed4245;
                color: white;
                font-size: 10px;
                font-weight: bold;
                padding: 2px 6px;
                border-radius: 10px;
                margin-left: auto;
            }

            /* Username Settings Bar */
            .comm-username-bar {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                border-bottom: 1px solid var(--comm-border);
                font-size: 12px;
                color: var(--comm-muted);
            }

            .comm-username-input {
                background: var(--comm-hover);
                border: 1px solid var(--comm-border);
                border-radius: 4px;
                color: white;
                padding: 4px 8px;
                font-size: 12px;
                width: 120px;
                outline: none;
            }
            .comm-username-input:focus {
                border-color: var(--comm-accent);
            }

        `;
        document.head.appendChild(style);
    }

    createUI() {
        const div = document.createElement('div');
        div.id = 'community-ui';
        div.innerHTML = `
            <div class="comm-sidebar">
                <div class="comm-sidebar-header">Antigravity Chat</div>
                <div class="comm-username-bar">
                    <span>Your name:</span>
                    <input type="text" class="comm-username-input" id="comm-username" value="${this.escapeHTML(this.username || '')}" maxlength="20" placeholder="Set your name..." />
                </div>
                <div id="channel-list">Loading...</div>
            </div>
            
            <div class="comm-main">
                <div class="comm-header">
                    <div class="comm-header-title">
                        <span class="channel-hash">#</span>
                        <span id="current-channel-name">general</span>
                    </div>
                    <button class="comm-close-btn">&times;</button>
                </div>

                <div id="message-list" class="comm-messages">
                    <!-- Messages go here -->
                </div>

                <div class="comm-input-area">
                    <div class="comm-input-box">
                        <textarea id="comm-input" class="comm-input" rows="1" placeholder="Message #general"></textarea>
                    </div>
                </div>
            </div>
        `;

        div.querySelector('.comm-close-btn').onclick = () => this.toggle(false);

        // Username input handler
        const usernameInput = div.querySelector('#comm-username');
        usernameInput.onchange = (e) => {
            const newName = e.target.value.trim() || 'Anonymous';
            this.username = newName;
            localStorage.setItem('communityUsername', newName);
        };

        const input = div.querySelector('#comm-input');
        input.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            } else if (e.key === 'Escape' && this.replyingToId) {
                this.replyingToId = null;
                this.updateInputPlaceholder();
            }
        };

        return div;
    }

    setupSocketListeners() {
        if (this.socketListenersSetup) return; // Already set up

        const socket = this.game.socketManager?.socket || window.socket;
        if (!socket) {
            console.warn('Socket not found for CommunityUI, will retry when UI opens');
            return;
        }

        this.socketListenersSetup = true;
        console.log('[CommunityUI] Socket listeners set up');

        socket.on('chat:message', (msg) => {
            if (msg.channelId === this.currentChannelId && this.isOpen) {
                this.appendMessage(msg);
                this.scrollToBottom();
            } else {
                // Track unread for other channels or when closed
                this.unreadCounts[msg.channelId] = (this.unreadCounts[msg.channelId] || 0) + 1;
                this.renderValues();
                this.updateCommunityButtonBadge();
            }
        });

        socket.on('chat:reaction', (data) => {
            // Find message and update reactions
            // This requires message lookup by ID, which is simple if we have the DOM or local state
            this.updateMessageReactions(data.messageId, data.reactions);
        });
    }

    async toggle(state) {
        if (state === undefined) state = !this.isOpen;
        this.isOpen = state;
        this.container.style.display = this.isOpen ? 'flex' : 'none';

        if (this.isOpen) {
            // Prompt for username on first use
            if (!this.username) {
                await this.promptForUsername();
            }

            // Retry setting up socket listeners if they weren't ready before
            if (!this.socketListenersSetup) {
                this.setupSocketListeners();
            }
            document.exitPointerLock();
            if (this.channels.length === 0) {
                await this.fetchChannels();
            }
            // Clear unread for current channel
            this.unreadCounts[this.currentChannelId] = 0;
            this.renderValues();
            this.updateCommunityButtonBadge();
            // Focus input
            setTimeout(() => this.container.querySelector('#comm-input').focus(), 50);
        }
    }

    async promptForUsername() {
        return new Promise((resolve) => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.id = 'username-prompt-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: #1a1b1e;
                border-radius: 8px;
                padding: 24px;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                font-family: 'gg sans', 'Segoe UI', sans-serif;
                color: white;
            `;

            modal.innerHTML = `
                <h2 style="margin: 0 0 16px 0; font-size: 20px;">Welcome to Community Chat!</h2>
                <p style="margin: 0 0 16px 0; color: #b9bbbe; font-size: 14px;">
                    Enter a display name that others will see when you chat.
                </p>
                <input type="text" id="username-prompt-input" 
                    placeholder="Enter your name..." 
                    maxlength="20"
                    style="
                        width: 100%;
                        box-sizing: border-box;
                        padding: 12px;
                        border: 1px solid #202225;
                        border-radius: 4px;
                        background: #383a40;
                        color: white;
                        font-size: 16px;
                        outline: none;
                        margin-bottom: 16px;
                    "
                />
                <button id="username-prompt-submit" style="
                    width: 100%;
                    padding: 12px;
                    background: #5865f2;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-size: 16px;
                    cursor: pointer;
                    transition: background 0.2s;
                ">
                    Continue
                </button>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const input = modal.querySelector('#username-prompt-input');
            const submitBtn = modal.querySelector('#username-prompt-submit');

            input.focus();

            const submit = () => {
                const name = input.value.trim() || 'Anonymous';
                this.username = name;
                localStorage.setItem('communityUsername', name);

                // Update the username input in the UI
                const usernameInput = this.container.querySelector('#comm-username');
                if (usernameInput) {
                    usernameInput.value = name;
                }

                overlay.remove();
                resolve();
            };

            submitBtn.onclick = submit;
            input.onkeydown = (e) => {
                if (e.key === 'Enter') submit();
            };

            submitBtn.onmouseover = () => submitBtn.style.background = '#4752c4';
            submitBtn.onmouseout = () => submitBtn.style.background = '#5865f2';
        });
    }

    async fetchChannels() {
        try {
            const res = await fetch('/api/channels');
            if (res.ok) {
                const data = await res.json();
                this.channels = data.channels || [];
                this.renderValues();

                // Join first channel if none selected
                if (!this.currentChannelId && this.channels.length > 0) {
                    this.switchChannel(this.channels[0].id);
                } else {
                    this.switchChannel(this.currentChannelId || 'general');
                }
            }
        } catch (e) {
            console.error('Failed to fetch channels', e);
        }
    }

    renderValues() {
        const list = this.container.querySelector('#channel-list');
        list.innerHTML = this.channels.map(c => {
            const unread = this.unreadCounts[c.id] || 0;
            return `
            <div class="channel-item ${c.id === this.currentChannelId ? 'active' : ''}" data-id="${c.id}">
                <span class="channel-hash">#</span>
                <span>${c.name}</span>
                ${unread > 0 ? `<span class="channel-badge">${unread}</span>` : ''}
            </div>
        `;
        }).join('');

        list.querySelectorAll('.channel-item').forEach(el => {
            el.onclick = () => this.switchChannel(el.dataset.id);
        });
    }

    async switchChannel(id) {
        if (!id) return;

        const prevId = this.currentChannelId;
        this.currentChannelId = id;

        // Clear unread for this channel
        this.unreadCounts[id] = 0;
        this.updateCommunityButtonBadge();

        // Update UI
        this.renderValues(); // Re-render to update active class
        const channel = this.channels.find(c => c.id === id);
        if (channel) {
            this.container.querySelector('#current-channel-name').textContent = channel.name;
            this.container.querySelector('#comm-input').placeholder = `Message #${channel.name}`;
        }

        // Socket join/leave
        const socket = this.game.socketManager?.socket || window.socket;
        if (socket) {
            if (prevId) socket.emit('chat:leave_channel', prevId);
            socket.emit('chat:join_channel', id);
        }

        // Fetch messages (clear existing first)
        await this.fetchMessages(id);
    }

    async fetchMessages(channelId) {
        const list = this.container.querySelector('#message-list');
        // Clear existing messages first
        this.messages = [];
        list.innerHTML = '<div style="padding:20px; text-align:center; color:#72767d;">Loading messages...</div>';

        try {
            const res = await fetch(`/api/channels/${channelId}/messages?limit=50`);
            if (res.ok) {
                const data = await res.json();
                // Clear old messages and only show new ones
                this.messages = data.messages || [];
                this.renderMessages();
                this.scrollToBottom();
            }
        } catch (e) {
            console.error('Failed to fetch messages', e);
            list.innerHTML = '<div style="padding:20px; color:#f04747;">Failed to load messages.</div>';
        }
    }

    renderMessages() {
        const list = this.container.querySelector('#message-list');
        list.innerHTML = '';

        // Filter to only show top-level messages (no threadId)
        const topLevelMessages = this.messages.filter(msg => !msg.threadId);

        topLevelMessages.forEach(msg => {
            const el = this.createMessageElement(msg);
            list.appendChild(el);

            // If this thread is expanded, show replies
            if (this.expandedThreadId === msg.id) {
                const replies = this.messages.filter(m => m.threadId === msg.id);
                if (replies.length > 0) {
                    const threadContainer = document.createElement('div');
                    threadContainer.className = 'thread-replies';
                    replies.forEach(reply => {
                        threadContainer.appendChild(this.createMessageElement(reply, true));
                    });
                    list.appendChild(threadContainer);
                }
            }
        });
    }

    createMessageElement(msg, isReply = false) {
        const el = document.createElement('div');
        el.className = 'message-item';
        el.id = `msg-${msg.id}`;

        // Get display name - always use the stored displayName from the message
        // Fall back to truncated userId if no displayName was saved
        const displayName = msg.displayName || msg.userId.substring(0, 8);

        // Avatar logic (pseudo-random color based on display name)
        const hue = (displayName.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 360);
        const date = new Date(msg.createdAt);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Get reply count for this message
        const replyCount = msg.replyCount || this.messages.filter(m => m.threadId === msg.id).length;

        el.innerHTML = `
            <div class="avatar" style="background: hsl(${hue}, 60%, 50%)">
                ${displayName.substring(0, 2).toUpperCase()}
            </div>
            <div class="message-content-wrapper">
                <div class="message-header">
                    <span class="username">${this.escapeHTML(displayName)}</span>
                    <span class="timestamp">${timeStr}</span>
                    ${!isReply ? '<button class="reply-btn">Reply</button>' : ''}
                </div>
                <div class="message-body">${this.linkify(this.escapeHTML(msg.content))}</div>
                ${!isReply && replyCount > 0 ? `<div class="reply-count">${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}</div>` : ''}
                <div class="reactions-bar"></div>
            </div>
        `;

        // Add reply button handler
        const replyBtn = el.querySelector('.reply-btn');
        if (replyBtn) {
            replyBtn.onclick = (e) => {
                e.stopPropagation();
                this.startReply(msg.id);
            };
        }

        // Add reply count click handler to expand/collapse thread
        const replyCountEl = el.querySelector('.reply-count');
        if (replyCountEl) {
            replyCountEl.onclick = () => {
                this.expandedThreadId = this.expandedThreadId === msg.id ? null : msg.id;
                this.renderMessages();
            };
        }

        // Render reactions
        this.renderReactions(el, msg.reactions);

        return el;
    }

    renderReactions(messageEl, reactions) {
        const bar = messageEl.querySelector('.reactions-bar');
        bar.innerHTML = '';

        if (!reactions) return;

        Object.entries(reactions).forEach(([emoji, userIds]) => {
            const count = userIds.length;
            const myId = auth.currentUser?.uid;
            const hasReacted = userIds.includes(myId);

            const pill = document.createElement('div');
            pill.className = `reaction-pill ${hasReacted ? 'active' : ''}`;
            pill.innerHTML = `${emoji} <span>${count}</span>`;
            pill.onclick = () => this.toggleReaction(messageEl.id.replace('msg-', ''), emoji);

            bar.appendChild(pill);
        });

        // Always show + button or similar? 
        // For MVP, maybe just support clicking valid reactions or a fixed set.
        // Let's add a generic 'Like' button if no reactions? 
        // Or just let people click existing ones.
        // For simplicity, I'll add a '👍' button if empty, 
        // or a small '+' button.
        const addBtn = document.createElement('div');
        addBtn.className = 'reaction-pill';
        addBtn.innerHTML = '+';
        addBtn.onclick = () => this.toggleReaction(messageEl.id.replace('msg-', ''), '👍'); // Default to thumbs up
        bar.appendChild(addBtn);
    }

    updateMessageReactions(msgId, reactions) {
        // Find message in array
        const msg = this.messages.find(m => m.id === msgId);
        if (msg) {
            msg.reactions = reactions;
        }

        // Update DOM
        const el = this.container.querySelector(`#msg-${msgId}`);
        if (el) {
            this.renderReactions(el, reactions);
        }
    }

    appendMessage(msg) {
        this.messages.push(msg);

        // If this is a thread reply, re-render to show it in the proper place
        if (msg.threadId) {
            // Update the parent message's reply count in our local data
            const parentMsg = this.messages.find(m => m.id === msg.threadId);
            if (parentMsg) {
                parentMsg.replyCount = (parentMsg.replyCount || 0) + 1;
            }
            this.renderMessages();
        } else {
            // Top-level message, just append
            const list = this.container.querySelector('#message-list');
            list.appendChild(this.createMessageElement(msg));
        }
    }

    scrollToBottom() {
        const list = this.container.querySelector('#message-list');
        list.scrollTop = list.scrollHeight;
    }

    async sendMessage() {
        const input = this.container.querySelector('#comm-input');
        const content = input.value.trim();
        if (!content) return;

        // Only require a username, not Firebase auth
        if (!this.username) {
            await this.promptForUsername();
            if (!this.username) {
                alert('Please set your name to chat!');
                return;
            }
        }

        // Use Firebase user ID if logged in, otherwise use a persistent guest ID
        const user = auth.currentUser;
        let oderId;
        if (user) {
            oderId = user.uid;
        } else {
            // Generate or retrieve a persistent guest ID
            let guestId = localStorage.getItem('communityGuestId');
            if (!guestId) {
                guestId = 'guest_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
                localStorage.setItem('communityGuestId', guestId);
            }
            oderId = guestId;
        }

        input.value = ''; // Optimistic clear

        try {
            const payload = {
                content,
                userId: oderId,
                displayName: this.username
            };

            // If replying to a thread, include threadId
            if (this.replyingToId) {
                payload.threadId = this.replyingToId;
            }

            await fetch(`/api/channels/${this.currentChannelId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Clear reply state
            this.replyingToId = null;
            this.updateInputPlaceholder();

            // We rely on socket to get the message back and append it
        } catch (e) {
            console.error('Send failed', e);
            input.value = content; // Restore on fail
        }
    }

    startReply(messageId) {
        this.replyingToId = messageId;
        this.expandedThreadId = messageId; // Auto-expand thread when replying
        this.renderMessages();

        // Update input placeholder to show replying context
        this.updateInputPlaceholder();

        // Focus input
        this.container.querySelector('#comm-input').focus();
    }

    updateInputPlaceholder() {
        const input = this.container.querySelector('#comm-input');
        const channel = this.channels.find(c => c.id === this.currentChannelId);
        if (this.replyingToId) {
            input.placeholder = 'Reply to thread... (Esc to cancel)';
        } else if (channel) {
            input.placeholder = `Message #${channel.name}`;
        }
    }

    updateCommunityButtonBadge() {
        // Calculate total unread across all channels
        const totalUnread = Object.values(this.unreadCounts).reduce((sum, count) => sum + count, 0);

        // Find the community button in UIManager and update badge
        const feedbackBtn = document.getElementById('feedback-btn');
        if (feedbackBtn) {
            // Remove existing badge
            const existingBadge = feedbackBtn.querySelector('.comm-button-badge');
            if (existingBadge) existingBadge.remove();

            // Add badge if there are unreads
            if (totalUnread > 0) {
                const badge = document.createElement('span');
                badge.className = 'comm-button-badge';
                badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
                badge.style.cssText = `
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: #ed4245;
                    color: white;
                    font-size: 10px;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 10px;
                    min-width: 16px;
                    text-align: center;
                `;
                feedbackBtn.style.position = 'relative';
                feedbackBtn.appendChild(badge);
            }
        }
    }

    async toggleReaction(messageId, emoji) {
        const user = auth.currentUser;
        if (!user) {
            alert('Please login to react to messages!');
            return;
        }

        try {
            const res = await fetch(`/api/channels/messages/${messageId}/react`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.uid, emoji })
            });

            if (res.ok) {
                const data = await res.json();
                // Update the local message reactions
                this.updateMessageReactions(messageId, data.reactions);

                // Broadcast reaction update via socket for other clients
                const socket = this.game.socketManager?.socket || window.socket;
                if (socket) {
                    socket.emit('chat:reaction', {
                        channelId: this.currentChannelId,
                        messageId,
                        reactions: data.reactions
                    });
                }
            } else {
                console.error('Reaction failed:', await res.text());
            }
        } catch (e) {
            console.error('Reaction failed', e);
        }
    }

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    linkify(text) {
        // Basic url linker
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, '<a href="$1" target="_blank" style="color:var(--comm-accent)">$1</a>');
    }
}
