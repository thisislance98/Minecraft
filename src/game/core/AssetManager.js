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
            'door_open': { hardness: 1.0 }
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
}
