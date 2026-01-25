import * as THREE from 'three';
import { Peer } from 'peerjs';

/**
 * VoiceChatManager - Handles PeerJS voice chat with spatial audio
 */
export class VoiceChatManager {
    constructor(game, socketManager) {
        this.game = game;
        this.socketManager = socketManager;

        // Voice Chat (PeerJS)
        this.localStream = null;
        this.peerJs = null;
        this.activeCalls = new Map(); // peerId -> MediaConnection
        this.pendingStreams = new Map(); // id -> MediaStream (if mesh not ready)
        this.pendingPeerIds = new Map(); // socketId -> peerId
        this.peerAudioElements = new Map(); // peerId -> HTMLAudioElement
        this.voiceEnabled = localStorage.getItem('settings_voice') === 'true';
        this.lastVoiceState = false;
    }

    /**
     * Convert socket.io ID to PeerJS-safe ID (remove special chars)
     */
    socketIdToPeerId(socketId) {
        return 'mc_' + socketId.replace(/[^a-zA-Z0-9]/g, '');
    }

    /**
     * Enable or disable voice chat
     * @param {boolean} enabled
     */
    setVoiceChatEnabled(enabled) {
        this.voiceEnabled = enabled;
        console.log(`[VoiceChatManager] Voice Chat Setting: ${enabled}`);

        if (enabled) {
            this.initVoiceChat();
        } else {
            // Mute local stream when disabled
            if (this.localStream) {
                this.localStream.getAudioTracks().forEach(t => t.enabled = false);
            }
        }
    }

    /**
     * Initialize PeerJS voice chat
     */
    initVoiceChat() {
        if (!this.voiceEnabled) return;
        if (this.localStream) return;

        console.log('[VoiceChatManager] Initializing PeerJS Voice Chat...');

        // Get microphone first
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(stream => {
                console.log('[VoiceChatManager] Microphone access granted.');
                this.localStream = stream;

                // Mute by default for PTT (push-to-talk)
                stream.getAudioTracks().forEach(t => t.enabled = false);

                // Create PeerJS instance
                const socketId = this.socketManager.socketId;
                const peerId = this.socketIdToPeerId(socketId);
                console.log(`[VoiceChatManager] Creating PeerJS with ID: ${peerId}`);

                this.peerJs = new Peer(peerId);

                this.peerJs.on('open', (id) => {
                    console.log('[VoiceChatManager] PeerJS connected with ID:', id);
                    const socket = this.socketManager.socket;
                    const roomId = this.socketManager.roomId;

                    if (socket && roomId) {
                        socket.emit('peerjs:id', { peerId: id });

                        // Connect to any pending peers that joined before we initialized
                        if (this.pendingPeerIds && this.pendingPeerIds.size > 0) {
                            console.log(`[VoiceChatManager] Connecting to ${this.pendingPeerIds.size} pending peers...`);
                            for (const [pendingSocketId, pendingPeerId] of this.pendingPeerIds) {
                                if (pendingSocketId !== socketId) {
                                    console.log(`[VoiceChatManager] Calling pending peer: ${pendingPeerId}`);
                                    this.callPeer(pendingPeerId);
                                }
                            }
                        }
                    }
                });

                this.peerJs.on('call', (call) => {
                    console.log(`[VoiceChatManager] Incoming call from ${call.peer}`);
                    call.answer(this.localStream);

                    call.on('stream', (remoteStream) => {
                        console.log(`[VoiceChatManager] Received stream from ${call.peer}`);
                        this.setupSpatialAudioForPeer(call.peer, remoteStream);
                    });

                    call.on('error', (err) => {
                        console.error(`[VoiceChatManager] Call error:`, err);
                    });

                    this.activeCalls.set(call.peer, call);
                });

                this.peerJs.on('error', (err) => {
                    console.error('[VoiceChatManager] PeerJS error:', err);
                });
            })
            .catch(err => {
                console.error('[VoiceChatManager] Failed to get local stream', err);
                this.game.uiManager?.addChatMessage('system', 'Microphone access denied. Voice chat disabled.');
            });
    }

    /**
     * Call a peer to establish voice connection
     * @param {string} peerId - The PeerJS ID to call
     */
    callPeer(peerId) {
        if (!this.peerJs || !this.localStream) {
            console.warn('[VoiceChatManager] Cannot call peer: PeerJS or stream not ready');
            return;
        }
        if (this.activeCalls.has(peerId)) {
            console.log(`[VoiceChatManager] Already in call with ${peerId}`);
            return;
        }

        console.log(`[VoiceChatManager] Calling peer: ${peerId}`);

        try {
            const call = this.peerJs.call(peerId, this.localStream);

            if (!call) {
                console.error(`[VoiceChatManager] Failed to create call to ${peerId}`);
                return;
            }

            call.on('stream', (remoteStream) => {
                console.log(`[VoiceChatManager] Received stream from ${peerId}`);
                this.setupSpatialAudioForPeer(peerId, remoteStream);
            });

            call.on('error', (err) => {
                console.error(`[VoiceChatManager] Call error with ${peerId}:`, err);
                this.activeCalls.delete(peerId);
            });

            call.on('close', () => {
                console.log(`[VoiceChatManager] Call with ${peerId} closed`);
                this.activeCalls.delete(peerId);
            });

            this.activeCalls.set(peerId, call);
        } catch (error) {
            console.error(`[VoiceChatManager] Exception calling peer ${peerId}:`, error);
        }
    }

