import * as THREE from 'three';

/**
 * Chunk class for optimized block storage and mesh generation
 */
export class Chunk {
    constructor(game, cx, cy, cz) {
        this.game = game;
        this.cx = cx;
        this.cy = cy;
        this.cz = cz;
        this.size = game.chunkSize;

        // Block data: null = air, string = block type
        this.blocks = new Array(this.size * this.size * this.size).fill(null);

        // Mesh for this chunk
        this.mesh = null;
        this.dirty = true; // Needs mesh rebuild

        this.boundingBox = new THREE.Box3(
            new THREE.Vector3(cx * this.size, cy * this.size, cz * this.size),
            new THREE.Vector3((cx + 1) * this.size, (cy + 1) * this.size, (cz + 1) * this.size)
        );

        // Define plant types for special rendering
        this.plantTypes = new Set(['flower_red', 'flower_yellow', 'mushroom_red', 'mushroom_brown', 'long_grass', 'fern', 'flower_blue', 'dead_bush']);
    }

    getIndex(lx, ly, lz) {
        return lx + ly * this.size + lz * this.size * this.size;
    }

    getBlock(lx, ly, lz) {
        if (lx < 0 || lx >= this.size || ly < 0 || ly >= this.size || lz < 0 || lz >= this.size) {
            // Check neighboring chunk
            const wx = this.cx * this.size + lx;
            const wy = this.cy * this.size + ly;
            const wz = this.cz * this.size + lz;
            return this.game.getBlockWorld(wx, wy, wz);
        }
        return this.blocks[this.getIndex(lx, ly, lz)];
    }

    setBlock(lx, ly, lz, type) {
        this.blocks[this.getIndex(lx, ly, lz)] = type;
        this.dirty = true;
    }

