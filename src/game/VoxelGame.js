import * as THREE from 'three';
import { Chunk } from './Chunk.js';
import { Player } from './Player.js';
import { Agent } from './Agent.js';
import { Inventory } from './Inventory.js';
import { Pig } from './animals/Pig.js';
import { Horse } from './animals/Horse.js';
import { Chicken } from './animals/Chicken.js';
import { Bunny } from './animals/Bunny.js';
import { Frog } from './animals/Frog.js';
import { Wolf } from './animals/Wolf.js';
import { Elephant } from './animals/Elephant.js';
import { Lion } from './animals/Lion.js';
import { Bear } from './animals/Bear.js';
import { Tiger } from './animals/Tiger.js';
import { Deer } from './animals/Deer.js';
import { Giraffe } from './animals/Giraffe.js';
import { Fish } from './animals/Fish.js';
import { Turtle } from './animals/Turtle.js';
import { Duck } from './animals/Duck.js';
import { Monkey } from './animals/Monkey.js';
import { Squirrel } from './animals/Squirrel.js';
import { Reindeer } from './animals/Reindeer.js';
import { Arrow } from './Arrow.js';
import { BirdManager } from './Birds.js';
import { Dragon } from './Dragon.js';
import { MosquitoManager } from './Mosquitoes.js';
import { BatManager } from './Bats.js';
import { ButterflyManager } from './Butterflies.js';
import { Controls } from '../controls/Controls.js';
import { WorldGenerator } from '../world/WorldGenerator.js';
import { TextureLoader } from '../textures/TextureLoader.js';
import { Environment } from './Environment.js';
import { Studio } from './Studio.js';

