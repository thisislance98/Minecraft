import { NoiseGenerator } from '../utils/NoiseGenerator.js';

export class TerrainGenerator {
    constructor(biomeManager) {
        this.noise = new NoiseGenerator();
        this.biomeManager = biomeManager;
        this.seaLevel = 30;
        this.riversEnabled = false; // Will be set from Config

        // OPTIMIZATION: Cache terrain heights to avoid redundant noise calculations
        // Adjacent chunks share column edges, so caching prevents recalculation
        // Each entry stores [groundHeight, riverWaterLevel] to avoid double computation
        this.heightCache = new Map();
        this.maxCacheSize = 50000; // ~50k columns = ~13 chunks radius worth
    }

    setSeed(seed) {
        this.noise = new NoiseGenerator(seed);
        this.clearCache(); // Clear cache when seed changes
    }

    clearCache() {
        this.heightCache.clear();
    }

    setRiversEnabled(enabled) {
        this.riversEnabled = enabled;
    }

    _getCacheKey(x, z) {
        return ((x & 0xFFFF) << 16) | (z & 0xFFFF);
    }

    _ensureCached(x, z) {
        const cacheKey = this._getCacheKey(x, z);
        if (!this.heightCache.has(cacheKey)) {
            const result = this._calculateTerrainHeight(x, z);
            if (this.heightCache.size >= this.maxCacheSize) {
                const firstKey = this.heightCache.keys().next().value;
                this.heightCache.delete(firstKey);
            }
            this.heightCache.set(cacheKey, result);
        }
        return this.heightCache.get(cacheKey);
    }

    getTerrainHeight(x, z) {
        return this._ensureCached(x, z)[0];
    }

    /**
     * Returns the river water surface level at (x, z), or -1 if not in a river.
     * Computed alongside terrain height in a single pass - this is just a cache lookup.
     */
    getRiverWaterLevel(x, z) {
        return this._ensureCached(x, z)[1];
    }

    _calculateTerrainHeight(x, z) {
        const temp = this.biomeManager.getTemperature(x, z);
        const humidity = this.biomeManager.getHumidity(x, z);

        // -- Base Height -- (Always needed)
        const baseNoise = this.noise.get2D(x, z, 0.003, 1);
        let height = baseNoise * 10 + 35; // Base height ~35

        // -- Desert Dunes --
        // Check if we even need desert noise
        if (temp > 0.3 && humidity < -0.2) {
            const desertFactor = Math.min(1, (temp - 0.3) * 2 * ((-0.2 - humidity) / 0.5));
            if (desertFactor > 0) {
                const desertNoise = Math.abs(this.noise.get2D(x, z, 0.01, 1));
                const desertHeight = desertNoise * 10 + 35;
                height = height * (1 - desertFactor) + desertHeight * desertFactor;
            }
        }

        // -- Mountains --
        // Check mountain mask first
        const mountainMask = this.noise.get2D(x + 10000, z + 10000, 0.0015, 1);
        if (mountainMask > 0.4) {
            const mountainFactor = (mountainMask - 0.4) / 0.6;
            const smoothFactor = mountainFactor * mountainFactor; // Square for smoother blend

            const mountainNoise = Math.abs(this.noise.get2D(x, z, 0.01, 3));
            const mountainHeight = mountainNoise * 40 + 40;

            height = height * (1 - smoothFactor) + mountainHeight * smoothFactor;
        }

        // -- Rivers --
        // Track water level: -1 means not in a river
        let riverWaterLevel = -1;

        if (this.riversEnabled) {
            const warpX = this.noise.get2D(x, z, 0.005, 1) * 40;
            const warpZ = this.noise.get2D(z + 500, x + 500, 0.005, 1) * 40;

            const riverNoise = Math.abs(this.noise.get2D(x + warpX, z + warpZ, 0.002, 1));
            const riverWidth = 0.15;

            if (riverNoise < riverWidth) {
                // Water surface is 3 blocks below the bank for visible riverbanks
                riverWaterLevel = Math.floor(height) - 3;

                let riverFactor = Math.pow((riverWidth - riverNoise) / riverWidth, 2);
                const riverBedHeight = Math.max(this.seaLevel - 12, height - 5);
                height = height * (1 - riverFactor) + riverBedHeight * riverFactor;
            }
        }

        // Return both values: [groundHeight, riverWaterLevel]
        return [Math.floor(height), riverWaterLevel];
    } // end _calculateTerrainHeight

    isCave(x, y, z) {
        // "Worm" caves using domain intersection
        // We look for areas where two uncorrelated noise fields are both close to zero
        // This mathematically defines a tube/tunnel structure in 3D space

        // Disable caves near surface to prevent ugly holes
        if (y > 40) return false;

        const scale = 0.02; // Higher frequency for smaller, more natural tunnels

        // Use large offsets to simulate independent noise fields
        const n1 = this.noise.get3D(x, y, z, scale);
        const n2 = this.noise.get3D(x + 123.4, y + 567.8, z + 901.2, scale);

        // Define the "tunnel" radius (squared)
        // Values close to 0 in both fields mean we are inside the tunnel
        const val = (n1 * n1) + (n2 * n2);

        // Smaller threshold for smaller, natural caves
        const threshold = 0.02;

        return val < threshold;
    }
}
