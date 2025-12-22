/**
 * Seeded Random Number Generator
 * Uses Mulberry32 algorithm for deterministic random numbers
 */
export class SeededRandom {
    constructor(seed) {
        this.seed = seed >>> 0; // Ensure unsigned 32-bit integer
        this.state = this.seed;
    }

    /**
     * Mulberry32 PRNG - fast and good quality
     * Returns a number between 0 and 1
     */
    next() {
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    /**
     * Get integer between min (inclusive) and max (inclusive)
     */
    nextInt(min, max) {
        return min + Math.floor(this.next() * (max - min + 1));
    }

    /**
     * Get float between min and max
     */
    nextFloat(min = 0, max = 1) {
        return min + this.next() * (max - min);
    }

    /**
     * Reset to initial seed
     */
    reset() {
        this.state = this.seed;
    }

    /**
     * Create new instance with combined seed
     * Useful for creating deterministic but different RNGs
     */
    static fromSeeds(...seeds) {
        let combined = 0;
        for (const seed of seeds) {
            combined = (combined * 31 + seed) >>> 0;
        }
        return new SeededRandom(combined);
    }
}
