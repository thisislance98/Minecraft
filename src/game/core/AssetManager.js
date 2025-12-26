import * as THREE from 'three';
import { generateTexture } from '../../textures/TextureGenerator.js';

/**
 * AssetManager - Centralized resource management.
 * Handles textures, materials, models, and sounds.
 * Currently replaces TextureLoader.
 */
export class AssetManager {
    constructor(game) {
        this.game = game;

        // Texture & Material State
        this.textures = {};
        this.materialArray = [];
        this.matMap = {}; // name -> index
        this.blockMaterialIndices = {}; // blockType -> [matIndex, ...]

        // Future: Models and Sounds
        this.models = {};
        this.sounds = {};

        // Block Properties (Hardness, Tool requirements, etc.)
        this.blockProperties = {
            'grass': { hardness: 0.5 },
            'dirt': { hardness: 0.5 },
            'sand': { hardness: 0.5 },
            'snow': { hardness: 0.5 },
            'stone': { hardness: 1.5 },
            'wood': { hardness: 1.0 },
            'log': { hardness: 1.0 },
            'birch_wood': { hardness: 1.0 },
            'pine_wood': { hardness: 1.0 },
            'planks': { hardness: 1.0 },
            'leaves': { hardness: 0.1 },
            'birch_leaves': { hardness: 0.1 },
            'pine_leaves': { hardness: 0.1 },
            'gold_ore': { hardness: 2.0 },
            'diamond_ore': { hardness: 3.0 },
            'iron_ore': { hardness: 2.0 },
            'coal_ore': { hardness: 1.5 },
            'bedrock': { hardness: -1 }, // Unbreakable
            'flower_red': { hardness: 0.1 },
            'flower_yellow': { hardness: 0.1 },
            'flower_blue': { hardness: 0.1 },
            'mushroom_red': { hardness: 0.1 },
            'mushroom_brown': { hardness: 0.1 },
            'long_grass': { hardness: 0.1 },
            'fern': { hardness: 0.1 },
            'dead_bush': { hardness: 0.1 },
            'brick': { hardness: 1.5 },
            'glass': { hardness: 0.3 },
            'crafting_table': { hardness: 1.5 },
            'planks': { hardness: 1.0 },
            'painting': { hardness: 0.1 },
            'bed': { hardness: 0.5 },
            'stone_brick': { hardness: 1.5 },
            'bookshelf': { hardness: 1.0 },
            'gold_block': { hardness: 3.0 },
            'gold_block': { hardness: 3.0 },
            'tapestry': { hardness: 0.1 },
            'trampoline': { hardness: 0.8 },
            'door_closed': { hardness: 1.0 },
            'door_open': { hardness: 1.0 },
            // New Building Blocks
            'cobblestone': { hardness: 1.8 },
            'roof_tiles': { hardness: 1.2 },
            'chimney_brick': { hardness: 1.5 },
            'window_frame': { hardness: 0.8 },
            'fence': { hardness: 0.8 },
            'shingles': { hardness: 1.2 },
            'polished_stone': { hardness: 2.0 },
            'dark_planks': { hardness: 1.0 },
            'white_plaster': { hardness: 0.5 },
            'terracotta': { hardness: 1.2 },
            'thatch': { hardness: 0.3 },
            'half_timber': { hardness: 1.0 },
            'mossy_stone': { hardness: 1.3 },
            'iron_bars': { hardness: 2.0 }
        };
    }

    async loadResources() {
        console.log("AssetManager: Loading resources...");
        // In the future, this can be async Promise.all for GLB/Audio files.
        // For now, we synchronously generate procedural textures.
        this.loadGeneratedTextures();
        console.log("AssetManager: Resources loaded.");
    }

    // --- Texture & Material Logic (Ported from TextureLoader) ---

