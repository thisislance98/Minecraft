/**
 * TaskManager - Client-side task queue manager for Merlin AI
 *
 * Handles task state machine: pending -> running -> completed/error
 * Manages queue with sequential execution and parallel display
 */

import { getRandomSuggestions, getSuggestionCount } from './MerlinSuggestions.js';

export class TaskManager {
    constructor(merlinClient) {
        this.merlinClient = merlinClient;
        this.tasks = new Map(); // taskId -> task object
        this.taskQueue = []; // Array of taskIds in order
        this.currentTaskId = null;
        this.lastRunningTaskId = null; // Track last running task for late-arriving messages like cost_info
        this.nextTaskId = 1;
        this.listeners = new Set();

        // Suggestion cycling state - tracks shown suggestions per category
        this.shownSuggestions = new Map(); // category -> Set of shown suggestions
        this.currentSuggestions = new Map(); // category -> current suggestions array

        // Task categories
        this.categories = [
            { id: 'item', label: 'Create Item', icon: '⚔️', prompt: 'Create a magical item' },
            { id: 'creature', label: 'Create Creature', icon: '🦁', prompt: 'Create a new creature' },
            { id: 'fix', label: 'Fix Issue', icon: '🔧', prompt: 'Fix a bug or issue' },
            { id: 'build', label: 'Build', icon: '🏗️', prompt: 'Build a structure' },
            { id: 'custom', label: 'Custom', icon: '✨', prompt: 'Custom request' }
        ];

        console.log('[TaskManager] Initialized');
    }

    /**
     * Generate a unique task ID
     */
    generateTaskId() {
        return `task_${this.nextTaskId++}_${Date.now()}`;
    }

    /**
     * Create a new task and add to queue
     * @param {string} prompt - The task description/prompt
     * @param {string} category - Task category (item, creature, fix, build, custom)
     * @returns {object} The created task
     */
    createTask(prompt, category = 'custom') {
        const taskId = this.generateTaskId();
        const task = {
            id: taskId,
            prompt,
            category,
            status: 'pending', // pending, running, completed, error
            createdAt: Date.now(),
            startedAt: null,
            completedAt: null,
            response: '',
            error: null
        };

        this.tasks.set(taskId, task);
        this.taskQueue.push(taskId);

        console.log(`[TaskManager] Created task ${taskId}: ${prompt.substring(0, 50)}...`);
        this.notifyListeners('task_created', task);

        // Try to start next task if none running
        this.processQueue();

        return task;
    }

    /**
     * Process the task queue - start next task if none running
     */
    processQueue() {
        // If already running a task, wait
        if (this.currentTaskId) {
            const currentTask = this.tasks.get(this.currentTaskId);
            if (currentTask && currentTask.status === 'running') {
                console.log('[TaskManager] Task already running, waiting...');
                return;
            }
        }

        // Find next pending task
        for (const taskId of this.taskQueue) {
            const task = this.tasks.get(taskId);
            if (task && task.status === 'pending') {
                this.startTask(taskId);
                return;
            }
        }

        console.log('[TaskManager] No pending tasks in queue');
    }

