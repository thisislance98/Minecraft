/**
 * ParticleScript - Adds particle effects to a game object
 *
 * @description Emits particle effects for trails, bursts, and custom emissions.
 * Integrates with the game's worldParticleSystem.
 *
 * @example
 * obj.attach('particle', {
 *   trail: true,
 *   trailColor: 0xff4400,
 *   trailRate: 15,
 *   burstOnDeath: true,
 *   burstCount: 30
 * });
 */

/** @type {number} Default particles per second for trails */
const DEFAULT_TRAIL_RATE = 10;
/** @type {number} Default particle count for death burst */
const DEFAULT_BURST_COUNT = 20;
/** @type {number} Default particle spread for trails */
const TRAIL_SPREAD = 0.1;
/** @type {number} Default particle spread for bursts */
const BURST_SPREAD = 1.0;
/** @type {number} Default trail particle lifetime in seconds */
const TRAIL_LIFETIME = 0.5;
/** @type {number} Default burst particle lifetime in seconds */
const BURST_LIFETIME = 1.0;
/** @type {number} Default particle size for trails */
const TRAIL_PARTICLE_SIZE = 0.1;
/** @type {number} Default particle size for bursts */
const BURST_PARTICLE_SIZE = 0.15;

export const ParticleScript = {
    type: 'ParticleScript',

    // ===== CONFIG =====
    /** @type {boolean} Whether to emit a trail of particles while moving */
    trail: false,
    /** @type {number} Trail particle color (hex) */
    trailColor: 0xffffff,
    /** @type {number} Particles per second for trail */
    trailRate: DEFAULT_TRAIL_RATE,
    /** @type {boolean} Whether to emit burst particles on death */
    burstOnDeath: false,
    /** @type {number} Number of particles in death burst */
    burstCount: DEFAULT_BURST_COUNT,
    /** @type {number} Burst particle color (hex) */
    burstColor: 0xffffff,

    // ===== STATE =====
    /** @type {number} Timer for trail emission interval */
    _trailTimer: 0,

    /**
     * Called when the script starts
     */
    Start() {
        this._trailTimer = 0;
    },

    /**
     * Called every frame
     */
    Update() {
        if (!this.trail) return;

        const dt = window.Time?.deltaTime || 0.016;
        this._trailTimer += dt;
        const interval = 1 / this.trailRate;

        if (this._trailTimer >= interval) {
            this._trailTimer = 0;
            this._emitTrailParticle();
        }
    },

    /**
     * Called when the game object dies
     */
    OnDeath() {
        if (this.burstOnDeath) {
            this._emitBurst();
        }
    },

    /**
     * Emit a single trail particle at current position
     * @private
     */
    _emitTrailParticle() {
        const game = this.gameObject.game || window.__VOXEL_GAME__;
        if (!game?.worldParticleSystem) return;

        game.worldParticleSystem.emit({
            position: this.gameObject.position.clone(),
            color: this.trailColor,
            count: 1,
            spread: TRAIL_SPREAD,
            lifetime: TRAIL_LIFETIME,
            size: TRAIL_PARTICLE_SIZE
        });
    },

    /**
     * Emit a burst of particles at current position
     * @private
     */
    _emitBurst() {
        const game = this.gameObject.game || window.__VOXEL_GAME__;
        if (!game?.worldParticleSystem) return;

        game.worldParticleSystem.emit({
            position: this.gameObject.position.clone(),
            color: this.burstColor,
            count: this.burstCount,
            spread: BURST_SPREAD,
            lifetime: BURST_LIFETIME,
            size: BURST_PARTICLE_SIZE
        });
    },

    // ===== PUBLIC METHODS =====

    /**
     * Emit particles at the current position
     * @param {number} [count=10] - Number of particles to emit
     * @param {number|null} [color=null] - Particle color (hex), defaults to burstColor
     */
    Emit(count = 10, color = null) {
        const game = this.gameObject.game || window.__VOXEL_GAME__;
        if (!game?.worldParticleSystem) return;

        game.worldParticleSystem.emit({
            position: this.gameObject.position.clone(),
            color: color ?? this.burstColor,
            count: count,
            spread: 0.5,
            lifetime: BURST_LIFETIME,
            size: BURST_PARTICLE_SIZE
        });
    },

    // Alias for backwards compatibility
    emit(count = 10, color = null) {
        return this.Emit(count, color);
    }
};

export default ParticleScript;
