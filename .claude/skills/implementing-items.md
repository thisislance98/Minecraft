# Skill: Implementing Items

## Overview
Items are AI-generated JavaScript classes that extend `Item` or `WandItem`. They include a 3D mesh (for preview/dropping), an SVG icon (for inventory UI), and action handlers. Items are created via the Merlin AI panel, persisted in Firebase, and dynamically loaded on clients.

## Architecture

### Full Lifecycle
1. **User Request** - Player types in the Merlin panel (e.g., "make a fire sword")
2. **Category Resolution** - Routed to `handleCreateItem()` via the `item` category button or semantic similarity
3. **Prompt Building** - `getItemPrompt()` in `server/ai/few_shot_prompts.ts` selects best few-shot examples
4. **AI Generation** - OpenRouter API call with `create_item` tool for structured output (className + code + icon SVG)
5. **Validation** - Code validated: extends Item/WandItem, has getMesh(), calls super(), no dangerous patterns
6. **Server Storage** - `DynamicItemService.saveItem()` stores in Firebase
7. **Broadcast** - Socket.IO emits `item_definition` to clients
8. **Client Registration** - `DynamicItemRegistry.registerDynamicItem()` creates the class, registers in `ItemClasses` and `ItemManager`
9. **Give to Player** - Item is automatically added to player inventory via `give_item` tool

### Key Files

| File | Purpose |
|------|---------|
| `server/ai/examples/items.ts` | Few-shot example items (MagicWand, FireSword, HealingPotion, Flashlight) |
| `server/ai/few_shot_prompts.ts` | `getItemPrompt()` - builds system prompt with examples |
| `server/ai/few_shot_tools.ts` | `getItemTools()` - tool schema (className, code, icon) |
| `server/ai/few_shot_system.ts` | `FewShotAI.handleCreateItem()` - main handler |
| `server/services/FewShotSession.ts` | WebSocket handler, saves item & gives to player |
| `server/services/DynamicItemService.ts` | Firebase persistence, validation, broadcasting |
| `src/game/core/DynamicItemRegistry.js` | Client-side: evaluates code, registers in ItemClasses & ItemManager |
| `src/game/core/ItemRegistry.js` | Central registry of all item classes (`ItemClasses`) |
| `src/game/items/Item.js` | Base `Item` class |
| `src/game/items/WandItem.js` | Base `WandItem` class (extends Item, has projectile support) |

## Item Class Structure

### Basic Item (extends Item)
```javascript
class MyItem extends Item {
    constructor() {
        super('my_item', 'My Item');  // (id, displayName)
        this.maxStack = 1;            // 1 for tools, 16/64 for consumables
        this.isTool = true;           // true = usable item
    }

    // Right-click action
    onUseDown(game, player) {
        // Your action code
        return true;  // Return true if action was handled
    }

    // Left-click action (optional)
    onPrimaryDown(game, player) {
        return false;
    }

    // Called every frame when held (optional)
    onHeldUpdate(game, player, dt) {
        // Update logic while item is in hand
    }

    // REQUIRED: 3D model for preview/dropping
    getMesh() {
        const group = new THREE.Group();
        // Build mesh with THREE.js geometries
        return group;
    }
}
```

### Wand Item (extends WandItem) - For Shooting Items
```javascript
class MyWand extends WandItem {
    constructor() {
        super('my_wand', 'My Wand');
        this.fireCooldown = 500;  // ms between shots
    }
    // WandItem handles projectile spawning via game.spawnMagicProjectile()

    getMesh() {
        const group = new THREE.Group();
        // Build wand mesh
        return group;
    }
}
```

## Item Naming Convention

**IMPORTANT**: Item class names MUST end with `Item` (PascalCase):
- `FireSwordItem` (correct)
- `HealingPotionItem` (correct)
- `FireSword` (incorrect - will fail validation in `saveItem()`)

The item ID (first arg to `super()`) should be snake_case: `'fire_sword'`, `'healing_potion'`

## Available Game APIs for Items

### Multiplayer-Safe APIs (visible to ALL players)

```javascript
// Projectiles — ALWAYS use these for ranged attacks
// These automatically broadcast via Socket.IO to all players
game.spawnMagicProjectile(pos, velocity)      // Generic magic projectile
game.spawnArrow(pos, velocity)                // Arrow projectile
game.spawnShrinkProjectile(pos, velocity)     // Shrink effect
game.spawnLevitationProjectile(pos, velocity) // Levitation effect
game.spawnSpinProjectile(pos, velocity)       // Spin effect
game.spawnGiantProjectile(pos, velocity)      // Giant effect
game.spawnGrowthProjectile(pos, velocity)     // Growth effect
game.spawnFireworkProjectile(pos, velocity)   // Firework effect

// Block changes — visible to all, persisted in Firebase
game.setBlock(x, y, z, blockType)  // Place/remove blocks (auto-broadcasts)

// Creatures — damage/knockback syncs via Animal.checkSync()
game.animals                       // Array of all creatures in world
```

### Local-Only APIs (visible ONLY to the using player)

```javascript
// Scene additions — NOT broadcast to other players
game.scene.add(object)            // Lights, particles, custom 3D objects
game.scene.remove(object)         // Only the local player sees these

// Player state
player.position                   // Player position
player.health / player.maxHealth  // Player health
player.swingArm()                 // Arm animation (local only)

// Camera
game.camera.position              // THREE.Vector3 - camera position
game.camera.getWorldDirection(v)  // Get look direction

// Inventory
game.inventoryManager.findItem(id)        // Find item slot by id
game.inventoryManager.removeItem(slot, n) // Remove n items from slot

// Sound — local only
game.soundManager?.playSound('drink')  // Play sound effect
```

