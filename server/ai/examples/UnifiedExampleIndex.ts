/**
 * UnifiedExampleIndex - Unified semantic search across all example sources
 *
 * Scans and indexes examples from:
 * 1. Static source files on disk (animals-base/, animals/, items/)
 * 2. Firebase-persisted creatures (from DynamicCreatureService cache)
 * 3. Firebase-persisted items (from DynamicItemService cache)
 * 4. Hardcoded structure examples (from structures.ts)
 *
 * Provides a single search() method that returns the most semantically
 * similar examples for any user request, replacing the three separate
 * example arrays that previously only had ~11 total examples.
 */

import * as fs from 'fs';
import * as path from 'path';
import { semanticSearchExamples } from '../../services/SemanticSearch';
import { structureExamples } from './structures';
import { getAllCreatures } from '../../services/DynamicCreatureService';
import { getAllItems } from '../../services/DynamicItemService';

// ============================================================
// TYPES
// ============================================================

export type ExampleCategory = 'creature' | 'item' | 'structure';

export interface UnifiedExample {
    name: string;
    description: string;
    keywords: string[];
    category: ExampleCategory;
    code: string;
    icon?: string;          // Only for items
    charCount: number;      // For token budget management
    source: 'static' | 'firebase' | 'hardcoded';
}

export interface SearchOptions {
    category?: ExampleCategory;
    topK?: number;
    maxTotalChars?: number;
}

// ============================================================
// PATHS
// ============================================================

const ANIMALS_BASE_DIR = path.join(__dirname, '../../../src/game/entities/animals-base');
const ANIMALS_DIR = path.join(__dirname, '../../../src/game/entities/animals');
const ITEMS_DIR = path.join(__dirname, '../../../src/game/items');

// Files to skip when scanning
const CREATURE_SKIP_FILES = new Set(['Animal.js', 'index.js']);
const ITEM_SKIP_FILES = new Set(['Item.js', 'WandItem.js', 'FurnitureItem.js']);
const MIN_ITEM_FILE_SIZE = 500; // Skip tiny files

// ============================================================
// UNIFIED EXAMPLE INDEX
// ============================================================

class UnifiedExampleIndex {
    private examples: UnifiedExample[] = [];
    private initialized = false;

    /**
     * Initialize the index by scanning all sources.
     * Must be called after loadAllCreatures() and loadAllItems() so
     * Firebase data is available in memory.
     */
    async initialize(): Promise<void> {
        const startTime = Date.now();
        this.examples = [];

        // 1. Scan static source files
        const staticCreatures = this.scanCreatureFiles();
        const staticItems = this.scanItemFiles();

        // 2. Load Firebase-persisted creatures & items
        const firebaseCreatures = this.loadFirebaseCreatures();
        const firebaseItems = this.loadFirebaseItems();

        // 3. Load hardcoded structure examples
        const structures = this.loadStructureExamples();

        // 4. Merge with deduplication (Firebase wins over static for same name)
        this.mergeExamples(staticCreatures, firebaseCreatures, staticItems, firebaseItems, structures);

        this.initialized = true;
        const elapsed = Date.now() - startTime;

        const creatureCount = this.examples.filter(e => e.category === 'creature').length;
        const itemCount = this.examples.filter(e => e.category === 'item').length;
        const structureCount = this.examples.filter(e => e.category === 'structure').length;

        console.log(`[UnifiedExampleIndex] Ready with ${this.examples.length} examples in ${elapsed}ms`);
        console.log(`[UnifiedExampleIndex]   Creatures: ${creatureCount} (${staticCreatures.length} static + ${firebaseCreatures.length} firebase)`);
        console.log(`[UnifiedExampleIndex]   Items: ${itemCount} (${staticItems.length} static + ${firebaseItems.length} firebase)`);
        console.log(`[UnifiedExampleIndex]   Structures: ${structureCount}`);
    }

