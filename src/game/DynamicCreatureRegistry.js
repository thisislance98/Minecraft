/**
 * DynamicCreatureRegistry - Client-side registry for dynamically created creatures
 * 
 * Handles:
 * 1. Listening for creature_definition socket events
 * 2. Creating creature classes from code strings using Function constructor
 * 3. Registering resulting classes in AnimalClasses
 */

import { AnimalClasses } from './AnimalRegistry.js';
import { Animal } from './entities/Animal.js';
import * as THREE from 'three';

// Store dynamic creature definitions for reference
export const DynamicCreatures = {};

// Track errors for debugging (exposed to window for CLI access)
export const DynamicCreatureErrors = {};

// Expose to window for testing and debugging
window.DynamicCreatures = DynamicCreatures;
window.DynamicCreatureErrors = DynamicCreatureErrors;

/**
 * Register a dynamic creature class from a definition
 * @param {Object} definition - { name, code, description }
 */
export function registerDynamicCreature(definition) {
    const { name, code } = definition;

    if (!name || !code) {
        console.error('[DynamicCreatureRegistry] Invalid definition - missing name or code');
        return false;
    }

    // Check if already registered
    if (AnimalClasses[name]) {
        console.log(`[DynamicCreatureRegistry] Creature '${name}' already exists, skipping`);
        return true;
    }

    try {
        // Create class from code string using Function constructor
        // We inject THREE and Animal into the scope so the code can use them
        // The code should define a class and we return it
        const createClass = new Function(
            'THREE',
            'Animal',
            `
            ${code}
            return ${name};
            `
        );

        // Execute to get the class, passing in our dependencies
        const CreatureClass = createClass(THREE, Animal);

        // Validate it's a constructor
        if (typeof CreatureClass !== 'function') {
            console.error(`[DynamicCreatureRegistry] ${name} is not a valid class`);
            return false;
        }

        // Validate it extends Animal (check prototype chain)
        if (!(CreatureClass.prototype instanceof Animal)) {
            console.error(`[DynamicCreatureRegistry] ${name} does not extend Animal`);
            return false;
        }

        // Register in AnimalClasses
        AnimalClasses[name] = CreatureClass;
        DynamicCreatures[name] = definition;

        console.log(`[DynamicCreatureRegistry] ✅ Registered creature: ${name}`);
        return true;
    } catch (e) {
        console.error(`[DynamicCreatureRegistry] Failed to create ${name}:`, e.message);
        console.error(`[DynamicCreatureRegistry] Error stack:`, e.stack);
        console.error(`[DynamicCreatureRegistry] Code was:`, code.substring(0, 500));
        DynamicCreatureErrors[name] = { error: e.message, stack: e.stack, code: code, timestamp: Date.now() };
        return false;
    }
}

/**
 * Register multiple creatures from an array of definitions
 * @param {Array} definitions - Array of { name, code, description }
 */
export function registerMultipleCreatures(definitions) {
    if (!Array.isArray(definitions)) return;

    let count = 0;
    for (const def of definitions) {
        if (registerDynamicCreature(def)) {
            count++;
        }
    }

    if (count > 0) {
        console.log(`[DynamicCreatureRegistry] Loaded ${count} dynamic creature(s)`);
    }
}

/**
 * Get list of all dynamic creature names
 */
export function getDynamicCreatureNames() {
    return Object.keys(DynamicCreatures);
}

/**
 * Check if a creature is dynamically created
 */
export function isDynamicCreature(name) {
    return name in DynamicCreatures;
}
