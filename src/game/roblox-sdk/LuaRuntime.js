/**
 * LuaRuntime - Fengari-based Lua execution environment
 *
 * Provides a sandboxed Lua runtime with Roblox-like APIs
 */

import * as fengariWeb from 'fengari-web';

// Fengari exports as a CJS module - handle both named and default exports
const fengari = fengariWeb.fengari || fengariWeb.default || fengariWeb;
const lua = fengari.lua;
const lauxlib = fengari.lauxlib;
const lualib = fengari.lualib;

export class LuaRuntime {
    constructor(game) {
        this.game = game;
        this.L = null;
        this._scripts = new Map(); // name -> lua code
        this._connections = []; // Event connections to clean up
        this._instances = new Map(); // instanceId -> JS object (for tracking live instances)
        this._instanceCounter = 0; // Counter for generating unique instance IDs
        this._updateCallbacks = []; // Functions to call each frame
    }

    /**
     * Initialize the Lua state with Roblox-like globals
     */
    init() {
        // Create new Lua state
        this.L = lauxlib.luaL_newstate();
        lualib.luaL_openlibs(this.L);

        // Register our custom APIs
        this._registerGlobals();
        this._registerInstanceAPI();
        this._registerVector3();
        this._registerColor3();
        this._registerCFrame();
        this._registerWorkspace();
        this._registerPlayers();
        this._registerWait();
        this._registerInstanceMetatable();

        console.log('[LuaRuntime] Initialized');
        return this;
    }

    /**
     * Register Lua metatable system for Instance proxying
     * This allows `instance.Property = value` to call back into JS
     */
    _registerInstanceMetatable() {
        // Inject Lua code that wraps Instance.new to add metatables
        const luaCode = `
-- Store the original Instance.new
local originalInstanceNew = Instance.new

-- Override Instance.new to wrap returned instances with metatables
Instance.new = function(className, parent)
    local instance = originalInstanceNew(className, parent)
    if not instance then return nil end

    -- Check if instance has _set method (indicates it's a wrapped instance)
    if instance._set then
        -- Create a proxy table with metatable
        local proxy = {}
        local mt = {
            __index = function(t, k)
                -- First check if it's a method
                if type(instance[k]) == "function" then
                    return instance[k]
                end
                -- Use _get for live property values (Position, Size, etc.)
                -- This ensures we get the current value, not a stale copy
                if instance._get then
                    local val = instance._get(k)
                    if val ~= nil then
                        return val
                    end
                end
                return instance[k]
            end,
            __newindex = function(t, k, v)
                -- Use _set to update the live JS instance
                if instance._set then
                    instance._set(k, v)
                else
                    rawset(instance, k, v)
                end
            end
        }
        setmetatable(proxy, mt)

        -- Copy methods to proxy for direct access
        for k, v in pairs(instance) do
            if type(v) == "function" and not k:match("^_") then
                proxy[k] = v
            end
        end

        return proxy
    end

    return instance
end
`;
        this.execute(luaCode, 'instance_metatable_setup');
    }