    /**
     * Start a specific task
     * @param {string} taskId
     */
    startTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            console.error(`[TaskManager] Task ${taskId} not found`);
            return;
        }

        task.status = 'running';
        task.startedAt = Date.now();
        this.currentTaskId = taskId;
        this.lastRunningTaskId = taskId; // Track for late-arriving messages

        console.log(`[TaskManager] Starting task ${taskId}`);
        this.notifyListeners('task_started', task);

        // Send to MerlinClient with taskId included
        if (this.merlinClient && this.merlinClient.ws && this.merlinClient.ws.readyState === WebSocket.OPEN) {
            this.merlinClient.send({
                type: 'input',
                text: task.prompt,
                taskId: taskId,
                context: this.getTaskContext()
            });
        } else if (this.merlinClient && this.merlinClient.aiProvider === 'claude') {
            // Claude Code mode - handle locally
            this.merlinClient.send({
                type: 'input',
                text: task.prompt,
                taskId: taskId,
                context: this.getTaskContext()
            });
        } else {
            console.error('[TaskManager] MerlinClient not connected');
            this.failTask(taskId, 'AI not connected');
        }
    }

    /**
     * Get context for the current task
     */
    getTaskContext() {
        if (!this.merlinClient || !this.merlinClient.game) return {};

        const game = this.merlinClient.game;
        const player = game.player;

        return {
            x: player?.position?.x || 0,
            y: player?.position?.y || 0,
            z: player?.position?.z || 0,
            worldId: game.currentWorldId || 'global'
        };
    }

    /**
     * Handle incoming message from server - route to appropriate task
     * @param {object} msg - Message from MerlinClient
     */
    handleMessage(msg) {
        const taskId = msg.taskId || this.currentTaskId;
        const task = taskId ? this.tasks.get(taskId) : null;

        switch (msg.type) {
            case 'token':
                if (task) {
                    task.response += msg.text || '';
                    this.notifyListeners('task_progress', task);
                }
                break;

            case 'thought':
                if (task) {
                    this.notifyListeners('task_thought', { task, thought: msg.text });
                }
                break;

            case 'complete':
                if (task && task.status === 'running') {
                    this.completeTask(taskId);
                }
                break;

            case 'error':
                if (task && task.status === 'running') {
                    this.failTask(taskId, msg.message || 'Unknown error');
                }
                break;

            case 'tool_start':
                if (task) {
                    // Capture executed code for display in code tab
                    // Support both legacy execute_code and new execute_lua tools
                    if ((msg.name === 'execute_code' || msg.name === 'execute_lua') && msg.args?.code) {
                        if (!task.executedCode) {
                            task.executedCode = [];
                        }
                        task.executedCode.push({
                            code: msg.args.code,
                            language: msg.name === 'execute_lua' ? 'lua' : 'javascript',
                            timestamp: Date.now(),
                            status: 'running'
                        });
                    }
                    this.notifyListeners('task_tool_start', { task, tool: msg.name, args: msg.args });
                }
                break;

            case 'tool_end':
                if (task) {
                    // Update executed code status with result
                    // Support both legacy execute_code and new execute_lua tools
                    if ((msg.name === 'execute_code' || msg.name === 'execute_lua') && task.executedCode?.length > 0) {
                        const lastExec = task.executedCode[task.executedCode.length - 1];
                        if (lastExec.status === 'running') {
                            lastExec.status = msg.result?.error ? 'error' : 'success';
                            lastExec.result = msg.result;
                            // Store undo record if available
                            if (msg.result?.undoRecord) {
                                lastExec.undoRecord = msg.result.undoRecord;
                                task.canUndo = true;
                            }
                        }
                    }
                    this.notifyListeners('task_tool_end', { task, tool: msg.name, result: msg.result });
                }
                break;

            case 'suggestions':
                // Handle suggestions response
                if (msg.category && msg.suggestions) {
                    this.cacheSuggestions(msg.category, msg.suggestions);
                }
                break;

            case 'follow_up_suggestions':
                // Handle follow-up suggestions for completed tasks
                if (task) {
                    task.followUpSuggestions = msg.suggestions || [];
                    task.creationType = msg.creationType;
                    task.creationName = msg.creationName;
                    console.log(`[TaskManager] Received ${task.followUpSuggestions.length} follow-up suggestions for ${msg.creationName}`);
                    this.notifyListeners('task_followups_received', task);
                }
                break;

            case 'cost_info':
                // Handle cost/token information for task
                // Use lastRunningTaskId as fallback since cost_info may arrive after task completes
                let costTask = task;
                let costTaskId = taskId;
                if (!costTask && this.lastRunningTaskId) {
                    costTask = this.tasks.get(this.lastRunningTaskId);
                    costTaskId = this.lastRunningTaskId;
                    console.log(`[TaskManager] cost_info: using lastRunningTaskId ${costTaskId} as fallback`);
                }

                if (costTask) {
                    costTask.costInfo = {
                        inputTokens: msg.inputTokens,
                        outputTokens: msg.outputTokens,
                        cachedTokens: msg.cachedTokens || 0,
                        cacheWriteTokens: msg.cacheWriteTokens || 0,
                        inputCostUSD: msg.inputCostUSD,
                        outputCostUSD: msg.outputCostUSD,
                        totalCostUSD: msg.totalCostUSD,
                        gameTokens: msg.gameTokens,
                        model: msg.model
                    };
                    console.log(`[TaskManager] Task ${costTaskId} tokens: ${msg.inputTokens} in / ${msg.outputTokens} out${msg.cachedTokens > 0 ? ` (${msg.cachedTokens} cached)` : ''}`);
                    this.notifyListeners('task_cost_received', costTask);
                } else {
                    console.warn(`[TaskManager] cost_info received but no task found! taskId=${taskId}, lastRunningTaskId=${this.lastRunningTaskId}`);
                }
                break;
        }
    }

    /**
     * Mark a task as completed
     * @param {string} taskId
     */
    completeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return;

        task.status = 'completed';
        task.completedAt = Date.now();

        if (this.currentTaskId === taskId) {
            this.currentTaskId = null;
        }

        console.log(`[TaskManager] Task ${taskId} completed`);
        this.notifyListeners('task_completed', task);

        // Show notification toast
        this.showNotification(`Task completed: ${task.prompt.substring(0, 30)}...`, 'success');

        // Process next task in queue
        setTimeout(() => this.processQueue(), 500);
    }

    /**
     * Mark a task as failed
     * @param {string} taskId
     * @param {string} error
     */
    failTask(taskId, error) {
        const task = this.tasks.get(taskId);
        if (!task) return;

        task.status = 'error';
        task.error = error;
        task.completedAt = Date.now();

        if (this.currentTaskId === taskId) {
            this.currentTaskId = null;
        }

        console.log(`[TaskManager] Task ${taskId} failed: ${error}`);
        this.notifyListeners('task_failed', task);

        // Show error notification
        this.showNotification(`Task failed: ${error}`, 'error');

        // Process next task in queue
        setTimeout(() => this.processQueue(), 500);
    }

    /**
     * Undo a task's changes
     * @param {string} taskId
     * @returns {Object} Result of the undo operation
     */
    undoTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            return { success: false, error: 'Task not found' };
        }

        if (!task.canUndo) {
            return { success: false, error: 'Task cannot be undone' };
        }

        // Use VoxelWorld's undo system
        const VoxelWorld = window.VoxelWorld;
        if (!VoxelWorld) {
            return { success: false, error: 'VoxelWorld not available' };
        }

        const result = VoxelWorld.undoTask(taskId);

        if (result.success) {
            task.canUndo = false;
            task.undone = true;
            this.notifyListeners('task_undone', task);
            this.showNotification('Changes reverted', 'success');
        }

        return result;
    }

    /**
     * Undo the most recent task
     * @returns {Object} Result of the undo operation
     */
    undoLastTask() {
        const VoxelWorld = window.VoxelWorld;
        if (!VoxelWorld) {
            return { success: false, error: 'VoxelWorld not available' };
        }

        const undoableIds = VoxelWorld.getUndoableTaskIds();
        if (undoableIds.length === 0) {
            return { success: false, error: 'Nothing to undo' };
        }

        const lastTaskId = undoableIds[undoableIds.length - 1];
        return this.undoTask(lastTaskId);
    }

    /**
     * Remove a task from the list (close without undo)
     * @param {string} taskId
     */
    closeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return;

        this.tasks.delete(taskId);
        this.notifyListeners('task_closed', task);
        console.log(`[TaskManager] Task ${taskId} closed`);
    }

    /**
     * Cancel a task
     * @param {string} taskId
     */
    cancelTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return;

        if (task.status === 'running') {
            // Send interrupt signal
            if (this.merlinClient && this.merlinClient.ws) {
                this.merlinClient.ws.send(JSON.stringify({ type: 'interrupt' }));
            }
        }

        task.status = 'error';
        task.error = 'Cancelled';
        task.completedAt = Date.now();

        if (this.currentTaskId === taskId) {
            this.currentTaskId = null;
        }

        console.log(`[TaskManager] Task ${taskId} cancelled`);
        this.notifyListeners('task_cancelled', task);

        // Process next task
        this.processQueue();
    }

    /**
     * Get all tasks
     * @returns {Array} Array of tasks
     */
    getAllTasks() {
        return this.taskQueue.map(id => this.tasks.get(id)).filter(Boolean);
    }

    /**
     * Get tasks by status
     * @param {string} status
     * @returns {Array}
     */
    getTasksByStatus(status) {
        return this.getAllTasks().filter(t => t.status === status);
    }

    /**
     * Get task counts
     * @returns {object}
     */
    getTaskCounts() {
        const tasks = this.getAllTasks();
        return {
            pending: tasks.filter(t => t.status === 'pending').length,
            running: tasks.filter(t => t.status === 'running').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            error: tasks.filter(t => t.status === 'error').length,
            total: tasks.length
        };
    }

    /**
     * Clear completed tasks from history
     */
    clearCompletedTasks() {
        const toRemove = [];
        for (const [id, task] of this.tasks) {
            if (task.status === 'completed' || task.status === 'error') {
                toRemove.push(id);
            }
        }

        toRemove.forEach(id => {
            this.tasks.delete(id);
            const idx = this.taskQueue.indexOf(id);
            if (idx !== -1) this.taskQueue.splice(idx, 1);
        });

        console.log(`[TaskManager] Cleared ${toRemove.length} tasks`);
        this.notifyListeners('tasks_cleared', { count: toRemove.length });
    }

    /**
     * Request suggestions for a category (uses predefined pool with cycling)
     * @param {string} category
     * @returns {Array} Array of suggestions
     */
    requestSuggestions(category) {
        console.log(`[TaskManager] Getting suggestions for ${category}`);

        // Initialize shown set for this category if needed
        if (!this.shownSuggestions.has(category)) {
            this.shownSuggestions.set(category, new Set());
        }

        const shown = this.shownSuggestions.get(category);

        // Get random suggestions excluding already shown ones
        const suggestions = getRandomSuggestions(category, 3, shown);

        // Track these as shown
        suggestions.forEach(s => shown.add(s));

        // Store current suggestions for this category
        this.currentSuggestions.set(category, suggestions);

        const totalCount = getSuggestionCount(category);
        console.log(`[TaskManager] Showing ${suggestions.length} suggestions (${shown.size}/${totalCount} seen)`);

        return suggestions;
    }

    /**
     * Cycle to new suggestions for a category (refresh button)
     * @param {string} category
     * @returns {Array} New suggestions
     */
    cycleSuggestions(category) {
        console.log(`[TaskManager] Cycling suggestions for ${category}`);

        // Get shown set
        const shown = this.shownSuggestions.get(category) || new Set();
        const totalCount = getSuggestionCount(category);

        // If we've shown most suggestions, reset the tracking
        if (shown.size >= totalCount - 3) {
            console.log(`[TaskManager] Resetting suggestion pool for ${category}`);
            this.shownSuggestions.set(category, new Set());
        }

        // Get new suggestions
        return this.requestSuggestions(category);
    }

    /**
     * Reset all shown suggestions (full refresh)
     */
    resetAllSuggestions() {
        this.shownSuggestions.clear();
        this.currentSuggestions.clear();
        console.log('[TaskManager] Reset all suggestion tracking');
    }

    /**
     * Get the count of remaining unseen suggestions for a category
     * @param {string} category
     * @returns {Object} { seen, total, remaining }
     */
    getSuggestionStats(category) {
        const shown = this.shownSuggestions.get(category) || new Set();
        const total = getSuggestionCount(category);
        return {
            seen: shown.size,
            total: total,
            remaining: total - shown.size
        };
    }

    /**
     * Send a follow-up message for an existing task
     * @param {string} taskId - The task to continue
     * @param {string} message - The follow-up message
     */
    sendFollowUp(taskId, message) {
        const task = this.tasks.get(taskId);
        if (!task) {
            console.error(`[TaskManager] Task ${taskId} not found for follow-up`);
            return;
        }

        console.log(`[TaskManager] Sending follow-up for task ${taskId}: ${message}`);

        // If task is completed or errored, we can restart it with the follow-up
        if (task.status === 'completed' || task.status === 'error') {
            task.status = 'running';
            task.startedAt = Date.now();
            this.currentTaskId = taskId;
        }

        // Send the follow-up through MerlinClient
        if (this.merlinClient && this.merlinClient.ws && this.merlinClient.ws.readyState === WebSocket.OPEN) {
            this.merlinClient.send({
                type: 'input',
                text: message,
                taskId: taskId,
                context: this.getTaskContext(),
                isFollowUp: true
            });
        } else if (this.merlinClient) {
            // Fallback - just send through MerlinClient
            this.merlinClient.send({
                type: 'input',
                text: message,
                taskId: taskId,
                context: this.getTaskContext(),
                isFollowUp: true
            });
        }

        this.notifyListeners('task_followup', task);
    }

    /**
     * Show a notification toast
     */
    showNotification(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `merlin-toast merlin-toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <span class="toast-message">${message}</span>
        `;

        // Add styles if not present
        if (!document.getElementById('merlin-toast-styles')) {
            const style = document.createElement('style');
            style.id = 'merlin-toast-styles';
            style.textContent = `
                .merlin-toast {
                    position: fixed;
                    bottom: 80px;
                    right: 20px;
                    background: rgba(30, 30, 30, 0.95);
                    border: 2px solid #444;
                    border-radius: 8px;
                    padding: 12px 20px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-family: 'VT323', monospace;
                    font-size: 16px;
                    color: #fff;
                    z-index: 10001;
                    animation: slideIn 0.3s ease-out, fadeOut 0.3s ease-out 3s forwards;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
                }
                .merlin-toast-success { border-color: #4CAF50; }
                .merlin-toast-error { border-color: #f44336; }
                .merlin-toast-info { border-color: #2196F3; }
                .toast-icon { font-size: 20px; }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);

        this.notifyListeners('notification', { message, type });
    }

    /**
     * Add listener for task events
     */
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Notify all listeners of an event
     */
    notifyListeners(event, data) {
        for (const listener of this.listeners) {
            try {
                listener(event, data);
            } catch (e) {
                console.error('[TaskManager] Listener error:', e);
            }
        }
    }
}
