/**
 * FewShotClient - WebSocket client for the Few-Shot AI system
 *
 * This client connects to the /api/fewshot endpoint and handles
 * AI-generated creatures, items, structures, etc.
 */

import { auth } from '../../config/firebase-client.js';

export class FewShotClient {
    constructor() {
        this.ws = null;
        this.game = null;
        this.listeners = new Set();
        this.isConnected = false;

        // Connection state
        this.reconnectTimer = null;
        this.baseReconnectDelay = 1000;
        this.maxReconnectDelay = 30000;
        this.currentReconnectDelay = this.baseReconnectDelay;
        this.isExplicitlyDisconnected = false;
        this.isReconnecting = false;

        // Model selection
        this.availableModels = [];
        this.currentModel = localStorage.getItem('fewshot_model') || 'anthropic/claude-haiku-4.5';

        // Settings
        this.bypassTokens = localStorage.getItem('settings_bypass_tokens') !== 'false';

        // Pending tool responses
        this.pendingToolCalls = new Map();

        // Listen for auth changes
        auth.onAuthStateChanged(async (user) => {
            console.log('[FewShotClient] Auth state changed. Reconnecting...');
            this.connect();
        });

        // Connect immediately
        setTimeout(() => {
            if (!this.ws && !this.isConnected) {
                console.log('[FewShotClient] Connecting immediately (fallback)...');
                this.connect();
            }
        }, 500);
    }

    setGame(game) {
        this.game = game;
        console.log('[FewShotClient] Game instance attached.');
        if (this.game.uiManager) {
            this.game.uiManager.updateAIStatus(this.isConnected ? 'Connected (FewShot)' : 'Disconnected');
        }
    }