    /**
     * Set up audio playback for a peer (non-spatial for now)
     * @param {string} peerId
     * @param {MediaStream} stream
     */
    setupSpatialAudioForPeer(peerId, stream) {
        console.log(`[VoiceChatManager] Setting up audio for ${peerId}`);

        // Check if we already have an audio element for this peer
        if (this.peerAudioElements.has(peerId)) {
            console.log(`[VoiceChatManager] Audio element already exists for ${peerId}, updating stream`);
            const existingAudio = this.peerAudioElements.get(peerId);
            existingAudio.srcObject = stream;
            return;
        }

        // Create an audio element for playback
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.volume = 1.0;

        // Debug audio events
        audio.onloadedmetadata = () => {
            console.log(`[VoiceChatManager] Audio metadata loaded for ${peerId}`);
        };
        audio.onplay = () => {
            console.log(`[VoiceChatManager] Audio started playing for ${peerId}`);
        };
        audio.onerror = (e) => {
            console.error(`[VoiceChatManager] Audio error for ${peerId}:`, e);
        };

        this.peerAudioElements.set(peerId, audio);

        // Play (may need user interaction)
        audio.play().then(() => {
            console.log(`[VoiceChatManager] Audio play() succeeded for ${peerId}`);
        }).catch(e => {
            console.warn('[VoiceChatManager] Audio autoplay blocked, will play on interaction:', e.message);
            const playOnce = () => {
                audio.play().catch(() => {});
                window.removeEventListener('click', playOnce);
            };
            window.addEventListener('click', playOnce);
        });
    }

    /**
     * Set up spatial audio attached to a player mesh
     * @param {string} id - Player ID
     * @param {MediaStream} stream
     */
    setupSpatialAudio(id, stream) {
        const meshInfo = this.socketManager.playerMeshes.get(id);
        if (!meshInfo) {
            console.warn(`[VoiceChatManager] Mesh not found for ${id}, storing pending stream.`);
            this.pendingStreams.set(id, stream);
            return;
        }

        if (!this.game.audioListener) {
            console.error('[VoiceChatManager] AudioListener not found on camera');
            return;
        }

        // Resume AudioContext on first interaction if suspended
        const context = this.game.audioListener.context;
        if (context.state === 'suspended') {
            const resume = () => {
                context.resume().then(() => {
                    console.log('[VoiceChatManager] AudioContext resumed');
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

        console.log(`[VoiceChatManager] Spatial audio setup for ${id}`);
    }

    /**
     * Handle a new peer joining
     * @param {string} socketId
     * @param {string} peerId
     */
    handlePeerJoin(socketId, peerId) {
        if (socketId === this.socketManager.socketId) return;

        console.log(`[VoiceChatManager] Peer joined: ${peerId} (socket: ${socketId})`);

        if (this.voiceEnabled && this.peerJs && this.peerJs.open) {
            this.callPeer(peerId);
        } else {
            // Store for later when we initialize
            this.pendingPeerIds.set(socketId, peerId);
        }
    }

    /**
     * Handle a peer leaving
     * @param {string} socketId
     */
    handlePeerLeave(socketId) {
        // Clean up peer audio
        const peerId = this.pendingPeerIds.get(socketId);
        if (peerId && this.peerAudioElements.has(peerId)) {
            const audio = this.peerAudioElements.get(peerId);
            audio.srcObject = null;
            this.peerAudioElements.delete(peerId);
        }
        this.pendingPeerIds.delete(socketId);

        // Close active call if any
        if (peerId && this.activeCalls.has(peerId)) {
            const call = this.activeCalls.get(peerId);
            call.close();
            this.activeCalls.delete(peerId);
        }
    }

    /**
     * Get the local audio stream
     * @returns {MediaStream|null}
     */
    getLocalStream() {
        return this.localStream;
    }

    /**
     * Check if voice is enabled
     * @returns {boolean}
     */
    isEnabled() {
        return this.voiceEnabled;
    }

    /**
     * Clean up voice chat resources
     */
    cleanup() {
        // Close all calls
        for (const call of this.activeCalls.values()) {
            call.close();
        }
        this.activeCalls.clear();

        // Clean up audio elements
        for (const audio of this.peerAudioElements.values()) {
            audio.srcObject = null;
        }
        this.peerAudioElements.clear();

        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Destroy PeerJS
        if (this.peerJs) {
            this.peerJs.destroy();
            this.peerJs = null;
        }
    }
}
