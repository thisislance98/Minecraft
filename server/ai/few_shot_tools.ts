/**
 * Tool Definitions for Few-Shot AI System
 */

export function getFewShotTools() {
    return [
        {
            type: 'function',
            function: {
                name: 'create_creature',
                description: 'Create a new custom creature/animal/monster. Use this for any request to make a living entity.',
                parameters: {
                    type: 'object',
                    properties: {
                        description: {
                            type: 'string',
                            description: 'Detailed description of the creature to create (appearance, behavior, abilities)'
                        }
                    },
                    required: ['description']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'create_item',
                description: 'Create a new custom item for the inventory. Use this for weapons, tools, potions, wands, etc.',
                parameters: {
                    type: 'object',
                    properties: {
                        description: {
                            type: 'string',
                            description: 'Detailed description of the item (appearance, what it does when used)'
                        }
                    },
                    required: ['description']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'create_structure',
                description: 'Build a structure using blocks. Use this for houses, towers, bridges, etc.',
                parameters: {
                    type: 'object',
                    properties: {
                        description: {
                            type: 'string',
                            description: 'Description of the structure to build (type, size, materials)'
                        }
                    },
                    required: ['description']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'spawn_existing',
                description: 'Spawn an existing creature type. Use for: Pig, Cow, Sheep, Chicken, Wolf, Dragon, Robot, Bunny, Cat, Horse, etc.',
                parameters: {
                    type: 'object',
                    properties: {
                        creature: {
                            type: 'string',
                            description: 'Name of the creature type to spawn'
                        },
                        count: {
                            type: 'integer',
                            description: 'Number to spawn',
                            default: 1
                        }
                    },
                    required: ['creature']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'give_existing',
                description: 'Give an existing item to the player. Use for common items.',
                parameters: {
                    type: 'object',
                    properties: {
                        item: {
                            type: 'string',
                            description: 'Item ID to give (e.g., wand, sword, bow, wood, stone)'
                        },
                        count: {
                            type: 'integer',
                            description: 'Number to give',
                            default: 1
                        }
                    },
                    required: ['item']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'set_blocks',
                description: 'Place or remove individual blocks. Use for simple placements, not structures.',
                parameters: {
                    type: 'object',
                    properties: {
                        blocks: {
                            type: 'array',
                            description: 'Array of blocks to place',
                            items: {
                                type: 'object',
                                properties: {
                                    x: { type: 'integer' },
                                    y: { type: 'integer' },
                                    z: { type: 'integer' },
                                    id: { type: 'string', description: 'Block type or "air" to remove' }
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
                name: 'chat',
                description: 'Respond to general conversation, questions, or help requests.',
                parameters: {
                    type: 'object',
                    properties: {
                        response: {
                            type: 'string',
                            description: 'Your helpful response to the user'
                        }
                    },
                    required: ['response']
                }
            }
        }
    ];
}

// List of known/existing creatures for spawn_existing
export const knownCreatures = [
    'Pig', 'Cow', 'Sheep', 'Chicken', 'Wolf', 'Cat', 'Horse',
    'Bunny', 'Dragon', 'Robot', 'Zombie', 'Skeleton', 'Creeper',
    'Fox', 'Bear', 'Eagle', 'Owl', 'Bee', 'Butterfly',
    'Elephant', 'Giraffe', 'Lion', 'Tiger', 'Zebra',
    'Snowman', 'Wizard', 'Ghost', 'Slime'
];

// List of known items
export const knownItems = [
    'wand', 'sword', 'bow', 'sign', 'chair', 'table',
    'apple', 'bread', 'meat', 'chocolate_bar',
    'wood', 'stone', 'cobblestone', 'brick', 'glass',
    'firework_wand', 'ride_wand', 'growth_wand', 'shrink_wand'
];
