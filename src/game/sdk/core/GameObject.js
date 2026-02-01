/**
 * GameObject - Base container for scripts (Unity-style)
 * Attach scripts to add behavior, just like Unity's MonoBehaviour system
 */
import * as THREE from 'three';

// Global Time object (Unity-style)
export const Time = {
    deltaTime: 0,
    time: 0,
    frameCount: 0
};

export class GameObject {
    constructor(name) {
        this.name = name;
        this.id = name.toLowerCase().replace(/\s+/g, '_');

        // Transform (Unity-style)
        this.transform = {
            position: new THREE.Vector3(),
            rotation: new THREE.Euler(),
            scale: new THREE.Vector3(1, 1, 1),

            Translate: (x, y, z) => {
                this.transform.position.x += x;
                this.transform.position.y += y;
                this.transform.position.z += z;
                this.SyncTransform();
            },
            Rotate: (x, y, z) => {
                this.transform.rotation.x += x;
                this.transform.rotation.y += y;
                this.transform.rotation.z += z;
                this.SyncTransform();
            },
            LookAt: (target) => {
                if (this.mesh) {
                    this.mesh.lookAt(
                        target.x ?? target.transform?.position.x ?? 0,
                        target.y ?? target.transform?.position.y ?? 0,
                        target.z ?? target.transform?.position.z ?? 0
                    );
                }
            }
        };

        // Visual
        this.mesh = null;

        // Position shortcut (for compatibility)
        Object.defineProperty(this, 'position', {
            get: () => this.transform.position,
            set: (v) => this.transform.position.copy(v)
        });

        // Scripts (components)
        this._scripts = [];
        this._scriptsByType = new Map();

        // State
        this._started = false;
        this._destroyed = false;

        // Reference to game (set on spawn)
        this.game = null;

        // Tags (Unity-style)
        this.tag = 'Untagged';
        this.layer = 0;
    }

    /**
     * Add a component (Unity: AddComponent)
     */
    AddComponent(script, config = {}) {
        if (this._destroyed) {
            console.warn(`[GameObject] Cannot add component to destroyed object: ${this.name}`);
            return null;
        }

        let instance;

        if (typeof script === 'function') {
            instance = new script();
        } else if (typeof script === 'object') {
            instance = Object.create(script);
        } else {
            console.warn(`[GameObject] Invalid script type for ${this.name}`);
            return null;
        }

        // Merge config
        Object.assign(instance, config);

        // Unity-style references
        instance.gameObject = this;
        instance.transform = this.transform;

        // Track by type
        const scriptType = script.type || script.name || instance.constructor?.name;
        if (scriptType && scriptType !== 'Object') {
            this._scriptsByType.set(scriptType, instance);
        }

        this._scripts.push(instance);

        // If already started, call Awake + Start immediately
        if (this._started) {
            this._InitScript(instance);
        }

        return instance;
    }

    // Fluent API alias
    attach(script, config = {}) {
        this.AddComponent(script, config);
        return this;
    }

    /**
     * Get a component (Unity: GetComponent)
     */
    GetComponent(scriptType) {
        const typeName = typeof scriptType === 'string'
            ? scriptType
            : scriptType.type || scriptType.name;
        return this._scriptsByType.get(typeName) || null;
    }

    /**
     * Check if has component
     */
    HasComponent(scriptType) {
        return this.GetComponent(scriptType) !== null;
    }

    // Aliases
    getScript(t) { return this.GetComponent(t); }
    hasScript(t) { return this.HasComponent(t); }

    /**
     * Initialize a script
     */
    _InitScript(script) {
        try {
            if (script.Awake) script.Awake();
            if (script.Start) script.Start();
        } catch (e) {
            console.error(`[GameObject] Error initializing script:`, e);
        }
    }

    /**
     * Called when object is spawned
     */
    Start() {
        if (this._started) return;
        this._started = true;

        for (const script of this._scripts) {
            this._InitScript(script);
        }
    }

    // Alias for internal use
    start() { this.Start(); }

