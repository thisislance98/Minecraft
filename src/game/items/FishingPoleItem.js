import { Item } from './Item.js';
import * as THREE from 'three';

export class FishingPoleItem extends Item {
    constructor() {
        super('fishing_pole', 'Fishing Pole');
        this.maxStack = 1;
        this.isTool = true;
        this.castCooldown = 1000;
        this.lastCastTime = 0;
        this.isCasting = false;
        this.castTimer = 0;
        this.catchTime = 0;
        this.bobber = null;
        this.line = null;
        this.bobberTarget = null;
    }

    onUseDown(game, player) {
        const now = performance.now();

        // If already casting, try to reel in
        if (this.isCasting) {
            this.reelIn(game, player);
            return true;
        }

        // Cooldown check
        if (now - this.lastCastTime < this.castCooldown) return false;
        this.lastCastTime = now;

        // Cast the line - find where player is looking
        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);

        // Cast distance: 8-12 blocks out in camera direction
        const castDist = 10;
        const targetPos = game.camera.position.clone().add(camDir.clone().multiplyScalar(castDist));

        // Find water surface at the target position
        const worldGen = game.worldGen;
        if (!worldGen) return false;

        const terrainY = worldGen.getTerrainHeight(targetPos.x, targetPos.z);
        const seaLevel = worldGen.seaLevel;

        // Check if there's water at target
        const checkY = Math.floor(seaLevel);
        const block = game.getBlock(Math.floor(targetPos.x), checkY, Math.floor(targetPos.z));
        const isWater = (block && block.type === 'water') || terrainY < seaLevel;

        if (!isWater) {
            // Show a message or effect that there's no water
            console.log('[FishingPole] No water found at target location');
            return false;
        }

        // Place bobber on water surface
        this.bobberTarget = new THREE.Vector3(targetPos.x, seaLevel + 0.1, targetPos.z);
        this.createBobber(game);
        this.isCasting = true;
        this.catchTime = now + 2000 + Math.random() * 4000; // 2-6 seconds to catch

        // Arm swing
        if (player.swingArm) player.swingArm();

