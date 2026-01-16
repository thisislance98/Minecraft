
import { TerrainGenerator } from './src/world/TerrainGenerator.js';
import { BiomeManager } from './src/world/BiomeManager.js';

class MockBiomeManager extends BiomeManager {
    setSeed(seed) { super.setSeed(seed); }
    getTemperature(x, z) { return 0.5; } // Force temperate
    getHumidity(x, z) { return 0.5; } // Force temperate/forest
    getBiome(x, z, height) { return 'FOREST'; }
}

const biomeManager = new MockBiomeManager();
biomeManager.setSeed(12345);
const terrainGenerator = new TerrainGenerator(biomeManager);
// TerrainGenerator relies on its own internal noise, which we didn't seed explicitly in constructor
// but it creates new NoiseGenerator(). WorldGenerator sets seed.
// TerrainGenerator doesn't have setSeed method?
// Looking at TerrainGenerator.js:
// constructor(biomeManager) { this.noise = new NoiseGenerator(); ... }
// It seems TerrainGenerator's noise is random unless we control it.
// The file I read: 
// 150: this.noise = new NoiseGenerator(seed);
// 156: this.biomeManager.setSeed(seed);
// Wait, WorldGenerator calls setSeed on BiomeManager. 
// TerrainGenerator does NOT have setSeed in the file I saw?
// Let's check TerrainGenerator.js content again from memory or view.
// Line 5: this.noise = new NoiseGenerator();
// It seems TerrainGenerator noise is NOT seeded by WorldGenerator! 
// This might be a pre-existing bug or just how it is. 
// Wait, I didn't verify if TerrainGenerator has setSeed.
// Looking at my view_file output for TerrainGenerator.js (Step 15):
// It does NOT have setSeed.
// However, WorldGenerator (Step 16) has setSeed:
// 148: setSeed(seed) { ... this.biomeManager.setSeed(seed); }
// It seems WorldGenerator DOES NOT seed TerrainGenerator's noise?
// That means terrain terrain is random every reload?
// 150: this.noise = new NoiseGenerator(seed);
// But TerrainGenerator uses `this.noise`.
// WorldGenerator has `this.noise` too.
// TerrainGenerator is instantiated in WorldGenerator constructor:
// 16: this.terrainGenerator = new TerrainGenerator(this.biomeManager);
// TerrainGenerator creates its OWN noise.
// So TerrainGenerator noise is indeed unseeded!
// This seems like a pre-existing issue, but I won't fix it unless it blocks me.
// Currently I just want to verify river logic.
// I will patch TerrainGenerator instance with a seeded noise generator for consistency in test.

import { NoiseGenerator } from './src/utils/NoiseGenerator.js';
terrainGenerator.noise = new NoiseGenerator(12345);

console.log("Searching for high rivers...");

let foundHighRiver = false;
let samples = 0;
const seaLevel = 30;

// Scan area
for (let x = 0; x < 2000; x += 10) {
    for (let z = 0; z < 2000; z += 10) {
        samples++;
        const { height, waterLevel } = terrainGenerator.getTerrainData(x, z);

        // We look for water (height < waterLevel)
        // And water level above sea level (waterLevel > seaLevel)
        // And ensure it's not just ocean (usually ocean is waterLevel==seaLevel)

        if (waterLevel > seaLevel + 2 && height < waterLevel) {
            console.log(`Found high river at ${x},${z}: Ground=${height}, Water=${waterLevel} (SeaLevel=${seaLevel})`);
            foundHighRiver = true;
            break;
        }
    }
    if (foundHighRiver) break;
}

if (foundHighRiver) {
    console.log("SUCCESS: Confirmed rivers can exist above sea level.");
} else {
    console.log("FAILURE: Could not find any rivers above sea level in scanned area.");
    // This might just be bad luck with seed or params, but hopefully with 2000x2000 we find one.
}
