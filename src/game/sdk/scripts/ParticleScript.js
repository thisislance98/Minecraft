/**
 * ParticleScript - Adds particle effects to a game object
 */

export const ParticleScript = {
    type: 'ParticleScript',

    // Config
    trail: false,
    trailColor: 0xffffff,
    trailRate: 10,        // particles per second
    burstOnDeath: false,
    burstCount: 20,
    burstColor: 0xffffff,

    // State
    _trailTimer: 0,

    start(obj) {
        // Nothing to initialize
    },

    update(obj, dt) {
        if (this.trail) {
            this._trailTimer += dt;
            const interval = 1 / this.trailRate;

            if (this._trailTimer >= interval) {
                this._trailTimer = 0;
                this._emitTrailParticle(obj);
            }
        }
    },

    onDeath(obj) {
        if (this.burstOnDeath) {
            this._emitBurst(obj);
        }
    },

    _emitTrailParticle(obj) {
        const game = obj.game || window.__VOXEL_GAME__;
        if (!game?.worldParticleSystem) return;

        game.worldParticleSystem.emit({
            position: obj.position.clone(),
            color: this.trailColor,
            count: 1,
            spread: 0.1,
            lifetime: 0.5,
            size: 0.1
        });
    },

    _emitBurst(obj) {
        const game = obj.game || window.__VOXEL_GAME__;
        if (!game?.worldParticleSystem) return;

        game.worldParticleSystem.emit({
            position: obj.position.clone(),
            color: this.burstColor,
            count: this.burstCount,
            spread: 1,
            lifetime: 1,
            size: 0.15
        });
    },

    // Public methods
    emit(count = 10, color = null) {
        const game = this.gameObject.game || window.__VOXEL_GAME__;
        if (!game?.worldParticleSystem) return;

        game.worldParticleSystem.emit({
            position: this.gameObject.position.clone(),
            color: color || this.burstColor,
            count: count,
            spread: 0.5,
            lifetime: 1,
            size: 0.15
        });
    }
};

export default ParticleScript;
