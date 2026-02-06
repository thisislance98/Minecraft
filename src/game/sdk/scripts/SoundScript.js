/**
 * SoundScript - Adds audio capabilities to a game object
 *
 * @description Plays positional 3D audio attached to game objects.
 * Supports multiple sound effects, looping, volume control, and distance falloff.
 *
 * @example
 * obj.attach('sound', {
 *   sounds: {
 *     hurt: '/sounds/hurt.mp3',
 *     death: '/sounds/death.mp3',
 *     ambient: { url: '/sounds/ambient.mp3', loop: true, volume: 0.3 }
 *   },
 *   maxDistance: 30,
 *   autoPlay: 'ambient'  // Optional: play on start
 * });
 *
 * // Later in code:
 * soundScript.Play('hurt');
 */

/** @type {number} Default maximum hearing distance */
const DEFAULT_MAX_DISTANCE = 50;

/** @type {number} Default reference distance for volume falloff */
const DEFAULT_REF_DISTANCE = 1;

/** @type {number} Default rolloff factor for distance attenuation */
const DEFAULT_ROLLOFF = 1;

/** @type {number} Default volume (0-1) */
const DEFAULT_VOLUME = 1.0;

/**
 * @typedef {Object} SoundConfig
 * @property {string} url - URL to audio file
 * @property {boolean} [loop=false] - Whether to loop
 * @property {number} [volume=1] - Volume (0-1)
 * @property {number} [playbackRate=1] - Playback speed
 */

