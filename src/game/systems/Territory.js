/**
 * Territory - Represents a claimed chunk region with custom code/content
 */
export class Territory {
    constructor(id, owner, bounds) {
        this.id = id;
        this.owner = owner; // playerId
        this.bounds = bounds; // { minX, maxX, minZ, maxZ }

        this.config = {
            name: 'Unnamed Territory',
            version: '1.0.0',
            dependencies: {}
        };

        this.modules = {
            creatures: null,
            items: null,
            physics: null,
            events: null
        };

        this.permissions = {
            canBuild: [owner],
            canEdit: [owner],
            canView: [] // Empty = public
        };

        this.code = {
            source: null,
            compiled: null
        };

        this.isActive = false;
        this.inhabitants = new Set(); // Current players in territory
    }

    /**
     * Check if a position is within this territory
     */
    contains(x, z) {
        return x >= this.bounds.minX && x <= this.bounds.maxX &&
            z >= this.bounds.minZ && z <= this.bounds.maxZ;
    }

    /**
     * Check if a player has permission for an action
     */
    hasPermission(playerId, action) {
        if (playerId === this.owner) return true;

        const permissionList = this.permissions[action];
        return permissionList && permissionList.includes(playerId);
    }

    /**
     * Load custom code module
     */
    async loadModule(moduleType, source) {
        try {
            // Dynamic import if URL provided
            if (source.startsWith('http://') || source.startsWith('https://')) {
                this.modules[moduleType] = await import(source);
            } else {
                // Inline code - will be handled by TerritoryCodeLoader
                this.code.source = source;
            }
            console.log(`[Territory ${this.id}] Loaded ${moduleType} module`);
        } catch (error) {
            console.error(`[Territory ${this.id}] Failed to load ${moduleType}:`, error);
        }
    }

    /**
     * Activate territory - called when first player enters
     */
    activate() {
        if (this.isActive) return;

        console.log(`[Territory ${this.id}] Activating`);
        this.isActive = true;

        // Call module initialization if exists
        if (this.modules.events?.onActivate) {
            this.modules.events.onActivate();
        }
    }

    /**
     * Deactivate territory - called when last player leaves
     */
    deactivate() {
        if (!this.isActive) return;

        console.log(`[Territory ${this.id}] Deactivating`);
        this.isActive = false;

        // Call module cleanup if exists
        if (this.modules.events?.onDeactivate) {
            this.modules.events.onDeactivate();
        }
    }

    /**
     * Handle player entering territory
     */
    onPlayerEnter(player) {
        this.inhabitants.add(player.id);

        if (this.inhabitants.size === 1) {
            this.activate();
        }

        console.log(`[Territory ${this.id}] Player ${player.id} entered`);

        // Call custom event handler
        if (this.modules.events?.onPlayerEnter) {
            this.modules.events.onPlayerEnter(player);
        }
    }

    /**
     * Handle player leaving territory
     */
    onPlayerLeave(player) {
        this.inhabitants.delete(player.id);

        if (this.inhabitants.size === 0) {
            this.deactivate();
        }

        console.log(`[Territory ${this.id}] Player ${player.id} left`);

        // Call custom event handler
        if (this.modules.events?.onPlayerLeave) {
            this.modules.events.onPlayerLeave(player);
        }
    }

    /**
     * Update territory logic (called every frame if active)
     */
    update(deltaTime) {
        if (!this.isActive) return;

        // Call custom update handler
        if (this.modules.events?.onUpdate) {
            this.modules.events.onUpdate(deltaTime);
        }
    }

    /**
     * Serialize for network transmission
     */
    serialize() {
        return {
            id: this.id,
            owner: this.owner,
            bounds: this.bounds,
            config: this.config,
            permissions: this.permissions,
            code: this.code.source
        };
    }

    /**
     * Deserialize from network data
     */
    static deserialize(data) {
        const territory = new Territory(data.id, data.owner, data.bounds);
        territory.config = data.config;
        territory.permissions = data.permissions;
        territory.code.source = data.code;
        return territory;
    }
}
