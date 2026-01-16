import { NoiseGenerator } from '../utils/NoiseGenerator.js';

export class BiomeManager {
    constructor() {
        this.noise = new NoiseGenerator();
        this.tempCache = new Map();
        this.humidityCache = new Map();
        this.maxCacheSize = 25000;
    }

    setSeed(seed) {
        this.noise = new NoiseGenerator(seed);
        this.tempCache.clear();
        this.humidityCache.clear();
    }

    getCacheKey(x, z) {
        return ((x & 0xFFFF) << 16) | (z & 0xFFFF);
    }

    getTemperature(x, z) {
        const key = this.getCacheKey(x, z);
        if (this.tempCache.has(key)) return this.tempCache.get(key);

        // Large scale temperature map: -1 (cold) to 1 (hot)
        const temp = this.noise.get2D(x, z, 0.005, 1) + 0.35;

        if (this.tempCache.size > this.maxCacheSize) {
            this.tempCache.delete(this.tempCache.keys().next().value);
        }
        this.tempCache.set(key, temp);
        return temp;
    }

    getHumidity(x, z) {
        const key = this.getCacheKey(x, z);
        if (this.humidityCache.has(key)) return this.humidityCache.get(key);

        // Large scale humidity map: -1 (dry) to 1 (wet)
        const humidity = this.noise.get2D(x + 5000, z + 5000, 0.005, 1);

        if (this.humidityCache.size > this.maxCacheSize) {
            this.humidityCache.delete(this.humidityCache.keys().next().value);
        }
        this.humidityCache.set(key, humidity);
        return humidity;
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
