/**
 * Test API endpoints for Merlin AI system
 *
 * These endpoints communicate with the test harness browser via WebSocket:
 * - POST /api/test/creature - Create a creature and return result
 * - POST /api/test/item - Create an item and return result
 * - POST /api/test/structure - Build a structure and return result
 * - GET /api/test/report - Get test report from browser
 * - POST /api/test/reset - Reset test state in browser
 */

import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';

const router = Router();

// Track pending test requests (waiting for browser response)
const pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
}>();

// Store io instance (set by initTestRoutes)
let ioInstance: SocketIOServer | null = null;

// Initialize test routes with Socket.IO instance
export function initTestRoutes(io: SocketIOServer) {
    ioInstance = io;

    // Handle test responses from browser
    io.on('connection', (socket) => {
        socket.on('test:response', (response: any) => {
            const { requestId, success, result, error } = response;

            console.log(`[TestAPI] Received test response for ${requestId}:`, success ? '✅' : '❌');

            const pending = pendingRequests.get(requestId);
            if (pending) {
                clearTimeout(pending.timeout);
                pendingRequests.delete(requestId);

                if (success) {
                    pending.resolve(result);
                } else {
                    pending.reject(new Error(error || 'Test failed'));
                }
            }
        });

        // Handle test events from TestBridge (entity spawns, AI events, etc.)
        socket.on('test:event', (event: any) => {
            console.log(`[TestAPI] Test event:`, event.type, event);
            // These events are forwarded back to the test harness via test:response
            // They're handled by TestBridge on the client side
        });

        socket.on('test:ai_event', (event: any) => {
            console.log(`[TestAPI] AI event:`, event.type);
        });
    });

    console.log('[TestAPI] Initialized with Socket.IO');
}

// Helper: Send test command to browser and wait for response
function sendTestCommand(command: string, data: any, timeoutMs = 20000): Promise<any> {
    if (!ioInstance) {
        return Promise.reject(new Error('Socket.IO not initialized - is test harness browser open?'));
    }

    return new Promise((resolve, reject) => {
        const requestId = `test-${Date.now()}-${Math.random()}`;

        // Set timeout
        const timeout = setTimeout(() => {
            pendingRequests.delete(requestId);
            reject(new Error('Test timeout - browser did not respond. Is test harness page open?'));
        }, timeoutMs);

        // Store promise handlers
        pendingRequests.set(requestId, { resolve, reject, timeout });

        // Send command to all connected test harness clients
        // NOTE: Need to emit to ALL clients, not just server
        const clientCount = ioInstance!.sockets.sockets.size;
        console.log(`[TestAPI] Sending test command to ${clientCount} connected clients...`);

        ioInstance!.emit('test:command', {
            requestId,
            command,
            data
        });

        console.log(`[TestAPI] Sent test command: ${command} (requestId: ${requestId})`);
    });
}

/**
 * POST /api/test/creature
 * Create a creature via Merlin AI
 *
 * Body: { "prompt": "create a pink flying pig" }
 * Response: { success, creature: { name, position }, duration }
 */
router.post('/creature', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt' });
    }

    console.log(`[TestAPI] Creating creature with prompt: "${prompt}"`);

    const startTime = Date.now();

    try {
        const result = await sendTestCommand('createCreature', { prompt });
        const duration = Date.now() - startTime;

        console.log(`[TestAPI] ✅ Creature created in ${duration}ms`);

        res.json({
            success: true,
            ...result,
            duration
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[TestAPI] ❌ Failed to create creature:`, error);

        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration
        });
    }
});

/**
 * POST /api/test/item
 * Create an item via Merlin AI
 */
router.post('/item', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt' });
    }

    console.log(`[TestAPI] Creating item with prompt: "${prompt}"`);

    const startTime = Date.now();

    try {
        const result = await sendTestCommand('createItem', { prompt });
        const duration = Date.now() - startTime;

        console.log(`[TestAPI] ✅ Item created in ${duration}ms`);

        res.json({
            success: true,
            ...result,
            duration
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[TestAPI] ❌ Failed to create item:`, error);

        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration
        });
    }
});

/**
 * POST /api/test/structure
 * Build a structure via Merlin AI
 */
router.post('/structure', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt' });
    }

    console.log(`[TestAPI] Building structure with prompt: "${prompt}"`);

    const startTime = Date.now();

    try {
        const result = await sendTestCommand('createStructure', { prompt });
        const duration = Date.now() - startTime;

        console.log(`[TestAPI] ✅ Structure built in ${duration}ms`);

        res.json({
            success: true,
            ...result,
            duration
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[TestAPI] ❌ Failed to build structure:`, error);

        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration
        });
    }
});

/**
 * GET /api/test/report
 * Get test report from browser
 */
router.get('/report', async (req, res) => {
    console.log(`[TestAPI] Requesting test report`);

    try {
        const result = await sendTestCommand('getReport', {}, 5000);

        res.json({
            success: true,
            report: result
        });

    } catch (error) {
        console.error(`[TestAPI] ❌ Failed to get report:`, error);

        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * POST /api/test/reset
 * Reset test state in browser
 */
router.post('/reset', async (req, res) => {
    console.log(`[TestAPI] Resetting test state`);

    try {
        const result = await sendTestCommand('reset', {}, 5000);

        res.json({
            success: true,
            message: 'Test state reset'
        });

    } catch (error) {
        console.error(`[TestAPI] ❌ Failed to reset:`, error);

        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * POST /api/test/semantic-search
 * Test semantic search for few-shot examples
 */
router.post('/semantic-search', async (req, res) => {
    const { query, category = 'creature', count = 2 } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Missing query' });
    }

    console.log(`[TestAPI] Semantic search: "${query}" in ${category}`);

    try {
        // Import the search functions dynamically
        const { findBestCreatureExamples } = await import('../ai/examples/creatures.js');
        const { findBestItemExamples } = await import('../ai/examples/items.js');
        const { findBestStructureExamples } = await import('../ai/examples/structures.js');

        let examples: any[] = [];

        switch (category) {
            case 'creature':
                examples = await findBestCreatureExamples(query, count);
                break;
            case 'item':
                examples = await findBestItemExamples(query, count);
                break;
            case 'structure':
                examples = await findBestStructureExamples(query, count);
                break;
            default:
                return res.status(400).json({ error: `Unknown category: ${category}` });
        }

        res.json({
            success: true,
            query,
            category,
            count: examples.length,
            examples: examples.map(ex => ({
                name: ex.name,
                description: ex.description,
                keywords: ex.keywords
            }))
        });

    } catch (error) {
        console.error(`[TestAPI] Semantic search error:`, error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * GET /api/test/health
 * Check if test harness browser is connected
 */
router.get('/health', (req, res) => {
    const isConnected = ioInstance !== null;
    const connectedClients = isConnected ? ioInstance!.sockets.sockets.size : 0;

    res.json({
        testHarnessReady: isConnected && connectedClients > 0,
        connectedClients,
        socketIOInitialized: isConnected
    });
});

export { router as testRoutes };