    /**
     * Execute Lua code
     * @param {string} code - Lua source code
     * @param {string} [name='script'] - Script name for errors
     * @returns {{success: boolean, error?: string}}
     */
    execute(code, name = 'script') {
        if (!this.L) {
            return { success: false, error: 'Lua runtime not initialized' };
        }

        try {
            // Load the code
            const status = lauxlib.luaL_loadstring(this.L, fengari.to_luastring(code));
            if (status !== lua.LUA_OK) {
                const error = lua.lua_tojsstring(this.L, -1);
                lua.lua_pop(this.L, 1);
                return { success: false, error: `Parse error: ${error}` };
            }

            // Execute
            const result = lua.lua_pcall(this.L, 0, lua.LUA_MULTRET, 0);
            if (result !== lua.LUA_OK) {
                const error = lua.lua_tojsstring(this.L, -1);
                lua.lua_pop(this.L, 1);
                return { success: false, error: `Runtime error: ${error}` };
            }

            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Update loop - call each frame
     * @param {number} dt - Delta time
     */
    update(dt) {
        // Call legacy update callbacks
        for (const callback of this._updateCallbacks) {
            try {
                callback(dt);
            } catch (e) {
                console.error('[LuaRuntime] Update error:', e);
            }
        }

        // Call RunService.Heartbeat callbacks (these are Lua functions)
        if (this._heartbeatCallbacks && this._heartbeatCallbacks.length > 0) {
            for (const callback of this._heartbeatCallbacks) {
                try {
                    // Lua callbacks expect delta time as argument
                    callback(dt);
                } catch (e) {
                    console.error('[LuaRuntime] Heartbeat error:', e);
                }
            }
        }
    }

    /**
     * Clean up
     */
    destroy() {
        this._connections.forEach(c => c.Disconnect?.());
        this._connections = [];
        this._updateCallbacks = [];
        this._instances.clear();

        if (this.L) {
            lua.lua_close(this.L);
            this.L = null;
        }
    }

    // ===== INTERNAL: Register APIs =====

    _registerGlobals() {
        const L = this.L;

        // print function
        this._pushFunction('print', (...args) => {
            console.log('[Lua]', ...args);
        });

        // warn function
        this._pushFunction('warn', (...args) => {
            console.warn('[Lua]', ...args);
        });

        // error function
        this._pushFunction('error', (msg) => {
            throw new Error(msg);
        });

        // typeof (Roblox uses typeof, not type for instances)
        this._pushFunction('typeof', (obj) => {
            if (obj === null || obj === undefined) return 'nil';
            if (obj._className) return obj._className;
            return typeof obj;
        });

        // tick() - returns time in seconds
        this._pushFunction('tick', () => {
            return performance.now() / 1000;
        });

        // time() alias
        this._pushFunction('time', () => {
            return performance.now() / 1000;
        });
    }

    _registerWait() {
        // wait(seconds) - yields execution (simplified: just schedules)
        this._pushFunction('wait', (seconds = 0.03) => {
            // In real Roblox this yields the coroutine
            // We'll return the actual time waited
            return seconds;
        });

        // task.wait - modern Roblox API
        this._setGlobal('task', {
            wait: (seconds = 0) => seconds,
            spawn: (fn) => setTimeout(fn, 0),
            delay: (seconds, fn) => setTimeout(fn, seconds * 1000),
        });
    }

    _registerVector3() {
        // Store on instance for use by factory functions (avoids _getGlobal corruption)
        const runtime = this;

        // Helper to create a Vector3 with arithmetic methods
        const createVector3 = (x = 0, y = 0, z = 0) => {
            const vec = {
                _className: 'Vector3',
                X: x, Y: y, Z: z,
                x, y, z, // lowercase aliases
                Magnitude: Math.sqrt(x*x + y*y + z*z),
                Unit: null, // computed lazily

                // Methods
                Lerp: function(other, alpha) {
                    return createVector3(
                        this.X + (other.X - this.X) * alpha,
                        this.Y + (other.Y - this.Y) * alpha,
                        this.Z + (other.Z - this.Z) * alpha
                    );
                },
                Cross: function(other) {
                    return createVector3(
                        this.Y * other.Z - this.Z * other.Y,
                        this.Z * other.X - this.X * other.Z,
                        this.X * other.Y - this.Y * other.X
                    );
                },
                Dot: function(other) {
                    return this.X * other.X + this.Y * other.Y + this.Z * other.Z;
                },

                // Arithmetic methods (Lua doesn't support operator overloading via JS)
                // AI should use these methods instead of + - * /
                add: function(other) {
                    if (typeof other === 'number') {
                        return createVector3(this.X + other, this.Y + other, this.Z + other);
                    }
                    return createVector3(this.X + other.X, this.Y + other.Y, this.Z + other.Z);
                },
                sub: function(other) {
                    if (typeof other === 'number') {
                        return createVector3(this.X - other, this.Y - other, this.Z - other);
                    }
                    return createVector3(this.X - other.X, this.Y - other.Y, this.Z - other.Z);
                },
                mul: function(scalar) {
                    return createVector3(this.X * scalar, this.Y * scalar, this.Z * scalar);
                },
                div: function(scalar) {
                    return createVector3(this.X / scalar, this.Y / scalar, this.Z / scalar);
                },
            };
            return vec;
        };

        const Vector3 = {
            new: createVector3,
            zero: createVector3(0, 0, 0),
            one: createVector3(1, 1, 1),
            xAxis: createVector3(1, 0, 0),
            yAxis: createVector3(0, 1, 0),
            zAxis: createVector3(0, 0, 1),
        };

        this._Vector3 = Vector3; // Store for internal use
        this._setGlobal('Vector3', Vector3);
    }

    _registerColor3() {
        const runtime = this;
        const Color3 = {
            new: (r = 0, g = 0, b = 0) => ({
                _className: 'Color3',
                R: r, G: g, B: b,
                r, g, b,
                toHex: function() {
                    const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, '0');
                    return parseInt(toHex(this.R) + toHex(this.G) + toHex(this.B), 16);
                }
            }),
            fromRGB: (r, g, b) => runtime._Color3.new(r / 255, g / 255, b / 255),
            fromHSV: (h, s, v) => {
                // HSV to RGB conversion
                const c = v * s;
                const x = c * (1 - Math.abs((h * 6) % 2 - 1));
                const m = v - c;
                let r, g, b;
                if (h < 1/6) { r = c; g = x; b = 0; }
                else if (h < 2/6) { r = x; g = c; b = 0; }
                else if (h < 3/6) { r = 0; g = c; b = x; }
                else if (h < 4/6) { r = 0; g = x; b = c; }
                else if (h < 5/6) { r = x; g = 0; b = c; }
                else { r = c; g = 0; b = x; }
                return runtime._Color3.new(r + m, g + m, b + m);
            },
            fromHex: (hex) => {
                const r = ((hex >> 16) & 255) / 255;
                const g = ((hex >> 8) & 255) / 255;
                const b = (hex & 255) / 255;
                return runtime._Color3.new(r, g, b);
            }
        };

        this._Color3 = Color3; // Store for internal use
        this._setGlobal('Color3', Color3);
    }

    _registerCFrame() {
        const runtime = this;
        const CFrame = {
            new: (x = 0, y = 0, z = 0) => ({
                _className: 'CFrame',
                Position: runtime._Vector3.new(x, y, z),
                X: x, Y: y, Z: z,
                LookVector: { X: 0, Y: 0, Z: -1 },
                RightVector: { X: 1, Y: 0, Z: 0 },
                UpVector: { X: 0, Y: 1, Z: 0 },
            }),
            lookAt: (from, to) => {
                const cf = runtime._CFrame.new(from.X, from.Y, from.Z);
                // Calculate look direction
                const dx = to.X - from.X;
                const dy = to.Y - from.Y;
                const dz = to.Z - from.Z;
                const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
                cf.LookVector = { X: dx/len, Y: dy/len, Z: dz/len };
                return cf;
            }
        };

        this._CFrame = CFrame; // Store for internal use
        this._setGlobal('CFrame', CFrame);
    }

    _registerInstanceAPI() {
        const runtime = this;
        const game = this.game;

        // Instance class registry
        const classRegistry = {
            Part: () => runtime._createPart(),
            Model: () => runtime._createModel(),
            Creature: () => runtime._createCreature(),
            Tool: () => runtime._createTool(),
            Script: () => runtime._createScript(),
            Sound: () => runtime._createSound(),
            ParticleEmitter: () => runtime._createParticleEmitter(),
            PointLight: () => runtime._createPointLight(),
            BodyVelocity: () => runtime._createBodyVelocity(),
            BodyForce: () => runtime._createBodyForce(),
        };

        const Instance = {
            new: (className, parent = null) => {
                console.log(`[LuaRuntime] Instance.new called with className="${className}" (type: ${typeof className})`);
                const factory = classRegistry[className];
                console.log(`[LuaRuntime] Factory for "${className}":`, factory, typeof factory);
                if (!factory) {
                    console.warn(`[LuaRuntime] Unknown class: ${className}`);
                    return null;
                }
                const instance = factory();

                // Assign unique ID and track the instance
                const instanceId = ++runtime._instanceCounter;
                instance._instanceId = instanceId;
                runtime._instances.set(instanceId, instance);

                console.log(`[LuaRuntime] Instance created with ID ${instanceId}:`, instance._className);
                if (parent) {
                    instance.Parent = parent;
                }

                // Return a wrapped instance that will be pushed as userdata with metatable
                return runtime._wrapInstance(instance);
            }
        };

        this._setGlobal('Instance', Instance);
    }

    /**
     * Wrap an instance for Lua with property proxy support
     * Returns an object that _pushValue will convert to a table with __instanceId
     * Lua code must use the property setter functions we provide
     */
    _wrapInstance(instance) {
        const runtime = this;
        const instanceId = instance._instanceId;

        // Create wrapper with methods that modify the live instance
        const wrapper = {
            _className: instance._className,
            _instanceId: instanceId,

            // Property setters that update the live JS instance
            _set: (name, value) => {
                const liveInstance = runtime._instances.get(instanceId);
                if (liveInstance) {
                    // Handle Vector3 and Color3 objects from Lua (they come as plain objects)
                    if (name === 'Size' || name === 'Position') {
                        if (value && (value.X !== undefined || value.x !== undefined)) {
                            value = runtime._Vector3.new(
                                value.X ?? value.x ?? 0,
                                value.Y ?? value.y ?? 0,
                                value.Z ?? value.z ?? 0
                            );
                        }
                    }
                    if (name === 'Color') {
                        if (value && (value.R !== undefined || value.r !== undefined)) {
                            value = runtime._Color3.new(
                                value.R ?? value.r ?? 0,
                                value.G ?? value.g ?? 0,
                                value.B ?? value.b ?? 0
                            );
                        }
                    }
                    console.log(`[LuaRuntime] _set ${instance._className}.${name} =`, value);
                    liveInstance[name] = value;
                    return true;
                }
                return false;
            },

            // Property getter
            _get: (name) => {
                const liveInstance = runtime._instances.get(instanceId);
                if (liveInstance) {
                    return liveInstance[name];
                }
                return null;
            }
        };

        // Copy all methods from instance, bound to the live instance
        for (const key of Object.keys(instance)) {
            if (typeof instance[key] === 'function' && !key.startsWith('_')) {
                wrapper[key] = (...args) => {
                    const liveInstance = runtime._instances.get(instanceId);
                    if (liveInstance && typeof liveInstance[key] === 'function') {
                        return liveInstance[key].apply(liveInstance, args);
                    }
                };
            }
        }

        // Copy current property values (for reading in Lua)
        for (const key of ['Name', 'Size', 'Position', 'Color', 'Shape', 'Parent', 'Transparency',
                           'Health', 'MaxHealth', 'Speed', 'Behavior', 'Icon', 'MeshType']) {
            try {
                const val = instance[key];
                if (val !== undefined) {
                    wrapper[key] = val;
                }
            } catch (e) {}
        }

        return wrapper;
    }

    _registerWorkspace() {
        const runtime = this;
        const game = this.game;

        const workspace = {
            _className: 'Workspace',
            Name: 'Workspace',
            _children: [],

            // Get ground level at position
            GetGroundLevel: (x, z) => {
                if (game?.getGroundLevel) {
                    return game.getGroundLevel(x, z);
                }
                return 0;
            },

            // Get current player position (always returns fresh values)
            GetPlayerPosition: (...args) => {
                // Handle both dot and colon syntax
                const player = game?.player;
                const pos = player?.position || { x: 32, y: 35, z: 32 };
                return runtime._Vector3.new(pos.x, pos.y, pos.z);
            },

            // Find first child by name
            FindFirstChild: function(name) {
                return this._children.find(c => c.Name === name) || null;
            },

            // Get all children
            GetChildren: function() {
                return [...this._children];
            },

            // Raycast
            Raycast: (origin, direction, params = {}) => {
                // Simplified raycast - just check ground
                const groundY = workspace.GetGroundLevel(origin.X, origin.Z);
                if (origin.Y > groundY && direction.Y < 0) {
                    return {
                        Position: { X: origin.X, Y: groundY, Z: origin.Z },
                        Normal: { X: 0, Y: 1, Z: 0 },
                        Instance: null,
                        Material: 'Grass'
                    };
                }
                return null;
            },

            // Block manipulation (Minecraft-specific)
            // Note: All methods handle both dot and colon syntax from Lua
            SetBlock: (...args) => {
                // Handle workspace:SetBlock(x, y, z, type) vs workspace.SetBlock(x, y, z, type)
                const [x, y, z, blockType] = typeof args[0] === 'object' ? args.slice(1) : args;
                if (window.VoxelWorld) {
                    window.VoxelWorld.setBlock(x, y, z, blockType);
                }
            },

            GetBlock: (...args) => {
                const [x, y, z] = typeof args[0] === 'object' ? args.slice(1) : args;
                if (window.VoxelWorld) {
                    return window.VoxelWorld.getBlock(x, y, z);
                }
                return null;
            },

            Fill: (...args) => {
                const [x1, y1, z1, x2, y2, z2, blockType] = typeof args[0] === 'object' ? args.slice(1) : args;
                if (window.VoxelWorld) {
                    window.VoxelWorld.fill(x1, y1, z1, x2, y2, z2, blockType);
                }
            },

            SpawnTree: (...args) => {
                const [treeType, x, y, z] = typeof args[0] === 'object' ? args.slice(1) : args;
                if (window.VoxelWorld) {
                    window.VoxelWorld.spawnTree(treeType, x, y, z);
                }
            },

            // Spawn existing animals (Pig, Wolf, Cow, etc.)
            // Note: When called with colon syntax (workspace:SpawnAnimal), first arg is 'self'
            SpawnAnimal: (selfOrType, typeOrPos, posOrCount, maybeCount) => {
                // Handle both workspace:SpawnAnimal(type, pos, count) and workspace.SpawnAnimal(type, pos, count)
                let animalType, position, count;
                if (typeof selfOrType === 'string') {
                    // Called with dot syntax: SpawnAnimal("Wolf", pos, 1)
                    animalType = selfOrType;
                    position = typeOrPos;
                    count = posOrCount ?? 1;
                } else {
                    // Called with colon syntax: workspace:SpawnAnimal("Wolf", pos, 1)
                    // selfOrType is workspace (self), typeOrPos is the type, etc.
                    animalType = typeOrPos;
                    position = posOrCount;
                    count = maybeCount ?? 1;
                }

                // Debug logging (can be removed in production)
                // console.log(`[LuaRuntime] SpawnAnimal: type=${animalType}, count=${count}, position=`, position);

                // Look up the animal class from AnimalClasses registry
                const AnimalClasses = window.AnimalClasses;
                const AnimalClass = AnimalClasses?.[animalType];
                if (!AnimalClass) {
                    console.error(`[LuaRuntime] SpawnAnimal: Unknown animal type "${animalType}". Available: ${Object.keys(AnimalClasses || {}).join(', ')}`);
                    return false;
                }

                // Use spawnManager.spawnEntitiesInFrontOfPlayer if no position, or createAnimal for specific position
                if (game?.spawnManager) {
                    if (position && (position.X !== undefined || position.x !== undefined)) {
                        // Spawn at specific position
                        const x = position.X ?? position.x ?? 0;
                        const y = position.Y ?? position.y ?? 60;
                        const z = position.Z ?? position.z ?? 0;

                        const results = [];
                        for (let i = 0; i < count; i++) {
                            // Add slight offset for multiple spawns
                            const offsetX = count > 1 ? (i - count/2) * 2 : 0;
                            const animal = game.spawnManager.createAnimal(AnimalClass, x + offsetX, y, z, true);
                            if (animal) results.push(animal);
                        }
                        return results.length > 0;
                    } else {
                        // Spawn in front of player
                        const results = game.spawnManager.spawnEntitiesInFrontOfPlayer(animalType, count);
                        return results.length > 0;
                    }
                }
                console.warn('[LuaRuntime] SpawnAnimal: No spawnManager available');
                return false;
            },

            // Give item to player
            GiveItem: (...args) => {
                const [itemName, count = 1] = typeof args[0] === 'object' ? args.slice(1) : args;
                if (window.VoxelWorld) {
                    window.VoxelWorld.giveItem(itemName, count);
                    return true;
                }
                return false;
            },

            // Undo last action
            Undo: (...args) => {
                // No args needed, just handle self if present
                if (window.VoxelWorld) {
                    return window.VoxelWorld.undoLast();
                }
                return false;
            },

            // Destroy all entities of a type
            DestroyAllOfType: (...args) => {
                const [typeName] = typeof args[0] === 'object' ? args.slice(1) : args;
                if (window.VoxelWorld) {
                    window.VoxelWorld.destroyAllOfType(typeName);
                    return true;
                }
                return false;
            }
        };

        this._workspace = workspace; // Store for internal use
        this._setGlobal('workspace', workspace);
        this._setGlobal('Workspace', workspace);

        // Note: game object is created in _registerPlayers to include Players
    }

    _registerPlayers() {
        const runtime = this;
        const game = this.game;

        const localPlayer = {
            _className: 'Player',
            Name: 'Player',
            UserId: 1,

            get Character() {
                // Return an object that reads position dynamically each time
                return {
                    _className: 'Model',
                    Name: 'Character',

                    get Position() {
                        // Read position fresh each time Position is accessed
                        const player = game?.player;
                        const pos = player?.position || { x: 0, y: 60, z: 0 };
                        return runtime._Vector3.new(pos.x, pos.y, pos.z);
                    },

                    get PrimaryPart() {
                        const player = game?.player;
                        const pos = player?.position || { x: 0, y: 60, z: 0 };
                        return {
                            Position: runtime._Vector3.new(pos.x, pos.y, pos.z),
                            CFrame: runtime._CFrame.new(pos.x, pos.y, pos.z)
                        };
                    },

                    FindFirstChild: (name) => {
                        if (name === 'HumanoidRootPart' || name === 'Torso') {
                            const player = game?.player;
                            const pos = player?.position || { x: 0, y: 60, z: 0 };
                            return { Position: runtime._Vector3.new(pos.x, pos.y, pos.z) };
                        }
                        return null;
                    },

                    GetPivot: function() {
                        return this.PrimaryPart.CFrame;
                    }
                };
            }
        };

        const Players = {
            _className: 'Players',
            LocalPlayer: localPlayer,

            GetPlayers: () => [localPlayer],

            PlayerAdded: {
                Connect: (callback) => {
                    // Single player, so just return a dummy connection
                    return { Disconnect: () => {} };
                }
            }
        };

        this._setGlobal('Players', Players);

        // RunService - provides Heartbeat for per-frame updates
        const heartbeatCallbacks = [];
        const RunService = {
            _className: 'RunService',
            Heartbeat: {
                Connect: (callback) => {
                    console.log('[LuaRuntime] RunService.Heartbeat connected');
                    heartbeatCallbacks.push(callback);

                    // Return a connection object
                    return {
                        Disconnect: () => {
                            const idx = heartbeatCallbacks.indexOf(callback);
                            if (idx !== -1) {
                                heartbeatCallbacks.splice(idx, 1);
                                console.log('[LuaRuntime] RunService.Heartbeat disconnected');
                            }
                        }
                    };
                }
            },
            RenderStepped: {
                Connect: (callback) => {
                    // Alias for Heartbeat (RenderStepped is client-only in Roblox)
                    return RunService.Heartbeat.Connect(callback);
                }
            }
        };

        // Store callbacks for update loop
        runtime._heartbeatCallbacks = heartbeatCallbacks;
        this._setGlobal('RunService', RunService);

        // game object with all services
        const gameObj = {
            Workspace: runtime._workspace,
            Players: Players,
            RunService: RunService,
            GetService: (selfOrServiceName, maybeServiceName) => {
                // Handle both game:GetService("Players") and game.GetService("Players")
                // In colon syntax, first arg is self (game), second is the actual arg
                const serviceName = maybeServiceName !== undefined ? maybeServiceName : selfOrServiceName;
                if (serviceName === 'Workspace') return runtime._workspace;
                if (serviceName === 'Players') return Players;
                if (serviceName === 'RunService') return RunService;
                console.warn(`[LuaRuntime] Unknown service: ${serviceName}`);
                return null;
            }
        };

        this._setGlobal('game', gameObj);
    }

    // ===== INTERNAL: Instance Factories =====

    _createPart() {
        const runtime = this;

        const part = {
            _className: 'Part',
            _jsObject: null, // Will hold the Three.js mesh
            Name: 'Part',
            Parent: null,

            // Properties with defaults
            _size: runtime._Vector3.new(1, 1, 1),
            _position: runtime._Vector3.new(0, 0, 0),
            _color: runtime._Color3.new(0.5, 0.5, 0.5),
            _transparency: 0,
            _anchored: true,
            _canCollide: true,
            _material: 'Plastic',
            _shape: 'Block', // Block, Ball, Cylinder

            get Size() { return this._size; },
            set Size(v) {
                this._size = v;
                this._updateMesh();
            },

            get Position() { return this._position; },
            set Position(v) {
                this._position = v;
                this._updateMesh();
            },

            get Color() { return this._color; },
            set Color(v) {
                this._color = v;
                this._updateMesh();
            },

            get BrickColor() { return this._color; },
            set BrickColor(v) { this.Color = v; },

            get Transparency() { return this._transparency; },
            set Transparency(v) {
                this._transparency = v;
                this._updateMesh();
            },

            get Anchored() { return this._anchored; },
            set Anchored(v) { this._anchored = v; },

            get CanCollide() { return this._canCollide; },
            set CanCollide(v) { this._canCollide = v; },

            get Material() { return this._material; },
            set Material(v) { this._material = v; },

            get Shape() { return this._shape; },
            set Shape(v) {
                this._shape = v;
                this._updateMesh();
            },

            // CFrame (position + rotation)
            get CFrame() {
                return runtime._CFrame.new(
                    this._position.X,
                    this._position.Y,
                    this._position.Z
                );
            },
            set CFrame(cf) {
                this._position = cf.Position;
                this._updateMesh();
            },

            // Methods
            Destroy: function() {
                if (this._jsObject && runtime.game?.scene) {
                    runtime.game.scene.remove(this._jsObject);
                    if (this._jsObject.geometry) this._jsObject.geometry.dispose();
                    if (this._jsObject.material) this._jsObject.material.dispose();
                }
                this._jsObject = null;
            },

            Clone: function() {
                const clone = runtime._createPart();
                clone._size = { ...this._size };
                clone._position = { ...this._position };
                clone._color = { ...this._color };
                clone._transparency = this._transparency;
                clone._shape = this._shape;
                return clone;
            },

            _updateMesh: function() {
                if (!this.Parent) return; // Only create mesh when parented

                const THREE = window.THREE;
                if (!THREE || !runtime.game?.scene) return;

                // Remove old mesh
                if (this._jsObject) {
                    runtime.game.scene.remove(this._jsObject);
                }

                // Create geometry based on shape
                let geometry;
                switch (this._shape) {
                    case 'Ball':
                        geometry = new THREE.SphereGeometry(
                            Math.max(this._size.X, this._size.Y, this._size.Z) / 2,
                            16, 16
                        );
                        break;
                    case 'Cylinder':
                        geometry = new THREE.CylinderGeometry(
                            this._size.X / 2,
                            this._size.X / 2,
                            this._size.Y,
                            16
                        );
                        break;
                    default: // Block
                        geometry = new THREE.BoxGeometry(
                            this._size.X,
                            this._size.Y,
                            this._size.Z
                        );
                }

                // Create material
                const material = new THREE.MeshStandardMaterial({
                    color: this._color.toHex ? this._color.toHex() : 0x888888,
                    transparent: this._transparency > 0,
                    opacity: 1 - this._transparency,
                    roughness: 0.7,
                    metalness: 0.1
                });

                // Create mesh
                this._jsObject = new THREE.Mesh(geometry, material);
                this._jsObject.position.set(
                    this._position.X,
                    this._position.Y,
                    this._position.Z
                );
                this._jsObject.castShadow = true;
                this._jsObject.receiveShadow = true;

                runtime.game.scene.add(this._jsObject);
            }
        };

        // Watch Parent changes to trigger mesh creation
        let _parent = null;
        Object.defineProperty(part, 'Parent', {
            get: () => _parent,
            set: (v) => {
                _parent = v;
                if (v) {
                    part._updateMesh();
                    if (v._children) {
                        v._children.push(part);
                    }
                }
            }
        });

        return part;
    }

    _createModel() {
        const runtime = this;

        return {
            _className: 'Model',
            Name: 'Model',
            Parent: null,
            _children: [],
            _primaryPart: null,

            get PrimaryPart() { return this._primaryPart; },
            set PrimaryPart(v) { this._primaryPart = v; },

            GetChildren: function() {
                return [...this._children];
            },

            FindFirstChild: function(name) {
                return this._children.find(c => c.Name === name) || null;
            },

            SetPrimaryPartCFrame: function(cf) {
                if (this._primaryPart) {
                    this._primaryPart.CFrame = cf;
                }
            },

            GetPivot: function() {
                if (this._primaryPart) {
                    return this._primaryPart.CFrame;
                }
                return runtime._CFrame.new(0, 0, 0);
            },

            Destroy: function() {
                for (const child of this._children) {
                    child.Destroy?.();
                }
                this._children = [];
            }
        };
    }

    _createCreature() {
        const runtime = this;

        const creature = {
            _className: 'Creature',
            Name: 'Creature',
            Parent: null,
            _sdkEntity: null,

            // Creature-specific properties
            _health: 20,
            _maxHealth: 20,
            _speed: 2,
            _behavior: 'passive', // passive, neutral, hostile, pet
            _color: runtime._Color3.fromRGB(255, 255, 255),
            _size: runtime._Vector3.new(1, 1, 1),
            _position: runtime._Vector3.new(0, 50, 0),

            get Health() { return this._health; },
            set Health(v) { this._health = v; },

            get MaxHealth() { return this._maxHealth; },
            set MaxHealth(v) { this._maxHealth = v; },

            get Speed() { return this._speed; },
            set Speed(v) { this._speed = v; },

            get Behavior() { return this._behavior; },
            set Behavior(v) { this._behavior = v; },

            get Color() { return this._color; },
            set Color(v) { this._color = v; },

            get Size() { return this._size; },
            set Size(v) { this._size = v; },

            get Position() { return this._position; },
            set Position(v) { this._position = v; },

            // Spawn the creature using VoxelWorld SDK
            Spawn: function() {
                if (!window.VoxelWorld) {
                    console.error('[LuaRuntime] VoxelWorld not available');
                    return;
                }

                const colorHex = this._color.toHex ? this._color.toHex() : 0xffffff;

                // Create creature using existing SDK
                window.VoxelWorld.createCreature(this.Name, {
                    mesh: [
                        { type: 'box', size: [this._size.X, this._size.Y * 0.6, this._size.Z], color: colorHex, position: [0, this._size.Y * 0.3, 0] },
                        { type: 'box', size: [this._size.X * 0.8, this._size.Y * 0.5, this._size.Z * 0.6], color: colorHex, position: [0, this._size.Y * 0.6, this._size.Z * 0.3] },
                        { type: 'sphere', size: [0.1], color: 0xffffff, position: [-this._size.X * 0.25, this._size.Y * 0.7, this._size.Z * 0.4] },
                        { type: 'sphere', size: [0.1], color: 0xffffff, position: [this._size.X * 0.25, this._size.Y * 0.7, this._size.Z * 0.4] },
                        { type: 'sphere', size: [0.05], color: 0x000000, position: [-this._size.X * 0.25, this._size.Y * 0.7, this._size.Z * 0.45] },
                        { type: 'sphere', size: [0.05], color: 0x000000, position: [this._size.X * 0.25, this._size.Y * 0.7, this._size.Z * 0.45] },
                    ],
                    behavior: this._behavior,
                    health: this._maxHealth,
                    speed: this._speed
                }).register();

                this._sdkEntity = window.VoxelWorld.spawn(
                    this.Name.toLowerCase(),
                    this._position.X,
                    this._position.Y,
                    this._position.Z
                );

                console.log(`[LuaRuntime] Spawned creature: ${this.Name}`);
            },

            Destroy: function() {
                if (this._sdkEntity && window.VoxelWorld) {
                    window.VoxelWorld.destroyEntity(this._sdkEntity);
                }
            }
        };

        return creature;
    }

    _createTool() {
        const runtime = this;

        const tool = {
            _className: 'Tool',
            Name: 'Tool',
            Parent: null,
            _registered: false,

            // Tool properties
            _grip: runtime._CFrame.new(0, 0, 0),
            _icon: '',
            _canDrop: true,
            _enabled: true,
            _requiresHandle: true,

            // Visual properties (for 3D model)
            _color: runtime._Color3.new(0.5, 0.5, 0.5),
            _size: runtime._Vector3.new(0.1, 0.1, 0.5),
            _meshType: 'box', // box, cylinder, sphere

            // Behavior
            _onActivated: null,
            _onDeactivated: null,
            _onEquipped: null,
            _onUnequipped: null,

            get Grip() { return this._grip; },
            set Grip(v) { this._grip = v; },

            get Icon() { return this._icon; },
            set Icon(v) { this._icon = v; },

            get CanDrop() { return this._canDrop; },
            set CanDrop(v) { this._canDrop = v; },

            get Enabled() { return this._enabled; },
            set Enabled(v) { this._enabled = v; },

            get Color() { return this._color; },
            set Color(v) { this._color = v; },

            get Size() { return this._size; },
            set Size(v) { this._size = v; },

            get MeshType() { return this._meshType; },
            set MeshType(v) { this._meshType = v; },

            // Events (Roblox-style)
            Activated: {
                Connect: function(callback) {
                    tool._onActivated = callback;
                    return { Disconnect: () => { tool._onActivated = null; } };
                }
            },

            Equipped: {
                Connect: function(callback) {
                    tool._onEquipped = callback;
                    return { Disconnect: () => { tool._onEquipped = null; } };
                }
            },

            // Register the tool with the game's item system
            Register: function() {
                if (this._registered) {
                    console.warn(`[LuaRuntime] Tool '${this.Name}' already registered`);
                    return;
                }

                if (!window.VoxelWorld) {
                    console.error('[LuaRuntime] VoxelWorld not available');
                    return;
                }

                const colorHex = this._color.toHex ? this._color.toHex() : 0x888888;

                // Build mesh config
                let meshConfig;
                if (this._meshType === 'cylinder') {
                    meshConfig = { type: 'cylinder', size: [this._size.X, this._size.X, this._size.Y], color: colorHex };
                } else if (this._meshType === 'sphere') {
                    meshConfig = { type: 'sphere', size: [Math.max(this._size.X, this._size.Y, this._size.Z) / 2], color: colorHex };
                } else {
                    meshConfig = { type: 'box', size: [this._size.X, this._size.Y, this._size.Z], color: colorHex };
                }

                // Create using VoxelWorld SDK
                window.VoxelWorld.createItem(this.Name, {
                    mesh: meshConfig,
                    icon: this._icon || `<svg viewBox="0 0 64 64"><rect x="28" y="10" width="8" height="44" fill="#888"/></svg>`,
                    category: 'tool'
                }).register();

                this._registered = true;
                console.log(`[LuaRuntime] Registered tool: ${this.Name}`);
            },

            // Give this tool to the player
            GiveToPlayer: function() {
                if (!this._registered) {
                    this.Register();
                }

                if (window.VoxelWorld) {
                    window.VoxelWorld.giveItem(this.Name.toLowerCase().replace(/\s+/g, '_'));
                    console.log(`[LuaRuntime] Gave tool to player: ${this.Name}`);
                }
            },

            Destroy: function() {
                // Tools don't have a visual representation until equipped
                this._registered = false;
            }
        };

        return tool;
    }

    _createScript() {
        const runtime = this;
        let _parent = null;
        let _source = '';
        let _hasRun = false;

        const script = {
            _className: 'Script',
            Name: 'Script',
            Disabled: false,
            _instanceId: null, // Set by Instance.new

            get Source() { return _source; },
            set Source(v) {
                _source = v;
                // Auto-run when source is set and we have a parent
                if (_parent && !script.Disabled && _source && !_hasRun) {
                    setTimeout(() => script.Run(), 0);
                }
            },

            get Parent() {
                // Return the parent wrapped for Lua access
                if (_parent && _parent._instanceId) {
                    const liveParent = runtime._instances.get(_parent._instanceId);
                    if (liveParent) {
                        return runtime._wrapInstance(liveParent);
                    }
                }
                return _parent;
            },
            set Parent(v) {
                // Store the parent (could be JS object or wrapped instance)
                _parent = v;
                // If it's a wrapped instance, store reference to live object
                if (v && v._instanceId) {
                    _parent = runtime._instances.get(v._instanceId) || v;
                }
                // Auto-run when parented (like Roblox)
                if (v && !script.Disabled && _source && !_hasRun) {
                    setTimeout(() => script.Run(), 0);
                }
            },

            // Run the script
            Run: function() {
                if (this.Disabled || !_source || _hasRun) return;
                _hasRun = true;
                console.log('[LuaRuntime] Running script:', this.Name);

                // Set up the 'script' global to reference this script object
                // This allows code to access script.Parent, etc.
                runtime._setGlobal('script', runtime._wrapInstance(script));

                runtime.execute(_source, this.Name);
            }
        };

        return script;
    }

    _createSound() {
        const runtime = this;

        return {
            _className: 'Sound',
            Name: 'Sound',
            Parent: null,
            SoundId: '',
            Volume: 1,
            Looped: false,
            Playing: false,
            _audio: null,

            Play: function() {
                if (!this.SoundId) return;
                try {
                    this._audio = new Audio(this.SoundId);
                    this._audio.volume = this.Volume;
                    this._audio.loop = this.Looped;
                    this._audio.play();
                    this.Playing = true;
                } catch (e) {
                    console.warn('[LuaRuntime] Failed to play sound:', e);
                }
            },

            Stop: function() {
                if (this._audio) {
                    this._audio.pause();
                    this._audio.currentTime = 0;
                    this.Playing = false;
                }
            },

            Destroy: function() {
                this.Stop();
                this._audio = null;
            }
        };
    }

    _createParticleEmitter() {
        return {
            _className: 'ParticleEmitter',
            Name: 'ParticleEmitter',
            Parent: null,
            Color: null,
            Size: null,
            Rate: 10,
            Lifetime: { Min: 1, Max: 2 },
            Enabled: true,

            Emit: function(count) {
                // Hook into game's particle system if available
                console.log(`[LuaRuntime] Emit ${count} particles`);
            },

            Destroy: function() {
                this.Enabled = false;
            }
        };
    }

    _createPointLight() {
        const runtime = this;

        return {
            _className: 'PointLight',
            Name: 'PointLight',
            Parent: null,
            _brightness: 1,
            _color: runtime._Color3.new(1, 1, 1),
            _range: 10,
            _jsLight: null,

            get Brightness() { return this._brightness; },
            set Brightness(v) {
                this._brightness = v;
                if (this._jsLight) this._jsLight.intensity = v;
            },

            get Color() { return this._color; },
            set Color(v) {
                this._color = v;
                if (this._jsLight) this._jsLight.color.setHex(v.toHex());
            },

            get Range() { return this._range; },
            set Range(v) {
                this._range = v;
                if (this._jsLight) this._jsLight.distance = v;
            },

            Destroy: function() {
                if (this._jsLight && runtime.game?.scene) {
                    runtime.game.scene.remove(this._jsLight);
                }
            }
        };
    }

    _createBodyVelocity() {
        return {
            _className: 'BodyVelocity',
            Name: 'BodyVelocity',
            Parent: null,
            Velocity: null,
            MaxForce: null,
            Destroy: function() {}
        };
    }

    _createBodyForce() {
        return {
            _className: 'BodyForce',
            Name: 'BodyForce',
            Parent: null,
            Force: null,
            Destroy: function() {}
        };
    }

    // ===== INTERNAL: Helper Methods =====

    _pushFunction(name, fn) {
        const L = this.L;
        const runtime = this;

        // Fengari expects: function(L) -> number of return values
        const wrappedFn = function(L) {
            // Get number of arguments passed
            const nargs = lua.lua_gettop(L);

            // Convert all Lua args to JS
            const jsArgs = [];
            for (let i = 1; i <= nargs; i++) {
                jsArgs.push(runtime._luaToJS(i));
            }

            // Call the JS function
            const result = fn(...jsArgs);

            // Push result if any
            if (result !== undefined) {
                runtime._pushValue(result);
                return 1;
            }
            return 0;
        };

        // Store in a closure that Fengari can call
        lua.lua_pushjsfunction(L, wrappedFn);
        lua.lua_setglobal(L, fengari.to_luastring(name));
    }

    _setGlobal(name, value) {
        const L = this.L;
        this._pushValue(value);
        lua.lua_setglobal(L, fengari.to_luastring(name));
    }

    _getGlobal(name) {
        const L = this.L;
        lua.lua_getglobal(L, fengari.to_luastring(name));
        const value = this._luaToJS(-1);
        lua.lua_pop(L, 1);
        return value;
    }

    _pushValue(value) {
        const L = this.L;
        const runtime = this;

        if (value === null || value === undefined) {
            lua.lua_pushnil(L);
        } else if (typeof value === 'boolean') {
            lua.lua_pushboolean(L, value);
        } else if (typeof value === 'number') {
            lua.lua_pushnumber(L, value);
        } else if (typeof value === 'string') {
            lua.lua_pushstring(L, fengari.to_luastring(value));
        } else if (typeof value === 'function') {
            // Wrap JS function for Fengari's C-style API
            const fn = value;
            const wrappedFn = function(L) {
                const nargs = lua.lua_gettop(L);
                const jsArgs = [];
                for (let i = 1; i <= nargs; i++) {
                    jsArgs.push(runtime._luaToJS(i));
                }
                const result = fn(...jsArgs);
                if (result !== undefined) {
                    runtime._pushValue(result);
                    return 1;
                }
                return 0;
            };
            lua.lua_pushjsfunction(L, wrappedFn);
        } else if (typeof value === 'object') {
            // Push as table
            lua.lua_newtable(L);

            // Get all property names including getters/setters
            const allProps = new Set([
                ...Object.keys(value),
                ...Object.getOwnPropertyNames(value)
            ]);

            for (const k of allProps) {
                // Skip most private/internal properties (start with _)
                // BUT allow special properties needed for instance proxying
                const allowedUnderscoreProps = ['_className', '_set', '_get', '_instanceId'];
                if (k.startsWith('_') && !allowedUnderscoreProps.includes(k)) continue;

                try {
                    const v = value[k]; // This will trigger getters
                    lua.lua_pushstring(L, fengari.to_luastring(k));
                    // Bind methods to the object so 'this' works correctly
                    if (typeof v === 'function') {
                        this._pushValue(v.bind(value));
                    } else {
                        this._pushValue(v);
                    }
                    lua.lua_settable(L, -3);
                } catch (e) {
                    // Getter might throw if not ready
                    console.warn(`[LuaRuntime] Error getting property ${k}:`, e.message);
                }
            }
        }
    }

    _luaToJS(index) {
        const L = this.L;
        const type = lua.lua_type(L, index);

        switch (type) {
            case lua.LUA_TNIL:
                return null;
            case lua.LUA_TBOOLEAN:
                return lua.lua_toboolean(L, index);
            case lua.LUA_TNUMBER:
                return lua.lua_tonumber(L, index);
            case lua.LUA_TSTRING:
                return lua.lua_tojsstring(L, index);
            case lua.LUA_TTABLE:
                // Convert table to object
                const obj = {};
                lua.lua_pushnil(L);
                while (lua.lua_next(L, index < 0 ? index - 1 : index) !== 0) {
                    const key = this._luaToJS(-2);
                    const val = this._luaToJS(-1);
                    obj[key] = val;
                    lua.lua_pop(L, 1);
                }
                return obj;
            case lua.LUA_TFUNCTION:
                // Store function in Lua registry to preserve it across calls
                // This is necessary because stack indices become invalid after the current call returns
                lua.lua_pushvalue(L, index);
                const funcRef = lauxlib.luaL_ref(L, lua.LUA_REGISTRYINDEX);
                const runtime = this;

                // Return a wrapper that retrieves the function from registry
                return (...args) => {
                    // Get function from registry
                    lua.lua_rawgeti(L, lua.LUA_REGISTRYINDEX, funcRef);
                    // Push arguments
                    for (const arg of args) {
                        runtime._pushValue(arg);
                    }
                    // Call the Lua function
                    const callResult = lua.lua_pcall(L, args.length, 1, 0);
                    if (callResult !== lua.LUA_OK) {
                        const err = lua.lua_tojsstring(L, -1);
                        lua.lua_pop(L, 1);
                        console.error('[LuaRuntime] Callback error:', err);
                        return null;
                    }
                    const result = runtime._luaToJS(-1);
                    lua.lua_pop(L, 1);
                    return result;
                };
            default:
                return null;
        }
    }

    _jsToLua(value) {
        this._pushValue(value);
        return 1; // Number of return values
    }
}

export default LuaRuntime;
