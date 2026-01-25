/**
 * RAGTemplateService - Retrieval Augmented Generation for task-specific templates
 *
 * Uses semantic search to find relevant templates from the knowledge base.
 *
 * Task Types:
 * - creature: Creating new animals/monsters
 * - item: Creating new items/wands/weapons
 * - build: Building structures with blocks
 * - spawn: Spawning existing entities
 * - modify: Modifying existing entities
 */

import { semanticSearch } from './SemanticSearch';

export interface TaskClassification {
    taskType: 'creature' | 'item' | 'build' | 'spawn' | 'modify' | 'conversation' | 'unknown';
    subType?: string;  // e.g., 'flying', 'quadruped', 'wand', 'weapon'
    confidence: number;
}

export interface RAGResult {
    classification: TaskClassification;
    templates: Array<{
        title: string;
        content: string;
        relevance: number;
        source: 'semantic';
    }>;
    contextInjection: string;  // Formatted string to inject into prompt
}

/**
 * Classify a task based on the user's input
 */
export function classifyTask(input: string): TaskClassification {
    const lower = input.toLowerCase();

    // Check for conversation (no action needed)
    const conversationPatterns = [
        /^(hi|hello|hey|greetings)/,
        /^what (can you|do you)/,
        /^who are you/,
        /^help$/,
        /^thanks/,
        /how (are|do) you/
    ];

    if (conversationPatterns.some(p => p.test(lower))) {
        return { taskType: 'conversation', confidence: 0.9 };
    }

    // Check for spawn existing creature
    const spawnPatterns = [
        /spawn (?:a |an |some |(\d+) )?(pig|cow|chicken|wolf|zombie|skeleton|sheep|horse|bat|bird)/i,
        /summon (?:a |an |some |(\d+) )?(pig|cow|chicken|wolf|zombie|skeleton|sheep|horse|bat|bird)/i
    ];

    for (const pattern of spawnPatterns) {
        const match = lower.match(pattern);
        if (match) {
            return {
                taskType: 'spawn',
                subType: match[2] || match[1],
                confidence: 0.95
            };
        }
    }

    // Check for modify existing entity
    const modifyPatterns = [
        /make (it|them|that) (bigger|smaller|red|blue|green|faster|slower)/,
        /change (the |its )?(color|size|scale|speed)/,
        /update (the |its )?/,
        /modify /
    ];

    if (modifyPatterns.some(p => p.test(lower))) {
        return {
            taskType: 'modify',
            confidence: 0.85
        };
    }

    // Check for build structure
    const buildPatterns = [
        /build (a |an |the )?/,
        /construct (a |an |the )?/,
        /create (a |an |the )?(tower|house|wall|platform|bridge|pyramid|castle)/
    ];

    if (buildPatterns.some(p => p.test(lower))) {
        return {
            taskType: 'build',
            confidence: 0.85
        };
    }

    // Check for create item - must check BEFORE creature patterns
    const itemKeywords = ['wand', 'staff', 'sword', 'bow', 'weapon', 'item', 'potion', 'tool', 'boots', 'helmet', 'armor', 'crossbow', 'dagger', 'shield', 'axe', 'hammer', 'knife'];
    const hasItemKeyword = itemKeywords.some(kw => lower.includes(kw));
    const hasCreationVerb = /(create|make|give|craft|forge)/.test(lower);

    if (hasItemKeyword && hasCreationVerb) {
        let subType = 'unknown';
        if (/wand|staff|magic/.test(lower)) subType = 'wand';
        else if (/sword|blade|hammer|axe/.test(lower)) subType = 'melee';
        else if (/bow|crossbow|gun/.test(lower)) subType = 'ranged';

        return {
            taskType: 'item',
            subType,
            confidence: 0.9
        };
    }

    // Check for create creature (default for "make/create X" that's not an item)
    const creaturePatterns = [
        /(create|make|spawn|summon) (a |an )?\w+/,
        /\b(dragon|slime|golem|fairy|unicorn|phoenix|griffin|robot)\b/
    ];

    if (creaturePatterns.some(p => p.test(lower))) {
        let subType = 'quadruped';
        if (/fly|flying|bird|bat|fairy|dragon|butterfly|wings/.test(lower)) subType = 'flying';
        else if (/spin|spinning|rotate|rotating|cube|sphere/.test(lower)) subType = 'spinning';
        else if (/hostile|monster|attack|enemy|aggressive/.test(lower)) subType = 'hostile';

        return {
            taskType: 'creature',
            subType,
            confidence: 0.8
        };
    }

    return {
        taskType: 'unknown',
        confidence: 0.5
    };
}

