
import * as THREE from 'three';
import { Config } from '../core/Config.js';
import { AnimalClasses } from '../AnimalRegistry.js';
import {
    CREATURE_DETECTION_RADIUS,
    BIOME_SEARCH_MAX_RADIUS,
    BIOME_SEARCH_STEP,
    BIOME_ALIASES,
    CREATURE_ALIASES,
    MAX_SPAWN_COUNT
} from '../constants.js';

export class Agent {
    constructor(game) {
        console.log('[Agent] INIT v2 - set_blocks tool available');
        this.game = game;
        this.position = new THREE.Vector3(35, 20, 35);
        this.time = 0;
        this.createMesh();

        // UI State
        this.currentTaskUIId = null;
        this.currentStreamMsgId = null;
        this.lastToolMsgId = null;
        this.isChatOpen = false;
        this.isStreaming = false;

        // Context state for AI
        this.agentContext = {
            lastSpawnedIds: []
        };

        // Connection (Delegate to global client)
        if (window.merlinClient) {
            this.unsubscribe = window.merlinClient.addListener(this.handleClientMessage.bind(this));

            // Race condition check: If client is ALREADY connected when we attach, trigger init
            if (window.merlinClient.isConnected) {
                console.log('[Agent] Client already connected, triggering persona init...');
                // Small delay to ensure UI systems are fully ready
                setTimeout(() => this.initializePersona(), 100);
            }
        }

        // Voice Toggles (Legacy/Placeholder)

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



    update(time, player) {
        this.time += 0.05;
        this.mesh.position.y = this.position.y + Math.sin(this.time) * 0.2;
        this.ring.rotation.z += 0.02;
        this.ring.rotation.x = (Math.PI / 2) + Math.sin(this.time * 0.5) * 0.2;
        this.mesh.lookAt(player.position.x, player.position.y, player.position.z);
    }

    toggleChat() {
        this.isChatOpen = !this.isChatOpen;
        this.game.uiManager.toggleChatPanel(this.isChatOpen);
        if (this.isChatOpen) {
            this.game.uiManager.focusChatInput();
        }
    }

    // =========================================================================
    // MERLIN CLIENT LOGIC (Shims to Window Client)
    // =========================================================================

    sendTextMessage(text, context = {}) {
        this._sendToMerlin(text, context, true);
    }

    sendHiddenMessage(text, context = {}) {
        this._sendToMerlin(text, context, false);
    }

    _sendToMerlin(text, context = {}, showInChat = true) {
        if (!window.merlinClient) {
            if (showInChat) this.game.uiManager.addChatMessage('error', 'Agent not initialized. Try refreshing the page.');
            return;
        }

        if (!window.merlinClient.isConnected) {
            if (showInChat) this.game.uiManager.addChatMessage('error', 'Agent disconnected. Check your internet connection or server status.');
            return;
        }

        window.merlinClient.send({
            type: 'input',
            text: text,
            context: {
                ...this.agentContext,
                ...context,
                position: this.game.player ? this.game.player.position : null,
                rotation: (this.game.player && this.game.player.mesh) ? this.game.player.mesh.rotation : null,
                scene: this.getSceneInfo(),
                worldId: this.game.socketManager?.worldId || 'global'
            }
        });

        if (showInChat) {
            this.game.uiManager.addChatMessage('user', text);
            this.game.uiManager.showThinking();
            // UI Updates
            this.currentStreamMsgId = null;
            this.game.uiManager.toggleStopButton(true);
        }
    }

    requestIdea() {
        const scene = this.getSceneInfo();
        const biome = scene.biome || 'unknown';

        // Construct a prompt that guides the AI
        const prompt = `Based on my current location (biome: ${biome}) and nearby creatures, suggest a fun, creative building idea or activity.`;

        // Use sendTextMessage but maybe with a flag to show differently? 
        // For now, just sending as a user message is clearest.
        this.sendTextMessage(prompt, { isIdeaRequest: true });
    }

    interruptGeneration() {
        if (window.merlinClient) {
            window.merlinClient.send({ type: 'interrupt' });
        }

        console.log('[Agent] Interrupting generation...');
        this.game.uiManager.hideThinking();
        this.game.uiManager.addChatMessage('system', 'Generation stopped by user.');
        this.game.uiManager.toggleStopButton(false);
        this.isStreaming = false;
    }

    updateConfig(config) {
        if (window.merlinClient) {
            console.log('[Agent] Sending config update:', config);
            window.merlinClient.send({ type: 'config', config });
        }
    }

    handleClientMessage(msg) {
        // Intercept status messages to trigger persona init
        if (msg.type === 'status' && msg.status === 'connected') {
            this.initializePersona();
        }
        this.handleServerMessage(msg);
    }

    initializePersona() {
        const hasMetMerlin = localStorage.getItem('hasMetMerlin');
        const tutorialComplete = localStorage.getItem('merlinTutorialComplete');

        // Tutorial steps: 0=Not started, 1=Waiting for Wolf, 2=Waiting for Build, 3=Exploration Tips, 4=Complete
        if (tutorialComplete) {
            this.tutorialStep = 4;
        } else if (hasMetMerlin) {
            // Returning player who hasn't finished tutorial - resume at step 2
            this.tutorialStep = 2;
        } else {
            this.tutorialStep = 0;
        }

        // Define the persona prompt
        const personaPrompt = `
SYSTEM INSTRUCTION: PERSONA UPDATE
You are Merlin, a wise and powerful wizard in this Minecraft-like world.

PERSONALITY:
- BE VERY CONCISE: Keep responses to 1-2 sentences max
- Warm but brief - no lengthy explanations
- Use short magical phrases ("Done!", "Conjured!", "As you wish!")
- Skip theatrics unless celebrating a milestone

CAPABILITIES:
- Create anything using 'set_blocks' (just do it, don't over-explain)
- Summon creatures using 'spawn_creature' (just do it, don't over-explain)
- Act first, explain only if asked

RESPONSE STYLE:
- Maximum 30 words per response unless user asks for details
- No preamble - get straight to action
- After actions: confirm briefly ("Spawned 3 wolves nearby!")
        `.trim();

        // Greeting disabled by default - skip tutorial intro
        if (false && !hasMetMerlin) {
            console.log('[Agent] First time meeting Merlin. Starting tutorial...');
            this.tutorialStep = 1; // Waiting for Wolf
            this.tutorialStartPos = this.game.player?.position?.clone();

            const introInstruction = `
First meeting! Introduce yourself briefly as Merlin. Tell them to try: "spawn a wolf"
Max 25 words total.
            `.trim();

            this.sendHiddenMessage(personaPrompt + "\n\n" + introInstruction);
            localStorage.setItem('hasMetMerlin', 'true');
        } else if (this.tutorialStep === 4 || !hasMetMerlin) {
            console.log('[Agent] Tutorial complete. Sending persona only (no greeting).');
            if (window.merlinClient) window.merlinClient.silenceNextResponse();
            this.sendHiddenMessage(personaPrompt);
        } else {
            console.log('[Agent] Tutorial in progress. Resuming at step', this.tutorialStep);
            this.sendHiddenMessage(personaPrompt);
        }
    }

    // Tool Name Mapping
    getFriendlyToolName(name, args = {}) {
        const formatPath = (p) => {
            if (!p) return '';
            const parts = p.split(/[/\\]/);
            return parts.length > 1 ? parts.slice(-2).join('/') : p;
        };

        const formatCmd = (cmd) => {
            if (!cmd) return '';
            return cmd.length > 20 ? cmd.substring(0, 17) + '...' : cmd;
        }

        switch (name) {
            case 'list_dir':
                return `Looking in ${formatPath(args.DirectoryPath)}`;
            case 'view_file':
                return `Reading ${formatPath(args.AbsolutePath)}`;
            case 'write_to_file':
                return `Writing to ${formatPath(args.TargetFile)}`;
            case 'run_command':
                return `Running: ${formatCmd(args.CommandLine)}`;
            case 'search_web':
                return `Searching for "${args.query}"`;
            case 'codebase_search':
                return `Searching code for "${args.query}"`;
            case 'grep_search':
                return `Grepping for "${args.Query}"`;
            case 'replace_file_content':
                return `Editing ${formatPath(args.TargetFile)}`;
            case 'find_by_name':
                return `Finding file "${args.Pattern}"`;
            case 'read_url_content':
                return `Reading ${args.Url}`;
            case 'view_file_outline':
                return `Scanning ${formatPath(args.AbsolutePath)}`;
            case 'spawn_creature':
                return `Spawning ${args.count || 1} ${args.creature}`;
            case 'teleport_player':
                return `Teleporting to ${args.location}`;
            default:
                const TOOL_FRIENDLY_NAMES = {
                    'read_resource': 'Checking resources',
                    'list_resources': 'Listing resources'
                };
                return TOOL_FRIENDLY_NAMES[name] || `Doing ${name}`;
        }
    }

    async handleServerMessage(msg) {
        console.log('[Agent] Received Server Message:', msg);
        switch (msg.type) {
            case 'token':
                this.game.uiManager.hideThinking();
                this.lastToolMsgId = null; // Reset so next tool batch gets fresh msg
                this.streamToUI(msg.text);

                break;
            case 'thought':
                this.game.uiManager.hideThinking();
                this.streamThoughtToUI(msg.text);
                break;
            case 'tool_start':
                this.game.uiManager.hideThinking();
                // Show tool activity in chat (replace previous tool msg if consecutive)
                const friendyName = this.getFriendlyToolName(msg.name, msg.args);
                if (this.lastToolMsgId) {
                    this.game.uiManager.updateChatMessageContent(this.lastToolMsgId, `🔧 ${friendyName}...`);
                } else {
                    this.lastToolMsgId = this.game.uiManager.addChatMessage('system', `🔧 ${friendyName}...`);
                }
                break;
            case 'tool_end':
                // Tool finished - no separate notification needed
                break;
            case 'tool_request':
                await this.handleToolRequest(msg);
                break;
            case 'error':
                this.game.uiManager.hideThinking();
                this.game.uiManager.addChatMessage('error', msg.message);
                break;
            case 'complete':
                this.game.uiManager.toggleStopButton(false);
                this.isStreaming = false;
                break;
        }
    }

    streamToUI(text) {
        // If we were streaming thoughts, reset the text stream ID so we start a new bubble for the actual answer
        if (this.currentThoughtMsgId) {
            this.currentStreamMsgId = null;
            this.currentThoughtMsgId = null;
        }

        if (!this.currentStreamMsgId) {
            this.currentStreamMsgId = this.game.uiManager.addChatMessage('ai', '');
            this.currentStreamText = '';
        }
        this.currentStreamText += text;
        this.game.uiManager.updateChatMessageContent(this.currentStreamMsgId, this.currentStreamText);
        console.log(`[Chat:AI] ${text}`); // Log chunk for CLI
    }

    streamThoughtToUI(text) {
        if (!this.currentThoughtMsgId) {
            this.currentThoughtMsgId = this.game.uiManager.addChatMessage('thought', '');
            this.currentThoughtText = '';
            // Also reset text stream so if we go back to text it's a new bubble (unlikely in linear flow but good safety)
            this.currentStreamMsgId = null;
        }
        this.currentThoughtText += text;
        this.game.uiManager.updateChatMessageContent(this.currentThoughtMsgId, this.currentThoughtText);
        console.log(`[Chat:Thought] ${text}`); // Log chunk for CLI
    }

    async handleToolRequest(msg) {
        const { id, name, args } = msg;
        let result = {};

        try {
            console.log(`[Agent] Executing Client Tool: ${name}`, args);

            // Force refresh 1
            if (name === 'spawn_creature') {
                result = await this.spawnCreature(args.creature, args.count);
            } else if (name === 'teleport_player') {
                result = this.teleportPlayer(args.location);
            } else if (name === 'get_scene_info') {
                result = this.getSceneInfo();
            } else if (name === 'update_entity') {
                result = this.updateEntity(args);
            } else if (name === 'patch_entity') {
                result = this.patchEntity(args);
            } else if (name === 'set_blocks') {
                result = await this.setBlocks(args.blocks);
            } else if (name === 'run_verification') {
                result = this.runVerification(args);
            } else if (name === 'capture_screenshot') {
                result = this.captureScreenshot(args);
            } else if (name === 'capture_logs') {
                result = await this.captureLogs(args);
            } else {
                throw new Error(`Unknown client tool: ${name}`);
            }
        } catch (e) {
            result = { error: e.message };
        }

        if (window.merlinClient) {
            window.merlinClient.send({
                type: 'tool_response',
                id,
                result
            });
        }

        // Tutorial Progression Logic
        if (this.tutorialStep === 1 && name === 'spawn_creature') {
            const creatureName = (args.creature || '').toLowerCase();
            if (creatureName.includes('wolf') || creatureName.includes('dog')) {
                console.log('[Agent] Tutorial Step 1 Complete! Wolf spawned.');
                this.tutorialStep = 2;
                setTimeout(() => {
                    this.sendHiddenMessage(`
SYSTEM: Wolf spawned! Praise briefly, then suggest: "build me a tower". Max 20 words.
                    `.trim());
                }, 1500);
            }
        } else if (this.tutorialStep === 2 && name === 'set_blocks') {
            const blockCount = args.blocks?.length || 0;
            if (blockCount >= 5) {
                console.log('[Agent] Tutorial Step 2 Complete! Structure built with', blockCount, 'blocks.');
                this.tutorialStep = 3;
                setTimeout(() => {
                    this.sendHiddenMessage(`
SYSTEM: Built ${blockCount} blocks! Congratulate briefly. Tell them they're ready - explore freely! Max 25 words.
                    `.trim());
                    localStorage.setItem('merlinTutorialComplete', 'true');
                    this.tutorialStep = 4;
                }, 1500);
            }
        }
    }

    // =========================================================================
    // GAME ACTIONS (Ported from original Agent.js)
    // =========================================================================

    async setBlocks(blocks) {
        if (!blocks || !Array.isArray(blocks)) {
            return { error: "Invalid blocks argument. Expected array." };
        }

        console.log(`[Agent] Setting ${blocks.length} blocks...`);
        console.log(`[Agent] Full block data:`, JSON.stringify(blocks));
        let count = 0;

        for (const b of blocks) {
            // Basic validation
            if (b.x === undefined || b.y === undefined || b.z === undefined || !b.id) {
                console.log(`[Agent] Skipping invalid block:`, JSON.stringify(b));
                continue;
            }

            console.log(`[Agent] Placing block at (${b.x}, ${b.y}, ${b.z}) with id: ${b.id}`);
            this.game.setBlock(b.x, b.y, b.z, b.id);
            count++;
        }

        console.log(`[Agent] Finished placing ${count} blocks.`);
        return { success: true, message: `Placed ${count} blocks.` };
    }

    teleportPlayer(location) {
        const player = this.game.player;
        const worldGen = this.game.worldGen;

        // Parse coordinates
        const coordMatch = location.match(/(-?\d+)[,\s]+(-?\d+)?[,\s]*(-?\d+)?/);
        if (coordMatch) {
            const x = parseInt(coordMatch[1]);
            let y = coordMatch[2] ? parseInt(coordMatch[2]) : worldGen.getTerrainHeight(x, x) + 2;
            let z = coordMatch[3] ? parseInt(coordMatch[3]) : x; // Default logic

            player.position.set(x, y, z);
            return `Teleported to ${x}, ${y}, ${z}`;
        }

        // Named locations
        const loc = location.toLowerCase().trim();
        if (loc === 'spawn') {
            player.position.set(Config.PLAYER.SPAWN_POINT.x, 20, Config.PLAYER.SPAWN_POINT.z);
            return "Teleported to Spawn";
        }

        return "Teleport failed: Unknown location";
    }

    async spawnCreature(creatureName, count = 1) {
        // Dynamic import to get the latest classes
        const module = await import('../AnimalRegistry.js');
        let AnimalClasses = module.AnimalClasses;

        // Check aliases
        const lower = creatureName.toLowerCase();
        let targetName = CREATURE_ALIASES[lower] || creatureName;

        // Find class (with retry for newly created creatures)
        let CreatureClass = null;
        const maxWaitMs = 3000;  // 3 seconds max wait for newly created creatures
        const pollIntervalMs = 100;
        const startTime = Date.now();

        // Helper to find the class
        const findClass = () => {
            // Re-import to get latest changes
            let found = AnimalClasses[targetName];
            if (!found) {
                // Try case-insensitive match
                const match = Object.keys(AnimalClasses).find(k => k.toLowerCase() === targetName.toLowerCase());
                if (match) found = AnimalClasses[match];
            }
            return found;
        };

        CreatureClass = findClass();

        // If not found, wait for it (handles race condition when creature was just created)
        if (!CreatureClass) {
            console.log(`[Agent] Creature '${creatureName}' not in registry yet, waiting for registration...`);

            while (!CreatureClass && (Date.now() - startTime) < maxWaitMs) {
                await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
                CreatureClass = findClass();
            }

            if (CreatureClass) {
                console.log(`[Agent] Creature '${creatureName}' registered after ${Date.now() - startTime}ms`);
            }
        }

        if (!CreatureClass) {
            // In the "Antigravity" model, we expect the SERVER to handle "not found" by creating the file
            // So we return an error here, and the server brain should catch it and trigger a 'write_to_file' task!
            return { error: `Creature '${creatureName}' class not found in registry after waiting ${maxWaitMs}ms.` };
        }

        const spawnResult = this.game.spawnManager.spawnEntitiesInFrontOfPlayer(CreatureClass, count);

        // Track spawned IDs for context
        if (spawnResult && spawnResult.length > 0) {
            // Keep only last 10 interactions
            this.agentContext.lastSpawnedIds = [...spawnResult.map(e => e.id), ...this.agentContext.lastSpawnedIds].slice(0, 10);
            console.log('[Agent] Updated context with spawned IDs:', this.agentContext.lastSpawnedIds);
        }

        return { success: true, message: `Spawned ${count} ${CreatureClass.name}`, ids: spawnResult.map(e => e.id) };
    }

    updateEntity(args) {
        const { entityId, updates } = args;
        const entity = this.game.spawnManager.entities.get(entityId);

        if (!entity) {
            return { error: `Entity ${entityId} not found.` };
        }

        console.log(`[Agent] Updating entity ${entityId}:`, updates);

        const className = entity.constructor.name;

        if (updates.scale) {
            if (typeof entity.setScale === 'function') {
                entity.setScale(updates.scale);
            } else if (entity.mesh && entity.mesh.scale) {
                // Fallback to direct mesh manipulation if method missing
                // BUT better to enforce method for persistence? 
                // Let's rely on standard fallback for scale as it's common
                entity.mesh.scale.setScalar(updates.scale);
            } else {
                return { error: `Entity class '${className}' does not support scaling (no setScale method or mesh).` };
            }
        }

        if (updates.color) {
            if (typeof entity.setColor === 'function') {
                entity.setColor(updates.color);
            } else {
                // INTROSPECTION ERROR: Trigger for AI Self-Repair
                // We explicitly tell the AI that the method is missing
                return {
                    error: `Entity class '${className}' does not implement 'setColor'. You need to modify the file for ${className} to add this method.`,
                    details: {
                        missingMethod: 'setColor',
                        className: className,
                        filePath: `src/game/entities/animals/${className}.js` // Hint at path (optional but helpful)
                    }
                };
            }
        }

        // Trigger sync for persistence
        if (entity.checkSync) entity.checkSync(true); // Force sync

        return { success: true, message: `Updated entity ${entityId}` };
    }

    patchEntity(args) {
        const { entityId, method, code } = args;
        const entity = this.game.spawnManager.entities.get(entityId);

        if (!entity) {
            return { error: `Entity ${entityId} not found.` };
        }

        const className = entity.constructor.name;
        console.log(`[Agent] Patching ${className}.${method} on entity ${entityId}`);
        console.log(`[Agent] Patch Code:\n${code}`);

        try {
            // Create function with access to delta param (for update loop)
            // Using Function constructor for runtime code injection
            entity[method] = new Function('delta', code);
            return {
                success: true,
                message: `Patched ${method} on ${className} (${entityId})`
            };
        } catch (e) {
            return { error: `Failed to patch ${method}: ${e.message}` };
        }
    }

    runVerification({ code, description }) {
        console.log(`[Agent] Running verification: ${description}`);
        try {
            const V = new VerificationAPI(this.game);
            // Create function with V API injected
            const verifyFn = new Function('V', code);
            const result = verifyFn(V);

            // Log for debugging
            console.log(`[Agent] Verification result:`, result);
            return result;
        } catch (e) {
            console.error('[Agent] Verification script crash:', e);
            return { success: false, error: `Verification script crash: ${e.message}` };
        }
    }

    captureScreenshot({ label }) {
        console.log(`[Agent] Capturing screenshot: ${label}`);
        try {
            if (!this.game.renderer || !this.game.renderer.domElement) {
                return { error: "Renderer not available for screenshot" };
            }

            // Capture the canvas as data URL (JPEG 0.8 quality)
            const dataUrl = this.game.renderer.domElement.toDataURL('image/jpeg', 0.8);

            // Note: Server handles saving this to file
            return {
                success: true,
                label: label,
                image: dataUrl, // Pass full data URL to server
                timestamp: Date.now()
            };
        } catch (e) {
            console.error('[Agent] Screenshot failed:', e);
            return { success: false, error: `Screenshot failed: ${e.message}` };
        }
    }

    async captureLogs({ duration }) {
        console.log(`[Agent] Capturing logs for ${duration}ms...`);
        const captured = [];
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;

        // Hook logs
        const hook = (type, args) => {
            try {
                const msg = args.map(a => {
                    try {
                        return (typeof a === 'object' ? JSON.stringify(a) : String(a));
                    } catch (e) {
                        return '[Circular/Unserializable]';
                    }
                }).join(' ');
                captured.push(`[${type}] ${msg}`);
            } catch (e) {
                // Ignore serialization errors in hook
            }

            // Pass through to original console
            if (type === 'LOG') originalLog.apply(console, args);
            if (type === 'WARN') originalWarn.apply(console, args);
            if (type === 'ERROR') originalError.apply(console, args);
        };

        console.log = (...args) => hook('LOG', args);
        console.warn = (...args) => hook('WARN', args);
        console.error = (...args) => hook('ERROR', args);

        // Wait
        await new Promise(r => setTimeout(r, duration));

        // Restore
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;

        console.log(`[Agent] Captured ${captured.length} logs.`);
        return { success: true, logs: captured };
    }

    async captureVideo({ duration_seconds, label }) {
        console.log(`[Agent] Capturing video: ${label} (${duration_seconds}s)`);
        const duration = Math.min(Math.max(duration_seconds || 5, 1), 10) * 1000;

        try {
            if (!this.game.renderer || !this.game.renderer.domElement) {
                return { error: "Renderer not available" };
            }

            const stream = this.game.renderer.domElement.captureStream(30); // 30 FPS
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
            const chunks = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            const recordingPromise = new Promise((resolve, reject) => {
                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result); // Returns data:video/webm;base64,...
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                };
                recorder.onerror = reject;
            });

            recorder.start();

            // Wait for duration
            await new Promise(r => setTimeout(r, duration));

            recorder.stop();
            const videoData = await recordingPromise;

            return {
                success: true,
                label: label,
                videoData: videoData,
                duration: duration
            };

        } catch (e) {
            console.error('[Agent] Video capture failed:', e);
            // Fallback for browsers without MediaRecorder or codec support
            return { success: false, error: `Video capture failed: ${e.message}. Is MediaRecorder supported and https enabled?` };
        }
    }

    getSceneInfo() {
        const player = this.game.player;
        const pos = player.position;
        const worldGen = this.game.worldGen;

        const terrainHeight = worldGen ? worldGen.getTerrainHeight(pos.x, pos.z) : 0;
        const biome = worldGen ? worldGen.getBiome(pos.x, pos.z) : 'unknown';

        // Count nearby creatures & build detailed list
        const nearbyCreatures = {};
        const nearbyEntities = [];
        const animals = this.game.animals || [];

        for (const animal of animals) {
            if (animal.mesh && animal.mesh.position.distanceTo(pos) < CREATURE_DETECTION_RADIUS) {
                const name = animal.constructor.name;
                nearbyCreatures[name] = (nearbyCreatures[name] || 0) + 1;

                nearbyEntities.push({
                    type: name,
                    id: animal.id, // ID is critical for update_entity
                    position: {
                        x: Math.round(animal.position.x * 10) / 10,
                        y: Math.round(animal.position.y * 10) / 10,
                        z: Math.round(animal.position.z * 10) / 10
                    },
                    color: animal.color || 'default'
                });
            }
        }

        // Limit entity list size to avoid token limit issues (closest 20)
        nearbyEntities.sort((a, b) => {
            const da = (a.position.x - pos.x) ** 2 + (a.position.z - pos.z) ** 2;
            const db = (b.position.x - pos.x) ** 2 + (b.position.z - pos.z) ** 2;
            return da - db;
        });

        return {
            position: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) },
            biome,
            nearbyCreatures, // Keep count for high-level summary
            nearbyEntities: nearbyEntities.slice(0, 20) // Detailed list for targeting
        };
    }
}

