import * as THREE from 'three';
import { Player } from './entities/Player.js';
import { Agent } from './entities/Agent.js';
import { InputManager } from './systems/InputManager.js';
import { UIManager } from './systems/UIManager.js';
import { SpawnManager } from './systems/SpawnManager.js';
import { InventoryManager } from './systems/InventoryManager.js';
import { ItemManager } from './systems/ItemManager.js';
import { SocketManager } from './systems/SocketManager.js';
import { VerificationUtils } from './utils/VerificationUtils.js';
import { setItemManager } from './core/DynamicItemRegistry.js';

/**
 * Minimal VoxelGame for fast Merlin AI testing
 * - Simple flat platform world
 * - Player with movement
 * - Merlin AI system integrated
 * - Built-in testing APIs (no screenshots needed)
 * - Tracks all creations for verification
 * - Loads in < 2 seconds
 */
export class MinimalVoxelGame {
    constructor() {
        console.log('[MinimalGame] Initializing test harness...');

        // Expose globally for CLI testing
        window.__VOXEL_GAME__ = this;
        window.THREE = THREE;
        window.VerificationUtils = VerificationUtils;

        // ===== TESTING STATE =====
        this.testState = {
            // Track all creatures created via Merlin
            creaturesCreated: [],

            // Track all items created via Merlin
            itemsCreated: [],

            // Track all blocks placed via Merlin
            blocksPlaced: [],

            // Track all Merlin tasks
            tasksCompleted: [],
            tasksFailed: [],

            // Event listeners for testing
            listeners: {
                onCreatureSpawned: [],
                onItemCreated: [],
                onBlockPlaced: [],
                onTaskComplete: [],
                onTaskFailed: []
            }
        };

        // Core Three.js setup
        this.container = document.getElementById('game-container');
        this.clock = new THREE.Clock();
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB); // Sky blue
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // FPS counter
        this.fpsElement = document.getElementById('fps');
        this.posElement = document.getElementById('position');
        this.entitiesElement = document.getElementById('entities');
        this.lastFrameTime = performance.now();
        this.frameCount = 0;

        // Create simple world
        this.createWorld();

        // Initialize managers
        this.initializeManagers();

        // Create player
        this.createPlayer();

        // Start render loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());

