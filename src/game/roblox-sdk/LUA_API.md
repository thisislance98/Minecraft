# Lua API Reference (Roblox-style)

This game uses a Roblox-compatible Lua API for scripting. Claude knows this API well.

## Quick Start

```lua
-- Spawn a red cube
local part = Instance.new("Part")
part.Size = Vector3.new(2, 2, 2)
part.Color = Color3.fromRGB(255, 0, 0)
part.Position = Vector3.new(0, 60, 0)
part.Parent = workspace
```

## Data Types

### Vector3
```lua
Vector3.new(x, y, z)     -- Create vector
Vector3.zero             -- {0, 0, 0}
Vector3.one              -- {1, 1, 1}
v.X, v.Y, v.Z            -- Components
v.Magnitude              -- Length
v:Lerp(other, alpha)     -- Interpolate
v:Cross(other)           -- Cross product
v:Dot(other)             -- Dot product
```

### Color3
```lua
Color3.new(r, g, b)      -- r,g,b are 0-1
Color3.fromRGB(r, g, b)  -- r,g,b are 0-255
Color3.fromHSV(h, s, v)  -- Hue, Saturation, Value
Color3.fromHex(0xFF0000) -- From hex integer
c.R, c.G, c.B            -- Components (0-1)
```

### CFrame (Position + Rotation)
```lua
CFrame.new(x, y, z)      -- Position only
CFrame.lookAt(from, to)  -- Look direction
cf.Position              -- Vector3
cf.LookVector            -- Forward direction
```

## Instance Classes

### Part (3D Geometry)
```lua
local part = Instance.new("Part")
part.Name = "MyCube"
part.Size = Vector3.new(2, 2, 2)
part.Position = Vector3.new(0, 60, 0)
part.Color = Color3.fromRGB(255, 0, 0)
part.Transparency = 0.5   -- 0-1
part.Shape = "Block"      -- Block, Ball, Cylinder
part.Anchored = true      -- Won't fall
part.CanCollide = true
part.Parent = workspace   -- Makes it visible!
part:Destroy()            -- Remove it
```

### Creature (AI Entity)
```lua
local pig = Instance.new("Creature")
pig.Name = "Pig"
pig.Color = Color3.fromRGB(255, 192, 203)
pig.Size = Vector3.new(0.8, 0.6, 1.0)
pig.Health = 10
pig.MaxHealth = 10
pig.Speed = 2
pig.Behavior = "passive"  -- passive, neutral, hostile, pet
pig.Position = Vector3.new(0, 60, 5)
pig:Spawn()               -- Creates the entity
pig:Destroy()             -- Removes it
```

### Model (Container)
```lua
local model = Instance.new("Model")
model.Name = "House"
-- Add parts to model
local floor = Instance.new("Part")
floor.Parent = model
model.PrimaryPart = floor
model:SetPrimaryPartCFrame(cf)
model:GetChildren()
model:FindFirstChild("Floor")
```

### Sound
```lua
local sound = Instance.new("Sound")
sound.SoundId = "path/to/sound.mp3"
sound.Volume = 1
sound.Looped = false
sound:Play()
sound:Stop()
```

## Services

### workspace
```lua
workspace                         -- Global world container
workspace:GetGroundLevel(x, z)    -- Terrain height
workspace:FindFirstChild("Name")
workspace:GetChildren()
workspace:Raycast(origin, direction)

-- Block manipulation (Minecraft-specific)
workspace.SetBlock(x, y, z, "stone")
workspace.GetBlock(x, y, z)
workspace.Fill(x1, y1, z1, x2, y2, z2, "brick")
workspace.SpawnTree("oak", x, y, z)
```

### game
```lua
game.Workspace              -- Same as workspace
game.Players                -- Players service
game:GetService("Players")
```

### Players
```lua
game.Players.LocalPlayer    -- Current player
Players:GetPlayers()        -- All players
Players.PlayerAdded:Connect(function(player) end)

-- LocalPlayer properties
local player = game.Players.LocalPlayer
player.Name
player.Character            -- Player model
player.Character.Position   -- Vector3
player.Character:GetPivot() -- CFrame
```

## Global Functions

```lua
print("Hello")              -- Console output
warn("Warning!")            -- Console warning
tick()                      -- Time in seconds
time()                      -- Alias for tick()
wait(seconds)               -- Delay (simplified)
typeof(obj)                 -- Get type name
```

### task (Modern API)
```lua
task.wait(seconds)          -- Better wait
task.spawn(function() end)  -- Run immediately
task.delay(seconds, fn)     -- Delayed call
```

## Block Types (Minecraft-specific)

grass, dirt, stone, cobblestone, sand, gravel, clay, brick, glass, wood, leaves, water, lava, ice, snow, obsidian, bedrock, ore_coal, ore_iron, ore_gold, ore_diamond

## Tree Types

oak, birch, pine, acacia, palm, willow, dark_oak, giant, cactus

## Common Colors

```lua
Color3.fromRGB(255, 0, 0)     -- Red
Color3.fromRGB(0, 255, 0)     -- Green
Color3.fromRGB(0, 0, 255)     -- Blue
Color3.fromRGB(255, 255, 0)   -- Yellow
Color3.fromRGB(255, 128, 0)   -- Orange
Color3.fromRGB(128, 0, 128)   -- Purple
Color3.fromRGB(255, 192, 203) -- Pink
Color3.fromRGB(139, 69, 19)   -- Brown
Color3.fromRGB(255, 255, 255) -- White
Color3.fromRGB(0, 0, 0)       -- Black
```

## Example: Build a House

```lua
local function buildHouse(x, y, z)
    -- Floor
    workspace.Fill(x, y, z, x+6, y, z+6, "cobblestone")

    -- Walls (4 high)
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

local pos = game.Players.LocalPlayer.Character.Position
buildHouse(math.floor(pos.X) + 5, math.floor(pos.Y), math.floor(pos.Z))
```

## Example: Spawn Farm Animals

```lua
local colors = {
    Color3.fromRGB(255, 192, 203), -- Pink pig
    Color3.fromRGB(255, 255, 255), -- White sheep
    Color3.fromRGB(139, 69, 19),   -- Brown cow
}
local names = {"Pig", "Sheep", "Cow"}
local pos = game.Players.LocalPlayer.Character.Position

for i = 1, 3 do
    local creature = Instance.new("Creature")
    creature.Name = names[i]
    creature.Color = colors[i]
    creature.Size = Vector3.new(0.6 + i * 0.2, 0.5 + i * 0.1, 0.8 + i * 0.2)
    creature.Health = 10 + i * 5
    creature.Behavior = "passive"
    creature.Position = Vector3.new(
        pos.X + (i - 2) * 3,
        pos.Y + 2,
        pos.Z + 5
    )
    creature:Spawn()
end
```

## Execution

From JavaScript:
```javascript
// Execute Lua code
window.executeLua(`
    local part = Instance.new("Part")
    part.Color = Color3.fromRGB(255, 0, 0)
    part.Parent = workspace
`);

// Or use the runtime directly
window.LuaRuntime.execute(luaCode, 'myScript');
```
