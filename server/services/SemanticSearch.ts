/**
 * SemanticSearch - Use embeddings to find similar templates/examples
 * Compares user prompts against knowledge base using vector similarity
 *
 * Uses OpenRouter API for embeddings (supporting various models)
 */

import { getAllKnowledge, KnowledgeEntry } from './KnowledgeService';
import * as fs from 'fs';
import * as path from 'path';

// Cache for embeddings to avoid recomputing
interface EmbeddingCache {
    [text: string]: number[];
}

let embeddingCache: EmbeddingCache = {};
const CACHE_FILE = path.join(process.cwd(), '.embedding_cache.json');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/embeddings';
const EXPECTED_EMBEDDING_DIM = 1024; // gte-large model dimension

// Load cache from disk
async function loadCache() {
    try {
        const data = await fs.promises.readFile(CACHE_FILE, 'utf8');
        const rawCache = JSON.parse(data);
        // Filter out embeddings with wrong dimensions (from old models)
        embeddingCache = {};
        let filtered = 0;
        for (const [key, value] of Object.entries(rawCache)) {
            const embedding = value as number[];
            if (embedding.length === EXPECTED_EMBEDDING_DIM) {
                embeddingCache[key] = embedding;
            } else {
                filtered++;
            }
        }
        console.log(`[SemanticSearch] Loaded ${Object.keys(embeddingCache).length} cached embeddings (filtered ${filtered} with wrong dimensions)`);
    } catch {
        embeddingCache = {};
    }
}

// Save cache to disk
async function saveCache() {
    try {
        await fs.promises.writeFile(CACHE_FILE, JSON.stringify(embeddingCache));
    } catch (e) {
        console.error('[SemanticSearch] Failed to save cache:', e);
    }
}

/**
 * Get embedding for a text string using OpenRouter
 */
async function getEmbedding(text: string): Promise<number[]> {
    // Check cache
    const cacheKey = text.toLowerCase().trim();
    if (embeddingCache[cacheKey]) {
        return embeddingCache[cacheKey];
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': process.env.OPENROUTER_REFERER || 'http://localhost:2567',
                'X-Title': 'Merlin SemanticSearch'
            },
            body: JSON.stringify({
                model: 'thenlper/gte-large',
                input: text
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter embedding error: ${response.status} - ${errorText}`);
        }

        const result = await response.json() as any;
        const embedding = result.data?.[0]?.embedding;

        if (!embedding) {
            throw new Error('No embedding in response');
        }

        // Cache it
        embeddingCache[cacheKey] = embedding;
        // Don't await save - do it async
        saveCache();

        return embedding;
    } catch (e: any) {
        console.error('[SemanticSearch] Embedding error:', e.message);
        throw e;
    }
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        console.warn(`[SemanticSearch] Dimension mismatch: ${a.length} vs ${b.length}`);
        return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface SemanticSearchResult {
    entry: KnowledgeEntry;
    similarity: number;
}

/**
 * Semantic search through knowledge base
 * Returns entries sorted by similarity to the query
 */
export async function semanticSearch(
    query: string,
    topK: number = 5,
    minSimilarity: number = 0.3
): Promise<SemanticSearchResult[]> {
    console.log(`[SemanticSearch] Query: "${query}"`);

    // Get all knowledge entries
    const allEntries = getAllKnowledge();
    console.log(`[SemanticSearch] Knowledge entries: ${allEntries.length}`);

    if (allEntries.length === 0) {
        console.log('[SemanticSearch] No knowledge entries found');
        return [];
    }

    // Get query embedding
    console.log('[SemanticSearch] Getting query embedding...');
    const queryEmbedding = await getEmbedding(query);
    console.log(`[SemanticSearch] Got query embedding, dimension: ${queryEmbedding.length}`);

    // Score each entry
    const scored: SemanticSearchResult[] = [];

    for (const entry of allEntries) {
        // Create searchable text from entry
        const searchText = `${entry.title} ${entry.tags?.join(' ') || ''} ${entry.content.substring(0, 500)}`;

        try {
            const entryEmbedding = await getEmbedding(searchText);
            const similarity = cosineSimilarity(queryEmbedding, entryEmbedding);

            if (similarity >= minSimilarity) {
                scored.push({ entry, similarity });
            }
        } catch (e) {
            // Skip entries that fail embedding
            console.warn(`[SemanticSearch] Failed to embed entry: ${entry.title}`);
        }
    }

    // Sort by similarity descending
    scored.sort((a, b) => b.similarity - a.similarity);

    // Return top K
    const results = scored.slice(0, topK);

    console.log(`[SemanticSearch] Found ${results.length} matches:`);
    results.forEach((r, i) => {
        console.log(`  [${i + 1}] ${r.entry.title} (${(r.similarity * 100).toFixed(1)}%)`);
    });

    return results;
}

/**
 * Check if prompt looks like a creation request
 */
export function isCreationRequest(prompt: string): boolean {
    const lower = prompt.toLowerCase();
    const creationVerbs = [
        'create', 'make', 'spawn', 'summon', 'conjure', 'generate',
        'build', 'craft', 'design', 'give me', 'i want', 'can you make'
    ];

    return creationVerbs.some(verb => lower.includes(verb));
}

/**
 * Format templates for injection into LLM context
 */
export function formatTemplatesForInjection(results: SemanticSearchResult[]): string {
    if (results.length === 0) return '';

    let formatted = '\n\n=== RELEVANT TEMPLATES (USE THESE PATTERNS) ===\n';

    for (const r of results) {
        formatted += `\n--- ${r.entry.title} (${(r.similarity * 100).toFixed(0)}% match) ---\n`;
        formatted += r.entry.content;
        formatted += '\n';
    }

    formatted += '\n=== END TEMPLATES ===\n';
    formatted += 'IMPORTANT: Use the patterns above when generating code.\n';

    return formatted;
}

// Initialize cache on module load
loadCache();
