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
                shadows: true,
                water: true,
                weather: true
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
                    <label><input type="checkbox" id="dbg-water" checked> Water</label>
                    <label><input type="checkbox" id="dbg-weather" checked> Weather</label>
                </div>
                <div class="control-group">
                    <h4>Stats</h4>
                    <label><input type="checkbox" id="dbg-fps"> Show FPS</label>
                    <p>Entities: <span id="dbg-entity-count">0</span></p>
                    <p>Chunks: <span id="dbg-chunk-count">0</span></p>
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
                    <h4>Frame Budget (16ms)</h4>
                    <div id="dbg-perf-bars" class="perf-bars">
                        <!-- Bars injected here -->
                    </div>
                    <div style="margin-top: 10px; font-size: 11px; color: #888;">
                        *Values are smoothed averages
                    </div>
                </div>
            </div>
        `;

        this.populateAnimalList();
        this.populateSpawnSelect();
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
        });
        this.bindCheckbox('dbg-water', (val) => {
            this.settings.world.water = val;
            if (this.game.toggleWater) this.game.toggleWater(val);
        });
        this.bindCheckbox('dbg-weather', (val) => {
            if (this.game.toggleWeather) this.game.toggleWeather(val);
        });

        this.bindCheckbox('dbg-fps', (val) => {
            this.game.toggleStats(val);
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
        } else {
            this.container.classList.add('hidden');
            this.stopPerfMonitor();
        }
    }

    startPerfMonitor() {
        if (this.perfInterval) return;
        this.perfInterval = setInterval(() => this.updatePerf(), 100);
    }

    stopPerfMonitor() {
        if (this.perfInterval) {
            clearInterval(this.perfInterval);
            this.perfInterval = null;
        }
    }

    updatePerf() {
        if (!this.game.profiler) return;
        const report = this.game.profiler.getReport();
        const container = document.getElementById('dbg-perf-bars');
        if (!container) return;

        container.innerHTML = report.map(item => {
            const width = Math.min(100, (item.time / 16.66) * 100);
            const color = item.time > 10 ? '#ff5555' : (item.time > 5 ? '#ffaa00' : '#55ff55');
            return `
                <div class="perf-row">
                    <span class="perf-label">${item.label}</span>
                    <div class="perf-track">
                        <div class="perf-bar" style="width: ${width}%; background: ${color}"></div>
                    </div>
                    <span class="perf-val">${item.time.toFixed(2)}ms</span>
                </div>
            `;
        }).join('');
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
        if (elChunks) elChunks.textContent = this.game.chunks.size;
    }
}
