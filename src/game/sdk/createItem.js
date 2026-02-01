/**
 * createItem - Simplified item creation
 */
import * as THREE from 'three';
import { Item } from '../items/Item.js';
import { WandItem } from '../items/WandItem.js';
import { validateIcon } from './core/IconValidator.js';
import { buildMesh } from './core/MeshBuilder.js';

// Registries
export const items = new Map();
export const itemIcons = new Map();

/**
 * Create an item
 * @param {Object} config
 * @param {string} config.id - Required: snake_case id
 * @param {string} config.name - Required: display name
 * @param {string} config.icon - Required: 64x64 SVG string
 * @param {string} config.category - tool | block | food | material | misc
 * @param {number} config.cooldown - ms between uses
 * @param {Array} config.mesh - Array of mesh parts for hand display
 * @param {Object} config.projectile - { speed, spread } for auto-fire
 * @param {Function} config.onUse - Custom use handler
 * @param {Function} config.onPrimary - Custom primary handler
 */
export function createItem(config) {
    // Validate
    if (!config.id) throw new Error('Item requires id');
    if (!config.name) throw new Error('Item requires name');
    if (!config.icon) throw new Error('Item requires icon (SVG string)');

    const iconResult = validateIcon(config.icon);
    if (!iconResult.valid) {
        console.warn(`[SDK] Icon validation warnings for ${config.id}:`, iconResult.errors);
    }

    // Determine if it's a wand (has projectile)
    const isWand = config.category === 'tool' || config.projectile;
    const BaseClass = isWand ? WandItem : Item;

    // Build the mesh once
    let handMesh = null;
    if (config.mesh) {
        handMesh = buildMesh(config.mesh);
    }

    // Create class
    const ItemClass = class extends BaseClass {
        constructor() {
            super(config.id, config.name);
            this.maxStack = config.maxStack || (isWand ? 1 : 64);
            this.isTool = isWand;
            this.category = config.category || 'misc';
            this.fireCooldown = config.cooldown || 500;
            this.lastFireTime = 0;
            this._config = config;
        }

        onUseDown(game, player) {
            // Cooldown check
            const now = Date.now();
            if (now - this.lastFireTime < this.fireCooldown) {
                return false;
            }
            this.lastFireTime = now;

            // Custom handler
            if (config.onUse) {
                const result = config.onUse.call(this, game, player);
                if (result !== undefined) return result;
            }

            // Auto-fire projectile
            if (config.projectile) {
                this._fireProjectile(game, player);
                if (player.swingArm) player.swingArm();
                return true;
            }

            return false;
        }

        onPrimaryDown(game, player) {
            if (config.onPrimary) {
                return config.onPrimary.call(this, game, player);
            }
            if (isWand) {
                return this.onUseDown(game, player);
            }
            return false;
        }

        _fireProjectile(game, player) {
            const camDir = new THREE.Vector3();
            game.camera.getWorldDirection(camDir);

            const spawnPos = player.position.clone();
            spawnPos.y += 1.5;
            spawnPos.add(camDir.clone().multiplyScalar(1.0));

            const speed = config.projectile.speed || 20;
            const velocity = camDir.multiplyScalar(speed);

            // Add spread
            if (config.projectile.spread) {
                const s = config.projectile.spread;
                velocity.x += (Math.random() - 0.5) * s;
                velocity.y += (Math.random() - 0.5) * s;
                velocity.z += (Math.random() - 0.5) * s;
            }

            // Spawn via game or VoxelWorld
            if (window.VoxelWorld?.spawnProjectile) {
                window.VoxelWorld.spawnProjectile(config.projectile.id || config.id + '_proj', spawnPos, velocity);
            } else if (game.spawnMagicProjectile) {
                game.spawnMagicProjectile(spawnPos, velocity);
            }
        }

        getMesh() {
            if (handMesh) {
                return handMesh.clone();
            }
            return super.getMesh();
        }
    };

    // Store
    items.set(config.id, { class: ItemClass, config });
    itemIcons.set(config.id, config.icon);

    console.log(`[SDK] Created item: ${config.id}`);
    return ItemClass;
}

/**
 * Get item icon
 */
export function getItemIcon(id) {
    return itemIcons.get(id) || null;
}

export default { createItem, items, itemIcons, getItemIcon };
