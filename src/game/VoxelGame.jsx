import * as THREE from 'three';
import { Chunk } from './Chunk.js';
import { Player } from './Player.js';
import { Agent } from './Agent.js';
import { Inventory } from './Inventory.js';
import { InventoryManager } from './InventoryManager.js';
import { SpawnManager } from './SpawnManager.js';
import { UIManager } from './UIManager.js';
import { Arrow } from './Arrow.js';
import { EntityManager } from './EntityManager.js';
import { InputManager } from './InputManager.js';
import { PhysicsManager } from './PhysicsManager.js';
import { GameState } from './GameState.js';
import { WorldGenerator } from '../world/WorldGenerator.js';
import { AssetManager } from './AssetManager.js';
import { Environment } from './Environment.js';
import { Studio } from './Studio.js';
import { WeatherSystem } from './WeatherSystem.js';
import { Dragon } from './Dragon.js';
import { ColyseusManager } from './ColyseusManager.js';
import { RemotePlayer } from './RemotePlayer.js';

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
        this.chunkSize = 16;
        this.renderDistance = 4;
        this.generatedChunks = new Set();

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
        this.gravity = 0.0064;

        // Game State (Centralized)
        this.gameState = new GameState(this);

        // Debug Flags (Initialize BEFORE UIManager) - Now in GameState
        // this.debugFlags = { ... }; // Removed

        // Sub-modules
        this.uiManager = new UIManager(this);
        this.inventoryManager = new InventoryManager(this);
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
        this.studio = new Studio(this);
        this.animals = [];
        this.spawnManager = new SpawnManager(this);

        this.spawnPlayer();

        this.camera.position.copy(this.player.position);
        this.camera.position.y += 1.6; // Eye height

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
        this.remotePlayers = new Map(); // peerId -> RemotePlayer

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

        // Initial chunk check
        this.checkChunks();
        this.updateChunks();
        this.updateBlockCount();

        // Spawn Initial Animals
        this.spawnAnimals();

        // Spawn some kangaroos near the player for immediate viewing
        this.spawnManager.spawnKangaroosNearPlayer();

        // Spawn some Pugasus (mythical chimera creatures) near the player!
        this.spawnManager.spawnPugasusNearPlayer();

        // Spawn festive Snowmen near the player!
        this.spawnManager.spawnSnowmenNearPlayer();

        // Spawn Dragon
        this.dragon = null;
        this.spawnDragon();

        // Projectiles
        this.projectiles = [];

        // Start game loop
        this.lastTime = performance.now();
        this.animate();

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
        const item = this.inventory.getSelectedItem();
        if (item && item.item === 'bow') {
            console.log('Drawing bow...');
            // In future: Start draw animation/timer
            return true; // Handled
        }
        return false;
    }

    onRightClickUp() {
        const item = this.inventory.getSelectedItem();
        if (item && item.item === 'bow') {
            const camDir = new THREE.Vector3();
            this.camera.getWorldDirection(camDir);

            // Spawn slightly in front of head
            const spawnPos = this.camera.position.clone().add(camDir.clone().multiplyScalar(0.5));
            const velocity = camDir.clone().multiplyScalar(2.0); // Speed 2.0 (faster than animals?)
            // Add slight arc up?
            velocity.y += 0.1;

            this.spawnArrow(spawnPos, velocity);
            return true;
        }
        return false;
    }

    spawnArrow(pos, vel) {
        const arrow = new Arrow(this, pos, vel);
        this.projectiles.push(arrow);
        this.scene.add(arrow.mesh);
        console.log('Arrow fired!');
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

        // Optimization: Only update if we moved to a new chunk
        if (this.lastChunkX === cx && this.lastChunkZ === cz) {
            return;
        }

        this.lastChunkX = cx;
        this.lastChunkZ = cz;

        // Unload far chunks
        const unloadDist = this.renderDistance + 2;
        for (const [key, chunk] of this.chunks) {
            if (Math.abs(chunk.cx - cx) > unloadDist || Math.abs(chunk.cz - cz) > unloadDist) {
                this.unloadChunk(key);
            }
        }

        let chunksGenerated = false;

        // Generate chunks around the player
        for (let x = cx - this.renderDistance; x <= cx + this.renderDistance; x++) {
            for (let z = cz - this.renderDistance; z <= cz + this.renderDistance; z++) {
                // For now, we only generate a fixed height of chunks (e.g., -4 to 8 for height -64 to 128)
                let columnGenerated = false;
                for (let y = -4; y < 8; y++) {
                    const funcKey = `${x},${y},${z}`;
                    // Note: We might re-generate chunks we unloaded. 
                    // This means changes are lost, but it saves memory.
                    // To prevent re-gen loop if we just unloaded, we rely on unloadDist > renderDistance.

                    if (!this.chunks.has(`${x},${y},${z}`)) {
                        // Only gen if not currently in memory
                        // We also check generatedChunks to avoid re-running widely expensive procedural gen if unnecessary,
                        // but since we unloaded, we MUST re-run it or load from disk.
                        // For now, we allow re-generation.
                        this.worldGen.generateChunk(x, y, z);
                        this.generatedChunks.add(funcKey); // Mark as gen'd (stats)
                        chunksGenerated = true;
                        columnGenerated = true;
                    }
                }

                // Attempt spawn if we generated new terrain in this column
                if (columnGenerated) {
                    this.spawnManager.spawnChunk(x, z);
                }
            }
        }

        if (chunksGenerated) {
            this.updateBlockCount();
        }
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

        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1000;
        this.lastTime = now;

        if (this.controls.isLocked) {
            this.player.update(this.controls.keys, deltaTime);
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

        // Frustum culling for performance
        this.updateFrustumCulling();

        // Day/Night Cycle - use Environment module
        if (!this.gameState.debug || this.gameState.debug.environment) {
            this.environment.updateDayNightCycle(deltaTime, this.player.position);
        }

        if (this.weatherSystem) {
            this.weatherSystem.update(deltaTime, this.player.position);
        }

        // Animate water textures
        if (this.textures && this.textures.water) {
            const waterSpeed = 0.2; // Adjust for flow speed
            this.textures.water.offset.x += waterSpeed * deltaTime;
            this.textures.water.offset.y += waterSpeed * 0.5 * deltaTime;
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
