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
                description: 'Submit the generated creature class code. Set isEdit=true when modifying a previously created creature (e.g. "make it bigger", "change the color") so the old one gets replaced.',
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
                        },
                        isEdit: {
                            type: 'boolean',
                            description: 'Set to true when this is a modification of a previously created creature. The old creature will be removed and replaced with this new version.'
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
                description: 'Submit the generated JavaScript code that produces a blocks array. Set isEdit=true when modifying a previously built structure (e.g. "make it taller", "add windows") so the old blocks get cleared first.',
                parameters: {
                    type: 'object',
                    properties: {
                        code: {
                            type: 'string',
                            description: 'JavaScript code that uses playerPosition and returns an array of {x,y,z,id} block objects'
                        },
                        isEdit: {
                            type: 'boolean',
                            description: 'Set to true when this is a modification of a previously built structure. The old blocks will be cleared before placing the new ones.'
                        }
                    },
                    required: ['code']
                }
            }
        }
    ];
}
