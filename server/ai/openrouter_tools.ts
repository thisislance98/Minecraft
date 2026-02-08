/**
 * Tool Definitions for OpenRouter - Lua code execution (Roblox-style API)
 */

export function getOpenRouterTools() {
    return [
        {
            type: 'function',
            function: {
                name: 'execute_lua',
                description: `Execute Roblox-style Lua code in the game. Uses standard Roblox APIs (Instance, Vector3, Color3, workspace, game, Players).

Game-specific extensions on workspace:
- workspace:SetBlock(x, y, z, blockType) - Place a block
- workspace:Fill(x1, y1, z1, x2, y2, z2, blockType) - Fill region with blocks
- workspace:SpawnAnimal(type, position, count) - Spawn existing animal (Pig, Wolf, Cow, Sheep, Chicken, Horse, Bear, Zombie, etc.)
- workspace:SpawnTree(type, x, y, z) - Spawn tree (oak, birch, spruce)
- workspace:GiveItem(name, count) - Give item to player
- workspace:Undo() - Undo last action

Instance classes: Part, Creature, Tool, Model, Sound, Script, ParticleEmitter, PointLight

Block types: stone, cobblestone, brick, wood, planks, glass, dirt, grass, sand, gravel, iron_ore, gold_ore, diamond_ore, coal_ore, water, lava, leaves, log`,
                parameters: {
                    type: 'object',
                    properties: {
                        code: {
                            type: 'string',
                            description: 'Lua code using Roblox-style APIs'
                        }
                    },
                    required: ['code']
                }
            }
        }
    ];
}
