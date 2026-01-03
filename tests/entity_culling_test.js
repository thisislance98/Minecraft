
import * as THREE from 'three';

// Mock Blocks
const Blocks = {
    AIR: null,
    STONE: 'stone',
    WATER: 'water',
    GLASS: 'glass'
};

// Mock Animal
class MockAnimal {
    constructor(id, x, y, z) {
        this.position = new THREE.Vector3(x, y, z);
        this.onGround = true;
        this.mesh = { visible: true };
        this.group = { visible: true };
        this.updated = false;
        this.constructor = { name: 'Pig' }; // Type
        this.height = 1.0;
    }

    update() {
        this.updated = true;
        return true; // Keep alive
    }

    dispose() { }
}

// Mock Player
class MockPlayer {
    constructor() {
        this.position = new THREE.Vector3(0, 0, 0);
    }
}

// Mock Game
class MockVoxelGame {
    constructor() {
        this.player = new MockPlayer();
        this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        this.frustum = new THREE.Frustum();
        this.frustumMatrix = new THREE.Matrix4();

        this.animals = [];
        this.creaturesVisible = true;
        this.villagersVisible = true;
        this.spaceshipsVisible = true;
        this.allowedAnimalTypes = new Set(['Pig']);

        // Block Data for Occlusion
        this.blocks = new Map();

        this.renderer = {
            render: () => { }
        };

        // Culling sphere
        this._cullingSphere = new THREE.Sphere(new THREE.Vector3(), 2.0);
    }

    setBlock(x, y, z, type) {
        this.blocks.set(`${x},${y},${z}`, type);
    }

    getBlockWorld(x, y, z) {
        return this.blocks.get(`${x},${y},${z}`) || null;
    }

    updateFrustum() {
        this.camera.updateMatrixWorld();
        this.frustumMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse
        );
        this.frustum.setFromProjectionMatrix(this.frustumMatrix);
    }

    safelyUpdateEntity(animal) {
        return animal.update();
    }

    // Reuse checkLineOfSight directly from implementation
    checkLineOfSight(start, end) {
        // 1. Setup DDA
        let x0 = Math.floor(start.x);
        let y0 = Math.floor(start.y);
        let z0 = Math.floor(start.z);
        const x1 = Math.floor(end.x);
        const y1 = Math.floor(end.y);
        const z1 = Math.floor(end.z);

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const dz = Math.abs(z1 - z0);

        const stepX = x0 < x1 ? 1 : -1;
        const stepY = y0 < y1 ? 1 : -1;
        const stepZ = z0 < z1 ? 1 : -1;

        const rayDir = new THREE.Vector3().subVectors(end, start).normalize();

        const deltaDistX = (dx === 0) ? Infinity : Math.abs(1 / rayDir.x);
        const deltaDistY = (dy === 0) ? Infinity : Math.abs(1 / rayDir.y);
        const deltaDistZ = (dz === 0) ? Infinity : Math.abs(1 / rayDir.z);

        let sideDistX, sideDistY, sideDistZ;

        if (rayDir.x < 0) {
            sideDistX = (start.x - x0) * deltaDistX;
        } else {
            sideDistX = (x0 + 1.0 - start.x) * deltaDistX;
        }
        if (rayDir.y < 0) {
            sideDistY = (start.y - y0) * deltaDistY;
        } else {
            sideDistY = (y0 + 1.0 - start.y) * deltaDistY;
        }
        if (rayDir.z < 0) {
            sideDistZ = (start.z - z0) * deltaDistZ;
        } else {
            sideDistZ = (z0 + 1.0 - start.z) * deltaDistZ;
        }

        let steps = 0;
        const maxSteps = 100;

        while (true) {
            const block = this.getBlockWorld(x0, y0, z0);
            if (block && block !== Blocks.AIR && block !== Blocks.WATER &&
                !block.includes('glass')) {
                return false;
            }

            if (x0 === x1 && y0 === y1 && z0 === z1) break;
            if (steps++ > maxSteps) break;

            if (sideDistX < sideDistY) {
                if (sideDistX < sideDistZ) {
                    sideDistX += deltaDistX;
                    x0 += stepX;
                } else {
                    sideDistZ += deltaDistZ;
                    z0 += stepZ;
                }
            } else {
                if (sideDistY < sideDistZ) {
                    sideDistY += deltaDistY;
                    y0 += stepY;
                } else {
                    sideDistZ += deltaDistZ;
                    z0 += stepZ;
                }
            }
        }
        return true;
    }

    // Simulate the optimized loop from VoxelGame.jsx
    updateEntities(deltaTime) {
        // --- OPTIMIZATION REPLICA ---
        if (!this._cullingSphere) {
            this._cullingSphere = new THREE.Sphere(new THREE.Vector3(), 2.0);
        }

        for (let i = this.animals.length - 1; i >= 0; i--) {
            const animal = this.animals[i];
            animal.updated = false; // Reset for test

            // 1. Distance Culling
            const distSq = animal.position.distanceToSquared(this.player.position);

            // 2. Frustum Culling
            this._cullingSphere.center.copy(animal.position);

            const inFrustum = this.frustum.intersectsSphere(this._cullingSphere);
            const isClose = distSq < 64 * 64;

            let shouldUpdate = true;
            let shouldRender = true;

            if (!inFrustum && !isClose) {
                if (animal.onGround) {
                    shouldUpdate = false;
                    shouldRender = false;
                } else {
                    shouldRender = false;
                    shouldUpdate = true;
                }
            } else if (!inFrustum && isClose) {
                shouldRender = false;
                shouldUpdate = true;
            } else {
                // In Frustum - CHECK OCCLUSION
                const entityCenter = animal.position.clone();
                entityCenter.y += (animal.height || 1.0) * 0.5;
                const hasLOS = this.checkLineOfSight(this.camera.position, entityCenter);

                if (!hasLOS) {
                    if (animal.onGround) {
                        shouldUpdate = false;
                        shouldRender = false;
                    } else {
                        shouldRender = false; // Don't render
                        shouldUpdate = true;  // Keep physics
                    }
                } else {
                    shouldRender = true;
                    shouldUpdate = true;
                }
            }

            // Apply Rendering Visibility
            if (shouldRender) {
                const type = animal.constructor.name;
                let categoryVisible = true;
                if (type === 'Villager') categoryVisible = this.villagersVisible;
                else if (type === 'Spaceship') categoryVisible = this.spaceshipsVisible;
                else categoryVisible = this.creaturesVisible;

                const specificVisible = this.allowedAnimalTypes.has(type);
                shouldRender = categoryVisible && specificVisible;
            }

            if (animal.mesh) animal.mesh.visible = shouldRender;
            if (animal.group) animal.group.visible = shouldRender;

            if (shouldUpdate) {
                this.safelyUpdateEntity(animal);
            }
        }
    }
}

