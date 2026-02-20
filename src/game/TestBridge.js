/**
 * TestBridge - Connects REST API tests with WebSocket-based AI system
 *
 * Problem: REST API tests trigger AI via WebSocket but can't see results
 * Solution: Bridge that monitors game state and reports back to REST API
 */

export class TestBridge {
    constructor(game, socketIOClient) {
        this.game = game;
        this.socket = socketIOClient;
        this.activeTests = new Map(); // Track active test promises

        console.log('[TestBridge] Initialized');
        this.setupListeners();
    }

    setupListeners() {
        // Listen to game events and forward to test system
        const originalAddEntity = this.game.addEntity.bind(this.game);

        this.game.addEntity = (entity) => {
            // Call original method
            originalAddEntity(entity);

            // Notify any waiting tests
            if (entity.mesh && entity.constructor.name !== 'Player') {
                console.log('[TestBridge] Entity added:', entity.constructor.name);
                this.notifyEntitySpawned(entity);
            }
        };

        // Listen to FewShotClient messages
        if (window.fewShotClient) {
            window.fewShotClient.addListener((msg) => {
                this.handleAIMessage(msg);
            });
        }
    }

    notifyEntitySpawned(entity) {
        const info = {
            type: 'entity_spawned',
            name: entity.constructor.name,
            position: entity.position ? {
                x: entity.position.x,
                y: entity.position.y,
                z: entity.position.z
            } : null,
            timestamp: Date.now()
        };

        // Notify Socket.IO
        this.socket.emit('test:event', info);
        console.log('[TestBridge] Notified test system:', info);
    }

    handleAIMessage(msg) {
        // Forward important AI events to test system
        if (msg.type === 'token' || msg.type === 'complete' || msg.type === 'error') {
            this.socket.emit('test:ai_event', {
                type: msg.type,
                message: msg.text || msg.message,
                timestamp: Date.now()
            });
        }
    }

    // Test API: Wait for creature with timeout
    async waitForCreature(timeout = 20000) {
        console.log('[TestBridge] 🎣 Setting up listener for creature spawn (timeout:', timeout, 'ms)');
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                console.log('[TestBridge] ⏰ Timeout! No creature spawned in', timeout, 'ms');
                this.socket.off('test:event', listener);
                reject(new Error('Timeout waiting for creature'));
            }, timeout);

            const listener = (data) => {
                console.log('[TestBridge] 📨 Received test:event:', data);
                if (data.type === 'entity_spawned') {
                    console.log('[TestBridge] ✅ Entity spawned! Resolving promise');
                    clearTimeout(timer);
                    this.socket.off('test:event', listener);
                    resolve(data);
                } else {
                    console.log('[TestBridge] ℹ️ Event type was not entity_spawned:', data.type);
                }
            };

            this.socket.on('test:event', listener);
            console.log('[TestBridge] ✅ Listener registered');
        });
    }
}
