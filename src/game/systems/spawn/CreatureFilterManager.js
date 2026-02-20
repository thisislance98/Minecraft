/**
 * CreatureFilterManager - Manages creature whitelist/blacklist filtering
 *
 * Handles world settings creature restrictions and despawning disallowed entities.
 */

// Mapping from creature display names to ambient manager property names
// NOTE: All ambient creatures archived. Re-add mappings as creatures are recreated.
const AMBIENT_MANAGER_MAP = {};

// Default counts for respawning ambient managers
const AMBIENT_MANAGER_COUNTS = {};

export class CreatureFilterManager {
    constructor(game, entityRegistry) {
        this.game = game;
        this.entityRegistry = entityRegistry;
        this.allowedCreatures = null; // null = all allowed, Set = whitelist
        this.allowedAnimals = null; // Legacy support
        this.clearedManagers = new Set(); // Track which managers were cleared
    }

    /**
     * Set the allowed creatures list from world settings
     * Also despawns existing creatures that are no longer allowed
     * @param {string[]|null} creatureList - Array of creature type names, or null for all allowed
     */
    setAllowedCreatures(creatureList) {
        const previousAllowed = this.allowedCreatures;

        if (creatureList === null || creatureList === undefined) {
            this.allowedCreatures = null;
            console.log('[CreatureFilterManager] Allowed creatures: ALL');
        } else if (Array.isArray(creatureList)) {
            this.allowedCreatures = new Set(creatureList);
            console.log(`[CreatureFilterManager] Allowed creatures: ${creatureList.length} types`);
        } else {
            console.warn('[CreatureFilterManager] Invalid creature list, using all');
            this.allowedCreatures = null;
        }

        // Handle ambient manager respawning if going from restricted to allowing more
        if (this.allowedCreatures === null && previousAllowed !== null) {
            // Going from restricted to all allowed - respawn all cleared managers
            this.respawnClearedManagers();
        } else if (this.allowedCreatures !== null && previousAllowed !== null) {
            // Check if any previously disallowed ambient creatures are now allowed
            this.respawnNewlyAllowedManagers(previousAllowed);
        }

        // Despawn creatures that are no longer allowed
        if (this.allowedCreatures !== null) {
            this.despawnDisallowedCreatures();
        }
    }

    /**
     * Remove all creatures from the world that are not in the allowed list
     */
    despawnDisallowedCreatures() {
        if (this.allowedCreatures === null) {
            return;
        }

        // First, handle EntityRegistry entities (individual animals)
        const entities = this.entityRegistry.getAllEntities();
        const toRemove = [];

        // Find all creatures that should be removed
        for (const [id, entity] of entities) {
            const typeName = entity.constructor.name;
            if (!this.allowedCreatures.has(typeName)) {
                toRemove.push({ id, entity, typeName });
            }
        }

        if (toRemove.length > 0) {
            console.log(`[CreatureFilterManager] Despawning ${toRemove.length} individual creatures that are no longer allowed`);

            for (const { id, entity, typeName } of toRemove) {
                console.log(`[CreatureFilterManager] Despawning ${typeName} (${id})`);

                // Remove from scene
                if (entity.mesh) {
                    this.game.scene.remove(entity.mesh);
                }
                if (entity.group) {
                    this.game.scene.remove(entity.group);
                }

                // Call dispose if available
                if (entity.dispose) {
                    entity.dispose();
                }

                // Remove from entity registry
                this.entityRegistry.removeEntity(id);

                // Remove from game.animals array
                const index = this.game.animals.indexOf(entity);
                if (index > -1) {
                    this.game.animals.splice(index, 1);
                }

                // Notify server to remove entity (for persistence)
                if (this.game.socketManager) {
                    this.game.socketManager.sendEntityRemove(id);
                }
            }

            console.log(`[CreatureFilterManager] Despawned ${toRemove.length} creatures. Remaining: ${this.entityRegistry.size}`);
        }

        // Then, handle ambient managers (birds, butterflies, pixies, etc.)
        this.clearDisallowedAmbientManagers();
    }

    /**
     * Clear ambient managers (BirdManager, ButterflyManager, etc.) that are not allowed
     */
    clearDisallowedAmbientManagers() {
        if (!this.game.entityManager) {
            console.log('[CreatureFilterManager] No entityManager found, skipping ambient manager cleanup');
            return;
        }

        // Get all unique manager property names
        const allManagerNames = new Set(Object.values(AMBIENT_MANAGER_MAP));

        for (const managerName of allManagerNames) {
            // Check if any variant of this creature type is allowed
            const isAllowed = this.isAmbientManagerAllowed(managerName);

            if (!isAllowed) {
                const manager = this.game.entityManager[managerName];
                if (manager && manager.clear && !this.clearedManagers.has(managerName)) {
                    console.log(`[CreatureFilterManager] Clearing ${managerName} (not in allowed list)`);
                    manager.clear();
                    this.clearedManagers.add(managerName);
                }
            }
        }
    }

    /**
     * Check if any creature type that maps to this manager is in the allowed list
     * @param {string} managerName - The manager property name (e.g., 'birdManager')
     * @returns {boolean}
     */
    isAmbientManagerAllowed(managerName) {
        if (this.allowedCreatures === null) return true;

        // Find all creature names that map to this manager
        for (const [creatureName, mappedManager] of Object.entries(AMBIENT_MANAGER_MAP)) {
            if (mappedManager === managerName && this.allowedCreatures.has(creatureName)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Respawn all ambient managers that were previously cleared
     */
    respawnClearedManagers() {
        if (!this.game.entityManager) return;

        for (const managerName of this.clearedManagers) {
            this.respawnAmbientManager(managerName);
        }
        this.clearedManagers.clear();
    }

    /**
     * Respawn ambient managers that are newly allowed (compared to previous filter)
     * @param {Set} previousAllowed - The previous allowed creatures set
     */
    respawnNewlyAllowedManagers(previousAllowed) {
        if (!this.game.entityManager) return;

        for (const managerName of this.clearedManagers) {
            // Check if this manager is now allowed but wasn't before
            if (this.isAmbientManagerAllowed(managerName)) {
                console.log(`[CreatureFilterManager] ${managerName} is now allowed, respawning`);
                this.respawnAmbientManager(managerName);
                this.clearedManagers.delete(managerName);
            }
        }
    }

    /**
     * Respawn a specific ambient manager
     * @param {string} managerName - The manager property name
     */
    respawnAmbientManager(managerName) {
        // All ambient creature managers archived — nothing to respawn
        console.warn(`[CreatureFilterManager] Cannot respawn ${managerName}: creature archived`);
    }

    /**
     * Check if a creature type is allowed to spawn
     * @param {string} creatureType - The creature class name (e.g., 'Pig', 'Cow')
     * @returns {boolean}
     */
    isCreatureAllowed(creatureType) {
        if (this.allowedCreatures === null) return true;
        return this.allowedCreatures.has(creatureType);
    }

    /**
     * Get the current filter state
     * @returns {Set|null}
     */
    getAllowedCreatures() {
        return this.allowedCreatures;
    }
}