    loadGeneratedTextures() {
        // Core Blocks
        const grassTop = this.getOrCreateMat('grass_top');
        const grassSide = this.getOrCreateMat('grass_side');
        const dirt = this.getOrCreateMat('dirt');
        this.registerBlockMaterials('grass', [grassSide, grassSide, grassTop, dirt, grassSide, grassSide]);
        this.registerBlockMaterials('dirt', [dirt, dirt, dirt, dirt, dirt, dirt]);

        const stone = this.getOrCreateMat('stone');
        this.registerBlockMaterials('stone', [stone, stone, stone, stone, stone, stone]);

        // Ores
        const goldOre = this.getOrCreateMat('gold_ore');
        this.registerBlockMaterials('gold_ore', [goldOre, goldOre, goldOre, goldOre, goldOre, goldOre]);

        const diamondOre = this.getOrCreateMat('diamond_ore');
        this.registerBlockMaterials('diamond_ore', [diamondOre, diamondOre, diamondOre, diamondOre, diamondOre, diamondOre]);

        const ironOre = this.getOrCreateMat('iron_ore');
        this.registerBlockMaterials('iron_ore', [ironOre, ironOre, ironOre, ironOre, ironOre, ironOre]);

        const coalOre = this.getOrCreateMat('coal_ore');
        this.registerBlockMaterials('coal_ore', [coalOre, coalOre, coalOre, coalOre, coalOre, coalOre]);

        this.registerBlockMaterials('bedrock', [stone, stone, stone, stone, stone, stone]); // Fallback/reuse

        // Woods
        const woodSide = this.getOrCreateMat('wood_side');
        const woodTop = this.getOrCreateMat('wood_top');
        this.registerBlockMaterials('wood', [woodSide, woodSide, woodTop, woodTop, woodSide, woodSide]);
        this.registerBlockMaterials('log', [woodSide, woodSide, woodTop, woodTop, woodSide, woodSide]); // Alias

        const birchSide = this.getOrCreateMat('birch_side');
        const birchTop = this.getOrCreateMat('birch_top');
        this.registerBlockMaterials('birch_wood', [birchSide, birchSide, birchTop, birchTop, birchSide, birchSide]);

        const pineSide = this.getOrCreateMat('pine_side');
        const pineTop = this.getOrCreateMat('pine_top');
        this.registerBlockMaterials('pine_wood', [pineSide, pineSide, pineTop, pineTop, pineSide, pineSide]);

        // Crafting Table
        const craftingTableSide = this.getOrCreateMat('crafting_table_side');
        const craftingTableTop = this.getOrCreateMat('crafting_table_top');
        this.registerBlockMaterials('crafting_table', [craftingTableSide, craftingTableSide, craftingTableTop, craftingTableTop, craftingTableSide, craftingTableSide]);


        // Leaves
        const leaves = this.getOrCreateMat('leaves', true);
        this.registerBlockMaterials('leaves', leaves); // Auto-duplicates if single idx passed

        const birchLeaves = this.getOrCreateMat('birch_leaves', true);
        this.registerBlockMaterials('birch_leaves', birchLeaves);

        const pineLeaves = this.getOrCreateMat('pine_leaves', true);
        this.registerBlockMaterials('pine_leaves', pineLeaves);

        // Others
        const sand = this.getOrCreateMat('sand');
        this.registerBlockMaterials('sand', sand);

        const water = this.getOrCreateMat('water', true);
        this.registerBlockMaterials('water', water);

        const brick = this.getOrCreateMat('brick');
        this.registerBlockMaterials('brick', brick);

        const glass = this.getOrCreateMat('glass', true);
        this.registerBlockMaterials('glass', glass);

        const planks = this.getOrCreateMat('planks');
        this.registerBlockMaterials('planks', planks);

        const painting = this.getOrCreateMat('painting');
        this.registerBlockMaterials('painting', painting);

        const bedSide = this.getOrCreateMat('bed_side');
        const bedTop = this.getOrCreateMat('bed_top');
        this.registerBlockMaterials('bed', [bedSide, bedSide, bedTop, bedSide, bedSide, bedSide]);

        const snow = this.getOrCreateMat('snow');
        this.registerBlockMaterials('snow', snow);


        // Plants
        this.registerBlockMaterials('flower_red', this.getOrCreateMat('flower_red', true));
        this.registerBlockMaterials('flower_yellow', this.getOrCreateMat('flower_yellow', true));
        this.registerBlockMaterials('flower_blue', this.getOrCreateMat('flower_blue', true));
        this.registerBlockMaterials('mushroom_red', this.getOrCreateMat('mushroom_red', true));
        this.registerBlockMaterials('mushroom_brown', this.getOrCreateMat('mushroom_brown', true));
        this.registerBlockMaterials('long_grass', this.getOrCreateMat('long_grass', true));
        this.registerBlockMaterials('fern', this.getOrCreateMat('fern', true));
        this.registerBlockMaterials('dead_bush', this.getOrCreateMat('dead_bush', true));

        // Castle Blocks
        const stoneBrick = this.getOrCreateMat('stone_brick', false);
        this.registerBlockMaterials('stone_brick', stoneBrick);

        const goldBlock = this.getOrCreateMat('gold_block', false);
        this.registerBlockMaterials('gold_block', goldBlock);

        const tapestry = this.getOrCreateMat('tapestry', false);
        this.registerBlockMaterials('tapestry', tapestry); // Maybe directional? For now consistent.

        const bookshelfTop = this.getOrCreateMat('wood_top', false); // Reuse wood top
        const bookshelfSide = this.getOrCreateMat('bookshelf', false);
        this.registerBlockMaterials('bookshelf', [bookshelfSide, bookshelfSide, bookshelfTop, bookshelfTop, bookshelfSide, bookshelfSide]);

        // Trampoline
        const trampolineTop = this.getOrCreateMat('trampoline_top');
        const trampolineSide = this.getOrCreateMat('trampoline_side');
        // Side, Side, Top, Bottom, Side, Side
        // Use Side for bottom too? Or top for bottom? Frame (side) makes sense for bottom.
        this.registerBlockMaterials('trampoline', [trampolineSide, trampolineSide, trampolineTop, trampolineSide, trampolineSide, trampolineSide]);

        // Doors
        const doorClosed = this.getOrCreateMat('door_closed');
        this.registerBlockMaterials('door_closed', doorClosed);

        const doorOpen = this.getOrCreateMat('door_open', true); // Transparent center
        this.registerBlockMaterials('door_open', doorOpen);

        // ===== NEW BUILDING BLOCKS =====

        // Cobblestone - Rustic foundation and walls
        const cobblestone = this.getOrCreateMat('cobblestone');
        this.registerBlockMaterials('cobblestone', cobblestone);

        // Roof Tiles - Red clay roofing
        const roofTiles = this.getOrCreateMat('roof_tiles');
        this.registerBlockMaterials('roof_tiles', roofTiles);

        // Chimney Brick - Dark brick for chimneys
        const chimneyBrick = this.getOrCreateMat('chimney_brick');
        this.registerBlockMaterials('chimney_brick', chimneyBrick);

        // Window Frame - Decorative windows
        const windowFrame = this.getOrCreateMat('window_frame', true);
        this.registerBlockMaterials('window_frame', windowFrame);

        // Fence - Wooden fence
        const fence = this.getOrCreateMat('fence', false);
        this.registerBlockMaterials('fence', fence);

        // Shingles - Slate roof material
        const shingles = this.getOrCreateMat('shingles');
        this.registerBlockMaterials('shingles', shingles);

        // Polished Stone - Smooth floor material
        const polishedStone = this.getOrCreateMat('polished_stone');
        this.registerBlockMaterials('polished_stone', polishedStone);

        // Dark Planks - Dark wood flooring
        const darkPlanks = this.getOrCreateMat('dark_planks');
        this.registerBlockMaterials('dark_planks', darkPlanks);

        // White Plaster - Wall material
        const whitePlaster = this.getOrCreateMat('white_plaster');
        this.registerBlockMaterials('white_plaster', whitePlaster);

        // Terracotta - Decorative clay blocks
        const terracotta = this.getOrCreateMat('terracotta');
        this.registerBlockMaterials('terracotta', terracotta);

        // Thatch - Straw roofing
        const thatch = this.getOrCreateMat('thatch');
        this.registerBlockMaterials('thatch', thatch);

        // Half-Timber - Tudor style walls
        const halfTimber = this.getOrCreateMat('half_timber');
        this.registerBlockMaterials('half_timber', halfTimber);

        // Mossy Stone - Weathered stone
        const mossyStone = this.getOrCreateMat('mossy_stone');
        this.registerBlockMaterials('mossy_stone', mossyStone);

        // Iron Bars - Window/fence bars
        const ironBars = this.getOrCreateMat('iron_bars', true);
        this.registerBlockMaterials('iron_bars', ironBars);

        // Break Stages
        this.breakMaterials = [];
        for (let i = 0; i <= 9; i++) {
            this.breakMaterials.push(this.getOrCreateBasicMat(`break_stage_${i}`, true));
        }
    }

