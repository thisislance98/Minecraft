# SDK Automated Test Plan

## Overview

Systematically test all VoxelWorld SDK functionality using the `ai-test` CLI without human input. This plan identifies gaps in current testing capabilities and proposes solutions.

---

## Current Capabilities

The CLI already has:
- **`drive` command** - Execute arbitrary JS with `VoxelWorld`, `game`, `player`, `THREE`, `Time` globals
- **SDK verification types** - `sdkObjectExists`, `sdkItemExists`, `sdkEntityExists`, `sdkInstanceCount`, `sdkBlockPlaced`
- **`sdkTestWorkflow`** - Tests create → register → spawn/give → verify
- **GameCommands SDK functions** - `sdkCreate`, `sdkSpawn`, `sdkGive`, `sdkSetBlock`, `sdkFill`, `sdkSpawnTree`, etc.

---

## Test Categories

### 1. Object Creation & Registration
| Test | What to Verify | Status |
|------|---------------|--------|
| Create basic object | Object in `_objects` registry | ✅ Exists |
| Create item | Object in `_items`, has icon | ✅ Exists |
| Create entity | Object in `_entities` | ✅ Exists |
| Create projectile | Object in `_projectiles` | ❌ Missing |
| Attach custom script (class) | Script runs lifecycle | ❌ Missing |
| Attach custom script (object) | Script runs lifecycle | ❌ Missing |
| `VoxelWorld.create()` quick API | Object registered | ❌ Missing |
| `VoxelWorld.defineScript()` | Custom script stored | ❌ Missing |

### 2. Built-in Scripts
| Script | Config Options | Verification Method |
|--------|---------------|---------------------|
| **mesh** | parts, type, size, color, emissive, position, rotation | Mesh has correct geometry/material |
| **item** | icon, category, stackable, maxStack | Icon stored, item giveable |
| **entity** | (marker only) | In entities registry |
| **health** | max, regenerate | Health value accessible |
| **physics** | mode, speed, gravity, jumpHeight | Object moves correctly |
| **ai** | behavior, wander, detectionRange, etc. | Entity exhibits behavior |
| **collider** | width, height, depth, offset | Collision detected |
| **shooter** | projectile, speed, spread, cooldown | Projectile spawns |
| **projectile** | damage, lifetime, gravity | Projectile moves, hits |
| **particle** | trail, burstOnDeath, colors | Particles emit |

### 3. Lifecycle Methods
| Method | Trigger | Verification |
|--------|---------|--------------|
| `Awake()` | On attach | Flag set |
| `Start()` | On spawn | Flag set |
| `Update()` | Every frame | Counter increments |
| `OnDestroy()` | On destroy | Cleanup runs |
| `OnCollisionEnter()` | Collision | Callback fires |
| `OnUse()` | Player use | Return value |
| `OnDamage()` | Take damage | Health reduced |
| `OnDeath()` | Health 0 | Object destroyed |

### 4. World API
| API | Test | Verification |
|-----|------|--------------|
| `spawn(id)` | Spawn in front of player | Instance in `_instances` |
| `spawn(id, x, y, z)` | Spawn at position | Instance at correct position |
| `giveItem(id)` | Give item | Item in inventory |
| `giveItem(id, count)` | Give multiple | Correct count |
| `getBlock(x, y, z)` | Query block | Returns block type |
| `setBlock(x, y, z, type)` | Place block | Block exists |
| `setBlock(x, y, z, null)` | Remove block | Block is air |
| `removeBlock()` | Remove block | Block is air |
| `setBlocks([])` | Batch place | All blocks placed |
| `fill(...)` | Fill region | Region filled |
| `spawnTree(type, ...)` | Spawn tree | Structure exists |
| `getTreeTypes()` | List trees | Returns array |
| `getBlockTypes()` | List blocks | Returns array |
| `findInRadius()` | Query nearby | Returns instances |
| `localPlayer` | Get player | Player reference |

