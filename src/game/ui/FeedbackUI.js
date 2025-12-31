import { auth } from '../../config/firebase-client.js';

export class FeedbackUI {
    constructor(game) {
        this.game = game;
        this.isOpen = false;
        this.items = [];
        this.isLoading = false;

        this.injectStyles();
        this.container = this.createUI();
        document.body.appendChild(this.container);

        this.container.style.display = 'none';
    }

    injectStyles() {
        if (document.getElementById('feedback-ui-styles')) return;

        const style = document.createElement('style');
        style.id = 'feedback-ui-styles';
        style.textContent = `
            #feedback-ui {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 500px;
                max-width: 90vw;
                height: 600px;
                max-height: 80vh;
                background: rgba(20, 20, 30, 0.95);
                border: 2px solid #ffcc00;
                border-radius: 12px;
                padding: 24px;
                font-family: 'VT323', monospace;
                color: white;
                z-index: 5000;
                display: flex;
                flex-direction: column;
                box-shadow: 0 0 40px rgba(255, 204, 0, 0.2);
            }
            .feedback-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                border-bottom: 1px solid rgba(255, 204, 0, 0.3);
                padding-bottom: 10px;
            }
            .feedback-title {
                font-size: 28px;
                color: #ffcc00;
                margin: 0;
            }
            .feedback-close {
                background: none;
                border: none;
                color: #ff6666;
                font-size: 24px;
                cursor: pointer;
            }
            .feedback-tabs {
                display: flex;
                gap: 10px;
                margin-bottom: 15px;
            }
            .feedback-tab {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: white;
                padding: 5px 15px;
                cursor: pointer;
                border-radius: 4px;
                font-family: inherit;
            }
            .feedback-tab.active {
                background: #ffcc00;
                color: black;
                border-color: #ffcc00;
            }
            .feedback-list {
                flex: 1;
                overflow-y: auto;
                margin-bottom: 20px;
                padding-right: 5px;
            }
            .feedback-item {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 10px;
                display: flex;
                gap: 12px;
                align-items: center;
                border: 1px solid transparent;
                transition: all 0.2s;
            }
            .feedback-item:hover {
                background: rgba(255, 255, 255, 0.08);
                border-color: rgba(255, 204, 0, 0.3);
            }
            .vote-box {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
                min-width: 40px;
            }
            .vote-btn {
                background: none;
                border: 1px solid #ffcc00;
                color: #ffcc00;
                cursor: pointer;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 16px;
                transition: all 0.2s;
            }
            .vote-btn.voted {
                background: #ffcc00;
                color: black;
            }
            .vote-count {
                font-size: 18px;
                font-weight: bold;
            }
            .item-content {
                flex: 1;
            }
            .item-type {
                font-size: 12px;
                text-transform: uppercase;
                padding: 2px 6px;
                border-radius: 3px;
                margin-right: 5px;
            }
            .type-feature { background: #00ccff; color: black; }
            .type-bug { background: #ff4444; color: white; }
            
            .item-title {
                font-size: 18px;
                margin: 0;
                display: inline;
            }
            .item-desc {
                font-size: 14px;
                color: #aaa;
                margin: 4px 0 0 0;
            }
            .feedback-form {
                display: flex;
                flex-direction: column;
                gap: 10px;
                border-top: 1px solid rgba(255, 204, 0, 0.3);
                padding-top: 20px;
            }
            .feedback-input, .feedback-textarea {
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: white;
                padding: 8px;
                border-radius: 4px;
                font-family: inherit;
            }
            .feedback-textarea {
                height: 60px;
                resize: none;
            }
            .feedback-submit {
                background: #ffcc00;
                color: black;
                border: none;
                padding: 10px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                font-family: inherit;
            }
            .feedback-submit:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .empty-state {
                text-align: center;
                color: #888;
                margin-top: 40px;
                font-style: italic;
            }
        `;
        document.head.appendChild(style);
    }

