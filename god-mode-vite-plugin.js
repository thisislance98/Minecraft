import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tasks = new Map();
const spawnQueue = []; // Queue of spawn requests for client to poll
const chatTestQueue = []; // Queue of test prompts for client to process
const chatTestResponses = new Map(); // Responses from in-game chat
const evalQueue = []; // Queue of JS code to evaluate in client
const evalResults = new Map(); // Results of evaluations

// Initialize SDK
let genAI = null;
if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// Allowed paths for file writes (security)
const ALLOWED_WRITE_PATHS = ['src/'];

/**
 * Validate that a file path is safe to write to
 * Prevents path traversal attacks
 */
function validateFilePath(filePath) {
    // Normalize and resolve the path
    const normalizedPath = path.normalize(filePath);

    // Check for path traversal attempts
    if (normalizedPath.includes('..')) {
        throw new Error(`Path traversal detected: ${filePath}`);
    }

    // Check if path starts with an allowed prefix
    const isAllowed = ALLOWED_WRITE_PATHS.some(allowed => normalizedPath.startsWith(allowed));
    if (!isAllowed) {
        throw new Error(`Write not allowed to path: ${filePath}. Only ${ALLOWED_WRITE_PATHS.join(', ')} allowed.`);
    }

    // Additional safety: block sensitive files
    const blockedPatterns = ['.env', 'package.json', 'package-lock.json', '.git', 'node_modules'];
    for (const blocked of blockedPatterns) {
        if (normalizedPath.includes(blocked)) {
            throw new Error(`Cannot write to protected path: ${filePath}`);
        }
    }

    return true;
}

/**
 * Find relevant animal examples based on user request
 * Returns a list of file paths to include as context
 */
async function findRelevantExamples(userRequest) {
    try {
        const animalsDir = 'src/game/entities/animals';
        const files = await fs.readdir(path.join(process.cwd(), animalsDir));
        const animalFiles = files.filter(f => f.endsWith('.js'));

        // Simple keyword matching
        const requestLower = userRequest.toLowerCase();

        // specific matches (if user asks for "duck", give them "Duck.js" and maybe others)
        // We'll score files based on LCS or inclusion
        const scores = animalFiles.map(file => {
            const name = file.replace('.js', '').toLowerCase();
            let score = 0;
            if (requestLower.includes(name)) score += 10;
            // Bonus for partial matches
            if (requestLower.includes(name.substring(0, Math.max(3, name.length - 1)))) score += 2;
            return { file, score };
        });

        // Sort by score
        scores.sort((a, b) => b.score - a.score);

        // Take top 3 if they have a positive score
        const topMatches = scores.filter(s => s.score > 0).slice(0, 3).map(s => path.join(animalsDir, s.file));

        // If we found matches, return them
        if (topMatches.length > 0) {
            return topMatches;
        }

        // Fallback: Return Horse.js as the canonical example if nothing matches
        // Or specific complex examples if we want to be fancy, but Horse is safe.
        return [path.join(animalsDir, 'Horse.js')];

    } catch (e) {
        console.warn('[GodMode] Failed to find examples:', e);
        return ['src/game/entities/animals/Horse.js'];
    }
}