### 5. GameObject API
| API | Test | Verification |
|-----|------|--------------|
| `GetComponent(name)` | Get script | Returns script instance |
| `HasComponent(name)` | Check script | Returns boolean |
| `AddComponent(script)` | Add script | Script attached |
| `destroy()` | Destroy object | Removed from scene |
| `GameObject.Destroy(obj, delay)` | Delayed destroy | Destroyed after delay |
| `SetActive(false/true)` | Hide/show | Mesh visibility |
| `syncTransform()` | Sync mesh | Position matches |

### 6. Transform API
| API | Test | Verification |
|-----|------|--------------|
| `position.set(x, y, z)` | Set position | Position changed |
| `rotation.y = value` | Set rotation | Rotation changed |
| `scale.set(s, s, s)` | Set scale | Scale changed |
| `Translate(dx, dy, dz)` | Move relative | Position offset |
| `Rotate(rx, ry, rz)` | Rotate relative | Rotation offset |
| `LookAt(target)` | Face target | Facing direction |

### 7. Events System
| Event | Trigger | Verification |
|-------|---------|--------------|
| `object:registered` | Register | Callback fires |
| `object:spawn` | Spawn | Callback fires |
| `block:placed` | setBlock | Callback fires |
| `block:removed` | removeBlock | Callback fires |
| `on()` / `off()` | Subscribe/unsubscribe | Works correctly |

---

## Implementation Plan

### Phase 1: Add Test Infrastructure

#### 1.1 New CLI command: `ai-test sdk-test`
```bash
ai-test sdk-test              # Run all SDK tests
ai-test sdk-test --category objects   # Run specific category
ai-test sdk-test --verbose    # Detailed output
ai-test sdk-test --json       # JSON output for CI
```

#### 1.2 Add SDK test suite file
Create `/ai-test-cli/tests/sdk-tests.js`:
```javascript
export const SDK_TESTS = {
  objects: [...],
  scripts: [...],
  lifecycle: [...],
  world: [...],
  transform: [...],
  events: [...]
};
```

### Phase 2: Test Definitions

#### 2.1 Object Creation Tests
```javascript
{
  name: 'Create basic object',
  code: `
    VoxelWorld.createObject('test_cube')
      .attach('mesh', { parts: [{ type: 'box', size: [1,1,1], color: 0xff0000 }] })
      .register();
  `,
  verify: [
    { type: 'sdkObjectExists', objectId: 'test_cube' }
  ]
}
```

#### 2.2 Lifecycle Tests
```javascript
{
  name: 'Lifecycle methods called',
  code: `
    window.__TEST_FLAGS__ = { awake: false, start: false, updateCount: 0 };

    class TestScript {
      Awake() { window.__TEST_FLAGS__.awake = true; }
      Start() { window.__TEST_FLAGS__.start = true; }
      Update() { window.__TEST_FLAGS__.updateCount++; }
    }

    VoxelWorld.createObject('lifecycle_test')
      .attach('mesh', { parts: [{ type: 'sphere', size: [0.5], color: 0x00ff00 }] })
      .attach(TestScript)
      .register();

    VoxelWorld.spawn('lifecycle_test');
  `,
  wait: 500,  // Wait for a few update cycles
  verify: [
    { type: 'customCode', code: `() => ({
        success: window.__TEST_FLAGS__.awake &&
                 window.__TEST_FLAGS__.start &&
                 window.__TEST_FLAGS__.updateCount > 5,
        message: JSON.stringify(window.__TEST_FLAGS__)
      })`
    }
  ],
  cleanup: `delete window.__TEST_FLAGS__;`
}
```