    getOrCreateBasicMat(name, transparent = false) {
        if (this.matMap[name] !== undefined) return this.matMap[name];

        const canvas = generateTexture(name);
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;

        this.textures[name] = texture;

        const mat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: transparent,
            opacity: transparent ? 0.8 : 1.0,
            side: THREE.DoubleSide,
            alphaTest: transparent ? 0.1 : 0,
            vertexColors: false // Basic materials for overlays shouldn't need vertex colors
        });

        const idx = this.materialArray.length;
        this.materialArray.push(mat);
        this.matMap[name] = idx;
        return idx;
    }

    getOrCreateMat(name, transparent = false) {
        if (this.matMap[name] !== undefined) return this.matMap[name];

        const canvas = generateTexture(name);
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        this.textures[name] = texture;
        if (name === 'water') {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
        }

        const mat = new THREE.MeshLambertMaterial({
            map: texture,
            transparent: transparent,
            opacity: transparent ? 0.8 : 1.0,
            side: transparent ? THREE.DoubleSide : THREE.FrontSide,
            alphaTest: transparent ? 0.1 : 0,
            vertexColors: true
        });

        const idx = this.materialArray.length;
        this.materialArray.push(mat);
        this.matMap[name] = idx;
        return idx;
    }

    registerBlockMaterials(blockType, materials) {
        if (Array.isArray(materials)) {
            this.blockMaterialIndices[blockType] = materials;
        } else {
            // Single material -> same for all 6 faces
            const m = materials;
            this.blockMaterialIndices[blockType] = [m, m, m, m, m, m];
        }
    }

    // --- Public Access ---

    getMaterials() {
        return this.materialArray;
    }

    getBlockMaterialIndices() {
        return this.blockMaterialIndices;
    }

    getEntityMaterial(name) {
        if (this.matMap[name] !== undefined) {
            // If it's already in the global array (reused block texture), return it
            // BUT for entities we usually want a standalone material if we are doing custom things?
            // Actually, reusing the material index is fine if we return the material object.
            const idx = this.matMap[name];
            return this.materialArray[idx];
        }

        // Check explicit entity cache if separate (optional, but let's stick to valid reuse)
        // For now, let's create a NEW material for entities to ensure settings (like vertexColors: false) are correct
        // effectively treating entities distinct from blocks to avoid side effects.

        // Actually, let's just generate it and cache it in matMap for now, assuming standard settings?
        // Detailed Plan said: "Returns a THREE.MeshLambertMaterial with vertexColors: false"

        const canvas = generateTexture(name);
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;

        const mat = new THREE.MeshLambertMaterial({
            map: texture,
            vertexColors: false // Entities don't use the chunk-based lighting (yet)
        });

        // We don't necessarily need to add it to 'this.materialArray' because that's for the Chunk InstancedMesh/TextureAtlas system (if applicable).
        // Since entities are individual meshes, we can just return the material.
        // We SHOULD cache it though.

        this.matMap[name] = this.materialArray.length; // Just to mark it as known, though we might not push it to array if not block?
        // Wait, 'this.matMap' maps name -> index in 'this.materialArray'.
        // If we don't push it to materialArray, we shouldn't use matMap in the same way.
        // Let's use a separate cache for entity materials.

        if (!this.entityMaterials) this.entityMaterials = {};
        if (this.entityMaterials[name]) return this.entityMaterials[name];

        this.entityMaterials[name] = mat;
        return mat;
    }
}