        return true;
    }

    createBobber(game) {
        // Remove old bobber if exists
        this.removeBobber(game);

        // Create bobber (red and white ball)
        this.bobber = new THREE.Group();

        const topGeo = new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
        const topMat = new THREE.MeshStandardMaterial({ color: 0xFF0000 });
        const top = new THREE.Mesh(topGeo, topMat);
        this.bobber.add(top);

        const bottomGeo = new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
        const bottomMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
        const bottom = new THREE.Mesh(bottomGeo, bottomMat);
        this.bobber.add(bottom);

        this.bobber.position.copy(this.bobberTarget);
        game.scene.add(this.bobber);

        // Create fishing line (thin cylinder from player hand to bobber)
        this.updateLine(game);
    }

    updateLine(game) {
        // Remove old line
        if (this.line) {
            game.scene.remove(this.line);
            if (this.line.geometry) this.line.geometry.dispose();
            if (this.line.material) this.line.material.dispose();
            this.line = null;
        }

        if (!this.bobber || !game.camera) return;

        // Create line from camera position to bobber
        const start = game.camera.position.clone();
        // Offset slightly down and forward to look like it's from the hand
        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);
        start.add(camDir.multiplyScalar(0.5));
        start.y -= 0.3;

        const end = this.bobber.position.clone();

        const points = [start, end];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0xCCCCCC, linewidth: 1 });
        this.line = new THREE.Line(geometry, material);
        game.scene.add(this.line);
    }

    removeBobber(game) {
        if (this.bobber) {
            game.scene.remove(this.bobber);
            this.bobber = null;
        }
        if (this.line) {
            game.scene.remove(this.line);
            if (this.line.geometry) this.line.geometry.dispose();
            if (this.line.material) this.line.material.dispose();
            this.line = null;
        }
    }

    reelIn(game, player) {
        const now = performance.now();

        if (now >= this.catchTime) {
            // Caught a fish!
            this.catchFish(game, player);
        } else {
            console.log('[FishingPole] Reeled in too early - no catch');
        }

        this.removeBobber(game);
        this.isCasting = false;
    }

    catchFish(game, player) {
        // Splash particles at bobber location
        if (this.bobber && game.worldParticleSystem) {
            game.worldParticleSystem.spawnEffect(this.bobber.position.clone(), {
                color: 0x4488FF,
                secondaryColor: 0xAADDFF,
                particleCount: 20,
                radius: 1.0,
                life: 1.0
            });
        }

        // Kill a nearby fish if there is one
        if (game.animals && this.bobber) {
            let closestFish = null;
            let closestDist = 10; // Search within 10 blocks of bobber

            for (const animal of game.animals) {
                if (animal.isDead) continue;
                if (animal.constructor.name !== 'Fish') continue;
                const dist = this.bobber.position.distanceTo(animal.position);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestFish = animal;
                }
            }

            if (closestFish) {
                closestFish.takeDamage(100, player); // Kill the fish
            }
        }

        // Add raw fish to inventory
        if (game.inventoryManager) {
            // Give chocolate bar as "fish food" reward (closest food item)
            game.inventoryManager.addItem('chocolate_bar', 1, 'item');
        }

        // Sound effect
        if (game.soundManager) {
            game.soundManager.playSound('drink');
        }

        console.log('[FishingPole] Caught a fish!');
    }

    onHeldUpdate(game, player, dt) {
        if (!this.isCasting) return;

        // Update bobber animation (bobbing up and down)
        if (this.bobber) {
            const time = performance.now() * 0.001;
            this.bobber.position.y = this.bobberTarget.y + Math.sin(time * 2) * 0.05;

            // When close to catch time, make bobber dip
            const now = performance.now();
            const timeUntilCatch = this.catchTime - now;
            if (timeUntilCatch < 500 && timeUntilCatch > 0) {
                // Bobber is being pulled under!
                this.bobber.position.y -= 0.15;
                // Splash effect
                if (game.worldParticleSystem && Math.random() < 0.3) {
                    game.worldParticleSystem.spawnEffect(this.bobber.position.clone(), {
                        color: 0x4488FF,
                        secondaryColor: 0xAADDFF,
                        particleCount: 5,
                        radius: 0.3,
                        life: 0.5
                    });
                }
            }

            // Update the line
            this.updateLine(game);
        }

        // Auto-reel after too long (fish gets away)
        const now = performance.now();
        if (now > this.catchTime + 3000) {
            console.log('[FishingPole] Fish got away!');
            this.removeBobber(game);
            this.isCasting = false;
        }
    }

    getMesh() {
        const group = new THREE.Group();

        // Rod handle (dark brown)
        const handleGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.4, 6);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x3E2723 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.y = -0.1;
        group.add(handle);

        // Rod body (lighter brown, thinner)
        const rodGeo = new THREE.CylinderGeometry(0.02, 0.035, 0.7, 6);
        const rodMat = new THREE.MeshStandardMaterial({ color: 0x6D4C41 });
        const rod = new THREE.Mesh(rodGeo, rodMat);
        rod.position.y = 0.35;
        group.add(rod);

        // Rod tip (very thin)
        const tipGeo = new THREE.CylinderGeometry(0.008, 0.02, 0.3, 4);
        const tipMat = new THREE.MeshStandardMaterial({ color: 0x8D6E63 });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.y = 0.7;
        group.add(tip);

        // Reel (metallic disc on the handle)
        const reelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.03, 8);
        const reelMat = new THREE.MeshStandardMaterial({ color: 0x9E9E9E, metalness: 0.6, roughness: 0.3 });
        const reel = new THREE.Mesh(reelGeo, reelMat);
        reel.position.set(0.05, 0.05, 0);
        reel.rotation.z = Math.PI / 2;
        group.add(reel);

        // Reel handle (small knob)
        const knobGeo = new THREE.SphereGeometry(0.02, 6, 6);
        const knobMat = new THREE.MeshStandardMaterial({ color: 0x424242 });
        const knob = new THREE.Mesh(knobGeo, knobMat);
        knob.position.set(0.09, 0.05, 0);
        group.add(knob);

        // Line guide rings on the rod
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xBDBDBD, metalness: 0.5 });
        for (let i = 0; i < 3; i++) {
            const ringGeo = new THREE.TorusGeometry(0.025, 0.005, 4, 8);
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.y = 0.2 + i * 0.25;
            ring.rotation.x = Math.PI / 2;
            group.add(ring);
        }

        return group;
    }
}
