# Skill: Implementing Flying Creatures

## Overview
Flying creatures require special handling beyond normal ground creatures. Simply setting `this.gravity = 0` is NOT enough — without flight movement code, the creature will just float in place. Flying creatures need: gravity disabled, a custom `update()` that moves via 3D velocity, a `updatePhysics()` override that skips ground collision, and height control to stay airborne.

## The Problem
If you only set `this.gravity = 0` and don't override movement, the creature spawns on the ground and does nothing. The base `Animal` class movement AI (`updateAI`) only moves in 2D (X/Z) and the default `updatePhysics()` applies gravity and ground collision. Flying creatures must bypass all of this.

## Required Pattern for Flying Creatures

### 1. Constructor — Flight Properties
```javascript
constructor(game, x, y, z, seed) {
    super(game, x, y, z, seed);

    // CRITICAL: Disable gravity
    this.gravity = 0;
    this.flying = true;

    // Flight movement state
    this.flightSpeed = 8.0;           // Units per second
    this.flyingHeight = 15;            // Target altitude above terrain
    this.flightVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * this.flightSpeed,
        0,
        (Math.random() - 0.5) * this.flightSpeed
    );
    this.targetDirection = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    this.homePosition = new THREE.Vector3(x, y, z);
    this.maxRoamDistance = 60;         // How far from spawn point
    this.turnSpeed = 1.5;             // How fast it changes direction
    this.directionChangeTimer = 0;
    this.directionChangeInterval = 3 + Math.random() * 4; // 3-7 seconds
    this.swoopTimer = Math.random() * Math.PI * 2;

    this.createBody();
}
```

### 2. update(dt) — Flight Movement (REQUIRED)
This is where ALL flight logic goes. Do NOT call `super.update(dt)` — it would apply ground-based physics.

```javascript
update(dt) {
    if (!this.mesh) return;

    // --- Direction changes ---
    this.directionChangeTimer += dt;
    if (this.directionChangeTimer >= this.directionChangeInterval) {
        this.directionChangeTimer = 0;
        this.directionChangeInterval = 3 + Math.random() * 5;
        const angle = Math.random() * Math.PI * 2;
        this.targetDirection.set(Math.cos(angle), 0, Math.sin(angle)).normalize();
    }

    // --- Update flight velocity (smooth turning) ---
    const targetVelocity = this.targetDirection.clone().multiplyScalar(this.flightSpeed);
    this.flightVelocity.lerp(targetVelocity, dt * this.turnSpeed);

    // --- Bounds checking: steer back toward home ---
    const dx = this.position.x - this.homePosition.x;
    const dz = this.position.z - this.homePosition.z;
    const distFromHome = Math.sqrt(dx * dx + dz * dz);
    if (distFromHome > this.maxRoamDistance) {
        const toHome = new THREE.Vector3(
            this.homePosition.x - this.position.x, 0,
            this.homePosition.z - this.position.z
        ).normalize();
        this.targetDirection.copy(toHome);
    }

    // --- Height control with swooping ---
    this.swoopTimer += dt * 0.8;
    const swoopOffset = Math.sin(this.swoopTimer) * 4;
    const groundY = this.game.worldGen
        ? this.game.worldGen.getTerrainHeight(this.position.x, this.position.z)
        : 0;
    const targetY = groundY + this.flyingHeight + swoopOffset;
    const yDiff = targetY - this.position.y;
    this.flightVelocity.y = yDiff * 1.5;

    // Limit vertical speed
    const maxVert = this.flightSpeed * 0.4;
    this.flightVelocity.y = Math.max(-maxVert, Math.min(maxVert, this.flightVelocity.y));

    // --- Apply velocity to position ---
    this.position.x += this.flightVelocity.x * dt;
    this.position.y += this.flightVelocity.y * dt;
    this.position.z += this.flightVelocity.z * dt;

    // Minimum height safety
    if (this.position.y < groundY + 3) {
        this.position.y = groundY + 3;
        this.flightVelocity.y = Math.abs(this.flightVelocity.y);
    }

    // --- Orient to face flight direction ---
    if (this.flightVelocity.lengthSq() > 0.1) {
        const heading = Math.atan2(this.flightVelocity.x, this.flightVelocity.z);
        const hSpeed = Math.sqrt(
            this.flightVelocity.x * this.flightVelocity.x +
            this.flightVelocity.z * this.flightVelocity.z
        );
        const pitch = Math.atan2(-this.flightVelocity.y, hSpeed) * 0.3;
        this.mesh.rotation.y = heading;
        this.mesh.rotation.x = pitch;
    }

    // --- Sync mesh position ---
    this.mesh.position.copy(this.position);

    // --- Wing flap animation (if applicable) ---
    // this.wingFlapTimer += dt * (3 + (speed / this.flightSpeed) * 4);
    // leftWing.rotation.z = Math.sin(this.wingFlapTimer) * 0.5;
    // rightWing.rotation.z = -Math.sin(this.wingFlapTimer) * 0.5;
}
```