    /**
     * Called every frame
     */
    Update(dt) {
        if (this._destroyed) return;

        // Update global Time
        Time.deltaTime = dt;
        Time.time += dt;
        Time.frameCount++;

        if (!this._loggedUpdate) {
            console.log('[GameObject.Update]', this.name, 'has', this._scripts.length, 'scripts');
            this._loggedUpdate = true;
        }

        for (const script of this._scripts) {
            try {
                if (script.Update) {
                    if (!this._loggedScriptUpdate) {
                        console.log('[GameObject.Update] Calling script.Update on:', script.type || script.constructor?.name);
                        this._loggedScriptUpdate = true;
                    }
                    script.Update();
                }
            } catch (e) {
                console.error(`[GameObject] Error in Update:`, e);
            }
        }
    }

    // Alias for internal use
    update(dt) { this.Update(dt); }

    /**
     * Called on collision
     */
    OnCollisionEnter(other) {
        for (const script of this._scripts) {
            try {
                if (script.OnCollisionEnter) script.OnCollisionEnter(other);
            } catch (e) {
                console.error(`[GameObject] Error in OnCollisionEnter:`, e);
            }
        }
    }

    onCollision(other) { this.OnCollisionEnter(other); }

    /**
     * Called on trigger
     */
    OnTriggerEnter(other) {
        for (const script of this._scripts) {
            try {
                if (script.OnTriggerEnter) script.OnTriggerEnter(other);
            } catch (e) {
                console.error(`[GameObject] Error in OnTriggerEnter:`, e);
            }
        }
    }

    /**
     * Called when used by player
     */
    OnUse(player) {
        for (const script of this._scripts) {
            try {
                if (script.OnUse) {
                    const result = script.OnUse(player);
                    if (result !== undefined) return result;
                }
            } catch (e) {
                console.error(`[GameObject] Error in OnUse:`, e);
            }
        }
    }

    onUse(player) { return this.OnUse(player); }

    /**
     * Called when damaged
     */
    OnDamage(amount, attacker) {
        for (const script of this._scripts) {
            try {
                if (script.OnDamage) script.OnDamage(amount, attacker);
            } catch (e) {
                console.error(`[GameObject] Error in OnDamage:`, e);
            }
        }
    }

    onHit(damage, attacker) { this.OnDamage(damage, attacker); }

    /**
     * Called when health reaches 0
     */
    OnDeath() {
        for (const script of this._scripts) {
            try {
                if (script.OnDeath) script.OnDeath();
            } catch (e) {
                console.error(`[GameObject] Error in OnDeath:`, e);
            }
        }
    }

    onDeath() { this.OnDeath(); }

    /**
     * Destroy this object
     */
    Destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        for (const script of this._scripts) {
            try {
                if (script.OnDestroy) script.OnDestroy();
            } catch (e) {
                console.error(`[GameObject] Error in OnDestroy:`, e);
            }
        }

        // Cleanup mesh
        if (this.mesh) {
            if (this.mesh.parent) {
                this.mesh.parent.remove(this.mesh);
            }
            this.mesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }

        this._scripts = [];
        this._scriptsByType.clear();
    }

    destroy() { this.Destroy(); }

    /**
     * Sync mesh to transform
     */
    SyncTransform() {
        if (this.mesh) {
            this.mesh.position.copy(this.transform.position);
            this.mesh.rotation.copy(this.transform.rotation);
            this.mesh.scale.copy(this.transform.scale);
        }
    }

    syncTransform() { this.SyncTransform(); }

    /**
     * Set active state
     */
    SetActive(active) {
        if (this.mesh) {
            this.mesh.visible = active;
        }
    }
}

// Static Destroy with optional delay
GameObject.Destroy = (obj, delay = 0) => {
    if (delay > 0) {
        setTimeout(() => obj.Destroy(), delay * 1000);
    } else {
        obj.Destroy();
    }
};

// Will be set by VoxelWorld
GameObject.Instantiate = null;

export default GameObject;
