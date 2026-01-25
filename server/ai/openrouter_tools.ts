/**
 * Tool Definitions for OpenRouter (OpenAI-compatible format)
 * Used with Claude and other models via OpenRouter
 */

export function getOpenRouterTools() {
    return [
        // ============================================================
        // FILE SYSTEM TOOLS
        // ============================================================
        {
            type: 'function',
            function: {
                name: 'view_file',
                description: 'Read the contents of a file on the server.',
                parameters: {
                    type: 'object',
                    properties: {
                        AbsolutePath: { type: 'string', description: 'Path to the file to read' },
                        StartLine: { type: 'integer', description: 'Optional start line (1-indexed)' },
                        EndLine: { type: 'integer', description: 'Optional end line' }
                    },
                    required: ['AbsolutePath']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'list_dir',
                description: 'List contents of a directory.',
                parameters: {
                    type: 'object',
                    properties: {
                        DirectoryPath: { type: 'string', description: 'Path to the directory' }
                    },
                    required: ['DirectoryPath']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'write_to_file',
                description: 'Write content to a file. Can create new files or overwrite existing ones.',
                parameters: {
                    type: 'object',
                    properties: {
                        TargetFile: { type: 'string', description: 'Path to the file' },
                        CodeContent: { type: 'string', description: 'The full content to write' },
                        Description: { type: 'string', description: 'Description of the change' }
                    },
                    required: ['TargetFile', 'CodeContent']
                }
            }
        },

        // ============================================================
        // GAME STATE TOOLS
        // ============================================================
        {
            type: 'function',
            function: {
                name: 'spawn_creature',
                description: 'Spawn an entity in the game world near the player.',
                parameters: {
                    type: 'object',
                    properties: {
                        creature: { type: 'string', description: 'Name of creature class (e.g. "Pig", "Zombie")' },
                        count: { type: 'integer', description: 'Number to spawn', default: 1 }
                    },
                    required: ['creature']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'teleport_player',
                description: 'Teleport the player to a location.',
                parameters: {
                    type: 'object',
                    properties: {
                        location: { type: 'string', description: 'Named location (spawn, desert) or coordinates (x,y,z)' }
                    },
                    required: ['location']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_scene_info',
                description: 'Get information about the player\'s surroundings (biome, nearby entities).',
                parameters: {
                    type: 'object',
                    properties: {}
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'update_entity',
                description: 'Update properties of an existing entity (e.g. scale, color).',
                parameters: {
                    type: 'object',
                    properties: {
                        entityId: { type: 'string', description: 'ID of the entity to update' },
                        updates: {
                            type: 'object',
                            description: 'Updates to apply',
                            properties: {
                                scale: { type: 'number', description: 'Scale factor' },
                                color: { type: 'string', description: 'Color name or hex code' }
                            }
                        }
                    },
                    required: ['entityId', 'updates']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'set_blocks',
                description: 'Place multiple blocks in the world to build structures.',
                parameters: {
                    type: 'object',
                    properties: {
                        blocks: {
                            type: 'array',
                            description: 'List of blocks to set',
                            items: {
                                type: 'object',
                                properties: {
                                    x: { type: 'integer' },
                                    y: { type: 'integer' },
                                    z: { type: 'integer' },
                                    id: { type: 'string', description: 'Block ID (e.g. "gold_block")' }
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
                name: 'create_creature',
                description: 'Create a new creature type. Generate a JavaScript class that extends Animal.',
                parameters: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'PascalCase class name (e.g. "BouncingSlime")' },
                        code: { type: 'string', description: 'Full JavaScript class code. Must use window.THREE for Three.js.' },
                        description: { type: 'string', description: 'What this creature looks like and how it behaves' }
                    },
                    required: ['name', 'code', 'description']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'create_item',
                description: 'Create a new inventory item. Generate a JavaScript class extending Item. The item is automatically added to the player inventory after creation.',
                parameters: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'PascalCase class name ending with "Item"' },
                        code: { type: 'string', description: 'Full JavaScript class code' },
                        icon: { type: 'string', description: 'SVG string for 64x64 inventory icon' },
                        mesh_code: { type: 'string', description: 'JavaScript code for getMesh() method body - returns THREE.Object3D for dropped item 3D representation. Use window.THREE.' },
                        description: { type: 'string', description: 'What this item does' }
                    },
                    required: ['name', 'code', 'icon', 'mesh_code']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'give_item',
                description: 'Add an item to the player inventory.',
                parameters: {
                    type: 'object',
                    properties: {
                        item: { type: 'string', description: 'Item ID (snake_case)' },
                        count: { type: 'integer', description: 'Number of items (default 1)' }
                    },
                    required: ['item']
                }
            }
        },

        // ============================================================
        // KNOWLEDGE TOOLS
        // ============================================================
        {
            type: 'function',
            function: {
                name: 'search_knowledge',
                description: 'Search the knowledge base for templates, guides, or past examples.',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search query' },
                        category: { type: 'string', description: 'Optional: "template", "gotcha", "howto", or "error"' }
                    },
                    required: ['query']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'add_knowledge',
                description: 'Store a lesson learned for future reference.',
                parameters: {
                    type: 'object',
                    properties: {
                        category: { type: 'string', description: '"template", "gotcha", "howto", or "error"' },
                        title: { type: 'string', description: 'Short descriptive title' },
                        content: { type: 'string', description: 'Detailed explanation or code snippet' },
                        tags: { type: 'array', items: { type: 'string' }, description: 'Keywords for search' }
                    },
                    required: ['category', 'title', 'content']
                }
            }
        },

        // ============================================================
        // VERIFICATION TOOLS
        // ============================================================
        {
            type: 'function',
            function: {
                name: 'run_verification',
                description: 'Execute JavaScript verification code in the browser to check if an action succeeded.',
                parameters: {
                    type: 'object',
                    properties: {
                        code: { type: 'string', description: 'JavaScript code to execute. Has access to V helper object.' },
                        description: { type: 'string', description: 'What is being verified' }
                    },
                    required: ['code', 'description']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'capture_screenshot',
                description: 'Capture a screenshot of the current game view.',
                parameters: {
                    type: 'object',
                    properties: {
                        label: { type: 'string', description: 'Short label for the screenshot' }
                    },
                    required: ['label']
                }
            }
        }
    ];
}
