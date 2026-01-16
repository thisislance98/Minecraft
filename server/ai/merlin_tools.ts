
/**
 * Tool Definitions for the Antigravity Agent
 * These match the tools available to the system-level agent.
 */

import { SchemaType } from "@google/generative-ai";

export function getMerlinTools() {
    return [{
        functionDeclarations: [
            // ============================================================
            // FILE SYSTEM TOOLS (Server Side)
            // ============================================================
            {
                name: "view_file",
                description: "Read the contents of a file on the server. Always use absolute paths or paths relative to project root.",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        AbsolutePath: { type: SchemaType.STRING, description: "Path to the file to read (e.g. 'src/game/Player.js')" },
                        StartLine: { type: SchemaType.INTEGER, description: "Optional start line (1-indexed)" },
                        EndLine: { type: SchemaType.INTEGER, description: "Optional end line" }
                    },
                    required: ["AbsolutePath"]
                }
            },
            {
                name: "list_dir",
                description: "List contents of a directory.",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        DirectoryPath: { type: SchemaType.STRING, description: "Path to the directory" }
                    },
                    required: ["DirectoryPath"]
                }
            },
            {
                name: "write_to_file",
                description: "Write content to a file. Can create new files or overwrite existing ones.",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        TargetFile: { type: SchemaType.STRING, description: "Path to the file" },
                        CodeContent: { type: SchemaType.STRING, description: "The full content to write" },
                        Description: { type: SchemaType.STRING, description: "Description of the change" }
                    },
                    required: ["TargetFile", "CodeContent"]
                }
            },
            {
                name: "replace_file_content",
                description: "Replace a specific block of text in a file.",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        TargetFile: { type: SchemaType.STRING, description: "Path to the file" },
                        TargetContent: { type: SchemaType.STRING, description: "Exact string to replace" },
                        ReplacementContent: { type: SchemaType.STRING, description: "New content string" }
                    },
                    required: ["TargetFile", "TargetContent", "ReplacementContent"]
                }
            },

            // ============================================================
            // GAME STATE TOOLS (Client Side)
            // ============================================================
            {
                name: "spawn_creature",
                description: "Spawn an entity in the game world near the player.",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        creature: { type: SchemaType.STRING, description: "Name of creature class (e.g. 'Pig', 'Zombie')" },
                        count: { type: SchemaType.INTEGER, description: "Number to spawn" }
                    },
                    required: ["creature"]
                }
            },
            {
                name: "teleport_player",
                description: "Teleport the player.",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        location: { type: SchemaType.STRING, description: "Named location (spawn, desert) or coordinates (x,y,z)" }
                    },
                    required: ["location"]
                }
            },
            {
                name: "get_scene_info",
                description: "Get information about the player's surroundings (biome, nearby entities).",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {},
                }
            },
            {
                name: "update_entity",
                description: "Update properties of an existing entity (e.g. scale, color, position).",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        entityId: { type: SchemaType.STRING, description: "ID of the entity to update" },
                        updates: {
                            type: SchemaType.OBJECT,
                            description: "Object containing updates to apply (e.g. { scale: 2.0, color: 'blue' })",
                            properties: {
                                scale: { type: SchemaType.NUMBER, description: "Scale factor (1.0 is default)" },
                                color: { type: SchemaType.STRING, description: "Color name or hex code" },
                                // future: position, rotation, etc.
                            }
                        }
                    },
                    required: ["entityId", "updates"]
                }
            },
            {
                name: "patch_entity",
                description: "Inject JavaScript code to override an entity method at runtime. Use for rapid behavior iteration without page refresh. The code has access to 'this' (the entity) and 'delta' (time since last frame for update methods). CRITICAL: The code runs in new Function() scope, so globals like THREE are NOT available. Use 'window.THREE' instead of 'THREE'. Use 'this.game' for game instance, 'this.mesh' for entity mesh. Example: 'const geom = new window.THREE.SphereGeometry(0.5); this.mesh.geometry = geom;'",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        entityId: { type: SchemaType.STRING, description: "ID of the entity to patch (e.g. 'Pig_0_32_27')" },
                        method: { type: SchemaType.STRING, description: "Method name to override (e.g. 'update', 'createBody', 'onInteract')" },
                        code: { type: SchemaType.STRING, description: "JavaScript function body. MUST use 'window.THREE' NOT 'THREE'. Use 'this.game' for game, 'this.mesh' for entity mesh, 'this.position' for position. Example: new window.THREE.BoxGeometry(1,1,1)" }
                    },
                    required: ["entityId", "method", "code"]
                }
            },
            {
                name: "set_blocks",
                description: "Place multiple blocks in the world at specific coordinates. Use this to build structures. IMPORTANT: Before building, call get_scene_info to get the player's current position, then build relative to that position. Example: If player is at (32, 37, 32), build pyramid starting at (32+5, 37, 32+5) which is (37, 37, 37).",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        blocks: {
                            type: SchemaType.ARRAY,
                            description: "List of blocks to set",
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    x: { type: SchemaType.INTEGER },
                                    y: { type: SchemaType.INTEGER },
                                    z: { type: SchemaType.INTEGER },
                                    id: { type: SchemaType.STRING, description: "Block ID (e.g. 'gold_block')" }
                                },
                                required: ["x", "y", "z", "id"]
                            }
                        }
                    },
                    required: ["blocks"]
                }
            },
            {
                name: "create_creature",
                description: "Create a new creature type that can be spawned by ALL players. Generate a full JavaScript class that extends Animal. The class MUST use 'window.THREE' (not 'THREE') for Three.js and extend 'Animal'. Required methods: constructor(game, x, y, z) that calls super(game, x, y, z), and createBody() that builds the mesh. The creature will be saved and available globally.",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        name: { type: SchemaType.STRING, description: "PascalCase class name (e.g., 'BouncingSlime', 'FireDragon')" },
                        code: {
                            type: SchemaType.STRING,
                            description: "Full JavaScript class code. MUST: 1) Use 'class Name extends Animal', 2) Call super(game, x, y, z) in constructor, 3) Call this.createBody() at end of constructor. CRITICAL: For spinning animation in updateAI(dt), you MUST update 'this.rotation += dt' for Y-axis spin (because Animal.js overwrites mesh.y). For X/Z tumbling, update 'this.mesh.rotation.x += dt'. Example: class Spinner extends Animal { constructor(game,x,y,z) { super(game,x,y,z); this.createBody(); } updateAI(dt) { this.rotation += dt; super.updateAI(dt); } }"
                        },
                        description: { type: SchemaType.STRING, description: "What this creature looks like and how it behaves" }
                    },
                    required: ["name", "code", "description"]
                }
            },
            {
                name: "create_item",
                description: "Create a new inventory item that can be used by ALL players. Generate a full JavaScript class extending Item (or WandItem for magic items). The class MUST use 'window.THREE' for 3D models. Also provide an SVG icon (64x64 viewBox) for the inventory display. Items are saved globally and persist across sessions.",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        name: { type: SchemaType.STRING, description: "PascalCase class name ending with 'Item' (e.g., 'TeleportWandItem', 'MagicSwordItem')" },
                        code: {
                            type: SchemaType.STRING,
                            description: "Full JavaScript class code. MUST: 1) Use 'class NameItem extends Item' (or WandItem), 2) In constructor call super('unique_snake_case_id', 'Display Name') - the ID MUST be unique and derived from the class name (e.g., TeleportWandItem uses 'teleport_wand', MagicSwordItem uses 'magic_sword'), 3) Set this.maxStack and this.isTool, 4) Implement onUseDown(game, player) for behavior. Use window.THREE for any 3D. Example: class TeleportWandItem extends Item { constructor() { super('teleport_wand', 'Teleport Wand'); this.maxStack = 1; this.isTool = true; } onUseDown(game, player) { const dir = new window.THREE.Vector3(); game.camera.getWorldDirection(dir); player.position.addScaledVector(dir, 10); return true; } }"
                        },
                        icon: {
                            type: SchemaType.STRING,
                            description: "SVG string for 64x64 inventory icon. Must start with <svg viewBox='0 0 64 64'>. Use gradients, shapes, and colors to create a visually appealing icon. Example: <svg viewBox='0 0 64 64'><rect x='28' y='20' width='8' height='40' fill='#5C4033'/><circle cx='32' cy='16' r='10' fill='#FF00FF'/></svg>"
                        },
                        description: { type: SchemaType.STRING, description: "What this item does and how it looks" }
                    },
                    required: ["name", "code", "icon", "description"]
                }
            },
            // ============================================================
            // VERIFICATION TOOLS
            // ============================================================
            {
                name: "run_verification",
                description: "Execute custom JavaScript verification code in the browser to check if an action succeeded. The code has access to a 'V' helper object with methods like findEntity(name), countEntities(name), isEntityVisible(entity). The code MUST return an object with { success: boolean, ... }.",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        code: { type: SchemaType.STRING, description: "JavaScript code to execute. Example: \"const e = V.findEntity('Pig'); return { success: !!e, pos: e ? e.position : null };\"" },
                        description: { type: SchemaType.STRING, description: "Description of what is being verified (e.g. 'Verifying Pig spawned')" }
                    },
                    required: ["code", "description"]
                }
            },
            {
                name: "capture_screenshot",
                description: "Capture a visual screenshot of the current game view. Use this to visually verify your creations (e.g. 'I made a red cube'). The screenshot will be saved and shown to you.",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        label: { type: SchemaType.STRING, description: "Short label for the screenshot (e.g. 'red_cube_verification')" }
                    },
                    required: ["label"]
                }
            },
            {
                name: "capture_video",
                description: "Record a short video of the game view to verify animations or behaviors. Use for moving things (e.g. 'spinning cube', 'flying creature').",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        duration_seconds: { type: SchemaType.NUMBER, description: "Duration in seconds (default 5, max 10)" },
                        label: { type: SchemaType.STRING, description: "Short label for the video (e.g. 'spinning_cube_proof')" }
                    },
                    required: ["label"]
                }
            },
            // ============================================================
            // KNOWLEDGE TOOLS
            // ============================================================
            {
                name: "search_knowledge",
                description: "Search Merlin's knowledge base for templates, gotchas, how-to guides, or past errors. Use before creating complex creatures.",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        query: { type: SchemaType.STRING, description: "Search query (e.g. 'spinning', 'flying creature', 'mesh position')" },
                        category: { type: SchemaType.STRING, description: "Optional: 'template', 'gotcha', 'howto', or 'error'" }
                    },
                    required: ["query"]
                }
            },
            {
                name: "add_knowledge",
                description: "Store a lesson learned for future reference. Use after fixing a code generation error.",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        category: { type: SchemaType.STRING, description: "'template', 'gotcha', 'howto', or 'error'" },
                        title: { type: SchemaType.STRING, description: "Short descriptive title" },
                        content: { type: SchemaType.STRING, description: "Detailed explanation or code snippet" },
                        tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Optional keywords for search" }
                    },
                    required: ["category", "title", "content"]
                }
            },
            {
                name: "verify_and_save",
                description: "After spawning a creature, call this to verify it works correctly. Captures browser logs for 5 seconds, analyzes for errors/expected behaviors, attempts auto-fix if issues found (max 3 retries), and saves to knowledge base if verified working.",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        creatureName: { type: SchemaType.STRING, description: "Name of the creature to verify (e.g., 'BouncingSlime')" },
                        expectedBehaviors: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "List of expected behaviors to look for in logs (e.g., ['bouncing', 'following player'])" },
                        creatureCode: { type: SchemaType.STRING, description: "The full code of the creature (for fixing if needed)" }
                    },
                    required: ["creatureName", "expectedBehaviors", "creatureCode"]
                }
            }
        ]
    }] as any;
}

