import { io } from 'socket.io-client';
import * as THREE from 'three';
import { Peer } from 'peerjs';
import { registerDynamicCreature, registerMultipleCreatures } from '../DynamicCreatureRegistry.js';
import { registerDynamicItem, registerMultipleItems } from '../DynamicItemRegistry.js';
import { ItemFactory } from '../entities/ItemFactory.js';
import { auth } from '../../config/firebase-client.js';

export class SocketManager {
    // Static shared geometry/material cache for remote player models
    static _playerModelAssets = null;

    static getPlayerModelAssets() {
        if (this._playerModelAssets) return this._playerModelAssets;

        // Create shared geometries once
        const geometries = {
            torso: new THREE.BoxGeometry(0.5, 0.75, 0.25),
            head: new THREE.BoxGeometry(0.5, 0.5, 0.5),
            hair: new THREE.BoxGeometry(0.55, 0.125, 0.55),
            eye: new THREE.BoxGeometry(0.08, 0.08, 0.05),
            pupil: new THREE.BoxGeometry(0.04, 0.04, 0.01),
            mouth: new THREE.BoxGeometry(0.2, 0.06, 0.05),
            limb: new THREE.BoxGeometry(0.25, 0.75, 0.25),
        };

        // Create shared materials once
        const materials = {
            skin: new THREE.MeshLambertMaterial({ color: 0xB58D6E }),
            shirt: new THREE.MeshLambertMaterial({ color: 0x00AAAA }),
            pants: new THREE.MeshLambertMaterial({ color: 0x3333AA }),
            hair: new THREE.MeshLambertMaterial({ color: 0x4A3222 }),
            eyeWhite: new THREE.MeshLambertMaterial({ color: 0xFFFFFF }),
            pupil: new THREE.MeshLambertMaterial({ color: 0x493B7F }),
        };

        this._playerModelAssets = { geometries, materials };
        return this._playerModelAssets;
    }

