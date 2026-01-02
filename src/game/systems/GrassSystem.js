import * as THREE from 'three';

export class GrassSystem {
    constructor(scene) {
        this.scene = scene;

        // Configuration
        this.bladesPerBlock = 8; // Reduced density
        this.bladeHeight = 0.25;
        this.bladeWidth = 0.03;

        // Shared Geometry
        // Simple plane, tapered at top is handled by scale or alpha, but let's just use a simple plane for now.
        // We can use a PlaneGeometry(width, height, widthSegments, heightSegments)
        // widthSegments=1, heightSegments=3 allows for bending
        this.geometry = new THREE.PlaneGeometry(this.bladeWidth, this.bladeHeight, 1, 3);
        this.geometry.translate(0, this.bladeHeight / 2, 0); // Origin at bottom

        // Shared Material (Shader)
        this.material = new THREE.MeshLambertMaterial({
            color: 0x44aa44,
            side: THREE.DoubleSide
        });

        this.material.onBeforeCompile = (shader) => {
            shader.uniforms.time = { value: 0 };
            this.material.userData.shader = shader;

            shader.vertexShader = `
                uniform float time;
                varying float vHeight;
            ` + shader.vertexShader;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                
                // Wind Simulation
                // instanceMatrix is available automatically in InstancedMesh + MeshLambertMaterial
                float wave = sin(time * 2.0 + instanceMatrix[3][0] * 0.5 + instanceMatrix[3][2] * 0.5);
                
                // Define bend based on height (position.y is 0 to ${this.bladeHeight})
                float bend = smoothstep(0.0, ${this.bladeHeight.toFixed(2)}, position.y);
                
                // Reduced movement amplitude
                transformed.x += wave * bend * 0.05;
                transformed.z += wave * bend * 0.02;
                
                // Pass local height to fragment
                vHeight = position.y;
                `
            );

            shader.fragmentShader = `
                varying float vHeight;
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                vec3 bottomColor = vec3(0.1, 0.4, 0.1);
                vec3 topColor = vec3(0.4, 0.8, 0.2);
                
                // Mix based on normalized height (0 to ${this.bladeHeight})
                float h = smoothstep(0.0, ${this.bladeHeight.toFixed(2)}, vHeight);
                diffuseColor.rgb = mix(bottomColor, topColor, h);
                `
            );
        };
    }

    update(dt) {
        if (this.material.userData.shader) {
            this.material.userData.shader.uniforms.time.value += dt;
        }
    }

    /**
     * Updates the grass mesh for a specific chunk.
     * @param {Chunk} chunk - The chunk to update.
     * @param {Array<Object>} grassBlockPositions - Array of {x, y, z} world coordinates for grass blocks.
     */
    updateChunk(chunk, grassBlockPositions) {
        // Remove existing grass mesh
        if (chunk.grassMesh) {
            this.scene.remove(chunk.grassMesh);
            chunk.grassMesh.dispose();
            chunk.grassMesh = null;
        }

        if (!grassBlockPositions || grassBlockPositions.length === 0) {
            return;
        }

        const instanceCount = grassBlockPositions.length * this.bladesPerBlock;
        const mesh = new THREE.InstancedMesh(this.geometry, this.material, instanceCount);

        const dummy = new THREE.Object3D();
        let index = 0;

        for (const pos of grassBlockPositions) {
            for (let i = 0; i < this.bladesPerBlock; i++) {
                // Random offset within the block (0 to 1)
                const ox = Math.random() * 0.8 + 0.1;
                const oz = Math.random() * 0.8 + 0.1;

                // Random scale/rotation
                dummy.position.set(pos.x + ox, pos.y + 1.0, pos.z + oz); // +1.0 to sit ON TOP of block
                dummy.rotation.y = Math.random() * Math.PI * 2;

                const scale = 0.8 + Math.random() * 0.4;
                dummy.scale.set(scale, scale, scale);

                dummy.updateMatrix();
                mesh.setMatrixAt(index++, dummy.matrix);
            }
        }

        mesh.instanceMatrix.needsUpdate = true;

        // Prevent frustum culling issues with animated vertex shader (optional, but good for safety)
        mesh.frustumCulled = false;

        chunk.grassMesh = mesh;
        this.scene.add(mesh);
    }
}
