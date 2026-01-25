import { auth } from '../../config/firebase-client.js';
import { TaskManager } from './TaskManager.js';

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
        this.isReconnecting = false; // Suppress noisy logs during reconnection

        // Message queue for when game is not ready
        this.messageQueue = [];

        // Response control
        this.isMutedResponse = false;

        // Settings
        this.autoFixErrors = false; // Off by default - user must enable
        this.thinkingEnabled = localStorage.getItem('settings_thoughts') === 'true'; // Off by default
        this.bypassTokens = localStorage.getItem('settings_bypass_tokens') !== 'false'; // On by default
        this.aiProvider = localStorage.getItem('settings_ai_provider') || 'openrouter'; // 'openrouter', 'gemini', or 'claude'
        this.modelMode = localStorage.getItem('settings_model_mode') || 'smart'; // 'smart' (pro) or 'cheap' (flash)
        this.showCost = localStorage.getItem('settings_show_cost') === 'true'; // Off by default

        // TaskManager for handling queued tasks
        this.taskManager = new TaskManager(this);

        // Global Error Monitoring
        this.lastSentError = null;
        this.setupErrorListeners();

        // Voice Interaction
        this.voiceEnabled = false; // Disabled by default per user request
        this.isListening = false;
        this.recognition = null;
        this.currentAudio = null;

        // In-game Merlin entity reference
        this.entity = null; // Set by VoxelGame.spawnMerlin()

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

        // Claude Code mode - no WebSocket needed
        if (this.aiProvider === 'claude') {
            console.log('[MerlinClient] Claude Code mode enabled - using local Claude agent');
            this.isConnected = true;
            this.notifyListeners({ type: 'status', status: 'connected', provider: 'claude' });
            if (this.game && this.game.uiManager) {
                this.game.uiManager.updateAIStatus('Connected (Claude Code)');
            }
            return;
        }

        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        // Use configured VITE_SERVER_URL (production Cloud Run) or fallback to local/origin
        const baseUrl = import.meta.env.VITE_SERVER_URL || (isDev ? 'http://localhost:2567' : window.location.origin);

        if (!isDev && baseUrl === window.location.origin) {
            console.warn('[MerlinClient] WARNING: Connecting via same-origin (Firebase Proxy). This is known to be unreliable for WebSockets. Please set VITE_SERVER_URL to the direct Cloud Run URL.');
        }

        // Construct WebSocket URL (replace http/https with ws/wss)
        let wsUrl = baseUrl.replace(/^http/, 'ws');
        let url = `${wsUrl}/api/antigravity`;

        // Add provider parameter for server-side routing
        url += `?provider=${this.aiProvider}`;

        // Add token if authenticated
        if (auth.currentUser) {
            try {
                const token = await auth.currentUser.getIdToken();
                url += `&token=${token}`;
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

        if (!this.isReconnecting) {
            console.log('[MerlinClient] Connecting to:', url);
        }
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('[MerlinClient] Connected.');
            this.isConnected = true;
            this.isReconnecting = false;
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
            // Only log disconnect on first disconnect, not during reconnection attempts
            if (!this.isReconnecting) {
                console.log(`[MerlinClient] Disconnected. Code: ${event.code}, Reason: ${event.reason}`);
            }
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
            if (!this.isReconnecting) {
                console.log(`[MerlinClient] Reconnecting...`);
            }
            this.isReconnecting = true;
            this.reconnectTimer = setTimeout(() => {
                this.connect();
                // Increase delay for next time, cap at max
                this.currentReconnectDelay = Math.min(this.currentReconnectDelay * 1.5, this.maxReconnectDelay);
            }, this.currentReconnectDelay);
        };

        this.ws.onerror = (err) => {
            // Suppress expected errors during reconnection attempts
            if (!this.isReconnecting) {
                console.warn('[MerlinClient] WebSocket error:', err);
            }
        };
    }

    send(data) {
        // Claude Code mode - show message to user
        if (this.aiProvider === 'claude') {
            if (data.type === 'input') {
                this.handleClaudeCodeMode(data.text, data.context);
            }
            return;
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Include settings for input messages
            if (data.type === 'input') {
                // Clear any muted state when user sends a new message
                // This prevents silenced persona init from blocking user messages
                if (this.isMutedResponse) {
                    console.log('[MerlinClient] Clearing muted state for new user input');
                    this.isMutedResponse = false;
                }
                data.settings = {
                    thinkingEnabled: this.thinkingEnabled,
                    bypassTokens: this.bypassTokens,
                    modelMode: this.modelMode
                };
            }
            this.ws.send(JSON.stringify(data));
        } else {
            const readyState = this.ws ? this.ws.readyState : 'no socket';
            console.warn(`[MerlinClient] Cannot send, socket not open. State: ${readyState}`);
            // Ideally notify UI of offline state
            this.notifyListeners({ type: 'error', message: 'Cannot reach AI server. Reconnecting... Check if the server is running.' });
        }
    }

    /**
     * Handle Claude Code mode - instruct user to use Claude Code directly
     */
    handleClaudeCodeMode(text, context) {
        console.log('[MerlinClient] Claude Code mode - user message:', text);

        // Show helpful message explaining how to use Claude Code
        const instructions = `*Merlin gestures mystically*

🧙 **Claude Code Mode Active**

To interact with Merlin in Claude Code mode, speak your request in the Claude Code terminal where you're running the game.

**Your message:** "${text}"

**How to use Claude Code:**
1. In your Claude Code terminal, type your request
2. Merlin (Claude) will use the provided skills to help you:
   - **create-creature**: Make new creatures
   - **create-item**: Craft magical items
   - **build-structure**: Build structures

**Example commands:**
- "Create a bouncing slime creature"
- "Make me a thunder hammer item"
- "Build a golden pyramid"

The skills have all the knowledge needed to create amazing things in this world!

**Context for Claude:**
${context ? `\nPlayer Position: x=${context.x?.toFixed(1)}, y=${context.y?.toFixed(1)}, z=${context.z?.toFixed(1)}` : ''}
${context?.scene ? `\nNearby: ${JSON.stringify(context.scene)}` : ''}

*switches back to staff-waving mode* ✨`;

        // Send response through listener system
        this.notifyListeners({
            type: 'token',
            text: instructions
        });

        // Send complete signal to stop thinking indicator
        this.notifyListeners({
            type: 'complete'
        });

        // Also log to console for Claude Code to see
        console.log('[Merlin Context]:', JSON.stringify(context, null, 2));
    }

    /* 
     * Core Message Handling
     */
    silenceNextResponse() {
        this.isMutedResponse = true;
        console.log('[MerlinClient] Silencing next response...');
    }

    async handleMessage(msg) {
        // Handle Muted Response (for hidden system prompts)
        if (this.isMutedResponse) {
            if (['token', 'thought', 'response', 'assistant_message'].includes(msg.type)) {
                return; // Drop these messages completely
            }
            if (msg.type === 'complete') {
                this.isMutedResponse = false;
                console.log('[MerlinClient] Silenced response complete.');
                return;
            }
            // Let tool_request, error, etc. pass through
        }

        // Route to TaskManager for task-specific handling
        if (this.taskManager) {
            this.taskManager.handleMessage(msg);
        }

        // 1. Notify listeners (UI updates)
        this.notifyListeners(msg);

        // Voice Response: Accumulate tokens and speak on complete
        if (msg.type === 'token') {
            // Accumulate the streamed text
            if (!this.pendingVoiceText) this.pendingVoiceText = '';
            this.pendingVoiceText += msg.text;
        }

        // Speak BEFORE tool execution starts - this makes Merlin respond first, then create
        if (msg.type === 'tool_start') {
            if (this.pendingVoiceText) {
                console.log('[MerlinClient] Speaking early before tool execution:', this.pendingVoiceText.substring(0, 50) + '...');
                this.speak(this.pendingVoiceText);
                this.pendingVoiceText = '';
            }
        }

        if (msg.type === 'complete') {
            // Speak the accumulated response (if no tools were called)
            if (this.pendingVoiceText) {
                this.speak(this.pendingVoiceText);
                this.pendingVoiceText = '';
            }
        }

        // Legacy: Also handle non-streamed responses
        if (msg.type === 'response' || msg.type === 'assistant_message') {
            if (msg.text) this.speak(msg.text);
        }

        // 2. Handle Tool Requests (Requires Game)
        if (msg.type === 'tool_request') {
            console.log(`[MerlinClient] Received tool_request: ${msg.name}`, msg.args);
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

    /*
     * Voice Interaction (STT & TTS)
     */
    initSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('[MerlinClient] Speech Recognition not supported in this browser.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false; // Stop after one sentence
        this.recognition.lang = 'en-US';
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.notifyListeners({ type: 'voice_status', status: 'listening' });
            this.showListeningIndicator();
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.notifyListeners({ type: 'voice_status', status: 'idle' });
            this.hideListeningIndicator();
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            console.log('[MerlinClient] Heard:', transcript);

            // Send to Chat UI
            if (this.game && this.game.uiManager) {
                this.game.uiManager.addChatMessage('user', transcript);
                this.send({
                    type: 'input',
                    text: transcript
                });
            }
        };

        this.recognition.onerror = (event) => {
            console.error('[MerlinClient] Speech recognition error', event.error);
            this.isListening = false;
            this.notifyListeners({ type: 'voice_status', status: 'error' });
        };
    }

    toggleVoice() {
        if (!this.recognition) this.initSpeechRecognition();
        if (!this.recognition) return;

        if (this.isListening) {
            this.recognition.stop();
        } else {
            // Don't interrupt Merlin while he's speaking - just start listening
            // The user can talk while Merlin finishes his sentence
            this.recognition.start();
        }
    }

    async speak(text) {
        if (!this.voiceEnabled) return false;

        // Show speech bubble on in-game Merlin entity
        if (this.entity && this.entity.showSpeechBubble) {
            this.entity.showSpeechBubble(text, 8);
        }

        // Don't interrupt current audio if user is currently listening (voice input active)
        // This prevents pressing the talk key from cutting off Merlin mid-sentence
        if (this.currentAudio && this.isListening) {
            console.log('[MerlinClient] Not interrupting current speech - user is listening');
            return false;
        }

        // Stop any current audio for new speech
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }

        const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
        if (!apiKey) {
            console.warn('[MerlinClient] No ElevenLabs API Key found. Set VITE_ELEVENLABS_API_KEY.');
            return false;
        }

        // Merlin's Voice ID (Generic Male British or similar)
        // Using a public one or one if provided. 
        // Example: 'ErXwobaYiN019PkySvjV' (Antoni) or custom.
        const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'ErXwobaYiN019PkySvjV';

        try {
            // Use Flash v2.5 for ultra-low latency (~75ms inference) + optimize_streaming_latency=3
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=3`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': apiKey
                },
                body: JSON.stringify({
                    text: text,
                    model_id: "eleven_flash_v2_5",  // Flash v2.5 for fastest response
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                })
            });

            if (!response.ok) throw new Error('ElevenLabs API request failed');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            this.currentAudio = new Audio(url);

            try {
                await this.currentAudio.play();
                console.log('[MerlinClient] Audio playback started.');
            } catch (playError) {
                console.error('[MerlinClient] Audio play failed (Autoplay policy?):', playError);
                return false;
            }

            this.currentAudio.onended = () => {
                URL.revokeObjectURL(url);
                this.currentAudio = null;
            };
            return true;

        } catch (e) {
            console.error('[MerlinClient] TTS Error:', e);
            return false;
        }
    }

    /**
     * Show a global indicator that Merlin is listening for voice input
     */
    showListeningIndicator() {
        // Create if doesn't exist
        if (!this.listeningIndicator) {
            const div = document.createElement('div');
            div.id = 'merlin-listening-indicator';
            div.innerHTML = `
                <div class="merlin-listening-content">
                    <span class="merlin-listening-icon">🎤</span>
                    <span class="merlin-listening-text">Merlin is listening...</span>
                </div>
                <style>
                    #merlin-listening-indicator {
                        position: fixed;
                        top: 80px;
                        left: 50%;
                        transform: translateX(-50%);
                        z-index: 2500;
                        background: linear-gradient(135deg, rgba(75, 0, 130, 0.95), rgba(138, 43, 226, 0.95));
                        border: 2px solid #ff4444;
                        border-radius: 30px;
                        padding: 12px 24px;
                        font-family: 'VT323', monospace;
                        box-shadow: 0 0 20px rgba(255, 68, 68, 0.5);
                        animation: merlin-pulse 1.5s ease-in-out infinite;
                    }
                    .merlin-listening-content {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .merlin-listening-icon {
                        font-size: 24px;
                        animation: merlin-bounce 0.5s ease-in-out infinite alternate;
                    }
                    .merlin-listening-text {
                        color: #fff;
                        font-size: 18px;
                        font-weight: bold;
                    }
                    @keyframes merlin-pulse {
                        0%, 100% { box-shadow: 0 0 20px rgba(255, 68, 68, 0.5); }
                        50% { box-shadow: 0 0 40px rgba(255, 68, 68, 0.8); }
                    }
                    @keyframes merlin-bounce {
                        0% { transform: scale(1); }
                        100% { transform: scale(1.2); }
                    }
                </style>
            `;
            document.body.appendChild(div);
            this.listeningIndicator = div;
        }
        this.listeningIndicator.style.display = 'block';
    }

    /**
     * Hide the global listening indicator
     */
    hideListeningIndicator() {
        if (this.listeningIndicator) {
            this.listeningIndicator.style.display = 'none';
        }
    }
}
