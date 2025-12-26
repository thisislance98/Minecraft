import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tasks = new Map();

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

            server.middlewares.use('/api/god-mode/chat', async (req, res, next) => {
                if (req.method !== 'POST') return next();

                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const { message, playerTransform } = JSON.parse(body);
                        console.log('[GodMode] Received request:', message);

                        const taskId = Date.now().toString();
                        tasks.set(taskId, { status: 'pending', taskId, logs: '', startTime: Date.now() });

                        if (!genAI) {
                            tasks.set(taskId, { status: 'failed', error: 'GEMINI_API_KEY not found in .env' });
                            return;
                        }

                        // Context Gathering - include example creature and registry
                        const contextFiles = [
                            'src/game/Player.js',
                            'src/game/VoxelGame.jsx',
                            'src/game/entities/Animal.js',
                            'src/game/entities/animals/Horse.js',  // Example creature
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
            model: "gemini-2.5-flash-preview-05-20",
            tools: [{
                functionDeclarations: [{
                    name: "edit_file",
                    description: "Edits a file by replacing its entire content with new content.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            filePath: { type: "STRING", description: "Path to the file relative to project root" },
                            newContent: { type: "STRING", description: "The full new content for the file" },
                            reason: { type: "STRING", description: "Brief explanation of the change" }
                        },
                        required: ["filePath", "newContent"]
                    }
                }]
            }]
        });

        // 3. Build prompt
        let transformText = '';
        if (playerTransform) {
            const { position, rotation } = playerTransform;
            transformText = `\nPLAYER CURRENT STATE:
Position: x=${position.x.toFixed(2)}, y=${position.y.toFixed(2)}, z=${position.z.toFixed(2)}
Orientation: pitch=${rotation.x.toFixed(2)}, yaw=${rotation.y.toFixed(2)}\n`;
        }

        const prompt = `You are a coding assistant. The user wants to modify their Minecraft-like voxel game.
USER REQUEST: ${userRequest}
${transformText}
CONTEXT FILES:
${contextText}

CRITICAL INSTRUCTIONS:

1. CREATURE CREATION PATTERN:
   - New creatures go in: src/game/entities/animals/[CreatureName].js
   - Import Animal from '../Animal.js' (NOT './Animal.js')
   - Class must extend Animal
   - Constructor calls super(game, x, y, z), sets dimensions, calls this.createBody(), sets scale
   - createBody() adds meshes directly to this.mesh using this.mesh.add(mesh)
   - Do NOT return anything from createBody()
   - Use THREE.BoxGeometry and THREE.MeshLambertMaterial for blocky voxel style
   - See Horse.js in the context for the correct pattern

2. REGISTRY UPDATES (AnimalRegistry.js):
   - APPEND new imports at the end of the import block (after Robot import)
   - APPEND new class names to the export block and AnimalClasses object
   - DO NOT REMOVE OR REWRITE existing imports/exports - only ADD to them!

3. GENERAL:
   - Provide the FULL content of files in 'newContent'
   - Do NOT abbreviate or skip any code
   - After editing, summarize what you did`;

        // 4. Use streaming to get real-time text output
        updateTaskLogs(taskId, `[SDK] Calling Gemini 2.5 Flash with streaming...\n`);

        const result = await model.generateContentStream(prompt);

        let fullText = '';
        let functionCalls = [];

        // Stream the response
        for await (const chunk of result.stream) {
            // Check for text content
            const chunkText = chunk.text();
            if (chunkText) {
                fullText += chunkText;
                // Stream text to logs in real-time
                updateTaskLogs(taskId, chunkText);
            }

            // Check for function calls in the chunk
            const candidates = chunk.candidates;
            if (candidates) {
                for (const candidate of candidates) {
                    if (candidate.content?.parts) {
                        for (const part of candidate.content.parts) {
                            if (part.functionCall) {
                                functionCalls.push(part.functionCall);
                            }
                        }
                    }
                }
            }
        }

        // Also check the final aggregated response for function calls
        const response = await result.response;
        const responseFunctionCalls = response.functionCalls();
        if (responseFunctionCalls && responseFunctionCalls.length > 0) {
            functionCalls = responseFunctionCalls;
        }

        // 5. Execute any function calls
        if (functionCalls.length > 0) {
            updateTaskLogs(taskId, `\n\n[SDK] Executing ${functionCalls.length} file edit(s)...\n`);

            for (const call of functionCalls) {
                if (call.name === 'edit_file') {
                    const { filePath, newContent, reason } = call.args;

                    try {
                        // Validate path for security
                        validateFilePath(filePath);

                        updateTaskLogs(taskId, `[SDK] Writing to ${filePath}${reason ? ` (${reason})` : ''}...\n`);

                        const absolutePath = path.join(process.cwd(), filePath);

                        // Ensure directory exists
                        await fs.mkdir(path.dirname(absolutePath), { recursive: true });

                        await fs.writeFile(absolutePath, newContent);
                        updateTaskLogs(taskId, `[SDK] ✓ Successfully updated ${filePath}\n`);
                    } catch (e) {
                        updateTaskLogs(taskId, `[SDK] ✗ Failed to write ${filePath}: ${e.message}\n`);
                    }
                }
            }

            updateTaskLogs(taskId, `\n[SDK] Task Completed Successfully.\n`);
            tasks.set(taskId, { ...tasks.get(taskId), status: 'completed' });
        } else {
            // No tool calls, just text response
            updateTaskLogs(taskId, `\n[SDK] No file edits requested. Task completed.\n`);
            tasks.set(taskId, { ...tasks.get(taskId), status: 'completed', message: fullText });
        }

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