    constructor(game) {
        this.game = game;
        this.socket = null;
        this.roomId = null;
        this.socketId = null;
        this.playerMeshes = new Map(); // id -> THREE.Group

        // Multi-World Support
        this.worldId = null;           // Current world ID (e.g., 'global', 'abc123')
        this.world = null;             // Full world data from server
        this.permissions = null;       // Player's permissions in current world

        // Voice Chat (PeerJS)
        this.localStream = null;
        this.peerJs = null; // PeerJS instance
        this.activeCalls = new Map(); // peerId -> MediaConnection
        this.pendingStreams = new Map(); // id -> MediaStream (if mesh not ready)
        this.voiceEnabled = localStorage.getItem('settings_voice') === 'true';
        this.lastVoiceState = false;

        // Soccer Ball Multiplayer State
        this.isSoccerBallHost = false;  // First player in Soccer World becomes host
        this.lastSoccerBallUpdate = 0;
        this.soccerBallSyncRate = 50;   // ms between updates (20Hz)

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

            // Check if URL specifies a world ID (e.g., /world/abc123)
            const worldIdFromUrl = this.getWorldIdFromUrl();
            if (worldIdFromUrl) {
                console.log(`[SocketManager] Joining world from URL: ${worldIdFromUrl}`);
                this.joinWorld(worldIdFromUrl);
            } else {
                // Fall back to legacy join_game for backward compatibility
                this.joinGame();
            }

            // Initialize voice chat
            if (this.voiceEnabled) {
                this.initVoiceChat();
            }
        });

        // Handle world:joined event (new multi-world system)
        this.socket.on('world:joined', (data) => {
            console.log('[SocketManager] Joined world:', data);
            this.roomId = data.roomId;
            this.worldId = data.worldId;
            this.world = data.world;
            this.permissions = data.permissions;

            const role = data.isHost ? 'Host' : 'Client';
            this.game.uiManager?.updateNetworkStatus('In World', role, data.worldId);

            // Apply world settings
            if (data.world?.seed && this.game.setWorldSeed) {
                console.log(`[SocketManager] World Seed: ${data.world.seed}`);
            }

            if (data.time !== undefined && this.game.environment) {
                this.game.environment.setTimeOfDay(data.time);
                console.log(`[SocketManager] Initial World Time: ${data.time}`);
            }

            // Apply world customizations (sky color, gravity, creature filter)
            this.applyWorldCustomizations(data.world);

            // Sync existing players
            if (data.playerStates) {
                console.log('[SocketManager] Syncing existing players:', Object.keys(data.playerStates).length);
                for (const [pid, state] of Object.entries(data.playerStates)) {
                    if (pid === this.socketId) continue;
                    if (state.pos) {
                        this.updatePlayerMesh(pid, state.pos, state.rotY);
                        if (state.heldItem) {
                            this.updateRemoteHeldItem(pid, state.heldItem);
                        }
                    }
                }
            }

            // Send our initial position
            if (this.game.player) {
                this.sendPosition(this.game.player.position, this.game.player.rotation.y);
                if (this.game.inventory) {
                    const item = this.game.inventory.getSelectedItem();
                    if (item && item.item) {
                        this.sendHeldItem(item.item);
                    }
                }
            }

            // Dispatch custom event for UI to react to world join
            window.dispatchEvent(new CustomEvent('worldJoined', { detail: data }));
        });

        // Handle world:error event
        this.socket.on('world:error', (error) => {
            console.error('[SocketManager] World error:', error);
            this.game.uiManager?.showNotification(`Failed to join world: ${error.message}`, 'error');

            // Fall back to global world on error
            if (error.code === 'WORLD_NOT_FOUND' || error.code === 'ACCESS_DENIED') {
                console.log('[SocketManager] Falling back to global world');
                this.joinGame();
            }
        });

        // Handle world settings changed by owner
        this.socket.on('world:settings_changed', (data) => {
            console.log('[SocketManager] World settings changed:', data);

            // Update local world data
            if (this.world && data.worldId === this.worldId) {
                this.world.settings = { ...this.world.settings, ...data.settings };
                if (data.customizations) {
                    this.world.customizations = { ...this.world.customizations, ...data.customizations };
                }

                // Apply time change if included
                if (data.settings?.timeOfDay !== undefined && this.game.environment) {
                    this.game.environment.setTimeOfDay(data.settings.timeOfDay);
                }

                // Apply customizations (sky color, gravity, creature filter)
                this.applyWorldCustomizations(this.world);

                // Dispatch event for UI updates
                window.dispatchEvent(new CustomEvent('worldSettingsChanged', { detail: data }));
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
                        if (state.heldItem) {
                            console.log(`[SocketManager] Syncing held item for ${pid}: ${state.heldItem}`);
                            this.updateRemoteHeldItem(pid, state.heldItem);
                        }
                    }
                }
            }

            // Send our initial position immediately so server has it for others
            if (this.game.player) {
                this.sendPosition(this.game.player.position, this.game.player.rotation.y);

                // Force sync held item to populate server state immediately
                if (this.game.inventory) {
                    const item = this.game.inventory.getSelectedItem();
                    if (item && item.item) {
                        console.log(`[SocketManager] Force syncing initial held item: ${item.item}`);
                        this.sendHeldItem(item.item);
                    }
                }
            }
        });

        this.socket.on('player:joined', (data) => {
            console.log('[SocketManager] Another player joined:', data.id, 'name:', data.name);

            // Store the name for when we create their mesh
            if (data.name) {
                this.playerNames = this.playerNames || new Map();
                this.playerNames.set(data.id, data.name);
            }

            // If they joined with a held item, show it
            if (data.heldItem) {
                // Wait a tick for mesh creation (triggered by player:move usually, but we might need to handle it if they don't move)
                // Actually, player:joined doesn't create mesh, player:move does.
                // But if they are standing still?
                // We should probably rely on the first player:move to create mesh, THEN update item?
                // OR creates mesh here?
                // Current logic waits for player:move.
                // However, we can store it in a map "pendingHeldItems" if mesh doesn't exist?
                // Or better: valid check in updateRemoteHeldItem handles missing mesh.
                // We'll try to set it, if mesh missing, we might miss it.
                // BUT server sends player:move including name/pos/rotY frequently.
                // If they just joined, they likely will send move soon.
                // Let's store it or retry? 
                // Simpler: Just try. If mesh missing, we can utilize a 'pendingHeldItems' map.

                this.pendingHeldItems = this.pendingHeldItems || new Map();
                this.pendingHeldItems.set(data.id, data.heldItem);
            }

            // Broadcast our held item to the new player
            if (this.game.inventory) {
                const item = this.game.inventory.getSelectedItem();
                if (item && item.item) {
                    this.sendHeldItem(item.item);
                }
            }

            // With PeerJS, we wait for 'peerjs:id' event to know they are ready and have their ID
            // So we don't call callPeer() here.
            // However, if we already have voice chat active, we need to re-broadcast our peer ID
            // so the new player knows about us and can initiate a call
            if (this.voiceEnabled && this.peerJs && this.peerJs.open) {
                const myPeerId = this.socketIdToPeerId(this.socketId);
                console.log(`[SocketManager] Re-broadcasting our PeerJS ID ${myPeerId} to new player ${data.id}`);
                this.socket.emit('peerjs:id', { peerId: myPeerId });
            }
        });

        this.socket.on('player:left', (id) => {
            console.log('[SocketManager] Player left:', id);
            this.game.uiManager?.updateRemotePlayerStatus(id, null); // Remove from UI

            // Close PeerJS call and cleanup audio
            const peerId = this.socketIdToPeerId(id);
            if (this.activeCalls.has(peerId)) {
                console.log(`[SocketManager] Closing voice call with ${peerId}`);
                this.activeCalls.get(peerId).close();
                this.activeCalls.delete(peerId);
            }

            // Remove audio element for this peer
            if (this.peerAudioElements && this.peerAudioElements.has(peerId)) {
                console.log(`[SocketManager] Removing audio element for ${peerId}`);
                const audio = this.peerAudioElements.get(peerId);
                audio.pause();
                audio.srcObject = null;
                this.peerAudioElements.delete(peerId);
            }

            // Remove from pending peer IDs
            if (this.pendingPeerIds && this.pendingPeerIds.has(id)) {
                this.pendingPeerIds.delete(id);
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
            console.log(`[SocketManager] Voice state: voiceEnabled=${this.voiceEnabled}, localStream=${!!this.localStream}, peerJs=${!!this.peerJs}`);

            // If voice chat isn't initialized yet, store the peer info for later connection
            if (!this.pendingPeerIds) {
                this.pendingPeerIds = new Map();
            }
            this.pendingPeerIds.set(data.socketId, data.peerId);

            // If we have a stream and this is a new player, call them
            if (this.localStream && this.peerJs && data.socketId !== this.socketId) {
                this.callPeer(data.peerId);
            } else {
                console.log(`[SocketManager] Cannot call peer yet - waiting for voice chat init. Stored peerId for later.`);
            }
        });

        this.socket.on('player:move', (data) => {
            // data: { id, pos, rotY, name, isCrouching, isFlying, health, maxHealth, shirtColor }
            if (data && data.pos) {
                this.game.uiManager?.updateRemotePlayerStatus(data.id, data.pos, data.rotY, data.name);
                this.updatePlayerMesh(data.id, data.pos, data.rotY, data.name, data.isCrouching, data.health, data.maxHealth, data.shirtColor, data.isFlying);
            }
        });

        // Handle player color changes
        this.socket.on('player:color', (data) => {
            // data: { id, shirtColor }
            console.log(`[SocketManager] Player ${data.id} changed color to:`, data.shirtColor);
            const meshInfo = this.playerMeshes.get(data.id);
            if (meshInfo && meshInfo.shirtMaterial) {
                meshInfo.shirtMaterial.color.setHex(data.shirtColor);
            }
        });

        // Handle player death
        this.socket.on('player:death', (data) => {
            // data: { id }
            console.log(`[SocketManager] Player died: ${data.id}`);
            this.handleRemoteDeath(data.id);
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

        // === Soccer Ball Sync Events ===

        // Receive soccer ball state from host
        this.socket.on('soccer:ball_state', (data) => {
            // Only non-hosts receive and apply ball state
            if (this.isSoccerBallHost) return;

            const ball = this.game.spaceShipManager?.soccerBall;
            if (ball && !ball.isDead) {
                // Apply position and velocity from host
                ball.position.set(data.pos.x, data.pos.y, data.pos.z);
                ball.velocity.set(data.vel.x, data.vel.y, data.vel.z);

                // Update mesh position
                if (ball.mesh) {
                    ball.mesh.position.copy(ball.position);
                }
            }
        });

        // Receive soccer ball kick event (for sound/visual feedback)
        this.socket.on('soccer:ball_kick', (data) => {
            // Play kick sound on all clients
            if (this.game.soundManager) {
                this.game.soundManager.playSound('hit');
            }

            // Show kick direction indicator if desired
            console.log(`[SocketManager] Ball kicked by ${data.playerId}`);
        });

        // Receive goal scored event (with updated scores)
        this.socket.on('soccer:goal', (data) => {
            const ball = this.game.spaceShipManager?.soccerBall;
            if (ball && data.scores) {
                ball.applyScoreUpdate(data.scores);
            }

            const sideName = data.scoringSide.charAt(0).toUpperCase() + data.scoringSide.slice(1);
            if (this.game.uiManager) {
                this.game.uiManager.addChatMessage('system', `GOAL! ${sideName} team scores! (${data.scores?.blue || 0} - ${data.scores?.orange || 0})`);
            }
            if (this.game.soundManager) {
                this.game.soundManager.playSound('levelup');
            }
        });

        // Receive game over event
        this.socket.on('soccer:game_over', (data) => {
            const ball = this.game.spaceShipManager?.soccerBall;
            if (ball) {
                ball.applyGameOver(data.winner, data.scores);
            }

            const winnerName = data.winner.charAt(0).toUpperCase() + data.winner.slice(1);
            if (this.game.uiManager) {
                this.game.uiManager.addChatMessage('system', `GAME OVER! ${winnerName} team wins!`);
            }
            if (this.game.soundManager) {
                this.game.soundManager.playSound('levelup');
            }
        });

        // Receive game reset event
        this.socket.on('soccer:game_reset', (data) => {
            const ball = this.game.spaceShipManager?.soccerBall;
            if (ball) {
                ball.resetGame(false);  // Don't broadcast again
            }
        });

        // Receive ball reset event
        this.socket.on('soccer:ball_reset', (data) => {
            const ball = this.game.spaceShipManager?.soccerBall;
            if (ball) {
                ball.position.set(data.pos.x, data.pos.y, data.pos.z);
                ball.velocity.set(0, 0, 0);
                if (ball.mesh) {
                    ball.mesh.position.copy(ball.position);
                }
            }
            if (this.game.uiManager) {
                this.game.uiManager.addChatMessage('system', 'Ball reset to center!');
            }
        });

        // Handle host assignment for soccer ball
        this.socket.on('soccer:host_assigned', (data) => {
            const wasHost = this.isSoccerBallHost;
            this.isSoccerBallHost = (data.hostId === this.socketId);
            console.log(`[SocketManager] Soccer ball host: ${data.hostId}, I am host: ${this.isSoccerBallHost}`);

            if (this.isSoccerBallHost && this.game.uiManager) {
                this.game.uiManager.addChatMessage('system', 'You are the soccer ball host (controlling physics)');
            }

            // If host was released (null), and we're in Soccer World, try to become the new host
            if (data.hostId === null && this.game.spaceShipManager?.soccerBall) {
                console.log('[SocketManager] Soccer host disconnected, requesting to become new host');
                this.requestSoccerHost();
            }
        });

        // Request to become soccer host when entering Soccer World
        this.socket.on('soccer:request_host_response', (data) => {
            this.isSoccerBallHost = data.isHost;
            console.log(`[SocketManager] Soccer host request response: ${data.isHost}`);
        });

        // Handle world reset (triggered by settings menu)
        this.socket.on('world:reset', (data) => {
            console.log('[SocketManager] World reset received:', data);

            // Check if this client initiated the reset (only initiator should respawn)
            if (data.isInitiator) {
                // Show a brief message then reload the page with the new world
                if (this.game.uiManager) {
                    this.game.uiManager.addChatMessage('system', 'World is being reset...');
                }
                // Short delay to let the message display, then reload
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } else {
                // Other players: just clear entities and blocks without respawning
                // IMPORTANT: Preserve player position - don't let them fall during reset
                if (this.game.uiManager) {
                    this.game.uiManager.addChatMessage('system', 'World was reset by another player');
                }

                // Save the player's current position before reset
                const savedPosition = this.game.player ? {
                    x: this.game.player.position.x,
                    y: this.game.player.position.y,
                    z: this.game.player.position.z
                } : null;

                // Temporarily disable physics/gravity to prevent falling during chunk rebuild
                const wasGravityEnabled = this.game.player ? !this.game.player.isFlying : true;
                if (this.game.player) {
                    this.game.player.isFlying = true; // Prevent falling
                    this.game.player.velocity.set(0, 0, 0); // Stop any movement
                }

                // Clear all entities
                if (this.game.spawnManager) {
                    this.game.spawnManager.clearAllEntities();
                }

                // Clear persisted block changes (world will regenerate naturally)
                if (this.game.clearPersistedBlocks) {
                    this.game.clearPersistedBlocks();
                }

                // Regenerate chunks around the player
                if (this.game.updateChunks) {
                    this.game.updateChunks();
                }

                // Update time
                if (data.time !== undefined && this.game.environment) {
                    this.game.environment.setTimeOfDay(data.time);
                }

                // Restore player position and physics after a short delay to let chunks rebuild
                setTimeout(() => {
                    if (this.game.player && savedPosition) {
                        // Restore exact position
                        this.game.player.position.set(savedPosition.x, savedPosition.y, savedPosition.z);
                        this.game.player.velocity.set(0, 0, 0);

                        // Restore gravity/flying state
                        if (wasGravityEnabled) {
                            this.game.player.isFlying = false;
                        }

                        console.log('[SocketManager] Player position restored after world reset:', savedPosition);
                    }
                }, 500); // Wait for chunks to rebuild
            }
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

        // Handle player chat messages (speech bubbles)
        this.socket.on('player:chat', (data) => {
            // data: { id, message, name }
            console.log(`[SocketManager] Player ${data.id} says: "${data.message}"`);
            this.showPlayerChatBubble(data.id, data.message);
            // Also add to player chat panel
            if (this.game.uiManager) {
                const playerName = data.name || `Player_${data.id.substring(0, 4)}`;
                this.game.uiManager.addPlayerChatMessage(playerName, data.message, false);
            }
        });

        // Handle group chat messages (visible to all)
        this.socket.on('group:chat', (data) => {
            // data: { id, message, name }
            console.log(`[SocketManager] Group chat from ${data.id}: "${data.message}"`);
            if (this.game.uiManager) {
                const playerName = data.name || `Player_${data.id.substring(0, 4)}`;
                this.game.uiManager.addGroupChatMessage(playerName, data.message, false);
            }
        });

        // Handle player held item updates
        this.socket.on('player:hold', (data) => {
            // data: { id, itemType }
            console.log(`[SocketManager] Player ${data.id} holding: ${data.itemType}`);
            this.updateRemoteHeldItem(data.id, data.itemType);
        });

        // Handle player damage
        this.socket.on('player:damage', (data) => {
            // data: { targetId, amount, sourceId }
            if (data.targetId === this.socketId) {
                console.log(`[SocketManager] I took ${data.amount} damage from ${data.sourceId}`);
                if (this.game.player && this.game.player.takeDamage) {
                    this.game.player.takeDamage(data.amount, 'Another Player');

                    // Knockback?
                    if (data.sourceId) {
                        // Find source position if possible
                        const sourceMesh = this.playerMeshes.get(data.sourceId);
                        if (sourceMesh) {
                            const dir = new THREE.Vector3().subVectors(this.game.player.position, sourceMesh.group.position).normalize();
                            dir.y = 0.5; // Slight popup
                            this.game.player.knockback(dir, 0.15);
                        }
                    }
                }
            } else {
                // Someone else took damage, show effect
                this.showDamageIndicator(data.targetId, data.amount);
            }
        });

        // Handle player actions (animations)
        this.socket.on('player:action', (data) => {
            // data: { id, action }
            console.log(`[SocketManager] Player ${data.id} action: ${data.action}`);
            this.handleRemoteAction(data.id, data.action);
        });

        // Handle remote projectile spawns (arrows, magic, etc.)
        this.socket.on('projectile:spawn', (data) => {
            // data: { id, type, pos, vel }
            console.log(`[SocketManager] Remote projectile from ${data.id}: ${data.type}`);
            this.spawnRemoteProjectile(data.type, data.pos, data.vel);
        });

        // Initialize for remote player updates (called from main game loop)
        this.lastUpdateTime = performance.now();
    }

    handleRemoteDeath(id) {
        const meshInfo = this.playerMeshes.get(id);
        if (meshInfo) {
            console.log(`[SocketManager] Handling remote death for ${id}`);
            meshInfo.isDying = true;
            meshInfo.deathTimer = 0;
        }
    }

    handleRemoteAction(id, action) {
        const meshInfo = this.playerMeshes.get(id);
        if (!meshInfo) return;

        if (action === 'swing') {
            meshInfo.isSwinging = true;
            meshInfo.swingTimer = 0;
        }
    }

    /**
     * Update remote player animations and voice state.
     * Called from the main game loop in VoxelGame.jsx
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        const now = performance.now();

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

        // deltaTime now passed in as argument

        // Get local player's current world for cross-world visibility filtering
        const localWorld = this.game.player ?
            this.getWorldFromY(this.game.player.position.y) : 'earth';

        this.playerMeshes.forEach((meshInfo, id) => {
            // 0. Cross-world visibility check - hide players in different worlds
            const remoteWorld = this.getWorldFromY(meshInfo.targetPosition.y);
            meshInfo.group.visible = (localWorld === remoteWorld);

            // 1. Interpolate Position
            // If we have a buffer, use it. Otherwise fall back to simple lerp (for now, or fully replace)
            if (meshInfo.buffer) {
                this.updateInterpolatedState(meshInfo, now);
            } else {
                // Fallback / legacy (though we init buffer now)
                meshInfo.group.position.lerp(meshInfo.targetPosition, 0.2);
            }

            // 2. Interpolate Rotation (Smooth turning) - handled in updateInterpolatedState if buffered
            if (!meshInfo.buffer) {
                let diff = meshInfo.targetRotationY - meshInfo.group.rotation.y;
                // Normalize angle diff to [-PI, PI]
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                meshInfo.group.rotation.y += diff * 0.15;
            }

            // 3. Handle Crouch Animation
            const targetCrouch = (meshInfo.buffer ? meshInfo.targetCrouch : meshInfo.isCrouching) ? 1 : 0;
            meshInfo.crouchAmount = THREE.MathUtils.lerp(meshInfo.crouchAmount, targetCrouch, 0.2);

            // Apply crouch visual - lower the body by adjusting scale.y and position.y offset
            // When crouching, shrink height to ~70% and lower position
            const crouchScale = 1 - (meshInfo.crouchAmount * 0.3); // 1.0 to 0.7
            meshInfo.group.scale.y = crouchScale;

            // Adjust position.y to keep feet on ground when scaling
            // Original model has feet at y=0, so we need to compensate for scale center
            // Scale origin is at center, so lowering the body happens automatically

            // 4. Handle Walking Animation (skip if flying - sitting pose is controlled by updateRemoteFlyingState)
            if (!meshInfo.isFlying) {
                const distToTarget = meshInfo.group.position.distanceTo(meshInfo.targetPosition);
                const isMoving = distToTarget > 0.05;

                // Smoothly transition walk amplitude
                meshInfo.walkAmplitude = THREE.MathUtils.lerp(meshInfo.walkAmplitude, isMoving ? 1 : 0, 0.1);

                if (meshInfo.walkAmplitude > 0.01) {
                    meshInfo.animationTime += deltaTime * 10; // Animation speed
                    const swing = Math.sin(meshInfo.animationTime) * 0.6 * meshInfo.walkAmplitude;

                    if (meshInfo.leftArm) meshInfo.leftArm.rotation.x = swing;
                    // If swinging, don't overwrite right arm rotation with walk animation
                    if (!meshInfo.isSwinging) {
                        if (meshInfo.rightArm) meshInfo.rightArm.rotation.x = -swing;
                    }
                    if (meshInfo.leftLeg) meshInfo.leftLeg.rotation.x = -swing;
                    if (meshInfo.rightLeg) meshInfo.rightLeg.rotation.x = swing;
                } else {
                    // Return limbs to neutral
                    if (meshInfo.leftArm) meshInfo.leftArm.rotation.x *= 0.9;

                    // Only return right arm to neutral if not swinging
                    if (!meshInfo.isSwinging) {
                        if (meshInfo.rightArm) meshInfo.rightArm.rotation.x *= 0.9;
                    }

                    if (meshInfo.leftLeg) meshInfo.leftLeg.rotation.x *= 0.9;
                    if (meshInfo.rightLeg) meshInfo.rightLeg.rotation.x *= 0.9;
                }
            }

            // Handle Swing Animation
            // Match local player's mining animation: arm raised then swung down to forward
            if (meshInfo.isSwinging) {
                meshInfo.swingTimer += deltaTime * 16; // Match local player animation speed

                // Animation runs for one full sine cycle (2*PI)
                if (meshInfo.swingTimer > Math.PI * 2) {
                    meshInfo.isSwinging = false;
                    meshInfo.swingTimer = 0;
                    if (meshInfo.rightArm) meshInfo.rightArm.rotation.x = 0;
                } else {
                    // Match local player swing: Math.sin(timer) * 2.2
                    // This goes: 0 -> up (positive) -> 0 -> down (negative) -> 0
                    // For pickaxe swing we want: raised up, then swing down forward
                    const swing = Math.sin(meshInfo.swingTimer) * 2.2;
                    if (meshInfo.rightArm) meshInfo.rightArm.rotation.x = swing;
                }
            }

            // 5. Update speech bubble timer
            if (meshInfo.speechTimer > 0) {
                meshInfo.speechTimer -= deltaTime;
                if (meshInfo.speechTimer <= 0) {
                    meshInfo.speechTimer = 0;
                    this.updateSpeechBubbleText(meshInfo, null);
                }
            }

            // 6. Handle Death Animation
            if (meshInfo.isDying) {
                meshInfo.deathTimer += deltaTime;
                // Rotate to 90 degrees (fall over)
                const targetRot = Math.PI / 2;
                // Currently rotating the whole group might affect nameplate/bubble orientation
                // Ideally we rotate just the body visual parts, but rotating the whole group is easiest for "falling over"
                // Let's rotate the 'torso' or a 'visualGroup' inside 'group' if possible.
                // Our structure: group -> [torso, headGroup, arms, legs, nameLabel, speechBubble]
                // If we rotate group.rotation.z, everything rotates.

                // We want to rotate around feet. The group origin is at feet?
                // createCharacterModel puts torso at y=1.05.
                // When we create mesh, we put group at pos.
                // So group origin IS feet.

                if (meshInfo.group.rotation.x > -Math.PI / 2) {
                    // Rotate backward (or forward?)
                    // Let's rotate around X or Z.
                    // Falling backward: rotation.x goes negative?
                    meshInfo.group.rotation.z += deltaTime * 5; // Fall sideways?
                    // Let's try falling backward (classic MC death)
                    // But we need to handle rotation Y.

                    // Actually, usually they fall on their side (Z rotation).
                    if (meshInfo.group.rotation.z < Math.PI / 2) {
                        meshInfo.group.rotation.z += deltaTime * 5;
                        if (meshInfo.group.rotation.z > Math.PI / 2) meshInfo.group.rotation.z = Math.PI / 2;
                    }
                }

                // Fade out/Remove after 2s
                if (meshInfo.deathTimer > 2.0) {
                    this.game.scene.remove(meshInfo.group);
                    this.playerMeshes.delete(id);
                }
            }
        });
    }

    updateInterpolatedState(meshInfo, now) {
        // Interpolation Delay (100ms) - allows us to be "in the past" where we have start/end frames
        const renderTime = now - 100;

        // Prune old states (keep 1-2 older than renderTime for safety)
        while (meshInfo.buffer.length > 2 && meshInfo.buffer[1].time < renderTime) {
            meshInfo.buffer.shift();
        }

        if (meshInfo.buffer.length === 0) return;

        // Ideally we find a frame "before" and "after" renderTime
        // Buffer is sorted by time.
        // Index 0 is likely before, Index 1 is likely after (due to pruning above)

        const startState = meshInfo.buffer[0];
        const endState = meshInfo.buffer.length > 1 ? meshInfo.buffer[1] : null;

        if (!endState || renderTime > endState.time) {
            // We are ahead of our latest data (lag/packet loss) -> extrapolate or clamp
            // For now, simple clamp to latest
            const latest = meshInfo.buffer[meshInfo.buffer.length - 1];
            meshInfo.group.position.copy(latest.pos);

            // Rotation smoothing even when clamped
            let diff = latest.rotY - meshInfo.group.rotation.y;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            meshInfo.group.rotation.y += diff * 0.2;

            meshInfo.targetCrouch = latest.isCrouching;
        } else {
            // Interpolate between startState and endState
            const totalDuration = endState.time - startState.time;
            const elapsed = renderTime - startState.time;
            const t = Math.max(0, Math.min(1, elapsed / totalDuration));

            meshInfo.group.position.lerpVectors(startState.pos, endState.pos, t);

            // Rotation interpolation (shortest path)
            let rotDiff = endState.rotY - startState.rotY;
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;

            // Smoothly interpolate rotation
            meshInfo.group.rotation.y = startState.rotY + rotDiff * t;

            // Crouch state
            meshInfo.targetCrouch = endState.isCrouching;
        }
    }

    /**
     * Apply world customizations (sky color, gravity, creature filter)
     * Called when joining a world or when settings are changed
     * @param {Object} world - The world object with settings and customizations
     */
    applyWorldCustomizations(world) {
        if (!world) return;

        const customizations = world.customizations;
        const settings = world.settings;

        // Apply sky color
        if (customizations?.skyColor && this.game.environment) {
            this.game.environment.applySkyColor(customizations.skyColor);
            console.log(`[SocketManager] Applied sky color: ${customizations.skyColor}`);
        }

        // Apply gravity multiplier
        if (customizations?.gravity !== undefined) {
            this.game.gravityMultiplier = customizations.gravity;
            console.log(`[SocketManager] Applied gravity multiplier: ${customizations.gravity}`);
        }

        // Apply creature filter
        if (settings?.allowedCreatures !== undefined && this.game.spawnManager) {
            this.game.spawnManager.setAllowedCreatures(settings.allowedCreatures);
            console.log(`[SocketManager] Applied creature filter:`, settings.allowedCreatures);
        }

        // Apply time frozen setting
        if (settings?.timeFrozen !== undefined && this.game.environment) {
            this.game.environment.freezeTime(settings.timeFrozen);
            console.log(`[SocketManager] Time frozen: ${settings.timeFrozen}`);
        }
    }

    joinGame() {
        if (this.socket && this.socket.connected) {
            const playerName = localStorage.getItem('communityUsername') || `Player_${Date.now().toString(36).slice(-4)}`;
            const shirtColor = localStorage.getItem('settings_shirt_color');

            console.log('[SocketManager] Requesting to join game as:', playerName, 'with color:', shirtColor);
            this.socket.emit('join_game', {
                name: playerName,
                shirtColor: shirtColor ? parseInt(shirtColor) : null
            });
        }
    }

    /**
     * Join a specific world by ID
     * @param {string} worldId - The world ID to join
     */
    joinWorld(worldId) {
        if (this.socket && this.socket.connected) {
            const playerName = localStorage.getItem('communityUsername') || `Player_${Date.now().toString(36).slice(-4)}`;
            const shirtColor = localStorage.getItem('settings_shirt_color');

            // Get Firebase user ID if logged in
            const userId = auth.currentUser?.uid || null;

            console.log('[SocketManager] Requesting to join world:', worldId, 'as:', playerName, 'userId:', userId);
            this.socket.emit('join_world', {
                worldId: worldId,
                name: playerName,
                shirtColor: shirtColor ? parseInt(shirtColor) : null,
                userId: userId
            });
        }
    }

    /**
     * Extract world ID from URL path (e.g., /world/abc123 -> 'abc123')
     * @returns {string|null} World ID or null if not in URL
     */
    getWorldIdFromUrl() {
        const path = window.location.pathname;
        const match = path.match(/^\/world\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    }

    /**
     * Get the current world ID
     * @returns {string|null}
     */
    getCurrentWorldId() {
        return this.worldId;
    }

    /**
     * Get current world data
     * @returns {Object|null}
     */
    getCurrentWorld() {
        return this.world;
    }

    /**
     * Get current permissions in the world
     * @returns {Object|null}
     */
    getPermissions() {
        return this.permissions;
    }

    /**
     * Check if player has permission to build
     * @returns {boolean}
     */
    canBuild() {
        return this.permissions?.canBuild !== false;
    }

    /**
     * Check if player is the world owner
     * @returns {boolean}
     */
    isWorldOwner() {
        return this.permissions?.isOwner === true;
    }

    /**
     * Check if connected and in a room
     */
    isConnected() {
        return this.socket && this.socket.connected && this.roomId;
    }

    /**
     * Determine which world a player is in based on Y position.
     * Used for cross-world visibility filtering.
     * @param {number} y - Y coordinate
     * @returns {string} - 'earth', 'moon', 'crystal', 'lava'
     */
    getWorldFromY(y) {
        const chunkY = Math.floor(y / 16);

        // Check alien worlds first (higher Y values)
        if (chunkY >= 60 && chunkY < 68) return 'lava';
        if (chunkY >= 50 && chunkY < 58) return 'crystal';
        if (chunkY >= 40 && chunkY < 48) return 'moon';

        // Default to earth
        return 'earth';
    }

    /**
     * Send position update
     * @param {Object} pos - {x, y, z}
     * @param {number} rotY - Rotation around Y axis
     * @param {boolean} isCrouching - Whether the player is crouching
     * @param {boolean} isFlying - Whether the player is flying on a broom
     */
    sendPosition(pos, rotY, isCrouching = false, isFlying = false) {
        if (!this.isConnected()) return;

        // Convert THREE.Vector3 to plain object for socket transmission
        const posData = { x: pos.x, y: pos.y, z: pos.z };

        this.socket.emit('player:move', { pos: posData, rotY, isCrouching, isFlying, health: this.game.player.health, maxHealth: this.game.player.maxHealth });
    }

    /**
     * Force send full player state (position, rotation, health, etc.)
     * Useful for syncing non-movement state changes like health updates.
     */
    sendPlayerState() {
        if (!this.isConnected() || !this.game.player) return;

        const p = this.game.player;
        const isCrouching = this.game.inputManager ? this.game.inputManager.isActionActive('SNEAK') : false;
        const isFlying = p.isFlying || false;

        this.sendPosition(p.position, p.rotation.y, isCrouching, isFlying);
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
     * Send held item update to server
     * @param {string} itemType - The type/name of the item
     */
    sendHeldItem(itemType) {
        if (!this.isConnected()) return;
        this.socket.emit('player:hold', { itemType });
    }

    sendDeath() {
        if (!this.isConnected()) return;
        this.socket.emit('player:death');
    }

    /**
     * Send damage event to server
     * @param {string} targetId - ID of the player being hit
     * @param {number} amount - Amount of damage
     */
    sendDamage(targetId, amount) {
        if (!this.isConnected()) return;
        this.socket.emit('player:damage', { targetId, amount });
    }

    /**
     * Send generic player action (e.g., 'swing')
     * @param {string} action - Action type
     */
    sendPlayerAction(action) {
        if (!this.isConnected()) return;
        this.socket.emit('player:action', { action });
    }

    /**
     * Send projectile spawn event to other players
     * @param {string} type - Projectile type ('arrow', 'magic', 'shrink', 'levitation', 'giant', 'growth')
     * @param {Object} pos - Starting position {x, y, z}
     * @param {Object} vel - Velocity {x, y, z}
     */
    sendProjectileSpawn(type, pos, vel) {
        if (!this.isConnected()) return;
        console.log(`[SocketManager] Sending projectile spawn: ${type}`);
        this.socket.emit('projectile:spawn', {
            type,
            pos: { x: pos.x, y: pos.y, z: pos.z },
            vel: { x: vel.x, y: vel.y, z: vel.z }
        });
    }

    /**
     * Send shirt color update to server
     * @param {number} shirtColor - The hex color value
     */
    sendShirtColor(shirtColor) {
        if (!this.isConnected()) return;
        console.log('[SocketManager] Sending shirt color update:', shirtColor);
        this.socket.emit('player:color', { shirtColor });
    }

    // === Soccer Ball Sync Methods ===

    /**
     * Send soccer ball state to other players (called by host only)
     * @param {Object} ball - The soccer ball entity
     */
    sendSoccerBallState(ball) {
        if (!this.isConnected() || !this.isSoccerBallHost) return;

        const now = Date.now();
        if (now - this.lastSoccerBallUpdate < this.soccerBallSyncRate) return;
        this.lastSoccerBallUpdate = now;

        this.socket.emit('soccer:ball_state', {
            pos: { x: ball.position.x, y: ball.position.y, z: ball.position.z },
            vel: { x: ball.velocity.x, y: ball.velocity.y, z: ball.velocity.z }
        });
    }

    /**
     * Send soccer ball kick event
     */
    sendSoccerBallKick() {
        if (!this.isConnected()) return;
        this.socket.emit('soccer:ball_kick', { playerId: this.socketId });
    }

    /**
     * Send goal scored event
     * @param {string} scoringSide - 'blue' or 'orange'
     * @param {Object} scores - Current scores { blue, orange }
     */
    sendSoccerGoal(scoringSide, scores) {
        if (!this.isConnected() || !this.isSoccerBallHost) return;
        this.socket.emit('soccer:goal', { scoringSide, scores });
    }

    /**
     * Send game over event
     * @param {string} winner - 'blue' or 'orange'
     * @param {Object} scores - Final scores { blue, orange }
     */
    sendSoccerGameOver(winner, scores) {
        if (!this.isConnected() || !this.isSoccerBallHost) return;
        this.socket.emit('soccer:game_over', { winner, scores });
    }

    /**
     * Send game reset event
     */
    sendSoccerGameReset() {
        if (!this.isConnected() || !this.isSoccerBallHost) return;
        this.socket.emit('soccer:game_reset', {});
    }

    /**
     * Send ball reset event
     * @param {Object} pos - Reset position {x, y, z}
     */
    sendSoccerBallReset(pos) {
        if (!this.isConnected() || !this.isSoccerBallHost) return;
        this.socket.emit('soccer:ball_reset', { pos });
    }

    /**
     * Request to become soccer ball host (called when entering Soccer World)
     */
    requestSoccerHost() {
        if (!this.isConnected()) return;
        console.log('[SocketManager] Requesting soccer ball host status');
        this.socket.emit('soccer:request_host');
    }

    /**
     * Release soccer ball host status (called when leaving Soccer World)
     */
    releaseSoccerHost() {
        if (!this.isConnected()) return;
        this.isSoccerBallHost = false;
        this.socket.emit('soccer:release_host');
    }

    /**
     * Spawn a projectile from a remote player (called when receiving projectile:spawn event)
     * @param {string} type - Projectile type
     * @param {Object} pos - Position {x, y, z}
     * @param {Object} vel - Velocity {x, y, z}
     */
    spawnRemoteProjectile(type, pos, vel) {
        const position = new THREE.Vector3(pos.x, pos.y, pos.z);
        const velocity = new THREE.Vector3(vel.x, vel.y, vel.z);

        console.log(`[SocketManager] Spawning remote projectile: ${type} at`, pos);

        switch (type) {
            case 'arrow':
                // Pass isRemote = true so arrow can damage local player
                this.game.spawnArrow(position, velocity, null, true);
                break;
            case 'magic':
                this.game.spawnMagicProjectile(position, velocity, true);
                break;
            case 'shrink':
                this.game.spawnShrinkProjectile(position, velocity, true);
                break;
            case 'levitation':
                this.game.spawnLevitationProjectile(position, velocity, true);
                break;
            case 'giant':
                this.game.spawnGiantProjectile(position, velocity, true);
                break;
            case 'growth':
                this.game.spawnGrowthProjectile(position, velocity, true);
                break;
            default:
                console.warn(`[SocketManager] Unknown remote projectile type: ${type}`);
        }
    }

    /**
     * Show damage indicator above a player
     */
    showDamageIndicator(playerId, amount) {
        const meshInfo = this.playerMeshes.get(playerId);
        if (!meshInfo || !meshInfo.group) return;

        // Initialize originalColors map if not set (stores color by mesh uuid)
        if (!meshInfo.originalColors) {
            meshInfo.originalColors = new Map();
            meshInfo.group.traverse((child) => {
                if (child.isMesh && child.material && child.material.color) {
                    meshInfo.originalColors.set(child.uuid, child.material.color.getHex());
                }
            });
        }

        // Set all meshes to red
        meshInfo.group.traverse((child) => {
            if (child.isMesh && child.material && child.material.color) {
                child.material.color.setHex(0xFF0000);
            }
        });

        // Clear any existing flash timeout
        if (meshInfo.flashTimeout) {
            clearTimeout(meshInfo.flashTimeout);
        }

        // Reset colors after delay
        meshInfo.flashTimeout = setTimeout(() => {
            if (!meshInfo.group) return;

            meshInfo.group.traverse((child) => {
                if (child.isMesh && child.material && child.material.color) {
                    const originalColor = meshInfo.originalColors?.get(child.uuid);
                    if (originalColor !== undefined) {
                        child.material.color.setHex(originalColor);
                    }
                }
            });
            meshInfo.flashTimeout = null;
        }, 500); // 500ms flash duration

        // Removed text bubble damage indicator
    }


    /**
     * Update the held item visual for a remote player
     */
    updateRemoteHeldItem(id, itemType) {
        const meshInfo = this.playerMeshes.get(id);
        if (!meshInfo || !meshInfo.toolAttachment) return;

        // Clear existing children
        while (meshInfo.toolAttachment.children.length > 0) {
            meshInfo.toolAttachment.remove(meshInfo.toolAttachment.children[0]);
        }

        if (!itemType) return;

        let itemMesh = null;

        // Use ItemFactory to create the mesh
        switch (itemType) {
            case 'pickaxe': itemMesh = ItemFactory.createPickaxe(); break;
            case 'sword': itemMesh = ItemFactory.createSword(); break;
            case 'bow': itemMesh = ItemFactory.createBow(); break;
            case 'wand': itemMesh = ItemFactory.createWand(0xFF00FF); break;
            case 'levitation_wand': itemMesh = ItemFactory.createWand(0xFFFF00); break;
            case 'shrink_wand': itemMesh = ItemFactory.createWand(0x00FFFF); break;
            case 'growth_wand': itemMesh = ItemFactory.createWand(0x00FF00); break;
            case 'ride_wand': itemMesh = ItemFactory.createWand(0x8B4513); break;
            case 'wizard_tower_wand': itemMesh = ItemFactory.createWand(0x8A2BE2); break;
            // Add capture_wand?
            case 'capture_wand': itemMesh = ItemFactory.createWand(0xFFA500); break; // Orange

            case 'apple': itemMesh = ItemFactory.createFood('apple'); break;
            case 'bread': itemMesh = ItemFactory.createFood('bread'); break;
            case 'chocolate_bar': itemMesh = ItemFactory.createFood('chocolate_bar'); break;

            case 'chair': itemMesh = ItemFactory.createFurniture('chair'); break;
            case 'table': itemMesh = ItemFactory.createFurniture('table'); break;
            case 'couch': itemMesh = ItemFactory.createFurniture('couch'); break;
            case 'binoculars': itemMesh = ItemFactory.createBinoculars(); break;

            case 'flying_broom':
                // For now just show standard broom handle, no riding logic yet for remote
                // Or we could duplicate the broom creation if needed, but ItemFactory doesn't have it yet.
                // Let's make a simple stick for now if factory misses it, or add to factory.
                // I'll skip if not in factory to avoid errors, or add fallback.
                // Actually I should add broom to factory? 
                // For safety catch block:
                break;
            default:
                // Check if it's a block? simple cube?
                // For now, ignore unknown
                break;
        }

        if (itemMesh) {
            meshInfo.toolAttachment.add(itemMesh);
        }
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

                        // Connect to any pending peers that joined before we initialized
                        if (this.pendingPeerIds && this.pendingPeerIds.size > 0) {
                            console.log(`[SocketManager] Connecting to ${this.pendingPeerIds.size} pending peers...`);
                            for (const [pendingSocketId, pendingPeerId] of this.pendingPeerIds) {
                                if (pendingSocketId !== this.socketId) {
                                    console.log(`[SocketManager] Calling pending peer: ${pendingPeerId}`);
                                    this.callPeer(pendingPeerId);
                                }
                            }
                        }
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
            console.warn(`[SocketManager] peerJs=${!!this.peerJs}, localStream=${!!this.localStream}`);
            return;
        }
        if (this.activeCalls.has(peerId)) {
            console.log(`[SocketManager] Already in call with ${peerId}`);
            return;
        }

        console.log(`[SocketManager] Calling peer: ${peerId}`);
        console.log(`[SocketManager] PeerJS connection open: ${this.peerJs.open}, disconnected: ${this.peerJs.disconnected}`);

        try {
            const call = this.peerJs.call(peerId, this.localStream);

            if (!call) {
                console.error(`[SocketManager] Failed to create call to ${peerId} - call object is null`);
                return;
            }

            call.on('stream', (remoteStream) => {
                console.log(`[SocketManager] Received stream from ${peerId}`);
                console.log(`[SocketManager] Stream tracks: ${remoteStream.getTracks().length}, audio: ${remoteStream.getAudioTracks().length}`);
                this.setupSpatialAudioForPeer(peerId, remoteStream);
            });

            call.on('error', (err) => {
                console.error(`[SocketManager] Call error with ${peerId}:`, err);
                this.activeCalls.delete(peerId);
            });

            call.on('close', () => {
                console.log(`[SocketManager] Call with ${peerId} closed`);
                this.activeCalls.delete(peerId);
            });

            this.activeCalls.set(peerId, call);
            console.log(`[SocketManager] Call initiated to ${peerId}, active calls: ${this.activeCalls.size}`);
        } catch (error) {
            console.error(`[SocketManager] Exception calling peer ${peerId}:`, error);
        }
    }

    setupSpatialAudioForPeer(peerId, stream) {
        // For now, just play the audio directly (non-spatial)
        // We can add spatial audio later once basic audio works
        console.log(`[SocketManager] Setting up audio for ${peerId}`);

        // Check if we already have an audio element for this peer
        if (!this.peerAudioElements) {
            this.peerAudioElements = new Map();
        }
        if (this.peerAudioElements.has(peerId)) {
            console.log(`[SocketManager] Audio element already exists for ${peerId}, updating stream`);
            const existingAudio = this.peerAudioElements.get(peerId);
            existingAudio.srcObject = stream;
            return;
        }

        // Simple approach: create an audio element
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.volume = 1.0;

        // Monitor audio for debugging
        audio.onloadedmetadata = () => {
            console.log(`[SocketManager] Audio metadata loaded for ${peerId}`);
        };
        audio.onplay = () => {
            console.log(`[SocketManager] Audio started playing for ${peerId}`);
        };
        audio.onerror = (e) => {
            console.error(`[SocketManager] Audio error for ${peerId}:`, e);
        };

        // Store the audio element
        this.peerAudioElements.set(peerId, audio);

        // Play (may need user interaction)
        audio.play().then(() => {
            console.log(`[SocketManager] Audio play() succeeded for ${peerId}`);
        }).catch(e => {
            console.warn('[SocketManager] Audio autoplay blocked, will play on interaction:', e.message);
            const playOnce = () => {
                audio.play().then(() => {
                    console.log(`[SocketManager] Audio play() succeeded after click for ${peerId}`);
                }).catch(err => {
                    console.error(`[SocketManager] Audio play() failed after click for ${peerId}:`, err);
                });
                window.removeEventListener('click', playOnce);
            };
            window.addEventListener('click', playOnce);
        });

        console.log(`[SocketManager] Audio element created for ${peerId}, active audio elements: ${this.peerAudioElements.size}`);
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

    updatePlayerMesh(id, pos, rotY, name, isCrouching = false, health, maxHealth, shirtColor, isFlying = false) {
        let meshInfo = this.playerMeshes.get(id);

        if (!meshInfo || meshInfo instanceof THREE.Object3D) {
            if (meshInfo instanceof THREE.Object3D) {
                this.game.scene.remove(meshInfo);
            }
            // Get stored name from player:joined event if not provided
            const playerName = name || (this.playerNames?.get(id)) || `Player_${id.substring(0, 4)}`;
            meshInfo = this.createCharacterModel(id, playerName, shirtColor);

            // Check for pending held item
            if (this.pendingHeldItems && this.pendingHeldItems.has(id)) {
                const itemType = this.pendingHeldItems.get(id);
                console.log(`[SocketManager] Applying pending held item for ${id}: ${itemType}`);
                // We need to wait for mesh to be fully ready? createCharacterModel returns the struct with toolAttachment.
                // But we haven't set it in playerMeshes yet (line 1014).
                // Actually we can just call it after setting into map.
            }

            // Init Buffer
            meshInfo.buffer = [];

            this.playerMeshes.set(id, meshInfo);

            // Apply pending held item now that it's in the map
            if (this.pendingHeldItems && this.pendingHeldItems.has(id)) {
                this.updateRemoteHeldItem(id, this.pendingHeldItems.get(id));
                this.pendingHeldItems.delete(id);
            }

            // Initial position
            meshInfo.group.position.copy(pos);
            meshInfo.targetPosition.copy(pos);

            // Initial state pushed to buffer
            meshInfo.buffer.push({
                time: performance.now(),
                pos: new THREE.Vector3(pos.x, pos.y, pos.z),
                rotY: rotY !== undefined ? rotY : 0,
                isCrouching: isCrouching,
                isFlying: isFlying
            });

            // Check if we have a pending stream for this mesh
            const pendingStream = this.pendingStreams.get(id);
            if (pendingStream) {
                console.log(`[SocketManager] Found pending stream for ${id}, setting up spatial audio now.`);
                this.setupSpatialAudio(id, pendingStream);
                this.pendingStreams.delete(id);
            }
            if (health !== undefined) {
                this.updateHealthBar(meshInfo, health, maxHealth);
            }

            // Apply initial flying state
            meshInfo.isFlying = isFlying;
            this.updateRemoteFlyingState(meshInfo, isFlying);
            return;
        }

        // --- Buffer Update ---
        // Skip position updates if player is dying (prevents moving in circle during death animation)
        if (meshInfo.isDying) {
            // Only process health updates for dying players
            if (health !== undefined) {
                this.updateHealthBar(meshInfo, health, maxHealth);
            }
            return;
        }

        // Push new state with current timestamp
        const state = {
            time: performance.now(),
            pos: new THREE.Vector3(pos.x, pos.y, pos.z),
            rotY: rotY !== undefined ? rotY : meshInfo.group.rotation.y, // Fallback if undefined
            isCrouching: isCrouching,
            isFlying: isFlying
        };

        // If undefined rotation, try to infer header? Or usually it's sent.
        if (rotY === undefined) {
            const dx = pos.x - meshInfo.targetPosition.x;
            const dz = pos.z - meshInfo.targetPosition.z;
            if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
                state.rotY = Math.atan2(dx, dz) + Math.PI;
            }
        }

        meshInfo.buffer.push(state);

        // Keep buffer sanity
        if (meshInfo.buffer.length > 20) {
            meshInfo.buffer.shift();
        }

        meshInfo.targetPosition.copy(pos);
        if (rotY !== undefined) meshInfo.targetRotationY = rotY;
        meshInfo.isCrouching = isCrouching;

        // Update flying state if changed
        if (meshInfo.isFlying !== isFlying) {
            meshInfo.isFlying = isFlying;
            this.updateRemoteFlyingState(meshInfo, isFlying);
        }

        if (health !== undefined) {
            this.updateHealthBar(meshInfo, health, maxHealth);

            // Trigger death animation when health reaches 0
            if (health <= 0 && !meshInfo.isDying) {
                console.log(`[SocketManager] Player ${id} died, starting death animation`);
                this.handleRemoteDeath(id);
            }
        }
    }

    /**
     * Update remote player's flying state (show/hide broom and sitting pose)
     */
    updateRemoteFlyingState(meshInfo, isFlying) {
        if (!meshInfo) return;

        if (isFlying) {
            // Show riding broom
            if (meshInfo.ridingBroom) {
                meshInfo.ridingBroom.visible = true;
            }
            // Hide held broom (if any)
            if (meshInfo.heldBroom) {
                meshInfo.heldBroom.visible = false;
            }
            // Set sitting pose - legs forward
            if (meshInfo.leftLeg) meshInfo.leftLeg.rotation.x = Math.PI / 2;
            if (meshInfo.rightLeg) meshInfo.rightLeg.rotation.x = Math.PI / 2;
            // Arm position - holding broom handle
            if (meshInfo.rightArm) meshInfo.rightArm.rotation.x = Math.PI / 3;
        } else {
            // Hide riding broom
            if (meshInfo.ridingBroom) {
                meshInfo.ridingBroom.visible = false;
            }
            // Reset pose (legs will be controlled by walk animation)
            // Don't reset legs here - let the update() function handle walking animation
        }
    }



    createCharacterModel(id, playerName = 'Player', shirtColor = null) {
        const group = new THREE.Group();

        // Create name label above head
        const nameLabel = this.createNameLabelSprite(playerName);
        nameLabel.position.set(0, 2.9, 0); // Above head, above speech bubble
        // Ensure nameLabel is accessible for health bar attachment or similar
        group.add(nameLabel);

        // Create Health Bar
        const healthBar = this.createHealthBarSprite();
        healthBar.position.set(0, 2.6, 0); // Below name label
        group.add(healthBar);

        // Use cached shared geometries and materials
        const { geometries, materials: sharedMaterials } = SocketManager.getPlayerModelAssets();

        // Clone materials for this instance so each player has independent colors
        const materials = {};
        for (const [key, mat] of Object.entries(sharedMaterials)) {
            materials[key] = mat.clone();
        }

        // Randomize shirt color for each player if not provided
        if (shirtColor !== null && shirtColor !== undefined) {
            materials.shirt.color.setHex(shirtColor);
        } else {
            const shirtColors = [
                0xFF5733, // Orange-red
                0x33FF57, // Green
                0x3357FF, // Blue
                0xFF33A8, // Pink
                0xFFD700, // Gold
                0x00CED1, // Dark cyan
                0x9400D3, // Dark violet
                0xFF6347, // Tomato
                0x20B2AA, // Light sea green
                0x8B4513, // Saddle brown
                0x4169E1, // Royal blue
                0xDC143C, // Crimson
            ];
            const randomShirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
            materials.shirt.color.setHex(randomShirtColor);
        }

        // Torso
        const torso = new THREE.Mesh(geometries.torso, materials.shirt);
        torso.position.y = 1.05; // Slightly adjusted from 1.1 for better ground contact
        group.add(torso);

        // Head Group
        const headGroup = new THREE.Group();
        headGroup.position.y = 1.675; // Positioned atop torso
        group.add(headGroup);

        const head = new THREE.Mesh(geometries.head, materials.skin);
        headGroup.add(head);

        // Hair (Hat layer)
        const hair = new THREE.Mesh(geometries.hair, materials.hair);
        hair.position.y = 0.2;
        headGroup.add(hair);

        // Facial Features (using cached geometries)
        const createEye = (x) => {
            const eye = new THREE.Group();
            const white = new THREE.Mesh(geometries.eye, materials.eyeWhite);
            const pupil = new THREE.Mesh(geometries.pupil, materials.pupil);
            pupil.position.z = -0.03; // Stick out front (-Z for this model orientation)
            eye.add(white, pupil);
            eye.position.set(x, 0, -0.251);
            return eye;
        };
        headGroup.add(createEye(-0.12), createEye(0.12));

        const mouth = new THREE.Mesh(geometries.mouth, materials.hair);
        mouth.position.set(0, -0.12, -0.251);
        headGroup.add(mouth);

        // Limbs function using cached geometry
        const createLimb = (y, xOffset, mat) => {
            const pivot = new THREE.Group();
            pivot.position.set(xOffset, y, 0);
            const mesh = new THREE.Mesh(geometries.limb, mat);
            mesh.position.y = -0.375; // Pivot at top
            pivot.add(mesh);
            return pivot;
        };

        const leftArm = createLimb(1.4, -0.375, materials.skin);
        const rightArm = createLimb(1.4, 0.375, materials.skin);
        const leftLeg = createLimb(0.7, -0.125, materials.pants);
        const rightLeg = createLimb(0.7, 0.125, materials.pants);

        // Create Tool Attachment Point
        const toolAttachment = new THREE.Group();
        toolAttachment.position.set(0, -0.75, 0);
        toolAttachment.rotation.set(Math.PI / 2, Math.PI / 2, 0);

        // Add to the right arm pivot (which rotates)
        rightArm.add(toolAttachment);

        group.add(leftArm, rightArm, leftLeg, rightLeg);
        this.game.scene.add(group);

        // Create speech bubble for chat
        const speechBubble = this.createSpeechBubbleSprite();
        speechBubble.position.set(0, 2.3, 0); // Above head
        speechBubble.visible = false;
        group.add(speechBubble);

        // Create riding broom (for flying state) - positioned at hip/seat level
        const ridingBroom = this.createRidingBroom();
        ridingBroom.position.set(0, 0.5, -0.3); // At seat level (torso is at y=1.05, legs at y=0.7)
        ridingBroom.rotation.set(-Math.PI / 2, 0, 0); // Flat forward (90 deg)
        ridingBroom.visible = false;
        group.add(ridingBroom);

        console.log(`[SocketManager] Created character for ${id} (using cached assets)`);

        return {
            group,
            leftArm,
            rightArm,
            leftLeg,
            rightLeg,
            targetPosition: new THREE.Vector3(),
            targetRotationY: 0,
            walkAmplitude: 0,
            animationTime: 0,
            // Speech bubble properties
            speechBubble,
            speechCanvas: speechBubble.userData.canvas,
            speechContext: speechBubble.userData.context,
            speechTexture: speechBubble.userData.texture,
            speechTimer: 0,
            // Crouch state
            isCrouching: false,
            crouchAmount: 0,  // For smooth interpolation
            toolAttachment: toolAttachment, // Exposed for updates
            healthBar: healthBar,
            isDying: false,
            deathTimer: 0,
            shirtMaterial: materials.shirt,
            // Flying state
            ridingBroom: ridingBroom,
            isFlying: false
        };
    }

    /**
     * Create a broom model for remote players when they are flying
     */
    createRidingBroom() {
        const broomGroup = new THREE.Group();

        // Handle (Stick)
        const handleColor = 0x5C4033;
        const handleGeo = new THREE.BoxGeometry(0.08, 2.0, 0.08);
        const handleMat = new THREE.MeshLambertMaterial({ color: handleColor });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.y = -0.3;
        broomGroup.add(handle);

        // Brush (Straw)
        const brushColor = 0xC19A6B; // Wheat/Tan
        const brushGeo = new THREE.BoxGeometry(0.24, 0.8, 0.24);
        const brushMat = new THREE.MeshLambertMaterial({ color: brushColor });
        const brush = new THREE.Mesh(brushGeo, brushMat);
        brush.position.y = -0.8; // Bottom
        broomGroup.add(brush);

        return broomGroup;
    }

    createHealthBarSprite() {
        const spriteOriginal = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x00FF00 }));
        spriteOriginal.scale.set(0.8, 0.1, 1);

        // We need a background red bar and a foreground green bar.
        // A single canvas texture is better.

        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 8;
        const ctx = canvas.getContext('2d');

        // Draw full green initially
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(0, 0, 64, 8);

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(1.0, 0.125, 1);

        sprite.userData = { canvas, ctx, texture };
        return sprite;
    }

    updateHealthBar(meshInfo, health, maxHealth) {
        if (!meshInfo || !meshInfo.healthBar) return;

        // Fallback for missing maxHealth
        if (!maxHealth) maxHealth = 20; // Default
        if (health === undefined) health = maxHealth;

        const pct = Math.max(0, Math.min(1, health / maxHealth));

        const { canvas, ctx, texture } = meshInfo.healthBar.userData;

        // Red background
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Green foreground
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(0, 0, canvas.width * pct, canvas.height);

        texture.needsUpdate = true;
    }


    /**
     * Create a speech bubble sprite with canvas texture
     */
    createSpeechBubbleSprite() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const context = canvas.getContext('2d');

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });

        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(2.5, 0.625, 1);

        // Store references for later updates
        sprite.userData = { canvas, context, texture };

        return sprite;
    }

    /**
     * Create a name label sprite to show player name above head
     */
    createNameLabelSprite(name) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Clear and draw background
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Semi-transparent black background pill
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        const padding = 10;
        const radius = 12;
        if (ctx.roundRect) {
            ctx.roundRect(padding, padding, canvas.width - padding * 2, canvas.height - padding * 2, radius);
        } else {
            ctx.rect(padding, padding, canvas.width - padding * 2, canvas.height - padding * 2);
        }
        ctx.fill();

        // Draw name text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Truncate long names
        const displayName = name.length > 16 ? name.slice(0, 14) + '...' : name;
        ctx.fillText(displayName, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });

        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(1.5, 0.375, 1);
        sprite.userData = { canvas, ctx, texture, name };

        return sprite;
    }

    /**
     * Update a speech bubble's text
     */
    updateSpeechBubbleText(meshInfo, text) {
        if (!meshInfo || !meshInfo.speechContext) return;

        const ctx = meshInfo.speechContext;
        const canvas = meshInfo.speechCanvas;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!text) {
            meshInfo.speechBubble.visible = false;
            return;
        }

        // Draw bubble background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;

        // Rounded rectangle
        const padding = 20;
        const radius = 20;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(padding, padding, canvas.width - padding * 2, canvas.height - padding * 2, radius);
        } else {
            ctx.rect(padding, padding, canvas.width - padding * 2, canvas.height - padding * 2);
        }
        ctx.fill();
        ctx.stroke();

        // Draw text
        ctx.fillStyle = '#333';
        ctx.font = 'bold 28px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Truncate long messages
        const maxLength = 40;
        const displayText = text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text;
        ctx.fillText(displayText, canvas.width / 2, canvas.height / 2);

        meshInfo.speechTexture.needsUpdate = true;
        meshInfo.speechBubble.visible = true;
    }

    /**
     * Show a chat bubble above a remote player
     */
    showPlayerChatBubble(playerId, message, duration = 5) {
        const meshInfo = this.playerMeshes.get(playerId);
        if (!meshInfo) {
            console.warn(`[SocketManager] Cannot show chat bubble: player ${playerId} not found`);
            return;
        }

        this.updateSpeechBubbleText(meshInfo, message);
        meshInfo.speechTimer = duration;

        // Also add to chat panel as a player message
        if (this.game.uiManager) {
            this.game.uiManager.addChatMessage('player', `Player: ${message}`);
        }
    }

    /**
     * Send a chat message to other players (called from UI)
     */
    sendChatMessage(message) {
        if (!message || !message.trim()) return;
        if (!this.isConnected()) {
            console.warn('[SocketManager] Cannot send chat: not connected');
            return;
        }

        const trimmedMessage = message.trim();
        console.log(`[SocketManager] Sending chat: "${trimmedMessage}"`);
        this.socket.emit('player:chat', { message: trimmedMessage });

        // Show speech bubble on local player
        if (this.game.player) {
            this.game.player.showSpeechBubble(trimmedMessage, 5);
        }
    }

    /**
     * Send a group chat message to all players (no speech bubble)
     */
    sendGroupChatMessage(message) {
        if (!message || !message.trim()) return;
        if (!this.isConnected()) {
            console.warn('[SocketManager] Cannot send group chat: not connected');
            return;
        }

        const trimmedMessage = message.trim();
        console.log(`[SocketManager] Sending group chat: "${trimmedMessage}"`);
        this.socket.emit('group:chat', { message: trimmedMessage });
    }
}
