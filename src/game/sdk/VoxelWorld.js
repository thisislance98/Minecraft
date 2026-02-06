/**
 * VoxelWorld SDK - GameObject + Scripts API (Unity-style)
 */
import * as THREE from 'three';
import { GameObject, Time } from './core/GameObject.js';
import { ScriptTypes, getScript } from './scripts/index.js';
import { DynamicItemIcons } from '../DynamicItemRegistry.js';

// Export Time globally
window.Time = Time;

/**
 * Vector3 helper for Unity-style vector operations
 * Since JS can't overload +, use: Vec3.add(a, b) or a.clone().add(b)
 */
const Vec3 = {
    // Create a new Vector3
    create(x = 0, y = 0, z = 0) {
        return new THREE.Vector3(x, y, z);
    },

    // Add two vectors (returns new vector)
    add(a, b) {
        return new THREE.Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
    },

    // Subtract vectors (a - b, returns new vector)
    sub(a, b) {
        return new THREE.Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
    },

    // Multiply vector by scalar (returns new vector)
    mul(v, scalar) {
        return new THREE.Vector3(v.x * scalar, v.y * scalar, v.z * scalar);
    },

    // Scale (alias for mul)
    scale(v, scalar) {
        return Vec3.mul(v, scalar);
    },

    // Distance between two points
    distance(a, b) {
        return a.distanceTo(b);
    },

    // Normalize (returns new vector)
    normalize(v) {
        return v.clone().normalize();
    },

    // Dot product
    dot(a, b) {
        return a.dot(b);
    },

    // Cross product (returns new vector)
    cross(a, b) {
        return a.clone().cross(b);
    },

    // Lerp between vectors (returns new vector)
    lerp(a, b, t) {
        return a.clone().lerp(b, t);
    },

    // Common directions
    zero: () => new THREE.Vector3(0, 0, 0),
    one: () => new THREE.Vector3(1, 1, 1),
    up: () => new THREE.Vector3(0, 1, 0),
    down: () => new THREE.Vector3(0, -1, 0),
    forward: () => new THREE.Vector3(0, 0, 1),
    back: () => new THREE.Vector3(0, 0, -1),
    left: () => new THREE.Vector3(-1, 0, 0),
    right: () => new THREE.Vector3(1, 0, 0)
};

// Export Vec3 globally
window.Vec3 = Vec3;

class VoxelWorldAPI {
    constructor() {
        this._game = null;
        this._initialized = false;
        this._listeners = new Map();

        // Registries
        this._objects = new Map();      // All registered GameObjects
        this._items = new Map();        // Objects with ItemScript (for inventory)
        this._entities = new Map();     // Spawnable objects (with AIScript or HealthScript)
        this._projectiles = new Map();  // Objects with ProjectileScript
        this._icons = new Map();        // Item icons

        // Active instances in world
        this._instances = new Set();

        // Undo system - tracks changes per task
        this._undoStack = [];           // Stack of undo records
        this._currentTaskId = null;     // Current task being tracked
        this._currentUndoRecord = null; // Current undo record being built
    }

    // ===== UNDO TRACKING =====

    /**
     * Start tracking changes for a task (called when code execution begins)
     * @param {string} taskId - The task ID to track
     */
    beginTracking(taskId) {
        this._currentTaskId = taskId;
        this._currentUndoRecord = {
            taskId,
            timestamp: Date.now(),
            spawned: [],          // Entity instances spawned
            registered: [],       // Object types registered
            itemsGiven: [],       // Items given to player
            blocksPlaced: [],     // Blocks placed { x, y, z, oldType }
            scriptsAdded: [],     // Scripts added to entities
            partsAdded: []        // Mesh parts added
        };
        console.log(`[VoxelWorld] Started tracking changes for task: ${taskId}`);
    }

    /**
     * End tracking and save the undo record
     * @returns {Object} The completed undo record
     */
    endTracking() {
        if (!this._currentUndoRecord) return null;

        const record = this._currentUndoRecord;

        // Only save if there are actual changes
        const hasChanges = record.spawned.length > 0 ||
            record.registered.length > 0 ||
            record.itemsGiven.length > 0 ||
            record.blocksPlaced.length > 0;

        if (hasChanges) {
            this._undoStack.push(record);
            console.log(`[VoxelWorld] Saved undo record for task ${record.taskId}:`, {
                spawned: record.spawned.length,
                registered: record.registered.length,
                items: record.itemsGiven.length,
                blocks: record.blocksPlaced.length
            });
        }

        this._currentTaskId = null;
        this._currentUndoRecord = null;
        return record;
    }

    /**
     * Get undo record for a specific task
     * @param {string} taskId
     * @returns {Object|null}
     */
    getUndoRecord(taskId) {
        return this._undoStack.find(r => r.taskId === taskId) || null;
    }

    /**
     * Undo changes from a specific task
     * @param {string} taskId - Task to undo
     * @returns {Object} Result of undo operation
     */
    undoTask(taskId) {
        const recordIndex = this._undoStack.findIndex(r => r.taskId === taskId);
        if (recordIndex === -1) {
            return { success: false, error: 'No undo record found for this task' };
        }

        const record = this._undoStack[recordIndex];
        const result = { success: true, undone: {} };

        // 1. Destroy spawned entities
        if (record.spawned.length > 0) {
            let destroyed = 0;
            for (const entity of record.spawned) {
                if (this._instances.has(entity)) {
                    this.destroyEntity(entity);
                    destroyed++;
                }
            }
            result.undone.entities = destroyed;
        }

        // 2. Unregister object types
        if (record.registered.length > 0) {
            for (const typeId of record.registered) {
                this._objects.delete(typeId);
                this._items.delete(typeId);
                this._entities.delete(typeId);
                this._projectiles.delete(typeId);
                this._icons.delete(typeId);
            }
            result.undone.types = record.registered.length;
        }

        // 3. Remove given items from inventory
        if (record.itemsGiven.length > 0) {
            for (const item of record.itemsGiven) {
                this._game?.inventoryManager?.removeItem(item.id, item.count);
            }
            result.undone.items = record.itemsGiven.length;
        }

        // 4. Restore blocks to previous state
        if (record.blocksPlaced.length > 0) {
            for (const block of record.blocksPlaced) {
                this.setBlock(block.x, block.y, block.z, block.oldType);
            }
            result.undone.blocks = record.blocksPlaced.length;
        }

        // Remove from undo stack
        this._undoStack.splice(recordIndex, 1);

        this.emit('task:undone', { taskId, result });
        console.log(`[VoxelWorld] Undid task ${taskId}:`, result.undone);
        return result;
    }

