
/**
 * Tool Definitions for the Antigravity Agent
 * These match the tools available to the system-level agent.
 */

import { SchemaType } from "@google/generative-ai";

export function getAntigravityTools() {
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
            }
        ]
    }] as any;
}
