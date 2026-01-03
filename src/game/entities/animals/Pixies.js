import * as THREE from 'three';

/**
 * PixieManager handles magical pixies that pick up small land animals,
 * fly them high into the air, and drop them.
 */
export class PixieManager {
    constructor(game, count = 5) {
        this.game = game;
        this.count = count;
        this.bounds = 30; // Range around player

        // Flight parameters
        this.speedLimit = 6;
        this.speedMin = 2;

        // Small animals that pixies can pick up
        this.validTargets = ['Bunny', 'Mouse', 'Chicken', 'Frog', 'Squirrel', 'Turkey', 'Snake'];

        // Pixie state
        this.pixies = [];

        for (let i = 0; i < count; i++) {
            this.pixies.push(this.createPixie(i));
        }

        this.group = new THREE.Group();
        for (const pixie of this.pixies) {
            this.group.add(pixie.group);
        }

        this.game.scene.add(this.group);
        this.time = 0;
    }

    createPixie(index) {
        const group = new THREE.Group();

        // Pixie colors - shades of blue
        const colors = [0x00BFFF, 0x1E90FF, 0x4169E1, 0x00CED1, 0x87CEEB];
        const color = colors[index % colors.length];

        // Emissive glowing material
        const bodyMat = new THREE.MeshLambertMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.5
        });
        const wingMat = new THREE.MeshLambertMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });

        // Tiny humanoid body
        const bodyGeo = new THREE.BoxGeometry(0.1, 0.15, 0.08);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0, 0);
        group.add(body);

        // Head (small sphere-ish)
        const headGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.set(0, 0.12, 0);
        group.add(head);

        // Wings (two small planes)
        const wingGeo = new THREE.BoxGeometry(0.15, 0.1, 0.02);
        wingGeo.translate(0.075, 0, 0); // Pivot at edge

        const leftWing = new THREE.Mesh(wingGeo, wingMat);
        leftWing.position.set(0, 0.05, -0.02);
        group.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeo, wingMat);
        rightWing.position.set(0, 0.05, -0.02);
        rightWing.rotation.y = Math.PI;
        group.add(rightWing);

        // PERFORMANCE FIX: Removed PointLight, emissive materials already provide glow effect
        // Point lights are expensive and accumulate when many Pixies exist
        // const light = new THREE.PointLight(color, 0.5, 3);
        // light.position.set(0, 0, 0);
        // group.add(light);

        // Random starting position
        const x = (Math.random() - 0.5) * 30;
        const y = Math.random() * 10 + 5;
        const z = (Math.random() - 0.5) * 30;

        group.position.set(x, y, z);

        // Enable shadows (emit light doesn't cast shadow usually, but mesh itself should)
        group.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        return {
            group,
            leftWing,
            rightWing,
            // light, // PERFORMANCE FIX: Removed
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * this.speedLimit,
                (Math.random() - 0.5) * this.speedLimit,
                (Math.random() - 0.5) * this.speedLimit
            ),
            wingPhase: Math.random() * Math.PI * 2,

            // Hunting state machine
            state: 'flying', // flying, targeting, grabbing, carrying, dropping
            target: null,
            carryHeight: 0,
            carryTimer: 0,
            stateTimer: Math.random() * 5 + 3 // Time until next hunt attempt
        };
    }

    update(dt, player, animals) {
        if (!animals) animals = [];

        this.time += dt;
        const px = player.position.x;
        const py = player.position.y;
        const pz = player.position.z;

        for (const pixie of this.pixies) {
            this.updatePixie(pixie, dt, px, py, pz, animals);
        }
    }

    updatePixie(pixie, dt, playerX, playerY, playerZ, animals) {
        const pos = pixie.group.position;
        const vel = pixie.velocity;

        switch (pixie.state) {
            case 'flying':
                this.updateFlying(pixie, dt, playerX, playerY, playerZ, animals);
                break;
            case 'targeting':
                this.updateTargeting(pixie, dt);
                break;
            case 'grabbing':
                this.updateGrabbing(pixie, dt);
                break;
            case 'carrying':
                this.updateCarrying(pixie, dt, playerX, playerY, playerZ);
                break;
            case 'dropping':
                this.updateDropping(pixie, dt, playerX, playerY, playerZ);
                break;
        }

        // Update wing animation
        const wingSpeed = 25;
        const wingAngle = Math.sin(this.time * wingSpeed + pixie.wingPhase) * 0.8;
        pixie.leftWing.rotation.z = wingAngle;
        pixie.rightWing.rotation.z = -wingAngle;

        // Flickering glow - PERFORMANCE FIX: Light removed, emissive materials handle glow
        // if (pixie.light) pixie.light.intensity = 0.4 + Math.sin(this.time * 10 + pixie.wingPhase) * 0.2;
    }

    updateFlying(pixie, dt, playerX, playerY, playerZ, animals) {
        const pos = pixie.group.position;
        const vel = pixie.velocity;

        // Random erratic movement
        vel.x += (Math.random() - 0.5) * 20 * dt;
        vel.y += (Math.random() - 0.5) * 15 * dt;
        vel.z += (Math.random() - 0.5) * 20 * dt;

        // Stay near player
        const distFromPlayer = Math.sqrt(
            (pos.x - playerX) ** 2 + (pos.z - playerZ) ** 2
        );

        if (distFromPlayer > this.bounds) {
            const angle = Math.atan2(pos.z - playerZ, pos.x - playerX);
            vel.x -= Math.cos(angle) * 15 * dt;
            vel.z -= Math.sin(angle) * 15 * dt;
        }

        // Target height
        const targetY = playerY + 5 + Math.sin(this.time * 0.5 + pixie.wingPhase) * 3;
        vel.y += (targetY - pos.y) * 2 * dt;

        // Floor avoidance
        if (pos.y < playerY + 1) {
            vel.y += 15 * dt;
        }

        // Speed limit
        this.clampVelocity(vel);

        // Apply velocity
        pos.add(vel.clone().multiplyScalar(dt));

        // Face direction of travel
        if (vel.lengthSq() > 0.1) {
            const lookTarget = pos.clone().add(vel);
            pixie.group.lookAt(lookTarget);
        }

        // Hunt timer
        pixie.stateTimer -= dt;
        if (pixie.stateTimer <= 0) {
            // Try to find a target
            const target = this.findTarget(pos, animals);
            if (target) {
                pixie.target = target;
                pixie.state = 'targeting';
                target.isBeingHunted = true;
            }
            pixie.stateTimer = Math.random() * 8 + 5;
        }
    }

    updateTargeting(pixie, dt) {
        const pos = pixie.group.position;
        const vel = pixie.velocity;
        const target = pixie.target;

        // Validate target still valid
        if (!target || target.isDead || target.isDying || target.isCarried) {
            this.resetToFlying(pixie);
            return;
        }

        // Swoop down toward target
        const targetPos = target.position;
        const dx = targetPos.x - pos.x;
        const dy = targetPos.y + 0.5 - pos.y; // Aim slightly above
        const dz = targetPos.z - pos.z;

        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < 0.5) {
            // Close enough to grab
            pixie.state = 'grabbing';
            return;
        }

        // Accelerate toward target
        vel.x += (dx / dist) * 25 * dt;
        vel.y += (dy / dist) * 25 * dt;
        vel.z += (dz / dist) * 25 * dt;

        this.clampVelocity(vel, 8);
        pos.add(vel.clone().multiplyScalar(dt));

        // Face target
        const lookTarget = pos.clone().add(vel);
        pixie.group.lookAt(lookTarget);
    }

    updateGrabbing(pixie, dt) {
        const target = pixie.target;

        if (!target || target.isDead || target.isDying) {
            this.resetToFlying(pixie);
            return;
        }

        // Grab the animal
        target.isCarried = true;
        target.carrier = pixie;
        pixie.carryHeight = pixie.group.position.y;
        pixie.carryTimer = 0;
        pixie.state = 'carrying';

        // Disable animal's normal physics by storing state
        target.wasOnGround = target.onGround;
        target.onGround = true; // Prevent gravity updates

        // Reset velocity for upward flight
        pixie.velocity.set(0, 5, 0);
    }

    updateCarrying(pixie, dt, playerX, playerY, playerZ) {
        const pos = pixie.group.position;
        const vel = pixie.velocity;
        const target = pixie.target;

        if (!target || target.isDead || target.isDying) {
            this.resetToFlying(pixie);
            return;
        }

        // Fly upward with some horizontal drift
        vel.x += (Math.random() - 0.5) * 10 * dt;
        vel.y = Math.max(vel.y, 4); // Maintain upward velocity
        vel.y += 8 * dt; // Keep accelerating up
        vel.z += (Math.random() - 0.5) * 10 * dt;

        // Horizontal speed limit but allow fast upward
        const hSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
        if (hSpeed > 3) {
            vel.x = (vel.x / hSpeed) * 3;
            vel.z = (vel.z / hSpeed) * 3;
        }
        vel.y = Math.min(vel.y, 12);

        pos.add(vel.clone().multiplyScalar(dt));

        // Update carried animal position
        target.position.copy(pos);
        target.position.y -= 0.3; // Dangle below pixie
        target.mesh.position.copy(target.position);

        // Track carry time and height gained
        pixie.carryTimer += dt;
        const heightGained = pos.y - pixie.carryHeight;

        // Drop after carrying high enough or long enough
        if (heightGained > 15 || pixie.carryTimer > 4) {
            pixie.state = 'dropping';
        }

        // Face upward-ish
        pixie.group.lookAt(pos.clone().add(vel));
    }

    updateDropping(pixie, dt, playerX, playerY, playerZ) {
        const target = pixie.target;

        if (target && !target.isDead && !target.isDying) {
            // Release the animal!
            target.isCarried = false;
            target.carrier = null;
            target.onGround = false;
            target.velocity.y = 0; // Let gravity take over
            target.isBeingHunted = false;
        }

        // Pixie flies away quickly
        this.resetToFlying(pixie);

        // Give pixie upward boost to fly away
        pixie.velocity.set(
            (Math.random() - 0.5) * 8,
            5,
            (Math.random() - 0.5) * 8
        );

        // Longer cooldown after successful hunt
        pixie.stateTimer = Math.random() * 10 + 8;
    }

    resetToFlying(pixie) {
        if (pixie.target) {
            pixie.target.isBeingHunted = false;
            pixie.target.isCarried = false;
            pixie.target.carrier = null;
        }
        pixie.target = null;
        pixie.state = 'flying';
    }

    findTarget(pixiePos, animals) {
        let bestTarget = null;
        let bestDist = Infinity;

        for (const animal of animals) {
            // Skip invalid targets
            if (animal.isDead || animal.isDying) continue;
            if (animal.isCarried || animal.isBeingHunted) continue;

            // Check if it's a valid target type
            const className = animal.constructor.name;
            if (!this.validTargets.includes(className)) continue;

            // Check distance
            const dist = pixiePos.distanceTo(animal.position);
            if (dist < 20 && dist < bestDist) {
                bestDist = dist;
                bestTarget = animal;
            }
        }

        return bestTarget;
    }

    clampVelocity(vel, maxSpeed = this.speedLimit) {
        const speed = vel.length();
        if (speed > maxSpeed) {
            vel.multiplyScalar(maxSpeed / speed);
        } else if (speed < this.speedMin && speed > 0) {
            vel.multiplyScalar(this.speedMin / speed);
        }
    }

    clear() {
        this.count = 0;
        if (this.group) {
            this.game.scene.remove(this.group);
            this.group.traverse(obj => {
                if (obj.isMesh) {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                        else obj.material.dispose();
                    }
                }
            });
        }
        this.pixies = [];
    }
}