export const SoundScript = {
    type: 'SoundScript',

    // ===== CONFIG =====
    /**
     * Sound definitions
     * Can be string (URL) or SoundConfig object
     * @type {Object<string, string|SoundConfig>}
     */
    sounds: null,

    /** @type {number} Maximum distance sound can be heard */
    maxDistance: DEFAULT_MAX_DISTANCE,

    /** @type {number} Reference distance for volume rolloff */
    refDistance: DEFAULT_REF_DISTANCE,

    /** @type {number} Rolloff factor */
    rolloffFactor: DEFAULT_ROLLOFF,

    /** @type {string|null} Sound to play automatically on start */
    autoPlay: null,

    // ===== STATE =====
    /** @type {AudioContext|null} */
    _audioContext: null,

    /** @type {Map<string, AudioBuffer>} */
    _buffers: null,

    /** @type {Map<string, AudioBufferSourceNode>} */
    _activeSources: null,

    /** @type {GainNode|null} */
    _gainNode: null,

    /** @type {PannerNode|null} */
    _pannerNode: null,

    /** @type {boolean} */
    _initialized: false,

    /**
     * Called when the script starts
     */
    Start() {
        this._buffers = new Map();
        this._activeSources = new Map();

        // Get or create audio context
        this._audioContext = window._sdkAudioContext;
        if (!this._audioContext) {
            try {
                this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
                window._sdkAudioContext = this._audioContext;
            } catch (e) {
                console.warn('[SoundScript] AudioContext not available:', e);
                return;
            }
        }

        // Create gain node for volume control
        this._gainNode = this._audioContext.createGain();
        this._gainNode.gain.value = DEFAULT_VOLUME;

        // Create panner node for 3D positioning
        this._pannerNode = this._audioContext.createPanner();
        this._pannerNode.panningModel = 'HRTF';
        this._pannerNode.distanceModel = 'inverse';
        this._pannerNode.refDistance = this.refDistance;
        this._pannerNode.maxDistance = this.maxDistance;
        this._pannerNode.rolloffFactor = this.rolloffFactor;

        // Connect: source -> gain -> panner -> destination
        this._gainNode.connect(this._pannerNode);
        this._pannerNode.connect(this._audioContext.destination);

        this._initialized = true;

        // Load all sounds
        if (this.sounds) {
            this._loadSounds();
        }

        // Auto-play if configured
        if (this.autoPlay && this.sounds?.[this.autoPlay]) {
            // Delay slightly to ensure buffers are loading
            setTimeout(() => this.Play(this.autoPlay), 100);
        }
    },

    /**
     * Called every frame - update 3D position
     */
    Update() {
        if (!this._initialized || !this._pannerNode) return;

        // Update panner position to match game object
        const pos = this.gameObject.position;
        if (pos) {
            this._pannerNode.positionX.setValueAtTime(pos.x, this._audioContext.currentTime);
            this._pannerNode.positionY.setValueAtTime(pos.y, this._audioContext.currentTime);
            this._pannerNode.positionZ.setValueAtTime(pos.z, this._audioContext.currentTime);
        }

        // Update listener position (player/camera)
        const game = this.gameObject.game || window.__VOXEL_GAME__;
        const listener = this._audioContext.listener;
        if (game?.player?.position && listener.positionX) {
            const playerPos = game.player.position;
            listener.positionX.setValueAtTime(playerPos.x, this._audioContext.currentTime);
            listener.positionY.setValueAtTime(playerPos.y, this._audioContext.currentTime);
            listener.positionZ.setValueAtTime(playerPos.z, this._audioContext.currentTime);
        }
    },

    /**
     * Called when the game object is destroyed
     */
    OnDestroy() {
        this.StopAll();
        this._buffers?.clear();
        this._activeSources?.clear();
    },

    /**
     * Load all configured sounds
     * @private
     */
    async _loadSounds() {
        if (!this.sounds || !this._audioContext) return;

        for (const [name, config] of Object.entries(this.sounds)) {
            const url = typeof config === 'string' ? config : config.url;
            if (!url) continue;

            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this._audioContext.decodeAudioData(arrayBuffer);
                this._buffers.set(name, audioBuffer);
                console.log(`[SoundScript] Loaded sound: ${name}`);
            } catch (e) {
                console.warn(`[SoundScript] Failed to load sound "${name}":`, e);
            }
        }
    },

    // ===== PUBLIC METHODS =====

    /**
     * Play a sound by name
     * @param {string} name - Sound name from sounds config
     * @param {Object} [options] - Override options
     * @param {number} [options.volume] - Volume (0-1)
     * @param {boolean} [options.loop] - Whether to loop
     * @param {number} [options.playbackRate] - Playback speed
     * @returns {boolean} Whether sound started playing
     */
    Play(name, options = {}) {
        if (!this._initialized || !this._audioContext) {
            console.warn('[SoundScript] Not initialized');
            return false;
        }

        // Resume audio context if suspended (browser autoplay policy)
        if (this._audioContext.state === 'suspended') {
            this._audioContext.resume();
        }

        const buffer = this._buffers.get(name);
        if (!buffer) {
            console.warn(`[SoundScript] Sound not found or not loaded: ${name}`);
            return false;
        }

        // Stop existing instance of this sound
        this.Stop(name);

        // Get config for this sound
        const config = this.sounds[name];
        const soundConfig = typeof config === 'string' ? {} : config;

        // Create source
        const source = this._audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = options.loop ?? soundConfig.loop ?? false;
        source.playbackRate.value = options.playbackRate ?? soundConfig.playbackRate ?? 1;

        // Create individual gain for this sound
        const soundGain = this._audioContext.createGain();
        soundGain.gain.value = options.volume ?? soundConfig.volume ?? DEFAULT_VOLUME;

        // Connect: source -> soundGain -> masterGain -> panner -> destination
        source.connect(soundGain);
        soundGain.connect(this._gainNode);

        // Track active source
        this._activeSources.set(name, source);

        // Remove from active when finished
        source.onended = () => {
            this._activeSources.delete(name);
        };

        // Play
        source.start(0);
        return true;
    },

    /**
     * Stop a specific sound
     * @param {string} name - Sound name
     */
    Stop(name) {
        const source = this._activeSources.get(name);
        if (source) {
            try {
                source.stop();
            } catch (e) {
                // Already stopped
            }
            this._activeSources.delete(name);
        }
    },

    /**
     * Stop all sounds
     */
    StopAll() {
        if (!this._activeSources) return;

        for (const [name, source] of this._activeSources) {
            try {
                source.stop();
            } catch (e) {
                // Already stopped
            }
        }
        this._activeSources.clear();
    },

    /**
     * Check if a sound is currently playing
     * @param {string} name - Sound name
     * @returns {boolean}
     */
    IsPlaying(name) {
        return this._activeSources?.has(name) ?? false;
    },

    /**
     * Set master volume for this entity
     * @param {number} volume - Volume (0-1)
     */
    SetVolume(volume) {
        if (this._gainNode) {
            this._gainNode.gain.value = Math.max(0, Math.min(1, volume));
        }
    },

    /**
     * Get current master volume
     * @returns {number}
     */
    GetVolume() {
        return this._gainNode?.gain.value ?? DEFAULT_VOLUME;
    },

    /**
     * Play a one-shot sound at a specific position (static/global)
     * @param {string} url - Sound URL
     * @param {Object} position - {x, y, z} position
     * @param {Object} [options] - Volume, etc.
     */
    PlayAtPosition(url, position, options = {}) {
        if (!this._audioContext) return;

        // Resume if suspended
        if (this._audioContext.state === 'suspended') {
            this._audioContext.resume();
        }

        // Load and play immediately
        fetch(url)
            .then(r => r.arrayBuffer())
            .then(buf => this._audioContext.decodeAudioData(buf))
            .then(audioBuffer => {
                const source = this._audioContext.createBufferSource();
                source.buffer = audioBuffer;

                const panner = this._audioContext.createPanner();
                panner.panningModel = 'HRTF';
                panner.positionX.setValueAtTime(position.x, this._audioContext.currentTime);
                panner.positionY.setValueAtTime(position.y, this._audioContext.currentTime);
                panner.positionZ.setValueAtTime(position.z, this._audioContext.currentTime);

                const gain = this._audioContext.createGain();
                gain.gain.value = options.volume ?? DEFAULT_VOLUME;

                source.connect(gain);
                gain.connect(panner);
                panner.connect(this._audioContext.destination);

                source.start(0);
            })
            .catch(e => console.warn('[SoundScript] Failed to play at position:', e));
    }
};

export default SoundScript;
