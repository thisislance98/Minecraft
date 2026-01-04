import { auth } from '../../config/firebase-client.js';

export class MerlinClient {
    constructor() {
        this.ws = null;
        this.game = null; // Optional reference to the game engine
        this.listeners = new Set();
        this.isConnected = false;

        // Connection state
        this.reconnectTimer = null;
        this.baseReconnectDelay = 1000;
        this.maxReconnectDelay = 30000;
        this.currentReconnectDelay = this.baseReconnectDelay;
        this.isExplicitlyDisconnected = false; // If user logs out or we want to stop

        // Message queue for when game is not ready
        this.messageQueue = [];

        // Settings
        this.autoFixErrors = false; // Off by default - user must enable

        // Global Error Monitoring
        this.lastSentError = null;
        this.setupErrorListeners();

        // Listen for auth changes to reconnect with new identity
        auth.onAuthStateChanged(async (user) => {
            console.log('[MerlinClient] Auth state changed. Reconnecting...');
            // If user logs out, we might want to stay connected as guest, or reconnect.
            // For now, simple reconnect is safest to pick up new token (or lack thereof).
            this.connect();
        });
    }

    setGame(game) {
        this.game = game;
        console.log('[MerlinClient] Game instance attached.');
        // Update UI with current status
        if (this.game.uiManager) {
            this.game.uiManager.updateAIStatus(this.isConnected ? 'Connected' : 'Disconnected');
        }
    }

    cleanup() {
        // Clear any pending reconnects
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        // Validate and close existing socket
        if (this.ws) {
            // Remove listeners to prevent "onclose" triggering reconnects during cleanup
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.onmessage = null;
            this.ws.onopen = null;
            this.ws.close();
            this.ws = null;
        }
    }

    async connect() {
        this.cleanup(); // Clean up previous connection attempts

        this.isExplicitlyDisconnected = false;

        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        // Use configured VITE_SERVER_URL (production Cloud Run) or fallback to local/origin
        const baseUrl = import.meta.env.VITE_SERVER_URL || (isDev ? 'http://localhost:2567' : window.location.origin);

        if (!isDev && baseUrl === window.location.origin) {
            console.warn('[MerlinClient] WARNING: Connecting via same-origin (Firebase Proxy). This is known to be unreliable for WebSockets. Please set VITE_SERVER_URL to the direct Cloud Run URL.');
        }

        // Construct WebSocket URL (replace http/https with ws/wss)
        let wsUrl = baseUrl.replace(/^http/, 'ws');
        let url = `${wsUrl}/api/antigravity`; // Keep endpoint same unless server changed

        // Add token if authenticated
        if (auth.currentUser) {
            try {
                const token = await auth.currentUser.getIdToken();
                url += `?token=${token}`;
                console.log('[MerlinClient] Connecting with Auth Token');
            } catch (e) {
                console.warn('[MerlinClient] Failed to get token:', e);
            }
        }

        // Check if CLI mode is enabled via URL (e.g., ?cli=true from test runner)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('cli') === 'true') {
            url += (url.includes('?') ? '&' : '?') + 'cli=true&secret=asdf123';
            console.log('[MerlinClient] CLI mode detected, bypassing authentication');
        }