    /**
     * Undo the most recent task
     * @returns {Object} Result of undo operation
     */
    undoLast() {
        if (this._undoStack.length === 0) {
            return { success: false, error: 'Nothing to undo' };
        }
        const lastRecord = this._undoStack[this._undoStack.length - 1];
        return this.undoTask(lastRecord.taskId);
    }

    /**
     * Get list of undoable tasks
     * @returns {Array} List of task IDs that can be undone
     */
    getUndoableTaskIds() {
        return this._undoStack.map(r => r.taskId);
    }

    // Track spawned entity
    _trackSpawn(entity) {
        if (this._currentUndoRecord && entity) {
            this._currentUndoRecord.spawned.push(entity);
        }
    }

    // Track registered type
    _trackRegister(typeId) {
        if (this._currentUndoRecord && typeId) {
            this._currentUndoRecord.registered.push(typeId);
        }
    }

    // Track given item
    _trackItemGiven(id, count) {
        if (this._currentUndoRecord) {
            this._currentUndoRecord.itemsGiven.push({ id, count });
        }
    }

    // Track block placement
    _trackBlockPlaced(x, y, z, oldType) {
        if (this._currentUndoRecord) {
            this._currentUndoRecord.blocksPlaced.push({ x, y, z, oldType });
        }
    }

    // ===== INIT =====

    init(game) {
        if (this._initialized) return;
        this._game = game;
        this._initialized = true;
        window.VoxelWorld = this;
        console.log('[VoxelWorld] SDK initialized');
    }

    get isInitialized() {
        return this._initialized;
    }

    // ===== CREATION =====

    /**
     * Create a new game object
     * @param {string} name - Name/ID of the object
     * @returns {GameObject}
     */
    createObject(name) {
        const obj = new GameObject(name);
        obj.game = this._game;

        // Store original attach method
        const originalAttach = obj.attach.bind(obj);

        // Return enhanced object with chaining
        const enhanced = obj;

        // Add chaining method that handles string script names AND custom scripts
        enhanced.attach = (script, config = {}) => {
            // Handle string script names (built-in scripts)
            if (typeof script === 'string') {
                const scriptType = getScript(script);
                if (!scriptType) {
                    console.warn(`[VoxelWorld] Unknown script type: ${script}`);
                    return enhanced;
                }

                // Special handling for 'mesh' - if config is an array, it's multi-part mode
                if (script.toLowerCase() === 'mesh' && Array.isArray(config)) {
                    config = { parts: config };
                }

                script = scriptType;
            }
            // Custom scripts (objects/classes) pass through directly
            originalAttach(script, config);
            return enhanced;
        };

        // Add register method
        enhanced.register = () => {
            return this.register(obj);
        };

        // Add on method for callbacks
        enhanced.on = (event, callback) => {
            // Create a custom script for this callback
            // Uses capitalized method names to match GameObject expectations
            const callbackScript = {};
            switch (event) {
                case 'use': callbackScript.OnUse = (p) => callback(obj, p); break;
                case 'hit': callbackScript.OnDamage = (d, a) => callback(obj, d, a); break;
                case 'death': callbackScript.OnDeath = () => callback(obj); break;
                case 'update': callbackScript.Update = () => callback(obj, Time.deltaTime); break;
                case 'start': callbackScript.Start = () => callback(obj); break;
                case 'destroy': callbackScript.OnDestroy = () => callback(obj); break;
                case 'collision': callbackScript.OnCollisionEnter = (other) => callback(obj, other); break;
            }
            obj.attach(callbackScript);
            return enhanced;
        };

        return enhanced;
    }

    // ===== PRESETS (common object templates) =====

    /**
     * Create a creature with sensible defaults
     * Only mesh config is required - everything else has smart defaults
     *
     * @param {string} name - Creature name
     * @param {Object} options
     * @param {Array} options.mesh - Mesh parts (required)
     * @param {string} options.behavior - 'passive' | 'neutral' | 'hostile' | 'pet' (default: 'passive')
     * @param {number} options.health - Max health (default: 20)
     * @param {number} options.speed - Movement speed (default: 2)
     * @param {Object} options.animations - Animation definitions (optional)
     *
     * @example
     * VoxelWorld.createCreature('Pig', {
     *   mesh: [{ type: 'box', size: [0.8, 0.6, 1.2], color: 0xffaaaa }],
     *   behavior: 'passive',
     *   health: 10
     * }).register();
     */
    createCreature(name, options = {}) {
        const {
            mesh,
            behavior = 'passive',
            health = 20,
            speed = 2,
            damage = 5,
            animations = null
        } = options;

        if (!mesh) {
            console.warn(`[VoxelWorld] createCreature requires mesh option`);
        }

        const obj = this.createObject(name);

        if (mesh) {
            obj.attach('mesh', mesh);
        }

        obj.attach('ai', {
            behavior,
            speed,
            avoidsWater: true,
            avoidsCliffs: true,
            fleeRange: behavior === 'passive' ? 6 : 0
        });

        obj.attach('health', {
            max: health,
            current: health,
            damage
        });

        if (animations) {
            obj.attach('animation', {
                animations,
                defaultAnimation: 'idle'
            });
        }

        return obj;
    }

