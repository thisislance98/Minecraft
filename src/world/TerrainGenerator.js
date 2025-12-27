import { NoiseGenerator } from '../utils/NoiseGenerator.js';

export class TerrainGenerator {
    constructor(biomeManager) {
        this.noise = new NoiseGenerator();
        this.biomeManager = biomeManager;
        this.seaLevel = 30;
    }

    setSeed(seed) {
        this.noise = new NoiseGenerator(seed);
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

        // Apply Rivers (Carve down with Domain Warping)
        // Domain Warp: Offset the coordinate lookup for natural winding
        const warpX = this.noise.get2D(x, z, 0.005, 1) * 40; // Low freq warp
        const warpZ = this.noise.get2D(z + 500, x + 500, 0.005, 1) * 40;

        const riverNoise = Math.abs(this.noise.get2D(x + warpX, z + warpZ, 0.002, 1));
        const riverWidth = 0.08; // Wider checking area for smoother transition
        const deepRiverWidth = 0.01; // The actual deep water part

        if (riverNoise < riverWidth) {
            // Calculate river depth factor (0 at banks, 1 at center)
            // Use smoothstart / squared for nicer curve
            let riverFactor = (riverWidth - riverNoise) / riverWidth;

            // Make center deeper and banks smoother
            // riverFactor goes 0 -> 1. 
            // Square it for a gentle ease-in from the banks (concave slope)
            riverFactor = Math.pow(riverFactor, 2);

            // Carve
            // Max depth
            const riverDepth = 25 * riverFactor;

            // If we are in mountain, we carve deeper to ensure we hit water
            // But let's just subtract relative to sea level mostly
            // If terrain is very high (mountain), we need to carve A LOT to get to sea level (30)

            // Logic: Target height for river center is slightly below sea level
            // Current height could be anything.

            // let's blend current height towards river bed height based on factor
            const riverBedHeight = this.seaLevel - 5;

            // simple subtraction might not be enough for mountains
            // let's interpolate
            height = height * (1 - riverFactor) + riverBedHeight * riverFactor;
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
