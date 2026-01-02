# Advanced CLI Verification Examples

The `customCode` verification type allows you to run **any JavaScript code** in the browser context with full access to the game state. This enables verification of complex scenarios.

## Example 1: Verify Building Shapes

Check if blocks exist in specific positions to verify structures:

```javascript
() => {
  const game = window.__VOXEL_GAME__;
  const targetY = 40;
  let stoneCount = 0;
  
  // Iterate through chunks to find blocks at specific coordinates
  const chunks = Array.from(game.chunks.values());
  for (const chunk of chunks) {
    if (!chunk.blocks) continue;
    const size = game.chunkSize;
    
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const wx = chunk.x * size + x;
          const wy = chunk.y * size + y;
          const wz = chunk.z * size + z;
          
          // Check if block is in target area
          if (wy === targetY && wx >= 48 && wx <= 52 && wz >= 48 && wz <= 52) {
            const idx = x + y * size + z * size * size;
            const blockType = chunk.blocks[idx];
            if (blockType === 1) stoneCount++; // 1 = stone
          }
        }
      }
    }
  }
  
  return { 
    success: stoneCount >= 20, 
    message: `Found ${stoneCount} stone blocks` 
  };
}
```

## Example 2: Verify Material Properties

Check mesh visibility, opacity, and material settings:

```javascript
() => {
  const game = window.__VOXEL_GAME__;
  const pig = game.animals.find(a => a.constructor.name === 'Pig');
  
  if (!pig) return { success: false, message: 'No pig found' };
  
  const material = pig.mesh.material;
  const isInvisible = material.transparent && material.opacity < 0.5;
  
  return { 
    success: isInvisible, 
    message: `Pig opacity=${material.opacity}, transparent=${material.transparent}` 
  };
}
```

## Example 3: Verify Scene Graph

Check object hierarchy and relationships:

```javascript
() => {
  const game = window.__VOXEL_GAME__;
  
  // Find all objects at a specific position
  const checkPos = { x: 50, y: 40, z: 50 };
  const nearbyObjects = game.scene.children.filter(obj => {
    if (!obj.position) return false;
    const dist = obj.position.distanceTo(checkPos);
    return dist < 10;
  });
  
  return { 
    success: nearbyObjects.length > 0, 
    message: `Found ${nearbyObjects.length} objects near position` 
  };
}
```

## Example 4: Verify Animation State

Check if entities are in specific states:

```javascript
() => {
  const game = window.__VOXEL_GAME__;
  const bird = game.animals.find(a => a.constructor.name === 'Pugasus');
  
  if (!bird) return { success: false, message: 'No Pugasus found' };
  
  // Check if flying (velocity.y > 0)
  const isFlying = bird.velocity && bird.velocity.y > 0.1;
  
  return { 
    success: isFlying, 
    message: `Pugasus velocity.y=${bird.velocity?.y}` 
  };
}
```

## Tips for Complex Verification

1. **Access the full game state** via `window.__VOXEL_GAME__`
2. **Iterate through chunks** to check block positions
3. **Check mesh properties** like `visible`, `material.opacity`, `material.color`
4. **Verify scene hierarchy** using `game.scene.children`
5. **Return detailed messages** to understand failures
6. **Use tolerance** for floating point comparisons

## Usage

```bash
# Run with custom verification
node bin/cli.js run tests/verify_building.json

# Or with CLI args
node bin/cli.js test "Build a tower" --tool build_structure
```