/**
 * Main RAG lookup function - uses semantic search only
 */
export async function ragLookup(input: string): Promise<RAGResult> {
    console.log(`[RAG] Processing: "${input.substring(0, 100)}..."`);

    // Step 1: Classify the task
    const classification = classifyTask(input);
    console.log(`[RAG] Classification: ${classification.taskType} (${classification.subType || 'none'}) - confidence: ${classification.confidence}`);

    // Skip RAG for conversations
    if (classification.taskType === 'conversation') {
        return {
            classification,
            templates: [],
            contextInjection: ''
        };
    }

    // Step 2: Semantic search for relevant templates
    const templates: RAGResult['templates'] = [];

    try {
        // Build a search query that includes task context
        const searchQuery = classification.subType
            ? `${input} ${classification.taskType} ${classification.subType}`
            : input;

        console.log(`[RAG] Semantic search query: "${searchQuery.substring(0, 80)}..."`);

        const semanticResults = await semanticSearch(searchQuery, 4, 0.3);
        console.log(`[RAG] Semantic search returned ${semanticResults.length} results`);

        // Deduplicate by title, keeping the version with most content
        const seenTitles = new Map<string, { content: string; relevance: number }>();
        for (const result of semanticResults) {
            const existing = seenTitles.get(result.entry.title);
            if (!existing || result.entry.content.length > existing.content.length) {
                seenTitles.set(result.entry.title, {
                    content: result.entry.content,
                    relevance: result.similarity
                });
            }
        }

        for (const [title, data] of seenTitles) {
            templates.push({
                title,
                content: data.content,
                relevance: data.relevance,
                source: 'semantic'
            });
        }

        // Sort by relevance descending
        templates.sort((a, b) => b.relevance - a.relevance);
    } catch (e: any) {
        console.error('[RAG] Semantic search failed:', e.message);
        console.error('[RAG] Full error:', e.stack);
    }

    console.log(`[RAG] Found ${templates.length} templates`);
    templates.forEach((t, i) => {
        console.log(`  [${i + 1}] ${t.title} (${(t.relevance * 100).toFixed(0)}%)`);
    });

    // Step 3: Format context injection
    const contextInjection = formatContextInjection(classification, templates);

    return {
        classification,
        templates,
        contextInjection
    };
}

/**
 * Format templates into a context string for injection
 */
function formatContextInjection(
    classification: TaskClassification,
    templates: RAGResult['templates']
): string {
    if (templates.length === 0) {
        return '';
    }

    let injection = '\n\n<!-- RAG CONTEXT - RELEVANT TEMPLATES -->\n';
    injection += `Task Type: ${classification.taskType}`;
    if (classification.subType) {
        injection += ` (${classification.subType})`;
    }
    injection += '\n\n';

    for (const template of templates) {
        injection += `### ${template.title}\n`;
        injection += `Relevance: ${(template.relevance * 100).toFixed(0)}%\n`;
        injection += template.content.trim();
        injection += '\n\n---\n\n';
    }

    injection += 'Use the patterns above when generating code for this task.\n';
    injection += '<!-- END RAG CONTEXT -->\n';

    return injection;
}

/**
 * Get a summary of the RAG result for logging/debugging
 */
export function summarizeRAGResult(result: RAGResult): string {
    const lines = [
        `Task: ${result.classification.taskType} (${result.classification.subType || 'generic'})`,
        `Confidence: ${(result.classification.confidence * 100).toFixed(0)}%`,
        `Templates found: ${result.templates.length}`,
        ...result.templates.map((t, i) => `  ${i + 1}. ${t.title} (${(t.relevance * 100).toFixed(0)}%)`)
    ];
    return lines.join('\n');
}
