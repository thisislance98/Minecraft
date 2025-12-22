import { createNoise2D, createNoise3D } from 'simplex-noise';

export class NoiseGenerator {
    constructor(seed = Math.random()) {
        const seedFunc = typeof seed === 'number' ? this.mulberry32(seed) : seed;
        this.noise2D = createNoise2D(seedFunc);
        this.noise3D = createNoise3D(seedFunc);
    }

    mulberry32(a) {
        return function () {
            var t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

    // Get 2D noise with octaves
    get2D(x, z, scale = 0.01, octaves = 1, persistence = 0.5, lacunarity = 2) {
        let total = 0;
        let frequency = scale;
        let amplitude = 1;
        let maxValue = 0;  // Used for normalizing result to 0.0 - 1.0

        for (let i = 0; i < octaves; i++) {
            total += this.noise2D(x * frequency, z * frequency) * amplitude;

            maxValue += amplitude;

            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return total / maxValue; // Normalize to -1 to 1 range approx (actually Simplex is -1 to 1)
    }

    // Get 3D noise
    get3D(x, y, z, scale = 0.01) {
        return this.noise3D(x * scale, y * scale, z * scale);
    }
}
