/**
 * Tool Definitions for OpenRouter - GameObject + Scripts SDK
 */

export function getOpenRouterTools() {
    return [
        // ============================================================
        // SDK TOOL - Single unified creation tool
        // ============================================================
        {
            type: 'function',
            function: {
                name: 'sdk_create',
                description: 'Create a game object with scripts. Use scripts to define behavior: mesh (3D visual), item (inventory), entity (spawnable creature), physics (movement), ai (behavior), health, shooter (projectiles), projectile, particle.',
                parameters: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'PascalCase name for the object' },
                        scripts: {
                            type: 'array',
                            description: 'Array of scripts to attach',
                            items: {
                                type: 'object',
                                properties: {
                                    type: {
                                        type: 'string',
                                        description: 'Script type: mesh, item, entity, physics, ai, health, collider, shooter, projectile, particle'
                                    },
                                    // MeshScript
                                    parts: {
                                        type: 'array',
                                        description: 'For mesh script: array of { type, size, color, position, emissive }',
                                        items: { type: 'object' }
                                    },
                                    // ItemScript
                                    icon: { type: 'string', description: 'For item script: SVG with viewBox="0 0 64 64"' },
                                    category: { type: 'string', description: 'For item script: tool|block|food|material|misc' },
                                    stackable: { type: 'boolean' },
                                    // PhysicsScript
                                    mode: { type: 'string', description: 'For physics script: walking|hopping|flying|swimming' },
                                    speed: { type: 'number' },
                                    gravity: { type: 'boolean' },
                                    // AIScript
                                    behavior: { type: 'string', description: 'For ai script: passive|neutral|hostile|pet' },
                                    wander: { type: 'boolean' },
                                    // HealthScript
                                    max: { type: 'number', description: 'For health script: max HP' },
                                    damage: { type: 'number', description: 'Damage this entity deals' },
                                    // ColliderScript
                                    width: { type: 'number' },
                                    height: { type: 'number' },
                                    // ShooterScript
                                    projectile: { type: 'string', description: 'For shooter script: projectile ID to fire' },
                                    cooldown: { type: 'number', description: 'ms between shots' },
                                    // ProjectileScript
                                    lifetime: { type: 'number', description: 'For projectile script: seconds' },
                                    // ParticleScript
                                    trail: { type: 'boolean' },
                                    trailColor: { type: 'integer' },
                                    burstOnDeath: { type: 'boolean' },
                                    burstCount: { type: 'integer' }
                                },
                                required: ['type']
                            }
                        }
                    },
                    required: ['name', 'scripts']
                }
            }
        },

        // ============================================================
        // GAME TOOLS
        // ============================================================
        {
            type: 'function',
            function: {
                name: 'spawn',
                description: 'Spawn a creature or object near the player.',
                parameters: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Name of thing to spawn' },
                        count: { type: 'integer', default: 1 }
                    },
                    required: ['name']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'give_item',
                description: 'Add item to player inventory.',
                parameters: {
                    type: 'object',
                    properties: {
                        item: { type: 'string', description: 'Item ID' },
                        count: { type: 'integer', default: 1 }
                    },
                    required: ['item']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'set_blocks',
                description: 'Place or remove blocks in the world. Use id="air" or id=null to remove blocks.',
                parameters: {
                    type: 'object',
                    properties: {
                        blocks: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    x: { type: 'integer' },
                                    y: { type: 'integer' },
                                    z: { type: 'integer' },
                                    id: { type: 'string', description: 'Block type (grass, stone, wood, etc.) or "air" to remove' }
                                },
                                required: ['x', 'y', 'z', 'id']
                            }
                        }
                    },
                    required: ['blocks']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'spawn_tree',
                description: 'Spawn a tree at a position. Types: oak, birch, pine, acacia, palm, willow, dark_oak, giant, cactus',
                parameters: {
                    type: 'object',
                    properties: {
                        type: { type: 'string', description: 'Tree type: oak, birch, pine, acacia, palm, willow, dark_oak, giant' },
                        x: { type: 'integer', description: 'X position (or use relative to player)' },
                        y: { type: 'integer', description: 'Y position (ground level)' },
                        z: { type: 'integer', description: 'Z position' },
                        relative: { type: 'boolean', description: 'If true, x/z are relative to player position' }
                    },
                    required: ['type']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'fill_blocks',
                description: 'Fill a region with blocks',
                parameters: {
                    type: 'object',
                    properties: {
                        x1: { type: 'integer' },
                        y1: { type: 'integer' },
                        z1: { type: 'integer' },
                        x2: { type: 'integer' },
                        y2: { type: 'integer' },
                        z2: { type: 'integer' },
                        block: { type: 'string', description: 'Block type to fill with' }
                    },
                    required: ['x1', 'y1', 'z1', 'x2', 'y2', 'z2', 'block']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'teleport_player',
                description: 'Teleport player to location.',
                parameters: {
                    type: 'object',
                    properties: {
                        location: { type: 'string', description: 'Coordinates or named location' }
                    },
                    required: ['location']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_scene_info',
                description: 'Get info about player surroundings.',
                parameters: { type: 'object', properties: {} }
            }
        }
    ];
}
