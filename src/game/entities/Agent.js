
import * as THREE from 'three';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AnimalClasses } from '../AnimalRegistry.js';

// Import AI modules
import { getTools } from '../ai/tools.js';
import { getSystemInstruction } from '../ai/prompts.js';
import {
    AUDIO_SAMPLE_RATE_INPUT,
    AUDIO_SAMPLE_RATE_OUTPUT,
    AUDIO_BUFFER_SIZE,
    MAX_CONVERSATION_HISTORY,
    MAX_TOOL_CALL_TURNS,
    MAX_SPAWN_COUNT,
    BIOME_SEARCH_MAX_RADIUS,
    BIOME_SEARCH_STEP,
    CREATURE_DETECTION_RADIUS,
    TASK_POLL_INTERVAL,
    VOICE_RECONNECT_DELAY,
    GEMINI_MODEL_TEXT,
    GEMINI_WS_URL,
    DEFAULT_VOICE,
    BIOME_ALIASES,
    CREATURE_ALIASES
} from '../ai/constants.js';

// ============================================================================
// Audio Worklet Processor Source (inline as string for blob URL)
// ============================================================================
const AudioRecordingWorkletSrc = `
class AudioRecordingProcessor extends AudioWorkletProcessor {
  buffer = new Int16Array(${AUDIO_BUFFER_SIZE});
  bufferWriteIndex = 0;

  process(inputs) {
    if (inputs[0].length) {
      const channel0 = inputs[0][0];
      this.processChunk(channel0);
    }
    return true;
  }

  sendAndClearBuffer(){
    this.port.postMessage({
      int16arrayBuffer: this.buffer.slice(0, this.bufferWriteIndex).buffer,
    });
    this.bufferWriteIndex = 0;
  }

  processChunk(float32Array) {
    for (let i = 0; i < float32Array.length; i++) {
      const int16Value = Math.max(-32768, Math.min(32767, Math.round(float32Array[i] * 32768)));
      this.buffer[this.bufferWriteIndex++] = int16Value;
      if(this.bufferWriteIndex >= this.buffer.length) {
        this.sendAndClearBuffer();
      }
    }
  }
}
registerProcessor('audio-recording-processor', AudioRecordingProcessor);
`;

export class Agent {
    constructor(game) {
        this.game = game;
        this.position = new THREE.Vector3(35, 20, 35);
        this.isListening = false;
        this.isConnected = false;

        this.ring = null;
        this.time = 0;
        this.createMesh();

        // Chat State
        this.isChatOpen = false;
        this.isTypingMode = false;
        // Shared conversation history between voice and text chat
        this.conversationHistory = [];

        // Voice Chat State
        this.ws = null;
        this.inputContext = null;
        this.outputContext = null;
        this.mediaStream = null;
        this.workletNode = null;

        // Audio Playback Queue
        this.audioQueue = [];
        this.isPlaying = false;

        // Voice Config
        this.voiceName = localStorage.getItem('agent_voice') || DEFAULT_VOICE;

        // Create minimal status indicator
        this.game.uiManager.updateVoiceStatus(false, 'Voice Off (V)');

        // Voice is OFF by default - press V to toggle
        this.setupKeyboardToggle();

        // Debug command handler will be set up later via setupDebugCommandHandler()
        // because ColyseusManager is created after Agent in VoxelGame
    }

    /**
     * Set up debug command handler - called by VoxelGame after colyseusManager is created
     */
    setupDebugCommandHandler() {
        if (this.game.colyseusManager) {
            console.log('[Agent] Setting up debug command handler');
            this.game.colyseusManager.onDebugCommand = (data) => {
                console.log('[Agent] Received debug command:', data);
                if (data.prompt) {
                    this.injectPrompt(data.prompt, data.debugId);
                }
            };
        } else {
            console.warn('[Agent] ColyseusManager not available for debug commands');
        }
    }

