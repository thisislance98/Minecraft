import { Territory } from './Territory.js';

/**
 * TerritoryManager - Manages all territories in the world
 */
export class TerritoryManager {
    constructor(game) {
        this.game = game;
        this.territories = new Map(); // territoryId -> Territory
        this.chunkToTerritory = new Map(); // chunkKey -> territoryId
        this.currentTerritory = null; // Territory player is currently in

        // Config
        this.config = {
            maxTerritoriesPerPlayer: 3,
            minTerritorySize: 2, // chunks
            maxTerritorySize: 16, // chunks
            claimCost: 100 // hypothetical currency
        };
    }

    /**
     * Claim a new territory
     */
    claimTerritory(playerId, bounds) {
        // Validate bounds
        const width = Math.abs(bounds.maxX - bounds.minX);
        const depth = Math.abs(bounds.maxZ - bounds.minZ);

        if (width < this.config.minTerritorySize || depth < this.config.minTerritorySize) {
            console.warn('[TerritoryManager] Territory too small');
            return null;
        }

        if (width > this.config.maxTerritorySize || depth > this.config.maxTerritorySize) {
            console.warn('[TerritoryManager] Territory too large');
            return null;
        }

        // Check for overlaps
        if (this.hasOverlap(bounds)) {
            console.warn('[TerritoryManager] Territory overlaps existing claim');
            return null;
        }

        // Check player territory count
        const playerTerritories = this.getPlayerTerritories(playerId);
        if (playerTerritories.length >= this.config.maxTerritoriesPerPlayer) {
            console.warn('[TerritoryManager] Player has too many territories');
            return null;
        }

        // Create territory
        const territoryId = `territory_${Date.now()}_${playerId}`;
        const territory = new Territory(territoryId, playerId, bounds);

        this.territories.set(territoryId, territory);
        this.indexTerritoryChunks(territory);

        console.log(`[TerritoryManager] ${playerId} claimed territory ${territoryId}`);

        // Notify network
        if (this.game.networkManager?.isConnected()) {
            this.game.networkManager.broadcast({
                type: 'territory_claimed',
                territory: territory.serialize()
            });
        }

        return territory;
    }

    /**
     * Release/unclaim a territory
     */
    releaseTerritory(territoryId, playerId) {
        const territory = this.territories.get(territoryId);

        if (!territory) {
            console.warn('[TerritoryManager] Territory not found');
            return false;
        }

        if (territory.owner !== playerId) {
            console.warn('[TerritoryManager] Player does not own this territory');
            return false;
        }

        // Deactivate and remove
        territory.deactivate();
        this.unindexTerritoryChunks(territory);
        this.territories.delete(territoryId);

        console.log(`[TerritoryManager] Territory ${territoryId} released`);

        // Notify network
        if (this.game.networkManager?.isConnected()) {
            this.game.networkManager.broadcast({
                type: 'territory_released',
                territoryId: territoryId
            });
        }

        return true;
    }

    /**
     * Get territory at a world position
     */
    getTerritoryAt(x, z) {
        const chunkX = Math.floor(x / this.game.chunkSize);
        const chunkZ = Math.floor(z / this.game.chunkSize);
        const chunkKey = `${chunkX},${chunkZ}`;

        const territoryId = this.chunkToTerritory.get(chunkKey);
        return territoryId ? this.territories.get(territoryId) : null;
    }

    /**
     * Check if bounds overlap any existing territory
     */
    hasOverlap(bounds) {
        for (const territory of this.territories.values()) {
            if (this.boundsOverlap(bounds, territory.bounds)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if two bounds overlap
     */
    boundsOverlap(a, b) {
        return !(a.maxX < b.minX || a.minX > b.maxX ||
            a.maxZ < b.minZ || a.minZ > b.maxZ);
    }

    /**
     * Index chunks for quick lookup
     */
    indexTerritoryChunks(territory) {
        const minChunkX = Math.floor(territory.bounds.minX / this.game.chunkSize);
        const maxChunkX = Math.floor(territory.bounds.maxX / this.game.chunkSize);
        const minChunkZ = Math.floor(territory.bounds.minZ / this.game.chunkSize);
        const maxChunkZ = Math.floor(territory.bounds.maxZ / this.game.chunkSize);

        for (let cx = minChunkX; cx <= maxChunkX; cx++) {
            for (let cz = minChunkZ; cz <= maxChunkZ; cz++) {
                const chunkKey = `${cx},${cz}`;
                this.chunkToTerritory.set(chunkKey, territory.id);
            }
        }
    }

    /**
     * Remove chunk index for territory
     */
    unindexTerritoryChunks(territory) {
        const minChunkX = Math.floor(territory.bounds.minX / this.game.chunkSize);
        const maxChunkX = Math.floor(territory.bounds.maxX / this.game.chunkSize);
        const minChunkZ = Math.floor(territory.bounds.minZ / this.game.chunkSize);
        const maxChunkZ = Math.floor(territory.bounds.maxZ / this.game.chunkSize);

        for (let cx = minChunkX; cx <= maxChunkX; cx++) {
            for (let cz = minChunkZ; cz <= maxChunkZ; cz++) {
                const chunkKey = `${cx},${cz}`;
                this.chunkToTerritory.delete(chunkKey);
            }
        }
    }

    /**
     * Get all territories owned by a player
     */
    getPlayerTerritories(playerId) {
        return Array.from(this.territories.values())
            .filter(t => t.owner === playerId);
    }

    /**
     * Update - check for boundary crossings
     */
    update(deltaTime) {
        // Check if player crossed territory boundary
        const playerPos = this.game.player.position;
        const newTerritory = this.getTerritoryAt(playerPos.x, playerPos.z);

        if (newTerritory !== this.currentTerritory) {
            // Boundary crossed!
            if (this.currentTerritory) {
                this.currentTerritory.onPlayerLeave(this.game.player);
            }

            if (newTerritory) {
                newTerritory.onPlayerEnter(this.game.player);
            }

            this.currentTerritory = newTerritory;
        }

        // Update active territories
        for (const territory of this.territories.values()) {
            if (territory.isActive) {
                territory.update(deltaTime);
            }
        }
    }

    /**
     * Receive territory data from network
     */
    receiveTerritoryData(data) {
        const territory = Territory.deserialize(data);
        this.territories.set(territory.id, territory);
        this.indexTerritoryChunks(territory);
        console.log(`[TerritoryManager] Received territory ${territory.id}`);
    }
}