    // Build optimized mesh with face culling
    buildMesh() {
        if (this.mesh) {
            this.game.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh = null;
        }

        const dataPerMaterial = new Map();

        // Helper to get buffer for a material
        const getBuffer = (matIdx) => {
            if (!dataPerMaterial.has(matIdx)) {
                dataPerMaterial.set(matIdx, { positions: [], normals: [], uvs: [], colors: [] });
            }
            return dataPerMaterial.get(matIdx);
        };

        const faces = [
            { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], normal: [1, 0, 0], name: 'right', idx: 0 },
            { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], normal: [-1, 0, 0], name: 'left', idx: 1 },
            { dir: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], normal: [0, 1, 0], name: 'top', idx: 2 },
            { dir: [0, -1, 0], corners: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]], normal: [0, -1, 0], name: 'bottom', idx: 3 },
            {
                dir: [0, 0, 1],
                corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
                normal: [0, 0, 1],
                name: 'front',
                idx: 4,
                uvs: [0, 0, 1, 0, 1, 1, 0, 1]
            },
            {
                dir: [0, 0, -1],
                corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
                normal: [0, 0, -1],
                name: 'back',
                idx: 5,
                uvs: [1, 0, 0, 0, 0, 1, 1, 1]
            }
        ];

        let hasGeom = false;

        for (let lz = 0; lz < this.size; lz++) {
            for (let ly = 0; ly < this.size; ly++) {
                for (let lx = 0; lx < this.size; lx++) {
                    const blockType = this.blocks[this.getIndex(lx, ly, lz)];
                    if (!blockType) continue;

                    const materials = this.game.blockMaterialIndices[blockType];
                    if (!materials) {
                        if (!this.loggedMissing) this.loggedMissing = new Set();
                        if (!this.loggedMissing.has(blockType)) {
                            console.warn(`Chunk: Missing materials for block type '${blockType}'. Skipping.`);
                            this.loggedMissing.add(blockType);
                        }
                        continue;
                    }

                    const wx = this.cx * this.size + lx;
                    const wy = this.cy * this.size + ly;
                    const wz = this.cz * this.size + lz;

                    // Check for special render type
                    if (this.plantTypes.has(blockType)) {
                        // PLANTS / CROSS GEOMETRY
                        // We strictly render the internal cross, no face checks needed really,
                        // but we should check if we are visible? 
                        // Plants are always transparent, so just render them.
                        hasGeom = true;
                        // Use first material index (assuming all faces same for plant)
                        const matIndex = materials[0];
                        const buffer = getBuffer(matIndex);

                        // Cross geometry: 2 planes intersecting diagonally
                        // Plane 1: (0,0,0)-(1,1,1) diagonal? No, (0,0,0) to (1,0,1) is bottom diagonal
                        // Vertical planes:
                        // A: (0,0,0)-(1,1,1) cross
                        // B: (0,0,1)-(1,1,0) cross

                        // Let's use offsets relative to block origin
                        // Plane 1: (0.15, 0, 0.15) to (0.85, 1, 0.85) -- Main diagonal
                        // Correct UVs: 0,0 to 1,1

                        const addPlantQuad = (p1, p2, p3, p4) => {
                            // Add both sides for visibility from all angles
                            // Side A
                            buffer.positions.push(wx + p1[0], wy + p1[1], wz + p1[2]);
                            buffer.positions.push(wx + p2[0], wy + p2[1], wz + p2[2]);
                            buffer.positions.push(wx + p3[0], wy + p3[1], wz + p3[2]);
                            buffer.positions.push(wx + p4[0], wy + p4[1], wz + p4[2]);

                            // Normals - pointing up roughly or generic
                            buffer.normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);

                            buffer.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
                            buffer.colors.push(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);

                            // Side B (reverse winding)
                            buffer.positions.push(wx + p1[0], wy + p1[1], wz + p1[2]);
                            buffer.positions.push(wx + p4[0], wy + p4[1], wz + p4[2]);
                            buffer.positions.push(wx + p3[0], wy + p3[1], wz + p3[2]);
                            buffer.positions.push(wx + p2[0], wy + p2[1], wz + p2[2]);
                            buffer.normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
                            buffer.uvs.push(0, 0, 0, 1, 1, 1, 1, 0);
                            buffer.colors.push(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);
                        };

                        const o = 0.15; // Offset from edge
                        const h = 0.8;  // Height scale if needed, or just 1.0

                        // Diagonal 1
                        addPlantQuad(
                            [o, 0, o],          // BL
                            [1 - o, 0, 1 - o],      // BR
                            [1 - o, 1, 1 - o],      // TR
                            [o, 1, o]           // TL
                        );

                        // Diagonal 2
                        addPlantQuad(
                            [o, 0, 1 - o],        // BL
                            [1 - o, 0, o],        // BR
                            [1 - o, 1, o],        // TR
                            [o, 1, 1 - o]         // TL
                        );

                        continue; // Skip normal block face generation
                    }


                    for (const face of faces) {
                        const nx = lx + face.dir[0];
                        const ny = ly + face.dir[1];
                        const nz = lz + face.dir[2];

                        const neighbor = this.getBlock(nx, ny, nz);
                        // Plant transparency logic: usually plants dont cull neighbor faces
                        // But blocks behind plants should be drawn.
                        // 'neighbor' is the block AT the face.
                        // If I am a block, and my neighbor is a plant, should I draw my face? YES.
                        // If I am a plant... we handled that above.

                        // So we need to know if neighbor is a plant.
                        const neighborIsPlant = this.plantTypes.has(neighbor);

                        const isTransparent = neighbor === 'water' || neighbor === 'glass' || neighbor === 'leaves' || neighborIsPlant;
                        const shouldRender = !neighbor || (isTransparent && neighbor !== blockType);

                        if (shouldRender) {
                            hasGeom = true;
                            const matIndex = materials[face.idx];
                            const buffer = getBuffer(matIndex);

                            // Add face vertices
                            const terrainH = this.game.worldGen.getTerrainHeight(wx, wz);

                            for (const corner of face.corners) {
                                buffer.positions.push(wx + corner[0], wy + corner[1], wz + corner[2]);
                                buffer.normals.push(...face.normal);

                                // Vertex lighting based on depth
                                const vy = wy + corner[1];
                                let light = 1.0;
                                if (vy < terrainH) {
                                    const depth = terrainH - vy;
                                    light = Math.max(0.15, 1.0 - (depth * 0.08));
                                }
                                buffer.colors.push(light, light, light);
                            }

                            const uvs = face.uvs || [0, 0, 0, 1, 1, 1, 1, 0];
                            buffer.uvs.push(...uvs);
                        }
                    }
                }
            }
        }

        if (!hasGeom) {
            this.dirty = false;
            return;
        }

        const allPositions = [];
        const allNormals = [];
        const allUvs = [];
        const allColors = [];
        const allIndices = [];

        let vertexOffset = 0;

        const geometry = new THREE.BufferGeometry();

        const sortedMatIndices = Array.from(dataPerMaterial.keys()).sort((a, b) => a - b);

        for (const matIndex of sortedMatIndices) {
            const buffer = dataPerMaterial.get(matIndex);
            const count = buffer.positions.length / 3;

            allPositions.push(...buffer.positions);
            allNormals.push(...buffer.normals);
            allUvs.push(...buffer.uvs);
            allColors.push(...buffer.colors);

            // Generate indices for this batch
            for (let i = 0; i < count; i += 4) {
                const v = vertexOffset + i;
                allIndices.push(v, v + 1, v + 2, v, v + 2, v + 3);
            }

            const indexCount = (count / 4) * 6;
            // geometry.addGroup(start, count, materialIndex)
            // start is in indices, count is in indices
            geometry.addGroup((allIndices.length - indexCount), indexCount, matIndex);
            vertexOffset += count;
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(allNormals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(allUvs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(allColors, 3));
        geometry.setIndex(allIndices);
        geometry.computeBoundingSphere();

        this.mesh = new THREE.Mesh(geometry, this.game.materialArray);
        this.mesh.userData.isChunk = true;
        this.mesh.userData.chunk = this;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.game.scene.add(this.mesh);

        this.dirty = false;
    }

    // Check if chunk is in camera frustum
    isInFrustum(frustum) {
        return frustum.intersectsBox(this.boundingBox);
    }

    countBlocks() {
        return this.blocks.filter(b => b !== null).length;
    }

    dispose() {
        if (this.mesh) {
            this.game.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            this.mesh = null;
        }
    }
}
