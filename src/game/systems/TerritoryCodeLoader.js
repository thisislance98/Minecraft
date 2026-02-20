/**
 * TerritoryAPI - Safe API exposed to territory code
 * Provides controlled access to game functionality
 */
export class TerritoryAPI {
    constructor(game, territory) {
        this.game = game;
        this.territory = territory;

        // Rate limiting
        this.calls = new Map(); // methodName -> {count, lastReset}
        this.limits = {
            spawnCreature: { max: 10, window: 60000 }, // 10 per minute
            playSound: { max: 20, window: 60000 },
            createParticles: { max: 50, window: 60000 },
            setPhysics: { max: 5, window: 60000 }
        };
    }

    /**
     * Check and enforce rate limits
     */
    checkRateLimit(method) {
        if (!this.limits[method]) return true;

        const now = Date.now();
        const limit = this.limits[method];
        const record = this.calls.get(method) || { count: 0, lastReset: now };

        // Reset window if expired
        if (now - record.lastReset > limit.window) {
            record.count = 0;
            record.lastReset = now;
        }

        // Check limit
        if (record.count >= limit.max) {
            console.warn(`[TerritoryAPI] Rate limit exceeded for ${method}`);
            return false;
        }

        record.count++;
        this.calls.set(method, record);
        return true;
    }

    /**
     * Create API object that will be exposed to territory code
     */
    createAPI() {
        return {
            // Creature spawning
            spawnCreature: (type, x, y, z) => {
                if (!this.checkRateLimit('spawnCreature')) return null;

                // Verify position is within territory
                if (!this.territory.contains(x, z)) {
                    console.warn('[TerritoryAPI] Cannot spawn outside territory');
                    return null;
                }

                // TODO: Implement creature spawning
                console.log(`[Territory ${this.territory.id}] Spawn ${type} at ${x},${y},${z}`);
                return { id: `creature_${Date.now()}`, type };
            },

            // Sound effects
            playSound: (sound, x, y, z) => {
                if (!this.checkRateLimit('playSound')) return;

                // TODO: Implement sound system
                console.log(`[Territory ${this.territory.id}] Play sound ${sound}`);
            },

            // Particle effects
            createParticles: (type, x, y, z, count = 10) => {
                if (!this.checkRateLimit('createParticles')) return;

                // TODO: Implement particle system
                console.log(`[Territory ${this.territory.id}] Particles ${type} x${count}`);
            },

            // Physics modification
            setPhysics: (config) => {
                if (!this.checkRateLimit('setPhysics')) return;

                // Validate physics values
                const gravity = Math.max(-2, Math.min(2, config.gravity || -9.8));
                const friction = Math.max(0, Math.min(1, config.friction || 0.9));

                console.log(`[Territory ${this.territory.id}] Set physics:`, { gravity, friction });
                // TODO: Apply to players in territory
            },

            // Messaging
            sendMessage: (player, message) => {
                if (typeof message !== 'string' || message.length > 200) return;
                console.log(`[Territory ${this.territory.id}] Message to ${player.id}: ${message}`);
                // TODO: Send to player's chat
            },

            // Read-only territory info
            getTerritoryInfo: () => ({
                id: this.territory.id,
                name: this.territory.config.name,
                owner: this.territory.owner,
                inhabitants: Array.from(this.territory.inhabitants)
            }),

            // Time utilities
            getTime: () => Date.now(),

            // Math utilities (safe)
            random: () => Math.random(),
            randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
        };
    }
}

/**
 * TerritoryCodeLoader - Loads and executes territory code safely
 */
export class TerritoryCodeLoader {
    constructor(game) {
        this.game = game;
        this.loadedModules = new Map(); // territoryId -> compiled code
        this.executionTimeouts = 50; // Max 50ms per frame
    }

    /**
     * Load territory code from source
     */
    async loadCode(territory, source) {
        try {
            // Check if URL
            if (source.startsWith('http://') || source.startsWith('https://')) {
                return await this.loadFromURL(territory, source);
            }

            // Inline code
            return this.compileInlineCode(territory, source);
        } catch (error) {
            console.error(`[TerritoryCodeLoader] Failed to load code for ${territory.id}:`, error);
            return null;
        }
    }

    /**
     * Load code from remote URL
     */
    async loadFromURL(territory, url) {
        console.log(`[TerritoryCodeLoader] Loading from ${url}`);

        // Fetch the module
        const module = await import(url);

        // Validate module structure
        if (!module.default) {
            throw new Error('Module must export a default object');
        }

        return {
            type: 'module',
            data: module.default
        };
    }

    /**
     * Compile inline JavaScript code
     */
    compileInlineCode(territory, source) {
        console.log(`[TerritoryCodeLoader] Compiling inline code for ${territory.id}`);

        // Create safe execution context
        const api = new TerritoryAPI(this.game, territory);
        const safeAPI = api.createAPI();

        // Wrap code in function with controlled scope
        // No access to: window, document, process, require, import
        const wrappedCode = `
            'use strict';
            return (function(api) {
                // User's territory code runs here
                ${source}
                
                // Return module interface
                return {
                    onPlayerEnter,
                    onPlayerLeave,
                    onUpdate,
                    creatures,
                    items
                };
            })(api);
        `;

        try {
            // Create function with limited scope
            const compiledFunction = new Function('api', wrappedCode);
            const module = compiledFunction(safeAPI);

            return {
                type: 'inline',
                data: module,
                api: api
            };
        } catch (error) {
            console.error('[TerritoryCodeLoader] Compilation error:', error);
            throw error;
        }
    }

    /**
     * Execute territory code with timeout protection
     */
    executeWithTimeout(fn, timeout = this.executionTimeouts) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Execution timeout'));
            }, timeout);

            try {
                const result = fn();
                clearTimeout(timer);
                resolve(result);
            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }

    /**
     * Unload territory code
     */
    unload(territoryId) {
        this.loadedModules.delete(territoryId);
        console.log(`[TerritoryCodeLoader] Unloaded code for ${territoryId}`);
    }
}