### Best Practices for Multiplayer Visibility

1. **For ranged weapons**: Always extend `WandItem` or use `game.spawnMagicProjectile()` — these auto-broadcast
2. **For melee weapons**: Creature damage via `game.animals` syncs through `Animal.checkSync()`, so melee is fine
3. **For building items**: Use `game.setBlock()` — it auto-broadcasts and persists
4. **For visual effects** (lights, particles): These are local-only. This is acceptable for player-attached effects (flashlight, aura) since the item is personal. But don't rely on `game.scene.add()` for world-changing effects all players should see
5. **For consumables**: Inventory changes are local by design (each player has their own inventory)

## SVG Icon Requirements

- `viewBox="0 0 64 64"` (required)
- Simple shapes: `<rect>`, `<circle>`, `<ellipse>`, `<polygon>`, `<path>`
- Colors should match the 3D mesh
- No `<script>` tags or event handlers (security validation)
- Keep recognizable at small sizes (inventory slots are small)

```svg
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect x="30" y="20" width="4" height="40" fill="#5c4033" rx="1"/>
  <circle cx="32" cy="15" r="8" fill="#8844FF"/>
</svg>
```

## Item Types by Pattern

### 1. Melee Weapon
- `onPrimaryDown` with attack logic, range check against `game.animals`, knockback
- Example: FireSword

### 2. Projectile/Wand
- Extend `WandItem` or use `game.spawnMagicProjectile()`
- `onUseDown` with cooldown, camera direction for aiming
- Example: MagicWand

### 3. Consumable
- `maxStack = 16`, `isTool = false`
- `onUseDown` applies effect (heal, buff, etc.) then removes from inventory
- Example: HealingPotion

### 4. Tool/Utility
- `onUseDown` toggles state, creates lights/effects
- `onHeldUpdate` for per-frame updates when held
- Example: Flashlight

## Adding a New Few-Shot Example

Edit `server/ai/examples/items.ts`:

```typescript
export const itemExamples = [
    {
        name: "MyItem",
        description: "Description for semantic matching",
        keywords: ["keyword1", "keyword2", ...],
        code: `class MyItem extends Item { ... }`,
        icon: `<svg viewBox="0 0 64 64">...</svg>`
    },
    // ... existing examples
];
```

## Server-Side Validation

### Code Validation (`DynamicItemService.validateItemCode()`):
1. Class must match pattern: `class ${name} extends (Item|WandItem) {`
2. Must have `constructor(...) {`
3. Must call `super(`
4. No dangerous patterns: `eval(`, `fetch(`, `require(`, `import(`, `__proto__`, `window.location`, etc.

### Icon Validation (`DynamicItemService.validateIcon()`):
1. Must be a string starting with `<svg` and containing `</svg>`
2. No `<script>` tags
3. No `on*=` event handlers

### Name Validation:
- Must match `/^[A-Z][a-zA-Z0-9]*Item$/` (PascalCase ending with "Item")

## Client-Side Registration

`DynamicItemRegistry.registerDynamicItem()`:
1. Creates class via `new Function('THREE', 'Item', 'WandItem', code)`
2. Validates it's a function that creates instances of `Item`
3. Registers in `ItemClasses[name]`
4. Stores SVG icon in `DynamicItemIcons[itemId]`
5. Registers instance with `ItemManager` (critical for item actions to work)

## Scoping

- **Global items** (`worldId = 'global'`) - Available in all worlds, stored in `dynamic_items` collection
- **World-scoped items** (`worldId = specific`) - Only in that world, stored in `worlds/{worldId}/items`

## Multiplayer Sync

### What IS Automatically Broadcast to All Players

| Event | Mechanism | Persisted? |
|-------|-----------|-----------|
| **Item definition** (class code + icon) | Socket.IO `item_definition` to all clients | Yes (Firebase) |
| **Projectile spawns** (from wands/bows) | Socket.IO `projectile:spawn` | No (transient visual) |
| **Block changes** (from building items) | Socket.IO `block:change` per block | Yes (Firebase) |
| **Creature damage/knockback** (melee) | `Animal.checkSync()` → `entity:update` | Yes |

### What is NOT Broadcast (Local Only)

| Effect | Why | Impact |
|--------|-----|--------|
| **Item given to inventory** | By design — only requester gets the item | Expected |
| **Scene additions** (`game.scene.add()`) | No broadcast mechanism for arbitrary THREE.js objects | Lights, particles, custom 3D effects only visible to user |
| **Sound effects** | Local audio playback | Expected |
| **Arm swing animation** | Cosmetic, local | Low impact |

### Late-Joining Players

When a new player joins, they receive:
1. **Item definitions** via `items_initial` event (from `DynamicItemService.sendItemsToSocket()`)
2. All previously created dynamic items are available for them to use if given

### Multiplayer Guidelines for AI-Generated Items

When generating item code, ensure world-affecting actions use broadcast-compatible APIs:

- **Ranged attacks** → `game.spawnMagicProjectile()` (broadcasts automatically)
- **Block placement** → `game.setBlock()` (broadcasts + persists automatically)
- **Creature effects** → Direct manipulation of `game.animals` (syncs via `checkSync()`)
- **Visual-only effects** → `game.scene.add()` is OK for personal effects (flashlight, aura) but NOT for effects all players must see

## Testing

Test via the Merlin panel in-game by selecting the "Item" category and describing what you want.

Check item registration in browser console:
```javascript
window.DynamicItems        // All registered dynamic items
window.DynamicItemIcons    // SVG icons keyed by item id
window.ItemClasses         // All item classes (static + dynamic)
```