#### 2.3 Physics Test
```javascript
{
  name: 'Physics hopping mode',
  code: `
    VoxelWorld.createObject('hopper')
      .attach('mesh', { parts: [{ type: 'sphere', size: [0.5], color: 0x00ff00 }] })
      .attach('physics', { mode: 'hopping', speed: 5, jumpHeight: 2 })
      .attach('entity')
      .register();

    const inst = VoxelWorld.spawn('hopper', 0, 60, 0);
    window.__TEST_HOPPER__ = inst;
  `,
  wait: 3000,  // Wait for hopping
  verify: [
    { type: 'customCode', code: `() => {
        const h = window.__TEST_HOPPER__;
        if (!h) return { success: false, message: 'Hopper not found' };
        // Check if it moved from spawn position
        const moved = Math.abs(h.transform.position.x) > 0.5 ||
                      Math.abs(h.transform.position.z) > 0.5;
        return { success: moved, message: 'Position: ' + JSON.stringify(h.transform.position) };
      }`
    }
  ]
}
```

### Phase 3: Additional Verifications Needed

Add to `runner.js`:

```javascript
case 'sdkProjectileExists': {
  const exists = await this.browser.evaluate((projId) => {
    const vw = window.VoxelWorld;
    return vw?._projectiles?.has(projId) || false;
  }, check.projectileId);
  // ...
}

case 'sdkScriptHasProperty': {
  const value = await this.browser.evaluate((objId, scriptType, prop) => {
    const vw = window.VoxelWorld;
    const obj = vw._objects.get(objId);
    if (!obj) return { found: false };
    const script = obj.getScript(scriptType);
    return { found: true, value: script?.[prop] };
  }, check.objectId, check.scriptType, check.property);
  // ...
}

case 'sdkInstancePosition': {
  const pos = await this.browser.evaluate((name, index = 0) => {
    const vw = window.VoxelWorld;
    let i = 0;
    for (const inst of vw._instances) {
      if (inst.name === name || inst.id === name) {
        if (i === index) {
          return { x: inst.transform.position.x,
                   y: inst.transform.position.y,
                   z: inst.transform.position.z };
        }
        i++;
      }
    }
    return null;
  }, check.name, check.index);
  // Verify position in expected range
}

case 'sdkEventFired': {
  // Check if an event was fired (requires setting up listener beforehand)
}
```

### Phase 4: Test Runner Updates

#### 4.1 Add cleanup support
```javascript
// After verifications
if (testCase.cleanup) {
  await this.browser.evaluate(testCase.cleanup);
}
```

#### 4.2 Add test isolation
```javascript
// Before each test
await this.browser.evaluate(() => {
  // Clear test objects
  const vw = window.VoxelWorld;
  for (const [id, obj] of vw._objects) {
    if (id.startsWith('test_')) {
      vw._objects.delete(id);
      vw._items.delete(id);
      vw._entities.delete(id);
    }
  }
  // Clear instances
  for (const inst of vw._instances) {
    if (inst.name.startsWith('test_')) {
      inst.destroy();
    }
  }
});
```

### Phase 5: SDK Additions

Add to `VoxelWorld.js` for better testability:

```javascript
// Debug/test helpers
_getInstancesByName(name) {
  return [...this._instances].filter(i => i.name === name || i.id === name);
}

_getInstanceCount(name = null) {
  if (!name) return this._instances.size;
  return this._getInstancesByName(name).length;
}

_clearTestObjects() {
  // Remove objects with 'test_' prefix
  for (const [id] of this._objects) {
    if (id.startsWith('test_')) {
      this._objects.delete(id);
      this._items.delete(id);
      this._entities.delete(id);
      this._projectiles.delete(id);
    }
  }
}
```

---

## Complete Test Suite Structure

```
ai-test-cli/
  tests/
    sdk/
      01-objects.js       # Object creation tests
      02-scripts.js       # Built-in script tests
      03-lifecycle.js     # Lifecycle method tests
      04-world-api.js     # World API tests
      05-gameobject.js    # GameObject API tests
      06-transform.js     # Transform tests
      07-events.js        # Event system tests
      08-integration.js   # Full workflow tests
      index.js            # Exports all tests
```

---