    /**
     * Create an item with sensible defaults
     *
     * @param {string} name - Item name
     * @param {Object} options
     * @param {Array} options.mesh - Mesh parts (required for 3D items)
     * @param {string} options.icon - SVG icon (required)
     * @param {string} options.category - 'tool' | 'block' | 'food' | 'material' | 'misc' (default: 'misc')
     * @param {Function} options.onUse - Called when item is used
     *
     * @example
     * VoxelWorld.createItem('MagicWand', {
     *   mesh: [{ type: 'cylinder', size: [0.1, 1], color: 0x5c4033 }],
     *   icon: '<svg>...</svg>',
     *   category: 'tool',
     *   onUse: (player) => console.log('Magic!')
     * }).register();
     */
    createItem(name, options = {}) {
        const {
            mesh,
            icon,
            category = 'misc',
            stackable = category !== 'tool',
            onUse = null
        } = options;

        if (!icon) {
            console.warn(`[VoxelWorld] createItem requires icon option`);
        }

        const obj = this.createObject(name);

        if (mesh) {
            obj.attach('mesh', mesh);
        }

        obj.attach('item', {
            icon,
            category,
            stackable,
            maxStack: stackable ? 64 : 1
        });

        if (onUse) {
            obj.on('use', (o, player) => onUse(player));
        }

        return obj;
    }

    /**
     * Create a projectile with sensible defaults
     *
     * @param {string} name - Projectile name
     * @param {Object} options
     * @param {Array} options.mesh - Mesh parts (required)
     * @param {number} options.damage - Damage on hit (default: 10)
     * @param {number} options.lifetime - Seconds before despawn (default: 3)
     * @param {number} options.gravity - Gravity multiplier, 0 = none (default: 0)
     * @param {boolean} options.trail - Enable particle trail (default: false)
     *
     * @example
     * VoxelWorld.createProjectile('Fireball', {
     *   mesh: [{ type: 'sphere', size: [0.3], color: 0xff4400, emissive: 0xff2200 }],
     *   damage: 15,
     *   trail: true
     * }).register();
     */
    createProjectile(name, options = {}) {
        const {
            mesh,
            damage = 10,
            lifetime = 3,
            gravity = 0,
            trail = false,
            trailColor = 0xffffff
        } = options;

        if (!mesh) {
            console.warn(`[VoxelWorld] createProjectile requires mesh option`);
        }

        const obj = this.createObject(name);

        if (mesh) {
            obj.attach('mesh', mesh);
        }

        obj.attach('projectile', {
            damage,
            lifetime,
            gravity,
            destroyOnHit: true
        });

        if (trail) {
            obj.attach('particle', {
                trail: true,
                trailColor,
                trailRate: 15
            });
        }

        return obj;
    }

    /**
     * Define a reusable custom script
     * @param {string} name - Script name
     * @param {Object} definition - Script definition with lifecycle methods
     */
    defineScript(name, definition) {
        definition.type = name;
        this._customScripts = this._customScripts || new Map();
        this._customScripts.set(name, definition);
        return definition;
    }

    /**
     * Get a defined custom script by name
     */
    getCustomScript(name) {
        return this._customScripts?.get(name) || null;
    }

    /**
     * Register a game object (makes it available to spawn/give)
     * Auto-attaches required scripts based on what's already attached.
     */
    register(obj) {
        const id = obj.id || obj.name.toLowerCase().replace(/\s+/g, '_');

        // ===== SMART DEFAULTS =====
        // Auto-attach required scripts based on what the developer added

        const hasAI = obj.hasScript('AIScript');
        const hasHealth = obj.hasScript('HealthScript');
        const hasPhysics = obj.hasScript('PhysicsScript');
        const hasMesh = obj.hasScript('MeshScript');
        const hasAnimation = obj.hasScript('AnimationScript');
        const hasProjectile = obj.hasScript('ProjectileScript');

        // AI needs Physics to move
        if (hasAI && !hasPhysics) {
            const aiScript = obj.getScript('AIScript');
            obj.attach('physics', {
                speed: aiScript.speed || 2,
                mode: 'walking',
                gravity: true
            });
        }

        // Sync AI speed to Physics speed if both exist
        if (hasAI && obj.hasScript('PhysicsScript')) {
            const aiScript = obj.getScript('AIScript');
            const physicsScript = obj.getScript('PhysicsScript');
            // Use AI's speed as the authoritative source
            physicsScript.speed = aiScript.speed || physicsScript.speed;
        }

        // If has Animation and AI, auto-link animation to AI state
        if (hasAnimation && hasAI) {
            const animScript = obj.getScript('AnimationScript');
            const aiScript = obj.getScript('AIScript');

            // Wrap AI's update to auto-switch animations
            const originalAIUpdate = aiScript.Update?.bind(aiScript);
            if (originalAIUpdate && animScript.animations) {
                const hasWalkAnim = animScript.animations.walk || animScript.animations.Walk;
                const hasIdleAnim = animScript.animations.idle || animScript.animations.Idle;

                if (hasWalkAnim || hasIdleAnim) {
                    aiScript.Update = function() {
                        originalAIUpdate();
                        // Auto-switch animation based on movement
                        const isMoving = this._isMoving;
                        const currentAnim = animScript.GetCurrentAnimation();

                        if (isMoving && currentAnim !== 'walk' && currentAnim !== 'Walk') {
                            if (hasWalkAnim) animScript.Play(hasWalkAnim ? 'walk' : 'Walk');
                        } else if (!isMoving && currentAnim !== 'idle' && currentAnim !== 'Idle') {
                            if (hasIdleAnim) animScript.Play(hasIdleAnim ? 'idle' : 'Idle');
                        }
                    };
                }
            }
        }

        // Projectiles need physics for movement (but different defaults)
        if (hasProjectile && !hasPhysics) {
            obj.attach('physics', {
                gravity: false,
                mode: 'flying'
            });
        }

        this._objects.set(id, obj);

        // Categorize by scripts
        if (obj.hasScript('ItemScript')) {
            this._items.set(id, obj);
            const itemScript = obj.getScript('ItemScript');
            if (itemScript.icon) {
                this._icons.set(id, itemScript.icon);
                // Also register with DynamicItemIcons for inventory UI
                DynamicItemIcons[id] = itemScript.icon;
                console.log(`[VoxelWorld] Registered icon for item '${id}'`);
            }

            // Register with game's ItemManager
            this._registerWithItemManager(obj);
        }

        // Spawnable entities (creatures with AI or health)
        if (obj.hasScript('AIScript') || obj.hasScript('HealthScript')) {
            this._entities.set(id, obj);

            // Register with AnimalRegistry
            this._registerWithAnimalRegistry(obj);
        }

        if (obj.hasScript('ProjectileScript')) {
            this._projectiles.set(id, obj);
        }

        // Track for undo
        this._trackRegister(id);

        this.emit('object:registered', obj);
        console.log(`[VoxelWorld] Registered: ${obj.name}`);

        return obj;
    }

