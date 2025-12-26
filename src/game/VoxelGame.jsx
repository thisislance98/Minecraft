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
import { ColyseusManager } from './systems/ColyseusManager.js';
import { RemotePlayer } from './entities/RemotePlayer.js';
import { WorldParticleSystem } from './systems/WorldParticleSystem.js';
import { SoundManager } from './systems/SoundManager.js';
import { StructureGenerator } from '../world/StructureGenerator.js';
import { Config } from './core/Config.js';
import { OmniProjectile } from './entities/projectiles/OmniProjectile.js';
import { SpellSystem } from './systems/SpellSystem.js';
import { Tornado } from './entities/Tornado.js';
import { WaterSystem } from './systems/WaterSystem.js';

export class VoxelGame {
    constructor() {
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

        // World data - chunk based
        this.chunks = new Map();
        this.chunkSize = Config.WORLD.CHUNK_SIZE;
        this.renderDistance = Config.WORLD.RENDER_DISTANCE;
        this.generatedChunks = new Set();
        this.chunkGenQueue = []; // Queue for chunks to be generated

        // For raycasting - we need to track individual block positions
        // this.blockData = new Map(); // REMOVED: Redundant storage

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
        // this.debugFlags = { ... }; // Removed

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

        // Initialize world seed for consistent world generation
        this.worldSeed = Math.floor(Math.random() * 1000000);
        console.log('[Game] World seed:', this.worldSeed);

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

        // FPS counter removed from here (moved to UIManager instantiation)

        // Spawn Animals - Manager initialized earlier
        // this.animals = [];
        // this.spawnManager = new SpawnManager(this);

        // Network Manager
        this.networkManager = new ColyseusManager(this);
        this.colyseusManager = this.networkManager; // Alias for Agent compatibility
        this.remotePlayers = new Map(); // peerId -> RemotePlayer

        // Auto-host for development/testing
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('[Game] Auto-hosting multiplayer session for testing...');
            this.networkManager.createRoom().catch(e => console.error('[Game] Auto-host failed:', e));
        }

        // Setup Network Callbacks (Colyseus)
        this.networkManager.onPlayerJoin = (sessionId, playerState) => {
            console.log('Player joined:', sessionId);
            const remotePlayer = new RemotePlayer(this, sessionId);
            this.remotePlayers.set(sessionId, remotePlayer);
            this.uiManager.addChatMessage('system', `${playerState.name} joined`);
        };

        this.networkManager.onPlayerLeave = (sessionId) => {
            console.log('Player left:', sessionId);
            const remotePlayer = this.remotePlayers.get(sessionId);
            if (remotePlayer) {
                remotePlayer.dispose();
                this.remotePlayers.delete(sessionId);
                this.uiManager.addChatMessage('system', `Player left: ${sessionId.substring(0, 6)}`);
            }
        };

        this.networkManager.onBlockChange = (x, y, z, blockType) => {
            // Apply block change without broadcasting back
            this.setBlock(x, y, z, blockType, false, true); // true = skipBroadcast
        };

        this.networkManager.onWorldSeedReceived = (seed) => {
            console.log('[Game] Received world seed from server:', seed);
            if (!this.generatedChunks || this.generatedChunks.size === 0) {
                // Haven't generated world yet - just set seed
                this.worldSeed = seed;
                this.worldGen.setSeed(seed);
            }
        };

        // Set up Agent's debug command handler now that colyseusManager exists
        this.agent.setupDebugCommandHandler();

