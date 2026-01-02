import * as THREE from 'three';
import { Blocks } from '../game/core/Blocks.js';

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
        this.plantTypes = new Set([
            Blocks.FLOWER_RED, Blocks.FLOWER_YELLOW, Blocks.MUSHROOM_RED, Blocks.MUSHROOM_BROWN,
            Blocks.LONG_GRASS, Blocks.FERN, Blocks.FLOWER_BLUE, Blocks.DEAD_BUSH
        ]);
        this.doorTypes = new Set([Blocks.DOOR_CLOSED, Blocks.DOOR_OPEN]);
        this.fenceTypes = new Set([Blocks.FENCE]);
        this.grassMesh = null;
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
        if (this.grassMesh) {
            this.game.scene.remove(this.grassMesh);
            this.grassMesh.dispose();
            this.grassMesh = null;
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
            { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], normal: [1, 0, 0], name: 'right', idx: 0, shade: 0.8 },
            { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], normal: [-1, 0, 0], name: 'left', idx: 1, shade: 0.8 },
            { dir: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], normal: [0, 1, 0], name: 'top', idx: 2, shade: 1.0 },
            { dir: [0, -1, 0], corners: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]], normal: [0, -1, 0], name: 'bottom', idx: 3, shade: 0.5 },
            {
                dir: [0, 0, 1],
                corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
                normal: [0, 0, 1],
                name: 'front',
                idx: 4,
                uvs: [0, 0, 1, 0, 1, 1, 0, 1],
                shade: 0.8
            },
            {
                dir: [0, 0, -1],
                corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
                normal: [0, 0, -1],
                name: 'back',
                idx: 5,
                uvs: [1, 0, 0, 0, 0, 1, 1, 1],
                shade: 0.8
            }
        ];

        // AO Lookup Table: [FaceIdx][VertexIdx][3 neighbors (x,y,z)]
        // Neighbors are relative to the *Block Position* (lx,ly,lz).
        // For a face pointing in direction N, the "air" block is at N. 
        // We check blocks surrounding that air block.
        // Actually, simpler mental model:
        // For 'Top' face (y+1):
        //   Corners are (0,1,0), (0,1,1), (1,1,1), (1,1,0)
        //   For corner (0,1,0) -> Neighbors are (-1,1,0), (-1,1,-1), (0,1,-1)?
        //   We check the plane of the face.

        // AO Offsets relative to the Current Block (assuming we are looking effectively at the neighbor "air" voxel)
        // Let's rely on standard patterns.
        // Right (X+):
        // 0: (1,0,0) -> Bottom-Front? No, (1,0,0) is y=0, z=0. 
        // Let's match existing corners order:
        // Right: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]
        //   0: 1,0,0 (Bottom-Back?) Z=0. 
        //   1: 1,1,0 (Top-Back?)
        //   2: 1,1,1 (Top-Front?)
        //   3: 1,0,1 (Bottom-Front?)

        // Offsets need to be carefully mapped.
        // Helper to check opacity
        const isSolid = (x, y, z) => {
            const b = this.getBlock(x, y, z);
            // Treat null/undefined as solid (chunk edge) or air? usually air for consistency?
            // Actually, treating chunk edge as 'air' avoids black borders.
            if (!b) return false;
            if (b === Blocks.AIR) return false;
            // Check transparency
            // Ideally we cache 'isTransparent' logic, but reusing from below:
            const isTransparent = b === Blocks.WATER || b === Blocks.GLASS || b === Blocks.LEAVES || this.plantTypes.has(b);
            return !isTransparent;
        };

        // Standard offsets (Side1, Side2, Corner)
        // Right Face (x+1)
        const aoRight = [
            [[1, -1, 0], [1, 0, -1], [1, -1, -1]], // 0: (1,0,0) - Bot, Back?
            [[1, 1, 0], [1, 0, -1], [1, 1, -1]],   // 1: (1,1,0) - Top, Back
            [[1, 1, 0], [1, 0, 1], [1, 1, 1]],     // 2: (1,1,1) - Top, Front
            [[1, -1, 0], [1, 0, 1], [1, -1, 1]]    // 3: (1,0,1) - Bot, Front
        ];
        // Left Face (x-1)
        const aoLeft = [
            [[-1, -1, 1], [-1, 0, 1], [-1, -1, 2]], // Fail? existing corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]
            // 0: 0,0,1 (Bot, Front) -> Neigh: Left-Down, Left-Front, Corner
            // offsets: x=-1. y=-1, z=0 (Bot). y=0, z=1 (Front). y=-1, z=1 (Corner)
            [[-1, -1, 0], [-1, 0, 1], [-1, -1, 1]],
            // 1: 0,1,1 (Top, Front)
            [[-1, 1, 0], [-1, 0, 1], [-1, 1, 1]],
            // 2: 0,1,0 (Top, Back)
            [[-1, 1, 0], [-1, 0, -1], [-1, 1, -1]],
            // 3: 0,0,0 (Bot, Back)
            [[-1, -1, 0], [-1, 0, -1], [-1, -1, -1]]
        ];
        // Top Face (y+1) corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]
        const aoTop = [
            [[-1, 1, 0], [0, 1, -1], [-1, 1, -1]], // 0: 0,1,0 (Back Left)
            [[-1, 1, 0], [0, 1, 1], [-1, 1, 1]],   // 1: 0,1,1 (Front Left)
            [[1, 1, 0], [0, 1, 1], [1, 1, 1]],     // 2: 1,1,1 (Front Right)
            [[1, 1, 0], [0, 1, -1], [1, 1, -1]]    // 3: 1,1,0 (Back Right)
        ];
        // Bottom Face (y-1) corners: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]]
        const aoBottom = [
            [[-1, -1, 0], [0, -1, 1], [-1, -1, 1]], // 0: 0,0,1 (Front Left)
            [[-1, -1, 0], [0, -1, -1], [-1, -1, -1]], // 1: 0,0,0 (Back Left)
            [[1, -1, 0], [0, -1, -1], [1, -1, -1]], // 2: 1,0,0 (Back Right)
            [[1, -1, 0], [0, -1, 1], [1, -1, 1]]    // 3: 1,0,1 (Front Right)
        ];
        // Front Face (z+1) corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]
        const aoFront = [
            [[-1, 0, 1], [0, -1, 1], [-1, -1, 1]], // 0: 0,0,1 (Bot Left)
            [[1, 0, 1], [0, -1, 1], [1, -1, 1]],   // 1: 1,0,1 (Bot Right)
            [[1, 0, 1], [0, 1, 1], [1, 1, 1]],     // 2: 1,1,1 (Top Right)
            [[-1, 0, 1], [0, 1, 1], [-1, 1, 1]]    // 3: 0,1,1 (Top Left)
        ];
        // Back Face (z-1) corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]
        const aoBack = [
            [[1, 0, -1], [0, -1, -1], [1, -1, -1]], // 0: 1,0,0 (Bot Right)
            [[-1, 0, -1], [0, -1, -1], [-1, -1, -1]], // 1: 0,0,0 (Bot Left)
            [[-1, 0, -1], [0, 1, -1], [-1, 1, -1]],   // 2: 0,1,0 (Top Left)
            [[1, 0, -1], [0, 1, -1], [1, 1, -1]]    // 3: 1,1,0 (Top Right)
        ];

        const aoTables = [aoRight, aoLeft, aoTop, aoBottom, aoFront, aoBack];

        const grassPositions = [];

        let hasGeom = false;

        for (let lz = 0; lz < this.size; lz++) {
            for (let ly = 0; ly < this.size; ly++) {
                for (let lx = 0; lx < this.size; lx++) {
                    const blockType = this.blocks[this.getIndex(lx, ly, lz)];
                    if (!blockType || blockType === Blocks.AIR) continue;

                    let materials = this.game.blockMaterialIndices[blockType];
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

                    // Handle Thruster Rotation
                    if (blockType === Blocks.THRUSTER) {
                        const dir = this.game.getThrusterData(wx, wy, wz);
                        // Default materials: [Body, Body, Body, Body, Body, Exhaust] (Indicies 0-5)
                        // Map: 0:R, 1:L, 2:T, 3:B, 4:F, 5:Bk

                        // We want exhaust (which is at index 5 in default array) to be at 'dir'.
                        // So we should swap index 5 with index 'dir' in a copy of the array.
                        // Or constructs the array such that 'dir' gets the exhaust material.

                        // Let's assume materials[5] is exhaust, others are body (same).
                        const body = materials[0];
                        const exhaust = materials[5];

                        // Create a specific array for this block instance
                        const rotatedMaterials = [body, body, body, body, body, body];
                        rotatedMaterials[dir] = exhaust;
                        materials = rotatedMaterials;
                    }

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

                    if (this.doorTypes.has(blockType)) {
                        // Doors: Thinner geometry
                        hasGeom = true;
                        const matIndex = materials[0]; // Assume single material for visual simplicity or standard array
                        const buffer = getBuffer(matIndex); // Warning: door might use multi-face materials logic if defined, but here we custom build.
                        // AssetManager defines door materials as array [m, m, m...]. So materials[0] is fine.

                        // Door Dimensions
                        // Full height (1), Full width (1), Thin depth (0.1?)
                        // Position: Center or Edge?
                        // "door_closed": edge aligned? or center? center is easier for now.
                        // "door_open": rotated 90 deg?

                        // Note: Real Minecraft doors align with block edge.
                        // Let's do 0.2 thickness, centered for simplicity first? 
                        // Or align to Z edge (closed) and X edge (open)?

                        // Let's make it simple: 
                        // Closed: Z-plane (thin slab in middle of Z)
                        // Open: X-plane (thin slab in middle of X)

                        let x1 = 0, x2 = 1, z1 = 0.4, z2 = 0.6; // Closed defaults (Z-planeish)

                        if (blockType === Blocks.DOOR_OPEN) {
                            // Rotated 90 deg (Open) -> Aligned along X? Or Z?
                            // Usually "Open" means you can walk through the Z-hole. So door must be along X-wall.
                            // Wait, if door is in a Z-wall. Closed = blocks Z passage (Plane is XY).
                            // Open = Unblocks Z passage (Plane is ZY, attached to side).

                            // Let's assume standard orientation:
                            // Closed: Plane XY (width x, height y, depth thin Z)
                            x1 = 0; x2 = 1; z1 = 0.4; z2 = 0.6; // Thin Z

                            // Actually "door_open" state in my game logic earlier just swapped the block to 'door_open'. 
                            // It didn't rotate geometry.
                            // So 'door_open' needs to be rotated 90 degrees.
                            // New dims: Thin X (Plane YZ)
                            x1 = 0.0; x2 = 0.2; z1 = 0; z2 = 1; // Attached to left side?
                        }

                        const addBox = (x1, y1, z1, x2, y2, z2) => {
                            // 6 Fases
                            const boxFaces = [
                                { corners: [[x2, y1, z1], [x2, y2, z1], [x2, y2, z2], [x2, y1, z2]], dir: [1, 0, 0], shade: 0.8 }, // Right
                                { corners: [[x1, y1, z2], [x1, y2, z2], [x1, y2, z1], [x1, y1, z1]], dir: [-1, 0, 0], shade: 0.8 }, // Left
                                { corners: [[x1, y2, z1], [x1, y2, z2], [x2, y2, z2], [x2, y2, z1]], dir: [0, 1, 0], shade: 1.0 }, // Top
                                { corners: [[x1, y1, z2], [x1, y1, z1], [x2, y1, z1], [x2, y1, z2]], dir: [0, -1, 0], shade: 0.5 }, // Bottom
                                { corners: [[x1, y1, z2], [x2, y1, z2], [x2, y2, z2], [x1, y2, z2]], dir: [0, 0, 1], shade: 0.8 }, // Front
                                { corners: [[x2, y1, z1], [x1, y1, z1], [x1, y2, z1], [x2, y2, z2]], dir: [0, 0, -1], shade: 0.8 } // Back (Fix corner 4 Z)
                            ];
                            // Fix Back Face corners: [[x2, y1, z1], [x1, y1, z1], [x1, y2, z1], [x2, y2, z1]]
                            boxFaces[5].corners = [[x2, y1, z1], [x1, y1, z1], [x1, y2, z1], [x2, y2, z1]];

                            for (const f of boxFaces) {
                                for (const c of f.corners) {
                                    buffer.positions.push(wx + c[0], wy + c[1], wz + c[2]);
                                    buffer.normals.push(...f.dir);
                                    let light = f.shade !== undefined ? f.shade : 1.0;
                                    buffer.colors.push(light, light, light);
                                }
                                buffer.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
                            }
                        };

                        addBox(x1, 0, z1, x2, 1, z2);
                        continue;
                    }

                    if (this.fenceTypes.has(blockType)) {
                        hasGeom = true;
                        const matIndex = materials[0];
                        const buffer = getBuffer(matIndex);

                        const addBox = (x1, y1, z1, x2, y2, z2) => {
                            // 6 Faces
                            const boxFaces = [
                                { corners: [[x2, y1, z1], [x2, y2, z1], [x2, y2, z2], [x2, y1, z2]], dir: [1, 0, 0], shade: 0.8 }, // Right
                                { corners: [[x1, y1, z2], [x1, y2, z2], [x1, y2, z1], [x1, y1, z1]], dir: [-1, 0, 0], shade: 0.8 }, // Left
                                { corners: [[x1, y2, z1], [x1, y2, z2], [x2, y2, z2], [x2, y2, z1]], dir: [0, 1, 0], shade: 1.0 }, // Top
                                { corners: [[x1, y1, z2], [x1, y1, z1], [x2, y1, z1], [x2, y1, z2]], dir: [0, -1, 0], shade: 0.5 }, // Bottom
                                { corners: [[x1, y1, z2], [x2, y1, z2], [x2, y2, z2], [x1, y2, z2]], dir: [0, 0, 1], shade: 0.8 }, // Front
                                { corners: [[x2, y1, z1], [x1, y1, z1], [x1, y2, z1], [x2, y2, z2]], dir: [0, 0, -1], shade: 0.8 } // Back
                            ];
                            // Fix Back Face corners: [[x2, y1, z1], [x1, y1, z1], [x1, y2, z1], [x2, y2, z1]]
                            boxFaces[5].corners = [[x2, y1, z1], [x1, y1, z1], [x1, y2, z1], [x2, y2, z1]];

                            for (const f of boxFaces) {
                                for (const c of f.corners) {
                                    buffer.positions.push(wx + c[0], wy + c[1], wz + c[2]);
                                    buffer.normals.push(...f.dir);
                                    let light = f.shade !== undefined ? f.shade : 1.0;
                                    buffer.colors.push(light, light, light);
                                }
                                buffer.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
                            }
                        };

                        // Central Post (0.25 thickness?, maybe 0.375 to 0.625)
                        const pMin = 0.375;
                        const pMax = 0.625;
                        addBox(pMin, 0, pMin, pMax, 1, pMax);

                        // Connectors
                        // Check neighbors
                        const neighbors = [
                            { dir: [0, 0, -1], name: 'north', x1: pMin, y1: 0.375, z1: 0, x2: pMax, y2: 0.5, z2: pMin }, // Back (Z-)
                            { dir: [0, 0, 1], name: 'south', x1: pMin, y1: 0.375, z1: pMax, x2: pMax, y2: 0.5, z2: 1 },  // Front (Z+)
                            { dir: [-1, 0, 0], name: 'west', x1: 0, y1: 0.375, z1: pMin, x2: pMin, y2: 0.5, z2: pMax },  // Left (X-)
                            { dir: [1, 0, 0], name: 'east', x1: pMax, y1: 0.375, z1: pMin, x2: 1, y2: 0.5, z2: pMax }    // Right (X+)
                        ];

                        // Upper rail? usually fences have 2 rails or 1.
                        // Standard MC fence: Post + 2 rails (upper and lower).
                        // Let's do 2 rails.
                        // Upper: y=0.75-0.875, Lower: y=0.375-0.5?
                        // Let's stick to 1 rail for simplicity first or do the standard look.
                        // Standard look is nice. Two rails.
                        // Rail 1 (Upper): y 0.7 to 0.9?
                        // Rail 2 (Lower): y 0.3 to 0.5?
                        // Post is 0.375 to 0.625 (width 0.25).

                        for (const n of neighbors) {
                            const nx = lx + n.dir[0];
                            const ny = ly + n.dir[1];
                            const nz = lz + n.dir[2];
                            const nb = this.getBlock(nx, ny, nz);

                            // Connect if neighbor is fence or solid
                            // What defines 'solid'? Not air, not water, not plant.
                            // Also connect to gates (if we had them).

                            let connects = false;
                            if (nb) {
                                if (this.fenceTypes.has(nb)) connects = true;
                                else if (nb.type !== Blocks.AIR &&
                                    nb.type !== Blocks.WATER &&
                                    !this.plantTypes.has(nb.type) &&
                                    nb.type !== Blocks.GLASS &&
                                    nb.type !== Blocks.LEAVES) { // connect to solids
                                    connects = true;
                                }
                            }

                            if (connects) {
                                // Draw rails
                                // Lower
                                // Adjust Y for rail
                                addBox(n.x1, 0.375, n.z1, n.x2, 0.5625, n.z2); // roughly 3/16 height

                                // Upper (if we want 2 rails, let's verify visual)
                                // Let's do just 1 thick rail or 2 thin ones. 
                                // MC has 2.
                                addBox(n.x1, 0.75, n.z1, n.x2, 0.9375, n.z2);
                            }
                        }
                        continue;
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



                        // Check if neighbor is transparent or non-full block (so we should draw our face)
                        const isTransparent = neighbor === Blocks.AIR ||
                            neighbor === Blocks.WATER ||
                            neighbor === Blocks.GLASS ||
                            neighbor === Blocks.LEAVES ||
                            neighbor === Blocks.PINE_LEAVES ||
                            neighbor === Blocks.BIRCH_LEAVES ||
                            neighbor === Blocks.SLIME ||
                            neighbor === Blocks.FENCE ||
                            neighbor === Blocks.IRON_BARS ||
                            neighbor === Blocks.WINDOW_FRAME ||
                            neighbor === Blocks.DOOR_CLOSED ||
                            neighbor === Blocks.DOOR_OPEN ||
                            neighbor === Blocks.SIGN ||
                            neighborIsPlant;
                        const shouldRender = !neighbor || (isTransparent && neighbor !== blockType);

                        if (shouldRender) {
                            hasGeom = true;
                            const matIndex = materials[face.idx];
                            const buffer = getBuffer(matIndex);

                            // Add face vertices
                            const terrainH = this.game.worldGen.getTerrainHeight(wx, wz);

                            for (let i = 0; i < face.corners.length; i++) {
                                const corner = face.corners[i];
                                buffer.positions.push(wx + corner[0], wy + corner[1], wz + corner[2]);
                                buffer.normals.push(...face.normal);

                                // Vertex lighting based on depth
                                const vy = wy + corner[1];
                                let light = 1.0;
                                if (vy < terrainH) {
                                    const depth = terrainH - vy;
                                    light = Math.max(0.15, 1.0 - (depth * 0.08));
                                }

                                // Apply directional shading
                                if (face.shade) {
                                    light *= face.shade;
                                }

                                // Apply Ambient Occlusion
                                // Calculate AO using the lookup table
                                const neighbors = aoTables[face.idx][i]; // i corresponds to corner index in face.corners loop?
                                // Loop below iterates 'face.corners'. We need index.
                                // We can change loop to: face.corners.forEach((corner, i) => ...)
                                // But currently it is "for (const corner of face.corners)".
                                // Let's use index.
                                if (neighbors) { // Safety check
                                    const s1 = isSolid(lx + neighbors[0][0], ly + neighbors[0][1], lz + neighbors[0][2]);
                                    const s2 = isSolid(lx + neighbors[1][0], ly + neighbors[1][1], lz + neighbors[1][2]);
                                    const c = isSolid(lx + neighbors[2][0], ly + neighbors[2][1], lz + neighbors[2][2]);

                                    let aoVal = 0;
                                    if (s1 && s2) {
                                        aoVal = 3;
                                    } else {
                                        aoVal = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (c ? 1 : 0);
                                    }

                                    // Map 0-3 to shading factor (1.0 down to ~0.5)
                                    // 0 -> 1.0
                                    // 1 -> 0.82
                                    // 2 -> 0.65
                                    // 3 -> 0.5
                                    const aoFactors = [1.0, 0.82, 0.65, 0.5];
                                    light *= aoFactors[aoVal];
                                }

                                buffer.colors.push(light, light, light);
                            }

                            const uvs = face.uvs || [0, 0, 0, 1, 1, 1, 1, 0];
                            buffer.uvs.push(...uvs);
                        }
                    }

                    // Check for grass block and if top face is exposed
                    if (blockType === Blocks.GRASS) {
                        // Check block above
                        const upBlock = this.getBlock(lx, ly + 1, lz);
                        const isUpTransparent = !upBlock ||
                            upBlock === Blocks.AIR ||
                            this.plantTypes.has(upBlock) ||
                            upBlock === Blocks.WATER ||
                            upBlock === Blocks.GLASS ||
                            upBlock === Blocks.FENCE; // etc

                        if (isUpTransparent) {
                            // Patchy Grass Logic using Simplex Noise
                            // Check available noise generator
                            let noiseVal = 1.0;
                            if (this.game.worldGen && this.game.worldGen.noise) {
                                // Frequency 0.05 gives patches of ~20 blocks wide
                                noiseVal = this.game.worldGen.noise.get2D(wx, wz, 0.05, 1);
                            }

                            // Only spawn grass if noise > 0.2 (creating gaps)
                            if (noiseVal > 0.2) {
                                grassPositions.push({ x: wx, y: wy, z: wz });
                            }
                        }
                    }
                }
            }
        }

        // Update Grass Mesh
        if (this.game.grassSystem) {
            this.game.grassSystem.updateChunk(this, grassPositions);
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
        // Use global setting from game
        const shadowsEnabled = this.game.terrainShadowsEnabled !== false;
        this.mesh.castShadow = shadowsEnabled;
        this.mesh.receiveShadow = shadowsEnabled;

        // Respect global visibility toggle
        if (this.game.terrainVisible === false) {
            this.mesh.visible = false;
        }

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
        if (this.grassMesh) {
            this.game.scene.remove(this.grassMesh);
            this.grassMesh.dispose();
            this.grassMesh = null;
        }
    }
}