    /**
     * Create and register in one call (for Merlin AI)
     * @param {Object} config - { name, scripts: [{ type, ...config }] }
     */
    create(config) {
        const obj = this.createObject(config.name);

        // Attach scripts from config
        if (config.scripts && Array.isArray(config.scripts)) {
            for (const scriptConfig of config.scripts) {
                const { type, ...rest } = scriptConfig;
                obj.attach(type, rest);
            }
        }

        return obj.register();
    }

    // ===== SPAWNING =====

    /**
     * Spawn a registered object into the world
     */
    spawn(nameOrId, x, y, z, options = {}) {
        const id = nameOrId.toLowerCase().replace(/\s+/g, '_');
        const template = this._objects.get(id);

        if (!template) {
            console.warn(`[VoxelWorld] Unknown object: ${nameOrId}`);
            return null;
        }

        // If position not provided, spawn in front of player
        let spawnX = x, spawnY = y, spawnZ = z;
        if (spawnX === undefined || spawnX === null || isNaN(spawnX)) {
            const player = this.localPlayer;
            if (player) {
                const fwd = player.transform.forward;
                const distance = 8;
                spawnX = player.position.x + fwd.x * distance;
                spawnZ = player.position.z + fwd.z * distance;

                // Use actual terrain height if available
                if (this._game?.getGroundLevel) {
                    const groundY = this._game.getGroundLevel(spawnX, spawnZ);
                    spawnY = groundY + 1; // 1 unit above ground
                } else {
                    spawnY = player.position.y + 1.5;
                }
            } else {
                spawnX = 0;
                spawnY = 50;
                spawnZ = 0;
            }
        } else if (spawnY === undefined || spawnY === null || isNaN(spawnY)) {
            // X,Z provided but not Y - find ground level
            if (this._game?.getGroundLevel) {
                const groundY = this._game.getGroundLevel(spawnX, spawnZ);
                spawnY = groundY + 1;
            } else {
                spawnY = 50;
            }
        }

        // Clone the template
        const instance = this._cloneObject(template);
        instance.transform.position.set(spawnX, spawnY, spawnZ);
        instance.game = this._game;

        // Apply options
        if (options.velocity) {
            const projectile = instance.getScript('ProjectileScript');
            if (projectile) {
                projectile.setVelocity(options.velocity);
            }
        }

        // Start the instance (this creates meshes via MeshScript.Start)
        instance.start();

        // Build mesh hierarchy AFTER all meshes are created
        // Create THREE.Group for pivot nodes (GameObjects without mesh)
        // This preserves transform hierarchy exactly like Unity

        const ensureMeshOrGroup = (gameObject) => {
            if (!gameObject.mesh) {
                // Create a Group to act as transform pivot
                gameObject.mesh = new THREE.Group();
                gameObject.mesh.name = gameObject.name + '_pivot';
            }
        };

        const buildMeshHierarchy = (gameObject) => {
            ensureMeshOrGroup(gameObject);

            for (const childTransform of gameObject.transform._children) {
                const child = childTransform.gameObject;
                ensureMeshOrGroup(child);

                // Parent child mesh/group to parent mesh/group
                gameObject.mesh.add(child.mesh);

                // Set local position
                child.mesh.position.copy(childTransform.localPosition);
                child.mesh.rotation.copy(childTransform.localRotation);
                child.mesh.scale.copy(childTransform.localScale);

                // Recurse
                buildMeshHierarchy(child);
            }
        };
        buildMeshHierarchy(instance);

        // Sync all transforms
        const syncAll = (gameObject) => {
            gameObject.syncTransform();
            for (const ct of gameObject.transform._children) {
                syncAll(ct.gameObject);
            }
        };
        syncAll(instance);

        // Find the root mesh (first mesh that has no mesh parent in hierarchy)
        const findRootMesh = (gameObject) => {
            if (gameObject.mesh) return gameObject.mesh;
            for (const ct of gameObject.transform._children) {
                const found = findRootMesh(ct.gameObject);
                if (found) return found;
            }
            return null;
        };

        const rootMesh = findRootMesh(instance);
        if (rootMesh && this._game?.scene) {
            // Calculate mesh height offset (meshes are centered, so add half height)
            let heightOffset = 0;
            if (rootMesh.geometry) {
                rootMesh.geometry.computeBoundingBox();
                const bbox = rootMesh.geometry.boundingBox;
                if (bbox) {
                    // Half the height of the mesh (center to bottom)
                    heightOffset = -bbox.min.y;
                }
            }

            // Position the root mesh at spawn location + height offset
            const finalY = spawnY + heightOffset;
            rootMesh.position.set(spawnX, finalY, spawnZ);
            this._game.scene.add(rootMesh);

            console.log(`[SDK:Spawn] ${instance.name} at (${spawnX.toFixed(1)}, ${finalY.toFixed(1)}, ${spawnZ.toFixed(1)}) | terrainY=${spawnY.toFixed(1)}, heightOffset=${heightOffset.toFixed(2)}`);

            // Update physics groundY to account for mesh height
            const physics = instance.getScript('PhysicsScript');
            if (physics) {
                physics.groundY = finalY;
                physics._meshHeightOffset = heightOffset; // Pre-set so physics doesn't recalculate
            }
        }

        // Track instance
        this._instances.add(instance);

        // Track for undo
        this._trackSpawn(instance);

        this.emit('object:spawn', instance);
        return instance;
    }

