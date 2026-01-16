import * as THREE from 'three';

/**
 * ChunkBatcher - Combines all chunk geometry into fewer meshes for reduced draw calls
 * Uses the same atlas material for all chunks, and merges their geometries.
 */
export class ChunkBatcher {
    constructor(game) {
        this.game = game;

        // Merged meshes
        this.opaqueMesh = null;
        this.transparentMesh = null;

        // Dirty flag
        this.needsRebuild = false;
        this.rebuildCooldown = 0;
        this.rebuildInterval = 0.5; // Rebuild at most every 0.5 seconds
    }

    markDirty() {
        this.needsRebuild = true;
    }

    update(dt) {
        this.rebuildCooldown -= dt;

        if (this.needsRebuild && this.rebuildCooldown <= 0) {
            this.rebuild();
            this.needsRebuild = false;
            this.rebuildCooldown = this.rebuildInterval;
        }
    }

    rebuild() {
        // This is expensive - merging all chunk geometries
        // In practice, we'd do this incrementally or use instancing

        const opaquePositions = [];
        const opaqueNormals = [];
        const opaqueUVs = [];
        const opaqueColors = [];

        const transparentPositions = [];
        const transparentNormals = [];
        const transparentUVs = [];
        const transparentColors = [];

        for (const chunk of this.game.chunks.values()) {
            if (!chunk.mesh || !chunk.mesh.visible) continue;

            for (const child of chunk.mesh.children) {
                if (!child.geometry) continue;

                const pos = child.geometry.attributes.position;
                const norm = child.geometry.attributes.normal;
                const uv = child.geometry.attributes.uv;
                const color = child.geometry.attributes.color;

                if (!pos || !norm || !uv || !color) continue;

                // Determine which buffer to use based on material
                const isTransparent = child.material.transparent;
                const buffers = isTransparent ?
                    { positions: transparentPositions, normals: transparentNormals, uvs: transparentUVs, colors: transparentColors } :
                    { positions: opaquePositions, normals: opaqueNormals, uvs: opaqueUVs, colors: opaqueColors };

                // Copy geometry data
                for (let i = 0; i < pos.count; i++) {
                    buffers.positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
                    buffers.normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
                    buffers.uvs.push(uv.getX(i), uv.getY(i));
                    buffers.colors.push(color.getX(i), color.getY(i), color.getZ(i));
                }
            }
        }

        // Rebuild opaque mesh
        this.rebuildMesh('opaque', opaquePositions, opaqueNormals, opaqueUVs, opaqueColors, false);
        this.rebuildMesh('transparent', transparentPositions, transparentNormals, transparentUVs, transparentColors, true);

        console.log(`[ChunkBatcher] Rebuilt meshes. Opaque verts: ${opaquePositions.length / 3}, Transparent verts: ${transparentPositions.length / 3}`);
    }

    rebuildMesh(type, positions, normals, uvs, colors, isTransparent) {
        const existing = type === 'opaque' ? this.opaqueMesh : this.transparentMesh;

        if (existing) {
            this.game.scene.remove(existing);
            existing.geometry.dispose();
        }

        if (positions.length === 0) {
            if (type === 'opaque') this.opaqueMesh = null;
            else this.transparentMesh = null;
            return;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        // Generate indices
        const vertexCount = positions.length / 3;
        const indices = [];
        for (let i = 0; i < vertexCount; i += 4) {
            indices.push(i, i + 1, i + 2);
            indices.push(i, i + 2, i + 3);
        }
        geometry.setIndex(indices);
        geometry.computeBoundingSphere();

        const material = this.game.assetManager.getAtlasMaterial(isTransparent);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false; // We handle our own culling

        if (type === 'opaque') this.opaqueMesh = mesh;
        else this.transparentMesh = mesh;

        this.game.scene.add(mesh);
    }

    dispose() {
        if (this.opaqueMesh) {
            this.game.scene.remove(this.opaqueMesh);
            this.opaqueMesh.geometry.dispose();
            this.opaqueMesh = null;
        }
        if (this.transparentMesh) {
            this.game.scene.remove(this.transparentMesh);
            this.transparentMesh.geometry.dispose();
            this.transparentMesh = null;
        }
    }
}
