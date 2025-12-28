import * as THREE from 'three';
import { Chunk } from '../world/Chunk.js';
import { Player } from './entities/Player.js';
import { Agent } from './entities/Agent.js';
import { Drop } from './entities/Drop.js';
import { Inventory } from './ui/Inventory.js';
import { InventoryManager } from './systems/InventoryManager.js';
import { ItemManager } from './systems/ItemManager.js';
import { SpawnManager } from './systems/SpawnManager.js';
import { UIManager } from './systems/UIManager.js';
import { Arrow } from './entities/projectiles/Arrow.js';
import { MagicProjectile } from './entities/projectiles/MagicProjectile.js';
import { ShrinkProjectile } from './entities/projectiles/ShrinkProjectile.js';
import { LevitationProjectile } from './entities/projectiles/LevitationProjectile.js';
import { GiantProjectile } from './entities/projectiles/GiantProjectile.js';
import { WizardTowerProjectile } from './entities/projectiles/WizardTowerProjectile.js';

import { GrowthProjectile } from './entities/projectiles/GrowthProjectile.js';
import { FloatingBlock } from './entities/FloatingBlock.js';
import { EntityManager } from './systems/EntityManager.js';
import { InputManager } from './systems/InputManager.js';
import { PhysicsManager } from './systems/PhysicsManager.js';
import { GameState } from './core/GameState.js';
import { WorldGenerator } from '../world/WorldGenerator.js';
import { AssetManager } from './core/AssetManager.js';
import { Environment } from './systems/Environment.js';

import { WeatherSystem } from './systems/WeatherSystem.js';
import { Dragon } from './entities/animals/Dragon.js';

import { WorldParticleSystem } from './systems/WorldParticleSystem.js';
import { SoundManager } from './systems/SoundManager.js';
import { StructureGenerator } from '../world/StructureGenerator.js';
import { Config } from './core/Config.js';
import { Blocks } from './core/Blocks.js';
import { OmniProjectile } from './entities/projectiles/OmniProjectile.js';
import { SpellSystem } from './systems/SpellSystem.js';
import { Tornado } from './entities/Tornado.js';
import { WaterSystem } from './systems/WaterSystem.js';
import { StoreUI } from './ui/StoreUI.js';
import { SocketManager } from './systems/SocketManager.js';