    setupKeyboardToggle() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'v' || e.key === 'V') {
                // Don't trigger if typing in an input
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                this.toggleVoice();
            }
        });
    }

    toggleVoice() {
        if (this.isConnected) {
            this.disconnectVoice();
        } else {
            this.connectVoice();
        }
    }

    disconnectVoice() {
        this.isConnected = false;
        this.isListening = false;

        if (this.ws) { this.ws.close(); this.ws = null; }
        if (this.workletNode) { this.workletNode.disconnect(); this.workletNode = null; }
        if (this.mediaStream) { this.mediaStream.getTracks().forEach(t => t.stop()); this.mediaStream = null; }
        if (this.inputContext) { this.inputContext.close(); this.inputContext = null; }
        if (this.outputContext) { this.outputContext.close(); this.outputContext = null; }
        this.audioQueue = [];
        this.isPlaying = false;

        this.game.uiManager.updateVoiceStatus(false, 'Voice Off (V)');
    }

    setVoice(voiceName) {
        this.voiceName = voiceName;
        localStorage.setItem('agent_voice', voiceName);
        console.log(`[Agent] Voice set to ${voiceName}`);

        // If connected, reconnect to apply new voice
        if (this.isConnected) {
            this.disconnectVoice();
            // Short delay to ensure clean disconnect
            setTimeout(() => this.connectVoice(), VOICE_RECONNECT_DELAY);
        }
    }

    createMesh() {
        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.position);

        const bodyGeo = new THREE.SphereGeometry(0.5, 32, 32);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x00ffcc, emissive: 0x004433 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        this.mesh.add(body);

        const ringGeo = new THREE.TorusGeometry(0.8, 0.05, 16, 100);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        this.mesh.add(ring);
        this.ring = ring;

        const eyeGeo = new THREE.SphereGeometry(0.1, 16, 16);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.2, 0.1, 0.4);
        this.mesh.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.2, 0.1, 0.4);
        this.mesh.add(rightEye);

        this.mesh.userData.isAgent = true;
        this.mesh.userData.agent = this;
    }

    /**
     * Get the player's current transform (position and rotation)
     * @returns {Object} Transform with position and rotation
     */
    getPlayerTransform() {
        const player = this.game.player;
        return {
            position: {
                x: player.position.x,
                y: player.position.y,
                z: player.position.z
            },
            rotation: {
                x: player.rotation.x,
                y: player.rotation.y
            }
        };
    }

    /**
     * Limit conversation history to prevent unbounded memory growth
     */
    trimConversationHistory() {
        if (this.conversationHistory.length > MAX_CONVERSATION_HISTORY) {
            this.conversationHistory = this.conversationHistory.slice(-MAX_CONVERSATION_HISTORY);
        }
    }

    async initializeTextClient() {
        if (this.genAI) return;

        try {
            const configReq = await fetch('/api/god-mode/config');
            const config = await configReq.json();
            if (!config.apiKey) throw new Error('No API Key');

            this.genAI = new GoogleGenerativeAI(config.apiKey);
            this.textModel = this.genAI.getGenerativeModel({
                model: GEMINI_MODEL_TEXT,
                systemInstruction: getSystemInstruction(this.getPlayerTransform()),
                tools: getTools()
            });
            console.log('[Agent] Text client initialized');
        } catch (e) {
            console.error("[Agent] Failed to init text client:", e);
        }
    }

    async connectVoice() {
        try {
            this.game.uiManager.updateVoiceStatus(false, 'Fetching Config...');
            const configReq = await fetch('/api/god-mode/config');
            const config = await configReq.json();
            if (!config.apiKey) throw new Error('No API Key');

            // Initialize text client opportunistically as well
            if (!this.genAI) {
                this.genAI = new GoogleGenerativeAI(config.apiKey);
                this.textModel = this.genAI.getGenerativeModel({
                    model: GEMINI_MODEL_TEXT,
                    systemInstruction: getSystemInstruction(this.getPlayerTransform()),
                    tools: getTools()
                });
            }

            this.game.uiManager.updateVoiceStatus(false, 'Setting up Audio...');

            // Input context at 16kHz for recording
            this.inputContext = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE_INPUT });
            await this.inputContext.resume();

            // Output context at 24kHz for playback
            this.outputContext = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE_OUTPUT });
            await this.outputContext.resume();

            // Get Microphone
            this.game.uiManager.updateVoiceStatus(false, 'Accessing Mic...');
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
            });

            // Setup AudioWorklet
            const workletBlob = new Blob([AudioRecordingWorkletSrc], { type: 'application/javascript' });
            const workletUrl = URL.createObjectURL(workletBlob);
            await this.inputContext.audioWorklet.addModule(workletUrl);
            URL.revokeObjectURL(workletUrl);

            const source = this.inputContext.createMediaStreamSource(this.mediaStream);
            this.workletNode = new AudioWorkletNode(this.inputContext, 'audio-recording-processor');
            source.connect(this.workletNode);
            this.workletNode.connect(this.inputContext.destination);

            // Setup WebSocket
            this.game.uiManager.updateVoiceStatus(false, 'Connecting to Gemini...');
            const wsUrl = `${GEMINI_WS_URL}?key=${config.apiKey}`;
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.isConnected = true;
                this.isListening = true;
                this.game.uiManager.updateVoiceStatus(true, 'Listening');

                // Send setup with function calling for code modification
                const transform = this.getPlayerTransform();
                this.ws.send(JSON.stringify({
                    setup: {
                        model: "models/gemini-2.0-flash-exp",
                        generationConfig: {
                            responseModalities: ["AUDIO"],
                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: {
                                        voiceName: this.voiceName || DEFAULT_VOICE
                                    }
                                }
                            }
                        },
                        systemInstruction: getSystemInstruction(transform),
                        tools: getTools()
                    }
                }));

                // Send existing conversation history to voice session
                if (this.conversationHistory.length > 0) {
                    this.ws.send(JSON.stringify({
                        clientContent: {
                            turns: this.conversationHistory.map(msg => ({
                                role: msg.role,
                                parts: [{ text: msg.text }]
                            })),
                            turnComplete: true
                        }
                    }));
                    console.log('[Agent] Sent conversation history to voice session:', this.conversationHistory.length, 'messages');
                }

                // Start sending audio
                this.workletNode.port.onmessage = (ev) => {
                    if (!this.isConnected) return;
                    const arrayBuffer = ev.data.int16arrayBuffer;
                    if (arrayBuffer) {
                        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                            const base64Audio = this.arrayBufferToBase64(arrayBuffer);
                            this.ws.send(JSON.stringify({
                                realtimeInput: {
                                    mediaChunks: [{ mimeType: "audio/pcm", data: base64Audio }]
                                }
                            }));
                        }
                    }
                };
            };

            this.ws.onmessage = async (event) => {
                let msg;
                if (event.data instanceof Blob) {
                    const text = await event.data.text();
                    msg = JSON.parse(text);
                } else {
                    msg = JSON.parse(event.data);
                }

                // Handle tool calls (function calling)
                if (msg.toolCall) {
                    console.log('[Agent] Tool call received (top-level):', msg.toolCall);
                    await this.handleToolCall(msg.toolCall);
                    return;
                }

                if (msg.serverContent?.modelTurn?.parts) {
                    const parts = msg.serverContent.modelTurn.parts;

                    // 1. Check for function calls in parts
                    const functionCalls = parts.filter(p => p.functionCall).map(p => p.functionCall);
                    if (functionCalls.length > 0) {
                        console.log('[Agent] Tool calls received in parts:', functionCalls);
                        await this.handleToolCall({ functionCalls });
                    }

                    // 2. Handle audio/text response
                    for (const part of parts) {
                        if (part.inlineData?.data) {
                            this.queueAudio(part.inlineData.data);
                        }
                        if (part.text) {
                            console.log('[Agent] Text response:', part.text);
                            this.game.uiManager.addChatMessage('ai', part.text);
                            // Add to shared history and trim
                            this.conversationHistory.push({ role: 'model', text: part.text });
                            this.trimConversationHistory();
                        }
                    }
                }
                if (msg.serverContent?.interrupted) {
                    this.audioQueue = [];
                }
            };

            this.ws.onerror = (e) => {
                console.error("WebSocket Error:", e);
                this.disconnectVoice();  // Clean up resources properly
                this.game.uiManager.updateVoiceStatus(false, 'Error - Press V to retry');
            };

            this.ws.onclose = (event) => {
                console.log(`[Agent] WebSocket Closed. Code: ${event.code}, Reason: ${event.reason}`);
                this.isConnected = false;
                this.isListening = false;
                this.game.uiManager.updateVoiceStatus(false, 'Voice Off (V)');
            };

        } catch (e) {
            console.error("Voice Connect Error:", e);
            this.disconnectVoice();  // Clean up on error
            this.game.uiManager.updateVoiceStatus(false, 'Error: ' + e.message);
        }
    }

    async executeTool(name, args) {
        if (name === 'perform_task') {
            const request = args?.request;
            console.log('[Agent] Executing code modification via tool:', request);

            this.game.uiManager.addChatMessage('ai', `Starting task: ${request}`);
            this.game.uiManager.updateVoiceStatus(true, 'Coding...');

            try {
                const res = await fetch('/api/god-mode/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: request })
                });
                const data = await res.json();

                if (data.success && data.taskId) {
                    // Create UI task with backend ID so Logs button works
                    const uiTaskId = this.game.uiManager.addTask(request, data.taskId);

                    // Start polling for completion
                    this.pollTaskStatus(data.taskId, uiTaskId, request);

                    // Report back to CLI (Debug)
                    if (this.currentDebugId) {
                        this.game.colyseusManager?.sendDebugResponse({
                            debugId: this.currentDebugId,
                            tool: 'perform_task',
                            request: request,
                            status: 'started'
                        });
                        this.currentDebugId = null;
                    }

                    return { output: { status: "started", taskId: data.taskId } };
                } else {
                    throw new Error(data.error || 'Failed to start task');
                }

            } catch (e) {
                console.error('[Agent] Tool call error:', e);
                this.game.uiManager.addChatMessage('system', `Task error: ${e.message}`);
                this.game.uiManager.updateVoiceStatus(true, 'Listening');
                return { output: { error: e.message } };
            }
        } else if (name === 'provide_suggestions') {
            const suggestions = args?.suggestions;
            console.log('[Agent] Received suggestions:', suggestions);
            if (suggestions && Array.isArray(suggestions)) {
                this.game.uiManager.showSuggestions(suggestions);
            }

            // Report back to CLI (Debug)
            if (this.currentDebugId) {
                this.game.colyseusManager?.sendDebugResponse({
                    debugId: this.currentDebugId,
                    tool: 'provide_suggestions',
                    suggestions: suggestions
                });
                this.currentDebugId = null;
            }

            return { output: { suggestions: suggestions ? suggestions.join(', ') : '' } };
        } else if (name === 'teleport_player') {
            const location = args?.location;
            console.log('[Agent] Teleporting player to:', location);
            const result = this.teleportPlayer(location);
            this.game.uiManager.addChatMessage('ai', `🌍 ${result}`);

            // Report back to CLI (Debug)
            if (this.currentDebugId) {
                this.game.colyseusManager?.sendDebugResponse({
                    debugId: this.currentDebugId,
                    tool: 'teleport_player',
                    location: location,
                    result: result
                });
                this.currentDebugId = null;
            }

            return { output: { result } };
        } else if (name === 'spawn_creature') {
            const creature = args?.creature;
            const count = Math.min(MAX_SPAWN_COUNT, Math.max(1, args?.count || 1));
            console.log('[Agent] Spawning creature:', creature, 'x', count);
            const result = this.spawnCreature(creature, count);

            // Check if creature doesn't exist and needs to be created
            if (result?.status === 'not_found') {
                const creatureName = result.creature;
                const capitalizedName = creatureName.charAt(0).toUpperCase() + creatureName.slice(1).toLowerCase();

                this.game.uiManager.addChatMessage('ai', `🔧 "${capitalizedName}" doesn't exist yet! Creating it now...`);

                // Build the creation request
                const createRequest = `Create a new animal creature called "${capitalizedName}" in the game. Create the file at src/game/entities/animals/${capitalizedName}.js. It should:\n1. Import THREE and Animal base class\n2. Export a class ${capitalizedName} that extends Animal\n3. Have a createBody() method that builds a blocky, voxel-style 3D model using THREE.BoxGeometry and THREE.MeshLambertMaterial\n4. Use appropriate colors for a ${capitalizedName}\n5. Include legs, body, head, and any distinctive features\n\nAfter creating the file, update src/game/AnimalRegistry.js to:\n1. Add an import for ${capitalizedName}\n2. Add it to the exports\n3. Add it to the AnimalClasses object\n4. Add the module path to the HMR animalModules array`;

                // Trigger perform_task to create the creature
                const taskResult = await this.executeTool('perform_task', { request: createRequest });

                return {
                    output: {
                        result: `Creating ${capitalizedName}... This will take a moment. Say "spawn ${capitalizedName.toLowerCase()}" again once the task completes!`,
                        taskStarted: true
                    }
                };
            }

            this.game.uiManager.addChatMessage('ai', `🐾 ${result}`);

            // Report back to CLI (Debug)
            if (this.currentDebugId) {
                const player = this.game.player;
                // Calculate spawn pos (roughly in front)
                const dir = new THREE.Vector3();
                this.game.camera.getWorldDirection(dir);
                const spawnPos = {
                    x: player.position.x + dir.x * 5,
                    y: player.position.y,
                    z: player.position.z + dir.z * 5
                };

                this.game.colyseusManager?.sendDebugResponse({
                    debugId: this.currentDebugId,
                    tool: 'spawn_creature',
                    creature: creature,
                    count: count,
                    result: result,
                    approxSpawnX: spawnPos.x,
                    approxSpawnZ: spawnPos.z
                });
                this.currentDebugId = null;
            }

            return { output: { result } };
        } else if (name === 'get_scene_info') {
            console.log('[Agent] Getting scene info');
            const info = this.getSceneInfo();

            // Report back to CLI (Debug)
            if (this.currentDebugId) {
                this.game.colyseusManager?.sendDebugResponse({
                    debugId: this.currentDebugId,
                    tool: 'get_scene_info',
                    ...info
                });
                this.currentDebugId = null;
            }

            return { output: info };
        }

        return { output: { error: `Unknown tool: ${name}` } };
    }

    async handleToolCall(toolCall) {
        if (toolCall.functionCalls) {
            for (const call of toolCall.functionCalls) {
                const result = await this.executeTool(call.name, call.args);

                // Voice API expects executeTool response in specific format
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({
                        toolResponse: {
                            functionResponses: [{
                                id: call.id,
                                response: result
                            }]
                        }
                    }));
                }
            }
        }
    }

    async pollTaskStatus(taskId, uiTaskId, request) {
        const checkStatus = async () => {
            try {
                const res = await fetch(`/api/god-mode/task/${taskId}`);
                const data = await res.json();

                if (data.status === 'completed') {
                    console.log('[Agent] Task completed, updating UI. uiTaskId:', uiTaskId);
                    this.game.uiManager.updateTask(uiTaskId, 'done', 'Completed');

                    // Check if refresh is needed by examining logs
                    const requiresRefresh = this.checkIfRefreshNeeded(data.logs);

                    // Build completion message
                    let completionMessage = `Task finished: ${request}.`;
                    if (requiresRefresh) {
                        completionMessage += ' Please refresh your browser for changes to take effect.';
                        this.game.uiManager.addChatMessage('ai', `✅ ${completionMessage}`);
                        this.game.uiManager.showRefreshPrompt();
                    } else {
                        completionMessage += ' Changes are now live!';
                        this.game.uiManager.addChatMessage('ai', `✅ ${completionMessage}`);
                    }

                    // Speak the completion message via voice
                    this.speakMessage(completionMessage);

                    this.game.uiManager.updateVoiceStatus(true, 'Listening');
                    return true;
                } else if (data.status === 'failed') {
                    console.log('[Agent] Task failed, updating UI. uiTaskId:', uiTaskId);
                    this.game.uiManager.updateTask(uiTaskId, 'error', 'Failed');
                    const failMessage = `Task failed: ${data.error}`;
                    this.game.uiManager.addChatMessage('system', `❌ ${failMessage}`);

                    // Speak the failure message
                    this.speakMessage(`Sorry, the task failed. ${data.error}`);

                    this.game.uiManager.updateVoiceStatus(true, 'Listening');
                    return true;
                }
                return false;
            } catch (e) {
                console.error('[Agent] Polling error:', e);
                return false;
            }
        };

        const poll = async () => {
            const isDone = await checkStatus();
            if (!isDone) {
                setTimeout(poll, TASK_POLL_INTERVAL);
            }
        };

        poll();
    }

    /**
     * Check if a browser refresh is needed based on task logs
     * HMR handles most changes, but some require full refresh
     */
    checkIfRefreshNeeded(logs) {
        if (!logs) return false;

        // Patterns that indicate a full refresh is required
        const refreshPatterns = [
            /full reload/i,
            /page reload/i,
            /hmr.*failed/i,
            /cannot.*update/i,
            /restart.*required/i,
            /refresh.*browser/i,
            /\.html.*changed/i,
            /index\.html/i,
            /vite\.config/i,
            /tailwind\.config/i,
            /package\.json.*changed/i,
        ];

        // Patterns that indicate HMR succeeded (no refresh needed)
        const hmrSuccessPatterns = [
            /\[vite\].*hot updated/i,
            /hmr.*update/i,
            /\[hmr\].*updated/i
        ];

        // Check for explicit refresh requirements
        for (const pattern of refreshPatterns) {
            if (pattern.test(logs)) {
                return true;
            }
        }

        // If we see HMR success, no refresh needed
        for (const pattern of hmrSuccessPatterns) {
            if (pattern.test(logs)) {
                return false;
            }
        }

        // Default: assume HMR worked if we edited JS/CSS files
        return false;
    }

    /**
     * Speak a message via text-to-speech (only when voice is actively connected)
     */
    speakMessage(message) {
        // Only speak if voice mode is actively connected
        if (!this.isConnected || !this.isListening) {
            return; // Voice is off, don't speak anything
        }

        // If WebSocket is connected, send text for Gemini to speak
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Send a client turn with text to prompt voice response
            const transform = this.getPlayerTransform();
            this.ws.send(JSON.stringify({
                clientContent: {
                    turns: [{
                        role: "user",
                        parts: [{ text: `[SYSTEM NOTIFICATION - Speak this naturally to the user]: ${message}` }]
                    }],
                    turnComplete: true
                }
            }));
        }
    }

    /**
     * Inject a text prompt (for debugging/CLI)
     * Uses sendTextMessage which handles both voice-connected and text-only modes
     */
    async injectPrompt(text, debugId = null) {
        console.log(`[Agent] Injecting prompt: "${text}"`);
        this.currentDebugId = debugId;

        // Use the same path as the UI send button
        await this.sendTextMessage(text);

        // If we're connected via voice, the response will come back via WebSocket handlers
        // If not connected, sendTextMessage uses REST API and we need to handle the response differently
        // For CLI, the debugResponse is sent from handleToolCall when tools are executed
    }

    /**
     * Teleport player to a named location or coordinates
     */
    teleportPlayer(location) {
        const player = this.game.player;
        const worldGen = this.game.worldGen;

        // Parse coordinates if provided (format: "x, y, z" or "x y z" or "x z")
        const coordMatch = location.match(/(-?\d+)[,\s]+(-?\d+)?[,\s]*(-?\d+)?/);
        if (coordMatch) {
            const x = parseInt(coordMatch[1]);
            // Handle both "x y z" and "x z" formats
            let y, z;
            if (coordMatch[3]) {
                y = parseInt(coordMatch[2]);
                z = parseInt(coordMatch[3]);
            } else if (coordMatch[2]) {
                z = parseInt(coordMatch[2]);
                y = worldGen.getTerrainHeight(x, z) + 2;
            } else {
                z = x;
                y = worldGen.getTerrainHeight(x, z) + 2;
            }
            player.position.set(x, y, z);
            return `Teleported to coordinates (${x}, ${Math.floor(y)}, ${z})`;
        }

        // Named locations
        const loc = location.toLowerCase().trim();
        if (loc === 'spawn' || loc === 'home' || loc === 'start') {
            const y = worldGen.getTerrainHeight(32, 32) + 2;
            player.position.set(32, y, 32);
            return 'Teleported to spawn point';
        }

        // Search for biome
        const targetBiome = BIOME_ALIASES[loc];
        if (targetBiome) {
            // Search in expanding circles from player position
            const angleStep = (Math.PI * 2) / 16;
            for (let radius = BIOME_SEARCH_STEP; radius <= BIOME_SEARCH_MAX_RADIUS; radius += BIOME_SEARCH_STEP) {
                for (let angle = 0; angle < Math.PI * 2; angle += angleStep) {
                    const x = Math.floor(player.position.x + Math.cos(angle) * radius);
                    const z = Math.floor(player.position.z + Math.sin(angle) * radius);
                    const y = worldGen.getTerrainHeight(x, z);
                    const biome = this.game.biomeManager.getBiome(x, z, y);
                    if (biome === targetBiome) {
                        player.position.set(x, y + 2, z);
                        return `Teleported to ${loc} biome at (${x}, ${Math.floor(y + 2)}, ${z})`;
                    }
                }
            }
            return `Could not find ${loc} biome within ${BIOME_SEARCH_MAX_RADIUS} blocks`;
        }

        return `Unknown location: "${location}". Try 'spawn', 'desert', 'forest', 'ocean', 'mountain', 'jungle', 'snow', or coordinates like "100, 50, 200".`;
    }

    /**
     * Spawn creatures near the player
     */
    spawnCreature(creatureName, count = 1) {
        // Check aliases first
        const lower = creatureName.toLowerCase();
        if (CREATURE_ALIASES[lower]) {
            creatureName = CREATURE_ALIASES[lower];
        }

        // Try exact match first
        let CreatureClass = AnimalClasses[creatureName];

        // Try case-insensitive match
        if (!CreatureClass) {
            const normalized = creatureName.charAt(0).toUpperCase() + creatureName.slice(1).toLowerCase();
            CreatureClass = AnimalClasses[normalized];
        }

        // Try finding partial match
        if (!CreatureClass) {
            const lowerName = creatureName.toLowerCase();
            for (const [name, cls] of Object.entries(AnimalClasses)) {
                if (name.toLowerCase().includes(lowerName) || lowerName.includes(name.toLowerCase())) {
                    CreatureClass = cls;
                    break;
                }
            }
        }

        if (!CreatureClass) {
            // Return structured object so executeTool can trigger auto-creation
            return {
                status: 'not_found',
                creature: creatureName,
                available: Object.keys(AnimalClasses).slice(0, 15)
            };
        }

        // Use SpawnManager to spawn in front of player
        this.game.spawnManager.spawnEntitiesInFrontOfPlayer(CreatureClass, count);
        const plural = count > 1 ? 's' : '';
        return `Spawned ${count} ${CreatureClass.name}${plural} in front of you!`;
    }

    /**
     * Get information about the player's current environment
     */
    getSceneInfo() {
        const player = this.game.player;
        const pos = player.position;
        const worldGen = this.game.worldGen;

        // Safe terrain/biome lookup
        let terrainHeight = 0;
        let biome = 'unknown';
        if (worldGen) {
            terrainHeight = worldGen.getTerrainHeight(pos.x, pos.z);
            biome = worldGen.getBiome ? worldGen.getBiome(pos.x, pos.z) : 'unknown';
        }

        // Check what the player is looking at
        let lookingAt = "nothing in particular";
        if (this.game.physicsManager) {
            const targetBlock = this.game.physicsManager.getTargetBlock();
            const targetAnimal = this.game.physicsManager.getHitAnimal();

            if (targetAnimal) {
                lookingAt = `a ${targetAnimal.constructor.name} (Entity)`;
            } else if (targetBlock) {
                const blockType = this.game.getBlockWorld(targetBlock.x, targetBlock.y, targetBlock.z);
                const dist = player.position.distanceTo(new THREE.Vector3(targetBlock.x, targetBlock.y, targetBlock.z));
                lookingAt = `a ${blockType} block at [${targetBlock.x}, ${targetBlock.y}, ${targetBlock.z}], distance: ${dist.toFixed(1)}m`;
            }
        }

        // Count nearby creatures
        const nearbyCreatures = {};
        const animals = this.game.animals || [];
        console.log(`[Agent] Checking ${animals.length} animals for scene info`);

        for (const animal of animals) {
            if (animal.mesh) {
                const dist = animal.mesh.position.distanceTo(pos);
                if (dist < CREATURE_DETECTION_RADIUS) {
                    const name = animal.constructor.name;
                    nearbyCreatures[name] = (nearbyCreatures[name] || 0) + 1;
                }
            }
        }

        // Format nearby creatures as string
        const creaturesStr = Object.entries(nearbyCreatures)
            .map(([name, count]) => `${count} ${name}${count > 1 ? 's' : ''}`)
            .join(', ') || 'none';

        console.log('[Agent] Found creatures:', creaturesStr);

        return {
            position: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) },
            orientation: { pitch: player.rotation.x.toFixed(2), yaw: player.rotation.y.toFixed(2) },
            lookingAt: lookingAt,
            biome: biome,
            altitude: Math.floor(pos.y - terrainHeight),
            aboveGround: pos.y > terrainHeight,
            health: Math.floor(player.health || 100),
            maxHealth: player.maxHealth || 100,
            hunger: Math.floor(player.hunger || 100),
            isFlying: player.isFlying || false,
            nearbyCreatures: creaturesStr,
            nearbyCreatureCount: Object.values(nearbyCreatures).reduce((a, b) => a + b, 0)
        };
    }

    queueAudio(base64Data) {
        const binaryString = window.atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

        let buffer = bytes.buffer;
        if (buffer.byteLength % 2 !== 0) buffer = buffer.slice(0, buffer.byteLength - 1);

        const int16 = new Int16Array(buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

        this.audioQueue.push(float32);
        if (!this.isPlaying) this.playNextBuffer();
    }

    playNextBuffer() {
        if (this.audioQueue.length === 0) {
            this.isPlaying = false;
            return;
        }
        this.isPlaying = true;

        const audioData = this.audioQueue.shift();

        if (!this.outputContext) {
            this.isPlaying = false;
            return;
        }

        const audioBuffer = this.outputContext.createBuffer(1, audioData.length, AUDIO_SAMPLE_RATE_OUTPUT);
        audioBuffer.getChannelData(0).set(audioData);

        const source = this.outputContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputContext.destination);
        source.onended = () => this.playNextBuffer();
        source.start();
    }

    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return window.btoa(binary);
    }

    // Updated toggleChat to handle the new side panel
    toggleChat() {
        this.isChatOpen = !this.isChatOpen;
        this.game.uiManager.toggleChatPanel(this.isChatOpen);

        // Focus chat input when opening the chat
        if (this.isChatOpen) {
            this.game.uiManager.focusChatInput();
        }
    }

    async sendTextMessage(text) {
        if (!text) return;

        // Add to UI immediately
        this.game.uiManager.addChatMessage('user', text);

        // Send to Gemini if connected
        if (this.isConnected && this.ws) {
            const transform = this.getPlayerTransform();
            // Add to shared history and trim
            this.conversationHistory.push({ role: 'user', text: text });
            this.trimConversationHistory();

            this.ws.send(JSON.stringify({
                realtimeInput: {
                    mediaChunks: [], // Empty for text-only
                },
                clientContent: {
                    turns: [{
                        role: "user",
                        parts: [{
                            text: `[PLAYER CONTEXT - Position: x=${transform.position.x.toFixed(2)}, y=${transform.position.y.toFixed(2)}, z=${transform.position.z.toFixed(2)}, Orientation: pitch=${transform.rotation.x.toFixed(2)}, yaw=${transform.rotation.y.toFixed(2)}]\n${text}`
                        }]
                    }]
                }
            }));
        } else {
            // Text Mode (Local GenAI SDK)
            // Track the "Thinking..." message ID so we can remove it
            const thinkingMsgId = this.game.uiManager.addChatMessage('ai', `Thinking...`);

            try {
                await this.initializeTextClient();

                if (!this.genAI || !this.textModel) {
                    throw new Error("AI Client failed to initialize");
                }

                // Initialize chat session with shared history
                if (!this.chatSession || this.chatSessionHistoryLength !== this.conversationHistory.length) {
                    // Convert shared history to SDK format
                    const sdkHistory = this.conversationHistory.map(msg => ({
                        role: msg.role,
                        parts: [{ text: msg.text }]
                    }));
                    this.chatSession = this.textModel.startChat({
                        history: sdkHistory
                    });
                    this.chatSessionHistoryLength = this.conversationHistory.length;
                }

                // Add user message to shared history and trim
                this.conversationHistory.push({ role: 'user', text: text });
                this.trimConversationHistory();

                // Prepare message with context
                const transform = this.getPlayerTransform();
                const contextMsg = `[PLAYER CONTEXT - Position: x=${transform.position.x.toFixed(2)}, y=${transform.position.y.toFixed(2)}, z=${transform.position.z.toFixed(2)}, Orientation: pitch=${transform.rotation.x.toFixed(2)}, yaw=${transform.rotation.y.toFixed(2)}]\n${text}`;

                let result = await this.chatSession.sendMessage(contextMsg);
                let response = result.response;

                // Handle tool calls loop
                let turns = 0;
                while (turns < MAX_TOOL_CALL_TURNS) {
                    const functionCalls = response.functionCalls();
                    if (functionCalls && functionCalls.length > 0) {
                        const functionResponses = [];
                        for (const call of functionCalls) {
                            const executionResult = await this.executeTool(call.name, call.args);
                            functionResponses.push({
                                functionResponse: {
                                    name: call.name,
                                    response: executionResult.output
                                }
                            });
                        }
                        // Send function responses back
                        result = await this.chatSession.sendMessage(functionResponses);
                        response = result.response;
                        turns++;
                    } else {
                        break;
                    }
                }

                // Remove the "Thinking..." message
                this.game.uiManager.removeChatMessage?.(thinkingMsgId);

                const responseText = response.text();
                if (responseText) {
                    this.game.uiManager.addChatMessage('ai', responseText);
                    // Add to shared history and trim
                    this.conversationHistory.push({ role: 'model', text: responseText });
                    this.trimConversationHistory();
                } else {
                    this.game.uiManager.addChatMessage('system', 'AI returned no text.');
                }

                // Notify CLI of completion
                if (this.currentDebugId) {
                    this.game.colyseusManager?.sendDebugResponse({
                        debugId: this.currentDebugId,
                        message: responseText || "Command executed"
                    });
                    this.currentDebugId = null;
                }

            } catch (e) {
                console.error('[Agent] Text chat error:', e);
                // Remove the "Thinking..." message
                this.game.uiManager.removeChatMessage?.(thinkingMsgId);
                this.game.uiManager.addChatMessage('system', `Error: ${e.message}`);

                // Report error back to CLI
                if (this.currentDebugId) {
                    this.game.colyseusManager?.sendDebugResponse({
                        debugId: this.currentDebugId,
                        error: e.message
                    });
                    this.currentDebugId = null;
                }
            }
        }
    }

    update(time, player) {
        this.time += 0.05;
        this.mesh.position.y = this.position.y + Math.sin(this.time) * 0.2;
        this.ring.rotation.z += 0.02;
        this.ring.rotation.x = (Math.PI / 2) + Math.sin(this.time * 0.5) * 0.2;
        this.mesh.lookAt(player.position.x, player.position.y, player.position.z);
    }
}
