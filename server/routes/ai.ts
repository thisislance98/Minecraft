/**
 * AI Routes - Endpoints for testing AI features
 */

import express from 'express';
import { ragLookup, classifyTask, summarizeRAGResult } from '../services/RAGTemplateService';
import { getAllKnowledge, deleteAllKnowledge } from '../services/KnowledgeService';
import { getItem, getAllItems } from '../services/DynamicItemService';
import { FewShotAI, availableModels } from '../ai/few_shot_system';
import { findBestCreatureExamples } from '../ai/examples/creatures';
import { findBestItemExamples } from '../ai/examples/items';
import { findBestStructureExamples } from '../ai/examples/structures';

export const aiRoutes = express.Router();

/**
 * Test RAG template lookup (semantic search only)
 * POST /api/ai/rag
 * Body: { prompt: string }
 */
aiRoutes.post('/rag', async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid prompt' });
        }

        console.log(`[AI Routes] RAG lookup for: "${prompt.substring(0, 50)}..."`);

        const result = await ragLookup(prompt);

        res.json({
            success: true,
            classification: result.classification,
            templates: result.templates.map(t => ({
                title: t.title,
                relevance: t.relevance,
                source: t.source,
                contentPreview: t.content.substring(0, 200) + (t.content.length > 200 ? '...' : '')
            })),
            contextInjectionLength: result.contextInjection.length,
            summary: summarizeRAGResult(result)
        });
    } catch (error: any) {
        console.error('[AI Routes] RAG error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Test task classification only (fast, no knowledge base lookup)
 * POST /api/ai/classify
 * Body: { prompt: string }
 */
aiRoutes.post('/classify', (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid prompt' });
        }

        const result = classifyTask(prompt);

        res.json({
            success: true,
            ...result
        });
    } catch (error: any) {
        console.error('[AI Routes] Classification error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Debug: Check knowledge cache status
 * GET /api/ai/debug/knowledge
 */
aiRoutes.get('/debug/knowledge', (req, res) => {
    const all = getAllKnowledge();
    res.json({
        totalEntries: all.length,
        entries: all.map(e => ({ title: e.title, category: e.category }))
    });
});

/**
 * Debug: Test semantic search directly
 * POST /api/ai/debug/semantic
 */
import { semanticSearch } from '../services/SemanticSearch';
aiRoutes.post('/debug/semantic', async (req, res) => {
    try {
        const { query, minSimilarity = 0.0, includeContent = false } = req.body;  // Default to 0 to see all results
        console.log(`[AI Debug] Testing semantic search: "${query}" (minSimilarity: ${minSimilarity})`);
        const results = await semanticSearch(query, 10, minSimilarity);
        res.json({
            success: true,
            query,
            resultsCount: results.length,
            results: results.map(r => ({
                title: r.entry.title,
                similarity: r.similarity,
                contentLength: r.entry.content.length,
                hasGetMesh: r.entry.content.includes('getMesh'),
                ...(includeContent ? { content: r.entry.content } : {})
            }))
        });
    } catch (error: any) {
        console.error('[AI Debug] Semantic search error:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

/**
 * Batch test classification for multiple prompts
 * POST /api/ai/classify/batch
 * Body: { prompts: string[] }
 */
aiRoutes.post('/classify/batch', (req, res) => {
    try {
        const { prompts } = req.body;

        if (!Array.isArray(prompts)) {
            return res.status(400).json({ error: 'prompts must be an array' });
        }

        const results = prompts.map(prompt => ({
            prompt,
            classification: classifyTask(prompt)
        }));

        res.json({
            success: true,
            count: results.length,
            results
        });
    } catch (error: any) {
        console.error('[AI Routes] Batch classification error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Delete all knowledge entries (for cleanup)
 * DELETE /api/ai/debug/knowledge
 */
aiRoutes.delete('/debug/knowledge', async (req, res) => {
    try {
        console.log('[AI Debug] Deleting all knowledge entries...');
        const result = await deleteAllKnowledge();
        res.json(result);
    } catch (error: any) {
        console.error('[AI Debug] Delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get item details including code
 * GET /api/ai/debug/item/:name
 */
aiRoutes.get('/debug/item/:name', (req, res) => {
    const { name } = req.params;
    const worldId = req.query.worldId as string || 'global';

    const item = getItem(name, worldId);
    if (!item) {
        return res.status(404).json({ error: `Item '${name}' not found` });
    }

    res.json({
        success: true,
        item: {
            name: item.name,
            code: item.code,
            icon: item.icon,
            description: item.description,
            hasGetMesh: item.code?.includes('getMesh'),
            hasOnUseDown: item.code?.includes('onUseDown'),
            codeLength: item.code?.length
        }
    });
});

/**
 * List all items
 * GET /api/ai/debug/items
 */
aiRoutes.get('/debug/items', (req, res) => {
    const worldId = req.query.worldId as string;
    const items = getAllItems(worldId);

    res.json({
        success: true,
        count: items.length,
        items: items.map(i => ({
            name: i.name,
            codeLength: i.code?.length,
            hasGetMesh: i.code?.includes('getMesh'),
            hasOnUseDown: i.code?.includes('onUseDown')
        }))
    });
});

// ============================================================
// FEW-SHOT AI ENDPOINTS
// ============================================================

/**
 * Get available models for few-shot AI
 * GET /api/ai/fewshot/models
 */
aiRoutes.get('/fewshot/models', (req, res) => {
    res.json({
        success: true,
        models: availableModels
    });
});

/**
 * Find best matching examples for a request
 * POST /api/ai/fewshot/examples
 * Body: { prompt: string, category?: 'creature' | 'item' | 'structure' }
 */
aiRoutes.post('/fewshot/examples', (req, res) => {
    try {
        const { prompt, category } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Missing prompt' });
        }

        let examples: any[] = [];
        let usedCategory = category;

        // Auto-detect category if not specified
        if (!category) {
            const lowerPrompt = prompt.toLowerCase();
            if (lowerPrompt.includes('creature') || lowerPrompt.includes('animal') || lowerPrompt.includes('monster') || lowerPrompt.includes('pet')) {
                usedCategory = 'creature';
            } else if (lowerPrompt.includes('item') || lowerPrompt.includes('wand') || lowerPrompt.includes('sword') || lowerPrompt.includes('potion') || lowerPrompt.includes('tool')) {
                usedCategory = 'item';
            } else if (lowerPrompt.includes('build') || lowerPrompt.includes('house') || lowerPrompt.includes('tower') || lowerPrompt.includes('structure')) {
                usedCategory = 'structure';
            } else {
                usedCategory = 'creature'; // Default
            }
        }

        switch (usedCategory) {
            case 'creature':
                examples = findBestCreatureExamples(prompt, 3);
                break;
            case 'item':
                examples = findBestItemExamples(prompt, 3);
                break;
            case 'structure':
                examples = findBestStructureExamples(prompt, 3);
                break;
        }

        res.json({
            success: true,
            category: usedCategory,
            prompt,
            examples: examples.map(ex => ({
                name: ex.name,
                description: ex.description,
                keywords: ex.keywords,
                codePreview: ex.code?.substring(0, 200) + '...'
            }))
        });
    } catch (error: any) {
        console.error('[AI Routes] FewShot examples error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Test few-shot AI generation (without WebSocket)
 * POST /api/ai/fewshot/test
 * Body: { prompt: string, model?: string }
 */
aiRoutes.post('/fewshot/test', async (req, res) => {
    try {
        const { prompt, model } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Missing prompt' });
        }

        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
        }

        const ai = new FewShotAI({
            apiKey,
            model: model || 'anthropic/claude-3-haiku',
            siteUrl: 'http://localhost:5173',
            siteName: 'VoxelWorld'
        });

        console.log(`[AI Routes] Testing few-shot with prompt: "${prompt.substring(0, 50)}..."`);

        const result = await ai.processRequest(prompt, {
            playerPosition: { x: 0, y: 64, z: 0 }
        });

        res.json({
            success: result.success,
            type: result.type,
            message: result.message,
            data: result.data,
            hasCode: !!result.code,
            codeLength: result.code?.length,
            hasIcon: !!result.icon,
            error: result.error
        });
    } catch (error: any) {
        console.error('[AI Routes] FewShot test error:', error);
        res.status(500).json({ error: error.message });
    }
});
