# VoxelWorld SDK

## Presets (Fastest Way)

```javascript
// Creature - AI, physics, health auto-configured
// IMPORTANT: Use an array of parts for good-looking creatures!
VoxelWorld.createCreature('Frog', {
  mesh: [
    // Body
    { type: 'box', size: [0.5, 0.4, 0.6], color: 0x228B22, position: [0, 0.3, 0], name: 'body' },
    // Head (wider)
    { type: 'box', size: [0.55, 0.3, 0.4], color: 0x228B22, position: [0, 0.45, 0.35], name: 'head' },
    // Eyes (bulging on top) - white + pupil
    { type: 'sphere', size: [0.12], color: 0xffffff, position: [-0.18, 0.7, 0.4] },
    { type: 'sphere', size: [0.12], color: 0xffffff, position: [0.18, 0.7, 0.4] },
    { type: 'sphere', size: [0.06], color: 0x000000, position: [-0.18, 0.7, 0.5] },
    { type: 'sphere', size: [0.06], color: 0x000000, position: [0.18, 0.7, 0.5] },
    // Mouth line
    { type: 'box', size: [0.3, 0.02, 0.02], color: 0x145214, position: [0, 0.35, 0.55] },
    // Front legs (named for animation)
    { type: 'box', size: [0.1, 0.15, 0.1], color: 0x228B22, position: [-0.25, 0.1, 0.3], name: 'leg_fl' },
    { type: 'box', size: [0.1, 0.15, 0.1], color: 0x228B22, position: [0.25, 0.1, 0.3], name: 'leg_fr' },
    // Back legs (bigger, named for animation)
    { type: 'box', size: [0.15, 0.2, 0.25], color: 0x228B22, position: [-0.28, 0.15, -0.2], name: 'leg_bl' },
    { type: 'box', size: [0.15, 0.2, 0.25], color: 0x228B22, position: [0.28, 0.15, -0.2], name: 'leg_br' }
  ],
  behavior: 'passive',  // passive | neutral | hostile | pet
  health: 10,
  speed: 2
}).register();
VoxelWorld.spawn('frog');

// Item - for inventory (use multi-part for detail!)
VoxelWorld.createItem('MagicStaff', {
  mesh: [
    { type: 'cylinder', size: [0.04, 0.04, 0.8], color: 0x5c4033, position: [0, 0, 0] },  // Shaft
    { type: 'torus', size: [0.06, 0.015], color: 0xFFD700, position: [0, 0.4, 0], rotation: [90, 0, 0] },  // Gold ring
    { type: 'sphere', size: [0.05], color: 0x9900ff, position: [0, 0.45, 0], emissive: true }  // Glowing crystal
  ],
  icon: '<svg viewBox="0 0 32 32"><rect x="15" y="8" width="2" height="20" fill="#5c4033"/><circle cx="16" cy="6" r="3" fill="#9900ff"/></svg>',
  category: 'tool'  // tool | block | food | material | misc
}).register();
VoxelWorld.giveItem('magicstaff');

// Projectile - auto physics + optional trail
VoxelWorld.createProjectile('Fireball', {
  mesh: { meshType: 'sphere', size: [0.3], color: 0xff4400, emissive: true },
  damage: 15,
  trail: true
}).register();
```

## Manual Creation

```javascript
VoxelWorld.createObject('name')
  .attach('mesh', { meshType: 'box', size: [1,1,1], color: 0xff0000 })
  .attach('ai', { behavior: 'passive' })  // physics auto-attached!
  .attach('health', { max: 20 })
  .register();
VoxelWorld.spawn('name');  // No coords = in front of player
VoxelWorld.spawn('name', x, y, z);
```

## Smart Defaults

| If you attach... | SDK auto-adds... |
|------------------|------------------|
| AIScript | PhysicsScript (for movement) |
| ProjectileScript | PhysicsScript (flying mode) |
| AnimationScript + AIScript | Auto-links walk/idle to movement |

## Mesh Options

```javascript
.attach('mesh', {
  meshType: 'box',      // box, sphere, cylinder, cone, capsule, torus, plane
  size: [w, h, d],      // dimensions (varies by type)
  color: 0xff0000,      // hex color
  emissive: true,       // makes it glow
  emissiveIntensity: 0.5
})
```

Mesh types:
- `box`: size=[width, height, depth]
- `sphere`: size=[radius]
- `cylinder`: size=[radiusTop, radiusBottom, height]
- `cone`: size=[radius, height]
- `capsule`: size=[radius, length]

## Built-in Scripts (11)

| Script | Config | Description |
|--------|--------|-------------|
| `mesh` | `[{ type, size, color }]` | 3D visuals |
| `item` | `{ icon: '<svg>...</svg>', category: 'tool' }` | Inventory item |
| `health` | `{ max: 20, damage: 5 }` | Health system |
| `physics` | `{ mode: 'walking'\|'hopping'\|'flying', speed: 3, collider: true }` | Movement + collision |
| `ai` | `{ behavior: 'passive'\|'neutral'\|'hostile'\|'pet', speed: 2 }` | AI with smart wandering |
| `shooter` | `{ projectile: 'id', speed: 20, cooldown: 500 }` | Fire projectiles |
| `projectile` | `{ damage: 10, lifetime: 3, gravity: 0 }` | Projectile behavior |
| `particle` | `{ trail: true, trailColor: 0xffffff }` | Particle effects |
| `animation` | `{ animations: {...}, defaultAnimation: 'idle' }` | Skeletal animation |
| `sound` | `{ sounds: { name: url }, autoPlay: 'name' }` | 3D positional audio |
| `debug` | `{ showCollider: true, showPath: true }` | Visual debug helpers |

