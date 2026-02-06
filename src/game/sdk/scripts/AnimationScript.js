/**
 * AnimationScript - Animates child transforms for creatures/objects
 *
 * @description Animates transforms using sine-wave interpolation. Supports position,
 * rotation, and scale animations with configurable speed. Now includes keyframe events
 * for triggering callbacks at specific animation points.
 *
 * @example
 * // Basic animation
 * body.attach('animation', {
 *   animations: {
 *     walk: {
 *       LeftLeg: { rotation: { x: [-30, 30] }, speed: 8 },
 *       RightLeg: { rotation: { x: [30, -30] }, speed: 8 }
 *     },
 *     idle: {
 *       Body: { position: { y: [0, 0.05] }, speed: 2 }
 *     }
 *   },
 *   defaultAnimation: 'idle'
 * });
 *
 * // With keyframe events
 * animScript.AddEvent('walk', 0.5, () => {
 *   console.log('Footstep!');
 *   soundScript.Play('footstep');
 * });
 */
import * as THREE from 'three';

/** @type {number} Default animation speed */
const DEFAULT_SPEED = 5;

/**
 * @typedef {Object} AnimationEvent
 * @property {number} time - Normalized time (0-1) when event fires
 * @property {Function} callback - Function to call
 * @property {boolean} fired - Whether event has fired this cycle
 */

