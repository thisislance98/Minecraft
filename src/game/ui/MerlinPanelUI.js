/**
 * MerlinPanelUI - Full-screen modal panel for Merlin's Workshop
 *
 * Features:
 * - Category selection (Item, Creature, Fix, Build, Custom)
 * - AI-generated suggestions for each category
 * - Real-time task queue display
 * - Custom input for requests
 * - Notification system
 */

export class MerlinPanelUI {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        this.selectedCategory = null;
        this.taskManager = null;
        this.suggestions = [];
        this.selectedTaskId = null; // Currently viewing task
        this.isDetailView = false;

        // Categories definition
        this.categories = [
            { id: 'item', label: 'Item', icon: '⚔️', description: 'Create magical items and weapons' },
            { id: 'creature', label: 'Creature', icon: '🦁', description: 'Spawn new creatures and companions' },
            { id: 'fix', label: 'Fix', icon: '🔧', description: 'Fix bugs and issues' },
            { id: 'build', label: 'Build', icon: '🏗️', description: 'Build structures and buildings' },
            { id: 'custom', label: 'Custom', icon: '✨', description: 'Any custom request' }
        ];

        this.createPanel();
        this.setupEventListeners();
        this.setupMerlinButton();

        console.log('[MerlinPanelUI] Initialized');
    }

    /**
     * Set the TaskManager reference
     */
    setTaskManager(taskManager) {
        this.taskManager = taskManager;

        // Listen for task events
        if (this.taskManager) {
            this.taskManager.addListener((event, data) => {
                this.handleTaskEvent(event, data);
            });
        }
    }

    /**
     * Create the panel DOM structure
     */
    createPanel() {
        const panel = document.createElement('div');
        panel.id = 'merlin-panel';
        panel.className = 'hidden';
        panel.innerHTML = `
            <div class="merlin-panel-content">
                <div class="merlin-panel-header">
                    <h2>🧙 Merlin's Workshop</h2>
                </div>

                <div class="merlin-panel-body">
                    <!-- Category Grid -->
                    <div class="merlin-section">
                        <h3 class="merlin-section-title">Choose a Task Type</h3>
                        <div class="merlin-category-grid" id="merlin-categories">
                            ${this.categories.map(cat => `
                                <button class="merlin-category-btn" data-category="${cat.id}">
                                    <span class="category-icon">${cat.icon}</span>
                                    <span class="category-label">${cat.label}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Suggestions Area -->
                    <div class="merlin-section" id="merlin-suggestions-section">
                        <h3 class="merlin-section-title">
                            <span id="suggestions-title">💡 Suggestions</span>
                            <span id="suggestions-stats" class="suggestions-stats"></span>
                            <button id="refresh-suggestions-btn" class="refresh-btn hidden" title="Show different suggestions">🔄</button>
                        </h3>
                        <div class="merlin-suggestions" id="merlin-suggestions">
                            <p class="suggestions-placeholder">Select a category to see suggestions</p>
                        </div>
                    </div>

                    <!-- Task List -->
                    <div class="merlin-section">
                        <h3 class="merlin-section-title">
                            <span>📋 Tasks</span>
                            <span id="task-counts" class="task-counts"></span>
                        </h3>
                        <div class="merlin-task-list" id="merlin-task-list">
                            <p class="task-placeholder">No tasks yet. Start one above!</p>
                        </div>
                    </div>

                    <!-- Task Detail View (hidden by default) -->
                    <div class="merlin-task-detail hidden" id="merlin-task-detail">
                        <div class="task-detail-header">
                            <button class="task-detail-back" id="task-detail-back">← Back</button>
                            <span class="task-detail-title" id="task-detail-title">Task Details</span>
                            <span class="task-detail-status" id="task-detail-status"></span>
                        </div>
                        <div class="task-detail-prompt" id="task-detail-prompt"></div>
                        <div class="task-detail-response" id="task-detail-response">
                            <p class="response-placeholder">No response yet...</p>
                        </div>
                        <!-- Follow-up Suggestions -->
                        <div class="task-followup-suggestions hidden" id="task-followup-suggestions">
                            <div class="followup-suggestions-header">💡 Quick Feedback</div>
                            <div class="followup-suggestions-chips" id="followup-chips"></div>
                        </div>

                        <div class="task-detail-input">
                            <textarea id="task-followup-input" placeholder="Ask a follow-up question or give more instructions..."></textarea>
                            <button id="task-followup-send" class="merlin-start-btn">
                                <span>💬</span> Send
                            </button>
                        </div>
                    </div>

                    <!-- Custom Input -->
                    <div class="merlin-section merlin-input-section">
                        <div class="merlin-input-wrapper">
                            <textarea id="merlin-custom-input" placeholder="Enter your custom request..."></textarea>
                            <button id="merlin-start-task" class="merlin-start-btn">
                                <span>▶️</span> Start Task
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Close button at bottom right -->
                <button id="merlin-panel-close" class="merlin-close-btn">×</button>
            </div>
        `;
        document.body.appendChild(panel);

        // Inject styles
        this.injectStyles();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Helper to safely add event listeners
        const addListener = (id, event, handler) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener(event, handler);
            } else {
                console.warn(`[MerlinPanelUI] Element not found: ${id}`);
            }
        };

        // Close button
        addListener('merlin-panel-close', 'click', () => {
            this.hide();
        });

        // Category buttons
        addListener('merlin-categories', 'click', (e) => {
            const btn = e.target.closest('.merlin-category-btn');
            if (btn) {
                const category = btn.dataset.category;
                this.selectCategory(category);
            }
        });

        // Suggestions click
        addListener('merlin-suggestions', 'click', (e) => {
            const suggestionEl = e.target.closest('.suggestion-item');
            if (suggestionEl) {
                const text = suggestionEl.dataset.text;
                this.startTaskFromSuggestion(text);
            }
        });

        // Refresh suggestions button
        addListener('refresh-suggestions-btn', 'click', () => {
            if (this.selectedCategory) {
                this.cycleSuggestions();
            }
        });

        // Task list click - open task detail
        addListener('merlin-task-list', 'click', (e) => {
            const taskItem = e.target.closest('.task-item');
            if (taskItem && !e.target.closest('.task-cancel-btn')) {
                const taskId = taskItem.dataset.taskId;
                this.showTaskDetail(taskId);
            }
        });

        // Task detail back button
        addListener('task-detail-back', 'click', () => {
            this.hideTaskDetail();
        });

        // Task follow-up send button
        addListener('task-followup-send', 'click', () => {
            this.sendFollowUp();
        });

        // Task follow-up enter key
        addListener('task-followup-input', 'keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendFollowUp();
            }
        });

        // Start task button
        addListener('merlin-start-task', 'click', () => {
            this.startCustomTask();
        });

        // Enter key in input
        addListener('merlin-custom-input', 'keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.startCustomTask();
            }
        });

        // Close on escape (only if not typing in an input)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                const merlinInput = document.getElementById('merlin-custom-input');
                const followupInput = document.getElementById('task-followup-input');
                // If typing in input, just blur it instead of closing panel
                if (document.activeElement === merlinInput || document.activeElement === followupInput) {
                    document.activeElement.blur();
                } else {
                    this.hide();
                }
            }
        });
    }

    /**
     * Setup the Merlin button in top-right controls (next to world button)
     */
    setupMerlinButton() {
        const topRightControls = document.getElementById('top-right-controls');
        if (topRightControls) {
            const worldBtn = document.getElementById('world-btn');

            const merlinBtn = document.createElement('button');
            merlinBtn.id = 'merlin-btn';
            merlinBtn.title = "Merlin's Workshop (M)";
            merlinBtn.textContent = '🧙';
            merlinBtn.addEventListener('click', () => this.toggle());

            // Insert after world button, or at the start if world button doesn't exist
            if (worldBtn && worldBtn.nextSibling) {
                topRightControls.insertBefore(merlinBtn, worldBtn.nextSibling);
            } else if (worldBtn) {
                topRightControls.appendChild(merlinBtn);
            } else {
                topRightControls.insertBefore(merlinBtn, topRightControls.firstChild);
            }
        }
    }

    /**
     * Select a category and load suggestions
     */
    selectCategory(categoryId) {
        // Update UI
        const buttons = document.querySelectorAll('.merlin-category-btn');
        buttons.forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.category === categoryId);
        });

        this.selectedCategory = categoryId;

        // Show refresh button
        const refreshBtn = document.getElementById('refresh-suggestions-btn');
        refreshBtn.classList.remove('hidden');

        // Load suggestions from predefined pool
        if (this.taskManager) {
            this.suggestions = this.taskManager.requestSuggestions(categoryId);
            this.updateSuggestionStats();
        } else {
            this.suggestions = this.getDefaultSuggestions(categoryId);
        }

        this.renderSuggestions();
    }

    /**
     * Cycle to new suggestions
     */
    cycleSuggestions() {
        if (!this.selectedCategory || !this.taskManager) return;

        // Add spin animation to refresh button
        const refreshBtn = document.getElementById('refresh-suggestions-btn');
        refreshBtn.classList.add('spinning');

        // Get new suggestions
        this.suggestions = this.taskManager.cycleSuggestions(this.selectedCategory);
        this.updateSuggestionStats();
        this.renderSuggestions();

        // Remove spin animation
        setTimeout(() => {
            refreshBtn.classList.remove('spinning');
        }, 300);
    }

    /**
     * Update the suggestion stats display
     */
    updateSuggestionStats() {
        const statsEl = document.getElementById('suggestions-stats');
        if (!this.taskManager || !this.selectedCategory) {
            statsEl.textContent = '';
            return;
        }

        const stats = this.taskManager.getSuggestionStats(this.selectedCategory);
        statsEl.textContent = `(${stats.remaining} more available)`;
    }

    /**
     * Render suggestions in the UI
     */
    renderSuggestions() {
        const container = document.getElementById('merlin-suggestions');

        if (!this.suggestions || this.suggestions.length === 0) {
            container.innerHTML = '<p class="suggestions-placeholder">No suggestions available</p>';
            return;
        }

        container.innerHTML = this.suggestions.map(suggestion => `
            <div class="suggestion-item" data-text="${this.escapeHtml(suggestion)}">
                <span class="suggestion-bullet">•</span>
                <span class="suggestion-text">${this.escapeHtml(suggestion)}</span>
            </div>
        `).join('');
    }

    /**
     * Start a task from a suggestion
     */
    startTaskFromSuggestion(text) {
        if (!this.taskManager) {
            console.error('[MerlinPanelUI] TaskManager not available');
            return;
        }

        console.log(`[MerlinPanelUI] Starting task from suggestion: ${text}`);
        this.taskManager.createTask(text, this.selectedCategory || 'custom');

        // Update task list
        this.updateTaskList();
    }

    /**
     * Start a custom task from the input
     */
    startCustomTask() {
        const input = document.getElementById('merlin-custom-input');
        const text = input.value.trim();

        if (!text) return;

        if (!this.taskManager) {
            console.error('[MerlinPanelUI] TaskManager not available');
            return;
        }

        console.log(`[MerlinPanelUI] Starting custom task: ${text}`);
        this.taskManager.createTask(text, this.selectedCategory || 'custom');

        // Clear input
        input.value = '';

        // Update task list
        this.updateTaskList();
    }

    /**
     * Update the task list display
     */
    updateTaskList() {
        const container = document.getElementById('merlin-task-list');
        const countsEl = document.getElementById('task-counts');

        if (!this.taskManager) {
            container.innerHTML = '<p class="task-placeholder">No tasks yet. Start one above!</p>';
            countsEl.textContent = '';
            return;
        }

        const tasks = this.taskManager.getAllTasks();
        const counts = this.taskManager.getTaskCounts();

        // Update counts
        const parts = [];
        if (counts.running > 0) parts.push(`${counts.running} running`);
        if (counts.pending > 0) parts.push(`${counts.pending} pending`);
        countsEl.textContent = parts.length > 0 ? `(${parts.join(', ')})` : '';

        if (tasks.length === 0) {
            container.innerHTML = '<p class="task-placeholder">No tasks yet. Start one above!</p>';
            return;
        }

        // Render tasks (newest first, limit to 10)
        const recentTasks = tasks.slice(-10).reverse();
        container.innerHTML = recentTasks.map(task => this.renderTask(task)).join('');
    }

    /**
     * Render a single task item
     */
    renderTask(task) {
        const statusIcons = {
            pending: '⏳',
            running: '🔄',
            completed: '✅',
            error: '❌'
        };

        const statusClasses = {
            pending: 'task-pending',
            running: 'task-running',
            completed: 'task-completed',
            error: 'task-error'
        };

        const icon = statusIcons[task.status] || '❓';
        const statusClass = statusClasses[task.status] || '';
        const shortPrompt = task.prompt.length > 40 ? task.prompt.substring(0, 40) + '...' : task.prompt;

        let statusText = '';
        if (task.status === 'running' && task.response) {
            const shortResponse = task.response.length > 30 ? '...' + task.response.slice(-30) : task.response;
            statusText = `<span class="task-response">${this.escapeHtml(shortResponse)}</span>`;
        } else if (task.status === 'error' && task.error) {
            statusText = `<span class="task-error-msg">${this.escapeHtml(task.error)}</span>`;
        }

        // Use magical orb for running tasks instead of emoji
        const iconHtml = task.status === 'running'
            ? `<div class="merlin-orb">
                <div class="orb-core"></div>
                <div class="orb-ring"></div>
                <div class="orb-particle p1"></div>
                <div class="orb-particle p2"></div>
                <div class="orb-particle p3"></div>
                <div class="orb-particle p4"></div>
               </div>`
            : `<span class="task-icon">${icon}</span>`;

        // Show cost badge if enabled and completed
        const showCost = window.merlinClient?.showCost || localStorage.getItem('settings_show_cost') === 'true';
        const costBadge = (showCost && task.costInfo && task.status === 'completed')
            ? `<span class="task-cost-badge">$${task.costInfo.totalCostUSD?.toFixed(4) || '0.0000'}</span>`
            : '';

        return `
            <div class="task-item ${statusClass}" data-task-id="${task.id}">
                ${iconHtml}
                <div class="task-content">
                    <span class="task-prompt">${this.escapeHtml(shortPrompt)}</span>
                    ${statusText}
                </div>
                ${costBadge}
                ${task.status === 'pending' || task.status === 'running' ? `
                    <button class="task-cancel-btn" onclick="window.merlinPanelUI.cancelTask('${task.id}')">✕</button>
                ` : ''}
            </div>
        `;
    }

    /**
     * Cancel a task
     */
    cancelTask(taskId) {
        if (this.taskManager) {
            this.taskManager.cancelTask(taskId);
            this.updateTaskList();
        }
    }

    /**
     * Handle task events from TaskManager
     */
    handleTaskEvent(event, data) {
        switch (event) {
            case 'task_created':
            case 'task_started':
            case 'task_completed':
            case 'task_failed':
            case 'task_cancelled':
            case 'task_progress':
            case 'task_followup':
            case 'tasks_cleared':
            case 'task_followups_received':
            case 'task_cost_received':
                this.updateTaskList();
                // Also update detail view if viewing this task
                if (this.isDetailView && this.selectedTaskId) {
                    const taskId = data?.id || data?.task?.id;
                    if (taskId === this.selectedTaskId) {
                        this.updateTaskDetailView();
                    }
                }
                break;
        }
    }

    /**
     * Show task detail view
     */
    showTaskDetail(taskId) {
        if (!this.taskManager) return;

        const task = this.taskManager.tasks.get(taskId);
        if (!task) return;

        this.selectedTaskId = taskId;
        this.isDetailView = true;

        // Hide main sections, show detail view
        document.querySelectorAll('.merlin-section').forEach(el => el.classList.add('hidden'));
        document.getElementById('merlin-task-detail').classList.remove('hidden');

        this.updateTaskDetailView();
        console.log(`[MerlinPanelUI] Showing task detail: ${taskId}`);
    }

    /**
     * Update the task detail view content
     */
    updateTaskDetailView() {
        if (!this.selectedTaskId || !this.taskManager) return;

        const task = this.taskManager.tasks.get(this.selectedTaskId);
        if (!task) return;

        const statusIcons = {
            pending: '⏳ Pending',
            running: '✨ Casting',
            completed: '✅ Completed',
            error: '❌ Error'
        };

        // Update title and status
        document.getElementById('task-detail-title').textContent = task.category ?
            `${this.getCategoryIcon(task.category)} ${task.category.charAt(0).toUpperCase() + task.category.slice(1)} Task` :
            'Task Details';

        // Use magical orb HTML for running status
        const statusEl = document.getElementById('task-detail-status');
        if (task.status === 'running') {
            statusEl.innerHTML = `<div class="merlin-orb merlin-orb-inline">
                <div class="orb-core"></div>
                <div class="orb-ring"></div>
                <div class="orb-particle p1"></div>
                <div class="orb-particle p2"></div>
                <div class="orb-particle p3"></div>
                <div class="orb-particle p4"></div>
            </div> <span>Casting...</span>`;
        } else {
            statusEl.textContent = statusIcons[task.status] || task.status;
        }
        statusEl.className = `task-detail-status status-${task.status}`;

        // Update prompt
        document.getElementById('task-detail-prompt').innerHTML = `
            <strong>Request:</strong> ${this.escapeHtml(task.prompt)}
        `;

        // Update response
        const responseEl = document.getElementById('task-detail-response');
        if (task.response) {
            // Format the response with basic markdown-like formatting
            const formattedResponse = this.formatResponse(task.response);
            responseEl.innerHTML = formattedResponse;
        } else if (task.status === 'pending') {
            responseEl.innerHTML = '<p class="response-placeholder">Waiting to start...</p>';
        } else if (task.status === 'running') {
            responseEl.innerHTML = '<p class="response-placeholder">Working on it...</p>';
        } else if (task.error) {
            responseEl.innerHTML = `<p class="response-error">Error: ${this.escapeHtml(task.error)}</p>`;
        } else {
            responseEl.innerHTML = '<p class="response-placeholder">No response yet...</p>';
        }

        // Auto-scroll response to bottom
        responseEl.scrollTop = responseEl.scrollHeight;

        // Render cost info if available and setting is enabled
        this.renderCostInfo(task);

        // Render follow-up suggestions if available
        this.renderFollowUpSuggestions(task);
    }

    /**
     * Render cost information for a task
     */
    renderCostInfo(task) {
        // Get or create cost info container
        let costContainer = document.getElementById('task-cost-info');
        if (!costContainer) {
            // Create it after the response element
            const responseEl = document.getElementById('task-detail-response');
            costContainer = document.createElement('div');
            costContainer.id = 'task-cost-info';
            costContainer.className = 'task-cost-info hidden';
            responseEl.parentNode.insertBefore(costContainer, responseEl.nextSibling);
        }

        // Check if show cost setting is enabled
        const showCost = window.merlinClient?.showCost || localStorage.getItem('settings_show_cost') === 'true';

        if (!showCost || !task.costInfo) {
            costContainer.classList.add('hidden');
            return;
        }

        const cost = task.costInfo;
        costContainer.classList.remove('hidden');
        costContainer.innerHTML = `
            <div class="cost-header">💰 Task Cost</div>
            <div class="cost-details">
                <div class="cost-row">
                    <span class="cost-label">Model:</span>
                    <span class="cost-value">${this.escapeHtml(cost.model || 'Unknown')}</span>
                </div>
                <div class="cost-row">
                    <span class="cost-label">Input:</span>
                    <span class="cost-value">${cost.inputTokens?.toLocaleString() || 0} tokens ($${cost.inputCostUSD?.toFixed(6) || '0.000000'})</span>
                </div>
                <div class="cost-row">
                    <span class="cost-label">Output:</span>
                    <span class="cost-value">${cost.outputTokens?.toLocaleString() || 0} tokens ($${cost.outputCostUSD?.toFixed(6) || '0.000000'})</span>
                </div>
                <div class="cost-row cost-total">
                    <span class="cost-label">Total:</span>
                    <span class="cost-value">$${cost.totalCostUSD?.toFixed(6) || '0.000000'}</span>
                </div>
            </div>
        `;
    }

    /**
     * Render follow-up suggestion chips
     */
    renderFollowUpSuggestions(task) {
        const container = document.getElementById('task-followup-suggestions');
        const chipsContainer = document.getElementById('followup-chips');

        if (!task.followUpSuggestions || task.followUpSuggestions.length === 0) {
            container.classList.add('hidden');
            return;
        }

        // Only show for completed tasks
        if (task.status !== 'completed') {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');

        // Render chips
        chipsContainer.innerHTML = task.followUpSuggestions.map((suggestion, idx) => {
            const typeClass = `followup-chip-${suggestion.type || 'default'}`;
            return `
                <button class="followup-chip ${typeClass}" data-followup-idx="${idx}" data-followup-text="${this.escapeHtml(suggestion.text)}">
                    ${this.escapeHtml(suggestion.text)}
                </button>
            `;
        }).join('');

        // Add click handlers
        chipsContainer.querySelectorAll('.followup-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const text = e.target.dataset.followupText;
                this.sendFollowUpFromChip(text);
            });
        });
    }

    /**
     * Send a follow-up from clicking a suggestion chip
     */
    sendFollowUpFromChip(text) {
        if (!this.selectedTaskId || !this.taskManager) return;

        const task = this.taskManager.tasks.get(this.selectedTaskId);
        if (!task) return;

        console.log(`[MerlinPanelUI] Sending follow-up from chip: ${text}`);

        // Append the follow-up to the task's response as a marker
        task.response += `\n\n---\n**You:** ${text}\n\n`;

        // Clear follow-up suggestions after clicking one
        task.followUpSuggestions = [];

        this.updateTaskDetailView();

        // Send follow-up through TaskManager
        this.taskManager.sendFollowUp(this.selectedTaskId, text);
    }

    /**
     * Format response text with basic styling
     */
    formatResponse(text) {
        let html = this.escapeHtml(text);

        // Convert code blocks
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>');

        // Convert inline code
        html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // Convert bold
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Convert newlines to breaks
        html = html.replace(/\n/g, '<br>');

        return `<div class="response-content">${html}</div>`;
    }

    /**
     * Get category icon
     */
    getCategoryIcon(category) {
        const icons = { item: '⚔️', creature: '🦁', fix: '🔧', build: '🏗️', custom: '✨' };
        return icons[category] || '✨';
    }

    /**
     * Hide task detail view
     */
    hideTaskDetail() {
        this.selectedTaskId = null;
        this.isDetailView = false;

        // Show main sections, hide detail view
        document.querySelectorAll('.merlin-section').forEach(el => el.classList.remove('hidden'));
        document.getElementById('merlin-task-detail').classList.add('hidden');

        // Clear follow-up input
        document.getElementById('task-followup-input').value = '';

        console.log('[MerlinPanelUI] Hiding task detail');
    }

    /**
     * Send a follow-up message for the current task
     */
    sendFollowUp() {
        if (!this.selectedTaskId || !this.taskManager) return;

        const input = document.getElementById('task-followup-input');
        const text = input.value.trim();
        if (!text) return;

        const task = this.taskManager.tasks.get(this.selectedTaskId);
        if (!task) return;

        console.log(`[MerlinPanelUI] Sending follow-up for task ${this.selectedTaskId}: ${text}`);

        // Append the follow-up to the task's response as a marker
        task.response += `\n\n---\n**You:** ${text}\n\n`;
        this.updateTaskDetailView();

        // Send follow-up through TaskManager
        this.taskManager.sendFollowUp(this.selectedTaskId, text);

        // Clear input
        input.value = '';
    }

    /**
     * Get default suggestions for a category
     */
    getDefaultSuggestions(category) {
        const defaults = {
            item: [
                'Create a fire sword that ignites enemies on hit',
                'Make a magic wand that shoots lightning',
                'Craft a shield that reflects projectiles'
            ],
            creature: [
                'Create a friendly dragon that follows me',
                'Spawn a bouncing slime creature',
                'Make a glowing fairy companion'
            ],
            fix: [
                'Fix any errors in the console',
                'Optimize creature movement performance',
                'Debug the latest creation'
            ],
            build: [
                'Build a medieval castle',
                'Create a modern house with a pool',
                'Construct a pyramid'
            ],
            custom: [
                'Surprise me with something cool!',
                'What can you create?',
                'Show me something magical'
            ]
        };
        return defaults[category] || defaults.custom;
    }

    /**
     * Toggle panel visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Show the panel
     */
    show() {
        const panel = document.getElementById('merlin-panel');
        panel.classList.remove('hidden');
        this.isVisible = true;

        // Don't release pointer lock - player can keep playing with side panel open

        // Update task list
        this.updateTaskList();

        // Don't auto-focus input - let player keep playing
        // They can click into the input when ready

        console.log('[MerlinPanelUI] Panel shown');
    }

    /**
     * Hide the panel
     */
    hide() {
        const panel = document.getElementById('merlin-panel');
        panel.classList.add('hidden');
        this.isVisible = false;

        console.log('[MerlinPanelUI] Panel hidden');
    }

    /**
     * Escape HTML characters
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Inject CSS styles
     */
    injectStyles() {
        if (document.getElementById('merlin-panel-styles')) return;

        const style = document.createElement('style');
        style.id = 'merlin-panel-styles';
        style.textContent = `
            /* Side panel on the right - allows playing while open */
            #merlin-panel {
                position: fixed;
                top: 0;
                right: 0;
                width: 380px;
                height: 100%;
                background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
                border-left: 3px solid #4a4a8a;
                z-index: 1000;
                display: flex;
                flex-direction: column;
                font-family: 'VT323', monospace;
                box-shadow: -5px 0 30px rgba(0, 0, 0, 0.5);
                transform: translateX(0);
                transition: transform 0.3s ease;
            }

            #merlin-panel.hidden {
                transform: translateX(100%);
                pointer-events: none;
            }

            .merlin-panel-content {
                display: flex;
                flex-direction: column;
                height: 100%;
                overflow: hidden;
            }

            .merlin-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                padding-top: 50px; /* Extra padding to avoid top-right-controls overlay */
                background: linear-gradient(90deg, #2d2d5a, #1a1a3a);
                border-bottom: 2px solid #4a4a8a;
                flex-shrink: 0;
            }

            .merlin-panel-header h2 {
                margin: 0;
                font-size: 22px;
                color: #fff;
                text-shadow: 0 0 10px rgba(200, 180, 255, 0.5);
            }

            .merlin-close-btn {
                position: absolute;
                bottom: 15px;
                right: 15px;
                background: rgba(60, 60, 100, 0.8);
                border: 2px solid #5a5a9a;
                border-radius: 8px;
                color: #fff;
                font-size: 24px;
                width: 40px;
                height: 40px;
                cursor: pointer;
                opacity: 0.8;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10;
            }

            .merlin-close-btn:hover {
                opacity: 1;
                background: rgba(80, 80, 120, 0.9);
                transform: scale(1.05);
            }

            .merlin-panel-body {
                flex: 1;
                overflow-y: auto;
                padding: 15px;
            }

            .merlin-section {
                margin-bottom: 15px;
            }

            .merlin-section-title {
                font-size: 16px;
                color: #a0a0d0;
                margin: 0 0 10px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            /* Category Grid - 3 columns for side panel */
            .merlin-category-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
            }

            .merlin-category-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 10px 8px;
                background: rgba(40, 40, 80, 0.8);
                border: 2px solid #3a3a6a;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                color: #fff;
            }

            .merlin-category-btn:hover {
                background: rgba(60, 60, 100, 0.9);
                border-color: #5a5a9a;
                transform: translateY(-2px);
            }

            .merlin-category-btn.selected {
                background: rgba(80, 80, 140, 0.9);
                border-color: #7a7aca;
                box-shadow: 0 0 15px rgba(130, 130, 200, 0.4);
            }

            .category-icon {
                font-size: 28px;
                margin-bottom: 5px;
            }

            .category-label {
                font-size: 14px;
            }

            /* Suggestions */
            .merlin-suggestions {
                background: rgba(30, 30, 60, 0.6);
                border: 1px solid #3a3a6a;
                border-radius: 8px;
                padding: 10px;
                min-height: 80px;
            }

            .suggestions-placeholder,
            .suggestions-loading {
                color: #666;
                font-style: italic;
                text-align: center;
                padding: 15px;
            }

            .suggestion-item {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                padding: 10px 15px;
                cursor: pointer;
                border-radius: 6px;
                transition: background 0.2s;
            }

            .suggestion-item:hover {
                background: rgba(80, 80, 140, 0.3);
            }

            .suggestion-bullet {
                color: #7a7aca;
                font-size: 18px;
            }

            .suggestion-text {
                color: #ccc;
                font-size: 22px;
            }

            .loading-spinner {
                display: inline-block;
                width: 16px;
                height: 16px;
                border: 2px solid #4a4a8a;
                border-top-color: #a0a0d0;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            .loading-spinner.hidden {
                display: none;
            }

            /* Refresh button */
            .refresh-btn {
                background: rgba(60, 60, 100, 0.8);
                border: 1px solid #5a5a9a;
                border-radius: 4px;
                color: #a0a0d0;
                cursor: pointer;
                font-size: 16px;
                padding: 4px 8px;
                margin-left: auto;
                transition: all 0.2s;
            }

            .refresh-btn:hover {
                background: rgba(80, 80, 120, 0.9);
                color: #fff;
            }

            .refresh-btn.hidden {
                display: none;
            }

            .refresh-btn.spinning {
                animation: spin 0.3s linear;
            }

            /* Suggestions stats */
            .suggestions-stats {
                font-size: 12px;
                color: #666;
                font-weight: normal;
                margin-left: 10px;
            }

            /* Task Detail View */
            .merlin-task-detail {
                display: flex;
                flex-direction: column;
                height: 100%;
                gap: 15px;
            }

            .merlin-task-detail.hidden {
                display: none;
            }

            .task-detail-header {
                display: flex;
                align-items: center;
                gap: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid #3a3a6a;
            }

            .task-detail-back {
                background: rgba(60, 60, 100, 0.8);
                border: 1px solid #5a5a9a;
                border-radius: 6px;
                color: #a0a0d0;
                cursor: pointer;
                padding: 8px 12px;
                font-family: inherit;
                font-size: 14px;
                transition: all 0.2s;
            }

            .task-detail-back:hover {
                background: rgba(80, 80, 120, 0.9);
                color: #fff;
            }

            .task-detail-title {
                flex: 1;
                font-size: 18px;
                color: #fff;
            }

            .task-detail-status {
                font-size: 14px;
                padding: 4px 10px;
                border-radius: 12px;
                background: rgba(60, 60, 100, 0.6);
            }

            .task-detail-status.status-running {
                background: rgba(76, 175, 80, 0.3);
                color: #4CAF50;
            }

            .task-detail-status.status-completed {
                background: rgba(76, 175, 80, 0.2);
                color: #81c784;
            }

            .task-detail-status.status-error {
                background: rgba(244, 67, 54, 0.2);
                color: #ef5350;
            }

            .task-detail-status.status-pending {
                background: rgba(255, 152, 0, 0.2);
                color: #ffb74d;
            }

            .task-detail-prompt {
                background: rgba(40, 40, 80, 0.6);
                border-radius: 8px;
                padding: 12px 15px;
                font-size: 16px;
                color: #ccc;
            }

            .task-detail-response {
                flex: 1;
                background: rgba(30, 30, 60, 0.6);
                border: 1px solid #3a3a6a;
                border-radius: 8px;
                padding: 15px;
                overflow-y: auto;
                min-height: 150px;
                max-height: 300px;
            }

            .response-placeholder {
                color: #666;
                font-style: italic;
                text-align: center;
                padding: 20px;
            }

            .response-error {
                color: #ef5350;
                padding: 10px;
            }

            .response-content {
                color: #ddd;
                font-size: 16px;
                line-height: 1.5;
            }

            .response-content .code-block {
                background: rgba(0, 0, 0, 0.4);
                border-radius: 6px;
                padding: 12px;
                margin: 10px 0;
                overflow-x: auto;
                font-family: 'Courier New', monospace;
                font-size: 13px;
            }

            .response-content .inline-code {
                background: rgba(0, 0, 0, 0.3);
                padding: 2px 6px;
                border-radius: 4px;
                font-family: 'Courier New', monospace;
                font-size: 14px;
            }

            .task-detail-input {
                display: flex;
                gap: 10px;
                padding-top: 10px;
                border-top: 1px solid #3a3a6a;
            }

            #task-followup-input {
                flex: 1;
                padding: 12px 15px;
                background: rgba(30, 30, 60, 0.8);
                border: 2px solid #3a3a6a;
                border-radius: 8px;
                color: #fff;
                font-family: inherit;
                font-size: 16px;
                resize: none;
                min-height: 50px;
                max-height: 80px;
            }

            #task-followup-input:focus {
                outline: none;
                border-color: #5a5a9a;
            }

            #task-followup-input::placeholder {
                color: #666;
            }

            /* Cost Info */
            .task-cost-info {
                margin: 10px 0;
                padding: 12px;
                background: rgba(60, 50, 30, 0.4);
                border: 1px solid rgba(200, 170, 100, 0.3);
                border-radius: 8px;
            }

            .task-cost-info.hidden {
                display: none;
            }

            .cost-header {
                font-size: 14px;
                color: #e0c080;
                margin-bottom: 8px;
                font-weight: bold;
            }

            .cost-details {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .cost-row {
                display: flex;
                justify-content: space-between;
                font-size: 13px;
            }

            .cost-label {
                color: #a0a0a0;
            }

            .cost-value {
                color: #ddd;
                font-family: 'Courier New', monospace;
            }

            .cost-row.cost-total {
                margin-top: 6px;
                padding-top: 6px;
                border-top: 1px solid rgba(200, 170, 100, 0.2);
            }

            .cost-row.cost-total .cost-label,
            .cost-row.cost-total .cost-value {
                font-weight: bold;
                color: #e0c080;
            }

            /* Follow-up Suggestions */
            .task-followup-suggestions {
                margin-bottom: 10px;
                padding: 12px;
                background: rgba(40, 60, 80, 0.4);
                border: 1px solid rgba(100, 150, 200, 0.3);
                border-radius: 8px;
            }

            .task-followup-suggestions.hidden {
                display: none;
            }

            .followup-suggestions-header {
                font-size: 14px;
                color: #a0c0e0;
                margin-bottom: 10px;
                font-weight: bold;
            }

            .followup-suggestions-chips {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            .followup-chip {
                background: rgba(60, 80, 120, 0.6);
                border: 1px solid rgba(100, 140, 200, 0.4);
                border-radius: 16px;
                padding: 8px 14px;
                font-family: inherit;
                font-size: 14px;
                color: #ddd;
                cursor: pointer;
                transition: all 0.2s;
                max-width: 100%;
                text-align: left;
                white-space: normal;
                word-break: break-word;
            }

            .followup-chip:hover {
                background: rgba(80, 100, 150, 0.8);
                border-color: rgba(120, 160, 220, 0.6);
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(100, 150, 200, 0.3);
            }

            .followup-chip:active {
                transform: translateY(0);
            }

            /* Chip type colors - issues are warm colors, confirmation is green */
            .followup-chip-visibility_issue {
                border-left: 3px solid #f44336;
            }

            .followup-chip-visual_issue {
                border-left: 3px solid #FF9800;
            }

            .followup-chip-functionality_issue {
                border-left: 3px solid #9C27B0;
            }

            .followup-chip-confirmed_working {
                border-left: 3px solid #4CAF50;
                background: rgba(76, 175, 80, 0.2);
            }

            .followup-chip-confirmed_working:hover {
                background: rgba(76, 175, 80, 0.4);
            }

            /* Task List */
            .merlin-task-list {
                background: rgba(30, 30, 60, 0.6);
                border: 1px solid #3a3a6a;
                border-radius: 8px;
                padding: 10px;
                max-height: 200px;
                overflow-y: auto;
            }

            .task-placeholder {
                color: #666;
                font-style: italic;
                text-align: center;
                padding: 15px;
            }

            .task-counts {
                font-size: 14px;
                color: #888;
                font-weight: normal;
            }

            .task-item {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                padding: 10px;
                border-radius: 6px;
                margin-bottom: 8px;
                background: rgba(40, 40, 70, 0.5);
                cursor: pointer;
                transition: all 0.2s;
            }

            .task-item:hover {
                background: rgba(60, 60, 90, 0.6);
                transform: translateX(3px);
            }

            .task-item:last-child {
                margin-bottom: 0;
            }

            .task-pending {
                opacity: 0.7;
            }

            .task-completed {
                background: rgba(40, 70, 40, 0.4);
            }

            .task-error {
                background: rgba(70, 40, 40, 0.4);
            }

            .task-cost-badge {
                font-size: 12px;
                color: #e0c080;
                background: rgba(80, 60, 20, 0.6);
                border: 1px solid rgba(200, 170, 100, 0.3);
                border-radius: 10px;
                padding: 2px 8px;
                white-space: nowrap;
                flex-shrink: 0;
            }

            .task-icon {
                font-size: 18px;
                background: transparent;
                border: none;
                line-height: 1;
                display: inline-block;
                font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
            }

            .task-icon.spinning {
                animation: spin 1s linear infinite;
                display: inline-block;
            }

            .task-content {
                flex: 1;
                overflow: hidden;
            }

            .task-prompt {
                color: #ccc;
                font-size: 18px;
                display: block;
            }

            .task-response {
                color: #888;
                font-size: 16px;
                display: block;
                margin-top: 4px;
            }

            .task-error-msg {
                color: #f44336;
                font-size: 16px;
                display: block;
                margin-top: 4px;
            }

            .task-cancel-btn {
                background: none;
                border: none;
                color: #888;
                cursor: pointer;
                font-size: 16px;
                padding: 0 5px;
            }

            .task-cancel-btn:hover {
                color: #f44336;
            }

            /* Custom Input */
            .merlin-input-section {
                margin-top: auto;
                padding-top: 15px;
                border-top: 1px solid #3a3a6a;
            }

            .merlin-input-wrapper {
                display: flex;
                gap: 10px;
            }

            #merlin-custom-input {
                flex: 1;
                padding: 12px 15px;
                background: rgba(30, 30, 60, 0.8);
                border: 2px solid #3a3a6a;
                border-radius: 8px;
                color: #fff;
                font-family: inherit;
                font-size: 16px;
                resize: none;
                min-height: 50px;
                max-height: 100px;
            }

            #merlin-custom-input:focus {
                outline: none;
                border-color: #5a5a9a;
            }

            #merlin-custom-input::placeholder {
                color: #666;
            }

            .merlin-start-btn {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px 20px;
                background: linear-gradient(180deg, #4a4a8a, #3a3a7a);
                border: 2px solid #5a5a9a;
                border-radius: 8px;
                color: #fff;
                font-family: inherit;
                font-size: 16px;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
            }

            .merlin-start-btn:hover {
                background: linear-gradient(180deg, #5a5a9a, #4a4a8a);
                transform: translateY(-1px);
            }

            .merlin-start-btn:active {
                transform: translateY(0);
            }

            /* ========== Magical Orb Loading Animation ========== */
            .merlin-orb {
                position: relative;
                width: 28px;
                height: 28px;
                flex-shrink: 0;
            }

            .orb-core {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 14px;
                height: 14px;
                transform: translate(-50%, -50%);
                background: radial-gradient(circle at 30% 30%,
                    #fff 0%,
                    #c8a0ff 20%,
                    #9060ff 50%,
                    #6030c0 100%);
                border-radius: 50%;
                box-shadow:
                    0 0 8px 2px rgba(150, 100, 255, 0.8),
                    0 0 16px 4px rgba(120, 80, 220, 0.6),
                    0 0 24px 6px rgba(100, 60, 200, 0.4),
                    inset 0 0 6px rgba(255, 255, 255, 0.5);
                animation: orb-pulse 1.5s ease-in-out infinite;
            }

            .orb-ring {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 22px;
                height: 22px;
                transform: translate(-50%, -50%);
                border: 2px solid transparent;
                border-top-color: rgba(200, 160, 255, 0.9);
                border-right-color: rgba(150, 100, 255, 0.6);
                border-radius: 50%;
                animation: orb-spin 1s linear infinite;
            }

            .orb-particle {
                position: absolute;
                width: 4px;
                height: 4px;
                background: radial-gradient(circle, #fff 0%, #c8a0ff 50%, transparent 100%);
                border-radius: 50%;
                box-shadow: 0 0 4px 1px rgba(200, 160, 255, 0.8);
            }

            .orb-particle.p1 {
                animation: particle-orbit 2s linear infinite;
            }
            .orb-particle.p2 {
                animation: particle-orbit 2s linear infinite 0.5s;
            }
            .orb-particle.p3 {
                animation: particle-orbit 2s linear infinite 1s;
            }
            .orb-particle.p4 {
                animation: particle-orbit 2s linear infinite 1.5s;
            }

            @keyframes orb-pulse {
                0%, 100% {
                    transform: translate(-50%, -50%) scale(1);
                    box-shadow:
                        0 0 8px 2px rgba(150, 100, 255, 0.8),
                        0 0 16px 4px rgba(120, 80, 220, 0.6),
                        0 0 24px 6px rgba(100, 60, 200, 0.4),
                        inset 0 0 6px rgba(255, 255, 255, 0.5);
                }
                50% {
                    transform: translate(-50%, -50%) scale(1.15);
                    box-shadow:
                        0 0 12px 4px rgba(180, 130, 255, 0.9),
                        0 0 24px 8px rgba(150, 100, 255, 0.7),
                        0 0 36px 12px rgba(120, 80, 220, 0.5),
                        inset 0 0 8px rgba(255, 255, 255, 0.7);
                }
            }

            @keyframes orb-spin {
                0% { transform: translate(-50%, -50%) rotate(0deg); }
                100% { transform: translate(-50%, -50%) rotate(360deg); }
            }

            @keyframes particle-orbit {
                0% {
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(0deg) translateX(14px) scale(1);
                    opacity: 1;
                }
                25% {
                    transform: translate(-50%, -50%) rotate(90deg) translateX(14px) scale(0.8);
                    opacity: 0.8;
                }
                50% {
                    transform: translate(-50%, -50%) rotate(180deg) translateX(14px) scale(0.6);
                    opacity: 0.6;
                }
                75% {
                    transform: translate(-50%, -50%) rotate(270deg) translateX(14px) scale(0.4);
                    opacity: 0.4;
                }
                100% {
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(360deg) translateX(14px) scale(1);
                    opacity: 1;
                }
            }

            /* Make running tasks have magical glow border */
            .task-running {
                background: rgba(50, 50, 100, 0.6);
                border-left: 3px solid #9060ff;
                box-shadow: inset 0 0 20px rgba(150, 100, 255, 0.1);
            }

            /* Inline orb for status badge */
            .merlin-orb-inline {
                display: inline-block;
                width: 20px;
                height: 20px;
                vertical-align: middle;
                margin-right: 4px;
            }

            .merlin-orb-inline .orb-core {
                width: 10px;
                height: 10px;
            }

            .merlin-orb-inline .orb-ring {
                width: 16px;
                height: 16px;
            }

            .merlin-orb-inline .orb-particle {
                width: 3px;
                height: 3px;
            }

            /* Update status running styling */
            .task-detail-status.status-running {
                display: flex;
                align-items: center;
                gap: 4px;
                background: rgba(150, 100, 255, 0.3);
                color: #c8a0ff;
            }

            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            /* Responsive - full width on small screens */
            @media (max-width: 600px) {
                #merlin-panel {
                    width: 100%;
                }

                .merlin-category-grid {
                    grid-template-columns: repeat(5, 1fr);
                }

                .merlin-input-wrapper {
                    flex-direction: column;
                }

                .merlin-start-btn {
                    justify-content: center;
                }
            }

            /* Medium screens */
            @media (min-width: 601px) and (max-width: 900px) {
                #merlin-panel {
                    width: 320px;
                }

                .merlin-category-grid {
                    grid-template-columns: repeat(3, 1fr);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Export global reference for onclick handlers
window.merlinPanelUI = null;
