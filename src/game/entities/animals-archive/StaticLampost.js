import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class StaticLampost extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.6;
        this.height = 3.5;
        this.depth = 0.6;
        this.collisionScale = 0.8;
        this.speed = 0; // Stationary
        this.isHostile = false;

        // Custom stats
        this.health = 1000; // Hard to break
        this.maxHealth = 1000;

        this.createBody();
    }

    createBody() {
        // Materials
        // Materials - Black Metal
        const metalMat = new THREE.MeshStandardMaterial({
            color: 0x111111, // Almost black
            roughness: 0.7,
            metalness: 0.2
        });

        // Ensure glass texture is generated
        this.game.assetManager.getEntityMaterial('lampost_glass');
        const lightMat = new THREE.MeshStandardMaterial({
            map: this.game.assetManager.textures['lampost_glass'],
            emissive: 0xFFDD00,
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.9
        });

        // 1. Base (Small pedestal)
        const baseGeo = new THREE.BoxGeometry(0.5, 0.4, 0.5);
        const base = new THREE.Mesh(baseGeo, metalMat);
        base.position.set(0, 0.2, 0); // Resting on ground (0.2 is half height)
        this.mesh.add(base);

        // 2. The Pole (Tall and thin)
        const poleGeo = new THREE.BoxGeometry(0.15, 5.0, 0.15); // Much taller (was 2.0)
        const pole = new THREE.Mesh(poleGeo, metalMat);
        pole.position.set(0, 2.9, 0); // 0.4 base + 2.5 half pole
        this.mesh.add(pole);

        // 3. The Lantern Head
        const headGroup = new THREE.Group();
        this.headGroup = headGroup;
        headGroup.position.set(0, 5.5, 0); // Top of pole roughly (0.4 + 5.0 + 0.1)
        this.mesh.add(headGroup);

        // Lantern Frame (Top and Bottom plates)
        const plateGeo = new THREE.BoxGeometry(0.6, 0.1, 0.6);
        const bottomPlate = new THREE.Mesh(plateGeo, metalMat);
        bottomPlate.position.set(0, -0.25, 0);
        headGroup.add(bottomPlate);

        const topPlate = new THREE.Mesh(plateGeo, metalMat);
        topPlate.position.set(0, 0.25, 0);
        headGroup.add(topPlate);

        // Lantern Glass (The glowing part)
        const glassGeo = new THREE.BoxGeometry(0.5, 0.4, 0.5);
        const glass = new THREE.Mesh(glassGeo, lightMat);
        headGroup.add(glass);

        // Point Light - PERFORMANCE: Reduced intensity and range
        const light = new THREE.PointLight(0xFFDD00, 0.6, 6);
        light.position.set(0, 0, 0);
        headGroup.add(light);
        this.light = light;

        // Cap (Pointy top)
        const capGeo = new THREE.ConeGeometry(0.4, 0.3, 4);
        const cap = new THREE.Mesh(capGeo, metalMat);
        cap.position.set(0, 0.45, 0);
        cap.rotation.y = Math.PI / 4; // Align with box edges
        headGroup.add(cap);

        // No legs!
    }

    // Override AI to do nothing
    updateAI(dt) {
        this.state = 'idle';
        this.isMoving = false;
    }

    // Override update to manage light visibility and physics
    update(dt) {
        super.update(dt);

        // PERFORMANCE: Only enable light if close to player to prevent "blinking" 
        // when exceeding WebGL light limit (usually ~8 lights).
        // Use hysteresis to prevent flickering at the boundary.
        // Also use add/remove to avoid fighting with Animal.js visibility enforcement.
        if (this.light && this.game.camera && this.headGroup) {
            const distSq = this.position.distanceToSquared(this.game.camera.position);
            const isAttached = this.light.parent === this.headGroup;

            // Hysteresis: Enable at 15m (225), Disable at 20m (400)
            if (isAttached && distSq > 400) {
                this.headGroup.remove(this.light);
            } else if (!isAttached && distSq < 225) {
                this.headGroup.add(this.light);
            }
        }
    }

    // Override physics to just stay put (simple gravity is fine if generated in air, but we usually place on ground)
    updatePhysics(dt) {
        // Apply gravity if not on ground
        if (!this.onGround) {
            this.velocity.y -= this.gravity * dt;
            this.position.y += this.velocity.y * dt;

            // Simple ground check
            if (this.position.y < this.game.worldGen.getTerrainHeight(this.position.x, this.position.z)) {
                this.position.y = this.game.worldGen.getTerrainHeight(this.position.x, this.position.z);
                this.onGround = true;
                this.velocity.y = 0;
            }
        }
    }
}