export default function GodModePlugin() {
    return {
        name: 'god-mode',
        configureServer(server) {
            // Configuration Endpoint
            server.middlewares.use('/api/god-mode/config', (req, res, next) => {
                res.end(JSON.stringify({
                    apiKey: process.env.GEMINI_API_KEY
                }));
            });

            // Task Status Endpoint
            server.middlewares.use('/api/god-mode/task', (req, res, next) => {
                const url = new URL(req.url, `http://${req.headers.host}`);
                const taskId = url.pathname.split('/').pop();

                if (req.method !== 'GET' || !taskId) return next();

                const task = tasks.get(taskId);
                if (!task) {
                    res.statusCode = 200;
                    return res.end(JSON.stringify({ status: 'not_found', error: 'Task not found' }));
                }

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(task));
            });

            // Cancel Task Endpoint
            server.middlewares.use('/api/god-mode/cancel', (req, res, next) => {
                if (req.method !== 'POST') return next();

                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    try {
                        const { taskId } = JSON.parse(body);
                        const task = tasks.get(taskId);
                        if (task) {
                            task.isCancelled = true;
                            tasks.set(taskId, task);
                            updateTaskLogs(taskId, '\n[SDK] 🛑 Cancellation requested by user.\n');
                            res.end(JSON.stringify({ success: true }));
                        } else {
                            res.statusCode = 404;
                            res.end(JSON.stringify({ error: 'Task not found' }));
                        }
                    } catch (e) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: e.message }));
                    }
                });
            });

            server.middlewares.use('/api/god-mode/chat', async (req, res, next) => {
                if (req.method !== 'POST') return next();

                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const { message, playerTransform } = JSON.parse(body);
                        console.log('[GodMode] Received request:', message);

                        const taskId = Date.now().toString();
                        tasks.set(taskId, { status: 'pending', taskId, logs: '', startTime: Date.now(), isCancelled: false });

                        if (!genAI) {
                            tasks.set(taskId, { status: 'failed', error: 'GEMINI_API_KEY not found in .env' });
                            return;
                        }

                        // Context Gathering - find relevant examples
                        const relevantExamples = await findRelevantExamples(message);
                        console.log('[GodMode] Selected examples:', relevantExamples);

                        const contextFiles = [
                            'src/game/Player.js',
                            'src/game/VoxelGame.jsx',
                            'src/game/entities/Animal.js',
                            ...relevantExamples,
                            'src/game/AnimalRegistry.js'  // Registry to append to
                        ];

                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ success: true, taskId }));

                        // Perform task in background using streaming SDK
                        executeTaskWithStreaming(taskId, message, contextFiles, playerTransform);

                    } catch (error) {
                        console.error('[GodMode] Error:', error);
                        res.statusCode = 500;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ success: false, error: error.message }));
                    }
                });
            });

            // Spawn Queue Endpoint - Client polls this to get creatures to spawn
            server.middlewares.use('/api/god-mode/spawns', (req, res, next) => {
                if (req.method === 'GET') {
                    // Return and clear the spawn queue
                    const spawns = [...spawnQueue];
                    spawnQueue.length = 0;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ spawns }));
                } else {
                    next();
                }
            });

            // ============================================
            // Chat Test Endpoints - For testing in-game AI via curl
            // ============================================

            // POST /api/chat-test - Send a test prompt to be processed by in-game AI
            server.middlewares.use('/api/chat-test', (req, res, next) => {
                // Only handle exact path matches (not /api/chat-test/poll etc)
                // req.originalUrl has the full path, req.url has the matched suffix
                const fullPath = (req.originalUrl || req.url).split('?')[0];
                if (fullPath !== '/api/chat-test') {
                    return next();
                }

                if (req.method === 'POST') {
                    let body = '';
                    req.on('data', chunk => body += chunk.toString());
                    req.on('end', () => {
                        try {
                            const { message } = JSON.parse(body);
                            const testId = Date.now().toString();

                            // Queue the prompt for the client to pick up
                            chatTestQueue.push({ testId, message, timestamp: Date.now() });

                            console.log(`[ChatTest] Queued prompt (${testId}): ${message}`);

                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({
                                success: true,
                                testId,
                                message: 'Prompt queued. Client will process it.'
                            }));
                        } catch (e) {
                            res.statusCode = 400;
                            res.end(JSON.stringify({ error: e.message }));
                        }
                    });
                } else if (req.method === 'GET') {
                    // GET /api/chat-test?testId=xxx - Get the response for a test
                    const url = new URL(req.url, 'http://localhost');
                    const testId = url.searchParams.get('testId');

                    if (testId && chatTestResponses.has(testId)) {
                        const response = chatTestResponses.get(testId);
                        chatTestResponses.delete(testId);
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ status: 'completed', ...response }));
                    } else {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ status: 'pending' }));
                    }
                } else {
                    next();
                }
            });

            // GET /api/chat-test/poll - Client polls for test prompts to process
            server.middlewares.use('/api/chat-test/poll', (req, res, next) => {
                if (req.method === 'GET') {
                    const prompt = chatTestQueue.shift();
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ prompt: prompt || null }));
                } else {
                    next();
                }
            });

            // POST /api/chat-test/response - Client reports back the AI response
            server.middlewares.use('/api/chat-test/response', (req, res, next) => {
                if (req.method === 'POST') {
                    let body = '';
                    req.on('data', chunk => body += chunk.toString());
                    req.on('end', () => {
                        try {
                            const { testId, aiResponse, toolsCalled, error } = JSON.parse(body);
                            chatTestResponses.set(testId, {
                                testId,
                                aiResponse,
                                toolsCalled,
                                error,
                                timestamp: Date.now()
                            });
                            console.log(`[ChatTest] Response received (${testId}):`, aiResponse?.substring(0, 100));
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ success: true }));
                        } catch (e) {
                            res.statusCode = 400;
                            res.end(JSON.stringify({ error: e.message }));
                        }
                    });
                } else {
                    next();
                }
            });

            // ============================================
            // Game State Inspection Endpoints (Eval)
            // ============================================

            // POST /api/test/eval - Queue code to be evaluated in client
            // GET /api/test/eval/poll - Client polls for code to run
            // POST /api/test/eval/result - Client reports result
            // GET /api/test/eval?evalId=... - Get result
            server.middlewares.use('/api/test/eval', (req, res, next) => {
                const fullPath = (req.originalUrl || req.url).split('?')[0];

                // 1. Poll Endpoint: GET /api/test/eval/poll
                if (fullPath === '/api/test/eval/poll') {
                    if (req.method === 'GET') {
                        const item = evalQueue.shift();
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ item: item || null }));
                        return;
                    }
                }

                // 2. Result Endpoint: POST /api/test/eval/result
                else if (fullPath === '/api/test/eval/result') {
                    if (req.method === 'POST') {
                        let body = '';
                        req.on('data', chunk => body += chunk.toString());
                        req.on('end', () => {
                            try {
                                const { evalId, result, error } = JSON.parse(body);
                                console.log(`[Eval] Result (${evalId}):`, result || error);
                                evalResults.set(evalId, error ? { error } : { value: result });
                                res.end(JSON.stringify({ success: true }));
                            } catch (e) {
                                res.statusCode = 400;
                                res.end(JSON.stringify({ error: e.message }));
                            }
                        });
                        return;
                    }
                }

                // 3. Main Eval Endpoint: POST /api/test/eval (Queue) or GET (Check Result)
                else if (fullPath === '/api/test/eval') {
                    if (req.method === 'POST') {
                        let body = '';
                        req.on('data', chunk => body += chunk.toString());
                        req.on('end', () => {
                            try {
                                const { code } = JSON.parse(body);
                                const evalId = Date.now().toString();
                                evalQueue.push({ evalId, code });
                                console.log(`[Eval] Queued: ${code}`);
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ success: true, evalId }));
                            } catch (e) {
                                res.statusCode = 400;
                                res.end(JSON.stringify({ error: e.message }));
                            }
                        });
                        return;
                    } else if (req.method === 'GET') {
                        const url = new URL(req.url, 'http://localhost');
                        const evalId = url.searchParams.get('evalId');
                        if (evalId && evalResults.has(evalId)) {
                            const result = evalResults.get(evalId);
                            evalResults.delete(evalId); // One-time read
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ status: 'completed', result }));
                        } else {
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ status: 'pending' }));
                        }
                        return;
                    }
                }

                // If no match, continue
                next();
            });
        }
    };
}