## AI Behaviors

- `passive` - Wanders, flees from player
- `neutral` - Wanders, fights back if attacked
- `hostile` - Actively hunts player
- `pet` - Follows player

## Custom Scripts

```javascript
class MyScript {
  speed = 2;  // Default properties

  Start() { this.time = 0; }
  Update() {
    this.time += Time.deltaTime;
    this.transform.position.y = Math.sin(this.time) * this.speed;
    this.gameObject.syncTransform();  // REQUIRED after transform changes
  }
  OnUse(player) {}
  OnDamage(amount, attacker) {}
  OnDeath() {}
}

.attach(MyScript, { speed: 3 })
```

**Script has access to:** `this.gameObject`, `this.transform`, `Time.deltaTime`, `Time.time`

## Transform

```javascript
this.transform.position.set(x, y, z);
this.transform.rotation.y += 0.1;
this.transform.Translate(dx, dy, dz);
this.transform.LookAt(target);
this.gameObject.syncTransform();  // Always call after changes!
```

## World API

```javascript
// Player
VoxelWorld.localPlayer;           // Player with .transform.position, .transform.forward
VoxelWorld.playerPosition;        // {x,y,z} shortcut
VoxelWorld.inFront(distance);     // Position in front of player

// Blocks
VoxelWorld.setBlock(x, y, z, 'stone');
VoxelWorld.fill(x1, y1, z1, x2, y2, z2, 'brick');
VoxelWorld.spawnTree('oak', x, y, z);

// Items
VoxelWorld.giveItem('name', quantity);

// Find entities
VoxelWorld.findEntities('type');
VoxelWorld.findNearestEntity('type');
VoxelWorld.findInRadius(pos, radius);

// Modify existing
VoxelWorld.addScript('type', ScriptClass);
VoxelWorld.addParts('type', [{ type:'sphere', size:[0.2], color:0xfff, position:[0,1,0] }]);

// Destroy
VoxelWorld.destroyEntity(entity);
VoxelWorld.destroyAllOfType('type');
VoxelWorld.undoLast();
```

## Vec3 Helper

```javascript
Vec3.add(a, b);  Vec3.sub(a, b);  Vec3.mul(v, scalar);
Vec3.normalize(v);  Vec3.distance(a, b);

// Spawn in front of player
const p = VoxelWorld.localPlayer;
const pos = Vec3.add(p.transform.position, Vec3.mul(p.transform.forward, 5));
VoxelWorld.spawn('obj', pos.x, pos.y, pos.z);
```

## Fluent Callbacks

```javascript
VoxelWorld.createObject('orb')
  .attach('mesh', [{ type: 'sphere', size: [0.5], color: 0x00ffff }])
  .on('use', (obj, player) => { /* on use */ })
  .on('update', (obj, dt) => { obj.transform.rotation.y += dt; obj.syncTransform(); })
  .register();
```

## Accessing Mesh Parts

```javascript
Start() {
  this.eye = this.gameObject.mesh.getObjectByName('eye');  // Cache in Start
}
Update() {
  if (this.eye) this.eye.position.x = Math.sin(Time.time);  // Modify directly
}
```

## Creature Design Best Practices

Good creatures need **multiple parts** - not just a single primitive!

### Essential parts for a creature:
1. **Body** - main shape
2. **Head** - separate from body
3. **Eyes** - white sphere/box + smaller black pupil positioned slightly in front
4. **Facial features** - nose/snout, mouth, ears
5. **Limbs** - legs for quadrupeds, arms for bipeds

### Eye pattern (always use this!):
```javascript
// White of eye
{ type: 'sphere', size: [0.12], color: 0xffffff, position: [-0.2, 0.8, 0.4] },
// Black pupil (slightly in front, smaller)
{ type: 'sphere', size: [0.06], color: 0x000000, position: [-0.2, 0.8, 0.48] },
```

### Color tips:
- Use 3-5 colors minimum: body, eye white (0xffffff), pupil (0x000000), accent
- Hooves/feet slightly darker than body
- Belly/underside slightly lighter

## Colors

Red=0xff0000, Green=0x00ff00, Blue=0x0000ff, Yellow=0xffff00, Orange=0xff4500, Purple=0x800080, Cyan=0x00ffff, Brown=0x5c4033, White=0xffffff, Black=0x000000

## Block Types

grass, dirt, stone, cobblestone, sand, gravel, clay, brick, glass, wood, leaves, water, lava, ice, snow, obsidian, bedrock, ore_coal, ore_iron, ore_gold, ore_diamond

## Tree Types

oak, birch, pine, acacia, palm, willow, dark_oak, giant, cactus
