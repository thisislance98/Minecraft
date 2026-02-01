# VoxelWorld SDK

Unity-style scripting for the voxel game engine.

## Quick Start

```javascript
// Create a spinning cube
class SpinScript {
  speed = 2;

  Start() {
    this.angle = 0;
  }

  Update() {
    this.angle += this.speed * Time.deltaTime;
    this.transform.rotation.y = this.angle;
    this.gameObject.syncTransform();
  }
}

VoxelWorld.createObject('spinner')
  .attach('mesh', { parts: [{ type: 'box', size: [2, 2, 2], color: 0x00ff00 }] })
  .attach(SpinScript)
  .register();

VoxelWorld.spawn('spinner');
```

---

## Scripts (Components)

Scripts are attached to GameObjects and provide behavior. They follow Unity conventions.

### Lifecycle Methods

| Method | Description |
|--------|-------------|
| `Awake()` | Called once when script is first attached |
| `Start()` | Called before first Update |
| `Update()` | Called every frame |
| `OnDestroy()` | Called when object is destroyed |
| `OnCollisionEnter(other)` | Called on collision |
| `OnTriggerEnter(other)` | Called on trigger enter |
| `OnUse(player)` | Called when player uses the object |
| `OnDamage(amount, attacker)` | Called when taking damage |
| `OnDeath()` | Called when health reaches 0 |

### Script Properties

Every script has access to:

```javascript
this.gameObject   // The GameObject this script is attached to
this.transform    // Shortcut to gameObject.transform
Time.deltaTime    // Time since last frame (seconds)
Time.time         // Total time elapsed
```

### Example Scripts

**Spinning Object:**
```javascript
class Spin {
  speed = 2;

  Update() {
    this.transform.rotation.y += this.speed * Time.deltaTime;
    this.gameObject.syncTransform();
  }
}
```

**Hovering Object:**
```javascript
class Hover {
  amplitude = 0.5;
  speed = 2;

  Start() {
    this.startY = this.transform.position.y;
    this.time = 0;
  }

  Update() {
    this.time += Time.deltaTime * this.speed;
    this.transform.position.y = this.startY + Math.sin(this.time) * this.amplitude;
    this.gameObject.syncTransform();
  }
}
```

**Auto-Destroy After Time:**
```javascript
class AutoDestroy {
  lifetime = 5;

  Start() {
    this.timer = 0;
  }

  Update() {
    this.timer += Time.deltaTime;
    if (this.timer >= this.lifetime) {
      this.gameObject.destroy();
    }
  }
}
```

**Projectile:**
```javascript
class Projectile {
  speed = 20;
  damage = 10;

  Start() {
    this.direction = new THREE.Vector3(0, 0, 1);
  }

  Update() {
    const move = this.direction.clone().multiplyScalar(this.speed * Time.deltaTime);
    this.transform.position.add(move);
    this.gameObject.syncTransform();
  }

  OnCollisionEnter(other) {
    const health = other.GetComponent('health');
    if (health) {
      health.TakeDamage(this.damage);
    }
    this.gameObject.destroy();
  }
}
```

---

## Creating Objects

### Basic Object

```javascript
VoxelWorld.createObject('cube')
  .attach('mesh', { parts: [{ type: 'box', size: [1, 1, 1], color: 0x00ff00 }] })
  .attach(SpinScript, { speed: 3 })  // Pass config to override defaults
  .register();
```

### Item (Goes in Inventory)

```javascript
class FireWand {
  OnUse(player) {
    console.log('Casting fire!');
    VoxelWorld.spawn('fireball',
      player.position.x,
      player.position.y + 1,
      player.position.z
    );
  }
}

VoxelWorld.createObject('fire_wand')
  .attach('mesh', { parts: [
    { type: 'cylinder', size: [0.1, 0.8], color: 0x5c4033 },
    { type: 'sphere', size: [0.15], color: 0xff4500, emissive: true, position: [0, 0.4, 0] }
  ]})
  .attach('item', {
    icon: '<svg viewBox="0 0 32 32"><rect x="14" y="4" width="4" height="20" fill="#5c4033"/><circle cx="16" cy="4" r="4" fill="orange"/></svg>',
    category: 'tool'
  })
  .attach(FireWand)
  .register();

VoxelWorld.giveItem('fire_wand');
```

### Entity (Creature)