        // Add daytime switch hotkey (K)
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'k' && !this.gameState.flags.inventoryOpen && !(this.agent && this.agent.isChatOpen)) {
                this.setDaytime();
            }
        });

        // Initial chunk check
        this.checkChunks();
        this.updateChunks();
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


        this.inventory.addItem('door_closed', 64, 'block');



        // Chat Button Listener & Debug Panel handled by UIManager/InputManager now
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
        if (this.environment) {
            // Set time to day (0 is usually dawn/day start)
            this.environment.time = 0;
            // Force immediate update of lights and skybox
            this.environment.updateDayNightCycle(0, this.player.position);
            if (this.uiManager) {
                this.uiManager.addChatMessage('system', 'Time set to daytime');
            }
            console.log('[Game] Time set to daytime');
        }
    }

    // Removing setupDebugPanel() as it is in UIManager now

    spawnPlayer() {
        let spawnX = 32;
        let spawnZ = 32;
        let spawnY = 0;

        // We will look for a "Coastal" spot first.
        // A coastal spot is on land, but has water nearby.
        let bestSpot = null; // Fallback: any safe land
        let coastalSpot = null; // Priority: safe land near water

        const maxAttempts = 200; // Increased attempts to find coast
        const checkRadius = 400; // Max radius to search

        for (let i = 0; i < maxAttempts; i++) {
            // Spiral outwards
            const radius = 32 + (i / maxAttempts) * checkRadius;
            const angle = i * (Math.PI / 8) + (Math.random() * 0.5); // Tighter spiral

            const x = 32 + Math.cos(angle) * radius;
            const z = 32 + Math.sin(angle) * radius;

            const terrainH = this.worldGen.getTerrainHeight(x, z);

            // Check if valid land (above sea level)
            if (terrainH > this.worldGen.seaLevel + 1) {
                // FORCE FOREST BIOME CHECK
                const biome = this.worldGen.getBiome(x, z);
                if (biome !== 'FOREST') continue;

                // Max height check to avoid spawning in sky
                if (terrainH > 100) continue;

                // Spawn above the terrain surface
                const spot = { x: x, y: terrainH + 2, z: z };

                if (!bestSpot) bestSpot = spot; // Save first valid spot as fallback

                // We found a valid forest spot, use it
                coastalSpot = spot;
                break;
            }
        }

        // Use coastal spot if found, otherwise fallback
        const finalSpot = coastalSpot || bestSpot;

        if (finalSpot) {
            spawnX = finalSpot.x;
            spawnY = finalSpot.y;
            spawnZ = finalSpot.z;
        } else {
            // Absolute fallback if everything fails (e.g. infinite ocean)
            spawnY = Math.max(this.worldGen.getTerrainHeight(spawnX, spawnZ) + 20, this.worldGen.seaLevel + 2);
        }

        this.spawnPoint = new THREE.Vector3(spawnX, spawnY, spawnZ);
        this.player.position.copy(this.spawnPoint);
        this.player.velocity.set(0, 0, 0);

        // Also update camera immediately so we don't flash at the wrong spot
        this.camera.position.copy(this.player.position);
        this.camera.position.y += 1.6;

        console.log(`Spawned at ${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)} (Coastal: ${!!coastalSpot})`);
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

        this.dragon = new Dragon(this, x, y, z);
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
            if (block === 'door_closed') {
                this.setBlock(target.x, target.y, target.z, 'door_open');
                this.soundManager.playSound('click'); // consistent feedback
                return true; // Handled
            } else if (block === 'door_open') {
                // Check if player is inside the door before closing interaction?
                // For now, just close it. Collision will handle pushing out or getting stuck.
                this.setBlock(target.x, target.y, target.z, 'door_closed');
                this.soundManager.playSound('click');
                return true; // Handled
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
        if (!blockType || blockType === 'air' || blockType === 'water') return;

        // Leaf logic: Chance to drop
        if (blockType.includes('leaves')) {
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

        // We no longer maintain this.blockData
        // const key = this.getBlockKey(x, y, z); 

        if (type === null) {
            // this.blockData.delete(key);
            const chunkKey = this.getChunkKey(cx, cy, cz);
            const chunk = this.chunks.get(chunkKey);
            if (chunk) {
                chunk.setBlock(lx, ly, lz, null);
                // Also mark neighboring chunks as dirty if on edge
                this.markNeighborsDirty(Math.floor(x), Math.floor(y), Math.floor(z));
            }
        } else {
            // this.blockData.set(key, type);
            const chunk = this.getOrCreateChunk(cx, cy, cz);
            chunk.setBlock(lx, ly, lz, type);
            // Also mark neighboring chunks as dirty if on edge
            this.markNeighborsDirty(Math.floor(x), Math.floor(y), Math.floor(z));
        }

        if (!skipMeshUpdate) {
            this.updateChunks(); // Trigger mesh update for interactive changes
        }

        if (!skipBroadcast && this.networkManager.isConnected()) {
            this.networkManager.sendBlockChange(x, y, z, type);
        }
    }

    toggleDoor(x, y, z) {
        const block = this.getBlock(x, y, z);
        if (!block) return;

        let newType;
        if (block.type === 'door_closed') newType = 'door_open';
        else if (block.type === 'door_open') newType = 'door_closed';
        else return;

        // Toggle clicked block
        this.setBlock(x, y, z, newType);

        // Check Up
        const upBlock = this.getBlock(x, y + 1, z);
        if (upBlock && (upBlock.type === 'door_closed' || upBlock.type === 'door_open')) {
            this.setBlock(x, y + 1, z, newType);
        }

        // Check Down
        const downBlock = this.getBlock(x, y - 1, z);
        if (downBlock && (downBlock.type === 'door_closed' || downBlock.type === 'door_open')) {
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

        // Schedule idle callback to process chunks when browser is free
        this._idleCallbackScheduled = true;

        const processInIdle = (deadline) => {
            this._idleCallbackScheduled = false;

            let processed = 0;

            // Process as many chunks as we can while there's idle time
            while (this.chunkGenQueue.length > 0 && deadline.timeRemaining() > 2) {
                const req = this.chunkGenQueue.shift();

                // Double check if loaded (rare case)
                if (this.chunks.has(req.key)) continue;

                // Generate
                this.worldGen.generateChunk(req.cx, req.cy, req.cz);
                this.generatedChunks.add(req.cx + ',' + req.cy + ',' + req.cz);

                this.spawnManager.spawnChunk(req.cx, req.cz);
                processed++;
            }

            if (processed > 0) {
                this.updateBlockCount();

                // Spawn initial animals and dragon AFTER first batch of world chunks are generated
                if (!this._initialSpawnDone) {
                    this._initialSpawnDone = true;
                    console.log('[Game] Initial chunks generated, spawning animals...');

                    this.spawnAnimals();
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

        requestIdleCallback(processInIdle, { timeout: 100 });
    }

    unloadChunk(key) {
        const chunk = this.chunks.get(key);
        if (chunk) {
            chunk.dispose();
            this.chunks.delete(key);
            // No need to cleanup blockData anymore
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

        for (const chunk of this.chunks.values()) {
            if (chunk.mesh) {
                chunk.mesh.visible = chunk.isInFrustum(this.frustum);
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
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.processChunkQueue();

        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1000;
        this.lastTime = now;

        // UI Update (Speech bubbles)
        this.uiManager.update(deltaTime);

        if (this.controls.isLocked) {
            this.player.update(deltaTime);
            this.physicsManager.update();

            // Throttle chunk checking (expensive)
            if (this.frameCount % 15 === 0) {
                this.checkChunks();
            }

            // Update dirty chunks every frame (throttled internally)
            this.updateChunks();

            this.frameCount = (this.frameCount || 0) + 1;
        }
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

        // Update Remote Players
        const remoteDelta = deltaTime;
        for (const remotePlayer of this.remotePlayers.values()) {
            remotePlayer.update(remoteDelta);
        }

        // Send State to Server (Colyseus)
        if (this.networkManager.isConnected()) {
            const animation = (this.inputManager.keys['w'] || this.inputManager.keys['s'] ||
                this.inputManager.keys['a'] || this.inputManager.keys['d']) ? 'walking' : 'idle';

            this.networkManager.sendPlayerUpdate(
                this.player.position,
                this.player.rotation,
                animation,
                this.inventory.getSelectedItem()?.item
            );
        }

        this.updateDebug();
        this.renderer.render(this.scene, this.camera);
    }
    killAllAnimals() {
        for (const animal of this.animals) {
            animal.dispose();
            this.scene.remove(animal.mesh);
        }
        this.animals = [];
        console.log('Killed all animals.');
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
        console.log('Regenerating world with seed:', seed);

        // Update generator seeds
        this.worldGen.setSeed(seed);
        this.worldSeed = seed; // Store it

        // Clear existing chunks
        for (const [key, chunk] of this.chunks) {
            chunk.dispose();
            this.cleanupBlockData(chunk);
        }
        this.chunks.clear();
        this.generatedChunks.clear();
        this.lastChunkX = null;
        this.lastChunkZ = null;
        this.blockData.clear(); // Clear block data too

        // Clear entities
        this.killAllAnimals();
        this.spawnManager.spawnedChunks.clear();

        // Regenerate around player
        this.checkChunks();
        this.updateChunks();

        // Respawn player at new surface
        this.spawnPlayer();
        this.spawnAnimals();
    }

    toggleTerrain(visible) {
        for (const chunk of this.chunks.values()) {
            if (chunk.mesh) {
                chunk.mesh.visible = visible;
            }
        }
    }
}
