import * as THREE from 'three';
import { Chunk } from '../world/Chunk.js';
import '../styles/profiler.css';
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
import { GiantTreeProjectile } from './entities/projectiles/GiantTreeProjectile.js';

import { GrowthProjectile } from './entities/projectiles/GrowthProjectile.js';
import { FloatingBlock } from './entities/FloatingBlock.js';
import { ControllableBlock } from './entities/ControllableBlock.js';
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
import { AnimalClasses } from './AnimalRegistry.js';
import { Merlin } from './entities/animals/Merlin.js';
import { Xbox } from './entities/furniture/Xbox.js';
import { Starfighter } from './entities/animals/Starfighter.js';

import { SurvivalGameManager } from './systems/SurvivalGameManager.js';
import { MazeManager } from './systems/MazeManager.js';
import { ParkourManager } from './systems/ParkourManager.js';
import { PlaygroundManager } from './systems/PlaygroundManager.js';
import { DiscoRoomManager } from './systems/DiscoRoomManager.js';
import { DestinationManager } from './systems/DestinationManager.js';
import { SpaceShipManager } from './systems/SpaceShipManager.js';
import { SpaceStationManager } from './systems/SpaceStationManager.js';
import { QuestSystem } from './systems/QuestSystem.js';

// Visual Improvements: Post-Processing
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GrassSystem } from './systems/GrassSystem.js';
import { ProfilerTestScene } from './systems/ProfilerTestScene.js';

import { ThreePerf } from 'three-perf';

import { VerificationUtils } from './utils/VerificationUtils.js';
import { AnalyticsManager } from './systems/AnalyticsManager.js';
import Stats from 'three/addons/libs/stats.module.js';

// Antigravity was here.
export class VoxelGame {
    constructor() {
        // Expose game globally for HMR to update existing creatures
        window.__VOXEL_GAME__ = this;
        // Expose THREE.js globally for patch_entity runtime code injection
        window.THREE = THREE;
        // Expose Verification Utils for CLI testing
        window.VerificationUtils = VerificationUtils;

        this.container = document.getElementById('game-container');
        this.clock = new THREE.Clock();
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        // PERFORMANCE: Limit pixel ratio to 1.5 max (prevents 4x rendering on retina)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x4682B4); // Steel blue
        this.renderer.shadowMap.enabled = true;
        // PERFORMANCE: Use PCFShadowMap (middle ground between quality and performance)
        this.renderer.shadowMap.type = THREE.PCFShadowMap;

        // Performance Stats
        this.stats = new Stats();
        this.stats.dom.style.display = 'none'; // Hidden by default
        document.body.appendChild(this.stats.dom);




        // In-Depth Profiler (three-perf)
        this.perf = new ThreePerf({
            anchorX: 'left',
            anchorY: 'top',
            domElement: document.body, // attach to body to be on top of UI
            renderer: this.renderer,
            scale: 1, // Scaling factor
        });
        // Default to hidden, toggled by DebugPanel
        this.perf.visible = false;

        // Visual Improvements: Tone Mapping
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.container.appendChild(this.renderer.domElement);

        // Visual Improvements: Post-Processing (Bloom)
        // NOTE: Bloom is disabled for now as it washes out sky colors.
        // To re-enable, uncomment the bloom pass below.
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // Bloom pass disabled - was washing out sky
        // const bloomPass = new UnrealBloomPass(
        //     new THREE.Vector2(window.innerWidth, window.innerHeight),
        //     0.15,  // Strength
        //     0.3,   // Radius
        //     0.95   // Threshold
        // );
        // this.composer.addPass(bloomPass);
        // this.bloomPass = bloomPass;

        // Essential for children of camera to be visible
        this.scene.add(this.camera);

        // Voice Chat: Audio Listener for spatial audio
        this.audioListener = new THREE.AudioListener();
        this.camera.add(this.audioListener);

        // Check for bare-bones mode via URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        this.isBareBones = urlParams.get('bare-bones') === 'true';
        this.isOffline = urlParams.get('offline') === 'true';
        this.isCLI = urlParams.get('cli') === 'true';

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

        // Warp ID Check (store for after init)
        this.warpId = urlParams.get('warp');

        // World data - chunk based
        this.chunks = new Map();
        this.persistedBlocks = new Map(); // Stores blocks from server that arrive before chunks are generated
        this.chunkSize = Config.WORLD.CHUNK_SIZE;
        this.renderDistance = Config.WORLD.RENDER_DISTANCE;
        this.terrainVisible = true; // Default visibility
        this.terrainShadowsEnabled = true; // Default receive shadow state
        this.terrainCastShadows = false; // PERFORMANCE: Default cast shadow to false
        this.shadowsAutoDisabled = false; // Track if shadows were auto-disabled due to low FPS
        this.autoShadowManagement = true; // Enable automatic shadow management based on FPS
        this.generatedChunks = new Set();
        this.protectedChunks = new Set(); // Chunks that should never be unloaded (e.g., starship)
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

        // Thruster Data (Map<"x,y,z", direction_int>)
        this.thrusterData = new Map();

        // Sign Data and Meshes
        this.signData = new Map();
        this.signMeshes = new Map();

        // Ships
        this.ships = [];

        // Physics
        this.gravity = Config.WORLD.GRAVITY;
        this.gravityMultiplier = 1.0; // World-specific gravity multiplier (set from world settings)

        // Game State (Centralized)
        this.gameState = new GameState(this);

        // Debug Flags (Initialize BEFORE UIManager) - Now in GameState

        // Sub-modules
        this.inputManager = new InputManager(this); // Replaces controls
        this.controls = this.inputManager;

        this.analyticsManager = new AnalyticsManager(this);
        this.uiManager = new UIManager(this);
        this.inventoryManager = new InventoryManager(this);
        this.itemManager = new ItemManager(this);
        this.inventory = new Inventory(this, this.inventoryManager); // Inventory is now UI
        this.player = new Player(this);
        this.agent = new Agent(this);
        // Initialize world seed - use a fixed hardcoded seed so everyone sees the same world
        this.worldSeed = 1337; // Fixed seed for consistency
        console.log('[Game] using hardcoded world seed:', this.worldSeed);

        this.worldGen = new WorldGenerator(this);
        // Set the seed immediately after creation for consistent world generation
        this.worldGen.setSeed(this.worldSeed);
        this.entityManager = new EntityManager(this);
        this.weatherSystem = new WeatherSystem(this);
        this.environment = new Environment(this.scene, this);
        this.grassSystem = new GrassSystem(this);

        this.creaturesVisible = true;
        this.villagersVisible = true;
        this.spaceshipsVisible = true;
        this.waterVisible = true;
        this.plantsVisible = true;
        this.buildingsVisible = true;

        // Granular visibility control
        this.allowedAnimalTypes = new Set(Object.keys(AnimalClasses));

        this.animals = [];
        this.spawnManager = new SpawnManager(this);
        this.worldParticleSystem = new WorldParticleSystem(this);
        this.soundManager = new SoundManager(this);
        this.soundManager.init();
        this.spellSystem = new SpellSystem(this);
        this.waterSystem = new WaterSystem(this);
        this.survivalGameManager = new SurvivalGameManager(this);
        this.AnimalClasses = AnimalClasses;
        this.parkourManager = new ParkourManager(this);
        this.questSystem = new QuestSystem(this);
        this.profilerTestScene = new ProfilerTestScene(this);
        this.updateTimeStop = (dt) => {
            if (this.gameState?.timers?.timeStop > 0) {
                this.gameState.timers.timeStop -= dt;
                if (this.gameState.timers.timeStop <= 0) {
                    this.gameState.timers.timeStop = 0;
                    this.gameState.flags.isTimeStopped = false;
                    console.log("Time resumed!");
                }
            }
        };
        this.startTimeStop = (duration) => {
            this.gameState.timers.timeStop = duration;
            this.gameState.flags.isTimeStopped = true;
            console.log("Time stopped for", duration, "seconds!");
        };

        this.spawnGiantTreeProjectile = (position, velocity) => {
            const proj = new GiantTreeProjectile(this, position, velocity);
            if (!this.projectiles) this.projectiles = [];
            this.projectiles.push(proj);
        };

        // Initial Giant Trees!
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const dist = 20 + Math.random() * 10;
            const tx = this.player.position.x + Math.cos(angle) * dist;
            const tz = this.player.position.z + Math.sin(angle) * dist;
            const ty = this.worldGen.getTerrainHeight(tx, tz);
            const proj = new GiantTreeProjectile(this, new THREE.Vector3(tx, ty + 10, tz), new THREE.Vector3(0, -1, 0));
            if (!this.projectiles) this.projectiles = [];
            this.projectiles.push(proj);
        }



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