    /**
     * Search for the best matching examples using semantic similarity.
     *
     * @param query - User's request text
     * @param options - Search options (category filter, topK, budget)
     * @returns Array of matching examples sorted by relevance
     */
    async search(query: string, options: SearchOptions = {}): Promise<UnifiedExample[]> {
        if (!this.initialized) {
            console.warn('[UnifiedExampleIndex] Not initialized, returning empty results');
            return [];
        }

        const {
            category,
            topK = 3,
            maxTotalChars = 30000 // ~8000 tokens — generous budget for rich examples
        } = options;

        // Filter by category if specified
        const pool = category
            ? this.examples.filter(e => e.category === category)
            : this.examples;

        if (pool.length === 0) {
            console.log(`[UnifiedExampleIndex] No examples for category: ${category}`);
            return [];
        }

        try {
            // Use existing semantic search infrastructure
            const results = await semanticSearchExamples(query, pool, topK * 2, 0.2);

            // Apply token budget: pick top results that fit within budget
            const selected: UnifiedExample[] = [];
            let totalChars = 0;
            const maxSingleExample = maxTotalChars * 0.5; // No single example > 50% of budget

            for (const result of results) {
                const ex = result.example;

                // Skip very large examples
                if (ex.charCount > maxSingleExample) {
                    console.log(`[UnifiedExampleIndex] Skipping ${ex.name} (${ex.charCount} chars > ${maxSingleExample} budget limit)`);
                    continue;
                }

                // Check if adding this would exceed budget
                if (totalChars + ex.charCount > maxTotalChars) {
                    continue;
                }

                selected.push(ex);
                totalChars += ex.charCount;

                if (selected.length >= topK) break;
            }

            console.log(`[UnifiedExampleIndex] Search "${query}" (${category || 'all'}): ${selected.length} results, ${totalChars} chars`);
            selected.forEach((ex, i) => {
                console.log(`  [${i + 1}] ${ex.name} (${ex.category}, ${ex.source}, ${ex.charCount} chars)`);
            });

            return selected;

        } catch (error: any) {
            console.error('[UnifiedExampleIndex] Search failed, returning first examples:', error.message);
            // Fallback: return first few examples from the pool
            return pool.slice(0, topK);
        }
    }

    /**
     * Resolve what category a "custom" request should route to.
     * Uses semantic similarity against all examples to pick the best category.
     */
    async resolveCategory(text: string): Promise<ExampleCategory> {
        if (!this.initialized) return 'creature';

        try {
            // Search across all categories with low threshold
            const results = await semanticSearchExamples(text, this.examples, 3, 0.0);

            if (results.length === 0) return 'creature';

            // Count category votes from top results, weighted by similarity
            const scores: Record<ExampleCategory, number> = { creature: 0, item: 0, structure: 0 };
            for (const r of results) {
                scores[r.example.category] += r.similarity;
            }

            console.log(`[UnifiedExampleIndex] Category scores — creature: ${scores.creature.toFixed(3)}, item: ${scores.item.toFixed(3)}, structure: ${scores.structure.toFixed(3)}`);

            const best = Math.max(scores.creature, scores.item, scores.structure);
            if (best < 0.25) return 'creature'; // Default

            if (best === scores.structure) return 'structure';
            if (best === scores.item) return 'item';
            return 'creature';

        } catch (error: any) {
            console.error('[UnifiedExampleIndex] Category resolution failed:', error.message);
            return 'creature';
        }
    }

    /**
     * Get total example count (for logging/diagnostics)
     */
    getStats(): { total: number; creatures: number; items: number; structures: number } {
        return {
            total: this.examples.length,
            creatures: this.examples.filter(e => e.category === 'creature').length,
            items: this.examples.filter(e => e.category === 'item').length,
            structures: this.examples.filter(e => e.category === 'structure').length,
        };
    }

    // ============================================================
    // PRIVATE: Source Scanning
    // ============================================================

    /**
     * Scan animals-base/ and animals/ for creature source files.
     */
    private scanCreatureFiles(): UnifiedExample[] {
        const examples: UnifiedExample[] = [];

        // Scan animals-base/
        examples.push(...this.scanDirectory(ANIMALS_BASE_DIR, 'creature', CREATURE_SKIP_FILES));

        // Scan animals/
        examples.push(...this.scanDirectory(ANIMALS_DIR, 'creature', CREATURE_SKIP_FILES));

        return examples;
    }

    /**
     * Scan items/ directory for item source files.
     */
    private scanItemFiles(): UnifiedExample[] {
        return this.scanDirectory(ITEMS_DIR, 'item', ITEM_SKIP_FILES, MIN_ITEM_FILE_SIZE);
    }

