/**
 * Tool Definitions for Few-Shot AI System
 *
 * Generation tools — used for structured output extraction from each handler.
 * The LLM calls the tool to "submit" its result in a parseable schema.
 */

// ============================================================
// CREATURE GENERATION TOOL
// ============================================================

export function getCreatureTools() {
    return [
        {
            type: 'function' as const,
            function: {
                name: 'create_creature',
                description: 'Submit the generated creature class code.',
                parameters: {
                    type: 'object',
                    properties: {
                        className: {
                            type: 'string',
                            description: 'PascalCase class name for the creature (e.g. FireDragon)'
                        },
                        code: {
                            type: 'string',
                            description: 'Complete JavaScript class that extends Animal, including createBody() with THREE.js meshes'
                        }
                    },
                    required: ['className', 'code']
                }
            }
        }
    ];
}

// ============================================================
// ITEM GENERATION TOOL
// ============================================================

export function getItemTools() {
    return [
        {
            type: 'function' as const,
            function: {
                name: 'create_item',
                description: 'Submit the generated item class code and SVG icon.',
                parameters: {
                    type: 'object',
                    properties: {
                        className: {
                            type: 'string',
                            description: 'PascalCase class name for the item (e.g. FireSword)'
                        },
                        code: {
                            type: 'string',
                            description: 'Complete JavaScript class that extends Item or WandItem, including getMesh() and constructor with super()'
                        },
                        icon: {
                            type: 'string',
                            description: 'SVG icon string with viewBox="0 0 64 64" for the inventory display'
                        }
                    },
                    required: ['className', 'code', 'icon']
                }
            }
        }
    ];
}

// ============================================================
// STRUCTURE GENERATION TOOL
// ============================================================

export function getStructureTools() {
    return [
        {
            type: 'function' as const,
            function: {
                name: 'create_structure',
                description: 'Submit the generated JavaScript code that produces a blocks array.',
                parameters: {
                    type: 'object',
                    properties: {
                        code: {
                            type: 'string',
                            description: 'JavaScript code that uses playerPosition and returns an array of {x,y,z,id} block objects'
                        }
                    },
                    required: ['code']
                }
            }
        }
    ];
}