async function executeTaskWithStreaming(taskId, userRequest, contextFiles, playerTransform) {
    updateTaskLogs(taskId, `[SDK] Starting task: ${userRequest}\n`);

    try {
        // 1. Gather Context
        updateTaskLogs(taskId, `[SDK] Gathering context from ${contextFiles.length} files...\n`);
        let contextText = '';
        for (const file of contextFiles) {
            try {
                const content = await fs.readFile(path.join(process.cwd(), file), 'utf-8');
                contextText += `\n--- FILE: ${file} ---\n${content}\n`;
            } catch (e) {
                updateTaskLogs(taskId, `[SDK] Warning: Could not read context file ${file}: ${e.message}\n`);
            }
        }

        // 2. Initialize Model with Tools
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            tools: [{
                functionDeclarations: [
                    {
                        name: "edit_file",
                        description: "Edits a file by replacing its entire content with new content. Use this to create new files or modify existing ones.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                filePath: { type: "STRING", description: "Path to the file relative to project root" },
                                newContent: { type: "STRING", description: "The full new content for the file" },
                                reason: { type: "STRING", description: "Brief explanation of the change" }
                            },
                            required: ["filePath", "newContent"]
                        }
                    },
                    {
                        name: "spawn_creature",
                        description: "Spawns a creature in the game world near the player. Use this AFTER creating a new creature to test it, or to spawn existing creatures.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                creature: { type: "STRING", description: "Name of the creature to spawn (e.g., 'Horse', 'YellowDuck', 'Pig')" },
                                count: { type: "NUMBER", description: "Number of creatures to spawn (default 1, max 10)" }
                            },
                            required: ["creature"]
                        }
                    }
                ]
            }],
            // Force the model to use tools when needed
            toolConfig: {
                functionCallingConfig: {
                    mode: "AUTO"
                }
            }
        });

        // 3. Build initial prompt
        let transformText = '';
        if (playerTransform) {
            const { position, rotation } = playerTransform;
            transformText = `\nPLAYER CURRENT STATE:
Position: x=${position.x.toFixed(2)}, y=${position.y.toFixed(2)}, z=${position.z.toFixed(2)}
Orientation: pitch=${rotation.x.toFixed(2)}, yaw=${rotation.y.toFixed(2)}\n`;
        }

        const systemPrompt = `You are a coding assistant. The user wants to modify their Minecraft-like voxel game.
USER REQUEST: ${userRequest}
${transformText}
CONTEXT FILES:
${contextText}

CRITICAL INSTRUCTIONS FOR CREATURE CREATION:

**YOU MUST MAKE TWO SEPARATE edit_file CALLS IN THIS ORDER:**

1. FIRST edit_file: Create the creature file at src/game/entities/animals/[CreatureName].js
   - Import Animal from '../Animal.js' (NOT './Animal.js')
   - Class must extend Animal
   - Constructor calls super(game, x, y, z), sets this.width/height/depth, calls this.createBody(), sets this.mesh.scale
   - createBody() adds meshes directly to this.mesh using this.mesh.add(mesh)
   - Do NOT return anything from createBody()
   - Use THREE.BoxGeometry and THREE.MeshLambertMaterial for blocky voxel style
   - See Horse.js in the context for the correct pattern

2. SECOND edit_file: Update src/game/AnimalRegistry.js
   - APPEND new import at the end of the import block (after the last existing import)
   - APPEND new class name to BOTH the export block AND the AnimalClasses object
   - DO NOT REMOVE existing imports/exports - only ADD to them!

IMPORTANT: You MUST call edit_file for the creature file FIRST, then for the registry SECOND.
Provide the FULL content of files in 'newContent' - do NOT abbreviate.
After ALL edits are complete, provide a summary of what you did.`;

        updateTaskLogs(taskId, `[SDK] Starting agentic loop...\n`);

        let contents = [{ role: 'user', parts: [{ text: systemPrompt }] }];
        let iteration = 0;
        const maxIterations = 10; // Safety limit
        let totalEdits = 0;

        while (iteration < maxIterations) {
            // Check cancellation
            if (tasks.get(taskId)?.isCancelled) {
                updateTaskLogs(taskId, `\n[SDK] ⚠ Task Cancelled by user.\n`);
                tasks.set(taskId, { ...tasks.get(taskId), status: 'cancelled' });
                return;
            }

            iteration++;
            updateTaskLogs(taskId, `\n[SDK] Loop iteration ${iteration}...\n`);

            // Call the model
            const result = await model.generateContent({ contents });
            const response = result.response;

            // Get function calls from the response
            const functionCalls = response.functionCalls();

            if (functionCalls && functionCalls.length > 0) {
                updateTaskLogs(taskId, `[SDK] Model requested ${functionCalls.length} function call(s)\n`);

                // Process each function call
                for (const call of functionCalls) {
                    if (call.name === 'edit_file') {
                        const { filePath, newContent, reason } = call.args;
                        console.log('[GodMode DEBUG] edit_file call:', { filePath, reason, contentLength: newContent?.length });

                        let callResult = { success: false, message: '' };

                        try {
                            // Validate path for security
                            validateFilePath(filePath);

                            updateTaskLogs(taskId, `[SDK] Writing to ${filePath}${reason ? ` (${reason})` : ''}...\n`);

                            const absolutePath = path.join(process.cwd(), filePath);

                            // Ensure directory exists
                            await fs.mkdir(path.dirname(absolutePath), { recursive: true });

                            await fs.writeFile(absolutePath, newContent);
                            updateTaskLogs(taskId, `[SDK] ✓ Successfully updated ${filePath}\n`);
                            callResult = { success: true, message: `File ${filePath} updated successfully` };
                            totalEdits++;
                        } catch (e) {
                            updateTaskLogs(taskId, `[SDK] ✗ Failed to write ${filePath}: ${e.message}\n`);
                            callResult = { success: false, message: `Failed to write ${filePath}: ${e.message}` };
                        }

                        // Add the model's function call to the conversation
                        contents.push({
                            role: 'model',
                            parts: [{ functionCall: call }]
                        });

                        // Add the function result to the conversation
                        contents.push({
                            role: 'user',
                            parts: [{
                                functionResponse: {
                                    name: call.name,
                                    response: { result: callResult }
                                }
                            }]
                        });
                    } else if (call.name === 'spawn_creature') {
                        const { creature, count = 1 } = call.args;
                        const spawnCount = Math.min(10, Math.max(1, count));

                        console.log('[GodMode DEBUG] spawn_creature call:', { creature, count: spawnCount });
                        updateTaskLogs(taskId, `[SDK] Queueing spawn: ${spawnCount}x ${creature}...\n`);

                        // Add to spawn queue for client to poll
                        spawnQueue.push({
                            creature,
                            count: spawnCount,
                            timestamp: Date.now(),
                            position: playerTransform?.position || { x: 0, y: 10, z: 0 }
                        });

                        const callResult = {
                            success: true,
                            message: `Queued ${spawnCount}x ${creature} for spawning. Client will spawn them shortly.`
                        };
                        updateTaskLogs(taskId, `[SDK] ✓ Spawn queued: ${spawnCount}x ${creature}\n`);

                        // Add the model's function call to the conversation
                        contents.push({
                            role: 'model',
                            parts: [{ functionCall: call }]
                        });

                        // Add the function result to the conversation
                        contents.push({
                            role: 'user',
                            parts: [{
                                functionResponse: {
                                    name: call.name,
                                    response: { result: callResult }
                                }
                            }]
                        });
                    }
                }
            } else {
                // No more function calls - model returned text, we're done!
                const finalText = response.text();
                if (finalText) {
                    updateTaskLogs(taskId, `\n[SDK] Model response:\n${finalText}\n`);
                }
                break;
            }
        }

        if (iteration >= maxIterations) {
            updateTaskLogs(taskId, `\n[SDK] Warning: Reached maximum iterations (${maxIterations})\n`);
        }

        updateTaskLogs(taskId, `\n[SDK] Task Completed. Total edits: ${totalEdits}\n`);
        tasks.set(taskId, { ...tasks.get(taskId), status: 'completed' });

    } catch (error) {
        console.error(`[GodMode] Task ${taskId} Failed:`, error);
        updateTaskLogs(taskId, `\n[SDK] ERROR: ${error.message}\n`);
        tasks.set(taskId, { ...tasks.get(taskId), status: 'failed', error: error.message });
    }
}

function updateTaskLogs(taskId, message) {
    const task = tasks.get(taskId);
    if (task) {
        const newLogs = (task.logs || '') + message;
        tasks.set(taskId, { ...task, logs: newLogs });
    }
}
