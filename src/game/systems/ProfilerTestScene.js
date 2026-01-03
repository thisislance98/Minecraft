import * as THREE from 'three';
import { AnimalClasses } from '../AnimalRegistry.js';

/**
 * ProfilerTestScene - A dedicated performance testing mode
 * 
 * Uses a SEPARATE Three.js Scene to isolate test objects from the main game.
 * This allows clean switching between game and test mode.
 */
export class ProfilerTestScene {
    constructor(game) {
        this.game = game;
        this.isActive = false;
        this.currentStage = 0;

        // Create a completely separate test scene
        this.testScene = new THREE.Scene();
        this.testScene.background = new THREE.Color(0x1a1a2e); // Dark blue-gray

        // Add basic lighting to test scene
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.testScene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        this.testScene.add(directionalLight);

        // Add a ground plane for reference
        const groundGeo = new THREE.PlaneGeometry(200, 200);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x333344, side: THREE.DoubleSide });
        this.groundPlane = new THREE.Mesh(groundGeo, groundMat);
        this.groundPlane.rotation.x = -Math.PI / 2;
        this.groundPlane.position.y = 0;
        this.testScene.add(this.groundPlane);

        // Add grid helper
        const gridHelper = new THREE.GridHelper(200, 50, 0x444466, 0x222244);
        this.testScene.add(gridHelper);

        // Test objects we've spawned (for cleanup)
        this.testMeshes = [];

        // Stage definitions
        this.stages = [
            { name: 'Empty Scene', setup: () => this.setupEmpty() },
            { name: '1 Block', setup: () => this.setupBlocks(1) },
            { name: '100 Blocks', setup: () => this.setupBlocks(100) },
            { name: '625 Blocks', setup: () => this.setupBlocks(625) },
            { name: '2500 Blocks', setup: () => this.setupBlocks(2500) },
            { name: '1 Creature', setup: () => this.setupCreatures(1) },
            { name: '10 Creatures', setup: () => this.setupCreatures(10) },
            { name: '50 Creatures', setup: () => this.setupCreatures(50) },
            { name: '100 Creatures', setup: () => this.setupCreatures(100) },
            { name: 'Full (2500 blocks + 100 creatures)', setup: () => this.setupFull() }
        ];

        // Reference to main scene for swapping
        this.mainScene = null;

        // UI overlay
        this.overlay = null;
        this.createOverlay();
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'profiler-test-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: #00ff00;
            padding: 12px 24px;
            border-radius: 8px;
            font-family: 'Consolas', monospace;
            font-size: 14px;
            z-index: 9999;
            display: none;
            text-align: center;
            border: 2px solid #00ff00;
        `;
        document.body.appendChild(this.overlay);
    }

    updateOverlay() {
        const stage = this.stages[this.currentStage];
        this.overlay.innerHTML = `
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">
                🔬 PROFILER TEST SCENE
            </div>
            <div style="margin-bottom: 4px;">
                Stage ${this.currentStage + 1}/${this.stages.length}: <span style="color: #ffff00;">${stage.name}</span>
            </div>
            <div style="font-size: 12px; color: #888;">
                ← Previous | Next → | Click Stop to exit
            </div>
        `;
    }

    toggle() {
        if (this.isActive) {
            this.deactivate();
        } else {
            this.activate();
        }
    }

    activate() {
        this.isActive = true;
        console.log('[ProfilerTestScene] Activated - Switching to test scene');

        // Save reference to main scene
        this.mainScene = this.game.scene;

        // SWAP to test scene
        this.game.scene = this.testScene;

        // Update EffectComposer's RenderPass if it exists
        this.updateRenderPassScene(this.testScene);

        // Also need to add camera to test scene for child objects (like held items)
        this.testScene.add(this.game.camera);

        // Enable profiler
        if (this.game.perf) {
            this.game.perf.visible = true;
        }

        // Position camera nicely
        this.game.camera.position.set(0, 30, 50);
        this.game.camera.lookAt(0, 0, 0);

        // Show overlay
        this.overlay.style.display = 'block';

        // Start at stage 0
        this.currentStage = 0;
        this.applyCurrentStage();
    }

    deactivate() {
        this.isActive = false;
        console.log('[ProfilerTestScene] Deactivated - Switching back to main scene');

        // Clean up test objects
        this.cleanup();

        // SWAP back to main scene
        if (this.mainScene) {
            // Move camera back to main scene
            this.mainScene.add(this.game.camera);
            this.game.scene = this.mainScene;

            // Restore RenderPass scene
            this.updateRenderPassScene(this.mainScene);

            this.mainScene = null;
        }

        // Restore camera to player
        if (this.game.player) {
            this.game.camera.position.copy(this.game.player.position);
            this.game.camera.position.y += 1.6;
        }

        // Hide overlay
        this.overlay.style.display = 'none';

        // Hide profiler (optional - keep it visible for comparison)
        // if (this.game.perf) {
        //     this.game.perf.visible = false;
        // }
    }

    updateRenderPassScene(newScene) {
        if (this.game.composer && this.game.composer.passes) {
            for (const pass of this.game.composer.passes) {
                // Check if it's a RenderPass (usually has a scene property)
                if (pass.scene !== undefined) {
                    pass.scene = newScene;
                }
            }
        }
    }

    nextStage() {
        if (!this.isActive) return;
        if (this.currentStage < this.stages.length - 1) {
            this.currentStage++;
            this.applyCurrentStage();
        }
    }

    prevStage() {
        if (!this.isActive) return;
        if (this.currentStage > 0) {
            this.currentStage--;
            this.applyCurrentStage();
        }
    }

    applyCurrentStage() {
        // Clean up previous stage
        this.cleanup();

        // Apply new stage
        const stage = this.stages[this.currentStage];
        console.log(`[ProfilerTestScene] Stage ${this.currentStage + 1}: ${stage.name}`);
        stage.setup();

        // Update overlay
        this.updateOverlay();
    }

    cleanup() {
        // Remove all test meshes from test scene
        for (const mesh of this.testMeshes) {
            this.testScene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(m => m.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        }
        this.testMeshes = [];
    }

    // Stage setup functions
    setupEmpty() {
        // Nothing - just the ground plane and grid
    }

    setupBlocks(count) {
        const size = Math.ceil(Math.sqrt(count));
        const blockGeo = new THREE.BoxGeometry(1, 1, 1);
        const blockMat = new THREE.MeshStandardMaterial({ color: 0x888888 });

        // Use InstancedMesh for batched rendering - 1 draw call instead of N!
        const instancedMesh = new THREE.InstancedMesh(blockGeo, blockMat, count);
        const matrix = new THREE.Matrix4();

        let idx = 0;
        for (let x = 0; x < size && idx < count; x++) {
            for (let z = 0; z < size && idx < count; z++) {
                matrix.setPosition(x - size / 2, 0.5, z - size / 2);
                instancedMesh.setMatrixAt(idx, matrix);
                idx++;
            }
        }
        instancedMesh.instanceMatrix.needsUpdate = true;

        this.testScene.add(instancedMesh);
        this.testMeshes.push(instancedMesh);
    }

    setupCreatures(count) {
        // Create simple creature-like meshes (boxes with different colors)
        const baseGeo = new THREE.BoxGeometry(1, 1.5, 2);

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const radius = 10 + Math.random() * 20;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const color = new THREE.Color().setHSL(i / count, 0.7, 0.5);
            const mat = new THREE.MeshStandardMaterial({ color });
            const mesh = new THREE.Mesh(baseGeo, mat);
            mesh.position.set(x, 0.75, z);

            this.testScene.add(mesh);
            this.testMeshes.push(mesh);
        }
    }

    setupFull() {
        this.setupBlocks(2500);
        this.setupCreatures(100);
    }

    handleKeyDown(code) {
        if (!this.isActive) return false;

        if (code === 'ArrowRight') {
            this.nextStage();
            return true;
        }
        if (code === 'ArrowLeft') {
            this.prevStage();
            return true;
        }

        return false;
    }
}
