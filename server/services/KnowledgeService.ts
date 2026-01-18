/**
 * KnowledgeService - Manages Merlin's self-learning knowledge base
 * 
 * Handles:
 * 1. Storing knowledge entries (templates, gotchas, how-tos, errors)
 * 2. Searching knowledge by query and category
 * 3. Auto-learning from code generation failures
 */

import { db } from '../config';

export interface KnowledgeEntry {
    id?: string;
    category: 'template' | 'gotcha' | 'howto' | 'error' | 'example';
    title: string;
    content: string;
    tags?: string[];
    createdAt: number;
    useCount?: number;  // Track how often this knowledge is retrieved
}

// In-memory cache for fast search
const knowledgeCache = new Map<string, KnowledgeEntry>();

/**
 * Initialize the knowledge service - load from Firebase
 */
export async function initKnowledgeService(): Promise<void> {
    if (!db) {
        console.warn('[KnowledgeService] No database available, using in-memory only');
        return;
    }

    try {
        const snapshot = await db.collection('knowledge').get();
        snapshot.forEach(doc => {
            const entry = { id: doc.id, ...doc.data() } as KnowledgeEntry;
            knowledgeCache.set(doc.id, entry);
        });
        console.log(`[KnowledgeService] Loaded ${knowledgeCache.size} knowledge entries`);
    } catch (e) {
        console.error('[KnowledgeService] Failed to load knowledge:', e);
    }
}

/**
 * Search knowledge by query string and optional category
 */
export function searchKnowledge(query: string, category?: string): KnowledgeEntry[] {
    const queryLower = query.toLowerCase();
    // Split query into individual words for better matching
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    const results: KnowledgeEntry[] = [];

    for (const entry of knowledgeCache.values()) {
        // Category filter
        if (category && entry.category !== category) continue;

        // Match if full query OR any query word matches
        const titleMatch = entry.title.toLowerCase().includes(queryLower) ||
            queryWords.some(word => entry.title.toLowerCase().includes(word));
        const contentMatch = entry.content.toLowerCase().includes(queryLower) ||
            queryWords.some(word => entry.content.toLowerCase().includes(word));
        // Check if any tag matches any query word
        const tagMatch = entry.tags?.some(tag =>
            queryWords.some(word => tag.toLowerCase().includes(word) || word.includes(tag.toLowerCase()))
        );

        if (titleMatch || contentMatch || tagMatch) {
            results.push(entry);
        }
    }

    // Sort by relevance (title matches first, then by use count)
    results.sort((a, b) => {
        const aTitleMatch = a.title.toLowerCase().includes(queryLower) ? 1 : 0;
        const bTitleMatch = b.title.toLowerCase().includes(queryLower) ? 1 : 0;
        if (aTitleMatch !== bTitleMatch) return bTitleMatch - aTitleMatch;
        return (b.useCount || 0) - (a.useCount || 0);
    });

    return results.slice(0, 5); // Return top 5 results
}

/**
 * Add a new knowledge entry
 */
export async function addKnowledge(entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'useCount'>): Promise<{ success: boolean; id?: string; error?: string }> {
    // Validate
    if (!entry.title || !entry.content) {
        return { success: false, error: 'Title and content are required' };
    }

    if (!['template', 'gotcha', 'howto', 'error'].includes(entry.category)) {
        return { success: false, error: 'Invalid category' };
    }

    const fullEntry: KnowledgeEntry = {
        ...entry,
        createdAt: Date.now(),
        useCount: 0
    };

    try {
        if (db) {
            const docRef = await db.collection('knowledge').add(fullEntry);
            fullEntry.id = docRef.id;
            knowledgeCache.set(docRef.id, fullEntry);
            console.log(`[KnowledgeService] Added knowledge: ${entry.title} (${docRef.id})`);
            return { success: true, id: docRef.id };
        } else {
            // In-memory only fallback
            const id = `local_${Date.now()}`;
            fullEntry.id = id;
            knowledgeCache.set(id, fullEntry);
            return { success: true, id };
        }
    } catch (e: any) {
        console.error('[KnowledgeService] Failed to add knowledge:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Get knowledge by ID
 */
export function getKnowledgeById(id: string): KnowledgeEntry | undefined {
    return knowledgeCache.get(id);
}

/**
 * Increment use count for a knowledge entry (for ranking)
 */
export async function incrementUseCount(id: string): Promise<void> {
    const entry = knowledgeCache.get(id);
    if (entry) {
        entry.useCount = (entry.useCount || 0) + 1;
        if (db) {
            try {
                await db.collection('knowledge').doc(id).update({ useCount: entry.useCount });
            } catch (e) {
                console.error('[KnowledgeService] Failed to update use count:', e);
            }
        }
    }
}

/**
 * Get all knowledge entries (for debugging/admin)
 */
export function getAllKnowledge(): KnowledgeEntry[] {
    return Array.from(knowledgeCache.values());
}

/**
 * Clear all knowledge (for testing)
 */
export function clearKnowledgeCache(): void {
    knowledgeCache.clear();
}
