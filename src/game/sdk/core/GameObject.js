/**
 * GameObject - Base container for scripts (Unity-style)
 * Attach scripts to add behavior, just like Unity's MonoBehaviour system
 *
 * @description Core entity class that holds components (scripts) and a transform.
 * Scripts can declare dependencies using `requires: ['ScriptName']` property.
 *
 * @example
 * const obj = new GameObject('Player');
 * obj.attach(MeshScript, { parts: [...] });
 * obj.attach(PhysicsScript, { speed: 5 });
 * obj.Start();
 */
import * as THREE from 'three';

/**
 * Global Time object (Unity-style)
 * @type {{deltaTime: number, time: number, frameCount: number}}
 */
export const Time = {
    /** @type {number} Time since last frame in seconds */
    deltaTime: 0,
    /** @type {number} Total time elapsed since start in seconds */
    time: 0,
    /** @type {number} Total frames rendered */
    frameCount: 0
};

/**
 * Script dependency definitions
 * Maps script types to their required dependencies
 * @type {Object<string, string[]>}
 */
export const ScriptDependencies = {
    AIScript: ['PhysicsScript'],
    AnimationScript: ['MeshScript'],
    ProjectileScript: ['PhysicsScript'],
    ShooterScript: [],
    ParticleScript: [],
    HealthScript: [],
    MeshScript: [],
    ItemScript: [],
    PhysicsScript: []
};

/**
 * Transform - Handles position, rotation, scale and hierarchy (Unity-style)
 * Parent/child relationships are on Transform, not GameObject
 */
class Transform {
    constructor(gameObject) {
        this.gameObject = gameObject;

        // Local transform (relative to parent)
        this.localPosition = new THREE.Vector3();
        this.localRotation = new THREE.Euler();
        this.localScale = new THREE.Vector3(1, 1, 1);

        // Hierarchy
        this._parent = null;
        this._children = [];
    }

    // ===== HIERARCHY =====

    get parent() {
        return this._parent;
    }

    set parent(newParent) {
        this.SetParent(newParent);
    }

    /**
     * Set this transform's parent (Unity-style)
     * @param {Transform|null} newParent
     * @param {boolean} worldPositionStays - If true, keeps world position
     */
    SetParent(newParent, worldPositionStays = false) {
        if (newParent === this._parent) return;
        if (newParent === this) {
            console.warn('[Transform] Cannot parent to self');
            return;
        }

        // Store world position if needed
        const worldPos = worldPositionStays ? this.position.clone() : null;

        // Remove from old parent
        if (this._parent) {
            const idx = this._parent._children.indexOf(this);
            if (idx !== -1) this._parent._children.splice(idx, 1);

            // Unparent mesh
            if (this._parent.gameObject.mesh && this.gameObject.mesh) {
                this._parent.gameObject.mesh.remove(this.gameObject.mesh);
            }
        }

        this._parent = newParent;

        // Add to new parent
        if (newParent) {
            newParent._children.push(this);

            // Parent mesh
            if (newParent.gameObject.mesh && this.gameObject.mesh) {
                newParent.gameObject.mesh.add(this.gameObject.mesh);
            }

            // Propagate game reference
            if (newParent.gameObject.game && !this.gameObject.game) {
                this.gameObject.game = newParent.gameObject.game;
            }

            // Start child if parent is started
            if (newParent.gameObject._started && !this.gameObject._started) {
                this.gameObject.Start();
            }
        }

        // Restore world position
        if (worldPositionStays && worldPos) {
            this.position = worldPos;
        }

        this._syncMesh();
    }

    get childCount() {
        return this._children.length;
    }

    /**
     * Get child transform by index
     */
    GetChild(index) {
        return this._children[index] || null;
    }

    /**
     * Find child by name
     */
    Find(name) {
        for (const child of this._children) {
            if (child.gameObject.name === name) {
                return child;
            }
        }
        // Recursive search with path support (e.g., "Body/LeftArm/Hand")
        if (name.includes('/')) {
            const parts = name.split('/');
            let current = this;
            for (const part of parts) {
                const found = current._children.find(c => c.gameObject.name === part);
                if (!found) return null;
                current = found;
            }
            return current;
        }
        return null;
    }

