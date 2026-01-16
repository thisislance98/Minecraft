
import * as THREE from 'three';

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
Be friendly and conversational. Confirm what you're doing before making changes.`
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
                    this.game.uiManager.updateTask(uiTaskId, 'done', 'Completed');
                    this.game.uiManager.addChatMessage('ai', `Task finished: ${request}. ${data.message}`);
                    this.game.uiManager.updateVoiceStatus(true, 'Listening');
                    return true;
                } else if (data.status === 'failed') {
                    this.game.uiManager.updateTask(uiTaskId, 'error', 'Failed');
                    this.game.uiManager.addChatMessage('system', `Task failed: ${data.error}`);
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

        if (this.isChatOpen) {
            this.game.inputManager.unlock();
        } else {
            // Only re-lock if we were previously locked or user clicks back
            // InputManager handles the click-to-lock logic
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