    /**
     * Give an item to the player
     */
    giveItem(idOrName, count = 1) {
        const id = idOrName.toLowerCase().replace(/\s+/g, '_');

        if (!this._game?.inventoryManager) {
            console.warn('[VoxelWorld] No inventory manager');
            return false;
        }

        // Look up the registered item to get its type and icon
        const registeredItem = this._items.get(id);
        let type = 'item';  // Default type

        if (registeredItem) {
            const itemScript = registeredItem.getScript('ItemScript');
            if (itemScript) {
                // Determine type based on category
                const category = itemScript.category || 'misc';
                if (category === 'tool') type = 'tool';
                else if (category === 'block') type = 'block';
                else if (category === 'food') type = 'food';
                else type = 'item';

                // Register icon with DynamicItemIcons so inventory can find it
                if (itemScript.icon && !DynamicItemIcons[id]) {
                    DynamicItemIcons[id] = itemScript.icon;
                    console.log(`[VoxelWorld] Registered icon for item '${id}'`);
                }
            }
        }

        const result = this._game.inventoryManager.addItem(id, count, type);

        // Track for undo
        if (result) {
            this._trackItemGiven(id, count);
        }

        return result;
    }

    // ===== FINDING & MODIFYING ENTITIES =====

    /**
     * Find all spawned instances of an entity type
     * @param {string} nameOrId - Entity type name/id
     * @returns {Array<GameObject>} - Array of matching instances
     */
    findEntities(nameOrId) {
        const id = nameOrId.toLowerCase().replace(/\s+/g, '_');
        const results = [];

        for (const instance of this._instances) {
            if (instance.id === id || instance.name?.toLowerCase() === id) {
                results.push(instance);
            }
        }

        return results;
    }

    /**
     * Find the nearest entity of a type to the player
     * @param {string} nameOrId - Entity type name/id
     * @returns {GameObject|null} - Nearest instance or null
     */
    findNearestEntity(nameOrId) {
        const entities = this.findEntities(nameOrId);
        if (entities.length === 0) return null;

        const player = this.localPlayer;
        if (!player) return entities[0];

        const playerPos = player.position;
        let nearest = null;
        let nearestDist = Infinity;

        for (const entity of entities) {
            const dist = playerPos.distanceTo(entity.transform.position);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = entity;
            }
        }

