import { NoiseGenerator } from '../utils/NoiseGenerator.js';

export class TerrainGenerator {
    constructor(biomeManager) {
        this.noise = new NoiseGenerator();
        this.biomeManager = biomeManager;
        this.seaLevel = 30;
    }

    getTerrainHeight(x, z) {
        // Delegate temp/humidity fetching to biome manager if needed, or re-calculate
        // For efficiency, we might duplicate noise calls or pass them in?
        // WorldGenerator typically calls getTerrainHeight first.
        // Let's re-use the noises internally or just call BiomeManager. 
        // Calling BiomeManager for temp/humidity is cleaner.

        const temp = this.biomeManager.getTemperature(x, z);
        const humidity = this.biomeManager.getHumidity(x, z);

        // 1. Plains/General Base (Smooth, rolling)
        const baseNoise = this.noise.get2D(x, z, 0.003, 1);

        // 2. Desert (Dunes)
        const desertNoise = Math.abs(this.noise.get2D(x, z, 0.01, 1));

        // 3. Mountains (Extreme)
        const mountainNoise = Math.abs(this.noise.get2D(x, z, 0.01, 3));

        // 4. Badlands/Jungle (Rougher)
        const roughNoise = this.noise.get2D(x, z, 0.015, 2);

        // -- Mixing Factors --
        // Mountain Mask
        const mountainMask = this.noise.get2D(x + 10000, z + 10000, 0.0015, 1);
        let mountainFactor = 0;
        if (mountainMask > 0.4) {
            mountainFactor = (mountainMask - 0.4) / 0.6;
        }

        // Desert Factor
        let desertFactor = 0;
        if (temp > 0.3 && humidity < -0.2) {
            desertFactor = 1;
        }

        // River Factor
        const riverNoise = Math.abs(this.noise.get2D(x, z, 0.002, 1));
        const riverWidth = 0.02;
        let riverFactor = 0;
        if (riverNoise < riverWidth) {
            riverFactor = (riverWidth - riverNoise) / riverWidth;
        }

        // -- Combine --
        let height = baseNoise * 10 + 35; // Base height ~35

        // Apply Desert
        if (desertFactor > 0) {
            const desertHeight = desertNoise * 10 + 35;
            height = height * (1 - desertFactor) + desertHeight * desertFactor;
        }

        // Apply Mountains
        if (mountainFactor > 0) {
            const mountainHeight = mountainNoise * 40 + 40;
            height = height * (1 - mountainFactor) + mountainHeight * mountainFactor;
        }

        // Apply Rivers (Carve down)
        if (riverFactor > 0) {
            // Carve down to sea level
            const riverDepth = 10 * riverFactor;
            height -= riverDepth;
        }

        return Math.floor(height);
    }

    isCave(x, y, z) {
        // 3D Noise for caves
        // Tuned for "spaghetti" caves
        const caveNoise = this.noise.get3D(x, y, z, 0.05, 1); // Frequency 0.05
        return caveNoise > 0.6; // Threshold
    }
}