export class VoxelGame {
    constructor() {
        this.container = document.getElementById('game-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB);
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
        this.blockData = new Map(); // Simple block type storage for collision/raycasting

        // Frustum for culling
        this.frustum = new THREE.Frustum();
        this.frustumMatrix = new THREE.Matrix4();

        // Textures - use TextureLoader module
        const textureLoader = new TextureLoader();
        textureLoader.loadTextures();
        this.textures = textureLoader.textures;
        this.materials = textureLoader.materialArray;
        this.materialArray = textureLoader.materialArray;
        this.blockMaterialIndices = textureLoader.blockMaterialIndices;

        // Physics
        this.gravity = 0.0064;

        // Sub-modules
        this.player = new Player(this);
        this.agent = new Agent(this);
        this.controls = new Controls(this);
        this.inventory = new Inventory(this);
        this.worldGen = new WorldGenerator(this);
        this.birdManager = new BirdManager(this, 5);
        this.mosquitoManager = new MosquitoManager(this, 15);
        this.batManager = new BatManager(this, 8);
        this.butterflyManager = new ButterflyManager(this, 30);
        this.environment = new Environment(this.scene, this);
        this.studio = new Studio(this);

        this.spawnPlayer();

        this.camera.position.copy(this.player.position);
        this.camera.position.y += 1.6; // Eye height

        // State
        this.selectedBlock = 'grass';
        this.selectedSlot = 0;
        this.inventoryOpen = false;

        // Raycaster for block interaction
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 6;

        // Highlight box
        this.highlightBox = this.createHighlightBox();
        this.scene.add(this.highlightBox);

        // FPS counter
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();

        // Initial chunk check
        this.checkChunks();
        this.updateChunks();
        this.updateBlockCount();

        // Spawn Animals
        this.animals = [];
        this.spawnAnimals();

        // Spawn Dragon
        this.dragon = null;
        this.spawnDragon();

        // Projectiles
        this.projectiles = [];

        // Start game loop
        this.lastTime = performance.now();
        this.animate();

        // Chat Button Listener
        const chatBtn = document.getElementById('chat-button');
        if (chatBtn) {
            chatBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent re-locking if that's an issue
                this.agent.toggleChat();
            });
        }
    }

    spawnPlayer() {
        let spawnX = 32;
        let spawnZ = 32;
        let spawnY = 0;
        let foundSafeSpot = false;
        let attempts = 0;

        // Try to find a spawn point on land that isn't a cave
        while (!foundSafeSpot && attempts < 100) {
            // Get surface height
            const terrainH = this.worldGen.getTerrainHeight(spawnX, spawnZ);

            // Check if above sea level
            if (terrainH > this.worldGen.seaLevel + 1) {
                // Check if the surface block is actually solid (not a cave opening)
                // We check a few blocks down to ensure we have a floor
                let solidBlockY = terrainH;
                let foundFloor = false;

                // Scan down from surface to find solid ground
                // Limit scan to 20 blocks to avoid falling into deep caves
                for (let y = terrainH; y > terrainH - 20; y--) {
                    if (!this.worldGen.isCave(spawnX, y, spawnZ)) {
                        solidBlockY = y;
                        foundFloor = true;
                        break;
                    }
                }

                if (foundFloor && solidBlockY > this.worldGen.seaLevel) {
                    spawnY = solidBlockY + 2; // Spawn 2 blocks above floor
                    foundSafeSpot = true;
                }
            }

            if (!foundSafeSpot) {
                // Try another spot nearby - spiral outwards
                const curRadius = 32 + Math.floor(attempts / 8) * 32;
                const angle = (attempts % 8) * (Math.PI / 4) + (Math.random() * 0.5);
                spawnX = 32 + Math.cos(angle) * curRadius;
                spawnZ = 32 + Math.sin(angle) * curRadius;
                attempts++;
            }
        }

        // Apply spawn position
        // If no land found, spawnY is calculated or fallback
        if (!foundSafeSpot) {
            spawnY = Math.max(this.worldGen.getTerrainHeight(spawnX, spawnZ) + 20, this.worldGen.seaLevel + 2);
        }

        this.spawnPoint = new THREE.Vector3(spawnX, spawnY, spawnZ);
        this.player.position.copy(this.spawnPoint);
        this.player.velocity.set(0, 0, 0);

        // Also update camera immediately so we don't flash at the wrong spot
        this.camera.position.copy(this.player.position);
        this.camera.position.y += 1.6;

        console.log(`Spawned at ${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)}`);
    }

    spawnAnimals() {
        const getSpawnY = (x, z) => this.worldGen.getTerrainHeight(x, z) + 1;
        const worldGen = this.worldGen;

        // Spread spawning: Check a grid of chunks around the player
        // Range: +/- 10 chunks (approx 160 blocks)
        const chunkRange = 6;
        const chunkSize = 16;
        const playerX = Math.floor(this.player.position.x);
        const playerZ = Math.floor(this.player.position.z);
        const centerCX = Math.floor(playerX / chunkSize);
        const centerCZ = Math.floor(playerZ / chunkSize);

        // Helper to spawn a pack
        const spawnPack = (AnimalClass, count, baseX, baseZ) => {
            for (let i = 0; i < count; i++) {
                // Random offset within ~10 blocks
                const x = baseX + (Math.random() - 0.5) * 10;
                const z = baseZ + (Math.random() - 0.5) * 10;
                const y = getSpawnY(x, z);

                // Don't spawn underwater unless it's aquatic
                // Check simple water logic (seaLevel)
                const isAquatic = (AnimalClass === Fish || AnimalClass === Turtle || AnimalClass === Duck);

                if (!isAquatic && y <= worldGen.seaLevel + 1) continue; // Skip land animals in water
                if (isAquatic && y > worldGen.seaLevel) {
                    // For fish, ensure they are IN water.
                    // The getSpawnY returns surface. For fish we might want lower.
                }

                if (AnimalClass === Fish) {
                    // Special logic for fish: find water depth
                    const terrainH = worldGen.getTerrainHeight(x, z);
                    if (terrainH < worldGen.seaLevel) {
                        const waterY = worldGen.seaLevel - 1 - Math.random() * (worldGen.seaLevel - terrainH);
                        const animal = new AnimalClass(this, x, waterY, z);
                        this.animals.push(animal);
                        this.scene.add(animal.mesh);
                    }
                } else if (AnimalClass === Monkey) {
                    // Monkeys in trees? Spawn high
                    const animal = new AnimalClass(this, x, y + 8, z);
                    this.animals.push(animal);
                    this.scene.add(animal.mesh);
                } else if (AnimalClass === BatManager || AnimalClass === BirdManager) {
                    // Handled by their managers usually, but if individual entities:
                    // (Assuming we are spawning Entity classes here)
                } else {
                    const animal = new AnimalClass(this, x, y, z);
                    this.animals.push(animal);
                    this.scene.add(animal.mesh);
                }
            }
        };

        const spawnedChunks = new Set(); // Prevent duplicates if we revisit

        for (let cx = centerCX - chunkRange; cx <= centerCX + chunkRange; cx++) {
            for (let cz = centerCZ - chunkRange; cz <= centerCZ + chunkRange; cz++) {
                // Randomly decide to spawn something in this chunk
                // Chance: 20% per chunk has a pack
                if (Math.random() > 0.2) continue;

                // Pick a random block in this chunk to sample biome
                const bx = cx * chunkSize + Math.floor(Math.random() * chunkSize);
                const bz = cz * chunkSize + Math.floor(Math.random() * chunkSize);
                const biome = worldGen.getBiome(bx, bz);

                // Determine what to spawn based on Biome
                if (biome === 'OCEAN') {
                    // Fish, Turtles
                    if (Math.random() < 0.5) spawnPack(Fish, 3 + Math.floor(Math.random() * 5), bx, bz);
                    else if (Math.random() < 0.2) spawnPack(Turtle, 1 + Math.floor(Math.random() * 2), bx, bz);
                }
                else if (biome === 'BEACH') {
                    // Turtles, Crabs(if exist), Ducks
                    if (Math.random() < 0.3) spawnPack(Turtle, 2, bx, bz);
                    if (Math.random() < 0.3) spawnPack(Duck, 3, bx, bz);
                }
                else if (biome === 'PLAINS') {
                    // Horses, Pigs, Chickens, Bunnies
                    const r = Math.random();
                    if (r < 0.3) spawnPack(Horse, 3 + Math.floor(Math.random() * 4), bx, bz);
                    else if (r < 0.5) spawnPack(Pig, 2 + Math.floor(Math.random() * 3), bx, bz);
                    else if (r < 0.7) spawnPack(Chicken, 4 + Math.floor(Math.random() * 4), bx, bz);
                    else spawnPack(Bunny, 3, bx, bz);
                }
                else if (biome === 'FOREST') {
                    // Wolf, Bear, Deer, Squirrel, Fox (if we had it)
                    const r = Math.random();
                    if (r < 0.25) spawnPack(Wolf, 3, bx, bz);
                    else if (r < 0.4) spawnPack(Bear, 1 + Math.floor(Math.random() * 2), bx, bz);
                    else if (r < 0.7) spawnPack(Deer, 2 + Math.floor(Math.random() * 3), bx, bz);
                    else spawnPack(Squirrel, 4, bx, bz);
                }
                else if (biome === 'JUNGLE') {
                    // Monkey, Tiger, Parrot (BirdManager handles birds? No, we might have Entity Parrot later. For now just Birds)
                    const r = Math.random();
                    if (r < 0.4) spawnPack(Monkey, 3 + Math.floor(Math.random() * 4), bx, bz);
                    else if (r < 0.6) spawnPack(Tiger, 1 + Math.floor(Math.random() * 2), bx, bz);
                    else spawnPack(Frog, 3, bx, bz); // Frogs like wet jungle
                }
                else if (biome === 'DESERT') {
                    // Bunny? We don't have Camels or Scorpions yet.
                    if (Math.random() < 0.3) spawnPack(Bunny, 2, bx, bz);
                }
                else if (biome === 'SNOW') {
                    // Reindeer, Polar Bear (Use Bear for now), Wolf
                    const r = Math.random();
                    if (r < 0.4) spawnPack(Reindeer, 4, bx, bz);
                    else if (r < 0.6) spawnPack(Bear, 1, bx, bz);
                    else spawnPack(Wolf, 3, bx, bz);
                }
                else if (biome === 'MOUNTAIN') {
                    // Goat? Reindeer?
                    if (Math.random() < 0.5) spawnPack(Reindeer, 3, bx, bz);
                }

                // Any biome: Rare spawns
                // Elephants (Savanna/Jungle mostly, but put rare here)
                if (Math.random() < 0.02) spawnPack(Elephant, 2, bx, bz);
                // Giraffes
                if (Math.random() < 0.02) spawnPack(Giraffe, 2, bx, bz);
                // Lion
                if (Math.random() < 0.02 && (biome === 'PLAINS' || biome === 'DESERT')) spawnPack(Lion, 2, bx, bz);
            }
        }
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
        this.selectedSlot = index;
        this.inventory.selectSlot(index);

        const slot = this.inventory.getSelectedItem();
        if (slot && slot.type === 'block') {
            this.selectedBlock = slot.item;
        } else {
            // If not a block (e.g. tool/food), we might still 'select' it for holding, but selectedBlock logic is for placing.
            // If we want to prevent placing non-blocks:
            this.selectedBlock = null;
        }

        // UI is handled by Inventory class now

        // Update visual model
        this.player.updateHeldItemVisibility();
    }

    toggleInventory() {
        this.inventoryOpen = !this.inventoryOpen;
        this.inventory.toggleInventory();
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

    setBlock(x, y, z, type, skipMeshUpdate = false) {
        const key = this.getBlockKey(x, y, z);
        const { cx, cy, cz, lx, ly, lz } = this.worldToChunk(x, y, z);

        if (type === null) {
            this.blockData.delete(key);
            const chunkKey = this.getChunkKey(cx, cy, cz);
            const chunk = this.chunks.get(chunkKey);
            if (chunk) {
                chunk.setBlock(lx, ly, lz, null);
                // Also mark neighboring chunks as dirty if on edge
                this.markNeighborsDirty(Math.floor(x), Math.floor(y), Math.floor(z));
            }
        } else {
            this.blockData.set(key, type);
            const chunk = this.getOrCreateChunk(cx, cy, cz);
            chunk.setBlock(lx, ly, lz, type);
            // Also mark neighboring chunks as dirty if on edge
            this.markNeighborsDirty(Math.floor(x), Math.floor(y), Math.floor(z));
        }

        if (!skipMeshUpdate) {
            this.updateChunks(); // Trigger mesh update for interactive changes
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
        const key = this.getBlockKey(x, y, z);
        return this.blockData.get(key) || null;
    }

    getBlock(x, y, z) {
        const key = this.getBlockKey(x, y, z);
        const type = this.blockData.get(key);
        return type ? { type } : null;
    }

    // Build all dirty chunk meshes
    updateChunks() {
        for (const chunk of this.chunks.values()) {
            if (chunk.dirty) {
                chunk.buildMesh();
            }
        }
    }

    checkChunks() {
        const playerChunk = this.worldToChunk(
            this.player.position.x,
            this.player.position.y,
            this.player.position.z
        );

        const { cx, cz } = playerChunk;

        let chunksGenerated = false;

        // Generate chunks around the player
        for (let x = cx - this.renderDistance; x <= cx + this.renderDistance; x++) {
            for (let z = cz - this.renderDistance; z <= cz + this.renderDistance; z++) {
                // For now, we only generate a fixed height of chunks (e.g., -4 to 8 for height -64 to 128)
                for (let y = -4; y < 8; y++) {
                    const funcKey = `${x},${y},${z}`;
                    if (!this.generatedChunks.has(funcKey)) {
                        this.worldGen.generateChunk(x, y, z);
                        this.generatedChunks.add(funcKey);
                        chunksGenerated = true;
                    }
                }
            }
        }

        if (chunksGenerated) {
            this.updateChunks();
            this.updateBlockCount();
        }
    }

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

    breakBlock() {
        // Trigger animation
        this.player.swingArm();

        // 1. Check for entity hits (Animals)
        const hitAnimal = this.getHitAnimal();
        if (hitAnimal) {
            // Calculate knockback direction (from player to animal)
            const direction = new THREE.Vector3()
                .subVectors(hitAnimal.position, this.player.position)
                .normalize();

            // Flatten direction (mostly horizontal knockback)
            direction.y = 0.2; // Slight lift
            direction.normalize();

            hitAnimal.takeDamage(1);
            hitAnimal.knockback(direction, 15); // Force 15

            // Visual/Audio feedback could go here
            return;
        }

        // 2. Break Block if no entity hit
        const target = this.getTargetBlock();
        if (target) {
            this.setBlock(target.x, target.y, target.z, null);
            this.updateBlockCount();
        }
    }

    getHitAnimal() {
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        // Shorter range for melee
        this.raycaster.far = 4.0;

        const animalMeshes = this.animals
            .filter(a => !a.isDead && !a.isDying) // Don't hit dead things
            .map(a => a.mesh);

        const intersects = this.raycaster.intersectObjects(animalMeshes, true); // Recursive true for groups

        if (intersects.length > 0) {
            // Find which animal owns this mesh
            const hitObject = intersects[0].object;
            // Traverse up to find the root group which matches animal.mesh
            // Or just search
            const hitRoot = this.findRootMesh(hitObject, animalMeshes);
            if (hitRoot) {
                return this.animals.find(a => a.mesh === hitRoot);
            }
        }

        // Reset far
        this.raycaster.far = 6;
        return null;
    }

    findRootMesh(obj, roots) {
        let curr = obj;
        while (curr) {
            if (roots.includes(curr)) return curr;
            curr = curr.parent;
        }
        return null;
    }

    placeBlock() {
        // Trigger animation
        this.player.swingArm();

        const target = this.getTargetBlock();
        if (target) {
            const newX = target.x + target.normal.x;
            const newY = target.y + target.normal.y;
            const newZ = target.z + target.normal.z;

            // Don't place inside player
            const playerBox = {
                minX: this.player.position.x - this.player.width / 2,
                maxX: this.player.position.x + this.player.width / 2,
                minY: this.player.position.y,
                maxY: this.player.position.y + this.player.height,
                minZ: this.player.position.z - this.player.width / 2,
                maxZ: this.player.position.z + this.player.width / 2
            };

            const blockBox = {
                minX: newX, maxX: newX + 1,
                minY: newY, maxY: newY + 1,
                minZ: newZ, maxZ: newZ + 1
            };

            const collision = !(playerBox.maxX < blockBox.minX || playerBox.minX > blockBox.maxX ||
                playerBox.maxY < blockBox.minY || playerBox.minY > blockBox.maxY ||
                playerBox.maxZ < blockBox.minZ || playerBox.minZ > blockBox.maxZ);

            if (!collision && !this.getBlock(newX, newY, newZ)) {
                this.setBlock(newX, newY, newZ, this.selectedBlock);
                this.updateBlockCount();
            }
        }
    }

    getTargetBlock() {
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

        // Raycast against chunk meshes
        const chunkMeshes = [];
        for (const chunk of this.chunks.values()) {
            if (chunk.mesh && chunk.mesh.visible) {
                chunkMeshes.push(chunk.mesh);
            }
        }

        const intersects = this.raycaster.intersectObjects(chunkMeshes);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const point = hit.point;
            const normal = hit.face.normal;

            // Calculate which block was hit by moving slightly into the block
            const blockX = Math.floor(point.x - normal.x * 0.01);
            const blockY = Math.floor(point.y - normal.y * 0.01);
            const blockZ = Math.floor(point.z - normal.z * 0.01);

            // Verify there's actually a block there
            if (this.getBlock(blockX, blockY, blockZ)) {
                return {
                    x: blockX,
                    y: blockY,
                    z: blockZ,
                    normal: { x: Math.round(normal.x), y: Math.round(normal.y), z: Math.round(normal.z) }
                };
            }
        }

        return null;
    }

    updateBlockCount() {
        document.getElementById('block-count').textContent = this.blockData.size;
    }

    updateHighlight() {
        const target = this.getTargetBlock();
        if (target) {
            this.highlightBox.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
            this.highlightBox.visible = true;
        } else {
            this.highlightBox.visible = false;
        }
    }

    updateDebug() {
        const pos = this.player.position;
        document.getElementById('position').textContent =
            `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;

        // FPS calculation
        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFpsUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = now;
            const fpsElement = document.getElementById('fps');
            const fpsCounter = document.getElementById('fps-counter');
            fpsElement.textContent = this.fps;

            // Color code based on FPS
            fpsCounter.classList.remove('low', 'medium');
            if (this.fps < 30) {
                fpsCounter.classList.add('low');
            } else if (this.fps < 50) {
                fpsCounter.classList.add('medium');
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1000;
        this.lastTime = now;

        if (this.controls.isLocked) {
            this.player.update(this.controls.keys, deltaTime);
            this.checkChunks();
            this.updateHighlight();
        }
        this.agent.update(this.lastTime / 1000, this.player);
        if (this.studio) this.studio.update(deltaTime);

        // Update animals
        this.animals.forEach(animal => animal.update(deltaTime));

        // Remove dead animals
        for (let i = this.animals.length - 1; i >= 0; i--) {
            if (this.animals[i].isDead) {
                this.scene.remove(this.animals[i].mesh);
                this.animals.splice(i, 1);
            }
        }

        // Update Dragon
        if (this.dragon) {
            this.dragon.update(deltaTime, this.player);
        }

        this.birdManager.update(deltaTime, this.player);
        this.mosquitoManager.update(deltaTime, this.player);
        this.batManager.update(deltaTime, this.player, this.animals);
        this.butterflyManager.update(deltaTime, this.player);

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
        this.environment.updateDayNightCycle(deltaTime, this.player.position);

        this.updateDebug();
        this.renderer.render(this.scene, this.camera);
    }
}