### 3. updatePhysics(dt) — Skip Ground Collision (REQUIRED)
```javascript
updatePhysics(dt) {
    // Override: skip gravity and ground collision entirely
    // Position is already updated in update()
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotation;
}
```

## Complete Minimal Flying Creature Example

This is the simplest working flying creature (based on the Eagle entity):

```javascript
class FlyingEagle extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.5;
        this.height = 0.4;
        this.depth = 0.8;
        this.gravity = 0;
        this.flying = true;
        this.flySpeed = 5;
        this.flyingHeight = 15;
        this.roamRadius = 25;
        this.targetX = x;
        this.targetZ = z;
        this.targetAltitude = 15;
        this.createBody();
    }

    createBody() {
        const brown = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const white = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.8), brown);
        body.position.set(0, 0.2, 0);
        this.mesh.add(body);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), white);
        head.position.set(0, 0.4, 0.4);
        this.mesh.add(head);

        this.leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.4), brown);
        this.leftWing.position.set(-0.5, 0.25, 0);
        this.mesh.add(this.leftWing);

        this.rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.4), brown);
        this.rightWing.position.set(0.5, 0.25, 0);
        this.mesh.add(this.rightWing);

        this.wingTimer = 0;
    }

    updateAI(dt) {
        // Pick new 3D waypoint every 5-10 seconds
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
            this.stateTimer = 5 + Math.random() * 5;
            this.targetAltitude = 10 + Math.random() * 10;
            const angle = Math.random() * Math.PI * 2;
            this.targetX = this.position.x + Math.cos(angle) * this.roamRadius;
            this.targetZ = this.position.z + Math.sin(angle) * this.roamRadius;
        }

        // Move toward 3D target
        const dx = this.targetX - this.position.x;
        const dz = this.targetZ - this.position.z;
        const dy = this.targetAltitude - this.position.y;
        const dir = new THREE.Vector3(dx, dy, dz);
        const len = dir.length();
        if (len > 0.1) {
            dir.divideScalar(len);
            this.position.addScaledVector(dir, this.flySpeed * dt);
            this.rotation = Math.atan2(dir.x, dir.z);
        }

        // Wing flap animation
        this.wingTimer += dt * 6;
        const flap = Math.sin(this.wingTimer) * 0.4;
        this.leftWing.rotation.z = flap;
        this.rightWing.rotation.z = -flap;
    }

    updatePhysics(dt) {
        // Skip gravity/ground collision — fly freely
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;
    }
}
```

## Advanced: Circling Behavior (from Dragon entity)

For creatures that should circle an area (dragons, vultures, hawks):

```javascript
// In constructor:
this.isCircling = false;
this.circleCenter = null;
this.circleRadius = 20;
this.circleAngle = Math.random() * Math.PI * 2;

// In update():
if (this.isCircling) {
    this.circleAngle += dt * 0.5; // Angular velocity
    const targetX = this.circleCenter.x + Math.cos(this.circleAngle) * this.circleRadius;
    const targetZ = this.circleCenter.z + Math.sin(this.circleAngle) * this.circleRadius;
    const toTarget = new THREE.Vector3(targetX - this.position.x, 0, targetZ - this.position.z);
    toTarget.normalize().multiplyScalar(this.flightSpeed);
    this.flightVelocity.lerp(toTarget, dt * 2);
}
```

## Advanced: Hovering (for bees, hummingbirds, pixies)

For creatures that hover in place with gentle bobbing:

```javascript
// In constructor:
this.hoverOffset = Math.random() * Math.PI * 2;

// In update():
this.hoverOffset += dt * 3;
this.position.y += Math.sin(this.hoverOffset) * 0.01; // Gentle bob
```

## Key Reference Files

| File | What to Learn |
|------|---------------|
| `src/game/entities/animals/Eagle.js` | Simplest waypoint-based flight (great starting pattern) |
| `src/game/entities/animals/Dragon.js` | Advanced: circling, swooping, bounds checking, orientation |
| `src/game/entities/animals/Bee.js` | Hovering + random direction flight |
| `src/game/entities/Animal.js` | Base class — see `updateWalkerPhysics()` to understand what to skip |

## Multiplayer Sync

Flying creatures follow the same multiplayer sync as ground creatures — see `implementing-creatures.md` for details. Position sync via `Animal.checkSync()` works for 3D flight positions.

**No extra work needed** — flying creatures are fully multiplayer-compatible.

## Checklist for Flying Creatures

- [ ] `this.gravity = 0` in constructor
- [ ] `this.flying = true` in constructor
- [ ] Flight velocity/speed properties initialized
- [ ] `updatePhysics(dt)` overridden to skip ground collision
- [ ] 3D movement in `update()` or `updateAI()` (not just X/Z)
- [ ] Height control relative to terrain (`game.worldGen.getTerrainHeight()`)
- [ ] Minimum height safety check (don't go underground)
- [ ] Bounds checking (don't fly infinitely far away)
- [ ] Mesh orientation facing flight direction (`Math.atan2`)
- [ ] Wing flap animation (if creature has wings)
