
/**
 * Tool Definitions for the Antigravity Agent
 * These match the tools available to the system-level agent.
 */

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
                    type: "OBJECT",
                    properties: {
                        AbsolutePath: { type: "STRING", description: "Path to the file to read (e.g. 'src/game/Player.js')" },
                        StartLine: { type: "INTEGER", description: "Optional start line (1-indexed)" },
                        EndLine: { type: "INTEGER", description: "Optional end line" }
                    },
                    required: ["AbsolutePath"]
                }
            },
            {
                name: "list_dir",
                description: "List contents of a directory.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        DirectoryPath: { type: "STRING", description: "Path to the directory" }
                    },
                    required: ["DirectoryPath"]
                }
            },
            {
                name: "write_to_file",
                description: "Write content to a file. Can create new files or overwrite existing ones.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        TargetFile: { type: "STRING", description: "Path to the file" },
                        CodeContent: { type: "STRING", description: "The full content to write" },
                        Description: { type: "STRING", description: "Description of the change" }
                    },
                    required: ["TargetFile", "CodeContent"]
                }
            },
            {
                name: "replace_file_content",
                description: "Replace a specific block of text in a file.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        TargetFile: { type: "STRING", description: "Path to the file" },
                        TargetContent: { type: "STRING", description: "Exact string to replace" },
                        ReplacementContent: { type: "STRING", description: "New content string" }
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
                    type: "OBJECT",
                    properties: {
                        creature: { type: "STRING", description: "Name of creature class (e.g. 'Pig', 'Zombie')" },
                        count: { type: "INTEGER", description: "Number to spawn" }
                    },
                    required: ["creature"]
                }
            },
            {
                name: "teleport_player",
                description: "Teleport the player.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        location: { type: "STRING", description: "Named location (spawn, desert) or coordinates (x,y,z)" }
                    },
                    required: ["location"]
                }
            },
            {
                name: "get_scene_info",
                description: "Get information about the player's surroundings (biome, nearby entities).",
                parameters: {
                    type: "OBJECT",
                    properties: {},
                }
            }
        ]
    }];
}
