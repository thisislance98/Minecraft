/**
 * AI Tool Definitions for Gemini Function Calling
 * Used by both voice and text AI modes
 */

/**
 * Get the tool definitions for Gemini function calling
 * @returns {Array} Array of tool configurations
 */
export function getTools() {
    return [{
        functionDeclarations: [{
            name: "perform_task",
            description: "Modifies the game code based on the user's request. Use this when the player wants to change game mechanics, physics, visuals, or any other aspect of the game.",
            parameters: {
                type: "object",
                properties: {
                    request: {
                        type: "string",
                        description: "A clear description of what code change the user wants, e.g. 'Make the player jump twice as high' or 'Change the sky color to purple'"
                    }
                },
                required: ["request"]
            }
        }, {
            name: "provide_suggestions",
            description: "Provides a list of suggested follow-up actions or questions for the user to click. Use this to help the user discover what they can do.",
            parameters: {
                type: "object",
                properties: {
                    suggestions: {
                        type: "array",
                        items: { type: "string" },
                        description: "List of short suggestion strings, e.g. ['Fly', 'Give me a diamond sword', 'Spawn a sheep']"
                    }
                },
                required: ["suggestions"]
            }
        }, {
            name: "teleport_player",
            description: "Teleport the player to a new location INSTANTLY. Supports named locations (spawn, ocean, desert, forest, jungle, mountain, snow, plains) or specific coordinates.",
            parameters: {
                type: "object",
                properties: {
                    location: {
                        type: "string",
                        description: "Named location like 'spawn', 'desert', 'ocean', 'forest', 'jungle', 'mountain', 'snow', 'plains' OR coordinates like '100, 50, 200'"
                    }
                },
                required: ["location"]
            }
        }, {
            name: "spawn_creature",
            description: "Spawn a creature near the player. If the creature doesn't exist yet, it will be CREATED automatically using AI code generation first! Available creatures include: Pig, Horse, Chicken, Bunny, Wolf, Bear, Lion, Tiger, Elephant, Giraffe, Deer, Sheep, Cow, Zombie, Skeleton, Creeper, Enderman, Unicorn, TRex, Owl, Fox, Panda, Dolphin, Penguin, Snowman, SantaClaus, Kangaroo, Robot, Cybertruck - but you can spawn ANY creature and unknown ones will be created!",
            parameters: {
                type: "object",
                properties: {
                    creature: {
                        type: "string",
                        description: "Name of creature to spawn (e.g. 'Pig', 'Wolf', 'Zombie', 'Unicorn', 'TRex', or any new creature like 'Zebra')"
                    },
                    count: {
                        type: "integer",
                        description: "Number of creatures to spawn (1-10, default 1)"
                    }
                },
                required: ["creature"]
            }
        }, {
            name: "get_scene_info",
            description: "Get information about the player's current environment including position, orientation, biome, nearby creatures, time of day, health, surroundings, and what the player is currently looking at. Use this when player asks 'where am I?', 'what's around me?', or 'what am I looking at?'",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }]
    }];
}
