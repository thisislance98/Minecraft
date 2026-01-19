/**
 * EntityRegistry - Manages entity tracking, registration, and lookups
 *
 * Provides a centralized registry for all spawned entities with ID-based access.
 */

import { AnimalClasses } from '../../AnimalRegistry.js';

export class EntityRegistry {
    constructor() {
        this.entities = new Map(); // id -> Animal
    }

    /**
     * Register an entity in the registry
     * @param {string} id - Unique entity ID
     * @param {Object} entity - The entity instance
     */
    register(id, entity) {
        this.entities.set(id, entity);
    }

    /**
     * Remove an entity from the registry
     * @param {string} id - Entity ID to remove
     * @returns {boolean} - True if entity was found and removed
     */
    removeEntity(id) {
        return this.entities.delete(id);
    }

    /**
     * Get an entity by ID
     * @param {string} id - Entity ID
     * @returns {Object|undefined}
     */
    get(id) {
        return this.entities.get(id);
    }

    /**
     * Check if an entity exists
     * @param {string} id - Entity ID
     * @returns {boolean}
     */
    has(id) {
        return this.entities.has(id);
    }

    /**
     * Get all entities as Map entries
     * @returns {IterableIterator}
     */
    getAllEntities() {
        return this.entities;
    }

    /**
     * Get the number of registered entities
     * @returns {number}
     */
    get size() {
        return this.entities.size;
    }

    /**
     * Clear all entities from registry
     */
    clear() {
        this.entities.clear();
    }

    /**
     * Find an animal class by name
     * @param {string} typeName - The class name (e.g., 'Pig', 'Cow')
     * @returns {Function|null} - The class constructor or null
     */
    findAnimalClass(typeName) {
        return AnimalClasses[typeName] || null;
    }

    /**
     * Get all entity IDs
     * @returns {string[]}
     */
    getAllIds() {
        return Array.from(this.entities.keys());
    }

    /**
     * Get all entities of a specific type
     * @param {string} typeName - The class name
     * @returns {Object[]}
     */
    getEntitiesByType(typeName) {
        const result = [];
        for (const entity of this.entities.values()) {
            if (entity.constructor.name === typeName) {
                result.push(entity);
            }
        }
        return result;
    }

    /**
     * Count entities of a specific type
     * @param {string} typeName - The class name
     * @returns {number}
     */
    countByType(typeName) {
        let count = 0;
        for (const entity of this.entities.values()) {
            if (entity.constructor.name === typeName) {
                count++;
            }
        }
        return count;
    }
}
