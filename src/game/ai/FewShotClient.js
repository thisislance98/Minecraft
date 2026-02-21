/**
 * FewShotClient - WebSocket client for the Few-Shot AI system
 *
 * This client connects to the /api/fewshot endpoint and handles
 * AI-generated creatures, items, structures, etc.
 *
 * Supports both legacy events (token, complete) and new chat_* events.
 */

import * as THREE from 'three';
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
        this.currentModel = localStorage.getItem('fewshot_model') || 'anthropic/claude-opus-4.6';

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

    /**
     * Get player context (position, direction, target position)
     * Moved from TaskManager.getTaskContext()
     */
    getContext() {
        if (!this.game) return {};

        const player = this.game.player;
        const camera = this.game.camera;

        const playerX = player?.position?.x || 0;
        const playerY = player?.position?.y || 0;
        const playerZ = player?.position?.z || 0;

        // Get player's forward direction from camera
        let dirX = 0, dirZ = 1;
        if (camera) {
            const direction = camera.getWorldDirection(new THREE.Vector3());
            dirX = direction.x;
            dirZ = direction.z;
            const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
            if (len > 0.01) {
                dirX /= len;
                dirZ /= len;
            }
        }

        // Calculate target position (10 blocks in front of player)
        const targetDistance = 10;
        const targetX = playerX + dirX * targetDistance;
        const targetZ = playerZ + dirZ * targetDistance;

        // Get terrain height at target location
        let targetGroundY = playerY;
        if (this.game.worldGen && this.game.worldGen.getTerrainHeight) {
            targetGroundY = this.game.worldGen.getTerrainHeight(targetX, targetZ);
        }

        return {
            x: playerX,
            y: playerY,
            z: playerZ,
            dirX: dirX,
            dirZ: dirZ,
            targetX: targetX,
            targetZ: targetZ,
            targetGroundY: targetGroundY,
            worldId: this.game.currentWorldId || 'global'
        };
    }

    handleMessage(msg) {
        // Reduce noise: only log non-token messages
        if (msg.type !== 'chat_token') {
            console.log('[FewShotClient] Message:', msg.type, msg);
        }

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

        // Handle new chat_* events - forward directly to listeners
        if (msg.type.startsWith('chat_')) {
            this.notifyListeners(msg);
            return;
        }

        // Handle legacy events for backwards compatibility
        if (msg.type === 'token') {
            this.notifyListeners(msg);
        }

        if (msg.type === 'thinking') {
            this.notifyListeners({ type: 'thinking', message: msg.message });
        }

        if (msg.type === 'complete') {
            this.notifyListeners({ type: 'complete' });
        }

        if (msg.type === 'error') {
            console.error('[FewShotClient] Error:', msg.message);
            this.notifyListeners({ type: 'error', message: msg.message });
        }

        if (msg.type === 'balance_update') {
            document.dispatchEvent(new CustomEvent('token-balance-update', { detail: msg.tokens }));
        }

        // Handle tool requests from server
        if (msg.type === 'tool_request') {
            this.handleToolRequest(msg);
        }

        // Handle code messages (legacy)
        if (msg.type === 'code') {
            console.log('[FewShotClient] Code received:', msg.code?.substring(0, 100) + '...');
            this.notifyListeners({ type: 'code', code: msg.code, language: msg.language, description: msg.description });
        }

        // Handle cost info (legacy)
        if (msg.type === 'cost_info') {
            this.notifyListeners(msg);
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
                case 'verify':
                    result = await this.handleVerify(args);
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

        const AnimalClasses = window.AnimalClasses;
        if (!AnimalClasses) {
            return { error: 'AnimalClasses registry not available' };
        }

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

        const yaw = player.rotation?.y || 0;
        const dir = {
            x: -Math.sin(yaw),
            z: -Math.cos(yaw)
        };
        const spawnDist = 5;
        const spawnPos = {
            x: player.position.x + dir.x * spawnDist,
            y: player.position.y + 2,
            z: player.position.z + dir.z * spawnDist
        };

        const spawned = [];
        for (let i = 0; i < Math.min(count, 10); i++) {
            try {
                const offset = {
                    x: (Math.random() - 0.5) * 4,
                    z: (Math.random() - 0.5) * 4
                };
                const entity = this.game.spawnManager.createAnimal(
                    AnimalClass,
                    spawnPos.x + offset.x,
                    spawnPos.y,
                    spawnPos.z + offset.z,
                    false
                );
                if (entity) {
                    spawned.push(entity.id || type);
                    console.log(`[FewShotClient] Spawned ${type} at (${(spawnPos.x + offset.x).toFixed(1)}, ${spawnPos.y.toFixed(1)}, ${(spawnPos.z + offset.z).toFixed(1)})`);
                }
            } catch (e) {
                console.error('[FewShotClient] Spawn error:', e);
            }
        }

        // Return position for chat_action badge
        return {
            success: spawned.length > 0,
            spawned,
            count: spawned.length,
            position: {
                x: Math.round(spawnPos.x),
                y: Math.round(spawnPos.y),
                z: Math.round(spawnPos.z)
            }
        };
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
            let sumX = 0, sumY = 0, sumZ = 0;
            for (const block of blocks) {
                const { x, y, z, id } = block;
                sumX += x; sumY += y; sumZ += z;
                if (id === 'air' || id === null) {
                    this.game.setBlock(x, y, z, null);
                } else {
                    this.game.setBlock(x, y, z, id);
                }
            }

            // Return bounding box center for action badge
            const center = blocks.length > 0 ? {
                x: Math.round(sumX / blocks.length),
                y: Math.round(sumY / blocks.length),
                z: Math.round(sumZ / blocks.length)
            } : null;

            return { success: true, count: blocks.length, position: center };
        } catch (e) {
            console.error('[FewShotClient] Error setting blocks:', e);
            return { error: e.message };
        }
    }

    // ── Verification handlers ──

    async handleVerify(args) {
        const { verifyType } = args;
        console.log(`[FewShotClient] Verify request: ${verifyType}`);

        switch (verifyType) {
            case 'entities':
                return this.verifyEntities(args);
            case 'entity':
                return this.verifyEntity(args);
            case 'player':
                return this.verifyPlayer();
            case 'blocks':
                return this.verifyBlocks(args);
            case 'screenshot':
                return this.verifyScreenshot();
            default:
                return { error: `Unknown verify type: ${verifyType}` };
        }
    }

    verifyEntities(args) {
        if (!this.game) return { error: 'Game not available' };

        const player = this.game.player;
        const camera = this.game.camera;
        const entities = [];

        // Collect entities from spawnManager
        const spawnManager = this.game.spawnManager;
        if (spawnManager && spawnManager.entities) {
            const frustum = this._getCameraFrustum(camera);
            const entityIter = spawnManager.entities instanceof Map ? spawnManager.entities.values() : spawnManager.entities;

            for (const entity of entityIter) {
                const pos = entity.position || entity.mesh?.position;
                if (!pos) continue;

                const distance = player ? Math.sqrt(
                    (pos.x - player.position.x) ** 2 +
                    (pos.y - player.position.y) ** 2 +
                    (pos.z - player.position.z) ** 2
                ) : 0;

                const visible = frustum ? this._isInFrustum(frustum, pos) : null;

                entities.push({
                    type: entity.constructor?.name || entity.type || 'Unknown',
                    id: entity.id || null,
                    position: { x: Math.round(pos.x * 10) / 10, y: Math.round(pos.y * 10) / 10, z: Math.round(pos.z * 10) / 10 },
                    distance: Math.round(distance * 10) / 10,
                    visible,
                    health: entity.health ?? null,
                    alive: entity.isDead === undefined ? true : !entity.isDead
                });
            }
        }

        // Sort by distance
        entities.sort((a, b) => a.distance - b.distance);

        // Apply optional filters
        const maxDistance = args.maxDistance || Infinity;
        const typeFilter = args.type?.toLowerCase();
        const filtered = entities.filter(e => {
            if (e.distance > maxDistance) return false;
            if (typeFilter && e.type.toLowerCase() !== typeFilter) return false;
            return true;
        });

        return {
            count: filtered.length,
            entities: filtered,
            playerPosition: player ? {
                x: Math.round(player.position.x * 10) / 10,
                y: Math.round(player.position.y * 10) / 10,
                z: Math.round(player.position.z * 10) / 10
            } : null
        };
    }

    verifyEntity(args) {
        if (!this.game) return { error: 'Game not available' };

        const name = (args.name || '').toLowerCase();
        if (!name) return { error: 'Missing entity name' };

        const player = this.game.player;
        const camera = this.game.camera;
        const spawnManager = this.game.spawnManager;

        if (!spawnManager || !spawnManager.entities) {
            return { found: false, name: args.name, error: 'No spawn manager' };
        }

        const frustum = this._getCameraFrustum(camera);
        const matches = [];
        const entityIter = spawnManager.entities instanceof Map ? spawnManager.entities.values() : spawnManager.entities;

        for (const entity of entityIter) {
            const entityType = (entity.constructor?.name || entity.type || '').toLowerCase();
            if (!entityType.includes(name) && name !== entityType) continue;

            const pos = entity.position || entity.mesh?.position;
            if (!pos) continue;

            const distance = player ? Math.sqrt(
                (pos.x - player.position.x) ** 2 +
                (pos.y - player.position.y) ** 2 +
                (pos.z - player.position.z) ** 2
            ) : 0;

            const visible = frustum ? this._isInFrustum(frustum, pos) : null;

            matches.push({
                type: entity.constructor?.name || entity.type || 'Unknown',
                id: entity.id || null,
                position: { x: Math.round(pos.x * 10) / 10, y: Math.round(pos.y * 10) / 10, z: Math.round(pos.z * 10) / 10 },
                distance: Math.round(distance * 10) / 10,
                visible,
                health: entity.health ?? null,
                alive: entity.isDead === undefined ? true : !entity.isDead
            });
        }

        matches.sort((a, b) => a.distance - b.distance);

        return {
            found: matches.length > 0,
            name: args.name,
            count: matches.length,
            matches,
            anyVisible: matches.some(m => m.visible === true)
        };
    }

    verifyPlayer() {
        if (!this.game) return { error: 'Game not available' };

        const player = this.game.player;
        const camera = this.game.camera;

        if (!player) return { error: 'Player not found' };

        // Get camera direction
        let direction = null;
        if (camera) {
            const dir = camera.getWorldDirection(new THREE.Vector3());
            direction = {
                x: Math.round(dir.x * 100) / 100,
                y: Math.round(dir.y * 100) / 100,
                z: Math.round(dir.z * 100) / 100
            };
        }

        // Get inventory summary
        let inventory = null;
        if (player.inventory) {
            const items = [];
            const slots = player.inventory.slots || player.inventory.items || [];
            for (let i = 0; i < slots.length; i++) {
                const slot = slots[i];
                if (slot && slot.id) {
                    items.push({ slot: i, id: slot.id, count: slot.count || 1 });
                }
            }
            inventory = { items, selectedSlot: player.inventory.selectedSlot ?? 0 };
        }

        return {
            position: {
                x: Math.round(player.position.x * 10) / 10,
                y: Math.round(player.position.y * 10) / 10,
                z: Math.round(player.position.z * 10) / 10
            },
            direction,
            health: player.health ?? null,
            inventory
        };
    }

    verifyBlocks(args) {
        if (!this.game) return { error: 'Game not available' };

        const { x, y, z, radius = 1 } = args;
        if (x === undefined || y === undefined || z === undefined) {
            return { error: 'Missing x, y, z coordinates' };
        }

        const blocks = [];
        const r = Math.min(radius, 5); // Cap radius to prevent huge queries

        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dz = -r; dz <= r; dz++) {
                    const bx = Math.round(x) + dx;
                    const by = Math.round(y) + dy;
                    const bz = Math.round(z) + dz;

                    let blockId = null;
                    if (this.game.getBlock) {
                        blockId = this.game.getBlock(bx, by, bz);
                    }

                    if (blockId !== null && blockId !== undefined && blockId !== 0) {
                        blocks.push({ x: bx, y: by, z: bz, id: blockId });
                    }
                }
            }
        }

        return {
            center: { x: Math.round(x), y: Math.round(y), z: Math.round(z) },
            radius: r,
            count: blocks.length,
            blocks
        };
    }

    verifyScreenshot() {
        if (!this.game) return { error: 'Game not available' };

        try {
            const renderer = this.game.renderer;
            if (!renderer) return { error: 'Renderer not available' };

            // Force a render to get the latest frame
            if (this.game.scene && this.game.camera) {
                renderer.render(this.game.scene, this.game.camera);
            }

            const canvas = renderer.domElement;
            const dataUrl = canvas.toDataURL('image/png');

            return {
                success: true,
                width: canvas.width,
                height: canvas.height,
                dataUrl // base64 PNG
            };
        } catch (e) {
            return { error: `Screenshot failed: ${e.message}` };
        }
    }

    // ── Frustum helpers ──

    _getCameraFrustum(camera) {
        if (!camera) return null;
        try {
            const frustum = new THREE.Frustum();
            const projScreenMatrix = new THREE.Matrix4();
            projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
            frustum.setFromProjectionMatrix(projScreenMatrix);
            return frustum;
        } catch (e) {
            return null;
        }
    }

    _isInFrustum(frustum, position) {
        try {
            const point = new THREE.Vector3(position.x, position.y, position.z);
            return frustum.containsPoint(point);
        } catch (e) {
            return null;
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