        console.log('[MerlinClient] Connecting to:', url);
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('[MerlinClient] Connected.');
            this.isConnected = true;
            this.currentReconnectDelay = this.baseReconnectDelay; // Reset backoff
            this.notifyListeners({ type: 'status', status: 'connected' });
            if (this.game && this.game.uiManager) {
                this.game.uiManager.updateAIStatus('Connected');
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.handleMessage(msg);
            } catch (e) {
                console.error('[MerlinClient] Error parsing message:', e);
            }
        };

        this.ws.onclose = (event) => {
            console.log(`[MerlinClient] Disconnected. Code: ${event.code}, Reason: ${event.reason}`);
            this.isConnected = false;
            this.notifyListeners({ type: 'status', status: 'disconnected' });

            if (this.game && this.game.uiManager) {
                this.game.uiManager.updateAIStatus('Disconnected');
            }

            if (event.code === 1011) {
                console.error('[MerlinClient] Critical Server Error:', event.reason);
                // Don't retry if it's a configuration error
                return;
            }

            if (this.isExplicitlyDisconnected) return;

            // Exponential Backoff Reconnect
            console.log(`[MerlinClient] Reconnecting in ${this.currentReconnectDelay}ms...`);
            this.reconnectTimer = setTimeout(() => {
                this.connect();
                // Increase delay for next time, cap at max
                this.currentReconnectDelay = Math.min(this.currentReconnectDelay * 1.5, this.maxReconnectDelay);
            }, this.currentReconnectDelay);
        };

        this.ws.onerror = (err) => {
            // Just log it, onclose will handle the retry logic
            console.error('[MerlinClient] WebSocket error:', err);
        };
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            const readyState = this.ws ? this.ws.readyState : 'no socket';
            console.warn(`[MerlinClient] Cannot send, socket not open. State: ${readyState}`);
            // Ideally notify UI of offline state
            this.notifyListeners({ type: 'error', message: 'Cannot reach AI server. Reconnecting... Check if the server is running.' });
        }
    }

    /* 
     * Core Message Handling
     */
    async handleMessage(msg) {
        // 1. Notify listeners (UI updates)
        this.notifyListeners(msg);

        // 2. Handle Tool Requests (Requires Game)
        if (msg.type === 'tool_request') {
            if (this.game && this.game.agent) {
                // Delegate to Agent entity which has the tool logic
                // In a full refactor, tools might move here or to a ToolManager
                // For now, we bridge to the existing agent.
                await this.game.agent.handleToolRequest(msg);
            } else {
                console.warn('[MerlinClient] Tool requested but Game/Agent not available:', msg.name);
                // We should probably reply with an error so the server doesn't hang
                this.send({
                    type: 'tool_response',
                    id: msg.id,
                    result: { error: 'Game engine not ready or crashed. Cannot execute tool.' }
                });
            }
        }

        // 3. Handle Balance Updates
        if (msg.type === 'balance_update') {
            console.log('[MerlinClient] Balance Update:', msg.tokens);
            // Dispatch event for UI
            document.dispatchEvent(new CustomEvent('token-balance-update', { detail: msg.tokens }));
        }
    }

    /*
     * Error Reporting
     */
    setupErrorListeners() {
        window.addEventListener('error', (event) => {
            this.reportError({
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error ? event.error.stack : null
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.reportError({
                message: `Unhandled Rejection: ${event.reason}`,
                error: event.reason ? event.reason.stack : null
            });
        });
    }

    reportError(errorDetails) {
        // Check if auto-fix errors is enabled
        if (!this.autoFixErrors) {
            console.log('[MerlinClient] Auto-fix disabled, error not reported to AI:', errorDetails.message);
            return;
        }

        // Check if AI is currently busy with a fix (Streaming)
        // If so, suppress new errors to prevent interruption/spam
        if (this.game && this.game.agent && this.game.agent.isStreaming) {
            console.log('[MerlinClient] Error suppressed (AI is streaming):', errorDetails.message);
            return;
        }

        // Deduplication: Don't send the exact same error twice in a row
        if (this.lastSentError === errorDetails.message) {
            console.log('[MerlinClient] Error suppressed (Duplicate):', errorDetails.message);
            return;
        }

        this.lastSentError = errorDetails.message;

        // New Behavior: Open Chat and Ask to Fix
        if (this.game && this.game.uiManager) {
            this.game.uiManager.toggleChatPanel(true);

            const stackInfo = errorDetails.error ? `\n\nStack:\n${errorDetails.error}` : '';
            const userPrompt = `I encountered an error: ${errorDetails.message}.${stackInfo}\n\nPlease fix it.`;

            this.game.uiManager.addChatMessage('user', userPrompt);

            this.send({
                type: 'input',
                text: userPrompt
            });
        } else {
            // Fallback if UI is dead: just send the error event
            this.send({
                type: 'client_error',
                error: errorDetails
            });
        }
    }

    /*
     * Listener System for UI separation
     */
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notifyListeners(msg) {
        for (const listener of this.listeners) {
            try {
                listener(msg);
            } catch (e) {
                console.error('[MerlinClient] Listener error:', e);
            }
        }
    }
}