export const AnimationScript = {
    type: 'AnimationScript',

    // ===== CONFIG =====
    /**
     * Animation definitions
     * @type {Object<string, Object<string, {rotation?: Object, position?: Object, scale?: Object, speed?: number}>>}
     */
    animations: null,

    /** @type {string|null} Name of default animation to play on start */
    defaultAnimation: null,

    // ===== STATE =====
    /** @type {string|null} Currently playing animation name */
    _currentAnimation: null,
    /** @type {number} Current animation time */
    _animTime: 0,
    /** @type {boolean} Whether animation is playing */
    _isPlaying: false,
    /** @type {Map<string, Object>|null} Original transform values for reset */
    _originalTransforms: null,
    /** @type {Map<string, AnimationEvent[]>|null} Keyframe events per animation */
    _events: null,
    /** @type {number} Previous normalized time (for event detection) */
    _prevNormalizedTime: 0,

    /**
     * Called when the script starts
     */
    Start() {
        this._originalTransforms = new Map();
        this._events = new Map();
        this._animTime = 0;
        this._prevNormalizedTime = 0;

        // Store original transforms for all children (recursive)
        this._storeOriginalTransforms(this.transform);

        // Play default animation if set
        if (this.defaultAnimation && this.animations?.[this.defaultAnimation]) {
            this.Play(this.defaultAnimation);
        }
    },

    _storeOriginalTransforms(transform) {
        // Store this transform's original values
        this._originalTransforms.set(transform.gameObject.name, {
            position: transform.localPosition.clone(),
            rotation: new THREE.Vector3(
                transform.localRotation.x,
                transform.localRotation.y,
                transform.localRotation.z
            ),
            scale: transform.localScale.clone()
        });

        // Recurse into children
        for (const child of transform._children) {
            this._storeOriginalTransforms(child);
        }
    },

    /**
     * Find a child transform by name (searches hierarchy)
     */
    _findChild(name) {
        // Check if it's this gameObject
        if (this.gameObject.name === name) {
            return this.transform;
        }

        // Search children recursively
        const search = (transform) => {
            for (const child of transform._children) {
                if (child.gameObject.name === name) {
                    return child;
                }
                const found = search(child);
                if (found) return found;
            }
            return null;
        };

        return search(this.transform);
    },

    /**
     * Called every frame
     */
    Update() {
        if (!this._isPlaying || !this._currentAnimation) return;

        const anim = this.animations?.[this._currentAnimation];
        if (!anim) return;

        const dt = window.Time?.deltaTime || 0.016;
        this._animTime += dt;

        // Calculate normalized time for events (0-1 based on sin wave cycle)
        // sin goes from -1 to 1 over PI, so full cycle is 2*PI
        const avgSpeed = this._getAverageSpeed(anim);
        const normalizedTime = ((this._animTime * avgSpeed) % (Math.PI * 2)) / (Math.PI * 2);

        // Check and fire keyframe events
        this._processEvents(normalizedTime);

        // Animate each child defined in the animation
        for (const [childName, animConfig] of Object.entries(anim)) {
            const childTransform = this._findChild(childName);
            if (!childTransform) continue;

            const speed = animConfig.speed || DEFAULT_SPEED;
            const t = Math.sin(this._animTime * speed);
            const original = this._originalTransforms.get(childName);

            // Animate rotation (in degrees, converted to radians)
            if (animConfig.rotation) {
                if (animConfig.rotation.x !== undefined) {
                    const [min, max] = animConfig.rotation.x;
                    childTransform.localRotation.x = THREE.MathUtils.degToRad(
                        THREE.MathUtils.lerp(min, max, (t + 1) / 2)
                    );
                }
                if (animConfig.rotation.y !== undefined) {
                    const [min, max] = animConfig.rotation.y;
                    childTransform.localRotation.y = THREE.MathUtils.degToRad(
                        THREE.MathUtils.lerp(min, max, (t + 1) / 2)
                    );
                }
                if (animConfig.rotation.z !== undefined) {
                    const [min, max] = animConfig.rotation.z;
                    childTransform.localRotation.z = THREE.MathUtils.degToRad(
                        THREE.MathUtils.lerp(min, max, (t + 1) / 2)
                    );
                }
                childTransform._syncMesh();
            }

            // Animate position (offset from original)
            if (animConfig.position && original) {
                if (animConfig.position.x !== undefined) {
                    const [min, max] = animConfig.position.x;
                    childTransform.localPosition.x = original.position.x +
                        THREE.MathUtils.lerp(min, max, (t + 1) / 2);
                }
                if (animConfig.position.y !== undefined) {
                    const [min, max] = animConfig.position.y;
                    childTransform.localPosition.y = original.position.y +
                        THREE.MathUtils.lerp(min, max, (t + 1) / 2);
                }
                if (animConfig.position.z !== undefined) {
                    const [min, max] = animConfig.position.z;
                    childTransform.localPosition.z = original.position.z +
                        THREE.MathUtils.lerp(min, max, (t + 1) / 2);
                }
                childTransform._syncMesh();
            }

            // Animate scale (multiplier from original)
            if (animConfig.scale && original) {
                if (animConfig.scale.x !== undefined) {
                    const [min, max] = animConfig.scale.x;
                    childTransform.localScale.x = original.scale.x *
                        THREE.MathUtils.lerp(min, max, (t + 1) / 2);
                }
                if (animConfig.scale.y !== undefined) {
                    const [min, max] = animConfig.scale.y;
                    childTransform.localScale.y = original.scale.y *
                        THREE.MathUtils.lerp(min, max, (t + 1) / 2);
                }
                if (animConfig.scale.z !== undefined) {
                    const [min, max] = animConfig.scale.z;
                    childTransform.localScale.z = original.scale.z *
                        THREE.MathUtils.lerp(min, max, (t + 1) / 2);
                }
                childTransform._syncMesh();
            }
        }
    },

    /**
     * Play a named animation
     */
    Play(animName) {
        if (!this.animations?.[animName]) {
            console.warn(`[AnimationScript] Animation "${animName}" not found`);
            return;
        }

        if (this._currentAnimation && this._currentAnimation !== animName) {
            this._resetTransforms();
        }

        this._currentAnimation = animName;
        this._isPlaying = true;
    },

    /**
     * Stop the current animation
     */
    Stop(resetPose = true) {
        this._isPlaying = false;
        if (resetPose) {
            this._resetTransforms();
        }
    },

    Pause() {
        this._isPlaying = false;
    },

    Resume() {
        if (this._currentAnimation) {
            this._isPlaying = true;
        }
    },

    IsPlaying() {
        return this._isPlaying;
    },

    GetCurrentAnimation() {
        return this._currentAnimation;
    },

    /**
     * Reset all transforms to original values
     */
    _resetTransforms() {
        if (!this._originalTransforms) return;

        const reset = (transform) => {
            const original = this._originalTransforms.get(transform.gameObject.name);
            if (original) {
                transform.localPosition.copy(original.position);
                transform.localRotation.set(original.rotation.x, original.rotation.y, original.rotation.z);
                transform.localScale.copy(original.scale);
                transform._syncMesh();
            }
            for (const child of transform._children) {
                reset(child);
            }
        };

        reset(this.transform);
    },

    /**
     * Set speed for all parts in an animation
     * @param {string} animName - Animation name
     * @param {number} speed - New speed value
     */
    SetSpeed(animName, speed) {
        if (this.animations?.[animName]) {
            for (const config of Object.values(this.animations[animName])) {
                config.speed = speed;
            }
        }
    },

    // ===== KEYFRAME EVENTS =====

    /**
     * Add a keyframe event to an animation
     * @param {string} animName - Animation name
     * @param {number} normalizedTime - Time (0-1) when event fires (0=start, 0.5=middle, 1=end of cycle)
     * @param {Function} callback - Function to call
     * @returns {string} Event ID for removal
     */
    AddEvent(animName, normalizedTime, callback) {
        if (!this._events) this._events = new Map();

        if (!this._events.has(animName)) {
            this._events.set(animName, []);
        }

        const eventId = `${animName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const events = this._events.get(animName);

        events.push({
            id: eventId,
            time: Math.max(0, Math.min(1, normalizedTime)),
            callback,
            fired: false
        });

        // Sort events by time
        events.sort((a, b) => a.time - b.time);

        console.log(`[AnimationScript] Added event to "${animName}" at t=${normalizedTime}`);
        return eventId;
    },

    /**
     * Remove a keyframe event
     * @param {string} eventId - Event ID returned from AddEvent
     * @returns {boolean} Whether event was found and removed
     */
    RemoveEvent(eventId) {
        if (!this._events) return false;

        for (const [animName, events] of this._events) {
            const index = events.findIndex(e => e.id === eventId);
            if (index !== -1) {
                events.splice(index, 1);
                return true;
            }
        }
        return false;
    },

    /**
     * Remove all events for an animation
     * @param {string} animName - Animation name
     */
    ClearEvents(animName) {
        if (this._events?.has(animName)) {
            this._events.set(animName, []);
        }
    },

    /**
     * Get average speed across all parts in an animation
     * @param {Object} anim - Animation config
     * @returns {number} Average speed
     * @private
     */
    _getAverageSpeed(anim) {
        const speeds = Object.values(anim)
            .map(config => config.speed || DEFAULT_SPEED);
        if (speeds.length === 0) return DEFAULT_SPEED;
        return speeds.reduce((a, b) => a + b, 0) / speeds.length;
    },

    /**
     * Process keyframe events for current animation
     * @param {number} normalizedTime - Current normalized time (0-1)
     * @private
     */
    _processEvents(normalizedTime) {
        if (!this._events || !this._currentAnimation) return;

        const events = this._events.get(this._currentAnimation);
        if (!events || events.length === 0) return;

        const prevTime = this._prevNormalizedTime;
        const wrapped = normalizedTime < prevTime; // Animation looped

        for (const event of events) {
            // Fire if we crossed the event time
            const shouldFire = wrapped
                ? (event.time >= prevTime || event.time < normalizedTime) // Wrapped around
                : (event.time > prevTime && event.time <= normalizedTime); // Normal case

            if (shouldFire && !event.fired) {
                try {
                    event.callback(this.gameObject, normalizedTime);
                } catch (e) {
                    console.error('[AnimationScript] Event callback error:', e);
                }
                event.fired = true;
            }

            // Reset fired flag when we pass through 0
            if (wrapped && event.time > normalizedTime) {
                event.fired = false;
            }
        }

        // Reset all fired flags at loop boundary
        if (wrapped) {
            for (const event of events) {
                if (event.time > normalizedTime) {
                    event.fired = false;
                }
            }
        }

        this._prevNormalizedTime = normalizedTime;
    },

    /**
     * Get current normalized time (0-1)
     * @returns {number}
     */
    GetNormalizedTime() {
        if (!this._currentAnimation || !this.animations?.[this._currentAnimation]) {
            return 0;
        }
        const anim = this.animations[this._currentAnimation];
        const avgSpeed = this._getAverageSpeed(anim);
        return ((this._animTime * avgSpeed) % (Math.PI * 2)) / (Math.PI * 2);
    },

    /**
     * Get animation cycle duration in seconds
     * @param {string} [animName] - Animation name (defaults to current)
     * @returns {number} Duration in seconds
     */
    GetCycleDuration(animName) {
        const name = animName || this._currentAnimation;
        if (!name || !this.animations?.[name]) return 0;

        const anim = this.animations[name];
        const avgSpeed = this._getAverageSpeed(anim);
        return (Math.PI * 2) / avgSpeed;
    }
};

export default AnimationScript;