        // Multiplayer logic - check for username first
        this.checkAndPromptUsername().then(() => {
            this.socketManager = new SocketManager(this);
        });


        // Agent debug command handler
        if (this.agent.setupDebugCommandHandler) {
            this.agent.setupDebugCommandHandler();
        }

        // Add daytime switch hotkey (K) and store hotkey (B)
        window.addEventListener('keydown', (e) => {

            // Block hotkeys when typing in chat input
            const chatInput = document.getElementById('chat-input');
            if (chatInput && document.activeElement === chatInput) return;

            if (e.key.toLowerCase() === 'k' && !this.gameState.flags.inventoryOpen && !(this.agent && this.agent.isChatOpen)) {
                this.setDaytime();
            }
            if (e.key.toLowerCase() === 'b' && !this.gameState.flags.inventoryOpen && !(this.agent && this.agent.isChatOpen)) {
                this.uiManager.openSettings();
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
        this.merlin = null; // Merlin wizard companion

        // Projectiles
        this.projectiles = [];

        // Drops
        this.drops = [];

        // Shrunk Blocks
        this.shrunkBlocks = [];

        // Floating Blocks
        this.floatingBlocks = [];
        this.targetedFloatingBlocks = [];

        // Controllable Blocks
        this.controllableBlocks = [];


        // Tornadoes
        this.tornadoes = [];

        // Start game loop
        this.lastTime = performance.now();
        this.processChunkQueue();

        // Wrap animate to include perf
        this.animate();

        // Add the new wand to the inventory for testing
        // Test items removed to respect InventoryManager.setupInitialItems layout



        // Chat Button Listener & Debug Panel handled by UIManager/InputManager now

        // Initialize Store UI (handles auth button click to open auth modal)
        this.storeUI = new StoreUI(this);

        // Initialize persisted blocks storage
        this.persistedBlocks = new Map(); // key: chunkKey, value: Array<{lx, ly, lz, type}>

        // Sign Data (text)
        this.signData = new Map(); // key: "x,y,z", value: text
        this.signMeshes = new Map(); // key: "x,y,z", value: THREE.Mesh (text mesh)



        // Maze Manager
        this.mazeManager = new MazeManager(this);

        // Playground Manager
        this.playgroundManager = new PlaygroundManager(this);

        // Disco Room Manager
        this.discoRoomManager = new DiscoRoomManager(this);

        // Destination Manager
        this.destinationManager = new DestinationManager(this);

        // Spaceship Manager
        this.spaceShipManager = new SpaceShipManager(this);

        // Space Station Manager (Ring Station)
        this.spaceStationManager = new SpaceStationManager(this);

        // Handle initial warp if present (give it a moment for things to settle?)
        if (this.warpId) {
            // Defer slightly to ensure player/world is ready
            setTimeout(() => {
                this.destinationManager.handleWarp(this.warpId);
            }, 1000);
        }

        // Auto-Spawn Enterprise in High Orbit
        // Position the ship above spawn point, visible when looking up
        // Spawn at y=120 so ship center (~160) stays within render distance of ground players
        if (!this.isUIOnly && !this.isBareBones) {
            const spawnPos = new THREE.Vector3(
                Config.PLAYER.SPAWN_POINT.x,
                120, // Lower height to stay within render distance of ground players
                Config.PLAYER.SPAWN_POINT.z
            );
            this.spaceShipManager.spawnShip(spawnPos);


        }

        // Handle Window Resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            // Also update composer if it exists
            if (this.composer) {
                this.composer.setSize(window.innerWidth, window.innerHeight);
            }
        });
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

    toggleGrass(visible) {
        if (this.grassSystem) {
            this.grassSystem.setVisible(visible);
        }
    }

    toggleCreatures(visible) {
        this.creaturesVisible = visible;
        this.updateEntityVisibility();
    }

    toggleVillagers(visible) {
        this.villagersVisible = visible;
        this.updateEntityVisibility();
    }

    toggleSpaceships(visible) {
        this.spaceshipsVisible = visible;
        this.updateEntityVisibility();
    }

    toggleAnimalVisibility(type, visible) {
        if (visible) {
            this.allowedAnimalTypes.add(type);
        } else {
            this.allowedAnimalTypes.delete(type);
        }
        this.updateEntityVisibility();
    }

    updateEntityVisibility() {
        if (!this.animals) return;

        for (const animal of this.animals) {
            const type = animal.constructor.name;

            // 1. Check global category switch
            let categoryVisible = true;
            if (type === 'Villager') categoryVisible = this.villagersVisible;
            else if (type === 'Spaceship') categoryVisible = this.spaceshipsVisible;
            else categoryVisible = this.creaturesVisible; // default category

            // 2. Check granular switch
            const specificVisible = this.allowedAnimalTypes.has(type);

            const visible = categoryVisible && specificVisible;

            // Handle both mesh and group (some entities like Butterflies, Pixies use group)
            if (animal.mesh) {
                animal.mesh.visible = visible;
            }
            if (animal.group) {
                animal.group.visible = visible;
            }
        }

        // Handle special entities not in animals array
        // Dragon is stored separately
        if (this.dragon && this.dragon.mesh) {
            this.dragon.mesh.visible = this.creaturesVisible;
        }

        // BirdManager and MosquitoManager are in entityManager
        if (this.entityManager) {
            if (this.entityManager.birdManager && this.entityManager.birdManager.birdGroup) {
                this.entityManager.birdManager.birdGroup.visible = this.creaturesVisible;
            }
            if (this.entityManager.mosquitoManager && this.entityManager.mosquitoManager.mosquitoGroup) {
                this.entityManager.mosquitoManager.mosquitoGroup.visible = this.creaturesVisible;
            }
        }
    }

    setDaytime() {
        if (this.socketManager && this.socketManager.isConnected()) {
            this.socketManager.sendSetTime(0.25); // Noon
            // this.uiManager?.addChatMessage('system', 'Requesting daytime sync...');
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
     * Poll for game state inspection code (eval)
     * CAUTION: Only for development use!
     */


    /**
     * Check if username is set, prompt if not
     */
    async checkAndPromptUsername() {
        const existingName = localStorage.getItem('communityUsername');
        if (existingName) {
            console.log('[Game] Username already set:', existingName);
            return;
        }

        // Skip prompt in CLI mode - auto-generate a name
        if (this.isCLI) {
            const autoName = `CLI_Player_${Date.now().toString(36).slice(-4)}`;
            localStorage.setItem('communityUsername', autoName);
            console.log('[Game] CLI mode - auto-generated username:', autoName);
            return;
        }

        // Check if name prompt is disabled in settings (default: disabled)
        const showNamePrompt = localStorage.getItem('settings_show_name_prompt') === 'true';
        if (!showNamePrompt) {
            // Auto-generate a name silently
            const autoName = `Player_${Date.now().toString(36).slice(-4)}`;
            localStorage.setItem('communityUsername', autoName);
            console.log('[Game] Name prompt disabled - auto-generated username:', autoName);
            return;
        }

        console.log('[Game] No username set, showing prompt...');
        return new Promise((resolve) => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.id = 'username-prompt-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.85);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: linear-gradient(145deg, #1a1b1e, #2d2f36);
                border-radius: 12px;
                padding: 32px;
                max-width: 420px;
                width: 90%;
                box-shadow: 0 8px 32px rgba(0,0,0,0.6);
                font-family: 'Segoe UI', system-ui, sans-serif;
                color: white;
                text-align: center;
            `;

            modal.innerHTML = `
                <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600;">👋 Welcome!</h2>
                <p style="margin: 0 0 24px 0; color: #b9bbbe; font-size: 14px;">
                    Enter your name for multiplayer. This will appear above your head and in chat.
                </p>
                <input type="text" id="username-prompt-input" 
                    placeholder="Enter your name..."
                    maxlength="20"
                    style="
                        width: 100%;
                        box-sizing: border-box;
                        padding: 14px 16px;
                        border: 2px solid #5865f2;
                        border-radius: 8px;
                        background: rgba(0,0,0,0.3);
                        color: white;
                        font-size: 16px;
                        outline: none;
                        margin-bottom: 20px;
                    "
                />
                <button id="username-prompt-submit" style="
                    width: 100%;
                    padding: 14px;
                    background: linear-gradient(135deg, #5865f2, #7289da);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.1s, box-shadow 0.2s;
                ">
                    Start Playing
                </button>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const input = modal.querySelector('#username-prompt-input');
            const submitBtn = modal.querySelector('#username-prompt-submit');

            // Focus input after brief delay for transition
            setTimeout(() => input.focus(), 100);

            const submit = () => {
                const name = input.value.trim() || `Player_${Date.now().toString(36).slice(-4)}`;
                localStorage.setItem('communityUsername', name);
                console.log('[Game] Username set to:', name);
                overlay.remove();
                resolve();
            };

            submitBtn.onclick = submit;
            input.onkeydown = (e) => {
                if (e.key === 'Enter') submit();
            };

            // Button hover effects
            submitBtn.onmouseover = () => {
                submitBtn.style.transform = 'scale(1.02)';
                submitBtn.style.boxShadow = '0 4px 16px rgba(88, 101, 242, 0.4)';
            };
            submitBtn.onmouseout = () => {
                submitBtn.style.transform = 'scale(1)';
                submitBtn.style.boxShadow = 'none';
            };
        });
    }


    spawnPlayer() {
        const spawnPoint = Config.PLAYER.SPAWN_POINT;

        // Spawn at the default spawn point
        let finalX = spawnPoint.x;
        let finalZ = spawnPoint.z;
        const minPlayerDistance = 2.0;

        // Check if we have remote players nearby and need to offset spawn position
        if (this.socketManager && this.socketManager.playerMeshes) {
            const nearbyPlayers = [];

            this.socketManager.playerMeshes.forEach((meshInfo) => {
                if (meshInfo.group) {
                    nearbyPlayers.push({
                        x: meshInfo.group.position.x,
                        z: meshInfo.group.position.z
                    });
                }
            });

            const isPositionClear = (x, z) => {
                for (const player of nearbyPlayers) {
                    const dx = x - player.x;
                    const dz = z - player.z;
                    if (Math.sqrt(dx * dx + dz * dz) < minPlayerDistance) {
                        return false;
                    }
                }
                return true;
            };

            if (!isPositionClear(finalX, finalZ)) {
                const offsets = [
                    [2, 0], [0, 2], [-2, 0], [0, -2],
                    [2, 2], [-2, 2], [-2, -2], [2, -2]
                ];
                for (const [ox, oz] of offsets) {
                    if (isPositionClear(finalX + ox, finalZ + oz)) {
                        finalX += ox;
                        finalZ += oz;
                        break;
                    }
                }
            }
        }

        // Find ground level (avoids spawning on trees)
        const terrainHeight = this.worldGen.getTerrainHeight(finalX, finalZ);
        let finalY = terrainHeight + 1;

        if (this.spawnManager) {
            const groundY = this.spawnManager.findGroundLevel(finalX, terrainHeight + 5, finalZ);
            if (groundY !== null) {
                finalY = groundY;
            }
        }

        console.log(`[Game] Spawning player on ground at: ${finalX}, ${finalY}, ${finalZ}`);

        this.spawnPoint = new THREE.Vector3(finalX, finalY, finalZ);
        this.player.position.copy(this.spawnPoint);
        this.player.velocity.set(0, 0, 0);

        // Reset fall damage trackers
        this.player.highestY = finalY;
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

    /**
     * Spawn the Merlin wizard companion near the player
     */
    spawnMerlin() {
        // Spawn behind and to the side of the player
        const x = this.player.position.x - 2;
        const y = this.player.position.y + 0.5;
        const z = this.player.position.z - 2;

        const seed = 42; // Fixed seed for consistent appearance
        this.merlin = new Merlin(this, x, y, z, seed);
        this.scene.add(this.merlin.mesh);
        this.animals.push(this.merlin);

        // Connect to MerlinClient for speech bubbles
        if (window.merlinClient) {
            window.merlinClient.entity = this.merlin;
        }

        console.log('[Game] Merlin spawned near player');
    }

    /**
     * Spawn the player's spaceship (Millennium Falcon) near spawn point
     */
    spawnPlayerShip() {
        // Spawn to the right and slightly in front of player spawn
        const x = this.player.position.x + 8;
        const z = this.player.position.z + 5;
        const y = this.worldGen.getTerrainHeight(x, z) + 2;

        const seed = 12345; // Fixed seed for consistent appearance
        this.playerShip = new Starfighter(this, x, y, z, seed);
        this.scene.add(this.playerShip.mesh);
        this.animals.push(this.playerShip);

        console.log('[Game] Player spaceship (Starfighter) spawned near player');
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

        // Reset FOV if not holding binoculars
        // We check if the selected item is binoculars. If not, reset FOV.
        const isBinoculars = slot && slot.item === 'binoculars';
        if (!isBinoculars && this.camera.fov !== 75) {
            this.camera.fov = 75;
            this.camera.updateProjectionMatrix();
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

    getWorldHeight(x, z) {
        if (this.worldGen) return this.worldGen.getTerrainHeight(x, z);
        return 0;
    }

    onRightClickDown() {
        let target = this.physicsManager.getTargetBlock();

        // Special: Xbox Placement/Usage
        const heldItem = this.inventory.getSelectedItem();
        if (heldItem && heldItem.item === 'xbox') {
            if (target) {
                // Place Xbox Entity
                const bx = target.x + target.normal.x;
                const by = target.y + target.normal.y;
                const bz = target.z + target.normal.z;

                const xbox = new Xbox(this, bx + 0.5, by, bz + 0.5);
                this.scene.add(xbox.mesh);
                this.animals.push(xbox);

                this.inventoryManager.removeItem(this.inventoryManager.selectedSlot, 1);
                return;
            } else {
                // Open UI
                this.uiManager.showXboxUI();
                return;
            }
        }

        if (target) {
            const blockType = this.getBlockWorld(target.x, target.y, target.z);
            if (blockType === Blocks.XBOX) {
                this.uiManager.showXboxUI();
                return;
            }
        }
        // 1. Entity Interaction (Mounting)
        const hitAnimal = this.physicsManager.getHitAnimal();
        if (hitAnimal && hitAnimal.handleRiding) {
            this.player.mountEntity(hitAnimal);
            return;
        }

        // 2. Check for Block Interaction (Doors, Signs, Survival Block)
        target = this.physicsManager.getTargetBlock();
        if (target) {
            // Escape Room Game Interaction first?
            if (this.spaceShipManager && this.spaceShipManager.handleBlockInteraction(target.x, target.y, target.z)) {
                return true;
            }

            if (this.spaceStationManager && this.spaceStationManager.handleBlockInteraction(target.x, target.y, target.z)) {
                return true;
            }



            const block = this.getBlockWorld(target.x, target.y, target.z);
            if (block === Blocks.DOOR_CLOSED) {
                this.setBlock(target.x, target.y, target.z, Blocks.DOOR_OPEN);
                this.soundManager.playSound('click'); // consistent feedback
                return true; // Handled
            } else if (block === Blocks.DOOR_OPEN) {
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
            } else if (block === Blocks.SURVIVAL_BLOCK || block === Blocks.MOB_WAVES_BLOCK) {
                // Start survival mini-game
                if (this.survivalGameManager && !this.survivalGameManager.isActive) {
                    this.survivalGameManager.start();
                    this.soundManager.playSound('click');
                }
                return true;
            } else if (block === Blocks.MAZE_BLOCK) {
                // Generate Maze
                this.mazeManager.generateMaze(this.player.position);
                this.soundManager.playSound('click');
                return true;

            } else if (block === Blocks.PARKOUR_BLOCK) {
                // Start Parkour
                if (this.parkourManager && !this.parkourManager.isActive) {
                    this.parkourManager.start(new THREE.Vector3(target.x, target.y, target.z));
                    this.soundManager.playSound('click');
                }
                return true;
            } else if (block === Blocks.PLAYGROUND_BLOCK) {
                // Spawn Playground
                if (this.playgroundManager) {
                    this.playgroundManager.spawnPlayground(new THREE.Vector3(target.x, target.y, target.z));
                    this.soundManager.playSound('click');
                }
                return true;
            } else if (block === Blocks.DISCO_ROOM_BLOCK) {
                // Spawn Disco Room
                if (this.discoRoomManager) {
                    this.discoRoomManager.spawnDiscoRoom(new THREE.Vector3(target.x, target.y, target.z));
                    this.soundManager.playSound('click');
                }
                return true;
            }
        }
        // 3. Item Use
        const selectedItem = this.inventory.getSelectedItem();
        if (selectedItem && selectedItem.item) {
            const handled = this.itemManager.handleItemDown(selectedItem.item);
            if (handled) return;
        }

        // 4. Block Placement
        // Reuse 'target' from block interaction check if it exists
        if (target && selectedItem && selectedItem.type === 'block') {
            const bx = target.x + target.normal.x;
            const by = target.y + target.normal.y;
            const bz = target.z + target.normal.z;

            // Check if we're placing adjacent to a controllable block - attach it instead
            let attachedToVehicle = false;
            if (this.controllableBlocks) {
                for (const cb of this.controllableBlocks) {
                    if (cb.isDead) continue;

                    const attachOffset = cb.getAttachmentOffset(bx, by, bz);
                    if (attachOffset) {
                        // Attach to the controllable block instead of placing in world
                        cb.attachBlock(attachOffset, selectedItem.item);
                        this.inventoryManager.removeItem(this.inventoryManager.selectedSlot, 1);
                        attachedToVehicle = true;
                        break;
                    }
                }
            }

            if (!attachedToVehicle) {
                // Normal block placement
                this.setBlock(bx, by, bz, selectedItem.item);
                this.analyticsManager.logBlockPlace(selectedItem.item, bx, by, bz);
                this.inventoryManager.removeItem(this.inventoryManager.selectedSlot, 1);

                // Handle Destination Block Placement
                if (selectedItem.item === Blocks.DESTINATION_BLOCK) {
                    this.destinationManager.createDestination(bx, by, bz).then(id => {
                        if (id) {
                            const url = window.location.origin + '?warp=' + id;
                            this.uiManager.addChatMessage('system', 'Destination created!');
                            this.uiManager.addChatMessage('system', 'Share this URL: ' + url);
                            // Also copy to clipboard if possible
                            navigator.clipboard.writeText(url).then(() => {
                                this.uiManager.addChatMessage('system', '(Copied to clipboard)');
                            }).catch(() => { });
                        } else {
                            this.uiManager.addChatMessage('system', 'Failed to create destination.');
                        }
                    });
                }
            }
        }
    }

    onRightClickUp() {
        const item = this.inventory.getSelectedItem();
        if (item && item.item) {
            const handled = this.itemManager.handleItemUp(item.item);
            if (handled) return true;
        }
        return false;
    }

    /**
     * Generic projectile spawner
     * @param {Class} ProjectileClass - The projectile class to instantiate
     * @param {THREE.Vector3} pos - Starting position
     * @param {THREE.Vector3} vel - Initial velocity
     * @param {...any} extraArgs - Additional constructor arguments
     * @returns {Object} - The spawned projectile
     */
    spawnProjectile(ProjectileClass, pos, vel, ...extraArgs) {
        const projectile = new ProjectileClass(this, pos, vel, ...extraArgs);
        this.projectiles.push(projectile);
        this.scene.add(projectile.mesh);
        return projectile;
    }

    spawnArrow(pos, vel, owner = null, isRemote = false) {
        const projectile = this.spawnProjectile(Arrow, pos, vel, owner || this.player, isRemote);

        // Broadcast to other players (unless this is a remote spawn)
        if (!isRemote && this.socketManager?.isConnected()) {
            this.socketManager.sendProjectileSpawn('arrow', pos, vel);
        }

        return projectile;
    }

    spawnMagicProjectile(pos, vel, skipBroadcast = false) {
        const projectile = this.spawnProjectile(MagicProjectile, pos, vel);

        // Broadcast to other players
        if (!skipBroadcast && this.socketManager?.isConnected()) {
            this.socketManager.sendProjectileSpawn('magic', pos, vel);
        }

        return projectile;
    }

    spawnShrinkProjectile(pos, vel, skipBroadcast = false) {
        const projectile = this.spawnProjectile(ShrinkProjectile, pos, vel);

        if (!skipBroadcast && this.socketManager?.isConnected()) {
            this.socketManager.sendProjectileSpawn('shrink', pos, vel);
        }

        return projectile;
    }

    spawnLevitationProjectile(pos, vel, skipBroadcast = false) {
        const projectile = this.spawnProjectile(LevitationProjectile, pos, vel);

        if (!skipBroadcast && this.socketManager?.isConnected()) {
            this.socketManager.sendProjectileSpawn('levitation', pos, vel);
        }

        return projectile;
    }

    spawnGiantProjectile(pos, vel, skipBroadcast = false) {
        const projectile = this.spawnProjectile(GiantProjectile, pos, vel);

        if (!skipBroadcast && this.socketManager?.isConnected()) {
            this.socketManager.sendProjectileSpawn('giant', pos, vel);
        }

        return projectile;
    }

    spawnWizardTowerProjectile(pos, vel) {
        return this.spawnProjectile(WizardTowerProjectile, pos, vel);
    }

    spawnGrowthProjectile(pos, vel, skipBroadcast = false) {
        const projectile = this.spawnProjectile(GrowthProjectile, pos, vel);

        if (!skipBroadcast && this.socketManager?.isConnected()) {
            this.socketManager.sendProjectileSpawn('growth', pos, vel);
        }

        return projectile;
    }

    spawnOmniProjectile(pos, vel, effects) {
        return this.spawnProjectile(OmniProjectile, pos, vel, effects);
    }

    spawnTornado(pos) {
        const tornado = new Tornado(this, pos);
        this.tornadoes.push(tornado);
        console.log('Tornado spawned!');
    }

    /**
     * Spawn a controllable block at the given position
     * @param {number} x - World X position
     * @param {number} y - World Y position
     * @param {number} z - World Z position
     * @param {string} blockType - Block type for visual appearance
     * @returns {ControllableBlock} The spawned block
     */
    spawnControllableBlock(x, y, z, blockType = 'iron_block') {
        const cb = new ControllableBlock(this, x, y, z, blockType);
        console.log(`[VoxelGame] Spawned controllable block at (${x}, ${y}, ${z})`);
        return cb;
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

    /**
     * Check if any trees above/around position are now unsupported and should fall.
     * Called after blocks are destroyed by explosions/projectiles.
     * Handles single-block-wide trees (1 base log) and 4-block-wide trees (2x2 base).
     */
    checkTreeStability(destroyedPositions) {
        const logTypes = [
            Blocks.LOG, Blocks.PINE_WOOD, Blocks.BIRCH_WOOD,
            Blocks.DARK_OAK_WOOD, Blocks.WILLOW_WOOD, Blocks.ACACIA_WOOD
        ];

        // Track which positions we've already checked to avoid duplicates
        const checkedBases = new Set();

        for (const pos of destroyedPositions) {
            // Check log blocks above and around the destroyed position
            for (let dy = 0; dy <= 2; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        const checkX = pos.x + dx;
                        const checkY = pos.y + dy;
                        const checkZ = pos.z + dz;

                        const blockType = this.getBlockWorld(checkX, checkY, checkZ);
                        if (!blockType || !logTypes.includes(blockType)) continue;

                        // Found a log - trace down to find its base
                        const base = this.findTreeBase(checkX, checkY, checkZ, blockType, logTypes);
                        if (!base) continue;

                        const baseKey = `${base.x},${base.y},${base.z}`;
                        if (checkedBases.has(baseKey)) continue;
                        checkedBases.add(baseKey);

                        // Check if tree base is still supported
                        if (!this.isTreeSupported(base.x, base.y, base.z, blockType, logTypes)) {
                            console.log(`[TreeStability] Tree at ${base.x},${base.y},${base.z} is no longer supported - felling!`);
                            this.physicsManager.checkAndFellTree(base.x, base.y, base.z, blockType);
                        }
                    }
                }
            }
        }
    }

    /**
     * Find the base (lowest log block) of a tree by tracing down.
     */
    findTreeBase(x, y, z, logType, logTypes) {
        let baseY = y;
        // Trace down to find the lowest log
        while (baseY > 0) {
            const below = this.getBlockWorld(x, baseY - 1, z);
            if (below && logTypes.includes(below)) {
                baseY--;
            } else {
                break;
            }
        }
        return { x, y: baseY, z };
    }

    /**
     * Check if a tree's base is still supported (connected to ground).
     * For single-block trees: check if there's solid non-log block below.
     * For 2x2 trees (dark oak style): check if all 4 base logs have support.
     */
    isTreeSupported(baseX, baseY, baseZ, logType, logTypes) {
        // Check for 2x2 tree pattern (common for dark oak)
        const is2x2 = this.is2x2Tree(baseX, baseY, baseZ, logType);

        if (is2x2) {
            // For 2x2 trees, all 4 base blocks must be supported
            const offsets = [[0, 0], [1, 0], [0, 1], [1, 1]];
            let supportedCount = 0;
            for (const [dx, dz] of offsets) {
                const below = this.getBlockWorld(baseX + dx, baseY - 1, baseZ + dz);
                if (below && !logTypes.includes(below) && below !== Blocks.AIR && below !== Blocks.WATER) {
                    supportedCount++;
                }
            }
            // Tree needs all 4 supports for 2x2 trees
            return supportedCount === 4;
        } else {
            // Single-block tree - needs 1 solid block below
            const below = this.getBlockWorld(baseX, baseY - 1, baseZ);
            return below && !logTypes.includes(below) && below !== Blocks.AIR && below !== Blocks.WATER;
        }
    }

    /**
     * Check if this is a 2x2 (4-block-wide) tree by looking for adjacent same-type logs at base level.
     */
    is2x2Tree(x, y, z, logType) {
        // Check all 4 possible 2x2 configurations this block could be part of
        const patterns = [
            [[0, 0], [1, 0], [0, 1], [1, 1]],   // NW corner
            [[-1, 0], [0, 0], [-1, 1], [0, 1]], // NE corner  
            [[0, -1], [1, -1], [0, 0], [1, 0]], // SW corner
            [[-1, -1], [0, -1], [-1, 0], [0, 0]] // SE corner
        ];

        for (const pattern of patterns) {
            let matches = 0;
            for (const [dx, dz] of pattern) {
                const block = this.getBlockWorld(x + dx, y, z + dz);
                if (block === logType) matches++;
            }
            if (matches === 4) return true;
        }
        return false;
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

    // Thruster Data
    setThrusterData(x, y, z, dir) {
        const key = this.getBlockKey(x, y, z);
        this.thrusterData.set(key, dir);
        // Mark chunk dirty?
        const start = performance.now();
        const chunkKey = this.getChunkKey(Math.floor(x / this.chunkSize), Math.floor(y / this.chunkSize), Math.floor(z / this.chunkSize));
        const chunk = this.chunks.get(chunkKey);
        if (chunk) chunk.dirty = true;
    }

    getThrusterData(x, y, z) {
        const key = this.getBlockKey(x, y, z);
        return this.thrusterData.get(key) || 0; // Default 0
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

    // Mark all 6 neighboring chunks as dirty (used when a new chunk is generated)
    // This ensures neighboring chunks rebuild their meshes with correct face culling
    markAllNeighboringChunksDirty(cx, cy, cz) {
        const offsets = [
            [1, 0, 0], [-1, 0, 0],
            [0, 1, 0], [0, -1, 0],
            [0, 0, 1], [0, 0, -1]
        ];

        let markedCount = 0;
        for (const [dx, dy, dz] of offsets) {
            const neighborKey = this.getChunkKey(cx + dx, cy + dy, cz + dz);
            const neighbor = this.chunks.get(neighborKey);
            if (neighbor && neighbor.isGenerated) {
                neighbor.dirty = true;
                markedCount++;
            }
        }

        // Invalidate the dirty chunks cache so these are picked up immediately
        if (markedCount > 0) {
            this._dirtyChunksCacheInvalidated = true;
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

        // PERFORMANCE: Use cached dirty chunks list, update periodically
        if (!this._dirtyChunksCache || this.frameCount % 5 === 0 || this._dirtyChunksCacheInvalidated) {
            const playerCX = Math.floor(this.player.position.x / this.chunkSize);
            const playerCZ = Math.floor(this.player.position.z / this.chunkSize);

            // Collect all dirty chunks with their distance from player
            this._dirtyChunksCache = [];
            for (const chunk of this.chunks.values()) {
                if (chunk.dirty) {
                    const dx = chunk.cx - playerCX;
                    const dz = chunk.cz - playerCZ;
                    const distSq = dx * dx + dz * dz;
                    this._dirtyChunksCache.push({ chunk, distSq });
                }
            }

            // Sort by distance (closest first)
            this._dirtyChunksCache.sort((a, b) => a.distSq - b.distSq);
            this._dirtyChunksCacheInvalidated = false;
        }

        // Update only the first N chunks
        let updated = 0;
        while (updated < maxChunksPerFrame && this._dirtyChunksCache.length > 0) {
            const item = this._dirtyChunksCache.shift();
            if (item.chunk.dirty) { // Double-check still dirty
                item.chunk.buildMesh();
                updated++;
            }
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

        const { cx, cy, cz } = playerChunk;

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
        const yUnloadDist = 3; // Smaller Y unload distance
        for (const [key, chunk] of this.chunks) {
            // Skip protected chunks (e.g., starship chunks)
            if (this.protectedChunks.has(key)) continue;

            const xzFar = Math.abs(chunk.cx - cx) > unloadDist || Math.abs(chunk.cz - cz) > unloadDist;
            const yFar = Math.abs(chunk.cy - cy) > yUnloadDist;
            if (xzFar || yFar) {
                this.unloadChunk(key);
                // Also remove from queue if it's pending
                this.chunkGenQueue = this.chunkGenQueue.filter(req =>
                    Math.abs(req.cx - cx) <= unloadDist &&
                    Math.abs(req.cz - cz) <= unloadDist &&
                    Math.abs(req.cy - cy) <= yUnloadDist
                );
            }
        }

        // 2. Queue missing chunks
        // Generate chunks around the player
        // PERFORMANCE FIX: Use limited Y-range instead of full cubic renderDistance
        // This reduces chunks from ~4900 (17^3) to ~1400 (17*17*5)
        const yRenderDistance = 6; // 6 chunks above/below player to render starship at Y=160

        for (let x = cx - this.renderDistance; x <= cx + this.renderDistance; x++) {
            for (let z = cz - this.renderDistance; z <= cz + this.renderDistance; z++) {

                // Finite World Horizontal Limit
                const radius = (Config && Config.WORLD && Config.WORLD.WORLD_RADIUS_CHUNKS) ? Config.WORLD.WORLD_RADIUS_CHUNKS : 1000;
                if (Math.abs(x) > radius || Math.abs(z) > radius) {
                    continue;
                }

                // PERFORMANCE FIX: Limited vertical range (2 above, 2 below player)
                // This still supports moon travel since cy moves with the player
                const minY = Math.max(0, cy - yRenderDistance); // Don't go below Y=0
                const maxY = cy + yRenderDistance;

                for (let y = minY; y <= maxY; y++) {
                    const chunkKey = `${x},${y},${z}`;

                    // Skip if already loaded
                    // Skip if already generated
                    // Fix: If chunk exists but !isGenerated (spillover), we MUST queue it
                    const existing = this.chunks.get(chunkKey);
                    if (existing && existing.isGenerated) continue;

                    // Skip if already in queue
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
        if (!blocks) return;
        console.log(`[Game] Processing ${blocks.length} persisted blocks...`);
        let appliedCount = 0;
        let storedCount = 0;

        // Ensure initialization
        if (!this.persistedBlocks) {
            this.persistedBlocks = new Map();
        }

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

    /**
     * Clear all persisted block changes (used during world reset)
     * This allows terrain to regenerate naturally without player modifications
     */
    clearPersistedBlocks() {
        console.log(`[Game] Clearing ${this.persistedBlocks?.size || 0} persisted block entries`);

        // Clear the persisted blocks map
        if (this.persistedBlocks) {
            this.persistedBlocks.clear();
        }

        // Mark all chunks as dirty so they rebuild with original terrain
        for (const chunk of this.chunks.values()) {
            chunk.dirty = true;
        }

        console.log('[Game] Persisted blocks cleared, chunks marked for rebuild');
    }

    // Process queue of chunks to generate
    processChunkQueue() {
        if (this.chunkGenQueue.length === 0) return;
        if (this._idleCallbackScheduled) return; // Already scheduled

        // PERFORMANCE: Only re-sort every 10 frames or when queue is small
        const needsSort = !this._lastQueueSortFrame ||
            (this.frameCount - this._lastQueueSortFrame) > 10 ||
            this.chunkGenQueue.length < 10;

        if (needsSort) {
            // Sort by distance (closest first)
            const playerChunk = this.worldToChunk(this.player.position.x, this.player.position.y, this.player.position.z);

            this.chunkGenQueue.forEach(req => {
                const dx = req.cx - playerChunk.cx;
                const dz = req.cz - playerChunk.cz;
                req.distSq = dx * dx + dz * dz;
            });

            this.chunkGenQueue.sort((a, b) => a.distSq - b.distSq);
            this._lastQueueSortFrame = this.frameCount;
        }

        const processInIdle = (deadline) => {
            this._idleCallbackScheduled = false;

            let processed = 0;
            const isInitialLoad = this.generatedChunks.size < 9; // 3x3 chunks

            // OPTIMIZATION: Process more chunks when queue is large (fast movement)
            const queueSize = this.chunkGenQueue.length;
            const isUrgent = queueSize > 15; // Slightly more sensitive
            const minChunks = isUrgent ? 5 : 2; // Process more chunks per frame

            // Process as many chunks as we can while there's idle time OR if we are in initial load
            while (this.chunkGenQueue.length > 0 &&
                (deadline.timeRemaining() > 1 || isInitialLoad || processed < minChunks)) {
                const req = this.chunkGenQueue.shift();

                // Double check if loaded (rare case)
                // Fix: Check if technically exists but wasn't generated (e.g. from spillover)
                const existingChunk = this.chunks.get(req.key);
                if (existingChunk && existingChunk.isGenerated) continue;

                // Generate
                const chunk = this.worldGen.generateChunk(req.cx, req.cy, req.cz);
                this.generatedChunks.add(req.cx + ',' + req.cy + ',' + req.cz);

                // Mark all neighboring chunks as dirty so they rebuild with correct face culling
                // This fixes visibility issues when flying up high and returning - neighboring
                // chunks may have been built with incorrect culling because this chunk didn't exist yet
                this.markAllNeighboringChunksDirty(req.cx, req.cy, req.cz);

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
                    // this.spawnMerlin(); // Disabled - wizard no longer spawns near player
                    this.spawnPlayerShip();
                }
            }

            // If there's more to process, schedule another idle callback
            if (this.chunkGenQueue.length > 0) {
                this._idleCallbackScheduled = true;
                requestIdleCallback(processInIdle, { timeout: 32 }); // Faster response
            }
        };

        // Schedule idle callback to process chunks when browser is free
        this._idleCallbackScheduled = true;

        // Initial load: Run immediately to avoid waiting for idle time
        if (this.generatedChunks.size < 9) {
            setTimeout(() => processInIdle({ timeRemaining: () => 999 }), 0);
        } else {
            requestIdleCallback(processInIdle, { timeout: 32 }); // Faster response (32ms ~ 2 frames)
        }
    }



    // cleanupBlockData removed as it's no longer needed

    updateFrustum() {
        this.frustumMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse
        );
        this.frustum.setFromProjectionMatrix(this.frustumMatrix);
    }

    // Frustum culling - hide chunks not in view
    updateChunkVisibility() {
        // Reuse this.frustum which should be updated by updateFrustum() earlier in the frame

        // Get player chunk position for distance calculations
        const playerCX = Math.floor(this.player.position.x / this.chunkSize);
        const playerCZ = Math.floor(this.player.position.z / this.chunkSize);

        let visibleCount = 0;
        const grassEnabled = this.grassSystem ? this.grassSystem.visible : false;
        const terrainVis = this.terrainVisible; // Cache for faster access
        const frustum = this.frustum; // Cache reference
        const renderDist = this.renderDistance;
        const renderDistPlus2 = renderDist + 2; // Chunks beyond this are definitely out

        for (const chunk of this.chunks.values()) {
            if (!chunk.mesh) continue; // Early exit for meshless chunks

            // Quick distance check - skip frustum test for far chunks
            const dx = chunk.cx - playerCX;
            const dz = chunk.cz - playerCZ;
            const hDist = Math.max(Math.abs(dx), Math.abs(dz));

            // Chunks beyond render distance + 2 should already be unloaded, but hide them
            if (hDist > renderDistPlus2) {
                chunk.mesh.visible = false;
                if (chunk.grassMesh) chunk.grassMesh.visible = false;
                continue;
            }

            // Frustum culling
            const isVisible = terrainVis && chunk.isInFrustum(frustum);
            chunk.mesh.visible = isVisible;
            if (chunk.grassMesh) chunk.grassMesh.visible = isVisible && grassEnabled;
            if (isVisible) visibleCount++;
        }

        this.visibleChunkCount = visibleCount;
    }

    // Physics methods moved to PhysicsManager
    // createHighlightBox removed
    // getHitAnimal, getTargetBlock removed

    breakBlock(x, y, z) {
        const block = this.getBlock(x, y, z);
        if (block) {
            this.analyticsManager.logBlockBreak(block.type, x, y, z);
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

    // Voxel Raycast (DDA Algorithm) for Line of Sight
    checkLineOfSight(start, end) {
        // 1. Setup DDA
        let x0 = Math.floor(start.x);
        let y0 = Math.floor(start.y);
        let z0 = Math.floor(start.z);
        const x1 = Math.floor(end.x);
        const y1 = Math.floor(end.y);
        const z1 = Math.floor(end.z);

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const dz = Math.abs(z1 - z0);

        const stepX = x0 < x1 ? 1 : -1;
        const stepY = y0 < y1 ? 1 : -1;
        const stepZ = z0 < z1 ? 1 : -1;

        // Initial remainder (distance to next boundary)
        // Correct DDA setup
        // Delta distance: distance ray travels to go 1 step in X/Y/Z
        // If dx is 0, delta is Infinity (handled by large number / logic)

        // Ray direction
        const rayDir = new THREE.Vector3().subVectors(end, start).normalize();

        // Distance to traverse 1 unit in each direction
        const deltaDistX = (dx === 0) ? Infinity : Math.abs(1 / rayDir.x);
        const deltaDistY = (dy === 0) ? Infinity : Math.abs(1 / rayDir.y);
        const deltaDistZ = (dz === 0) ? Infinity : Math.abs(1 / rayDir.z);

        let sideDistX, sideDistY, sideDistZ;

        // Calculate initial sideDist
        if (rayDir.x < 0) {
            sideDistX = (start.x - x0) * deltaDistX;
        } else {
            sideDistX = (x0 + 1.0 - start.x) * deltaDistX;
        }
        if (rayDir.y < 0) {
            sideDistY = (start.y - y0) * deltaDistY;
        } else {
            sideDistY = (y0 + 1.0 - start.y) * deltaDistY;
        }
        if (rayDir.z < 0) {
            sideDistZ = (start.z - z0) * deltaDistZ;
        } else {
            sideDistZ = (z0 + 1.0 - start.z) * deltaDistZ;
        }

        // Limit loop to avoid infinite freeze
        let steps = 0;
        const maxSteps = 100; // Limit ray length (approx 100 blocks) or calculate from dist

        while (true) {
            // Check current block
            // Optimization: Ignore air and water? water might occlude? 
            // Usually water is transparent. Leaves might be transparent-ish? 
            // For culling, we only want SOLID opaque blocks.
            // Transparent blocks (glass, water, leaves) should NOT occlude.
            const block = this.getBlockWorld(x0, y0, z0);
            if (block && block !== Blocks.AIR && block !== Blocks.WATER &&
                !block.includes('glass') && !block.includes('leaves')) {
                // Occulsion detected!
                return false; // Not visible
            }

            if (x0 === x1 && y0 === y1 && z0 === z1) break;
            if (steps++ > maxSteps) break; // Should unlikely hit this if end point is reasonable

            // Step
            if (sideDistX < sideDistY) {
                if (sideDistX < sideDistZ) {
                    sideDistX += deltaDistX;
                    x0 += stepX;
                } else {
                    sideDistZ += deltaDistZ;
                    z0 += stepZ;
                }
            } else {
                if (sideDistY < sideDistZ) {
                    sideDistY += deltaDistY;
                    y0 += stepY;
                } else {
                    sideDistZ += deltaDistZ;
                    z0 += stepZ;
                }
            }
        }

        return true; // Line of sight clear
    }

    updateDebug() {
        this.uiManager.updatePosition(this.player.position);
        this.uiManager.updateFPS();

        // PERFORMANCE: Log slow frames for debugging
        const now = performance.now();
        if (this._frameStartTime) {
            const frameTime = now - this._frameStartTime;
            if (frameTime > 33) { // > 30fps threshold
                // Only log occasionally to avoid spam
                if (!this._lastSlowFrameLog || now - this._lastSlowFrameLog > 2000) {
                    console.warn(`[Perf] Slow frame: ${frameTime.toFixed(1)}ms (${(1000/frameTime).toFixed(0)} fps), chunks: ${this.chunks.size}, queue: ${this.chunkGenQueue.length}`);
                    this._lastSlowFrameLog = now;
                }
            }
        }

        // PERFORMANCE: Track scene object count every 30 seconds (was 5s)
        if (!this._lastSceneCount || now - this._lastSceneCount > 30000) {
            this._lastSceneCount = now;
            let count = 0;
            this.scene.traverse(() => count++);
            console.log(`[Scene] Total objects: ${count}, Animals: ${this.animals.length}`);
        }

        // Multiplayer: Send position update every 50ms (20Hz), only if moved or stopping
        if (!this._lastPosUpdate || now - this._lastPosUpdate > 50) {
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
                    const isCrouching = this.inputManager.isActionActive('SNEAK');
                    const isFlying = this.player.isFlying || false;
                    this.socketManager.sendPosition(currentPos, currentRotY, isCrouching, isFlying);
                    this._lastSentPos.copy(currentPos);
                    this._lastSentRotY = currentRotY;
                    this._isCurrentlyMoving = isMoving;
                    this._isCurrentlyRotating = isRotating;
                } else if (this._isCurrentlyMoving || this._isCurrentlyRotating) {
                    // Send one last "stop" packet to ensure final position/rotation sync
                    const isCrouching = this.inputManager.isActionActive('SNEAK');
                    const isFlying = this.player.isFlying || false;
                    this.socketManager.sendPosition(currentPos, currentRotY, isCrouching, isFlying);
                    this._lastSentPos.copy(currentPos);
                    this._lastSentRotY = currentRotY;
                    this._isCurrentlyMoving = false;
                    this._isCurrentlyRotating = false;
                }
            }
        }
    }

    safelyUpdateEntity(entity, deltaTime, list, index) {
        // PERFORMANCE: Only profile every 60 frames to reduce overhead
        const shouldProfile = (this.frameCount % 60 === 0);
        const start = shouldProfile ? performance.now() : 0;
        let success = false;

        try {
            // Error Handling Guard
            const alive = entity.update(deltaTime, this.player);
            // If update returns explicitly false (dead), handle removal (caller usually handles list splicing if we return false here to indicate 'remove')
            // But the contract varies. 
            // Most entities return 'false' if they want to be removed (projectiles), 
            // but Animals set isDead = true.
            // We need to standardize, or just handle both. 
            // For this method, let's return TRUE if entity should KEEP running, FALSE if it should be removed.

            success = true; // No crash

            // Check explicit death signals from entity
            if (alive === false) return false;
            if (entity.isDead) return false;

        } catch (error) {
            console.error('[Guard] Entity crashed during update:', entity);
            console.error(error);
            // Show toast?
            if (this.uiManager) {
                this.uiManager.addChatMessage('system', `[Guard] Removed faulty entity: ${entity.constructor.name}`);
            }
            return false; // Remove it
        }

        // PERFORMANCE: Only warn, don't remove entities for taking too long
        if (shouldProfile) {
            const duration = performance.now() - start;
            if (duration > 25) { // 25ms budget - warn only, don't remove
                console.warn(`[Guard] Entity slow (${duration.toFixed(2)}ms):`, entity.constructor?.name);
            }
        }

        return true;
    }

    animate() {
        this._frameStartTime = performance.now(); // Track frame start for perf logging
        if (this.perf) this.perf.begin();
        this.stats.begin();
        // this.profiler.tick(); // DEPRECATED

        requestAnimationFrame(() => this.animate());

        // this.profiler.start('WorldGen');
        this.processChunkQueue();
        // this.profiler.end('WorldGen');

        // PERFORMANCE: Update Frustum ONCE per frame
        this.updateFrustum();

        const now = performance.now();
        let deltaTime = (now - this.lastTime) / 1000;
        this.lastTime = now;

        // CRITICAL: Cap deltaTime to prevent physics explosion during lag spikes
        // When frames take too long (e.g., mesh creation), uncapped dt causes:
        // 1. Massive velocity accumulation
        // 2. Player falling through terrain
        // Cap at 50ms (0.05s) to maintain stable physics
        const maxDeltaTime = 0.05;
        if (deltaTime > maxDeltaTime) {
            console.warn(`[Game] Frame took ${(deltaTime * 1000).toFixed(1)}ms, capping dt to ${maxDeltaTime * 1000}ms`);
            deltaTime = maxDeltaTime;
        }

        // UI Update (Speech bubbles)
        // this.profiler.start('UI');
        this.uiManager.update(deltaTime);
        // this.profiler.end('UI');

        // UI-Only Mode: Skip all world/entity updates
        if (this.isUIOnly) {
            this.updateDebug();
            this.renderer.render(this.scene, this.camera);
            return;
        }

        // Profiler Test Mode: Skip ALL game systems for clean isolated testing
        if (this.profilerTestScene && this.profilerTestScene.isActive) {
            this.renderer.render(this.scene, this.camera);
            if (this.perf) this.perf.end();
            this.stats.end();
            return;
        }

        // Update physics and player
        // Always update player physics (gravity) but only allow input when locked/mobile
        this.updateTimeStop(deltaTime);
        // this.profiler.start('Player');
        this.player.update(deltaTime, this.controls.isLocked || this.gameState.flags.mobileControls);
        // this.profiler.end('Player');

        // this.profiler.start('Physics');
        this.physicsManager.update();
        // this.profiler.end('Physics')


        // Always update chunks and check for new ones, so the world generates around you even before starting
        // SKIP when in profiler test mode for clean isolated testing
        if (!this.profilerTestScene || !this.profilerTestScene.isActive) {
            // Throttle chunk checking (Faster check for smoother generation)
            if (this.frameCount % 5 === 0) {
                this.checkChunks();
            }

            // Update dirty chunks every frame (throttled internally)
            // this.profiler.start('ChunkMeshing');
            this.updateChunks();
            // this.profiler.end('ChunkMeshing');
        }

        this.frameCount = (this.frameCount || 0) + 1;

        this.agent.update(this.lastTime / 1000, this.player);
        if (this.studio) this.studio.update(deltaTime);

        // Update animals
        // this.profiler.start('Entities');

        // Optimization Reuse Objects
        if (!this._cullingSphere) {
            this._cullingSphere = new THREE.Sphere(new THREE.Vector3(), 2.0); // 2.0 radius covers all mobs
        }

        for (let i = this.animals.length - 1; i >= 0; i--) {
            const animal = this.animals[i];

            // --- OPTIMIZATION START ---
            // 1. Distance Culling
            const distSq = animal.position.distanceToSquared(this.player.position);

            // Hard Despawn if too far (e.g., 128m) - handled in cleanupEntities mostly, but check here too?
            // Existing cleanupEntities handles the removal. Here we just decide to UPDATE or RENDER.

            // 2. Frustum Culling
            // Move sphere to animal
            this._cullingSphere.center.copy(animal.position);
            // Adjust radius based on entity size if needed, but 2.0 is generous for current mobs
            // const radius = Math.max(animal.width, animal.height, animal.depth);
            // this._cullingSphere.radius = radius; 

            const inFrustum = this.frustum.intersectsSphere(this._cullingSphere);
            const isClose = distSq < 64 * 64; // Always update if within 64m (sound range, logic range)

            // Logic:
            // - If not in frustum AND on ground AND not close -> Skip update, hide mesh
            // - Falling entities: Always update (gravity)
            // - Close entities: Always update (audio, interactions)

            let shouldUpdate = true;
            let shouldRender = true;

            if (!inFrustum && !isClose) {
                if (animal.onGround) {
                    shouldUpdate = false;
                    shouldRender = false;
                } else {
                    // Falling/Airborne: Must update physics, but maybe hide mesh if VERY far?
                    // If out of frustum, we don't *render*, but we *update* position.
                    shouldRender = false;
                    shouldUpdate = true;
                }
            } else if (!inFrustum && isClose) {
                // Close but behind us
                shouldRender = false;
                shouldUpdate = true; // Logic still runs (sounds, chasing from behind)
            } else {
                // In Frustum
                // 3. Occlusion Culling (Line of Sight)
                // Only check if visible in frustum to save CPU
                // Check from Camera to Entity Center (approx)
                // Offset entity position up slightly (center of mass)
                const entityCenter = animal.position.clone();
                entityCenter.y += (animal.height || 1.0) * 0.5;

                // Optimization: Don't raycast every frame? Or stride?
                // For now, simple raycast every frame is fine if efficient.
                const hasLOS = this.checkLineOfSight(this.camera.position, entityCenter);

                if (!hasLOS) {
                    // Blocked!
                    if (animal.onGround) {
                        shouldUpdate = false;
                        shouldRender = false;
                    } else {
                        // Falling/Airborne: Must update physics
                        shouldRender = false;
                        shouldUpdate = true;
                    }
                } else {
                    // Visible!
                    shouldRender = true;
                    shouldUpdate = true;
                }
            }

            // Apply Rendering Visibility
            // Also respect global toggles!
            if (shouldRender) {
                // Check global toggles only if frustum says render
                const type = animal.constructor.name;
                let categoryVisible = true;
                if (type === 'Villager') categoryVisible = this.villagersVisible;
                else if (type === 'Spaceship') categoryVisible = this.spaceshipsVisible;
                else categoryVisible = this.creaturesVisible;

                // Specific toggle
                const specificVisible = this.allowedAnimalTypes.has(type);

                shouldRender = categoryVisible && specificVisible;
            }

            // Toggle mesh visibility
            if (animal.mesh) animal.mesh.visible = shouldRender;
            if (animal.group) animal.group.visible = shouldRender;

            // Execute Update
            let keep = true;
            if (shouldUpdate) {
                keep = this.safelyUpdateEntity(animal, deltaTime, this.animals, i);
            }

            if (!keep) {
                if (animal.dispose) animal.dispose();
                if (animal.group) this.scene.remove(animal.group);
                else if (animal.mesh) this.scene.remove(animal.mesh);
                this.animals.splice(i, 1);
            }
            // --- OPTIMIZATION END ---
        }

        // Update mini-games
        if (this.survivalGameManager) this.survivalGameManager.update(deltaTime);
        if (this.parkourManager) this.parkourManager.update(deltaTime);
        if (this.escapeRoomManager) this.escapeRoomManager.update(deltaTime);

        // Update orbiting spaceship
        if (this.spaceShipManager) this.spaceShipManager.update(deltaTime);

        // (Animals cleanup loop removed as it's now integrated above)

        // Periodic cleanup (every ~1s)
        if (this.frameCount % 60 === 0) {
            this.cleanupEntities();
            // Check if player moved to a different planet and spawn creatures there
            if (this.spawnManager) {
                this.spawnManager.checkWorldChange();
            }
        }

        // Update Dragon
        if (this.dragon) {
            // Special handling for Dragon as it's single instance, not in list usually?
            // Wait, this.dragon is just a property.
            if (!this.safelyUpdateEntity(this.dragon, deltaTime)) {
                console.warn('[Guard] Dragon crashed/lagged and was removed.');
                this.scene.remove(this.dragon.mesh);
                this.dragon = null;
            }
        }

        try {
            this.entityManager.update(deltaTime, this.player);
        } catch (e) {
            console.error('[Guard] EntityManager update failed:', e);
            // This is harder to auto-fix since it's a manager. 
        }

        // Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            const keep = this.safelyUpdateEntity(proj, deltaTime);
            if (!keep) {
                this.scene.remove(proj.mesh);
                this.projectiles.splice(i, 1);
            }
        }

        // Update Drops
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const drop = this.drops[i];
            const keep = this.safelyUpdateEntity(drop, deltaTime);
            if (!keep) {
                this.scene.remove(drop.mesh);
                this.drops.splice(i, 1);
            }
        }

        if (this.shrunkBlocks) {
            for (let i = this.shrunkBlocks.length - 1; i >= 0; i--) {
                const sb = this.shrunkBlocks[i];
                const keep = this.safelyUpdateEntity(sb, deltaTime);
                if (!keep) {
                    this.scene.remove(sb.mesh);
                    this.shrunkBlocks.splice(i, 1);
                }
            }
        }

        // Update Targeted Floating Blocks (Giant build)
        if (this.targetedFloatingBlocks) {
            for (let i = this.targetedFloatingBlocks.length - 1; i >= 0; i--) {
                const tfb = this.targetedFloatingBlocks[i];
                const keep = this.safelyUpdateEntity(tfb, deltaTime);
                if (!keep) {
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
                const keep = this.safelyUpdateEntity(fb, deltaTime);
                if (!keep) {
                    this.scene.remove(fb.mesh);
                    this.floatingBlocks.splice(i, 1);
                }
            }
        }

        // Update Controllable Blocks
        if (this.controllableBlocks) {
            for (let i = this.controllableBlocks.length - 1; i >= 0; i--) {
                const cb = this.controllableBlocks[i];
                const keep = this.safelyUpdateEntity(cb, deltaTime);
                if (!keep) {
                    cb.destroy();
                    this.controllableBlocks.splice(i, 1);
                }
            }
        }

        // Update Tornadoes
        if (this.tornadoes) {
            for (let i = this.tornadoes.length - 1; i >= 0; i--) {
                const t = this.tornadoes[i];
                const keep = this.safelyUpdateEntity(t, deltaTime);
                if (!keep) {
                    this.tornadoes.splice(i, 1);
                }
            }
        }

        // Update Ships
        if (this.ships) {
            for (let i = this.ships.length - 1; i >= 0; i--) {
                const ship = this.ships[i];
                const keep = this.safelyUpdateEntity(ship, deltaTime);
                if (!keep) {
                    this.scene.remove(ship.mesh);
                    this.ships.splice(i, 1);
                }
            }
        }

        // this.profiler.end('Entities');

        // Frustum culling for performance
        // PERFORMANCE: Only update chunk visibility every 3 frames
        // This reduces CPU overhead significantly with 100+ chunks
        if (this.frameCount % 3 === 0) {
            this.updateChunkVisibility();
        }

        // Day/Night Cycle - use Environment module
        if (!this.gameState.debug || this.gameState.debug.environment) {
            // this.profiler.start('Environment');
            this.environment.updateDayNightCycle(deltaTime, this.player.position);
            if (this.grassSystem) this.grassSystem.update(deltaTime);
            // this.profiler.end('Environment');
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

        // Visual Improvements: Update Wind
        if (this.assetManager) {
            this.assetManager.updateWind(now / 1000);
        }

        // Update Remote Players (toggle with P key for debugging)
        if (!this._disableRemotePlayers && this.remotePlayers) {
            const remoteDelta = deltaTime;
            for (const remotePlayer of this.remotePlayers.values()) {
                remotePlayer.update(remoteDelta);
            }
        }

        // Update SocketManager for remote player mesh interpolation and voice chat
        if (this.socketManager) {
            this.socketManager.update(deltaTime);
        }



        this.updateDebug();

        // Visual Improvements: Use EffectComposer for post-processing (Bloom)
        // Render Scene
        // Skip composer when in profiler test mode for clean isolated rendering
        if (this.profilerTestScene && this.profilerTestScene.isActive) {
            this.renderer.render(this.scene, this.camera);
        } else if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
        if (this.perf) this.perf.end();
        this.stats.end();
    }

    killAllAnimals() {
        for (const animal of this.animals) {
            if (animal.dispose) animal.dispose();
            if (animal.group) this.scene.remove(animal.group);
            else if (animal.mesh) this.scene.remove(animal.mesh);
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
            const animal = this.animals[i];
            // Distance check
            if (animal.position.distanceTo(this.player.position) > despawnDist) {
                animal.dispose(); // Clean up resources!
                if (animal.group) this.scene.remove(animal.group);
                else if (animal.mesh) this.scene.remove(animal.mesh);
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

    toggleTerrainShadows(enabled) {
        this.terrainShadowsEnabled = enabled; // Store state for new chunks
        if (this.environment) {
            this.environment.toggleShadows(enabled);
        }
        console.log(`[Game] Toggling terrain shadows (receive): ${enabled}`);

        // Update existing chunks
        for (const chunk of this.chunks.values()) {
            if (chunk && chunk.mesh) {
                chunk.mesh.receiveShadow = enabled;
            }
        }
    }

    toggleTerrainCastShadows(enabled) {
        this.terrainCastShadows = enabled;
        console.log(`[Game] Toggling terrain cast shadows: ${enabled}`);
        for (const chunk of this.chunks.values()) {
            if (chunk && chunk.mesh) {
                chunk.mesh.castShadow = enabled;
            }
        }
    }

    toggleTerrain(visible) {
        this.terrainVisible = visible;
        for (const chunk of this.chunks.values()) {
            if (chunk.mesh) {
                chunk.mesh.visible = visible;
            }
            if (chunk.grassMesh) {
                chunk.grassMesh.visible = visible;
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
        this.waterVisible = enabled;
        if (this.waterSystem) {
            this.waterSystem.enabled = enabled;
        }
        // Update water blocks visibility in all chunks
        this.updateWaterVisibility();
        console.log(`[Game] Water: ${enabled}`);
    }

    updateWaterVisibility() {
        // Rebuild chunks to show/hide water blocks
        // Mark all chunks as dirty so they rebuild without water if disabled
        for (const chunk of this.chunks.values()) {
            chunk.dirty = true;
        }
    }

    togglePlants(enabled) {
        this.plantsVisible = enabled;
        // Update plant entity visibility
        if (this.animals) {
            for (const animal of this.animals) {
                const type = animal.constructor.name;
                if (type.includes('Plant') || type === 'FallingTree') {
                    if (animal.mesh) animal.mesh.visible = enabled;
                    if (animal.group) animal.group.visible = enabled;
                }
            }
        }
        // Mark chunks dirty to rebuild without plant blocks
        for (const chunk of this.chunks.values()) {
            chunk.dirty = true;
        }
        console.log(`[Game] Plants: ${enabled}`);
    }

    toggleBuildings(enabled) {
        this.buildingsVisible = enabled;
        // Mark chunks dirty to rebuild - buildings are part of terrain
        for (const chunk of this.chunks.values()) {
            chunk.dirty = true;
        }
        console.log(`[Game] Buildings: ${enabled}`);
    }

    toggleWeather(enabled) {
        if (this.weatherSystem) {
            this.weatherSystem.enabled = enabled;
            if (!enabled) this.weatherSystem.clear();
        }
        console.log(`[Game] Weather: ${enabled}`);
    }

    toggleStats(visible) {
        if (this.stats) {
            this.stats.dom.style.display = visible ? 'block' : 'none';
        }
        if (this.profiler) {
            // this.profiler.enable(visible);
        }
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
