/**
 * GraphicsSettingsManager - Handles graphics quality presets and settings
 */
export class GraphicsSettingsManager {
    constructor(game, uiManager) {
        this.game = game;
        this.uiManager = uiManager;

        // DOM Elements
        this.renderDistanceSlider = document.getElementById('settings-render-distance');
        this.renderDistanceValue = document.getElementById('render-distance-value');
        this.shadowsToggle = document.getElementById('settings-shadows-toggle');
        this.particlesToggle = document.getElementById('settings-particles-toggle');
        this.grassToggle = document.getElementById('settings-grass-toggle');
        this.weatherToggle = document.getElementById('settings-weather-toggle');
    }

    initialize() {
        // Load saved graphics settings or use defaults
        const savedPreset = localStorage.getItem('settings_graphics_preset') || 'balanced';
        const savedRenderDistance = parseInt(localStorage.getItem('settings_render_distance')) || 6;
        const savedShadows = localStorage.getItem('settings_shadows') !== 'false';
        const savedParticles = localStorage.getItem('settings_particles') !== 'false';
        const savedGrass = localStorage.getItem('settings_grass') !== 'false';
        const savedWeather = localStorage.getItem('settings_weather') !== 'false';

        // Apply initial states to UI
        if (this.renderDistanceSlider) {
            this.renderDistanceSlider.value = savedRenderDistance;
            if (this.renderDistanceValue) this.renderDistanceValue.textContent = savedRenderDistance;
        }
        if (this.shadowsToggle) this.shadowsToggle.checked = savedShadows;
        if (this.particlesToggle) this.particlesToggle.checked = savedParticles;
        if (this.grassToggle) this.grassToggle.checked = savedGrass;
        if (this.weatherToggle) this.weatherToggle.checked = savedWeather;

        // Apply loaded settings to game
        this.applyGraphicsSettings({
            renderDistance: savedRenderDistance,
            shadows: savedShadows,
            particles: savedParticles,
            grass: savedGrass,
            weather: savedWeather
        });

        // Update preset button states
        this.updatePresetButtonState(savedPreset);

        // Setup event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Render Distance slider
        if (this.renderDistanceSlider) {
            this.renderDistanceSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (this.renderDistanceValue) this.renderDistanceValue.textContent = value;
                localStorage.setItem('settings_render_distance', value);
                localStorage.setItem('settings_graphics_preset', 'custom');
                this.updatePresetButtonState('custom');

                if (this.game.renderDistance !== undefined) {
                    this.game.renderDistance = value;
                    console.log(`[GraphicsSettingsManager] Render distance set to: ${value}`);
                }
            });
        }

        // Shadows toggle
        if (this.shadowsToggle) {
            this.shadowsToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_shadows', enabled);
                localStorage.setItem('settings_graphics_preset', 'custom');
                this.updatePresetButtonState('custom');

                if (this.game.toggleTerrainShadows) {
                    this.game.toggleTerrainShadows(enabled);
                }
                if (enabled) this.game.shadowsAutoDisabled = false;
            });
        }

        // Particles toggle
        if (this.particlesToggle) {
            this.particlesToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_particles', enabled);
                localStorage.setItem('settings_graphics_preset', 'custom');
                this.updatePresetButtonState('custom');

                if (this.game.gameState) {
                    this.game.gameState.debug.particles = enabled;
                }
            });
        }

        // Grass toggle
        if (this.grassToggle) {
            this.grassToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_grass', enabled);
                localStorage.setItem('settings_graphics_preset', 'custom');
                this.updatePresetButtonState('custom');

                if (this.game.toggleGrass) {
                    this.game.toggleGrass(enabled);
                }
            });
        }

        // Weather toggle
        if (this.weatherToggle) {
            this.weatherToggle.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('settings_weather', enabled);
                localStorage.setItem('settings_graphics_preset', 'custom');
                this.updatePresetButtonState('custom');

                if (this.game.toggleWeather) {
                    this.game.toggleWeather(enabled);
                }
            });
        }

        // Preset buttons
        const presetFast = document.getElementById('preset-fast');
        const presetBalanced = document.getElementById('preset-balanced');
        const presetBeautiful = document.getElementById('preset-beautiful');

        if (presetFast) {
            presetFast.addEventListener('click', () => this.applyGraphicsPreset('fast'));
        }
        if (presetBalanced) {
            presetBalanced.addEventListener('click', () => this.applyGraphicsPreset('balanced'));
        }
        if (presetBeautiful) {
            presetBeautiful.addEventListener('click', () => this.applyGraphicsPreset('beautiful'));
        }
    }

    /**
     * Apply a graphics preset
     */
    applyGraphicsPreset(preset) {
        const presets = {
            fast: {
                renderDistance: 3,
                shadows: false,
                particles: false,
                grass: false,
                weather: false
            },
            balanced: {
                renderDistance: 6,
                shadows: true,
                particles: true,
                grass: true,
                weather: true
            },
            beautiful: {
                renderDistance: 10,
                shadows: true,
                particles: true,
                grass: true,
                weather: true
            }
        };

        const settings = presets[preset];
        if (!settings) return;

        // Update UI toggles
        if (this.renderDistanceSlider) {
            this.renderDistanceSlider.value = settings.renderDistance;
            if (this.renderDistanceValue) this.renderDistanceValue.textContent = settings.renderDistance;
        }
        if (this.shadowsToggle) this.shadowsToggle.checked = settings.shadows;
        if (this.particlesToggle) this.particlesToggle.checked = settings.particles;
        if (this.grassToggle) this.grassToggle.checked = settings.grass;
        if (this.weatherToggle) this.weatherToggle.checked = settings.weather;

        // Save to localStorage
        localStorage.setItem('settings_graphics_preset', preset);
        localStorage.setItem('settings_render_distance', settings.renderDistance);
        localStorage.setItem('settings_shadows', settings.shadows);
        localStorage.setItem('settings_particles', settings.particles);
        localStorage.setItem('settings_grass', settings.grass);
        localStorage.setItem('settings_weather', settings.weather);

        // Apply to game
        this.applyGraphicsSettings(settings);

        // Update preset button state
        this.updatePresetButtonState(preset);

        console.log(`[GraphicsSettingsManager] Applied graphics preset: ${preset}`);
    }

    /**
     * Apply graphics settings to the game
     */
    applyGraphicsSettings(settings) {
        // Render distance
        if (this.game.renderDistance !== undefined) {
            this.game.renderDistance = settings.renderDistance;
        }

        // Shadows
        if (this.game.toggleTerrainShadows) {
            this.game.toggleTerrainShadows(settings.shadows);
        }
        if (!settings.shadows) {
            this.game.shadowsAutoDisabled = false;
        }

        // Particles
        if (this.game.gameState) {
            this.game.gameState.debug.particles = settings.particles;
        }

        // Grass
        if (this.game.toggleGrass) {
            this.game.toggleGrass(settings.grass);
        }

        // Weather
        if (this.game.toggleWeather) {
            this.game.toggleWeather(settings.weather);
        }
    }

    /**
     * Update preset button active states
     */
    updatePresetButtonState(activePreset) {
        const buttons = ['preset-fast', 'preset-balanced', 'preset-beautiful'];
        buttons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.classList.remove('active');
                if (id === `preset-${activePreset}`) {
                    btn.classList.add('active');
                }
            }
        });
    }

    cleanup() {
        // Nothing to clean up
    }
}