        console.log('[MinimalGame] ✅ Initialization complete');
    }

    // ===== TESTING API =====

    /**
     * Get all creatures created since last reset
     */
    getCreatedCreatures() {
        return this.testState.creaturesCreated;
    }

    /**
     * Get all items created since last reset
     */
    getCreatedItems() {
        return this.testState.itemsCreated;
    }

    /**
     * Get all blocks placed since last reset
     */
    getPlacedBlocks() {
        return this.testState.blocksPlaced;
    }

    /**
     * Get completed tasks
     */
    getCompletedTasks() {
        return this.testState.tasksCompleted;
    }

    /**
     * Get failed tasks
     */
    getFailedTasks() {
        return this.testState.tasksFailed;
    }

    /**
     * Reset test state (call before each test)
     */
    resetTestState() {
        this.testState.creaturesCreated = [];
        this.testState.itemsCreated = [];
        this.testState.blocksPlaced = [];
        this.testState.tasksCompleted = [];
        this.testState.tasksFailed = [];
        console.log('[TestAPI] Test state reset');
    }

    /**
     * Wait for a creature to be spawned
     * @returns {Promise<Object>} Creature info
     */
    waitForCreatureSpawn(timeout = 15000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Timeout waiting for creature spawn'));
            }, timeout);

            const listener = (creatureInfo) => {
                clearTimeout(timer);
                resolve(creatureInfo);
            };

            this.testState.listeners.onCreatureSpawned.push(listener);
        });
    }

    /**
     * Wait for an item to be created
     * @returns {Promise<Object>} Item info
     */
    waitForItemCreation(timeout = 15000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Timeout waiting for item creation'));
            }, timeout);

            const listener = (itemInfo) => {
                clearTimeout(timer);
                resolve(itemInfo);
            };

            this.testState.listeners.onItemCreated.push(listener);
        });
    }

    /**
     * Wait for blocks to be placed
     * @returns {Promise<Array>} Block positions
     */
    waitForBlockPlacement(minBlocks = 1, timeout = 15000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Timeout waiting for ${minBlocks} blocks to be placed`));
            }, timeout);

            const checkBlocks = () => {
                if (this.testState.blocksPlaced.length >= minBlocks) {
                    clearTimeout(timer);
                    resolve(this.testState.blocksPlaced);
                }
            };

            const listener = () => {
                checkBlocks();
            };

            this.testState.listeners.onBlockPlaced.push(listener);
            checkBlocks(); // Check immediately in case already placed
        });
    }

    /**
     * Wait for a task to complete
     * @returns {Promise<Object>} Task info
     */
    waitForTaskCompletion(timeout = 15000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Timeout waiting for task completion'));
            }, timeout);

            const listener = (taskInfo) => {
                clearTimeout(timer);
                resolve(taskInfo);
            };

            this.testState.listeners.onTaskComplete.push(listener);
        });
    }

    /**
     * Trigger event for testing
     */
    _triggerTestEvent(eventName, data) {
        const listeners = this.testState.listeners[eventName] || [];
        listeners.forEach(listener => listener(data));
        // Clear listeners after triggering (one-time use)
        this.testState.listeners[eventName] = [];
    }

    /**
     * Get entity by name (for verification)
     */
    findEntityByName(name) {
        return this.entities.find(e => e.constructor.name === name || e.name === name);
    }

    /**
     * Get all entities of a specific type
     */
    findEntitiesByType(typeName) {
        return this.entities.filter(e => e.constructor.name === typeName);
    }

    /**
     * Check if item exists in player inventory
     */
    hasItemInInventory(itemName) {
        if (!this.player?.inventory?.items) return false;
        return this.player.inventory.items.some(item =>
            item && (item.name === itemName || item.type === itemName)
        );
    }

    /**
     * Get detailed test report
     */
    getTestReport() {
        return {
            creatures: {
                total: this.testState.creaturesCreated.length,
                list: this.testState.creaturesCreated.map(c => ({
                    name: c.name,
                    position: c.position
                }))
            },
            items: {
                total: this.testState.itemsCreated.length,
                list: this.testState.itemsCreated
            },
            blocks: {
                total: this.testState.blocksPlaced.length,
                positions: this.testState.blocksPlaced.map(b => `(${b.x}, ${b.y}, ${b.z})`)
            },
            tasks: {
                completed: this.testState.tasksCompleted.length,
                failed: this.testState.tasksFailed.length,
                completedList: this.testState.tasksCompleted,
                failedList: this.testState.tasksFailed
            },
            entities: {
                total: this.entities.length - 1, // Exclude player
                list: this.entities.filter(e => e !== this.player).map(e => ({
                    type: e.constructor.name,
                    position: e.position ? {
                        x: e.position.x.toFixed(2),
                        y: e.position.y.toFixed(2),
                        z: e.position.z.toFixed(2)
                    } : null
                }))
            }
        };
    }

    // ===== WORLD CREATION =====

    createWorld() {
        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        directionalLight.shadow.camera.far = 200;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // Create a simple flat platform (30x30 blocks for more space)
        const platformSize = 30;
        const blockSize = 1;
        const platformGeometry = new THREE.BoxGeometry(
            platformSize * blockSize,
            blockSize,
            platformSize * blockSize
        );
        const platformMaterial = new THREE.MeshStandardMaterial({
            color: 0x4CAF50, // Green grass
            roughness: 0.8,
            metalness: 0.2
        });
        this.platform = new THREE.Mesh(platformGeometry, platformMaterial);
        this.platform.position.set(0, -0.5, 0);
        this.platform.receiveShadow = true;
        this.platform.castShadow = true;
        this.scene.add(this.platform);

        // Add a grid helper for reference
        const gridHelper = new THREE.GridHelper(platformSize, platformSize, 0x888888, 0x444444);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);

        // Add axes helper for orientation
        const axesHelper = new THREE.AxesHelper(5);
        this.scene.add(axesHelper);

        console.log('[MinimalGame] Created simple platform world');
    }

    initializeManagers() {
        // Initialize essential managers for Merlin AI
        this.socketManager = new SocketManager(this);

        // Use a minimal EntityManager that does nothing (no birds, butterflies, etc.)
        this.entityManager = {
            update: () => {} // Stub - test harness doesn't need ambient entities
        };

        this.spawnManager = new SpawnManager(this);
        this.inventoryManager = new InventoryManager(this);
        this.itemManager = new ItemManager(this);
        this.uiManager = new UIManager(this);
        this.inputManager = new InputManager(this);

        // Set global item manager for dynamic items
        setItemManager(this.itemManager);

        // Mock methods that full game has
        this.blocks = {
            get: (id) => ({ name: 'test_block', id })
        };
        this.chunks = new Map();
        this.entities = [];

        // Mock gameState for InputManager
        this.gameState = {
            flags: {
                inventoryOpen: false,
                mobileControls: false
            }
        };

        console.log('[MinimalGame] Managers initialized');
    }

    createPlayer() {
        // Create player at spawn position
        this.player = new Player(this, 0, 3, 0);
        this.entities.push(this.player);

        // Position camera
        this.camera.position.set(0, 4.6, 0);

        // Create agent for AI tool handling
        this.agent = new Agent(this);

        console.log('[MinimalGame] Player and Agent created at spawn');
    }

    // ===== GAME API (with testing hooks) =====

    getBlock(x, y, z) {
        // Simple collision: floor at y=0
        if (y < 0) return { id: 1 }; // Solid block
        if (y === 0 && Math.abs(x) <= 15 && Math.abs(z) <= 15) {
            return { id: 1 }; // Platform
        }
        return null; // Air
    }

    setBlock(x, y, z, blockId) {
        // For structure building - create visual blocks
        if (blockId === 0) return; // Air, do nothing

        const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
        const blockMaterial = new THREE.MeshStandardMaterial({
            color: this.getBlockColor(blockId),
            roughness: 0.7
        });
        const block = new THREE.Mesh(blockGeometry, blockMaterial);
        block.position.set(x, y, z);
        block.castShadow = true;
        block.receiveShadow = true;
        this.scene.add(block);

        // TESTING: Track block placement
        const blockInfo = { x, y, z, blockId, timestamp: Date.now() };
        this.testState.blocksPlaced.push(blockInfo);
        this._triggerTestEvent('onBlockPlaced', blockInfo);

        console.log(`[MinimalGame] Block placed at (${x}, ${y}, ${z}) - Total: ${this.testState.blocksPlaced.length}`);
    }

    getBlockColor(blockId) {
        const colors = [
            0x808080, // 0: Stone
            0x8B4513, // 1: Dirt
            0x4CAF50, // 2: Grass
            0xD2691E, // 3: Wood
            0xFFFFFF, // 4: White
            0xFF0000, // 5: Red
            0x0000FF, // 6: Blue
            0xFFFF00, // 7: Yellow
        ];
        return colors[blockId % colors.length];
    }

    getPlayerPosition() {
        return this.player.position.clone();
    }

    getPlayerDirection() {
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        return direction;
    }

    addEntity(entity) {
        this.entities.push(entity);
        if (entity.mesh) {
            this.scene.add(entity.mesh);

            // TESTING: Track creature creation
            const creatureInfo = {
                name: entity.constructor.name,
                position: entity.position ? {
                    x: entity.position.x,
                    y: entity.position.y,
                    z: entity.position.z
                } : null,
                timestamp: Date.now(),
                entity: entity
            };
            this.testState.creaturesCreated.push(creatureInfo);
            this._triggerTestEvent('onCreatureSpawned', creatureInfo);

            console.log('[MinimalGame] Entity added to scene:', entity.constructor.name,
                       'at', creatureInfo.position);
        }
    }

    removeEntity(entity) {
        const index = this.entities.indexOf(entity);
        if (index > -1) {
            this.entities.splice(index, 1);
        }
        if (entity.mesh) {
            this.scene.remove(entity.mesh);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        // Update all entities
        for (const entity of this.entities) {
            if (entity.update) {
                entity.update(delta, time);
            }
        }

        // Update managers
        if (this.entityManager) this.entityManager.update(delta, this.player);

        // Render
        this.renderer.render(this.scene, this.camera);

        // Update FPS counter
        this.updateInfo();
    }

    updateInfo() {
        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFrameTime >= 1000) {
            const fps = Math.round((this.frameCount * 1000) / (now - this.lastFrameTime));
            this.fpsElement.textContent = fps;
            this.frameCount = 0;
            this.lastFrameTime = now;

            // Update position
            const pos = this.player.position;
            this.posElement.textContent = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;

            // Update entity count (exclude player)
            this.entitiesElement.textContent = this.entities.length - 1;
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Stub methods for compatibility
    getChunk(x, z) { return null; }
    getChunkAtBlock(x, z) { return null; }
    saveWorld() { console.log('[MinimalGame] Save world (stub)'); }
    updateChunks() { /* No chunks in test harness */ }
    loadWorldFromServer() { /* No world loading in test harness */ }
}
