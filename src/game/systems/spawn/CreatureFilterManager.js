/**
 * CreatureFilterManager - Manages creature whitelist/blacklist filtering
 *
 * Handles world settings creature restrictions and despawning disallowed entities.
 */

// Mapping from creature display names to ambient manager property names
const AMBIENT_MANAGER_MAP = {
    'Bird': 'birdManager',
    'Birds': 'birdManager',
    'BirdManager': 'birdManager',
    'Butterfly': 'butterflyManager',
    'Butterflies': 'butterflyManager',
    'ButterflyManager': 'butterflyManager',
    'Pixie': 'pixieManager',
    'Pixies': 'pixieManager',
    'PixieManager': 'pixieManager',
    'Fairy': 'pixieManager',
    'Fairies': 'pixieManager',
    'Bat': 'batManager',
    'Bats': 'batManager',
    'BatManager': 'batManager',
    'Mosquito': 'mosquitoManager',
    'Mosquitoes': 'mosquitoManager',
    'MosquitoManager': 'mosquitoManager'
};

// Default counts for respawning ambient managers
const AMBIENT_MANAGER_COUNTS = {
    'birdManager': 5,
    'butterflyManager': 10,
    'pixieManager': 5,
    'batManager': 8,
    'mosquitoManager': 5
};

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
        const entityManager = this.game.entityManager;
        if (!entityManager) return;

        const count = AMBIENT_MANAGER_COUNTS[managerName] || 5;
        console.log(`[CreatureFilterManager] Respawning ${managerName} with count ${count}`);

        // Import the manager class dynamically based on name
        try {
            switch (managerName) {
                case 'birdManager':
                    import('../../entities/animals/Birds.js').then(module => {
                        if (entityManager[managerName]) {
                            entityManager[managerName].clear?.();
                        }
                        entityManager[managerName] = new module.BirdManager(this.game, count);
                    });
                    break;
                case 'butterflyManager':
                    import('../../entities/animals/Butterflies.js').then(module => {
                        if (entityManager[managerName]) {
                            entityManager[managerName].clear?.();
                        }
                        entityManager[managerName] = new module.ButterflyManager(this.game, count);
                    });
                    break;
                case 'pixieManager':
                    import('../../entities/animals/Pixies.js').then(module => {
                        if (entityManager[managerName]) {
                            entityManager[managerName].clear?.();
                        }
                        entityManager[managerName] = new module.PixieManager(this.game, count);
                    });
                    break;
                case 'batManager':
                    import('../../entities/animals/Bats.js').then(module => {
                        if (entityManager[managerName]) {
                            entityManager[managerName].clear?.();
                        }
                        entityManager[managerName] = new module.BatManager(this.game, count);
                    });
                    break;
                case 'mosquitoManager':
                    import('../../entities/animals/Mosquitoes.js').then(module => {
                        if (entityManager[managerName]) {
                            entityManager[managerName].clear?.();
                        }
                        entityManager[managerName] = new module.MosquitoManager(this.game, count);
                    });
                    break;
                default:
                    console.warn(`[CreatureFilterManager] Unknown manager: ${managerName}`);
            }
        } catch (e) {
            console.error(`[CreatureFilterManager] Failed to respawn ${managerName}:`, e);
        }
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
