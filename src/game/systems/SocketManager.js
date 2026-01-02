import { io } from 'socket.io-client';
import * as THREE from 'three';
import { Peer } from 'peerjs';
import { registerDynamicCreature, registerMultipleCreatures } from '../DynamicCreatureRegistry.js';
import { registerDynamicItem, registerMultipleItems } from '../DynamicItemRegistry.js';

export class SocketManager {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.roomId = null;
        this.socketId = null;
        this.playerMeshes = new Map(); // id -> THREE.Group

        // Voice Chat (PeerJS)
        this.localStream = null;
        this.peerJs = null; // PeerJS instance
        this.activeCalls = new Map(); // peerId -> MediaConnection
        this.pendingStreams = new Map(); // id -> MediaStream (if mesh not ready)
        this.voiceEnabled = localStorage.getItem('settings_voice') === 'true';
        this.lastVoiceState = false;

        this.connect();
    }

    connect() {
        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const serverUrl = import.meta.env.VITE_SERVER_URL || (isDev ? 'http://localhost:2567' : window.location.origin);

        console.log(`[SocketManager] Connecting to ${serverUrl}...`);

        this.socket = io(serverUrl, {
            transports: ['websocket'],
            reconnection: true
        });

        this.socket.on('connect', () => {
            console.log('[SocketManager] Connected! ID:', this.socket.id);
            this.socketId = this.socket.id;
            this.game.uiManager?.updateNetworkStatus('Connected');

            // Automatically join a game
            this.joinGame();

            // Initialize voice chat
            if (this.voiceEnabled) {
                this.initVoiceChat();
            }
        });

        this.socket.on('disconnect', () => {
            console.log('[SocketManager] Disconnected');
            this.roomId = null;
            this.game.uiManager?.updateNetworkStatus('Disconnected', null, null);
        });

        this.socket.on('connect_error', (err) => {
            console.error('[SocketManager] Connection Error:', err);
            this.game.uiManager?.updateNetworkStatus('Connection Error');
        });

        this.socket.on('room:joined', (data) => {
            console.log('[SocketManager] Joined room:', data);
            this.roomId = data.roomId;

            const role = data.isHost ? 'Host' : 'Client';
            this.game.uiManager?.updateNetworkStatus('In Room', role, data.roomId);

            // Notify game of initial state if needed
            if (data.worldSeed && this.game.setWorldSeed) {
                // Potentially re-seed world here if game implementation supports it
                console.log(`[SocketManager] Room World Seed: ${data.worldSeed}`);
            }

            if (data.time !== undefined && this.game.environment) {
                this.game.environment.setTimeOfDay(data.time);
                console.log(`[SocketManager] Initial Room Time: ${data.time}`);
            }

            // Sync existing players
            if (data.playerStates) {
                console.log('[SocketManager] Syncing existing players:', Object.keys(data.playerStates).length);
                for (const [pid, state] of Object.entries(data.playerStates)) {
                    if (pid === this.socketId) continue; // Skip self

                    if (state.pos) {
                        console.log(`[SocketManager] Creating mesh for existing player ${pid} at`, state.pos);
                        this.updatePlayerMesh(pid, state.pos, state.rotY);
                    }
                }
            }

            // Send our initial position immediately so server has it for others
            if (this.game.player) {
                this.sendPosition(this.game.player.position, this.game.player.rotation.y);
            }
        });

        this.socket.on('player:joined', (data) => {
            console.log('[SocketManager] Another player joined:', data.id);
            // With PeerJS, we wait for 'peerjs:id' event to know they are ready and have their ID
            // So we don't call callPeer() here.
        });

        this.socket.on('player:left', (id) => {
            console.log('[SocketManager] Player left:', id);
            this.game.uiManager?.updateRemotePlayerStatus(id, null); // Remove from UI

            // Close PeerJS call
            const peerId = this.socketIdToPeerId(id);
            if (this.activeCalls.has(peerId)) {
                this.activeCalls.get(peerId).close();
                this.activeCalls.delete(peerId);
            }

            // Remove 3D mesh
            const mesh = this.playerMeshes.get(id);
            if (mesh) {
                this.game.scene.remove(mesh.group);
                this.playerMeshes.delete(id);
            }
        });

        // Note: PeerJS handles its own signaling, so we don't need socket signal relay
        // But we do need to share PeerJS IDs via socket
        this.socket.on('peerjs:id', (data) => {
            // data: { socketId, peerId }
            console.log(`[SocketManager] Received PeerJS ID from ${data.socketId}: ${data.peerId}`);
            // If we have a stream and this is a new player, call them
            if (this.localStream && this.peerJs && data.socketId !== this.socketId) {
                this.callPeer(data.peerId);
            }
        });

        this.socket.on('player:move', (data) => {
            // data: { id, pos, rotY }
            if (data && data.pos) {
                this.game.uiManager?.updateRemotePlayerStatus(data.id, data.pos, data.rotY);
                this.updatePlayerMesh(data.id, data.pos, data.rotY);
            }
        });

        // Handle block changes from other players (real-time sync)
        this.socket.on('block:change', (data) => {
            // data: { id, x, y, z, type }
            if (data) {
                console.log(`[SocketManager] Block change from ${data.id}: ${data.x},${data.y},${data.z} -> ${data.type}`);
                // skipBroadcast = true to avoid echoing back to server
                this.game.setBlock(data.x, data.y, data.z, data.type, false, true);
            }
        });

        // Handle initial block state on room join (persisted blocks)
        this.socket.on('blocks:initial', (blocks) => {
            // Use the game's robust persisted block handler
            if (this.game.addPersistedBlocks) {
                this.game.addPersistedBlocks(blocks);
            } else {
                console.warn('[SocketManager] game.addPersistedBlocks not found, using fallback (may be overwritten)');
                for (const block of blocks) {
                    this.game.setBlock(block.x, block.y, block.z, block.type, true, true);
                }
                this.game.updateChunks();
            }
        });

        // Handle initial signs
        this.socket.on('signs:initial', (signs) => {
            if (this.game.addPersistedSigns) {
                this.game.addPersistedSigns(signs);
            }
        });

        // Handle time of day sync
        this.socket.on('world:time', (time) => {
            if (this.game.environment) {
                // Smoothly lerp or just set?
                // For now, just set it. It's updated every second or so.
                // If the gap is large, we might want to lerp, but simple assignment is robust.
                this.game.environment.setTimeOfDay(time);
                this.game.environment.setTimeOfDay(time);
            }
        });

        // Handle entity initial load
        this.socket.on('entities:initial', (entities) => {
            // Always call handleInitialEntities, even with empty array, 
            // so SpawnManager knows we've received server state
            if (this.game.spawnManager) {
                this.game.spawnManager.handleInitialEntities(entities || []);
            }
        });

        // Handle remote entity spawn
        this.socket.on('entity:spawn', (data) => {
            if (this.game.spawnManager) {
                this.game.spawnManager.handleRemoteSpawn(data);
            }
        });

        // Handle remote entity update
        this.socket.on('entity:update', (data) => {
            if (this.game.spawnManager) {
                this.game.spawnManager.handleRemoteUpdate(data);
            }
        });

        // Handle world reset (triggered by settings menu)
        this.socket.on('world:reset', (data) => {
            console.log('[SocketManager] World reset received:', data);
            // Show a brief message then reload the page with the new world
            if (this.game.uiManager) {
                this.game.uiManager.addChatMessage('system', 'World is being reset...');
            }
            // Short delay to let the message display, then reload
            setTimeout(() => {
                window.location.reload();
            }, 500);
        });

        // Handle dynamic creature definitions
        // Initial batch when joining
        this.socket.on('creatures_initial', (creatures) => {
            console.log('[SocketManager] Received initial creature definitions:', creatures?.length || 0);
            registerMultipleCreatures(creatures);
        });

        // Real-time broadcast when a new creature is created
        this.socket.on('creature_definition', (definition) => {
            console.log('[SocketManager] Received new creature definition:', definition.name);
            if (registerDynamicCreature(definition)) {
                if (this.game.uiManager) {
                    this.game.uiManager.addChatMessage('system', `🆕 New creature available: ${definition.name}`);
                }
            }
        });

        // Handle dynamic item definitions
        // Initial batch when joining
        this.socket.on('items_initial', (items) => {
            console.log('[SocketManager] Received initial item definitions:', items?.length || 0);
            registerMultipleItems(items);
        });

        // Real-time broadcast when a new item is created
        this.socket.on('item_definition', (definition) => {
            console.log('[SocketManager] Received new item definition:', definition.name);
            if (registerDynamicItem(definition)) {
                if (this.game.uiManager) {
                    this.game.uiManager.addChatMessage('system', `🆕 New item available: ${definition.name}`);
                }
            }
        });

        // Add an animation loop for remote characters
        this.lastUpdateTime = performance.now();
        this.animateRemotePlayers();
    }

    animateRemotePlayers() {
        requestAnimationFrame(() => this.animateRemotePlayers());

        // 0. Update Push-to-Talk
        let voiceActive = this.game.inputManager.isActionActive('VOICE');

        // Only allow voice if enabled in settings AND if there are other players
        if (!this.voiceEnabled || this.playerMeshes.size === 0) {
            voiceActive = false;
        }

        if (voiceActive !== this.lastVoiceState) {
            this.lastVoiceState = voiceActive;
            if (this.localStream) {
                console.log(`[SocketManager] Voice ${voiceActive ? 'ON' : 'OFF'}`);
                this.localStream.getAudioTracks().forEach(t => t.enabled = voiceActive);
                this.game.uiManager?.toggleVoiceTransmitIndicator(voiceActive);
            }
        }

        const now = performance.now();
        const deltaTime = (now - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = now;

        this.playerMeshes.forEach((meshInfo, id) => {
            // 1. Interpolate Position
            meshInfo.group.position.lerp(meshInfo.targetPosition, 0.2);

            // 2. Interpolate Rotation (Smooth turning)
            let diff = meshInfo.targetRotationY - meshInfo.group.rotation.y;
            // Normalize angle diff to [-PI, PI]
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            meshInfo.group.rotation.y += diff * 0.15;

            // 3. Handle Walking Animation
            const distToTarget = meshInfo.group.position.distanceTo(meshInfo.targetPosition);
            const isMoving = distToTarget > 0.05;

            // Smoothly transition walk amplitude
            meshInfo.walkAmplitude = THREE.MathUtils.lerp(meshInfo.walkAmplitude, isMoving ? 1 : 0, 0.1);

            if (meshInfo.walkAmplitude > 0.01) {
                meshInfo.animationTime += deltaTime * 10; // Animation speed
                const swing = Math.sin(meshInfo.animationTime) * 0.6 * meshInfo.walkAmplitude;

                if (meshInfo.leftArm) meshInfo.leftArm.rotation.x = swing;
                if (meshInfo.rightArm) meshInfo.rightArm.rotation.x = -swing;
                if (meshInfo.leftLeg) meshInfo.leftLeg.rotation.x = -swing;
                if (meshInfo.rightLeg) meshInfo.rightLeg.rotation.x = swing;
            } else {
                // Return limbs to neutral
                if (meshInfo.leftArm) meshInfo.leftArm.rotation.x *= 0.9;
                if (meshInfo.rightArm) meshInfo.rightArm.rotation.x *= 0.9;
                if (meshInfo.leftLeg) meshInfo.leftLeg.rotation.x *= 0.9;
                if (meshInfo.rightLeg) meshInfo.rightLeg.rotation.x *= 0.9;
            }
        });
    }

    joinGame() {
        if (this.socket && this.socket.connected) {
            console.log('[SocketManager] Requesting to join game...');
            this.socket.emit('join_game');
        }
    }

    /**
     * Check if connected and in a room
     */
    isConnected() {
        return this.socket && this.socket.connected && this.roomId;
    }

    /**
     * Send position update
     * @param {Object} pos - {x, y, z}
     * @param {number} rotY - Rotation around Y axis
     */
    sendPosition(pos, rotY) {
        if (!this.isConnected()) return;

        // Convert THREE.Vector3 to plain object for socket transmission
        const posData = { x: pos.x, y: pos.y, z: pos.z };

        this.socket.emit('player:move', { pos: posData, rotY });
    }

    /**
     * Send block change to server for sync and persistence
     * @param {number} x - Block X coordinate
     * @param {number} y - Block Y coordinate  
     * @param {number} z - Block Z coordinate
     * @param {string|null} type - Block type (null for air/deletion)
     */
    sendBlockChange(x, y, z, type) {
        if (!this.isConnected()) return;

        this.socket.emit('block:change', {
            x: Math.floor(x),
            y: Math.floor(y),
            z: Math.floor(z),
            type
        });
    }

    /**
     * Send time set request to server
     * @param {number} time - Time of day (0.0 to 1.0)
     */
    sendSetTime(time) {
        if (!this.isConnected()) return;
        this.socket.emit('world:set_time', time);
    }

    sendEntityUpdate(data) {
        if (!this.isConnected()) return;
        this.socket.emit('entity:update', data);
    }

    sendSignUpdate(x, y, z, text) {
        if (!this.isConnected()) return;
        this.socket.emit('sign:update', { x, y, z, text });
    }

    sendEntitySpawn(data) {
        if (!this.isConnected()) return;
        this.socket.emit('entity:spawn', data);
    }

    /**
     * Request a world reset from the server
     * This clears all persisted blocks, entities, and signs
     */
    sendWorldReset() {
        if (!this.isConnected()) {
            console.warn('[SocketManager] Cannot reset world: Not connected');
            return;
        }
        console.log('[SocketManager] Sending world reset request...');
        this.socket.emit('world:reset');
    }

    toggleEcho() {
        if (this.echoEnabled) {
            // Turn off
            this.echoEnabled = false;
            console.log('[SocketManager] Echo Mode: OFF');
            this.game.uiManager?.addChatMessage('system', 'Voice Echo: OFF');

            // Disconnect the source from destination
            if (this._echoSource) {
                this._echoSource.disconnect();
                this._echoSource = null;
            }
        } else {
            // Turn on
            if (!this.localStream) {
                console.warn('[SocketManager] Cannot enable echo: No local stream');
                this.game.uiManager?.addChatMessage('system', 'Voice Echo: Failed (No Microphone detected)');
                return;
            }
            this.echoEnabled = true;
            console.log('[SocketManager] Echo Mode: ON');
            this.game.uiManager?.addChatMessage('system', 'Voice Echo: ON (You should hear yourself)');

            // Use Web Audio API properly
            // Get or create an AudioContext
            if (!this._echoContext) {
                this._echoContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Resume context if suspended (browser autoplay policy)
            if (this._echoContext.state === 'suspended') {
                this._echoContext.resume();
            }

            // Create a MediaStreamSource from the local stream
            this._echoSource = this._echoContext.createMediaStreamSource(this.localStream);

            // Connect directly to the destination (speakers)
            this._echoSource.connect(this._echoContext.destination);

            console.log('[SocketManager] Echo audio graph connected');
        }
    }

    // Voice chat methods - PeerJS Implementation

    socketIdToPeerId(socketId) {
        // Convert socket.io ID to PeerJS-safe ID (remove special chars)
        return 'mc_' + socketId.replace(/[^a-zA-Z0-9]/g, '');
    }

    setVoiceChatEnabled(enabled) {
        this.voiceEnabled = enabled;
        console.log(`[SocketManager] Voice Chat Setting: ${enabled}`);

        if (enabled) {
            this.initVoiceChat();
        } else {
            // Disable logic:
            // 1. Mute local stream
            if (this.localStream) {
                this.localStream.getAudioTracks().forEach(t => t.enabled = false);
            }
            // 2. We don't fully destroy PeerJS connection to avoid re-handshake complexity on toggle,
            // but we ensure we don't transmit.
            // Ideally we could close calls, but just muting writes is safer for quick toggle.

            // If we wanted to fully shut down:
            /*
            if (this.peerJs) {
                this.peerJs.destroy();
                this.peerJs = null;
            }
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
            }
            */
        }
    }

    initVoiceChat() {
        if (!this.voiceEnabled) return; // double check
        if (this.localStream) return;

        console.log('[SocketManager] Initializing PeerJS Voice Chat...');

        // Get microphone first
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(stream => {
                console.log('[SocketManager] Microphone access granted.');
                this.localStream = stream;

                // Mute by default for PTT
                stream.getAudioTracks().forEach(t => t.enabled = false);

                // Create PeerJS instance
                const peerId = this.socketIdToPeerId(this.socketId);
                console.log(`[SocketManager] Creating PeerJS with ID: ${peerId}`);

                this.peerJs = new Peer(peerId);

                this.peerJs.on('open', (id) => {
                    console.log('[SocketManager] PeerJS connected with ID:', id);
                    if (this.socket && this.roomId) {
                        this.socket.emit('peerjs:id', { peerId: id });
                    }
                });

                this.peerJs.on('call', (call) => {
                    console.log(`[SocketManager] Incoming call from ${call.peer}`);
                    call.answer(this.localStream);

                    call.on('stream', (remoteStream) => {
                        console.log(`[SocketManager] Received stream from ${call.peer}`);
                        this.setupSpatialAudioForPeer(call.peer, remoteStream);
                    });

                    call.on('error', (err) => {
                        console.error(`[SocketManager] Call error:`, err);
                    });

                    this.activeCalls.set(call.peer, call);
                });

                this.peerJs.on('error', (err) => {
                    console.error('[SocketManager] PeerJS error:', err);
                });
            })
            .catch(err => {
                console.error('[SocketManager] Failed to get local stream', err);
                this.game.uiManager?.addChatMessage('system', 'Microphone access denied. Voice chat disabled.');
            });
    }

    callPeer(peerId) {
        if (!this.peerJs || !this.localStream) {
            console.warn('[SocketManager] Cannot call peer: PeerJS or stream not ready');
            return;
        }
        if (this.activeCalls.has(peerId)) {
            console.log(`[SocketManager] Already in call with ${peerId}`);
            return;
        }

        console.log(`[SocketManager] Calling peer: ${peerId}`);
        const call = this.peerJs.call(peerId, this.localStream);

        call.on('stream', (remoteStream) => {
            console.log(`[SocketManager] Received stream from ${peerId}`);
            this.setupSpatialAudioForPeer(peerId, remoteStream);
        });

        call.on('error', (err) => {
            console.error(`[SocketManager] Call error with ${peerId}:`, err);
        });

        call.on('close', () => {
            console.log(`[SocketManager] Call with ${peerId} closed`);
            this.activeCalls.delete(peerId);
        });

        this.activeCalls.set(peerId, call);
    }

    setupSpatialAudioForPeer(peerId, stream) {
        // For now, just play the audio directly (non-spatial)
        // We can add spatial audio later once basic audio works
        console.log(`[SocketManager] Setting up audio for ${peerId}`);

        // Simple approach: create an audio element
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.volume = 1.0;

        // Play (may need user interaction)
        audio.play().catch(e => {
            console.warn('[SocketManager] Audio autoplay blocked, will play on interaction');
            const playOnce = () => {
                audio.play();
                window.removeEventListener('click', playOnce);
            };
            window.addEventListener('click', playOnce);
        });

        console.log(`[SocketManager] Audio playing for ${peerId}`);
    }

    setupSpatialAudio(id, stream) {
        const meshInfo = this.playerMeshes.get(id);
        if (!meshInfo) {
            console.warn(`[SocketManager] Mesh not found for ${id}, storing pending stream.`);
            this.pendingStreams.set(id, stream);
            return;
        }

        if (!this.game.audioListener) {
            console.error('[SocketManager] AudioListener not found on camera');
            return;
        }

        // Resume AudioContext on first interaction if suspended
        const context = this.game.audioListener.context;
        if (context.state === 'suspended') {
            const resume = () => {
                context.resume().then(() => {
                    console.log('[SocketManager] AudioContext resumed');
                });
                window.removeEventListener('click', resume);
                window.removeEventListener('keydown', resume);
            };
            window.addEventListener('click', resume);
            window.addEventListener('keydown', resume);
        }

        // Create PositionalAudio
        const sound = new THREE.PositionalAudio(this.game.audioListener);

        // Use MediaStreamSource
        const source = context.createMediaStreamSource(stream);

        sound.setNodeSource(source);
        sound.setRefDistance(5); // Distance at which sound starts to attenuate
        sound.setMaxDistance(50); // Distance at which sound is completely silent
        sound.setRolloffFactor(1);

        meshInfo.group.add(sound);
        meshInfo.spatialAudio = sound;

        console.log(`[SocketManager] Spatial audio setup for ${id}`);
    }

    updatePlayerMesh(id, pos, rotY) {
        let meshInfo = this.playerMeshes.get(id);

        if (!meshInfo || meshInfo instanceof THREE.Object3D) {
            if (meshInfo instanceof THREE.Object3D) {
                this.game.scene.remove(meshInfo);
            }
            meshInfo = this.createCharacterModel(id);
            this.playerMeshes.set(id, meshInfo);

            // Initial position
            meshInfo.group.position.copy(pos);
            meshInfo.targetPosition.copy(pos);

            // Check if we have a pending stream for this mesh
            const pendingStream = this.pendingStreams.get(id);
            if (pendingStream) {
                console.log(`[SocketManager] Found pending stream for ${id}, setting up spatial audio now.`);
                this.setupSpatialAudio(id, pendingStream);
                this.pendingStreams.delete(id);
            }
            return;
        }

        // Set target position for interpolation
        const targetPos = new THREE.Vector3(pos.x, pos.y, pos.z);

        // Update target rotation
        if (rotY !== undefined) {
            meshInfo.targetRotationY = rotY;
        } else {
            // Fallback: face movement if no explicit rotation provided
            const dx = targetPos.x - meshInfo.targetPosition.x;
            const dz = targetPos.z - meshInfo.targetPosition.z;
            if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
                meshInfo.targetRotationY = Math.atan2(dx, dz) + Math.PI;
            }
        }

        meshInfo.targetPosition.copy(targetPos);
    }

    createCharacterModel(id) {
        const group = new THREE.Group();

        // Colors matching Player.js (Steve skin)
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xB58D6E });
        const shirtMat = new THREE.MeshLambertMaterial({ color: 0x00AAAA });
        const pantsMat = new THREE.MeshLambertMaterial({ color: 0x3333AA });
        const hairMat = new THREE.MeshLambertMaterial({ color: 0x4A3222 });

        // Torso
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.25), shirtMat);
        torso.position.y = 1.05; // Slightly adjusted from 1.1 for better ground contact
        group.add(torso);

        // Head Group
        const headGroup = new THREE.Group();
        headGroup.position.y = 1.675; // Positioned atop torso
        group.add(headGroup);

        const headSize = 0.5;
        const head = new THREE.Mesh(new THREE.BoxGeometry(headSize, headSize, headSize), skinMat);
        headGroup.add(head);

        // Hair (Hat layer)
        const hair = new THREE.Mesh(new THREE.BoxGeometry(headSize + 0.05, headSize * 0.25, headSize + 0.05), hairMat);
        hair.position.y = 0.2;
        headGroup.add(hair);

        // Facial Features (Simplified clones of Player.js logic)
        const eyeSize = 0.08;
        const eyeGeom = new THREE.BoxGeometry(eyeSize, eyeSize, 0.05);
        const eyeWhiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const pupilMat = new THREE.MeshLambertMaterial({ color: 0x493B7F });

        const createEye = (x) => {
            const eye = new THREE.Group();
            const white = new THREE.Mesh(eyeGeom, eyeWhiteMat);
            const pupil = new THREE.Mesh(new THREE.BoxGeometry(eyeSize / 2, eyeSize / 2, 0.01), pupilMat);
            pupil.position.z = -0.03; // Stick out front (-Z for this model orientation)
            eye.add(white, pupil);
            eye.position.set(x, 0, -0.251);
            return eye;
        };
        headGroup.add(createEye(-0.12), createEye(0.12));

        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.05), hairMat);
        mouth.position.set(0, -0.12, -0.251);
        headGroup.add(mouth);

        // Limbs function
        const createLimb = (y, xOffset, mat) => {
            const pivot = new THREE.Group();
            pivot.position.set(xOffset, y, 0);
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.75, 0.25), mat);
            mesh.position.y = -0.375; // Pivot at top
            pivot.add(mesh);
            return pivot;
        };

        const leftArm = createLimb(1.4, -0.375, skinMat);
        const rightArm = createLimb(1.4, 0.375, skinMat);
        const leftLeg = createLimb(0.7, -0.125, pantsMat);
        const rightLeg = createLimb(0.7, 0.125, pantsMat);

        group.add(leftArm, rightArm, leftLeg, rightLeg);
        this.game.scene.add(group);

        console.log(`[SocketManager] Created detailed character for ${id}`);

        return {
            group,
            leftArm,
            rightArm,
            leftLeg,
            rightLeg,
            targetPosition: new THREE.Vector3(),
            targetRotationY: 0,
            walkAmplitude: 0,
            animationTime: 0
        };
    }
}
