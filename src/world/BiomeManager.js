import { NoiseGenerator } from '../utils/NoiseGenerator.js';

export class BiomeManager {
    constructor() {
        this.noise = new NoiseGenerator();
    }

    setSeed(seed) {
        this.noise = new NoiseGenerator(seed);
    }

    getTemperature(x, z) {
        // Large scale temperature map: -1 (cold) to 1 (hot)
        return this.noise.get2D(x, z, 0.005, 1) + 0.35;
    }

    getHumidity(x, z) {
        // Large scale humidity map: -1 (dry) to 1 (wet)
        return this.noise.get2D(x + 5000, z + 5000, 0.005, 1);
    }

    getBiome(x, z, height) {
        const seaLevel = 30; // Could be passed in
        const temp = this.getTemperature(x, z);
        const humidity = this.getHumidity(x, z);

        if (height <= seaLevel) return 'OCEAN';
        if (height > 55) return 'MOUNTAIN'; // High peaks

        // Biome Classification
        if (temp > 0.3) { // HOT
            if (humidity < -0.2) return 'DESERT';
            if (humidity > 0.2) return 'JUNGLE';
            return 'PLAINS'; // Savanna-like
        } else if (temp < -0.3) { // COLD
            if (humidity > 0.2) return 'SNOW'; // Snowy Tundra
            return 'PLAINS'; // Tundra
        } else { // TEMPERATE
            if (humidity > 0.1) return 'FOREST';
            return 'PLAINS';
        }
    }
}
