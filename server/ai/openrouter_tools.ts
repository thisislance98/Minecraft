/**
 * Tool Definitions for OpenRouter - JavaScript code execution (VoxelWorld SDK)
 */

export function getOpenRouterTools() {
    return [
        {
            type: 'function',
            function: {
                name: 'execute_code',
                description: `Execute JavaScript code in the game using the VoxelWorld SDK and THREE.js.

Available globals:
- game - The VoxelGame instance
- game.player - Player object with position, inventory
- game.world - World for block operations (setBlock, removeBlock)
- game.spawnManager - Spawn creatures (spawnCreature)
- game.camera - Camera for direction/position
- THREE - THREE.js library for 3D geometry/materials
- Animal - Base class for creatures
- Item - Base class for items
- window.AnimalClasses - Registry to add new creature types

Common operations:
- game.world.setBlock(x, y, z, blockType) - Place a block
- game.spawnManager.spawnCreature(type, x, y, z, count) - Spawn existing animal
- game.player.inventory.addItem(itemId, count) - Give item to player
- game.player.position - Get player position {x, y, z}

Block types: stone, cobblestone, brick, wood, planks, glass, dirt, grass, sand, gold_block, diamond_block, iron_block, water, lava

Animal types: Pig, Wolf, Sheep, Cow, Chicken, Horse, Bear, Lion, Tiger, Elephant, Deer, Zombie, Skeleton, Bunny, Fox, Owl, Panda, TRex, Unicorn, Robot, Dog, Cat`,
                parameters: {
                    type: 'object',
                    properties: {
                        code: {
                            type: 'string',
                            description: 'JavaScript code using VoxelWorld SDK and THREE.js'
                        }
                    },
                    required: ['code']
                }
            }
        }
    ];
}