export class VoxelGame {
    constructor() {
        // Expose game globally for HMR to update existing creatures
        window.__VOXEL_GAME__ = this;

        this.container = document.getElementById('game-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x4682B4); // Steel blue
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Essential for children of camera to be visible
        this.scene.add(this.camera);

        // Voice Chat: Audio Listener for spatial audio
        this.audioListener = new THREE.AudioListener();
        this.camera.add(this.audioListener);

        // Check for bare-bones mode via URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        this.isBareBones = urlParams.get('bare-bones') === 'true';
        this.isOffline = urlParams.get('offline') === 'true';

        if (this.isBareBones) {
            console.log('[Game] Bare Bones Mode: Minimal renderer only.');

            // Minimal scene content
            const geometry = new THREE.BoxGeometry();
            const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            this.cube = new THREE.Mesh(geometry, material);
            this.scene.add(this.cube);
            this.camera.position.z = 5;

            // Start minimal loop
            this.animateBareBones();
            return; // STOP initialization here
        }

        // World data - chunk based
        this.chunks = new Map();
        this.chunkSize = Config.WORLD.CHUNK_SIZE;
        this.renderDistance = Config.WORLD.RENDER_DISTANCE;
        this.terrainVisible = true; // Default visibility
        this.generatedChunks = new Set();
        this.chunkGenQueue = []; // Queue for chunks to be generated

        // For raycasting - we need to track individual block positions

        // Frustum for culling
        this.frustum = new THREE.Frustum();
        this.frustumMatrix = new THREE.Matrix4();

        // Textures - use TextureLoader module
        // Textures - use AssetManager
        this.assetManager = new AssetManager(this);
        this.assetManager.loadResources();

        // Expose for compatibility
        this.textures = this.assetManager.textures;
        this.materials = this.assetManager.materialArray;
        this.materialArray = this.assetManager.materialArray;
        this.blockMaterialIndices = this.assetManager.blockMaterialIndices;

        // Physics
        // Physics
        this.gravity = Config.WORLD.GRAVITY;

        // Game State (Centralized)
        this.gameState = new GameState(this);

        // Debug Flags (Initialize BEFORE UIManager) - Now in GameState

        // Sub-modules
        this.uiManager = new UIManager(this);
        this.inventoryManager = new InventoryManager(this);
        this.itemManager = new ItemManager(this);
        this.inventory = new Inventory(this, this.inventoryManager); // Inventory is now UI
        this.player = new Player(this);
        this.agent = new Agent(this);
        this.inputManager = new InputManager(this); // Replaces controls
        // this.controls = new Controls(this); // specific controls logic moved to inputManager
        // But other files might access game.controls?
        // Let's alias it for now or check usage.
        this.controls = this.inputManager;
        // Initialize world seed - use a fixed hardcoded seed so everyone sees the same world
        this.worldSeed = 1337; // Fixed seed for consistency
        console.log('[Game] using hardcoded world seed:', this.worldSeed);

        this.worldGen = new WorldGenerator(this);
        // Set the seed immediately after creation for consistent world generation
        this.worldGen.setSeed(this.worldSeed);
        this.entityManager = new EntityManager(this);
        this.weatherSystem = new WeatherSystem(this);
        this.environment = new Environment(this.scene, this);

        this.animals = [];
        this.spawnManager = new SpawnManager(this);
        this.worldParticleSystem = new WorldParticleSystem(this);
        this.soundManager = new SoundManager(this);
        this.soundManager.init();
        this.spellSystem = new SpellSystem(this);
        this.waterSystem = new WaterSystem(this);

        // Multiplayer Delta Sync tracking
        this._lastSentPos = new THREE.Vector3();
        this._lastSentRotY = 0;
        this._isCurrentlyMoving = false;

        this.spawnPlayer();

        this.camera.position.copy(this.player.position);
        this.camera.position.y += Config.PLAYER.EYE_HEIGHT; // Eye height

        // State - Migrated to GameState
        // this.selectedBlock = 'grass';
        // this.selectedSlot = 0;
        // this.inventoryOpen = false;

        // Aliases / Getters could be useful, or direct access.
        // For now, I will use direct access in methods.

        // Physics Manager
        this.physicsManager = new PhysicsManager(this);

        // Highlight box - Managed by PhysicsManager, but we need to ensure it's in scene?
        // PhysicsManager constructor adds it to game.scene if we passed game.
        // Yes: this.game.scene.add(this.highlightBox); in PhysicsManager.





        // Check for offline mode via URL parameter - urlParams already declared at top of constructor
        if (this.isOffline || this.isUIOnly) {
            console.log('[Game] Offline Mode: Network disabled.');
        } else {
            console.log('[Game] Singleplayer Mode.');
        }

        // Multiplayer logic
        this.socketManager = new SocketManager(this);

        // Agent debug command handler
        if (this.agent.setupDebugCommandHandler) {
            this.agent.setupDebugCommandHandler();
        }

        // Add daytime switch hotkey (K)
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'k' && !this.gameState.flags.inventoryOpen && !(this.agent && this.agent.isChatOpen)) {
                this.setDaytime();
            }
            if (e.key.toLowerCase() === 'b' && !this.gameState.flags.inventoryOpen && !(this.agent && this.agent.isChatOpen)) {
                this.storeUI.toggle();
            }
        });

        // Initial chunk check - SKIP in UI-only mode
        if (!this.isUIOnly) {
            this.checkChunks();
            this.updateChunks();
            this.updateBlockCount();
        } else {
            console.log('[Game] UI-Only Mode: Skipping world generation.');
        }
        this.updateBlockCount();

        // Animals and Dragon spawning is deferred until initial world chunks are generated
        // (handled in processChunkQueue via _initialSpawnDone flag)
        this._initialSpawnDone = false;
        this.dragon = null;

        // Projectiles
        this.projectiles = [];

        // Drops
        this.drops = [];

        // Shrunk Blocks
        this.shrunkBlocks = [];

        // Floating Blocks
        this.floatingBlocks = [];
        this.targetedFloatingBlocks = [];


        // Tornadoes
        this.tornadoes = [];

        // Start game loop
        this.lastTime = performance.now();
        this.processChunkQueue();
        this.animate();

        // Add the new wand to the inventory for testing
        this.inventory.addItem('growth_wand', 1, 'tool');
        this.inventory.addItem('wizard_tower_wand', 1, 'tool');


        this.inventory.addItem(Blocks.DOOR_CLOSED, 64, 'block');

        // Poll for AI spawn requests every 2 seconds
        this.startSpawnQueuePolling();

        // Poll for chat test prompts (for curl-based testing)
        this.startChatTestPolling();

        // Poll for eval requests (for game state inspection)
        this.startEvalPolling();

        // Chat Button Listener & Debug Panel handled by UIManager/InputManager now

        // Initialize Store UI
        this.storeUI = new StoreUI(this);

        // Initialize persisted blocks storage
        this.persistedBlocks = new Map(); // key: chunkKey, value: Array<{lx, ly, lz, type}>

        // Sign Data (text)
        this.signData = new Map(); // key: "x,y,z", value: text
        this.signMeshes = new Map(); // key: "x,y,z", value: THREE.Mesh (text mesh)
    }

    // Helper for Debug Toggle (called by InputManager)
    toggleDebugPanel() {
        if (this.gameState.flags.inventoryOpen || (this.agent && this.agent.isChatOpen)) return;

        const isOpen = this.uiManager.toggleDebugPanel();
        if (isOpen) {
            this.inputManager.unlock();
        } else {
            this.inputManager.lock();
        }
    }

    setDaytime() {
        if (this.socketManager && this.socketManager.isConnected()) {
            this.socketManager.sendSetTime(0.25); // Noon
            this.uiManager?.addChatMessage('system', 'Requesting daytime sync...');
            return;
        }

        if (this.environment) {
            // Set time to noon
            this.environment.time = 0.25;
            // Force immediate update of lights and skybox
            this.environment.updateDayNightCycle(0, this.player.position);
            if (this.uiManager) {
                this.uiManager.addChatMessage('system', 'Time set to daytime');
            }
            console.log('[Game] Time set to daytime');
        }
    }

    /**
     * Poll for AI-requested creature spawns
     */
    startSpawnQueuePolling() {
        setInterval(async () => {
            try {
                const res = await fetch('/api/god-mode/spawns');
                const data = await res.json();

                if (data.spawns && data.spawns.length > 0) {
                    for (const spawn of data.spawns) {
                        console.log('[Game] Processing spawn request:', spawn);

                        // Import AnimalClasses dynamically to get the creature
                        const { AnimalClasses } = await import('./AnimalRegistry.js');

                        // Try to find the creature class
                        let CreatureClass = AnimalClasses[spawn.creature];

                        // Case-insensitive fallback
                        if (!CreatureClass) {
                            const normalized = spawn.creature.charAt(0).toUpperCase() + spawn.creature.slice(1).toLowerCase();
                            CreatureClass = AnimalClasses[normalized];
                        }

                        if (CreatureClass) {
                            this.spawnManager.spawnEntitiesInFrontOfPlayer(CreatureClass, spawn.count || 1);
                            this.uiManager?.addChatMessage('system', `Spawned ${spawn.count || 1}x ${spawn.creature}!`);
                            console.log(`[Game] Spawned ${spawn.count || 1}x ${spawn.creature}`);
                        } else {
                            console.warn(`[Game] Unknown creature: ${spawn.creature}`);
                            this.uiManager?.addChatMessage('system', `Unknown creature: ${spawn.creature}`);
                        }
                    }
                }
            } catch (e) {
                // Silently ignore polling errors (server might not be ready)
            }
        }, 2000); // Poll every 2 seconds
    }

    /**
     * Poll for chat test prompts (curl-based testing of in-game AI)
     */
    startChatTestPolling() {
        setInterval(async () => {
            try {
                const res = await fetch('/api/chat-test/poll');
                const data = await res.json();

                if (data.prompt && this.agent) {
                    const { testId, message } = data.prompt;
                    console.log(`[ChatTest] Processing prompt (${testId}): ${message}`);

                    try {
                        // Send the message through the agent's text chat
                        await this.agent.sendTextMessage(message);

                        // Report success - get the last AI message from chat
                        const lastAiMessage = this.uiManager?.getLastAiMessage?.() || 'Message processed';

                        await fetch('/api/chat-test/response', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                testId,
                                aiResponse: lastAiMessage,
                                toolsCalled: []
                            })
                        });
                    } catch (e) {
                        // Report error
                        await fetch('/api/chat-test/response', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                testId,
                                error: e.message
                            })
                        });
                    }
                }
            } catch (e) {
                // Silently ignore polling errors
            }
        }, 1000); // Poll every 1 second for responsiveness
    }



    /**
     * Poll for game state inspection code (eval)
     * CAUTION: Only for development use!
     */
    startEvalPolling() {
        setInterval(async () => {
            try {
                const res = await fetch('/api/test/eval/poll');
                const data = await res.json();

                if (data.item) {
                    const { evalId, code } = data.item;
                    console.log(`[Eval] Inspecting: ${code}`);

                    try {
                        // Execute the inspection code
                        // We provide 'game' and 'window' context
                        // The code should return a JSON-serializable value
                        const game = this;
                        const result = await (new Function('game', 'window', `return (async () => { ${code} })()`))(game, window);

                        await fetch('/api/test/eval/result', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                evalId,
                                result: result
                            })
                        });
                    } catch (e) {
                        await fetch('/api/test/eval/result', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                evalId,
                                error: e.message
                            })
                        });
                    }
                }
            } catch (e) {
                // Silently ignore
            }
        }, 1000);
    }


    spawnPlayer() {
        const spawnPoint = Config.PLAYER.SPAWN_POINT;

        // Calculate ground height at spawn location
        const spawnY = this.worldGen.getTerrainHeight(spawnPoint.x, spawnPoint.z) + 2;

        console.log(`[Game] Spawning player at global spawn point: ${spawnPoint.x}, ${spawnY}, ${spawnPoint.z}`);

        this.spawnPoint = new THREE.Vector3(spawnPoint.x, spawnY, spawnPoint.z);
        this.player.position.copy(this.spawnPoint);
        this.player.velocity.set(0, 0, 0);

        // Reset fall damage trackers
        this.player.highestY = spawnY;
        this.player.isDead = false;
        if (this.uiManager) {
            this.uiManager.hideDeathScreen();
        }

        // Also update camera immediately so we don't flash at the wrong spot
        this.camera.position.copy(this.player.position);
        this.camera.position.y += 1.6;
    }



    spawnAnimals() {
        // Delegate to SpawnManager
        const chunkSize = this.chunkSize;
        const playerX = Math.floor(this.player.position.x);
        const playerZ = Math.floor(this.player.position.z);
        const centerCX = Math.floor(playerX / chunkSize);
        const centerCZ = Math.floor(playerZ / chunkSize);

        this.spawnManager.spawnAnimalsInArea(centerCX, centerCZ, 6);
    }

    spawnDragon() {
        const x = this.player.position.x + (Math.random() - 0.5) * 40;
        const z = this.player.position.z + (Math.random() - 0.5) * 40;
        const y = this.player.position.y + 35; // High in the sky

        const seed = Math.random() * 0xFFFFFF; // Or derive from worldSeed
        this.dragon = new Dragon(this, x, y, z, seed);
        this.scene.add(this.dragon.mesh);
    }

    createHighlightBox() {
        const geometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
        const edges = new THREE.EdgesGeometry(geometry);
        const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        const box = new THREE.LineSegments(edges, material);
        box.visible = false;
        return box;
    }

    selectSlot(index) {
        this.gameState.selection.slot = index;
        this.inventory.selectSlot(index);

        const slot = this.inventory.getSelectedItem();
        if (slot && slot.type === 'block') {
            this.gameState.selection.block = slot.item;
        } else {
            this.gameState.selection.block = null;
        }

        // UI is handled by Inventory class now

        // Update visual model
        this.player.updateHeldItemVisibility();
    }

    cycleSlot(direction) {
        let newSlot = this.gameState.selection.slot + direction;
        if (newSlot > 8) newSlot = 0;
        if (newSlot < 0) newSlot = 8;
        this.selectSlot(newSlot);
    }

    toggleInventory() {
        // If crafting table is open, close it and inventory
        if (this.gameState.flags.inventoryOpen && this.inventory.isCraftingTableOpen) {
            this.gameState.flags.inventoryOpen = false;
            this.inventory.closeInventory();
            return;
        }

        this.gameState.flags.inventoryOpen = !this.gameState.flags.inventoryOpen;
        if (this.gameState.flags.inventoryOpen) {
            this.inventory.openInventory();
        } else {
            this.inventory.closeInventory();
        }
    }

    toggleCraftingTable() {
        if (!this.gameState.flags.inventoryOpen) {
            this.gameState.flags.inventoryOpen = true;
            this.inventory.openCraftingTable();
        } else {
            // Already open? Switch or Close?
            // If normal inventory open, switch to crafting?
            // If crafting open, close?
            // Standard: Interact always opens.
            this.inventory.openCraftingTable();
        }
    }

    useItem() {
        const item = this.inventory.getSelectedItem();
        if (item && item.type === 'food') {
            return this.inventory.useSelectedItem();
        }
        return false;
    }

    onRightClickDown() {
        // 1. Check for Block Interaction (Doors, etc.)
        const target = this.physicsManager.getTargetBlock();
        if (target) {
            const block = this.getBlockWorld(target.x, target.y, target.z);
            if (block === Blocks.DOOR_CLOSED) {
                this.setBlock(target.x, target.y, target.z, Blocks.DOOR_OPEN);
                this.soundManager.playSound('click'); // consistent feedback
                return true; // Handled
            } else if (block === Blocks.DOOR_OPEN) {
                // Check if player is inside the door before closing interaction?
                // For now, just close it. Collision will handle pushing out or getting stuck.
                this.setBlock(target.x, target.y, target.z, Blocks.DOOR_CLOSED);
                this.soundManager.playSound('click');
                return true; // Handled
            } else if (block === Blocks.SIGN) {
                this.soundManager.playSound('click');
                const key = this.getBlockKey(target.x, target.y, target.z);
                const currentText = this.signData.get(key) || '';

                if (this.uiManager) {
                    this.uiManager.showSignInput((text) => {
                        if (text !== null) {
                            this.setSignText(target.x, target.y, target.z, text);
                        }
                    }, currentText);
                }
                return true;
            }
        }

        // 2. Item Usage
        const item = this.inventory.getSelectedItem();
        if (item && item.item) {
            // Retrieve item ID
            const itemId = item.item;
            const handled = this.itemManager.handleItemDown(itemId);
            if (handled) return true;
        }
        return false;
    }

    onRightClickUp() {
        const item = this.inventory.getSelectedItem();
        if (item && item.item) {
            const handled = this.itemManager.handleItemUp(item.item);
            if (handled) return true;
        }
        return false;
    }

    spawnArrow(pos, vel) {
        const arrow = new Arrow(this, pos, vel);
        this.projectiles.push(arrow);
        this.scene.add(arrow.mesh);
        console.log('Arrow fired!');
    }

    spawnMagicProjectile(pos, vel) {
        const projectile = new MagicProjectile(this, pos, vel);
        this.projectiles.push(projectile);
        this.scene.add(projectile.mesh);
        console.log('Magic Fired!');
    }

    spawnShrinkProjectile(pos, vel) {
        const projectile = new ShrinkProjectile(this, pos, vel);
        this.projectiles.push(projectile);
        this.scene.add(projectile.mesh);
        console.log('Shrink Magic Fired!');
    }

    spawnLevitationProjectile(pos, vel) {
        const projectile = new LevitationProjectile(this, pos, vel);
        this.projectiles.push(projectile);
        this.scene.add(projectile.mesh);
        console.log('Levitation Magic Fired!');
    }

    spawnGiantProjectile(pos, vel) {
        const projectile = new GiantProjectile(this, pos, vel);
        this.projectiles.push(projectile);
        this.scene.add(projectile.mesh);
        console.log('Giant Magic Fired!');
    }

    spawnWizardTowerProjectile(pos, vel) {
        const projectile = new WizardTowerProjectile(this, pos, vel);
        this.projectiles.push(projectile);
        this.scene.add(projectile.mesh);
        console.log('Wizard Tower Projectile Fired!');
    }


    spawnGrowthProjectile(pos, vel) {
        const projectile = new GrowthProjectile(this, pos, vel);
        this.projectiles.push(projectile);
        this.scene.add(projectile.mesh);
        console.log('Growth Magic Fired!');
    }

    spawnOmniProjectile(pos, vel, effects) {
        const projectile = new OmniProjectile(this, pos, vel, effects);
        this.projectiles.push(projectile);
        this.scene.add(projectile.mesh);
        console.log('Omni Magic Fired!');
    }

    spawnTornado(pos) {
        const tornado = new Tornado(this, pos);
        this.tornadoes.push(tornado);
        console.log('Tornado spawned!');
    }

    spawnDrop(x, y, z, blockType) {
        if (!blockType || blockType === Blocks.AIR || blockType === Blocks.WATER) return;

        // Leaf logic: Chance to drop
        if (blockType.includes(Blocks.LEAVES)) {
            if (Math.random() > 0.2) return;
        }

        // Center the drop in the block
        const drop = new Drop(this, x + 0.5, y + 0.5, z + 0.5, blockType);
        this.drops.push(drop);
        this.scene.add(drop.mesh);
    }

    getBlockKey(x, y, z) {
        return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    }

    getChunkKey(cx, cy, cz) {
        return `${cx},${cy},${cz}`;
    }

    worldToChunk(x, y, z) {
        return {
            cx: Math.floor(x / this.chunkSize),
            cy: Math.floor(y / this.chunkSize),
            cz: Math.floor(z / this.chunkSize),
            lx: ((Math.floor(x) % this.chunkSize) + this.chunkSize) % this.chunkSize,
            ly: ((Math.floor(y) % this.chunkSize) + this.chunkSize) % this.chunkSize,
            lz: ((Math.floor(z) % this.chunkSize) + this.chunkSize) % this.chunkSize
        };
    }

    getOrCreateChunk(cx, cy, cz) {
        const key = this.getChunkKey(cx, cy, cz);
        if (!this.chunks.has(key)) {
            this.chunks.set(key, new Chunk(this, cx, cy, cz));
        }
        return this.chunks.get(key);
    }

    setBlock(x, y, z, type, skipMeshUpdate = false, skipBroadcast = false) {
        const { cx, cy, cz, lx, ly, lz } = this.worldToChunk(x, y, z);

        if (type === null) {
            const chunkKey = this.getChunkKey(cx, cy, cz);
            const chunk = this.chunks.get(chunkKey);
            if (chunk) {
                chunk.setBlock(lx, ly, lz, null);
                // Also mark neighboring chunks as dirty if on edge
                this.markNeighborsDirty(Math.floor(x), Math.floor(y), Math.floor(z));
            }
        } else {
            const chunk = this.getOrCreateChunk(cx, cy, cz);
            chunk.setBlock(lx, ly, lz, type);
            // Also mark neighboring chunks as dirty if on edge
            this.markNeighborsDirty(Math.floor(x), Math.floor(y), Math.floor(z));
        }

        if (!skipMeshUpdate) {
            this.updateChunks(); // Trigger mesh update for interactive changes
        }

        // Network sync: broadcast block change to other players and persist
        if (!skipBroadcast && this.socketManager?.isConnected()) {
            this.socketManager.sendBlockChange(x, y, z, type);
        }

        // Handle Sign Removal
        if (type === null) {
            this.removeSignText(x, y, z);
        }
    }

    // --- Sign Logic ---

    setSignText(x, y, z, text) {
        const key = this.getBlockKey(x, y, z);
        this.signData.set(key, text);
        this.updateSignMesh(x, y, z, text);

        // Network sync
        if (this.socketManager && this.socketManager.isConnected()) {
            this.socketManager.sendSignUpdate(x, y, z, text);
        }
    }

    // Called when receiving update from server
    receiveSignUpdate(x, y, z, text) {
        const key = this.getBlockKey(x, y, z);
        this.signData.set(key, text);
        this.updateSignMesh(x, y, z, text);
    }

    removeSignText(x, y, z) {
        const key = this.getBlockKey(x, y, z);
        this.signData.delete(key);

        if (this.signMeshes.has(key)) {
            const mesh = this.signMeshes.get(key);
            this.scene.remove(mesh);
            this.signMeshes.delete(key);
            // Dispose texture/material?
            if (mesh.material.map) mesh.material.map.dispose();
            if (mesh.material) mesh.material.dispose();
            if (mesh.geometry) mesh.geometry.dispose();
        }
    }

    updateSignMesh(x, y, z, text) {
        const key = this.getBlockKey(x, y, z);

        // Remove existing if any
        if (this.signMeshes.has(key)) {
            const mesh = this.signMeshes.get(key);
            this.scene.remove(mesh);
            this.signMeshes.delete(key);
            if (mesh.material.map) mesh.material.map.dispose();
            if (mesh.material) mesh.material.dispose();
            if (mesh.geometry) mesh.geometry.dispose();
        }

        if (!text) return;

        // Create canvas texture
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Background (wood-ish) or transparent? 
        // Signs usually have text on the wood texture. 
        // We will make a floating text plane slightly in front of the block.
        // Or we can draw a wood background.
        ctx.fillStyle = '#6F4E37'; // Dark wood
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = '24px Minecraft'; // Fallback to sans-serif if not loaded
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Wrap text
        const maxWidth = 240;
        const words = text.split(' ');
        let lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);

        // Draw lines
        const lineHeight = 30;
        const startY = (canvas.height - (lines.length * lineHeight)) / 2 + (lineHeight / 2);

        lines.forEach((line, i) => {
            ctx.fillText(line, canvas.width / 2, startY + (i * lineHeight));
        });

        const texture = new THREE.CanvasTexture(canvas);
        const geometry = new THREE.PlaneGeometry(0.8, 0.4);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false  // Prevent sign from occluding blocks behind it
        });

        const mesh = new THREE.Mesh(geometry, material);

        // Position slightly in front of the block
        // Problem: We need to know orientation. 
        // For simplified v1, we will just make it look at the player or stick to one side?
        // Let's stick it to the side facing the player when placed? 
        // Or simpler: billboards? No, signs are static.
        // For now, let's just place it on all 4 sides? No that's expensive.
        // Let's defaulted to Z+ face for now or try to deduce from placement?
        // Actually, SignItem knows placement. But here we just have x,y,z.
        // Let's put it on top of the block effectively standing up?
        // Or centered in the block if it's a "Sign Post" style.
        // Since we use a full block for SIGN, let's put it on the faces.

        // Actually, let's make it a Sprite for simplicity? No, Sprites rotate.
        // Let's just put it on the North and South faces for visibility.

        mesh.position.set(x + 0.5, y + 0.5, z + 0.55); // Front face (Z+)
        // mesh.rotation.y = ...

        this.scene.add(mesh);
        this.signMeshes.set(key, mesh);
    }

    addPersistedSigns(signs) {
        // signs: Array<{x, y, z, text}>
        if (!signs) return;
        for (const s of signs) {
            this.signData.set(this.getBlockKey(s.x, s.y, s.z), s.text);
            this.updateSignMesh(s.x, s.y, s.z, s.text);
        }
    }

    toggleDoor(x, y, z) {
        const block = this.getBlock(x, y, z);
        if (!block) return;

        let newType;
        if (block.type === Blocks.DOOR_CLOSED) newType = Blocks.DOOR_OPEN;
        else if (block.type === Blocks.DOOR_OPEN) newType = Blocks.DOOR_CLOSED;
        else return;

        // Toggle clicked block
        this.setBlock(x, y, z, newType);

        // Check Up
        const upBlock = this.getBlock(x, y + 1, z);
        if (upBlock && (upBlock.type === Blocks.DOOR_CLOSED || upBlock.type === Blocks.DOOR_OPEN)) {
            this.setBlock(x, y + 1, z, newType);
        }

        // Check Down
        const downBlock = this.getBlock(x, y - 1, z);
        if (downBlock && (downBlock.type === Blocks.DOOR_CLOSED || downBlock.type === Blocks.DOOR_OPEN)) {
            this.setBlock(x, y - 1, z, newType);
        }
    }

    markNeighborsDirty(x, y, z) {
        const { lx, ly, lz } = this.worldToChunk(x, y, z);
        // If on chunk edge, mark neighboring chunk dirty
        const offsets = [];
        if (lx === 0) offsets.push([-1, 0, 0]);
        if (lx === this.chunkSize - 1) offsets.push([1, 0, 0]);
        if (ly === 0) offsets.push([0, -1, 0]);
        if (ly === this.chunkSize - 1) offsets.push([0, 1, 0]);
        if (lz === 0) offsets.push([0, 0, -1]);
        if (lz === this.chunkSize - 1) offsets.push([0, 0, 1]);

        for (const [dx, dy, dz] of offsets) {
            const neighborKey = this.getChunkKey(
                Math.floor(x / this.chunkSize) + dx,
                Math.floor(y / this.chunkSize) + dy,
                Math.floor(z / this.chunkSize) + dz
            );
            const neighbor = this.chunks.get(neighborKey);
            if (neighbor) {
                neighbor.dirty = true;
            }
        }
    }

    // Get block type at world coordinates (for chunk neighbor checks)
    getBlockWorld(x, y, z) {
        const { cx, cy, cz, lx, ly, lz } = this.worldToChunk(x, y, z);
        const chunkKey = this.getChunkKey(cx, cy, cz);
        const chunk = this.chunks.get(chunkKey);
        if (!chunk) return null;
        return chunk.getBlock(lx, ly, lz);
    }

    getBlock(x, y, z) {
        const type = this.getBlockWorld(x, y, z); // Re-use logic
        return type ? { type } : null;
    }

    // Build dirty chunk meshes (throttled for performance)
    updateChunks() {
        const maxChunksPerFrame = 3; // Adjust this for performance vs. speed trade-off

        // Collect all dirty chunks with their distance from player
        const dirtyChunks = [];
        for (const chunk of this.chunks.values()) {
            if (chunk.dirty) {
                const dx = chunk.cx - Math.floor(this.player.position.x / this.chunkSize);
                const dz = chunk.cz - Math.floor(this.player.position.z / this.chunkSize);
                const distSq = dx * dx + dz * dz;
                dirtyChunks.push({ chunk, distSq });
            }
        }

        // Sort by distance (closest first)
        dirtyChunks.sort((a, b) => a.distSq - b.distSq);

        // Update only the first N chunks
        const toUpdate = dirtyChunks.slice(0, maxChunksPerFrame);
        for (const { chunk } of toUpdate) {
            chunk.buildMesh();
        }
    }

    unloadChunk(key) {
        const chunk = this.chunks.get(key);
        if (chunk) {
            if (chunk.dispose) chunk.dispose();
            if (chunk.mesh) {
                this.scene.remove(chunk.mesh);
            }
            this.chunks.delete(key);
            this.generatedChunks.delete(key);
        }
    }

    checkChunks() {
        if (this.gameState.debug && !this.gameState.debug.chunks) return;

        const playerChunk = this.worldToChunk(
            this.player.position.x,
            this.player.position.y,
            this.player.position.z
        );

        const { cx, cz } = playerChunk;

        // Optimization: Only update if we moved to a new chunk (roughly)
        // But we need to ensure we fill the queue if it's empty even if we haven't moved chunks?
        // Actually, checkChunks is called every frame, so we should guard it.
        if (this.lastChunkX === cx && this.lastChunkZ === cz) {
            // Keep queue filled if we have gaps? No, standard logic relies on initial position.
            // If we didn't move, we don't need to check for *new* chunks to load.
            // But we might still have a queue processing.
            return;
        }

        this.lastChunkX = cx;
        this.lastChunkZ = cz;

        // 1. Unload far chunks
        const unloadDist = this.renderDistance + 2;
        for (const [key, chunk] of this.chunks) {
            if (Math.abs(chunk.cx - cx) > unloadDist || Math.abs(chunk.cz - cz) > unloadDist) {
                this.unloadChunk(key);
                // Also remove from queue if it's pending?
                // Ideally yes, to avoid generating things we immediately unload.
                // Brute force filter the queue:
                this.chunkGenQueue = this.chunkGenQueue.filter(req =>
                    Math.abs(req.cx - cx) <= unloadDist && Math.abs(req.cz - cz) <= unloadDist
                );
            }
        }

        // 2. Queue missing chunks
        // Generate chunks around the player
        for (let x = cx - this.renderDistance; x <= cx + this.renderDistance; x++) {
            for (let z = cz - this.renderDistance; z <= cz + this.renderDistance; z++) {
                // Determine vertical range
                for (let y = -4; y < 8; y++) {
                    const chunkKey = `${x},${y},${z}`;

                    // Skip if already loaded
                    if (this.chunks.has(chunkKey)) continue;

                    // Skip if already in queue
                    // Optimization: Check existing keys in queue. 
                    // Since queue can be large, maybe a Set for pending keys?
                    // For now, simple find is okay if render distance isn't huge.
                    const alreadyQueued = this.chunkGenQueue.some(req => req.key === chunkKey);
                    if (alreadyQueued) continue;

                    // Add to queue
                    const dx = x - cx;
                    const dz = z - cz;
                    const distSq = dx * dx + dz * dz;

                    this.chunkGenQueue.push({
                        cx: x, cy: y, cz: z,
                        key: chunkKey,
                        distSq: distSq
                    });
                }
            }
        }

        // chunkGenQueue will be processed in animate()
    }



    /**
     * Store and apply persisted blocks from server
     * Handles race condition where chunks might not be generated yet
     */
    addPersistedBlocks(blocks) {
        console.log(`[Game] Processing ${blocks.length} persisted blocks...`);
        let appliedCount = 0;
        let storedCount = 0;

        for (const block of blocks) {
            const { cx, cy, cz, lx, ly, lz } = this.worldToChunk(block.x, block.y, block.z);
            const chunkKey = this.getChunkKey(cx, cy, cz);

            // Group by chunk for efficient storage/application
            if (!this.persistedBlocks.has(chunkKey)) {
                this.persistedBlocks.set(chunkKey, []);
            }
            this.persistedBlocks.get(chunkKey).push({ lx, ly, lz, type: block.type });

            // If chunk exists and is generated, apply immediately
            // But if it's NOT generated, we just store it and wait for generation
            const chunk = this.chunks.get(chunkKey);
            if (chunk && chunk.isGenerated) {
                chunk.setBlock(lx, ly, lz, block.type);
                chunk.dirty = true; // Mark for rebuild
                appliedCount++;
            } else {
                storedCount++;
            }
        }

        console.log(`[Game] Persisted blocks: ${appliedCount} applied immediately, ${storedCount} queued for generation`);

        if (appliedCount > 0) {
            this.updateChunks();
        }
    }

    // Process queue of chunks to generate
    processChunkQueue() {
        if (this.chunkGenQueue.length === 0) return;
        if (this._idleCallbackScheduled) return; // Already scheduled

        // Sort by distance (closest first)
        const playerChunk = this.worldToChunk(this.player.position.x, this.player.position.y, this.player.position.z);

        this.chunkGenQueue.forEach(req => {
            const dx = req.cx - playerChunk.cx;
            const dz = req.cz - playerChunk.cz;
            req.distSq = dx * dx + dz * dz;
        });

        this.chunkGenQueue.sort((a, b) => a.distSq - b.distSq);

        const processInIdle = (deadline) => {
            this._idleCallbackScheduled = false;

            let processed = 0;
            const isInitialLoad = this.generatedChunks.size < 9; // 3x3 chunks

            // Process as many chunks as we can while there's idle time OR if we are in initial load
            while (this.chunkGenQueue.length > 0 && (deadline.timeRemaining() > 2 || isInitialLoad)) {
                const req = this.chunkGenQueue.shift();

                // Double check if loaded (rare case)
                if (this.chunks.has(req.key)) continue;

                // Generate
                const chunk = this.worldGen.generateChunk(req.cx, req.cy, req.cz);
                this.generatedChunks.add(req.cx + ',' + req.cy + ',' + req.cz);

                // Apply persisted blocks to this newly generated chunk
                const chunkKey = this.getChunkKey(req.cx, req.cy, req.cz);
                const pendingBlocks = this.persistedBlocks.get(chunkKey);
                if (pendingBlocks) {
                    console.log(`[Game] Applying ${pendingBlocks.length} pending blocks to generated chunk ${chunkKey}`);
                    for (const pb of pendingBlocks) {
                        chunk.setBlock(pb.lx, pb.ly, pb.lz, pb.type);
                    }
                    chunk.dirty = true; // Ensure mesh is built with these changes
                }

                this.spawnManager.spawnChunk(req.cx, req.cz);
                processed++;
            }

            if (processed > 0) {
                this.updateBlockCount();

                // Spawn initial animals and dragon AFTER enough chunks are generated
                if (!this._initialSpawnDone && this.generatedChunks.size >= 50) {
                    this._initialSpawnDone = true;
                    console.log(`[Game] ${this.generatedChunks.size} chunks generated, spawning animals...`);

                    // New: Mark world ready so deferred spawns are released
                    this.spawnManager.setWorldReady();

                    this.spawnManager.spawnKangaroosNearPlayer();
                    this.spawnManager.spawnPugasusNearPlayer();
                    this.spawnManager.spawnSnowmenNearPlayer();
                    this.spawnDragon();
                }
            }

            // If there's more to process, schedule another idle callback
            if (this.chunkGenQueue.length > 0) {
                this._idleCallbackScheduled = true;
                requestIdleCallback(processInIdle, { timeout: 100 });
            }
        };

        // Schedule idle callback to process chunks when browser is free
        this._idleCallbackScheduled = true;

        // Initial load: Run immediately to avoid waiting for idle time
        if (this.generatedChunks.size < 9) {
            setTimeout(() => processInIdle({ timeRemaining: () => 999 }), 0);
        } else {
            requestIdleCallback(processInIdle, { timeout: 100 });
        }
    }



    // cleanupBlockData removed as it's no longer needed

    // Frustum culling - hide chunks not in view
    updateFrustumCulling() {
        this.frustumMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse
        );
        this.frustum.setFromProjectionMatrix(this.frustumMatrix);

        // Get player chunk position for distance calculations
        const playerCX = Math.floor(this.player.position.x / this.chunkSize);
        const playerCZ = Math.floor(this.player.position.z / this.chunkSize);

        for (const chunk of this.chunks.values()) {
            if (chunk.mesh) {
                // Calculate horizontal distance from player
                const hDist = Math.max(Math.abs(chunk.cx - playerCX), Math.abs(chunk.cz - playerCZ));

                // Keep ground-level chunks (cy <= 0) visible within render distance
                // This prevents terrain from being culled under structures
                const isGroundChunk = chunk.cy <= 0;
                const withinRenderDistance = hDist <= this.renderDistance;

                if (isGroundChunk && withinRenderDistance) {
                    // Always show ground chunks within render distance
                    // BUT only if terrain toggle is on!
                    chunk.mesh.visible = this.terrainVisible;
                } else {
                    // Apply normal frustum culling for above-ground chunks
                    chunk.mesh.visible = this.terrainVisible && chunk.isInFrustum(this.frustum);
                }
            }
        }
    }

    // Physics methods moved to PhysicsManager
    // createHighlightBox removed
    // getHitAnimal, getTargetBlock removed

    breakBlock(x, y, z) {
        const block = this.getBlock(x, y, z);
        if (block) {
            this.setBlock(x, y, z, null);
            this.player.collectBlock(block.type);
        }
    }

    updateBlockCount() {
        // Calculating total blocks is expensive now (iterate all chunks).
        // For performance, we'll just show chunk count or approximate.
        // Or we can track a simple counter manually in setBlock.
        // For now, let's just show loaded chunks to verify optimization impact essentially.
        // Or we can sum them up occasinally.
        let total = 0;
        // Optimization: Only count every few seconds or just show Loaded Chunks.
        this.uiManager.updateBlockCount(this.chunks.size + " Chunks");
    }

    // updateHighlight removed - handled by PhysicsManager

    updateDebug() {
        this.uiManager.updatePosition(this.player.position);
        this.uiManager.updateFPS();

        // Track scene object count every 5 seconds
        const now = performance.now();
        if (!this._lastSceneCount || now - this._lastSceneCount > 5000) {
            this._lastSceneCount = now;
            let count = 0;
            this.scene.traverse(() => count++);
            console.log(`[Scene] Total objects: ${count}, Animals: ${this.animals.length}`);
        }

        // Multiplayer: Send position update every 100ms, only if moved or stopping
        if (!this._lastPosUpdate || now - this._lastPosUpdate > 100) {
            this._lastPosUpdate = now;

            if (this.socketManager && this.socketManager.isConnected()) {
                const currentPos = this.player.position;
                const currentRotY = this.player.rotation.y;

                const posDist = currentPos.distanceTo(this._lastSentPos);
                const rotDiff = Math.abs(currentRotY - this._lastSentRotY);

                // Send if moved significantly (> 0.05) or rotated significantly (> 0.01 rad ~0.57 degrees)
                // Lower rotation threshold ensures mouse-only look updates are synced
                const isMoving = posDist > 0.05;
                const isRotating = rotDiff > 0.01;
                const shouldSend = isMoving || isRotating;



                if (shouldSend) {
                    this.socketManager.sendPosition(currentPos, currentRotY);
                    this._lastSentPos.copy(currentPos);
                    this._lastSentRotY = currentRotY;
                    this._isCurrentlyMoving = isMoving;
                    this._isCurrentlyRotating = isRotating;
                } else if (this._isCurrentlyMoving || this._isCurrentlyRotating) {
                    // Send one last "stop" packet to ensure final position/rotation sync
                    this.socketManager.sendPosition(currentPos, currentRotY);
                    this._lastSentPos.copy(currentPos);
                    this._lastSentRotY = currentRotY;
                    this._isCurrentlyMoving = false;
                    this._isCurrentlyRotating = false;
                }
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.processChunkQueue();

        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1000;
        this.lastTime = now;

        // UI Update (Speech bubbles)
        this.uiManager.update(deltaTime);

        // UI-Only Mode: Skip all world/entity updates
        if (this.isUIOnly) {
            this.updateDebug();
            this.renderer.render(this.scene, this.camera);
            return;
        }

        // Update physics and player only when locked (active play)
        if (this.controls.isLocked) {
            this.player.update(deltaTime);
            this.physicsManager.update();
        }

        // Always update chunks and check for new ones, so the world generates around you even before starting
        // Throttle chunk checking (expensive)
        if (this.frameCount % 15 === 0) {
            this.checkChunks();
        }

        // Update dirty chunks every frame (throttled internally)
        this.updateChunks();

        this.frameCount = (this.frameCount || 0) + 1;

        this.agent.update(this.lastTime / 1000, this.player);
        if (this.studio) this.studio.update(deltaTime);

        // Update animals
        this.animals.forEach(animal => animal.update(deltaTime));

        // Helper to remove dead animals
        for (let i = this.animals.length - 1; i >= 0; i--) {
            if (this.animals[i].isDead) {
                this.animals[i].dispose();
                this.scene.remove(this.animals[i].mesh);
                this.animals.splice(i, 1);
            }
        }

        // Periodic cleanup (every ~1s)
        if (this.frameCount % 60 === 0) {
            this.cleanupEntities();
        }

        // Update Dragon
        if (this.dragon) {
            this.dragon.update(deltaTime, this.player);
        }

        this.entityManager.update(deltaTime, this.player);

        // Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const arrow = this.projectiles[i];
            const alive = arrow.update(deltaTime);
            if (!alive) {
                this.scene.remove(arrow.mesh);
                this.projectiles.splice(i, 1);
            }
        }

        // Update Drops
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const drop = this.drops[i];
            const alive = drop.update(deltaTime);
            if (!alive) {
                this.scene.remove(drop.mesh);
                this.drops.splice(i, 1);
            }
        }

        if (this.shrunkBlocks) {
            for (let i = this.shrunkBlocks.length - 1; i >= 0; i--) {
                const sb = this.shrunkBlocks[i];
                const alive = sb.update(deltaTime);
                if (!alive) {
                    this.scene.remove(sb.mesh);
                    this.shrunkBlocks.splice(i, 1);
                }
            }
        }

        // Update Targeted Floating Blocks (Giant build)
        if (this.targetedFloatingBlocks) {
            for (let i = this.targetedFloatingBlocks.length - 1; i >= 0; i--) {
                const tfb = this.targetedFloatingBlocks[i];
                const alive = tfb.update(deltaTime);
                if (!alive) {
                    // Mesh removal is handled by placeBlock, but if it dies otherwise:
                    if (tfb.mesh && tfb.mesh.parent) {
                        this.scene.remove(tfb.mesh);
                    }
                    this.targetedFloatingBlocks.splice(i, 1);
                }
            }
        }



        // Update Floating Blocks
        if (this.floatingBlocks) {
            for (let i = this.floatingBlocks.length - 1; i >= 0; i--) {
                const fb = this.floatingBlocks[i];
                const alive = fb.update(deltaTime);
                if (!alive) {
                    this.scene.remove(fb.mesh);
                    this.floatingBlocks.splice(i, 1);
                }
            }
        }

        // Update Tornadoes
        if (this.tornadoes) {
            for (let i = this.tornadoes.length - 1; i >= 0; i--) {
                const t = this.tornadoes[i];
                const alive = t.update(deltaTime);
                if (!alive) {
                    this.tornadoes.splice(i, 1);
                }
            }
        }

        // Frustum culling for performance
        this.updateFrustumCulling();

        // Day/Night Cycle - use Environment module
        if (!this.gameState.debug || this.gameState.debug.environment) {
            this.environment.updateDayNightCycle(deltaTime, this.player.position);
        }

        if (this.weatherSystem) {
            this.weatherSystem.update(deltaTime, this.player.position);
        }

        if (this.worldParticleSystem) {
            this.worldParticleSystem.update(deltaTime, this.player.position);
        }

        // Animate water textures
        if (this.textures && this.textures.water) {
            const waterSpeed = 0.2; // Adjust for flow speed
            this.textures.water.offset.x += waterSpeed * deltaTime;
            this.textures.water.offset.y += waterSpeed * 0.5 * deltaTime;
        }

        // Update water flow system
        if (this.waterSystem) {
            this.waterSystem.update(deltaTime);
        }

        // Update Remote Players (toggle with P key for debugging)
        if (!this._disableRemotePlayers && this.remotePlayers) {
            const remoteDelta = deltaTime;
            for (const remotePlayer of this.remotePlayers.values()) {
                remotePlayer.update(remoteDelta);
            }
        }



        this.updateDebug();
        this.renderer.render(this.scene, this.camera);
    }
    killAllAnimals() {
        for (const animal of this.animals) {
            if (animal.dispose) animal.dispose();
            if (animal.mesh) this.scene.remove(animal.mesh);
        }
        this.animals = [];

        if (this.dragon) {
            if (this.dragon.dispose) this.dragon.dispose();
            if (this.dragon.mesh) this.scene.remove(this.dragon.mesh);
            this.dragon = null;
        }

        if (this.entityManager) {
            this.entityManager.clearAll();
        }

        console.log('Killed all animals, dragon, and ambient entities.');
    }

    cleanupEntities() {
        const despawnDist = 128; // 8 chunks
        for (let i = this.animals.length - 1; i >= 0; i--) {
            // Distance check
            if (this.animals[i].position.distanceTo(this.player.position) > despawnDist) {
                this.animals[i].dispose(); // Clean up resources!
                this.scene.remove(this.animals[i].mesh);
                this.animals.splice(i, 1);
            }
        }
    }

    regenerateWithSeed(seed) {
        console.log('[Game] Regenerating world with seed:', seed);

        // Update generator seeds
        this.worldGen.setSeed(seed);
        this.worldSeed = seed; // Store it

        // Clear existing chunks
        for (const [key, chunk] of this.chunks) {
            chunk.dispose();
            if (chunk.mesh) {
                this.scene.remove(chunk.mesh);
            }
        }
        this.chunks.clear();
        this.generatedChunks.clear();
        this.chunkGenQueue = [];

        // Reset chunk tracking to force regeneration
        this.lastChunkX = null;
        this.lastChunkZ = null;

        // Clear entities
        this.killAllAnimals();
        if (this.spawnManager && this.spawnManager.spawnedChunks) {
            this.spawnManager.spawnedChunks.clear();
        }

        // Respawn player at new surface
        this.spawnPlayer();

        // Regenerate around player
        this.checkChunks();
        this.updateChunks();

        console.log('[Game] World regenerated with seed:', seed);
    }

    toggleTerrain(visible) {
        this.terrainVisible = visible;
        for (const chunk of this.chunks.values()) {
            if (chunk.mesh) {
                chunk.mesh.visible = visible;
            }
        }
    }

    toggleShadows(enabled) {
        this.renderer.shadowMap.enabled = enabled;
        this.scene.traverse((obj) => {
            if (obj.isMesh) {
                if (obj.castShadow) obj.castShadow = enabled;
                if (obj.receiveShadow) obj.receiveShadow = enabled;
            }
            if (obj.isLight) {
                obj.castShadow = enabled;
            }
        });
        // Reload materials? Some might need update.
        // Usually renderer setting is enough for next frame, but materials need needsUpdate=true
        this.materials.forEach(m => m.needsUpdate = true);
        console.log(`[Game] Shadows: ${enabled}`);
    }

    toggleWater(enabled) {
        if (this.waterSystem) {
            this.waterSystem.enabled = enabled;
        }
        console.log(`[Game] Water Logic: ${enabled}`);
    }

    toggleWeather(enabled) {
        if (this.weatherSystem) {
            this.weatherSystem.enabled = enabled;
            if (!enabled) this.weatherSystem.clear();
        }
        console.log(`[Game] Weather: ${enabled}`);
    }

    animateBareBones() {
        requestAnimationFrame(() => this.animateBareBones());
        if (this.cube) {
            this.cube.rotation.x += 0.01;
            this.cube.rotation.y += 0.01;
        }

        // Manual FPS Counter
        const now = performance.now();
        if (!this._lastTime) this._lastTime = now;
        const delta = now - this._lastTime;

        if (!this._fpsDiv) {
            this._fpsDiv = document.createElement('div');
            this._fpsDiv.style.position = 'absolute';
            this._fpsDiv.style.top = '10px';
            this._fpsDiv.style.left = '10px';
            this._fpsDiv.style.color = 'lime';
            this._fpsDiv.style.fontSize = '24px';
            this._fpsDiv.style.fontFamily = 'monospace';
            this._fpsDiv.style.fontWeight = 'bold';
            this._fpsDiv.style.zIndex = '9999';
            document.body.appendChild(this._fpsDiv);
            this._frames = 0;
            this._lastFpsUpdate = now;
        }

        this._frames++;
        if (now - this._lastFpsUpdate >= 1000) {
            const fps = Math.round((this._frames * 1000) / (now - this._lastFpsUpdate));
            this._fpsDiv.innerText = `BARE BONES FPS: ${fps}`;
            this._frames = 0;
            this._lastFpsUpdate = now;
        }

        this.renderer.render(this.scene, this.camera);
    }

}