    /**
     * Scan a directory for JS files and extract class code.
     */
    private scanDirectory(
        dirPath: string,
        category: ExampleCategory,
        skipFiles: Set<string>,
        minSize: number = 0
    ): UnifiedExample[] {
        const examples: UnifiedExample[] = [];

        if (!fs.existsSync(dirPath)) {
            console.log(`[UnifiedExampleIndex] Directory not found: ${dirPath}`);
            return examples;
        }

        try {
            const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js') && !skipFiles.has(f));

            for (const file of files) {
                const filePath = path.join(dirPath, file);

                try {
                    const stat = fs.statSync(filePath);
                    if (stat.size < minSize) continue;

                    const raw = fs.readFileSync(filePath, 'utf-8');
                    const code = this.extractClassCode(raw);
                    if (!code) continue;

                    const className = this.extractClassName(code);
                    if (!className) continue;

                    const example: UnifiedExample = {
                        name: className,
                        description: this.generateDescription(className, code, category),
                        keywords: this.generateKeywords(className, code, category),
                        category,
                        code,
                        charCount: code.length,
                        source: 'static',
                    };

                    examples.push(example);
                } catch (err: any) {
                    console.warn(`[UnifiedExampleIndex] Failed to read ${file}: ${err.message}`);
                }
            }
        } catch (err: any) {
            console.warn(`[UnifiedExampleIndex] Failed to scan ${dirPath}: ${err.message}`);
        }

        return examples;
    }

    /**
     * Load creatures from DynamicCreatureService's in-memory cache (Firebase-backed).
     */
    private loadFirebaseCreatures(): UnifiedExample[] {
        const examples: UnifiedExample[] = [];

        try {
            const creatures = getAllCreatures(); // Global creatures loaded at startup
            for (const creature of creatures) {
                if (!creature.code || !creature.name) continue;

                const code = this.stripImports(creature.code);
                examples.push({
                    name: creature.name,
                    description: creature.description || this.generateDescription(creature.name, code, 'creature'),
                    keywords: this.generateKeywords(creature.name, code, 'creature'),
                    category: 'creature',
                    code,
                    charCount: code.length,
                    source: 'firebase',
                });
            }
        } catch (err: any) {
            console.warn(`[UnifiedExampleIndex] Failed to load Firebase creatures: ${err.message}`);
        }

        return examples;
    }

    /**
     * Load items from DynamicItemService's in-memory cache (Firebase-backed).
     */
    private loadFirebaseItems(): UnifiedExample[] {
        const examples: UnifiedExample[] = [];

        try {
            const items = getAllItems(); // Global items loaded at startup
            for (const item of items) {
                if (!item.code || !item.name) continue;

                const code = this.stripImports(item.code);
                examples.push({
                    name: item.name,
                    description: item.description || this.generateDescription(item.name, code, 'item'),
                    keywords: this.generateKeywords(item.name, code, 'item'),
                    category: 'item',
                    code,
                    icon: item.icon,
                    charCount: code.length,
                    source: 'firebase',
                });
            }
        } catch (err: any) {
            console.warn(`[UnifiedExampleIndex] Failed to load Firebase items: ${err.message}`);
        }

        return examples;
    }

    /**
     * Convert hardcoded structure examples from structures.ts into UnifiedExample format.
     */
    private loadStructureExamples(): UnifiedExample[] {
        return structureExamples
            .filter(s => s.code) // Only those with code snippets
            .map(s => ({
                name: s.name,
                description: s.description,
                keywords: s.keywords || [],
                category: 'structure' as ExampleCategory,
                code: s.code,
                charCount: s.code.length,
                source: 'hardcoded' as const,
            }));
    }

    // ============================================================
    // PRIVATE: Merging & Deduplication
    // ============================================================

    /**
     * Merge all example sources with deduplication.
     * Priority: Firebase > animals/ > animals-base/ for creatures
     *           Firebase > items/ for items
     */
    private mergeExamples(
        staticCreatures: UnifiedExample[],
        firebaseCreatures: UnifiedExample[],
        staticItems: UnifiedExample[],
        firebaseItems: UnifiedExample[],
        structures: UnifiedExample[]
    ): void {
        const seen = new Map<string, UnifiedExample>(); // key: "category:name"

        // Add in priority order (later entries overwrite earlier for same name)

        // Static creatures (animals-base/ first, then animals/ overwrites)
        for (const ex of staticCreatures) {
            seen.set(`creature:${ex.name}`, ex);
        }

        // Firebase creatures (highest priority for creatures)
        for (const ex of firebaseCreatures) {
            seen.set(`creature:${ex.name}`, ex);
        }

        // Static items
        for (const ex of staticItems) {
            seen.set(`item:${ex.name}`, ex);
        }

        // Firebase items (highest priority for items)
        for (const ex of firebaseItems) {
            seen.set(`item:${ex.name}`, ex);
        }

        // Structures (no dedup needed - only one source)
        for (const ex of structures) {
            seen.set(`structure:${ex.name}`, ex);
        }

        this.examples = Array.from(seen.values());
    }

    // ============================================================
    // PRIVATE: Code Extraction & Metadata Generation
    // ============================================================