    createUI() {
        const div = document.createElement('div');
        div.id = 'feedback-ui';
        div.innerHTML = `
            <div class="feedback-header">
                <h2 class="feedback-title">📝 Features & Bugs</h2>
                <button class="feedback-close">&times;</button>
            </div>
            
            <div class="feedback-tabs">
                <button class="feedback-tab active" data-type="all">All</button>
                <button class="feedback-tab" data-type="feature">Features</button>
                <button class="feedback-tab" data-type="bug">Bugs</button>
            </div>

            <div id="feedback-list" class="feedback-list">
                <div class="empty-state">Loading feedback...</div>
            </div>

            <div class="feedback-form">
                <div style="display: flex; gap: 10px;">
                    <select id="fb-type" class="feedback-input" style="width: 100px;">
                        <option value="feature">Feature</option>
                        <option value="bug">Bug</option>
                    </select>
                    <input type="text" id="fb-title" class="feedback-input" style="flex: 1;" placeholder="Short title..." max-length="100">
                </div>
                <textarea id="fb-description" class="feedback-textarea" placeholder="More details (optional)..."></textarea>
                <button id="fb-submit" class="feedback-submit">Submit Request</button>
            </div>
        `;

        div.querySelector('.feedback-close').onclick = () => this.toggle(false);
        div.querySelector('#fb-submit').onclick = () => this.submitFeedback();

        // Tab switching
        const tabs = div.querySelectorAll('.feedback-tab');
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderList(tab.getAttribute('data-type'));
            };
        });

        return div;
    }

    async toggle(state) {
        if (state === undefined) state = !this.isOpen;
        this.isOpen = state;
        this.container.style.display = this.isOpen ? 'flex' : 'none';

        if (this.isOpen) {
            document.exitPointerLock();
            this.fetchFeedback();
        }
    }

    async fetchFeedback() {
        this.isLoading = true;
        try {
            const res = await fetch('/api/feedback');
            if (res.ok) {
                const data = await res.json();
                this.items = data.items || [];
                this.renderList();
            }
        } catch (e) {
            console.error('Failed to fetch feedback:', e);
        } finally {
            this.isLoading = false;
        }
    }

    renderList(filterType = 'all') {
        const listDiv = this.container.querySelector('#feedback-list');
        const user = auth.currentUser;
        const uid = user ? user.uid : null;

        const filtered = filterType === 'all'
            ? this.items
            : this.items.filter(i => i.type === filterType);

        if (filtered.length === 0) {
            listDiv.innerHTML = `<div class="empty-state">No ${filterType === 'all' ? '' : filterType + ' '}requests yet. Be the first!</div>`;
            return;
        }

        listDiv.innerHTML = filtered.map(item => {
            const hasVoted = uid && item.votedBy && item.votedBy.includes(uid);
            return `
                <div class="feedback-item">
                    <div class="vote-box">
                        <button class="vote-btn ${hasVoted ? 'voted' : ''}" data-id="${item.id}">
                            ${hasVoted ? '★' : '☆'}
                        </button>
                        <div class="vote-count">${item.votes || 0}</div>
                    </div>
                    <div class="item-content">
                        <div>
                            <span class="item-type type-${item.type}">${item.type}</span>
                            <h4 class="item-title">${this.escapeHTML(item.title)}</h4>
                        </div>
                        <p class="item-desc">${this.escapeHTML(item.description || '')}</p>
                    </div>
                </div>
            `;
        }).join('');

        // Attach vote listeners
        listDiv.querySelectorAll('.vote-btn').forEach(btn => {
            btn.onclick = () => this.handleVote(btn.getAttribute('data-id'));
        });
    }

    async handleVote(id) {
        const user = auth.currentUser;
        if (!user) {
            alert('Please sign in to vote! Open the Store (cyan diamond) to login.');
            return;
        }

        try {
            const res = await fetch(`/api/feedback/${id}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.uid })
            });

            if (res.ok) {
                // Refresh list
                this.fetchFeedback();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to vote');
            }
        } catch (e) {
            console.error('Vote error:', e);
        }
    }

    async submitFeedback() {
        const user = auth.currentUser;
        const titleInput = this.container.querySelector('#fb-title');
        const descInput = this.container.querySelector('#fb-description');
        const typeSelect = this.container.querySelector('#fb-type');
        const submitBtn = this.container.querySelector('#fb-submit');

        const title = titleInput.value.trim();
        const description = descInput.value.trim();
        const type = typeSelect.value;

        if (!title) {
            alert('Please enter a title');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    title,
                    description,
                    userId: user ? user.uid : 'anonymous'
                })
            });

            if (res.ok) {
                titleInput.value = '';
                descInput.value = '';
                this.fetchFeedback();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to submit');
            }
        } catch (e) {
            console.error('Submit error:', e);
            alert('Error submitting feedback');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Request';
        }
    }

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}