    /**
     * Get the root transform
     */
    get root() {
        let t = this;
        while (t._parent) t = t._parent;
        return t;
    }

    // ===== POSITION =====

    /**
     * World position (computed from hierarchy)
     */
    get position() {
        if (!this._parent) {
            return this.localPosition.clone();
        }
        // Get parent's world position and add local
        const parentWorld = this._parent.position;
        return parentWorld.add(this.localPosition);
    }

    set position(worldPos) {
        if (!this._parent) {
            this.localPosition.copy(worldPos);
        } else {
            // Convert world to local
            const parentWorld = this._parent.position;
            this.localPosition.copy(worldPos).sub(parentWorld);
        }
        this._syncMesh();
    }

    // ===== ROTATION =====

    get rotation() {
        return this.localRotation;
    }

    set rotation(r) {
        this.localRotation.copy(r);
        this._syncMesh();
    }

    get eulerAngles() {
        return new THREE.Vector3(
            THREE.MathUtils.radToDeg(this.localRotation.x),
            THREE.MathUtils.radToDeg(this.localRotation.y),
            THREE.MathUtils.radToDeg(this.localRotation.z)
        );
    }

    set eulerAngles(v) {
        this.localRotation.set(
            THREE.MathUtils.degToRad(v.x),
            THREE.MathUtils.degToRad(v.y),
            THREE.MathUtils.degToRad(v.z)
        );
        this._syncMesh();
    }

    // ===== SCALE =====

    get scale() {
        return this.localScale;
    }

    set scale(s) {
        this.localScale.copy(s);
        this._syncMesh();
    }

    // ===== DIRECTIONS =====

    get forward() {
        const dir = new THREE.Vector3(0, 0, 1);
        dir.applyEuler(this.localRotation);
        return dir;
    }

    get right() {
        const dir = new THREE.Vector3(1, 0, 0);
        dir.applyEuler(this.localRotation);
        return dir;
    }

    get up() {
        const dir = new THREE.Vector3(0, 1, 0);
        dir.applyEuler(this.localRotation);
        return dir;
    }

    // ===== METHODS =====

    Translate(x, y, z, relativeTo = 'self') {
        if (relativeTo === 'world') {
            this.localPosition.x += x;
            this.localPosition.y += y;
            this.localPosition.z += z;
        } else {
            // Move relative to own rotation
            const move = new THREE.Vector3(x, y, z);
            move.applyEuler(this.localRotation);
            this.localPosition.add(move);
        }
        this._syncMesh();
    }

    Rotate(x, y, z) {
        this.localRotation.x += THREE.MathUtils.degToRad(x);
        this.localRotation.y += THREE.MathUtils.degToRad(y);
        this.localRotation.z += THREE.MathUtils.degToRad(z);
        this._syncMesh();
    }

    LookAt(target) {
        const targetPos = target.position || target;
        if (this.gameObject.mesh) {
            this.gameObject.mesh.lookAt(targetPos);
            this.localRotation.copy(this.gameObject.mesh.rotation);
        }
    }

    /**
     * Sync mesh transform to this transform
     */
    _syncMesh() {
        if (this.gameObject.mesh) {
            this.gameObject.mesh.position.copy(this.localPosition);
            this.gameObject.mesh.rotation.copy(this.localRotation);
            this.gameObject.mesh.scale.copy(this.localScale);
        }
    }
}

