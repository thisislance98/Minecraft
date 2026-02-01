/**
 * VoxelWorld SDK - GameObject + Scripts API (Unity-style)
 */
import * as THREE from 'three';
import { GameObject, Time } from './core/GameObject.js';
import { ScriptTypes, getScript } from './scripts/index.js';

// Export Time globally
window.Time = Time;

class VoxelWorldAPI {
    constructor() {
        this._game = null;
        this._initialized = false;
        this._listeners = new Map();

        // Registries
        this._objects = new Map();      // All registered GameObjects
        this._items = new Map();        // Objects with ItemScript (for inventory)
        this._entities = new Map();     // Objects with EntityScript (spawnable)
        this._projectiles = new Map();  // Objects with ProjectileScript
        this._icons = new Map();        // Item icons

        // Active instances in world
        this._instances = new Set();
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
            const callbackScript = {};
            switch (event) {
                case 'use': callbackScript.onUse = (o, p) => callback(o, p); break;
                case 'hit': callbackScript.onHit = (o, d, a) => callback(o, d, a); break;
                case 'death': callbackScript.onDeath = (o) => callback(o); break;
                case 'update': callbackScript.update = (o, dt) => callback(o, dt); break;
                case 'start': callbackScript.start = (o) => callback(o); break;
                case 'destroy': callbackScript.onDestroy = (o) => callback(o); break;
                case 'collision': callbackScript.onCollision = (o, other) => callback(o, other); break;
            }
            obj.attach(callbackScript);
            return enhanced;
        };

        return enhanced;
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
     */
    register(obj) {
        const id = obj.id || obj.name.toLowerCase().replace(/\s+/g, '_');

        this._objects.set(id, obj);

        // Categorize by scripts
        if (obj.hasScript('ItemScript')) {
            this._items.set(id, obj);
            const itemScript = obj.getScript('ItemScript');
            if (itemScript.icon) {
                this._icons.set(id, itemScript.icon);
            }

            // Register with game's ItemManager
            this._registerWithItemManager(obj);
        }

        if (obj.hasScript('EntityScript')) {
            this._entities.set(id, obj);

            // Register with AnimalRegistry
            this._registerWithAnimalRegistry(obj);
        }

        if (obj.hasScript('ProjectileScript')) {
            this._projectiles.set(id, obj);
        }

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
            if (this._game?.player?.position && this._game?.camera) {
                // Get camera forward direction
                const dir = new THREE.Vector3();
                this._game.camera.getWorldDirection(dir);

                // Spawn 8 blocks in front of player, at eye level
                const distance = 8;
                spawnX = this._game.player.position.x + dir.x * distance;
                spawnY = this._game.player.position.y + 1.5;
                spawnZ = this._game.player.position.z + dir.z * distance;
            } else {
                spawnX = 0;
                spawnY = 50;
                spawnZ = 0;
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

        // Start the instance
        instance.start();

        // Sync transform so mesh is at correct position
        instance.syncTransform();

        // Add to scene
        if (instance.mesh && this._game?.scene) {
            this._game.scene.add(instance.mesh);
        }

        // Track instance
        this._instances.add(instance);

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

        return this._game.inventoryManager.addItem(id, count);
    }

    // ===== WORLD / BLOCKS =====

    getBlock(x, y, z) {
        return this._game?.world?.getBlock(x, y, z) || null;
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
        if (type === null || type === 'air' || type === 0) {
            // Remove block
            this._game.setBlock(x, y, z, 0);
            this.emit('block:removed', { x, y, z });
        } else {
            this._game.setBlock(x, y, z, type);
            this.emit('block:placed', { x, y, z, type });
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
        if (!this._game?.worldGenerator?.structureGenerator) {
            return { success: false, error: 'Structure generator not available' };
        }

        const gen = this._game.worldGenerator.structureGenerator;
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

    get localPlayer() {
        return this._game?.player || null;
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

    // ===== UPDATE =====

    /**
     * Update all active instances (call from game loop)
     */
    update(dt) {
        if (this._instances.size > 0 && !this._loggedUpdate) {
            console.log('[VoxelWorld.update] Called with', this._instances.size, 'instances, dt:', dt?.toFixed(4));
            this._loggedUpdate = true;
        }
        for (const instance of this._instances) {
            if (instance._destroyed) {
                this._instances.delete(instance);
                continue;
            }
            if (!this._loggedInstanceUpdate) {
                console.log('[VoxelWorld.update] Calling instance.update on:', instance.name);
                this._loggedInstanceUpdate = true;
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
export { VoxelWorld, GameObject };
export default VoxelWorld;
