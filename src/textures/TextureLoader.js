import * as THREE from 'three';
import { generateTexture } from './TextureGenerator.js';

/**
 * TextureLoader - Handles texture and material loading for block types
 */
export class TextureLoader {
    constructor() {
        this.textures = {};
        this.materialArray = [];
        this.blockMaterialIndices = {};
        this.matMap = {}; // textureName -> materialIndex
    }

    /**
     * Get or create a material for a texture name
     */
    getOrCreateMat(name, transparent = false) {
        if (this.matMap[name] !== undefined) return this.matMap[name];

        const canvas = generateTexture(name);
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        this.textures[name] = texture;

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

    /**
     * Load all textures and create material mappings
     */
    loadTextures() {
        // Define materials map for blocks
        // Order of faces: right, left, top, bottom, front, back

        // Grass
        const grassTop = this.getOrCreateMat('grass_top');
        const grassSide = this.getOrCreateMat('grass_side');
        const dirt = this.getOrCreateMat('dirt');
        this.blockMaterialIndices['grass'] = [grassSide, grassSide, grassTop, dirt, grassSide, grassSide];

        // Dirt
        this.blockMaterialIndices['dirt'] = [dirt, dirt, dirt, dirt, dirt, dirt];

        // Stone
        const stone = this.getOrCreateMat('stone');
        this.blockMaterialIndices['stone'] = [stone, stone, stone, stone, stone, stone];

        // Wood
        const woodSide = this.getOrCreateMat('wood_side');
        const woodTop = this.getOrCreateMat('wood_top');
        this.blockMaterialIndices['wood'] = [woodSide, woodSide, woodTop, woodTop, woodSide, woodSide];

        // Birch Wood
        const birchSide = this.getOrCreateMat('birch_side');
        const birchTop = this.getOrCreateMat('birch_top');
        this.blockMaterialIndices['birch_wood'] = [birchSide, birchSide, birchTop, birchTop, birchSide, birchSide];

        // Pine Wood
        const pineSide = this.getOrCreateMat('pine_side');
        const pineTop = this.getOrCreateMat('pine_top');
        this.blockMaterialIndices['pine_wood'] = [pineSide, pineSide, pineTop, pineTop, pineSide, pineSide];

        // Leaves
        const leaves = this.getOrCreateMat('leaves', true);
        this.blockMaterialIndices['leaves'] = [leaves, leaves, leaves, leaves, leaves, leaves];

        // Birch Leaves
        const birchLeaves = this.getOrCreateMat('birch_leaves', true);
        this.blockMaterialIndices['birch_leaves'] = [birchLeaves, birchLeaves, birchLeaves, birchLeaves, birchLeaves, birchLeaves];

        // Pine Leaves
        const pineLeaves = this.getOrCreateMat('pine_leaves', true);
        this.blockMaterialIndices['pine_leaves'] = [pineLeaves, pineLeaves, pineLeaves, pineLeaves, pineLeaves, pineLeaves];

        // Sand
        const sand = this.getOrCreateMat('sand');
        this.blockMaterialIndices['sand'] = [sand, sand, sand, sand, sand, sand];

        // Water
        const water = this.getOrCreateMat('water', true);
        this.blockMaterialIndices['water'] = [water, water, water, water, water, water];

        // Brick
        const brick = this.getOrCreateMat('brick');
        this.blockMaterialIndices['brick'] = [brick, brick, brick, brick, brick, brick];

        // Glass
        const glass = this.getOrCreateMat('glass', true);
        this.blockMaterialIndices['glass'] = [glass, glass, glass, glass, glass, glass];

        // Plants (Cross geometry logic will just grab the first material usually, or we can assume all faces same)
        const flowerRed = this.getOrCreateMat('flower_red', true);
        this.blockMaterialIndices['flower_red'] = [flowerRed, flowerRed, flowerRed, flowerRed, flowerRed, flowerRed];

        const flowerYellow = this.getOrCreateMat('flower_yellow', true);
        this.blockMaterialIndices['flower_yellow'] = [flowerYellow, flowerYellow, flowerYellow, flowerYellow, flowerYellow, flowerYellow];

        const mushroomRed = this.getOrCreateMat('mushroom_red', true);
        this.blockMaterialIndices['mushroom_red'] = [mushroomRed, mushroomRed, mushroomRed, mushroomRed, mushroomRed, mushroomRed];

        const mushroomBrown = this.getOrCreateMat('mushroom_brown', true);
        this.blockMaterialIndices['mushroom_brown'] = [mushroomBrown, mushroomBrown, mushroomBrown, mushroomBrown, mushroomBrown, mushroomBrown];

        const longGrass = this.getOrCreateMat('long_grass', true);
        this.blockMaterialIndices['long_grass'] = [longGrass, longGrass, longGrass, longGrass, longGrass, longGrass];

        const fern = this.getOrCreateMat('fern', true);
        this.blockMaterialIndices['fern'] = [fern, fern, fern, fern, fern, fern];

        const flowerBlue = this.getOrCreateMat('flower_blue', true);
        this.blockMaterialIndices['flower_blue'] = [flowerBlue, flowerBlue, flowerBlue, flowerBlue, flowerBlue, flowerBlue];

        const deadBush = this.getOrCreateMat('dead_bush', true);
        this.blockMaterialIndices['dead_bush'] = [deadBush, deadBush, deadBush, deadBush, deadBush, deadBush];
    }
}
