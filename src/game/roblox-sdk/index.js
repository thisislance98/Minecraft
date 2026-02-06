/**
 * Roblox-style SDK Entry Point
 *
 * Provides a Lua scripting environment with Roblox-like APIs
 * for AI-friendly code generation.
 */

import { LuaRuntime } from './LuaRuntime.js';

export { LuaRuntime };

/**
 * Create and initialize a new Lua runtime
 * @param {Object} game - VoxelGame instance
 * @returns {LuaRuntime}
 */
export function createLuaRuntime(game) {
    const runtime = new LuaRuntime(game);
    runtime.init();
    return runtime;
}

/**
 * Example Lua scripts for testing/documentation
 */
export const ExampleScripts = {
    // Spawn a simple part
    spawnPart: `
local part = Instance.new("Part")
part.Size = Vector3.new(2, 2, 2)
part.Color = Color3.fromRGB(255, 0, 0)
part.Position = Vector3.new(0, 60, 0)
part.Parent = workspace
print("Spawned red cube!")
`,

    // Spawn a creature
    spawnCreature: `
local pig = Instance.new("Creature")
pig.Name = "LuaPig"
pig.Color = Color3.fromRGB(255, 192, 203)
pig.Size = Vector3.new(0.8, 0.6, 1.0)
pig.Health = 10
pig.Behavior = "passive"
pig.Position = Vector3.new(0, 60, 5)
pig:Spawn()
print("Spawned a pig!")
`,

    // Build a house
    buildHouse: `
local function buildHouse(x, y, z)
    -- Floor
    workspace.Fill(x, y, z, x+6, y, z+6, "cobblestone")

    -- Walls
    for i = 1, 4 do
        workspace.Fill(x, y+i, z, x+6, y+i, z, "brick")
        workspace.Fill(x, y+i, z+6, x+6, y+i, z+6, "brick")
        workspace.Fill(x, y+i, z, x, y+i, z+6, "brick")
        workspace.Fill(x+6, y+i, z, x+6, y+i, z+6, "brick")
    end

    -- Door
    workspace.SetBlock(x+3, y+1, z, "air")
    workspace.SetBlock(x+3, y+2, z, "air")

    -- Roof
    workspace.Fill(x-1, y+5, z-1, x+7, y+5, z+7, "wood")
end

local playerPos = game.Players.LocalPlayer.Character.Position
buildHouse(math.floor(playerPos.X) + 5, math.floor(playerPos.Y), math.floor(playerPos.Z))
print("Built a house!")
`,

    // Spawn multiple creatures
    spawnFarm: `
local colors = {
    Color3.fromRGB(255, 192, 203), -- Pink pig
    Color3.fromRGB(255, 255, 255), -- White sheep
    Color3.fromRGB(139, 69, 19),   -- Brown cow
}

local names = {"Pig", "Sheep", "Cow"}
local playerPos = game.Players.LocalPlayer.Character.Position

for i = 1, 3 do
    local creature = Instance.new("Creature")
    creature.Name = names[i]
    creature.Color = colors[i]
    creature.Size = Vector3.new(0.6 + i * 0.2, 0.5 + i * 0.1, 0.8 + i * 0.2)
    creature.Health = 10 + i * 5
    creature.Behavior = "passive"
    creature.Position = Vector3.new(
        playerPos.X + (i - 2) * 3,
        playerPos.Y + 2,
        playerPos.Z + 5
    )
    creature:Spawn()
end
print("Spawned a farm with 3 animals!")
`
};

export default LuaRuntime;
