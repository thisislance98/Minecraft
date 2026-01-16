import { AnimalClasses } from '../AnimalRegistry.js';

export class DebugPanel {
    constructor(game) {
        this.game = game;
        this.isVisible = false;

        // Cache DOM
        this.container = document.getElementById('debug-panel');

        // Settings State
        this.settings = {
            animals: {
                enabled: true,
                allowed: new Set(Object.keys(AnimalClasses)) // All enabled by default
            },
            world: {
                updateChunks: true,
                showTerrain: true,
                dayNightCycle: true,
                particles: true,
                particles: true,
                shadows: true,
                castShadows: false,
                water: true,
                weather: true,
                grass: true,
                plants: true,
                buildings: true
            },
            entities: {
                creatures: true,
                villagers: true,
                spaceships: true
            }
        };

        this.setupUI();
        this.bindEvents();

        // Initial sync
        if (this.game.spawnManager) {
            this.game.spawnManager.allowedAnimals = this.settings.animals.allowed;
            this.game.spawnManager.isSpawningEnabled = this.settings.animals.enabled;
        }
    }

    setupUI() {
        if (!this.container) return;

        // Reset content
        this.container.innerHTML = `
            <div class="debug-header">
                <h3>Debug Control</h3>
                <button id="dbg-close">×</button>
            </div>
            <div class="debug-tabs">
                <button class="debug-tab active" data-tab="general">General</button>
                <button class="debug-tab" data-tab="animals">Animals</button>
                <button class="debug-tab" data-tab="spawning">Spawning</button>
                <button class="debug-tab" data-tab="perf">Performance</button>
            </div>
            
            <div class="debug-content active" id="tab-general">
                <div class="control-group">
                    <h4>World</h4>
                    <label><input type="checkbox" id="dbg-chunks" checked> Update Chunks</label>
                    <label><input type="checkbox" id="dbg-terrain" checked> Show Terrain</label>
                    <label><input type="checkbox" id="dbg-env" checked> Day/Night Cycle</label>
                    <label><input type="checkbox" id="dbg-moon" checked> Show Moon</label>
                    <label><input type="checkbox" id="dbg-particles" checked> Particles</label>
                    <label><input type="checkbox" id="dbg-shadows" checked> Terrain Shadows</label>
                    <label><input type="checkbox" id="dbg-cast-shadows"> Terrain Cast Shadows</label>
                    <label><input type="checkbox" id="dbg-water" checked> Water</label>
                    <label><input type="checkbox" id="dbg-weather" checked> Weather</label>
                    <label><input type="checkbox" id="dbg-grass" checked> Grass</label>
                    <label><input type="checkbox" id="dbg-plants" checked> Plants & Trees</label>
                    <label><input type="checkbox" id="dbg-buildings" checked> Buildings</label>
                </div>
                <div class="control-group">
                    <h4>Entities</h4>
                    <label><input type="checkbox" id="dbg-creatures" checked> Creatures</label>
                    <label><input type="checkbox" id="dbg-villagers" checked> Villagers</label>
                    <label><input type="checkbox" id="dbg-spaceships" checked> Spaceships</label>
                </div>
                <div class="control-group">
                    <h4>Stats</h4>
                    <label><input type="checkbox" id="dbg-fps"> Show FPS</label>
                    <p>Entities: <span id="dbg-entity-count">0</span></p>
                    <p>Chunks: <span id="dbg-chunk-count">0</span></p>
                    <button id="dbg-profiler-test" class="spawn-btn full-width" style="margin-top: 12px;">
                        🔬 Start Profiler Test Scene
                    </button>
                    <p id="dbg-profiler-hint" style="display: none; font-size: 0.85em; color: #0f0; margin-top: 8px;">
                        Use ← → arrow keys to change stages
                    </p>
                </div>
            </div>

            <div class="debug-content" id="tab-animals">
                <div class="control-bar">
                    <label><input type="checkbox" id="dbg-animals-master" checked> Spawning Enabled</label>
                    <button class="danger-btn" id="dbg-kill-all">Kill All Animals</button>
                </div>
                <div class="animal-grid" id="dbg-animal-list">
                    <!-- Populated dynamically -->
                </div>
            </div>

            <div class="debug-content" id="tab-spawning">
                <div class="control-group">
                    <h4>Spawn Entity</h4>
                    <select id="dbg-spawn-select">
                        <!-- Populated dynamically -->
                    </select>
                    <div class="button-row">
                        <button class="spawn-btn" data-count="1">Spawn 1</button>
                        <button class="spawn-btn" data-count="5">Spawn 5</button>
                        <button class="spawn-btn" data-count="10">Spawn 10</button>
                    </div>
                    <button class="spawn-btn full-width" data-count="pack">Spawn Pack (Random)</button>
                </div>
                </div>
            </div>

            <div class="debug-content" id="tab-perf">
                <div class="control-group">
                    <h4>Three-Perf Monitor</h4>
                    <p style="font-size: 0.9em; color: #aaa;">
                        Using <b>three-perf</b> library. 
                        Performance overlay is shown while this tab is active.
                    </p>
                </div>
            </div>
        `;

        this.populateAnimalList();
        this.populateSpawnSelect();

        // Sync UI with Game State
        const castCheck = document.getElementById('dbg-cast-shadows');
        if (castCheck && this.game) {
            castCheck.checked = !!this.game.terrainCastShadows;
            this.settings.world.castShadows = castCheck.checked;
        }
    }