class VerificationAPI {
    constructor(game) {
        this.game = game;
    }

    get entities() {
        return this.game.spawnManager ? Array.from(this.game.spawnManager.entities.values()) : [];
    }

    findEntity(name) {
        return this.entities.find(e => e.constructor.name.toLowerCase() === name.toLowerCase());
    }

    findAllEntities(name) {
        return this.entities.filter(e => e.constructor.name.toLowerCase() === name.toLowerCase());
    }

    countEntities(name) {
        return this.findAllEntities(name).length;
    }

    getPlayerPos() {
        return this.game.player ? this.game.player.position.clone() : null;
    }

    getBlockAt(x, y, z) {
        return this.game.world ? this.game.world.getBlock(x, y, z) : 0;
    }

    // Check if entity is roughly in front of player and not obstructed
    isEntityVisible(entity) {
        if (!entity || !entity.mesh) return false;

        // Simple frustum check or distance check
        // For now, just existance + material check
        return entity.mesh.visible;
    }

    getEntityMaterial(entity) {
        if (!entity || !entity.mesh) return null;
        // Handle Group with children
        const mesh = entity.mesh.isGroup ? entity.mesh.children[0] : entity.mesh;
        return mesh ? mesh.material : null;
    }

    getRegistrationError(name) {
        // Access global error registry if it exists
        return window.DynamicCreatureErrors?.[name] || null;
    }
}