function runTest() {
    console.log("Starting Entity Culling (Frustum + Occlusion) Test...");
    const game = new MockVoxelGame();

    // Setup Camera looking down -Z
    game.camera.position.set(0, 1.6, 0);
    game.camera.lookAt(0, 1.6, -10);
    game.updateFrustum();

    // 1. Test Entity In View (Close)
    console.log("Test 1: Entity In Frustum (Close)");
    const pigInView = new MockAnimal('pig1', 0, 1.6, -5);
    game.animals.push(pigInView);
    game.updateEntities(0.1);

    if (pigInView.mesh.visible === true && pigInView.updated === true) {
        console.log("PASS: Close Entity in view is visible and updated.");
    } else {
        console.error(`FAIL: Close Entity in view. Visible: ${pigInView.mesh.visible}, Updated: ${pigInView.updated}`);
    }

    // 2. Test Entity Out of View (Behind)
    console.log("Test 2: Entity Behind (Close)");
    const pigBehind = new MockAnimal('pig2', 0, 1.6, 5);
    game.animals = [pigBehind];
    game.updateEntities(0.1);

    if (pigBehind.mesh.visible === false && pigBehind.updated === true) {
        console.log("PASS: Close Entity behind is hidden but updated (for audio/AI).");
    } else {
        console.error(`FAIL: Close Entity behind. Visible: ${pigBehind.mesh.visible}, Updated: ${pigBehind.updated}`);
    }

    // 5. Test Occlusion (Behind Wall within View)
    console.log("Test 5: Entity In Frustum but Occluded (Behind Stone)");
    const pigOccluded = new MockAnimal('pig5', 0, 1.6, -8); // Further away
    // Build a wall at Z = -6
    game.setBlock(0, 1, -6, Blocks.STONE);
    game.setBlock(0, 2, -6, Blocks.STONE);

    game.animals = [pigOccluded];
    game.updateEntities(0.1);

    if (pigOccluded.mesh.visible === false && pigOccluded.updated === false) {
        console.log("PASS: Occluded Entity is hidden and NOT updated.");
    } else {
        console.error(`FAIL: Occluded Entity. Visible: ${pigOccluded.mesh.visible}, Updated: ${pigOccluded.updated}`);
    }

    // 6. Test Occlusion Transparency (Behind Glass)
    console.log("Test 6: Entity Behind Glass (Transparent)");
    const pigGlass = new MockAnimal('pig6', 2, 1.6, -8);
    // Build glass wall at Z = -6
    game.setBlock(2, 1, -6, Blocks.GLASS);
    game.setBlock(2, 2, -6, Blocks.GLASS);

    game.animals = [pigGlass];
    game.updateEntities(0.1);

    if (pigGlass.mesh.visible === true && pigGlass.updated === true) {
        console.log("PASS: Entity behind glass is VISIBLE and updated.");
    } else {
        console.error(`FAIL: Entity behind glass. Visible: ${pigGlass.mesh.visible}, Updated: ${pigGlass.updated}`);
    }

}

runTest();