        return nearest;
    }

    /**
     * Get all active instances in the world
     * @returns {Array<GameObject>}
     */
    getAllEntities() {
        return Array.from(this._instances);
    }

    /**
     * Add a script to a registered object type (affects future spawns)
     * @param {string} nameOrId - Object type name/id
     * @param {class} ScriptClass - Script class to add
     */
    addScriptToType(nameOrId, ScriptClass) {
        const id = nameOrId.toLowerCase().replace(/\s+/g, '_');
        const template = this._objects.get(id);

        if (!template) {
            console.warn(`[VoxelWorld] Unknown object type: ${nameOrId}`);
            return false;
        }

        // Add script to the template (affects future spawns)
        template.attach(ScriptClass);
        console.log(`[VoxelWorld] Added ${ScriptClass.name || 'script'} to ${id} template`);
        return true;
    }

    /**
     * Add a script to all existing instances of a type AND the type template
     * @param {string} nameOrId - Object type name/id
     * @param {class} ScriptClass - Script class to add
     */
    addScript(nameOrId, ScriptClass) {
        // Add to template for future spawns
        this.addScriptToType(nameOrId, ScriptClass);

        // Add to all existing instances
        const instances = this.findEntities(nameOrId);
        for (const instance of instances) {
            instance.addScript(ScriptClass);
        }

        console.log(`[VoxelWorld] Added ${ScriptClass.name || 'script'} to ${instances.length} existing ${nameOrId} instances`);
        return instances.length;
    }

    /**
     * Add mesh parts to an existing entity
     * @param {GameObject|string} entityOrName - Entity instance or type name
     * @param {Array|Object} parts - Part config or array of part configs
     */
    addParts(entityOrName, parts) {
        const entities = typeof entityOrName === 'string'
            ? this.findEntities(entityOrName)
            : [entityOrName];

        const partsArray = Array.isArray(parts) ? parts : [parts];
        let count = 0;

        for (const entity of entities) {
            const meshScript = entity.getScript('MeshScript');
            if (meshScript) {
                meshScript.addParts(partsArray);
                count++;
            }
        }

        console.log(`[VoxelWorld] Added ${partsArray.length} parts to ${count} entities`);
        return count;
    }

    /**
     * Add a child GameObject to an existing entity
     * @param {GameObject|string} parentOrName - Parent entity instance or type name
     * @param {string} childName - Name for the child object
     * @param {Object} options - { parts, position, scripts }
     * @returns {GameObject|Array<GameObject>} The created child(ren)
     */
    addChild(parentOrName, childName, options = {}) {
        const parents = typeof parentOrName === 'string'
            ? this.findEntities(parentOrName)
            : [parentOrName];

        const children = [];

        for (const parent of parents) {
            if (!parent.mesh) continue;

            // Create child GameObject
            const child = this.createObject(childName);

            if (options.parts) {
                child.attach('mesh', { parts: options.parts });
            }

            // Attach any additional scripts
            if (options.scripts) {
                for (const script of options.scripts) {
                    if (typeof script === 'function') {
                        child.attach(script);
                    } else if (script.type) {
                        child.attach(script.type, script);
                    }
                }
            }

            // Create the child instance
            const instance = child.build();
            instance.start();

            // Set local position relative to parent
            if (options.position) {
                const pos = options.position;
                instance.transform.position.set(
                    pos[0] || pos.x || 0,
                    pos[1] || pos.y || 0,
                    pos[2] || pos.z || 0
                );
            }

            // Add mesh as child of parent mesh
            if (instance.mesh) {
                instance.mesh.position.copy(instance.transform.position);
                parent.mesh.add(instance.mesh);
            }

            // Track parent-child relationship
            if (!parent._children) parent._children = [];
            parent._children.push(instance);
            instance._parent = parent;

            children.push(instance);
        }

        console.log(`[VoxelWorld] Added child '${childName}' to ${children.length} parents`);
        return children.length === 1 ? children[0] : children;
    }

    /**
     * Destroy an entity instance
     * @param {GameObject} entity - The entity to destroy
     */
    destroyEntity(entity) {
        if (!entity) return false;

        // Remove from scene
        if (entity.mesh && this._game?.scene) {
            this._game.scene.remove(entity.mesh);
        }

        // Stop scripts
        entity.destroy?.();

        // Remove from tracking
        this._instances.delete(entity);

        this.emit('object:destroyed', entity);
        return true;
    }

    /**
     * Destroy all instances of an entity type
     * @param {string} nameOrId - Entity type name/id
     * @returns {number} - Number of entities destroyed
     */
    destroyAllOfType(nameOrId) {
        const entities = this.findEntities(nameOrId);
        let count = 0;

        for (const entity of entities) {
            if (this.destroyEntity(entity)) {
                count++;
            }
        }

        return count;
    }

    // ===== WORLD / BLOCKS =====

    getBlock(x, y, z) {
        // Use game.getBlock directly (handles chunk lookup internally)
        const block = this._game?.getBlock(x, y, z);
        return block || null;
    }

    /**
     * Set a single block
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {string|number|null} type - Block type or null to remove
     */
    setBlock(x, y, z, type) {
        if (!this._game) return false;

        // Track old block for undo (only if we're tracking)
        const oldType = this._currentUndoRecord ? this.getBlock(x, y, z) : null;

        if (type === null || type === 'air' || type === 0) {
            // Remove block
            this._game.setBlock(x, y, z, 0);
            this.emit('block:removed', { x, y, z });
        } else {
            this._game.setBlock(x, y, z, type);
            this.emit('block:placed', { x, y, z, type });
        }

        // Track for undo
        if (oldType !== null) {
            this._trackBlockPlaced(x, y, z, oldType);
        }

        return true;
    }

    /**
     * Remove a block (set to air)
     */
    removeBlock(x, y, z) {
        return this.setBlock(x, y, z, null);
    }

    /**
     * Set multiple blocks at once
     * @param {Array<{x, y, z, type}>} blocks - Array of block placements
     */
    setBlocks(blocks) {
        if (!this._game || !Array.isArray(blocks)) return { success: false, error: 'Invalid input' };

        let placed = 0;
        for (const block of blocks) {
            if (this.setBlock(block.x, block.y, block.z, block.type || block.id)) {
                placed++;
            }
        }

        this.emit('blocks:placed', { count: placed });
        return { success: true, count: placed };
    }

    /**
     * Fill a region with blocks
     * @param {number} x1, y1, z1 - Start corner
     * @param {number} x2, y2, z2 - End corner
     * @param {string} type - Block type
     */
    fill(x1, y1, z1, x2, y2, z2, type) {
        if (!this._game) return { success: false, error: 'Game not initialized' };

        const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
        const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);

        let count = 0;
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    this.setBlock(x, y, z, type);
                    count++;
                }
            }
        }

        return { success: true, count };
    }

    // ===== STRUCTURES =====

    /**
     * Spawn a tree at position
     * @param {string} type - Tree type: oak, birch, pine, acacia, palm, willow, dark_oak, giant
     * @param {number} x, y, z - Position
     */
    spawnTree(type, x, y, z) {
        // Try worldGen (VoxelGame uses this.worldGen)
        const worldGen = this._game?.worldGen || this._game?.worldGenerator;
        if (!worldGen?.structureGenerator) {
            return { success: false, error: 'Structure generator not available' };
        }

        const gen = worldGen.structureGenerator;
        const treeType = (type || 'oak').toLowerCase();

        try {
            switch (treeType) {
                case 'oak':
                    gen.generateOakTree(x, y, z);
                    break;
                case 'birch':
                    gen.generateBirchTree(x, y, z);
                    break;
                case 'pine':
                case 'spruce':
                    gen.generatePineTree(x, y, z);
                    break;
                case 'acacia':
                    gen.generateAcaciaTree(x, y, z);
                    break;
                case 'palm':
                    gen.generatePalmTree(x, y, z);
                    break;
                case 'willow':
                    gen.generateWillowTree(x, y, z);
                    break;
                case 'dark_oak':
                case 'darkoak':
                    gen.generateDarkOakTree(x, y, z);
                    break;
                case 'giant':
                    gen.generateGiantTree(x, y, z);
                    break;
                case 'cactus':
                    gen.generateCactus(x, y, z);
                    break;
                default:
                    gen.generateOakTree(x, y, z);
            }

            this.emit('structure:spawned', { type: 'tree', subtype: treeType, x, y, z });
            return { success: true, type: treeType, position: { x, y, z } };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Get list of available tree types
     */
    getTreeTypes() {
        return ['oak', 'birch', 'pine', 'acacia', 'palm', 'willow', 'dark_oak', 'giant', 'cactus'];
    }

    /**
     * Get list of available block types
     */
    getBlockTypes() {
        try {
            const { Blocks } = require('../core/Blocks.js');
            return Object.keys(Blocks);
        } catch (e) {
            // Fallback common blocks
            return ['grass', 'dirt', 'stone', 'wood', 'log', 'leaves', 'sand', 'glass',
                    'brick', 'cobblestone', 'planks', 'water', 'lava', 'ice', 'snow'];
        }
    }

    // ===== QUERIES =====

    findInRadius(position, radius, filter = null) {
        const results = [];
        const pos = position instanceof THREE.Vector3
            ? position
            : new THREE.Vector3(position.x, position.y, position.z);

        for (const instance of this._instances) {
            if (instance.position.distanceTo(pos) <= radius) {
                if (!filter || filter(instance)) {
                    results.push(instance);
                }
            }
        }

        // Also check game's animals
        if (this._game?.animals) {
            for (const animal of this._game.animals) {
                if (animal.position.distanceTo(pos) <= radius) {
                    if (!filter || filter(animal)) {
                        results.push(animal);
                    }
                }
            }
        }

        return results;
    }

    // ===== PLAYER =====

    /**
     * Get local player with Unity-style transform
     * @returns {Object} Player with transform.position, transform.forward, etc.
     */
    get localPlayer() {
        const player = this._game?.player;
        if (!player) return null;

        const camera = this._game?.camera;
        const self = this;

        // Create Unity-style transform wrapper if not already added
        if (!player._unityTransform) {
            player._unityTransform = {
                get position() {
                    return player.position;
                },
                set position(v) {
                    player.position.copy(v);
                },
                get forward() {
                    if (!camera) return new THREE.Vector3(0, 0, -1);
                    const dir = new THREE.Vector3();
                    camera.getWorldDirection(dir);
                    return dir;
                },
                get right() {
                    const fwd = this.forward;
                    // Cross product: forward × up = right (in right-hand system)
                    // If fwd=(0,0,1), up=(0,1,0), right should be (1,0,0)
                    return new THREE.Vector3(fwd.z, 0, -fwd.x).normalize();
                },
                get up() {
                    return new THREE.Vector3(0, 1, 0);
                },
                get rotation() {
                    if (!camera) return new THREE.Euler();
                    return camera.rotation.clone();
                },
                get eulerAngles() {
                    if (!camera) return { x: 0, y: 0, z: 0 };
                    return {
                        x: THREE.MathUtils.radToDeg(camera.rotation.x),
                        y: THREE.MathUtils.radToDeg(camera.rotation.y),
                        z: THREE.MathUtils.radToDeg(camera.rotation.z)
                    };
                },
                Translate(x, y, z) {
                    player.position.x += x;
                    player.position.y += y;
                    player.position.z += z;
                },
                LookAt(target) {
                    // Player can't directly lookAt, but we can note the direction
                    console.log('[Transform] LookAt not fully implemented for player');
                }
            };
        }

        // Add transform getter to player
        if (!player.transform || player.transform !== player._unityTransform) {
            Object.defineProperty(player, 'transform', {
                get() { return player._unityTransform; },
                configurable: true
            });
        }

        return player;
    }

    // ===== EVENTS =====

    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        this._listeners.get(event).push(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        const list = this._listeners.get(event);
        if (list) {
            const idx = list.indexOf(callback);
            if (idx > -1) list.splice(idx, 1);
        }
    }

    emit(event, data) {
        const list = this._listeners.get(event);
        if (list) {
            list.forEach(cb => {
                try { cb(data); } catch (e) { console.error(e); }
            });
        }
    }

    // ===== VISIBILITY / VIEW =====

    /**
     * Get all objects visible in the player's view frustum
     * Useful for AI to verify that created objects are visible to the player
     * @param {Object} options
     * @param {number} options.maxDistance - Maximum distance to check (default: 100)
     * @param {boolean} options.checkOcclusion - Check line-of-sight occlusion (default: false)
     * @returns {Array} Array of visible objects with type, distance, position info
     */
    getObjectsInView(options = {}) {
        if (!this._game) return [];

        // Use the game's built-in method if available
        if (typeof this._game.getObjectsInView === 'function') {
            const results = this._game.getObjectsInView(options);
            // Strip raw object references for cleaner output
            return results.map(obj => {
                const { object, ...rest } = obj;
                return rest;
            });
        }

        // Fallback manual implementation
        const {
            maxDistance = 100,
            checkOcclusion = false
        } = options;

        const game = this._game;
        const camera = game.camera;
        const player = game.player;
        if (!camera || !player) return [];

        // Update frustum
        camera.updateMatrixWorld();
        const frustum = new THREE.Frustum();
        const matrix = new THREE.Matrix4();
        matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(matrix);

        const visibleObjects = [];
        const maxDistSq = maxDistance * maxDistance;
        const testSphere = new THREE.Sphere(new THREE.Vector3(), 2.0);

        // Check animals
        if (game.animals) {
            for (const animal of game.animals) {
                if (!animal.position) continue;

                const distSq = animal.position.distanceToSquared(camera.position);
                if (distSq > maxDistSq) continue;

                testSphere.center.copy(animal.position);
                testSphere.radius = animal.height || 2.0;

                if (frustum.intersectsSphere(testSphere)) {
                    visibleObjects.push({
                        type: 'entity',
                        entityType: animal.constructor.name,
                        id: animal.id,
                        distance: Math.round(Math.sqrt(distSq) * 10) / 10,
                        position: {
                            x: Math.round(animal.position.x * 10) / 10,
                            y: Math.round(animal.position.y * 10) / 10,
                            z: Math.round(animal.position.z * 10) / 10
                        }
                    });
                }
            }
        }

        // Sort by distance
        visibleObjects.sort((a, b) => a.distance - b.distance);
        return visibleObjects;
    }

    /**
     * Check if a specific entity type is visible to the player
     * @param {string} entityType - Entity type to check (e.g., 'Slime', 'Wolf')
     * @param {number} maxDistance - Max distance to check (default: 50)
     * @returns {Object} { found: boolean, count: number, entities: Array }
     */
    isEntityVisible(entityType, maxDistance = 50) {
        const visible = this.getObjectsInView({ maxDistance });
        const matches = visible.filter(
            obj => obj.type === 'entity' &&
                   obj.entityType.toLowerCase() === entityType.toLowerCase()
        );
        return {
            found: matches.length > 0,
            count: matches.length,
            entities: matches
        };
    }

    /**
     * Get a summary of what the player can see
     * @param {number} maxDistance - Max distance to check (default: 100)
     * @returns {Object} Summary with counts by entity type
     */
    getViewSummary(maxDistance = 100) {
        const visible = this.getObjectsInView({ maxDistance });
        const byType = {};
        for (const obj of visible) {
            if (obj.type === 'entity') {
                byType[obj.entityType] = (byType[obj.entityType] || 0) + 1;
            }
        }
        return {
            total: visible.length,
            byType,
            closest: visible[0] || null
        };
    }

    // ===== UPDATE =====

    /**
     * Update all active instances (call from game loop)
     */
    update(dt) {
        for (const instance of this._instances) {
            if (instance._destroyed) {
                this._instances.delete(instance);
                continue;
            }
            instance.update(dt);
        }
    }

    // ===== REGISTRIES =====

    get objects() { return this._objects; }
    get items() { return this._items; }
    get entities() { return this._entities; }
    get projectiles() { return this._projectiles; }
    get icons() { return this._icons; }

    getIcon(id) {
        return this._icons.get(id) || null;
    }

    // ===== INTERNAL =====

    _cloneObject(template) {
        const clone = new GameObject(template.name);

        // Clone each script with its config
        for (const script of template._scripts) {
            // Get the original script definition (prototype)
            const proto = Object.getPrototypeOf(script);

            // Build config from own properties only (data, not methods)
            const config = {};
            for (const key of Object.keys(script)) {
                if (key !== 'gameObject' && key !== 'transform') {
                    config[key] = script[key];
                }
            }

            // Attach - this will create a new instance from proto and merge config
            clone.AddComponent(proto, config);
        }

        // Recursively clone children
        for (const childTransform of template.transform._children) {
            const childClone = this._cloneObject(childTransform.gameObject);
            // Copy local transform
            childClone.transform.localPosition.copy(childTransform.localPosition);
            childClone.transform.localRotation.copy(childTransform.localRotation);
            childClone.transform.localScale.copy(childTransform.localScale);
            // Parent to clone
            childClone.transform.SetParent(clone.transform);
        }

        return clone;
    }

    async _registerWithItemManager(obj) {
        if (!this._game?.itemManager) return;

        const id = obj.id;
        const itemScript = obj.getScript('ItemScript');
        const meshScript = obj.getScript('MeshScript');

        // Import MeshBuilder dynamically to avoid require()
        const MeshBuilder = await import('./core/MeshBuilder.js');
        const buildMesh = MeshBuilder.buildMesh;

        // Create a simple item wrapper for the ItemManager
        const ItemWrapper = class {
            constructor() {
                this.id = id;
                this.name = obj.name;
                this.maxStack = itemScript?.maxStack || 1;
                this.isTool = itemScript?.category === 'tool' || !itemScript?.stackable;
                this._gameObject = obj;
            }

            getMesh() {
                if (meshScript?.parts && buildMesh) {
                    return buildMesh(meshScript.parts);
                }
                return null;
            }

            onUseDown(game, player) {
                return obj.onUse(player);
            }

            onPrimaryDown(game, player) {
                return obj.onUse(player);
            }
        };

        const instance = new ItemWrapper();
        this._game.itemManager.register(instance);
        console.log(`[VoxelWorld] Registered with ItemManager: ${id}`);
    }

    _registerWithAnimalRegistry(obj) {
        // Dynamically import to avoid circular deps
        import('../AnimalRegistry.js').then(module => {
            const id = obj.name;

            // Create a class that spawns this GameObject
            const EntityClass = class {
                constructor(game, position) {
                    const instance = VoxelWorld.spawn(obj.id, position.x, position.y, position.z);
                    return instance;
                }

                static get entityTypeName() {
                    return obj.name;
                }
            };

            module.AnimalClasses[id] = EntityClass;
            console.log(`[VoxelWorld] Registered with AnimalRegistry: ${id}`);
        }).catch(e => {
            console.warn('[VoxelWorld] Could not register with AnimalRegistry:', e);
        });
    }
}

const VoxelWorld = new VoxelWorldAPI();

// Expose GameObject class for direct instantiation in tests
VoxelWorld._GameObject = GameObject;

export { VoxelWorld, GameObject };
export default VoxelWorld;