    cleanup() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.onmessage = null;
            this.ws.onopen = null;
            this.ws.close();
            this.ws = null;
        }
    }

    async connect() {
        this.cleanup();
        this.isExplicitlyDisconnected = false;

        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const baseUrl = import.meta.env.VITE_SERVER_URL || (isDev ? 'http://localhost:2567' : window.location.origin);

        let wsUrl = baseUrl.replace(/^http/, 'ws');
        let url = `${wsUrl}/api/fewshot`;

        // Add model parameter
        url += `?model=${encodeURIComponent(this.currentModel)}`;

        // Add token if authenticated
        if (auth.currentUser) {
            try {
                const token = await auth.currentUser.getIdToken();
                url += `&token=${token}`;
                console.log('[FewShotClient] Connecting with Auth Token');
            } catch (e) {
                console.warn('[FewShotClient] Failed to get token:', e);
            }
        }

        // CLI mode
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('cli') === 'true') {
            url += '&cli=true&secret=asdf123';
            console.log('[FewShotClient] CLI mode detected');
        }

        if (!this.isReconnecting) {
            console.log('[FewShotClient] Connecting to:', url);
        }
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('[FewShotClient] Connected.');
            this.isConnected = true;
            this.isReconnecting = false;
            this.currentReconnectDelay = this.baseReconnectDelay;
            this.notifyListeners({ type: 'status', status: 'connected' });
            if (this.game && this.game.uiManager) {
                this.game.uiManager.updateAIStatus('Connected (FewShot)');
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.handleMessage(msg);
            } catch (e) {
                console.error('[FewShotClient] Error parsing message:', e);
            }
        };

        this.ws.onclose = (event) => {
            if (!this.isReconnecting) {
                console.log(`[FewShotClient] Disconnected. Code: ${event.code}`);
            }
            this.isConnected = false;
            this.notifyListeners({ type: 'status', status: 'disconnected' });

            if (this.game && this.game.uiManager) {
                this.game.uiManager.updateAIStatus('Disconnected');
            }

            if (event.code === 1011) {
                console.error('[FewShotClient] Critical Server Error:', event.reason);
                return;
            }

            if (this.isExplicitlyDisconnected) return;

            this.isReconnecting = true;
            this.reconnectTimer = setTimeout(() => {
                this.connect();
                this.currentReconnectDelay = Math.min(this.currentReconnectDelay * 1.5, this.maxReconnectDelay);
            }, this.currentReconnectDelay);
        };

        this.ws.onerror = (err) => {
            if (!this.isReconnecting) {
                console.warn('[FewShotClient] WebSocket error:', err);
            }
        };
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            if (data.type === 'input') {
                data.settings = {
                    bypassTokens: this.bypassTokens,
                    model: this.currentModel
                };
            }
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('[FewShotClient] Cannot send, socket not open.');
            this.notifyListeners({ type: 'error', message: 'Cannot reach AI server. Reconnecting...' });
        }
    }

    handleMessage(msg) {
        console.log('[FewShotClient] Message:', msg.type, msg);

        // Handle models list
        if (msg.type === 'models_list') {
            this.availableModels = msg.models || [];
            if (msg.current) {
                this.currentModel = msg.current;
            }
            console.log('[FewShotClient] Available models:', this.availableModels.length);
            this.notifyListeners({ type: 'models_list', models: this.availableModels, current: this.currentModel });
        }

        // Handle model change confirmation
        if (msg.type === 'model_changed') {
            this.currentModel = msg.model;
            localStorage.setItem('fewshot_model', msg.model);
            console.log('[FewShotClient] Model changed to:', msg.model);
            this.notifyListeners({ type: 'model_changed', model: msg.model });
        }

        // Handle token streaming (for chat output)
        if (msg.type === 'token') {
            this.notifyListeners(msg);
        }

        // Handle thinking indicator
        if (msg.type === 'thinking') {
            this.notifyListeners({ type: 'thinking', message: msg.message });
        }

        // Handle completion
        if (msg.type === 'complete') {
            this.notifyListeners({ type: 'complete' });
        }

        // Handle errors
        if (msg.type === 'error') {
            console.error('[FewShotClient] Error:', msg.message);
            this.notifyListeners({ type: 'error', message: msg.message });
        }

        // Handle balance updates
        if (msg.type === 'balance_update') {
            document.dispatchEvent(new CustomEvent('token-balance-update', { detail: msg.tokens }));
        }

        // Handle tool requests from server
        if (msg.type === 'tool_request') {
            this.handleToolRequest(msg);
        }

        // Handle code messages (for displaying generated code in UI)
        if (msg.type === 'code') {
            console.log('[FewShotClient] Code received:', msg.code?.substring(0, 100) + '...');
            this.notifyListeners({ type: 'code', code: msg.code, language: msg.language, description: msg.description });
        }
    }

    async handleToolRequest(msg) {
        const { id, name, args } = msg;
        console.log(`[FewShotClient] Tool request: ${name}`, args);

        if (!this.game) {
            console.warn('[FewShotClient] Game not ready for tool:', name);
            this.sendToolResponse(id, null, 'Game not ready');
            return;
        }

        try {
            let result = null;

            switch (name) {
                case 'spawn_creature':
                    result = await this.handleSpawnCreature(args);
                    break;
                case 'give_item':
                    result = await this.handleGiveItem(args);
                    break;
                case 'set_blocks':
                    result = await this.handleSetBlocks(args);
                    break;
                default:
                    console.warn('[FewShotClient] Unknown tool:', name);
                    result = { error: `Unknown tool: ${name}` };
            }

            this.sendToolResponse(id, result);
        } catch (e) {
            console.error('[FewShotClient] Tool error:', e);
            this.sendToolResponse(id, null, e.message);
        }
    }

    async handleSpawnCreature(args) {
        const { type, count = 1 } = args;
        console.log(`[FewShotClient] Spawning ${count} ${type}`);

        if (!this.game.spawnManager) {
            return { error: 'Spawn manager not available' };
        }

        const player = this.game.player;
        if (!player) {
            return { error: 'Player not found' };
        }

        // Look up the creature class from AnimalClasses (including dynamic creatures)
        const AnimalClasses = window.AnimalClasses;
        if (!AnimalClasses) {
            return { error: 'AnimalClasses registry not available' };
        }

        // Try exact match first, then case-insensitive
        let AnimalClass = AnimalClasses[type];
        if (!AnimalClass) {
            const match = Object.keys(AnimalClasses).find(k => k.toLowerCase() === type.toLowerCase());
            if (match) {
                AnimalClass = AnimalClasses[match];
            }
        }

        if (!AnimalClass) {
            console.error(`[FewShotClient] Unknown creature type: ${type}`);
            console.log(`[FewShotClient] Available creatures: ${Object.keys(AnimalClasses).join(', ')}`);
            return { error: `Unknown creature type: ${type}` };
        }

        // Get spawn position in front of player
        // Calculate direction from player.rotation.y (yaw)
        const yaw = player.rotation?.y || 0;
        const dir = {
            x: -Math.sin(yaw),
            z: -Math.cos(yaw)
        };
        const spawnDist = 5;
        const spawnPos = {
            x: player.position.x + dir.x * spawnDist,
            y: player.position.y + 2, // Spawn slightly above ground
            z: player.position.z + dir.z * spawnDist
        };

        const spawned = [];
        for (let i = 0; i < Math.min(count, 10); i++) {
            try {
                const offset = {
                    x: (Math.random() - 0.5) * 4,
                    z: (Math.random() - 0.5) * 4
                };
                // Use spawnManager.createAnimal which is the correct API
                const entity = this.game.spawnManager.createAnimal(
                    AnimalClass,
                    spawnPos.x + offset.x,
                    spawnPos.y,
                    spawnPos.z + offset.z,
                    false // Don't snap to ground, we already positioned it
                );
                if (entity) {
                    spawned.push(entity.id || type);
                    console.log(`[FewShotClient] Spawned ${type} at (${(spawnPos.x + offset.x).toFixed(1)}, ${spawnPos.y.toFixed(1)}, ${(spawnPos.z + offset.z).toFixed(1)})`);
                }
            } catch (e) {
                console.error('[FewShotClient] Spawn error:', e);
            }
        }

        return { success: spawned.length > 0, spawned, count: spawned.length };
    }

    async handleGiveItem(args) {
        const { item, count = 1 } = args;
        console.log(`[FewShotClient] Giving ${count} ${item}`);

        if (!this.game.player || !this.game.player.inventory) {
            return { error: 'Player inventory not available' };
        }

        try {
            for (let i = 0; i < Math.min(count, 64); i++) {
                this.game.player.inventory.addItem(item, 1);
            }
            return { success: true, item, count };
        } catch (e) {
            return { error: e.message };
        }
    }

    async handleSetBlocks(args) {
        const { blocks } = args;
        console.log(`[FewShotClient] Setting ${blocks?.length || 0} blocks`);

        if (!this.game) {
            return { error: 'Game not available' };
        }

        try {
            for (const block of blocks) {
                const { x, y, z, id } = block;
                if (id === 'air' || id === null) {
                    // Use game.setBlock with null to remove block
                    this.game.setBlock(x, y, z, null);
                } else {
                    // Use game.setBlock directly (not game.world.setBlock)
                    this.game.setBlock(x, y, z, id);
                }
            }
            return { success: true, count: blocks.length };
        } catch (e) {
            console.error('[FewShotClient] Error setting blocks:', e);
            return { error: e.message };
        }
    }

    sendToolResponse(id, result, error = null) {
        this.send({
            type: 'tool_response',
            id,
            result: error ? { error } : result,
            error: error || null
        });
    }

    // Model management
    setModel(modelId) {
        this.currentModel = modelId;
        localStorage.setItem('fewshot_model', modelId);
        this.send({ type: 'set_model', model: modelId });
    }

    getModels() {
        this.send({ type: 'get_models' });
    }

    // Send interrupt signal
    interrupt() {
        this.send({ type: 'interrupt' });
    }

    // Listener system
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notifyListeners(msg) {
        for (const listener of this.listeners) {
            try {
                listener(msg);
            } catch (e) {
                console.error('[FewShotClient] Listener error:', e);
            }
        }
    }
}