```javascript
class WanderAI {
  speed = 2;

  Start() {
    this.direction = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    this.changeTime = 0;
  }

  Update() {
    this.changeTime += Time.deltaTime;
    if (this.changeTime > 3) {
      this.direction = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      this.changeTime = 0;
    }

    this.transform.Translate(
      this.direction.x * this.speed * Time.deltaTime,
      0,
      this.direction.z * this.speed * Time.deltaTime
    );
  }
}

VoxelWorld.createObject('slime')
  .attach('mesh', { parts: [{ type: 'sphere', size: [0.8], color: 0x00ff00 }] })
  .attach('entity')
  .attach('health', { max: 20 })
  .attach(WanderAI, { speed: 3 })
  .register();

VoxelWorld.spawn('slime');
```

---

## Built-in Scripts

### mesh
```javascript
.attach('mesh', {
  parts: [
    { type: 'box', size: [w, h, d], color: 0xff0000 },
    { type: 'sphere', size: [radius], color: 0x00ff00, emissive: true },
    { type: 'cylinder', size: [radius, height], color: 0x0000ff, position: [x, y, z] },
    { type: 'cone', size: [radius, height], color: 0xffff00, rotation: [rx, ry, rz] }
  ]
})
```

### item
```javascript
.attach('item', {
  icon: '<svg>...</svg>',  // Required - SVG string
  category: 'tool',        // tool | block | food | material
  stackable: false,
  maxStack: 1
})
```

### entity
```javascript
.attach('entity')  // Marks as spawnable creature
```

### health
```javascript
.attach('health', {
  max: 20,
  regenerate: false
})
```

### projectile
```javascript
.attach('projectile', {
  damage: 10,
  lifetime: 3,
  gravity: 0.5,
  destroyOnHit: true
})
```

---

## Transform

```javascript
// Position
this.transform.position.x = 10;
this.transform.position.set(x, y, z);

// Rotation (radians)
this.transform.rotation.y += 0.1;

// Scale
this.transform.scale.set(2, 2, 2);

// Helper methods
this.transform.Translate(dx, dy, dz);  // Move relative
this.transform.Rotate(rx, ry, rz);     // Rotate relative
this.transform.LookAt(target);         // Face target

// Always call after modifying transform
this.gameObject.syncTransform();
```

---

## World API

```javascript
// Spawn objects
VoxelWorld.spawn('slime');                    // In front of player
VoxelWorld.spawn('slime', x, y, z);           // At position

// Items
VoxelWorld.giveItem('wand');
VoxelWorld.giveItem('wand', 5);               // Quantity

// Blocks
VoxelWorld.setBlock(x, y, z, 'stone');
VoxelWorld.setBlock(x, y, z, null);           // Remove
VoxelWorld.fill(x1, y1, z1, x2, y2, z2, 'brick');

// Trees
VoxelWorld.spawnTree('oak', x, y, z);
// Types: oak, birch, pine, acacia, palm, willow, dark_oak, giant

// Query
VoxelWorld.findInRadius(position, radius);
VoxelWorld.localPlayer;
```

---

## GameObject API

```javascript
// Get component
const health = this.gameObject.GetComponent('health');

// Destroy
this.gameObject.destroy();
GameObject.Destroy(obj, 2);  // Destroy after 2 seconds

// Active state
this.gameObject.SetActive(false);  // Hide
this.gameObject.SetActive(true);   // Show

// Tags
this.gameObject.tag = 'Enemy';
```

---

## Time

```javascript
Time.deltaTime   // Seconds since last frame (~0.016 at 60fps)
Time.time        // Total elapsed time
Time.frameCount  // Total frames rendered
```

---

## Colors

| Color  | Hex      |
|--------|----------|
| Red    | 0xff0000 |
| Green  | 0x00ff00 |
| Blue   | 0x0000ff |
| Orange | 0xff4500 |
| Yellow | 0xffff00 |
| Purple | 0x800080 |
| Cyan   | 0x00ffff |
| Brown  | 0x5c4033 |
| White  | 0xffffff |
| Black  | 0x000000 |

---

## CLI Testing

```bash
# Run script
ai-test drive "VoxelWorld.spawn('sphere');"

# Run script file
ai-test drive -f my_script.js

# Interactive REPL
ai-test drive -i

# Keep browser open longer
ai-test drive "..." -k 30000
```

**Available in scripts:** `VoxelWorld`, `game`, `player`, `THREE`, `Time`, `detect()`, `detectAround()`
