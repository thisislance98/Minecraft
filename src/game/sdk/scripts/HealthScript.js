/**
 * HealthScript - Adds health and damage to a game object
 */

export const HealthScript = {
    type: 'HealthScript',

    // Config
    max: 20,
    current: null,
    damage: 5,            // Damage this entity deals
    invincible: false,
    regenerate: false,
    regenRate: 1,         // HP per second

    // State
    _regenTimer: 0,
    _invulnTimer: 0,
    _invulnDuration: 0.5, // Invulnerability frames

    Start() {
        if (this.current === null) {
            this.current = this.max;
        }
    },

    Update() {
        const dt = Time.deltaTime;

        // Invulnerability timer
        if (this._invulnTimer > 0) {
            this._invulnTimer -= dt;
        }

        // Regeneration
        if (this.regenerate && this.current < this.max) {
            this._regenTimer += dt;
            if (this._regenTimer >= 1) {
                this._regenTimer = 0;
                this.Heal(this.regenRate);
            }
        }
    },

    OnDamage(amount, attacker) {
        this.TakeDamage(amount, attacker);
    },

    // Public methods
    TakeDamage(amount, attacker = null) {
        if (this.invincible) return;
        if (this._invulnTimer > 0) return;

        this.current -= amount;
        this._invulnTimer = this._invulnDuration;

        console.log(`[HealthScript] ${this.gameObject.name} took ${amount} damage (${this.current}/${this.max})`);

        // Flash red
        if (this.gameObject.mesh) {
            this._FlashDamage();
        }

        if (this.current <= 0) {
            this.current = 0;
            this.Die();
        }
    },

    Heal(amount) {
        this.current = Math.min(this.max, this.current + amount);
    },

    Die() {
        console.log(`[HealthScript] ${this.gameObject.name} died`);
        this.gameObject.OnDeath();
        this.gameObject.Destroy();
    },

    _FlashDamage() {
        const mesh = this.gameObject.mesh;
        if (!mesh) return;

        // Store original colors
        const originals = [];
        mesh.traverse(child => {
            if (child.material) {
                originals.push({ mesh: child, color: child.material.color.getHex() });
                child.material.color.setHex(0xff0000);
            }
        });

        // Restore after delay
        setTimeout(() => {
            originals.forEach(({ mesh, color }) => {
                if (mesh.material) {
                    mesh.material.color.setHex(color);
                }
            });
        }, 100);
    }
};

export default HealthScript;