    populateAnimalList() {
        const grid = document.getElementById('dbg-animal-list');
        if (!grid) return;

        const animals = Object.keys(AnimalClasses).sort();

        // "All" / "None" helper buttons
        const header = document.createElement('div');
        header.className = 'grid-header';
        header.innerHTML = `
            <button class="mini-btn" id="dbg-anim-all">Check All</button>
            <button class="mini-btn" id="dbg-anim-none">Uncheck All</button>
        `;
        grid.appendChild(header);

        animals.forEach(name => {
            const label = document.createElement('label');
            label.className = 'animal-checkbox';
            label.innerHTML = `
                <input type="checkbox" value="${name}" checked>
                <span>${name}</span>
            `;
            grid.appendChild(label);
        });

        // Bind header buttons
        grid.querySelector('#dbg-anim-all').onclick = () => this.toggleAllAnimals(true);
        grid.querySelector('#dbg-anim-none').onclick = () => this.toggleAllAnimals(false);
    }

    populateSpawnSelect() {
        const select = document.getElementById('dbg-spawn-select');
        if (!select) return;

        const animals = Object.keys(AnimalClasses).sort();
        animals.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        });

        // Add non-animal entities if needed (like Dragon?)
        // The registry mostly has animals, but we can manually add others if they expose a class
    }

    bindEvents() {
        // Tab Switching
        this.container.querySelectorAll('.debug-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                this.container.querySelectorAll('.debug-tab').forEach(b => b.classList.remove('active'));
                this.container.querySelectorAll('.debug-content').forEach(c => c.classList.remove('active'));

                btn.classList.add('active');
                document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');

                if (btn.dataset.tab === 'perf') {
                    this.startPerfMonitor();
                } else {
                    this.stopPerfMonitor();
                }

                // Update community button visibility based on tab
                if (this.game.uiManager && this.game.uiManager.updateFeedbackButtonState) {
                    this.game.uiManager.updateFeedbackButtonState();
                }
            });
        });

        // Close Button
        document.getElementById('dbg-close').addEventListener('click', () => this.toggle(false));

        // General Toggles
        this.bindCheckbox('dbg-chunks', (val) => {
            this.settings.world.updateChunks = val;
            if (this.game.gameState) this.game.gameState.debug.chunks = val;
        });
        this.bindCheckbox('dbg-terrain', (val) => {
            this.settings.world.showTerrain = val;
            this.game.toggleTerrain(val);
        });
        this.bindCheckbox('dbg-env', (val) => {
            this.settings.world.dayNightCycle = val;
            if (this.game.gameState) this.game.gameState.debug.environment = val;
        });
        this.bindCheckbox('dbg-moon', (val) => {
            if (this.game.environment) this.game.environment.toggleMoon(val);
        });
        this.bindCheckbox('dbg-particles', (val) => {
            this.settings.world.particles = val;
            if (this.game.gameState) this.game.gameState.debug.particles = val;
        });
        this.bindCheckbox('dbg-particles', (val) => {
            this.settings.world.particles = val;
            if (this.game.gameState) this.game.gameState.debug.particles = val;
        });
        this.bindCheckbox('dbg-shadows', (val) => {
            this.settings.world.shadows = val;
            if (this.game.toggleTerrainShadows) this.game.toggleTerrainShadows(val);
            // Reset auto-disable flag when user manually toggles shadows
            if (val) {
                this.game.shadowsAutoDisabled = false;
                console.log('[Debug] Terrain shadows manually re-enabled (auto-disable reset)');
            }
        });
        this.bindCheckbox('dbg-cast-shadows', (val) => {
            this.settings.world.castShadows = val;
            if (this.game.toggleTerrainCastShadows) this.game.toggleTerrainCastShadows(val);
        });
        this.bindCheckbox('dbg-water', (val) => {
            this.settings.world.water = val;
            if (this.game.toggleWater) this.game.toggleWater(val);
        });
        this.bindCheckbox('dbg-weather', (val) => {
            if (this.game.toggleWeather) this.game.toggleWeather(val);
        });
        this.bindCheckbox('dbg-grass', (val) => {
            this.settings.world.grass = val;
            if (this.game.toggleGrass) this.game.toggleGrass(val);
        });
        this.bindCheckbox('dbg-plants', (val) => {
            this.settings.world.plants = val;
            if (this.game.togglePlants) this.game.togglePlants(val);
        });
        this.bindCheckbox('dbg-buildings', (val) => {
            this.settings.world.buildings = val;
            if (this.game.toggleBuildings) this.game.toggleBuildings(val);
        });

        // Entity Toggles
        this.bindCheckbox('dbg-creatures', (val) => {
            this.settings.entities.creatures = val;
            if (this.game.toggleCreatures) this.game.toggleCreatures(val);
        });
        this.bindCheckbox('dbg-villagers', (val) => {
            this.settings.entities.villagers = val;
            if (this.game.toggleVillagers) this.game.toggleVillagers(val);
        });
        this.bindCheckbox('dbg-spaceships', (val) => {
            this.settings.entities.spaceships = val;
            if (this.game.toggleSpaceships) this.game.toggleSpaceships(val);
        });

        this.bindCheckbox('dbg-fps', (val) => {
            // Toggle FPS counter visibility
            if (this.game.stats) {
                this.game.stats.dom.style.display = val ? 'block' : 'none';
            }
            this.updateProfilerState();
        });

        // Animal Toggles
        document.getElementById('dbg-animals-master').addEventListener('change', (e) => {
            this.settings.animals.enabled = e.target.checked;
            if (this.game.spawnManager) {
                this.game.spawnManager.isSpawningEnabled = e.target.checked;
            }
        });

        document.getElementById('dbg-kill-all').addEventListener('click', () => {
            // Also disable spawning to prevent immediate repopulation
            const spawnCheck = document.getElementById('dbg-animals-master');
            if (spawnCheck && spawnCheck.checked) {
                spawnCheck.click(); // Trigger change event to sync state
            }
            this.game.killAllAnimals();
        });

        // Individual Animal Checkboxes (delegation)
        document.getElementById('dbg-animal-list').addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                const name = e.target.value;
                if (e.target.checked) {
                    this.settings.animals.allowed.add(name);
                } else {
                    this.settings.animals.allowed.delete(name);
                }

                // Sync with SpawnManager
                if (this.game.spawnManager) {
                    this.game.spawnManager.allowedAnimals = this.settings.animals.allowed;
                }

                if (this.game.toggleAnimalVisibility) {
                    this.game.toggleAnimalVisibility(name, e.target.checked);
                }
            }
        });

        // Spawning Buttons
        document.querySelectorAll('.spawn-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const countType = btn.dataset.count;
                const type = document.getElementById('dbg-spawn-select').value;
                this.handleSpawn(type, countType);
            });
        });

        // Profiler Test Scene Button
        const profilerTestBtn = document.getElementById('dbg-profiler-test');
        if (profilerTestBtn) {
            profilerTestBtn.addEventListener('click', () => {
                if (this.game.profilerTestScene) {
                    this.game.profilerTestScene.toggle();
                    const isActive = this.game.profilerTestScene.isActive;
                    profilerTestBtn.textContent = isActive ? '⏹ Stop Profiler Test' : '🔬 Start Profiler Test Scene';
                    document.getElementById('dbg-profiler-hint').style.display = isActive ? 'block' : 'none';
                }
            });
        }
    }

    bindCheckbox(id, callback) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', (e) => callback(e.target.checked));
        }
    }

    toggleAllAnimals(state) {
        const list = document.getElementById('dbg-animal-list');
        list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = state;
            const name = cb.value;
            if (state) this.settings.animals.allowed.add(name);
            else this.settings.animals.allowed.delete(name);

            if (this.game.toggleAnimalVisibility) {
                this.game.toggleAnimalVisibility(name, state);
            }
        });

        if (this.game.spawnManager) {
            this.game.spawnManager.allowedAnimals = this.settings.animals.allowed;
        }
    }

    toggle(force) {
        if (typeof force === 'boolean') this.isVisible = force;
        else this.isVisible = !this.isVisible;

        if (this.isVisible) {
            this.container.classList.remove('hidden');
            this.updateStats(); // Update stats on open
            this.startStatsMonitor(); // Start polling
        } else {
            this.container.classList.add('hidden');
            this.stopPerfMonitor();
            this.stopStatsMonitor(); // Stop stats polling
        }
    }

    startStatsMonitor() {
        if (this.statsInterval) return;
        this.statsInterval = setInterval(() => this.updateStats(), 500); // 2Hz update for counts
    }

    stopStatsMonitor() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
    }

    startPerfMonitor() {
        if (this.perfInterval) return;
        this.updateProfilerState();
        this.perfInterval = setInterval(() => this.updatePerf(), 100);
    }

    stopPerfMonitor() {
        if (this.perfInterval) {
            clearInterval(this.perfInterval);
            this.perfInterval = null;
        }
    }

    updateProfilerState() {
        if (!this.game.perf) return;
        const perfTabActive = this.container.querySelector('.debug-tab[data-tab="perf"]').classList.contains('active');

        // Show if tab is active
        this.game.perf.visible = perfTabActive;

        // Update UI button visibility
        if (this.game.uiManager && this.game.uiManager.updateFeedbackButtonState) {
            this.game.uiManager.updateFeedbackButtonState();
        }
    }

    updatePerf() {
        // three-perf handles its own rendering
    }

    handleSpawn(type, countStr) {
        let count = 1;
        if (countStr === 'pack') {
            count = Math.floor(Math.random() * 4) + 2; // 2-5
        } else {
            count = parseInt(countStr, 10);
        }

        const AnimalClass = AnimalClasses[type];
        if (!AnimalClass) return;

        this.game.spawnManager.spawnEntitiesInFrontOfPlayer(AnimalClass, count);
    }

    updateStats() {
        if (!this.isVisible) return;

        // Safe access
        const elEntities = document.getElementById('dbg-entity-count');
        const elChunks = document.getElementById('dbg-chunk-count');

        if (elEntities) elEntities.textContent = this.game.animals.length;
        if (elChunks) {
            const total = this.game.chunks.size;
            const visible = this.game.visibleChunkCount || 0;
            elChunks.textContent = `${visible} / ${total}`;
        }
    }
}