export class GameObject {
    constructor(name) {
        this.name = name;
        this.id = name.toLowerCase().replace(/\s+/g, '_');

        // Transform (Unity-style) - hierarchy lives here
        this.transform = new Transform(this);

        // Visual
        this.mesh = null;

        // Position shortcut (for compatibility)
        Object.defineProperty(this, 'position', {
            get: () => this.transform.localPosition,
            set: (v) => {
                this.transform.localPosition.copy(v);
                this.transform._syncMesh();
            }
        });

        // Parent/children shortcuts (delegate to transform)
        Object.defineProperty(this, 'parent', {
            get: () => this.transform._parent?.gameObject || null,
            set: (go) => {
                this.transform.SetParent(go?.transform || null);
            }
        });

        Object.defineProperty(this, 'children', {
            get: () => this.transform._children.map(t => t.gameObject)
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
    addScript(script, config = {}) { return this.AddComponent(script, config); }

    /**
     * Validate script dependencies
     * @param {Object} script - Script instance to validate
     * @returns {{valid: boolean, missing: string[]}} Validation result
     */
    _ValidateDependencies(script) {
        const scriptType = script.type || script.constructor?.name;
        const missing = [];

        // Check built-in dependencies
        const builtInDeps = ScriptDependencies[scriptType] || [];
        for (const dep of builtInDeps) {
            if (!this.hasScript(dep)) {
                missing.push(dep);
            }
        }

        // Check script's own declared dependencies
        if (script.requires && Array.isArray(script.requires)) {
            for (const dep of script.requires) {
                if (!this.hasScript(dep) && !missing.includes(dep)) {
                    missing.push(dep);
                }
            }
        }

        return { valid: missing.length === 0, missing };
    }

    /**
     * Initialize a script
     * @param {Object} script - Script instance to initialize
     */
    _InitScript(script) {
        const scriptName = script.type || script.constructor?.name || 'UnknownScript';

        // Validate dependencies before starting
        const validation = this._ValidateDependencies(script);
        if (!validation.valid) {
            console.warn(
                `[GameObject] ${this.name}: ${scriptName} is missing required scripts: ${validation.missing.join(', ')}. ` +
                `This may cause errors. Consider adding: ${validation.missing.map(s => `.attach('${s.toLowerCase().replace('script', '')}', {...})`).join(', ')}`
            );

            // Emit warning event for AI/debugging
            window.dispatchEvent(new CustomEvent('sdk:dependency-warning', {
                detail: {
                    gameObject: this.name,
                    script: scriptName,
                    missing: validation.missing
                }
            }));
        }

        try {
            if (script.Awake) script.Awake();
            if (script.Start) script.Start();
        } catch (e) {
            console.error(`[GameObject] Error initializing ${scriptName}:`, e);

            // Emit error event
            window.dispatchEvent(new CustomEvent('sdk:script-error', {
                detail: {
                    gameObject: this.name,
                    script: scriptName,
                    method: 'Start',
                    error: e.message,
                    stack: e.stack
                }
            }));
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

        // Start all children
        for (const childTransform of this.transform._children) {
            childTransform.gameObject.Start();
        }
    }

    // Alias for internal use
    start() { this.Start(); }

    /**
     * Called every frame
     */
    Update(dt) {
        if (this._destroyed) return;

        // Update global Time (only at root level to avoid multiple updates)
        if (!this.transform._parent) {
            Time.deltaTime = dt;
            Time.time += dt;
            Time.frameCount++;
        }

        for (const script of this._scripts) {
            try {
                if (script.Update) {
                    script.Update();
                }
            } catch (e) {
                const scriptName = script.type || script.constructor?.name || 'UnknownScript';
                console.error(`[GameObject] Error in ${scriptName}.Update():`, e);

                if (!script._errorReported) {
                    script._errorReported = true;
                    window.dispatchEvent(new CustomEvent('sdk:script-error', {
                        detail: {
                            gameObject: this.name,
                            script: scriptName,
                            method: 'Update',
                            error: e.message,
                            stack: e.stack
                        }
                    }));
                }
            }
        }

        // Update all children
        for (const childTransform of this.transform._children) {
            childTransform.gameObject.Update(dt);
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

        // Destroy all children first
        const childrenCopy = [...this.transform._children];
        for (const childTransform of childrenCopy) {
            childTransform.gameObject.Destroy();
        }
        this.transform._children = [];

        // Remove from parent
        if (this.transform._parent) {
            this.transform.SetParent(null);
        }

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
        this.transform._syncMesh();
    }

    syncTransform() { this.SyncTransform(); }

    /**
     * Set active state
     */
    SetActive(active) {
        if (this.mesh) {
            this.mesh.visible = active;
        }
        for (const childTransform of this.transform._children) {
            childTransform.gameObject.SetActive(active);
        }
    }

    // ===== CONVENIENCE METHODS =====

    /**
     * Find child by name (delegates to transform)
     */
    Find(name) {
        const t = this.transform.Find(name);
        return t?.gameObject || null;
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

export { Transform };
export default GameObject;
