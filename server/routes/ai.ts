/**
 * AI Routes - Endpoints for testing AI features
 */

import express from 'express';
import { ragLookup, classifyTask, summarizeRAGResult } from '../services/RAGTemplateService';
import { getAllKnowledge, deleteAllKnowledge } from '../services/KnowledgeService';
import { getItem, getAllItems, saveItem } from '../services/DynamicItemService';
import { FewShotAI, availableModels } from '../ai/few_shot_system';
import { unifiedExampleIndex } from '../ai/examples/UnifiedExampleIndex';
import { FewShotSession } from '../services/FewShotSession';
// Genesis system is on separate branch
// import { generateScript } from '../services/GenesisService';

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
aiRoutes.post('/fewshot/examples', async (req, res) => {
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

        examples = await unifiedExampleIndex.search(prompt, {
            category: usedCategory as 'creature' | 'item' | 'structure',
            topK: 3
        });

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

/**
 * Save a custom item directly
 * POST /api/ai/items/save
 * Body: { name: string, code: string, icon: string, description?: string, worldId?: string }
 */
aiRoutes.post('/items/save', async (req, res) => {
    try {
        const { name, code, icon, description, worldId } = req.body;
        if (!name || !code || !icon) {
            return res.status(400).json({ error: 'Missing required fields: name, code, icon' });
        }
        const result = await saveItem({ name, code, icon, description }, worldId || 'global');
        res.json(result);
    } catch (error: any) {
        console.error('[AI Routes] Save item error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// CHAT ENDPOINT (SSE Streaming)
// ============================================================

/**
 * Session store for chat endpoint persistence
 */
const chatSessions = new Map<string, { ai: FewShotAI; history: Array<{ role: 'user' | 'assistant'; content: string }>; lastActivity: number }>();
const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

// Clean up expired sessions periodically
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of chatSessions) {
        if (now - session.lastActivity > SESSION_EXPIRY_MS) {
            chatSessions.delete(id);
            console.log(`[AI Chat] Session ${id} expired`);
        }
    }
}, 60000);

/**
 * Chat with Merlin AI via HTTP
 * POST /api/ai/chat
 * Body: { message: string, sessionId?: string, context?: object, model?: string }
 * Query: ?stream=false for non-streaming JSON response
 *
 * Streaming response: text/event-stream with SSE events
 * Non-streaming: JSON { content, type, code?, usage }
 */
aiRoutes.post('/chat', async (req, res) => {
    try {
        const { message, sessionId, context, model } = req.body;
        const streamParam = req.query.stream;
        const useStreaming = streamParam !== 'false';

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid message' });
        }

        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
        }

        // Get or create session
        const sid = sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        let session = chatSessions.get(sid);

        if (!session) {
            const ai = new FewShotAI({
                apiKey,
                model: model || process.env.FEWSHOT_MODEL || 'anthropic/claude-opus-4.6',
                siteUrl: 'http://localhost:5173',
                siteName: 'VoxelWorld'
            });
            session = { ai, history: [], lastActivity: Date.now() };
            chatSessions.set(sid, session);
            console.log(`[AI Chat] New session: ${sid}`);
        } else {
            session.lastActivity = Date.now();
            if (model) {
                session.ai.setModel(model);
            }
        }

        // Add user message to history
        session.history.push({ role: 'user', content: message });

        console.log(`[AI Chat] Session ${sid}: "${message.substring(0, 60)}..." (history: ${session.history.length})`);

        if (useStreaming) {
            // SSE streaming response
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Session-Id': sid
            });

            const onToken = (text: string) => {
                res.write(`event: token\ndata: ${JSON.stringify({ text })}\n\n`);
            };

            const result = await session.ai.processRequest(message, {
                playerPosition: context?.position || { x: 0, y: 64, z: 0 },
                conversationHistory: session.history.slice(-10)
            }, 'custom', onToken);

            // Send code if present
            if (result.code) {
                res.write(`event: code\ndata: ${JSON.stringify({ code: result.code, language: 'javascript' })}\n\n`);
            }

            // Send result type info
            if (result.type !== 'chat' && result.type !== 'error') {
                res.write(`event: action\ndata: ${JSON.stringify({ action: result.type, name: result.data?.className || 'Unknown' })}\n\n`);
            }

            // Send done with cost info
            res.write(`event: done\ndata: ${JSON.stringify({
                sessionId: sid,
                type: result.type,
                success: result.success,
                cost: result.usage ? {
                    promptTokens: result.usage.promptTokens,
                    completionTokens: result.usage.completionTokens,
                    totalTokens: result.usage.totalTokens
                } : null
            })}\n\n`);

            // Add assistant response to history
            session.history.push({ role: 'assistant', content: result.message || result.data?.className || 'Done' });

            res.end();
        } else {
            // Non-streaming JSON response
            const result = await session.ai.processRequest(message, {
                playerPosition: context?.position || { x: 0, y: 64, z: 0 },
                conversationHistory: session.history.slice(-10)
            }, 'custom');

            session.history.push({ role: 'assistant', content: result.message || result.data?.className || 'Done' });

            res.json({
                sessionId: sid,
                success: result.success,
                type: result.type,
                message: result.message,
                code: result.code,
                data: result.data,
                usage: result.usage,
                error: result.error
            });
        }
    } catch (error: any) {
        console.error('[AI Chat] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Genesis: Generate dynamic script
 * POST /api/ai/genesis/generate
 * Body: { prompt: string }
 *
 * NOTE: Genesis system is on a separate branch (genesis-system)
 * This endpoint is disabled on the few-shot branch
 */
aiRoutes.post('/genesis/generate', async (req, res) => {
    res.status(501).json({
        error: 'Genesis system not available on this branch',
        message: 'Switch to genesis-system branch to use Genesis features'
    });
});

// ============================================================
// VERIFICATION ENDPOINTS
// ============================================================

/**
 * Helper: get a connected game client session
 */
function getGameSession(): FewShotSession | null {
    const session = FewShotSession.getAnySession();
    if (!session) return null;
    return session;
}

/**
 * List all active game sessions
 * GET /api/ai/verify/sessions
 */
aiRoutes.get('/verify/sessions', (req, res) => {
    const sessions = FewShotSession.getAllSessions();
    res.json({
        count: sessions.length,
        hasConnectedClient: sessions.length > 0
    });
});

/**
 * Get all entities in the game world
 * GET /api/ai/verify/entities
 * Query: ?type=Dragon&maxDistance=50
 */
aiRoutes.get('/verify/entities', async (req, res) => {
    const session = getGameSession();
    if (!session) {
        return res.status(503).json({ error: 'No game client connected. Open the game in a browser first.' });
    }

    try {
        const result = await session.requestVerification('entities', {
            type: req.query.type as string,
            maxDistance: req.query.maxDistance ? parseFloat(req.query.maxDistance as string) : undefined
        });

        if (result.error) {
            return res.status(500).json({ error: result.error });
        }

        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * Check if a specific entity exists and is visible
 * GET /api/ai/verify/entity/:name
 */
aiRoutes.get('/verify/entity/:name', async (req, res) => {
    const session = getGameSession();
    if (!session) {
        return res.status(503).json({ error: 'No game client connected. Open the game in a browser first.' });
    }

    try {
        const result = await session.requestVerification('entity', {
            name: req.params.name
        });

        if (result.error) {
            return res.status(500).json({ error: result.error });
        }

        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * Get player state (position, direction, inventory)
 * GET /api/ai/verify/player
 */
aiRoutes.get('/verify/player', async (req, res) => {
    const session = getGameSession();
    if (!session) {
        return res.status(503).json({ error: 'No game client connected. Open the game in a browser first.' });
    }

    try {
        const result = await session.requestVerification('player');

        if (result.error) {
            return res.status(500).json({ error: result.error });
        }

        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * Check blocks at a position
 * GET /api/ai/verify/blocks?x=10&y=64&z=20&radius=2
 */
aiRoutes.get('/verify/blocks', async (req, res) => {
    const session = getGameSession();
    if (!session) {
        return res.status(503).json({ error: 'No game client connected. Open the game in a browser first.' });
    }

    const x = parseFloat(req.query.x as string);
    const y = parseFloat(req.query.y as string);
    const z = parseFloat(req.query.z as string);

    if (isNaN(x) || isNaN(y) || isNaN(z)) {
        return res.status(400).json({ error: 'Missing or invalid x, y, z query parameters' });
    }

    try {
        const result = await session.requestVerification('blocks', {
            x, y, z,
            radius: req.query.radius ? parseInt(req.query.radius as string) : 1
        });

        if (result.error) {
            return res.status(500).json({ error: result.error });
        }

        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * Capture a screenshot from the game
 * GET /api/ai/verify/screenshot
 * Returns PNG image (or JSON with base64 if ?format=json)
 */
aiRoutes.get('/verify/screenshot', async (req, res) => {
    const session = getGameSession();
    if (!session) {
        return res.status(503).json({ error: 'No game client connected. Open the game in a browser first.' });
    }

    try {
        const result = await session.requestVerification('screenshot');

        if (result.error) {
            return res.status(500).json({ error: result.error });
        }

        if (req.query.format === 'json') {
            return res.json({ success: true, width: result.width, height: result.height, dataUrl: result.dataUrl });
        }

        // Return as actual PNG image
        const base64Data = result.dataUrl.replace(/^data:image\/png;base64,/, '');
        const imgBuffer = Buffer.from(base64Data, 'base64');
        res.set('Content-Type', 'image/png');
        res.set('Content-Length', String(imgBuffer.length));
        res.send(imgBuffer);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});
