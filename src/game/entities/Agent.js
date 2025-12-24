
import * as THREE from 'three';
import { AnimalClasses } from '../AnimalRegistry.js';

// ============================================================================
// Audio Worklet Processor Source (inline as string for blob URL)
// ============================================================================
const AudioRecordingWorkletSrc = `
class AudioRecordingProcessor extends AudioWorkletProcessor {
  buffer = new Int16Array(2048);
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
        this.isTypingMode = false; // When true, keyboard goes to chat input. Tab toggles this.
        this.chatHistory = [];

        // Voice Chat State
        this.ws = null;
        this.inputContext = null;
        this.outputContext = null;
        this.mediaStream = null;
        this.workletNode = null;

        // Audio Playback Queue
        this.audioQueue = [];
        this.isPlaying = false;

        // Create minimal status indicator
        this.game.uiManager.updateVoiceStatus(false, 'Voice Off (V)');

        // Voice is OFF by default - press V to toggle
        this.setupKeyboardToggle();
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

        this.game.uiManager.updateVoiceStatus(false, 'Voice Off (V)');
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

    // UI methods moved to UIManager

    // Task UI methods moved to UIManager

    async connectVoice() {
        try {
            this.game.uiManager.updateVoiceStatus(false, 'Fetching Config...');
            const configReq = await fetch('/api/god-mode/config');
            const config = await configReq.json();
            if (!config.apiKey) throw new Error('No API Key');

            this.game.uiManager.updateVoiceStatus(false, 'Setting up Audio...');

            // Input context at 16kHz for recording
            this.inputContext = new AudioContext({ sampleRate: 16000 });
            await this.inputContext.resume();

            // Output context at 24kHz for playback
            this.outputContext = new AudioContext({ sampleRate: 24000 });
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
            const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${config.apiKey}`;
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.isConnected = true;
                this.isListening = true;
                this.game.uiManager.updateVoiceStatus(true, 'Listening');

                // Send setup with function calling for code modification
                this.ws.send(JSON.stringify({
                    setup: {
                        model: "models/gemini-2.0-flash-exp",
                        generationConfig: { responseModalities: ["AUDIO"] },
                        systemInstruction: {
                            parts: [{
                                text: `You are an AI assistant inside a Minecraft-like voxel game. 
You help the player by modifying the game's code in real-time.
When the player asks you to change something about the game (like jump height, speed, colors, etc.), 
you MUST use the perform_task function to make the change.
Do NOT just describe how you would do it; you MUST call the tool.
When the user asks for ideas or help, use provide_suggestions to give them clickable options.

You also have INSTANT-ACTION tools that execute immediately without coding:
- teleport_player: Move the player to named locations (desert, ocean, forest, jungle, mountain, snow, spawn) or specific coordinates
- spawn_creature: Spawn creatures near the player (Pig, Wolf, Zombie, Unicorn, TRex, Dragon, Penguin, etc.)
- get_scene_info: Get info about player's location, biome, nearby creatures, health, etc.

Use these instant tools when the player wants immediate actions like "take me to the desert" or "spawn 3 wolves" or "where am I?"

PERSONALITY:
 You are extremely funny, witty, and sarcastic. You love making voxel-related puns.
 You should crack jokes about the player's building skills (in a lighthearted way) or the blocky nature of the world.
 Be energetic and entertaining. Don't be a boring robot.
 
IMPORTANT: When a task is started, do NOT claim it is "done" or "complete" until you receive a [SYSTEM NOTIFICATION] confirming completion. If the user asks about task status before you receive this notification, say "I'm still working on it" or "The task is still in progress." Only announce completion when the system tells you the task finished.`
                            }]
                        },
                        tools: [{
                            functionDeclarations: [{
                                name: "perform_task",
                                description: "Modifies the game code based on the user's request. Use this when the player wants to change game mechanics, physics, visuals, or any other aspect of the game.",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        request: {
                                            type: "string",
                                            description: "A clear description of what code change the user wants, e.g. 'Make the player jump twice as high' or 'Change the sky color to purple'"
                                        }
                                    },
                                    required: ["request"]
                                }
                            }, {
                                name: "provide_suggestions",
                                description: "Provides a list of suggested follow-up actions or questions for the user to click. Use this to help the user discover what they can do.",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        suggestions: {
                                            type: "array",
                                            items: { type: "string" },
                                            description: "List of short suggestion strings, e.g. ['Fly', 'Give me a diamond sword', 'Spawn a sheep']"
                                        }
                                    },
                                    required: ["suggestions"]
                                }
                            }, {
                                name: "teleport_player",
                                description: "Teleport the player to a new location INSTANTLY. Supports named locations (spawn, ocean, desert, forest, jungle, mountain, snow) or specific coordinates.",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        location: {
                                            type: "string",
                                            description: "Named location like 'spawn', 'desert', 'ocean', 'forest', 'jungle', 'mountain', 'snow' OR coordinates like '100, 50, 200'"
                                        }
                                    },
                                    required: ["location"]
                                }
                            }, {
                                name: "spawn_creature",
                                description: "Spawn a creature near the player INSTANTLY. Available: Pig, Horse, Chicken, Bunny, Wolf, Bear, Lion, Tiger, Elephant, Giraffe, Deer, Sheep, Cow, Zombie, Skeleton, Creeper, Enderman, Unicorn, TRex, Owl, Fox, Panda, Dolphin, Penguin, Dragon, Snowman, SantaClaus, and more.",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        creature: {
                                            type: "string",
                                            description: "Name of creature to spawn (e.g. 'Pig', 'Wolf', 'Zombie', 'Unicorn', 'TRex')"
                                        },
                                        count: {
                                            type: "integer",
                                            description: "Number of creatures to spawn (1-10, default 1)"
                                        }
                                    },
                                    required: ["creature"]
                                }
                            }, {
                                name: "get_scene_info",
                                description: "Get information about the player's current environment including position, biome, nearby creatures, time of day, health, and surroundings. Use this when player asks 'where am I?' or 'what's around me?'",
                                parameters: {
                                    type: "object",
                                    properties: {},
                                    required: []
                                }
                            }]
                        }]
                    }
                }));

                // Start sending audio
                this.workletNode.port.onmessage = (ev) => {
                    if (!this.isConnected) return;
                    const arrayBuffer = ev.data.int16arrayBuffer;
                    if (arrayBuffer) {
                        const base64Audio = this.arrayBufferToBase64(arrayBuffer);
                        this.ws.send(JSON.stringify({
                            realtimeInput: {
                                mediaChunks: [{ mimeType: "audio/pcm", data: base64Audio }]
                            }
                        }));
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
                    console.log('[Agent] Tool call received:', msg.toolCall);
                    await this.handleToolCall(msg.toolCall);
                    return;
                }

                // Handle audio response
                if (msg.serverContent?.modelTurn?.parts) {
                    for (const part of msg.serverContent.modelTurn.parts) {
                        if (part.inlineData?.data) {
                            this.queueAudio(part.inlineData.data);
                        }
                        if (part.text) {
                            console.log('[Agent] Text response:', part.text);
                            this.game.uiManager.addChatMessage('ai', part.text);
                        }
                    }
                }
                if (msg.serverContent?.interrupted) {
                    this.audioQueue = [];
                }
            };

            this.ws.onerror = (e) => {
                console.error("WebSocket Error:", e);
                this.game.uiManager.updateVoiceStatus(false, 'Error');
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                this.isListening = false;
                this.game.uiManager.updateVoiceStatus(false, 'Voice Off (V)');
                // No auto-reconnect - user can press V to reconnect
            };

        } catch (e) {
            console.error("Voice Connect Error:", e);
            this.game.uiManager.updateVoiceStatus(false, 'Error: ' + e.message);
        }
    }

    async handleToolCall(toolCall) {
        if (toolCall.functionCalls) {
            for (const call of toolCall.functionCalls) {
                if (call.name === 'perform_task') {
                    const request = call.args?.request;
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

                            // Send tool response back to Gemini (acknowledge start)
                            this.ws.send(JSON.stringify({
                                toolResponse: {
                                    functionResponses: [{
                                        id: call.id,
                                        response: { output: `Task started with ID: ${data.taskId}` }
                                    }]
                                }
                            }));
                        } else {
                            throw new Error(data.error || 'Failed to start task');
                        }
                    } catch (e) {
                        console.error('[Agent] Tool call error:', e);
                        this.game.uiManager.addChatMessage('system', `Task error: ${e.message}`);
                        this.game.uiManager.updateVoiceStatus(true, 'Listening');
                    }
                } else if (call.name === 'provide_suggestions') {
                    const suggestions = call.args?.suggestions;
                    console.log('[Agent] Received suggestions:', suggestions);
                    if (suggestions && Array.isArray(suggestions)) {
                        this.game.uiManager.showSuggestions(suggestions);
                    }

                    // Respond to tool call
                    this.ws.send(JSON.stringify({
                        toolResponse: {
                            functionResponses: [{
                                id: call.id,
                                response: { output: `Suggestions displayed to user: ${suggestions.join(', ')}` }
                            }]
                        }
                    }));
                } else if (call.name === 'teleport_player') {
                    const location = call.args?.location;
                    console.log('[Agent] Teleporting player to:', location);
                    const result = this.teleportPlayer(location);
                    this.game.uiManager.addChatMessage('ai', `🌍 ${result}`);

                    this.ws.send(JSON.stringify({
                        toolResponse: {
                            functionResponses: [{
                                id: call.id,
                                response: { output: result }
                            }]
                        }
                    }));
                } else if (call.name === 'spawn_creature') {
                    const creature = call.args?.creature;
                    const count = Math.min(10, Math.max(1, call.args?.count || 1));
                    console.log('[Agent] Spawning creature:', creature, 'x', count);
                    const result = this.spawnCreature(creature, count);
                    this.game.uiManager.addChatMessage('ai', `🐾 ${result}`);

                    this.ws.send(JSON.stringify({
                        toolResponse: {
                            functionResponses: [{
                                id: call.id,
                                response: { output: result }
                            }]
                        }
                    }));
                } else if (call.name === 'get_scene_info') {
                    console.log('[Agent] Getting scene info');
                    const info = this.getSceneInfo();

                    this.ws.send(JSON.stringify({
                        toolResponse: {
                            functionResponses: [{
                                id: call.id,
                                response: { output: JSON.stringify(info) }
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
                setTimeout(poll, 2000);
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
     * Speak a message via text-to-speech (uses browser TTS or WebSocket if connected)
     */
    speakMessage(message) {
        // If WebSocket is connected, send text for Gemini to speak
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Send a client turn with text to prompt voice response
            this.ws.send(JSON.stringify({
                clientContent: {
                    turns: [{
                        role: "user",
                        parts: [{ text: `[SYSTEM NOTIFICATION - Speak this to the user]: ${message}` }]
                    }],
                    turnComplete: true
                }
            }));
        } else {
            // Fallback to browser's built-in text-to-speech
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(message);
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                utterance.volume = 0.8;
                window.speechSynthesis.speak(utterance);
            }
        }
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
        const biomeMap = {
            'desert': 'DESERT',
            'dessert': 'DESERT', // Common typo
            'ocean': 'OCEAN',
            'sea': 'OCEAN',
            'water': 'OCEAN',
            'forest': 'FOREST',
            'woods': 'FOREST',
            'jungle': 'JUNGLE',
            'mountain': 'MOUNTAIN',
            'mountains': 'MOUNTAIN',
            'peak': 'MOUNTAIN',
            'snow': 'SNOW',
            'snowy': 'SNOW',
            'tundra': 'SNOW',
            'arctic': 'SNOW',
            'plains': 'PLAINS',
            'grassland': 'PLAINS'
        };

        const targetBiome = biomeMap[loc];
        if (targetBiome) {
            // Search in expanding circles from player position
            // Increased range to 2000 blocks to ensure we find it
            for (let radius = 50; radius <= 2000; radius += 50) {
                for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
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
            return `Could not find ${loc} biome within 2000 blocks`;
        }

        return `Unknown location: "${location}". Try 'spawn', 'desert', 'forest', 'ocean', 'mountain', 'jungle', 'snow', or coordinates like "100, 50, 200".`;
    }

    /**
     * Spawn creatures near the player
     */
    spawnCreature(creatureName, count = 1) {
        // AnimalClasses imported at top of file

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
            const available = Object.keys(AnimalClasses).slice(0, 15).join(', ');
            return `Unknown creature "${creatureName}". Try: ${available}...`;
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
        const terrainHeight = this.game.worldGen.getTerrainHeight(pos.x, pos.z);
        const biome = this.game.biomeManager.getBiome(pos.x, pos.z, terrainHeight);

        // Count nearby creatures
        const nearbyCreatures = {};
        const animals = this.game.animals || [];
        console.log(`[Agent] Checking ${animals.length} animals for scene info`);

        for (const animal of animals) {
            if (animal.mesh) {
                const dist = animal.mesh.position.distanceTo(pos);
                if (dist < 150) { // Increased from 50 to 150
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
        const audioBuffer = this.outputContext.createBuffer(1, audioData.length, 24000);
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
            this.ws.send(JSON.stringify({
                realtimeInput: {
                    mediaChunks: [], // Empty for text-only
                },
                clientContent: {
                    turns: [{
                        role: "user",
                        parts: [{ text: text }]
                    }]
                }
            }));
        } else {
            // Use REST API if not connected via WebSocket
            this.game.uiManager.addChatMessage('ai', `Starting request: ${text}`);

            try {
                const res = await fetch('/api/god-mode/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text })
                });
                const data = await res.json();

                if (data.success && data.taskId) {
                    // Create UI task with backend ID so Logs button works
                    const uiTaskId = this.game.uiManager.addTask(text, data.taskId);
                    this.pollTaskStatus(data.taskId, uiTaskId, text);
                } else {
                    this.game.uiManager.addChatMessage('system', `Error: ${data.error || 'Unknown error'}`);
                }
            } catch (e) {
                console.error('[Agent] REST chat error:', e);
                this.game.uiManager.addChatMessage('system', `Failed to send message: ${e.message}`);
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
