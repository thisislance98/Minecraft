/**
 * createEntity - Simplified entity/creature creation
 */
import * as THREE from 'three';
import { Animal } from '../entities/Animal.js';
import { buildMesh } from './core/MeshBuilder.js';

// Registry
export const entities = new Map();

/**
 * Create an entity
 * @param {Object} config
 * @param {string} config.name - Required: PascalCase class name
 * @param {Object} config.size - { width, height, depth }
 * @param {Array} config.body - Array of mesh parts
 * @param {string} config.physics - walking | hopping | flying | swimming
 * @param {number} config.speed - Movement speed
 * @param {string} config.ai - passive | neutral | hostile | pet
 * @param {number} config.health - Max health
 * @param {number} config.damage - Attack damage
 * @param {boolean} config.rideable - Can be mounted
 * @param {boolean} config.tameable - Can be tamed
 * @param {Function} config.onUpdate - Called every frame
 * @param {Function} config.onSpawn - Called when spawned
 * @param {Function} config.onDeath - Called when killed
 * @param {Function} config.onInteract - Called when player interacts
 */
export function createEntity(config) {
    if (!config.name) throw new Error('Entity requires name');

    const EntityClass = class extends Animal {
        constructor(game, x, y, z, seed) {
            super(game, x, y, z, seed);

            this.entityName = config.name;

            // Size
            if (config.size) {
                this.width = config.size.width || 0.8;
                this.height = config.size.height || 1.0;
                this.depth = config.size.depth || this.width;
            }

            // Physics mode
            const physics = config.physics || 'walking';
            this.speed = config.speed || 2;

            if (physics === 'flying') {
                this.gravity = false;
                this.isFlying = true;
            } else if (physics === 'hopping') {
                this.canHop = true;
            } else if (physics === 'swimming') {
                this.isAquatic = true;
            }

            // AI
            const ai = config.ai || 'passive';
            if (ai === 'hostile') {
                this.isHostile = true;
            } else if (ai === 'neutral') {
                this.isNeutral = true;
            }
            this.aiType = ai;

            // Stats
            this.maxHealth = config.health || 20;
            this.health = this.maxHealth;
            this.damage = config.damage || 0;

            // Interactions
            this.isRideable = config.rideable || false;
            this.isTameable = config.tameable || false;
            this.isTamed = false;

            // Store config
            this._config = config;

            // Build body
            this.createBody();

            // Call onSpawn
            if (config.onSpawn) {
                config.onSpawn.call(this);
            }
        }

        createBody() {
            // Clear existing
            while (this.mesh.children.length > 0) {
                this.mesh.remove(this.mesh.children[0]);
            }

            if (config.body && config.body.length > 0) {
                const bodyGroup = buildMesh(config.body);
                // Transfer children
                while (bodyGroup.children.length > 0) {
                    const child = bodyGroup.children[0];
                    bodyGroup.remove(child);
                    this.mesh.add(child);
                }
            } else {
                // Default body - simple box
                const geo = new THREE.BoxGeometry(this.width, this.height, this.depth);
                const mat = new THREE.MeshLambertMaterial({ color: config.color || 0x888888 });
                const body = new THREE.Mesh(geo, mat);
                body.position.y = this.height / 2;
                this.mesh.add(body);
            }

            // Scale
            if (config.scale) {
                this.mesh.scale.setScalar(config.scale);
            }
        }

        updateAI(dt) {
            // Custom update
            if (config.onUpdate) {
                config.onUpdate.call(this, dt);
            }

            // Default AI
            super.updateAI(dt);
        }

        interact(player) {
            if (config.onInteract) {
                const result = config.onInteract.call(this, player);
                if (result !== undefined) return result;
            }

            // Taming
            if (this.isTameable && !this.isTamed) {
                this.isTamed = true;
                this.aiType = 'pet';
                return true;
            }

            // Riding
            if (this.isRideable && !this.rider && player.mount) {
                player.mount(this);
                return true;
            }

            return super.interact(player);
        }

        die() {
            if (config.onDeath) {
                config.onDeath.call(this);
            }
            super.die();
        }

        static get entityTypeName() {
            return config.name;
        }
    };

    // Set class name
    Object.defineProperty(EntityClass, 'name', { value: config.name });

    // Store
    entities.set(config.name, { class: EntityClass, config });

    console.log(`[SDK] Created entity: ${config.name}`);
    return EntityClass;
}

/**
 * Spawn an entity
 */
export function spawnEntity(game, name, x, y, z) {
    const data = entities.get(name);
    if (!data) {
        console.error(`[SDK] Entity not found: ${name}`);
        return null;
    }

    const entity = new data.class(game, x, y, z, Math.random());

    if (!game.animals) game.animals = [];
    game.animals.push(entity);

    if (game.scene) {
        game.scene.add(entity.mesh);
    }

    return entity;
}

export default { createEntity, entities, spawnEntity };