## CLI Command Implementation

```javascript
program
  .command('sdk-test')
  .description('Run SDK automated test suite')
  .option('-c, --category <name>', 'Run specific category')
  .option('-t, --test <name>', 'Run specific test by name')
  .option('--headless', 'Run headless', true)
  .option('--verbose', 'Verbose output')
  .option('--json', 'JSON output')
  .option('--bail', 'Stop on first failure')
  .action(async (options) => {
    const { SDKTestRunner } = await import('../src/sdk-test-runner.js');
    const runner = new SDKTestRunner(options);
    const results = await runner.runAll();

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      runner.printResults(results);
    }

    process.exit(results.failed > 0 ? 1 : 0);
  });
```

---

## Expected Output

```
$ ai-test sdk-test

SDK Test Suite v1.0
══════════════════════════════════════

📦 Object Creation (8 tests)
  ✓ Create basic object
  ✓ Create item with icon
  ✓ Create entity
  ✓ Create projectile
  ✓ Attach custom class script
  ✓ Attach custom object script
  ✓ VoxelWorld.create() quick API
  ✓ VoxelWorld.defineScript()

📜 Built-in Scripts (10 tests)
  ✓ mesh script - geometry
  ✓ mesh script - materials
  ✓ item script - inventory
  ✓ entity script - registry
  ✓ health script - damage
  ✓ physics script - walking
  ✓ physics script - hopping
  ✓ ai script - passive
  ✓ collider script - bounds
  ✓ shooter script - fire

🔄 Lifecycle Methods (8 tests)
  ✓ Awake called on attach
  ✓ Start called on spawn
  ✓ Update called each frame
  ✓ OnDestroy called on destroy
  ✓ OnCollisionEnter on collision
  ✓ OnUse on player use
  ✓ OnDamage on damage
  ✓ OnDeath on health zero

🌍 World API (14 tests)
  ✓ spawn() in front of player
  ✓ spawn() at position
  ✓ giveItem()
  ✓ giveItem() with count
  ✓ getBlock()
  ✓ setBlock()
  ✓ removeBlock()
  ✓ setBlocks() batch
  ✓ fill() region
  ✓ spawnTree()
  ✓ getTreeTypes()
  ✓ getBlockTypes()
  ✓ findInRadius()
  ✓ localPlayer

🎮 GameObject API (6 tests)
  ✓ GetComponent()
  ✓ HasComponent()
  ✓ AddComponent()
  ✓ destroy()
  ✓ GameObject.Destroy() with delay
  ✓ SetActive()

📐 Transform API (6 tests)
  ✓ position.set()
  ✓ rotation
  ✓ scale
  ✓ Translate()
  ✓ Rotate()
  ✓ LookAt()

📡 Events System (4 tests)
  ✓ object:registered event
  ✓ object:spawn event
  ✓ block events
  ✓ on() / off() subscribe

══════════════════════════════════════
Results: 56/56 passed (0 failed)
Time: 12.3s
```

---

## Priority Order

1. **High Priority** (Core functionality)
   - Object creation & registration
   - Lifecycle methods (especially Update)
   - spawn() and giveItem()
   - Basic script attachment

2. **Medium Priority** (Important features)
   - Built-in scripts (mesh, health, physics)
   - World API (blocks, trees)
   - Transform API
   - Events system

3. **Lower Priority** (Edge cases)
   - AI behaviors
   - Particle effects
   - Visual verification
   - Collision detection

---

## Files to Create/Modify

1. **Create**: `/ai-test-cli/src/sdk-test-runner.js` - New test runner class
2. **Create**: `/ai-test-cli/tests/sdk/` - Test definition files
3. **Modify**: `/ai-test-cli/bin/cli.js` - Add `sdk-test` command
4. **Modify**: `/ai-test-cli/src/runner.js` - Add new verification types
5. **Modify**: `/src/game/sdk/VoxelWorld.js` - Add test helpers (optional)