    /**
     * Extract class code from a JS file: strip imports and export keyword.
     */
    private extractClassCode(raw: string): string | null {
        const stripped = this.stripImports(raw);

        // Check for a class definition
        if (!stripped.includes('class ')) return null;

        return stripped;
    }

    /**
     * Strip import lines and the `export` keyword from class declarations.
     */
    private stripImports(code: string): string {
        const lines = code.split('\n');
        const filtered = lines.filter(line => {
            const trimmed = line.trimStart();
            return !trimmed.startsWith('import ') && !trimmed.startsWith('export default');
        });

        // Remove `export` keyword from class declarations
        return filtered
            .join('\n')
            .replace(/^export\s+class\s/gm, 'class ')
            .trim();
    }

    /**
     * Extract the main class name from code.
     */
    private extractClassName(code: string): string | null {
        const match = code.match(/class\s+(\w+)/);
        return match ? match[1] : null;
    }

    /**
     * Auto-generate a human-readable description from class name and code analysis.
     */
    private generateDescription(className: string, code: string, category: ExampleCategory): string {
        const words = this.splitPascalCase(className);
        const traits: string[] = [];

        if (category === 'creature') {
            if (code.includes('gravity') && (code.includes('gravity = 0') || code.includes('gravity=0'))) traits.push('flying');
            if (code.includes('isHostile') && code.includes('true')) traits.push('hostile');
            if (code.includes('canHop') && code.includes('true')) traits.push('hopping');
            if (code.includes('fleeOnProximity')) traits.push('passive/shy');
            if (code.includes('PointLight') || code.includes('emissive')) traits.push('glowing');
            if (code.includes('fire') || code.includes('Fire')) traits.push('fire-themed');
            if (code.includes('water') || code.includes('swim')) traits.push('aquatic');
            return `A ${traits.length > 0 ? traits.join(', ') + ' ' : ''}creature: ${words.join(' ')}`;
        }

        if (category === 'item') {
            if (code.includes('extends WandItem')) traits.push('wand/projectile');
            else if (code.includes('maxStack') && code.match(/maxStack\s*=\s*(?:16|32|64)/)) traits.push('consumable');
            else traits.push('tool');
            if (code.includes('onPrimaryDown')) traits.push('melee');
            if (code.includes('SpotLight') || code.includes('PointLight')) traits.push('light-emitting');
            return `A ${traits.join(', ')} item: ${words.join(' ')}`;
        }

        return `A structure: ${words.join(' ')}`;
    }

    /**
     * Auto-generate search keywords from class name and code analysis.
     */
    private generateKeywords(className: string, code: string, category: ExampleCategory): string[] {
        const words = this.splitPascalCase(className).map(w => w.toLowerCase());
        const kw = new Set(words);

        // Add category keyword
        kw.add(category);

        // Analyze code for behavioral keywords
        if (category === 'creature') {
            if (code.includes('gravity = 0') || code.includes('gravity=0')) kw.add('flying');
            if (code.includes('isHostile')) kw.add('hostile');
            if (code.includes('canHop')) kw.add('hopping');
            if (code.includes('fleeOnProximity')) kw.add('passive');
            if (code.includes('swim')) kw.add('swimming');
            if (code.includes('fire') || code.includes('Fire')) kw.add('fire');
            if (code.includes('tail')) kw.add('tail');
            if (code.includes('wing')) kw.add('wings');
            kw.add('animal');
            kw.add('creature');
            kw.add('mob');
        }

        if (category === 'item') {
            if (code.includes('WandItem')) { kw.add('wand'); kw.add('projectile'); kw.add('shoot'); }
            if (code.includes('onPrimaryDown')) { kw.add('melee'); kw.add('weapon'); kw.add('attack'); }
            if (code.includes('heal') || code.includes('health')) { kw.add('heal'); kw.add('potion'); }
            if (code.includes('Light')) kw.add('light');
            if (code.includes('maxStack')) kw.add('stackable');
            kw.add('item');
            kw.add('tool');
        }

        return Array.from(kw);
    }

    /**
     * Split PascalCase into separate words.
     * "FireDragon" → ["Fire", "Dragon"]
     * "FlyingPigItem" → ["Flying", "Pig", "Item"]
     */
    private splitPascalCase(name: string): string[] {
        return name.replace(/([a-z])([A-Z])/g, '$1 $2')
                   .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
                   .split(' ')
                   .filter(w => w.length > 0);
    }
}

// ============================================================
// SINGLETON
// ============================================================

export const unifiedExampleIndex = new UnifiedExampleIndex();
