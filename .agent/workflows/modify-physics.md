---
description: How to modify physics, gravity, and collision logic
---

# Workflow: Modify Physics

This guide explains how to modify physics for entities, players, and world interactions.

## 1. Entity Physics (Animals/Mobs)
Entity physics are primarily handled in `src/game/entities/Animal.js`.

### Key Methods
-   **`updatePhysics(dt)`**: The main entry point. Decides whether to use Walker or Hopper physics.
-   **`updateWalkerPhysics(dt)`**: Standard movement for walking mobs (Pig, Cow, etc.). Handles:
    -   Gravity application (`this.velocity.y`)
    -   Friction/Knockback damping
    -   Horizontal collision (`checkBodyCollision`)
    -   Step-up logic (`attemptClimb` / `isOnCurvePath`)
    -   Ground snapping (preventing jitter on uneven terrain)
-   **`checkSolid(x, y, z)`**: Returns true if a block at coordinates is solid.

### Common Modifications
-   **Change Gravity**: Modify `this.gravity = 30.0;` in the constructor or `updateWalkerPhysics`.
-   **Adjust Speed**: Modify `this.speed`.
-   **Change Step Height**: Logic is in `attemptClimb`. Currently supports 1-block step-ups.
-   **Modify Hitbox**: Adjust `this.width`, `this.height`, `this.depth`.

## 2. Player Physics
Player physics are handled in `src/game/entities/Player.js`.

-   **Movement**: Look for `update(dt)` and input handling.
-   **Collision**: uses `this.world.getBlock()` to check for collisions.
-   **Flying/Ghost Mode**: Toggled via `params.flyMode` or `params.ghostMode`.

## 3. World Interaction Physics
Block breaking and raycasting are handled in `src/game/systems/PhysicsManager.js`.

-   **Raycasting**: `checkHighight()` and `getTargetBlock()` determine what the player is looking at.
-   **Reach Distance**: Controlled by the raycaster's far plane or specific checks (default ~5-8 blocks).
-   **Tree Felling**: `checkAndFellTree()` handles the recursive breaking of timber.

## 4. Global Physics Constants
There is no single global physics file.
-   **Gravity**: Defined per entity class (usually `30.0`).
-   **Terminal Velocity**: often hardcoded in update loops (e.g., `Math.max(this.velocity.y, -40)`).

## Example: Making an Entity Float
Search `Animal.js` for `updatePhysics`.
```javascript
// Override gravity logic
this.velocity.y = Math.sin(Date.now() / 1000) * 0.5; // Bob up and down
this.onGround = false;
```

## Example: Changing Player Jump Height
In `Player.js`:
```javascript
if (this.input.jump && this.onGround) {
    this.velocity.y = 10; // Change this value (default ~10-15)
}
```
