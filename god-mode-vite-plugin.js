
import { WebSocketServer } from 'ws';
import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAntigravitySystemPrompt } from './src/game/ai/antigravity_prompt.js';
import { getAntigravityTools } from './src/game/ai/antigravity_tools.js';
import { spawn } from 'child_process';

dotenv.config();

const PENDING_TOOL_CALLS = new Map(); // id -> { resolve, reject }


class AntigravitySession {
    constructor(ws, apiKey) {
        this.ws = ws;
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: "gemini-3-flash-preview",
            tools: getAntigravityTools(),
            systemInstruction: getAntigravitySystemPrompt()
        });

        // Manual content management (not using chat API)
        this.contents = [];

        this.init();
    }

    init() {
        this.ws.on('message', async (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'input') {
                    await this.handleInput(msg.text, msg.context);
                } else if (msg.type === 'tool_response') {
                    this.handleToolResponse(msg.id, msg.result, msg.error);
                }
            } catch (e) {
                console.error('Error handling message:', e);
                this.sendError(e.message);
            }
        });
    }



    send(type, payload) {
        if (this.ws.readyState === 1) { // OPEN
            this.ws.send(JSON.stringify({ type, ...payload }));
        }
    }

    sendError(message) {
        this.send('error', { message });
    }

    async handleInput(text, context) {
        const contextStr = context ? `\n[Context: ${JSON.stringify(context)}]` : '';
        const fullMessage = text + contextStr;

        // Add user message to contents
        this.contents.push({
            role: 'user',
            parts: [{ text: fullMessage }]
        });

        try {
            await this.generateAndProcess();
        } catch (e) {
            console.error("Gemini Error:", e);
            this.sendError("AI Error: " + e.message);
        }
    }



    async generateAndProcess() {
        console.log('[Antigravity] Starting generation with thinking config...');
        try {
            const request = {
                contents: this.contents,
                generationConfig: {}
            };
            const result = await this.model.generateContentStream(request);

            let accumulatedText = '';
            const capturedSignatures = [];

            // console.log('[Antigravity] Stream started.');

            for await (const chunk of result.stream) {
                // console.log('[Antigravity] Chunk:', JSON.stringify(chunk, null, 2));
                if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
                    const parts = chunk.candidates[0].content.parts;
                    for (const part of parts) {
                        if (part.thoughtSignature) {
                            capturedSignatures.push(part.thoughtSignature);
                        }
                        if (part.thought) {
                            // console.log('[Antigravity] Thought received:', part.text.substring(0, 50) + '...');
                            this.send('thought', { text: part.text });
                        } else if (part.text) {
                            accumulatedText += part.text;
                            this.send('token', { text: part.text });
                        }
                    }
                }
            }
            // console.log('[Antigravity] Stream finished.');

            const response = await result.response;
            const content = response.candidates[0].content;

            // Patch signatures back into function calls
            if (content.parts && capturedSignatures.length > 0) {
                let sigIndex = 0;
                for (const part of content.parts) {
                    if (part.functionCall) {
                        part.thoughtSignature = capturedSignatures[sigIndex++];
                    }
                }
            }

            this.contents.push(content);

            const toolCalls = response.functionCalls();
            if (toolCalls && toolCalls.length > 0) {
                console.log('[Antigravity] Tool calls detected:', toolCalls.length);
                await this.executeTools(toolCalls);
            }
        } catch (e) {
            console.error("[Antigravity] Stream Error FULL:", e);
            this.sendError("Stream Error: " + e.message);
        }
    }

    async executeTools(toolCalls) {
        const functionResponseParts = [];

        for (const call of toolCalls) {
            const { name, args } = call;
            let result;

            // Notify client of tool usage
            this.send('tool_start', { name, args });

            try {
                if (this.isServerTool(name)) {
                    result = await this.executeServerTool(name, args);
                } else if (this.isClientTool(name)) {
                    result = await this.executeClientTool(name, args);
                } else {
                    result = { error: `Unknown tool ${name}` };
                }
            } catch (e) {
                result = { error: e.message };
            }

            // Build function response part per official docs pattern
            functionResponseParts.push({
                functionResponse: {
                    name: name,
                    response: (typeof result === 'object' && result !== null) ? result : { result: result }
                }
            });

            this.send('tool_end', { name, result });
        }

        // Append function responses as a USER message
        this.contents.push({
            role: 'user',
            parts: functionResponseParts
        });

        // Call model again with updated contents
        await this.generateAndProcess();
    }

    isServerTool(name) {
        return ['view_file', 'list_dir', 'write_to_file', 'replace_file_content'].includes(name);
    }

    isClientTool(name) {
        return ['spawn_creature', 'teleport_player', 'get_scene_info'].includes(name);
    }

    // SERVER TOOL EXECUTORS
    async executeServerTool(name, args) {
        const cwd = process.cwd();

        switch (name) {
            case 'list_dir': {
                const targetPath = path.resolve(cwd, args.DirectoryPath || '.');
                if (!targetPath.startsWith(cwd)) throw new Error("Access Denied");
                const files = await fs.readdir(targetPath, { withFileTypes: true });
                return { files: files.slice(0, 50).map(f => ({ name: f.name, isDir: f.isDirectory() })) };
            }
            case 'view_file': {
                const targetPath = path.resolve(cwd, args.AbsolutePath);
                if (!targetPath.startsWith(cwd)) throw new Error("Access Denied");
                const content = await fs.readFile(targetPath, 'utf8');
                return { content: content.slice(0, 10000) };
            }
            case 'write_to_file': {
                const targetPath = path.resolve(cwd, args.TargetFile);
                if (!targetPath.startsWith(cwd)) throw new Error("Access Denied");
                await fs.mkdir(path.dirname(targetPath), { recursive: true });
                await fs.writeFile(targetPath, args.CodeContent);
                return { success: true, path: args.TargetFile };
            }
            case 'replace_file_content': {
                const targetPath = path.resolve(cwd, args.TargetFile);
                if (!targetPath.startsWith(cwd)) throw new Error("Access Denied");
                const content = await fs.readFile(targetPath, 'utf8');
                const newContent = content.replace(args.TargetContent, args.ReplacementContent);
                if (newContent === content) return { error: "Target content not found" };
                await fs.writeFile(targetPath, newContent);
                return { success: true };
            }
        }
    }

    // CLIENT TOOL EXECUTOR
    async executeClientTool(name, args) {
        return new Promise((resolve, reject) => {
            const callId = Math.random().toString(36).substring(7);
            PENDING_TOOL_CALLS.set(callId, { resolve, reject });

            this.send('tool_request', {
                id: callId,
                name,
                args
            });

            // Timeout after 30s
            setTimeout(() => {
                if (PENDING_TOOL_CALLS.has(callId)) {
                    PENDING_TOOL_CALLS.delete(callId);
                    resolve({ error: "Client timed out" });
                }
            }, 30000);
        });
    }

    handleToolResponse(id, result, error) {
        const pending = PENDING_TOOL_CALLS.get(id);
        if (pending) {
            PENDING_TOOL_CALLS.delete(id);
            if (error) pending.resolve({ error });
            else pending.resolve(result);
        }
    }
}

export default function GodModePlugin() {
    return {
        name: 'god-mode-antigravity',
        configureServer(server) {
            // Middleware for body parsing simple JSON
            const parseBody = (req) => new Promise((resolve) => {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    try { resolve(JSON.parse(body)); } catch { resolve({}); }
                });
            });

            // In-memory queues
            const chatQueue = [];
            const spawnQueue = [];
            const evalQueue = [];

            // 1. Chat Test Endpoints
            server.middlewares.use('/api/chat-test/poll', (req, res, next) => {
                if (req.method === 'GET') {
                    const prompt = chatQueue.shift() || null;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ prompt }));
                    return;
                }
                next();
            });

            server.middlewares.use('/api/chat-test/push', async (req, res, next) => {
                if (req.method === 'POST') {
                    const body = await parseBody(req);
                    const testId = Date.now().toString();
                    chatQueue.push({ testId, message: body.message });
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ testId, status: 'queued' }));
                    return;
                }
                next();
            });

            server.middlewares.use('/api/chat-test/response', async (req, res, next) => {
                if (req.method === 'POST') {
                    const body = await parseBody(req);
                    console.log('[Antigravity] Chat Response:', body);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ status: 'ok' }));
                    return;
                }
                next();
            });

            // 2. God Mode Spawns
            server.middlewares.use('/api/god-mode/spawns', async (req, res, next) => {
                if (req.method === 'GET') {
                    const spawns = spawnQueue.splice(0, spawnQueue.length);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ spawns }));
                    return;
                }
                if (req.method === 'POST') {
                    const body = await parseBody(req);
                    spawnQueue.push(body);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ status: 'queued' }));
                    return;
                }
                next();
            });

            // 3. Eval Test
            server.middlewares.use('/api/test/eval/poll', (req, res, next) => {
                if (req.method === 'GET') {
                    const item = evalQueue.shift() || null;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ item }));
                    return;
                }
                next();
            });

            server.middlewares.use('/api/test/eval/push', async (req, res, next) => {
                if (req.method === 'POST') {
                    const body = await parseBody(req);
                    const evalId = Date.now().toString();
                    evalQueue.push({ evalId, code: body.code });
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ evalId, status: 'queued' }));
                    return;
                }
                next();
            });

            server.middlewares.use('/api/test/eval/result', async (req, res, next) => {
                if (req.method === 'POST') {
                    const body = await parseBody(req);
                    console.log('[Antigravity] Eval Result:', body);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ status: 'ok' }));
                    return;
                }
                next();
            });

            // API Key endpoint
            server.middlewares.use('/api/god-mode/config', (req, res, next) => {
                if (req.method === 'GET') {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ apiKey: process.env.GEMINI_API_KEY }));
                    return;
                }
                next();
            });

            const wss = new WebSocketServer({ noServer: true });

            server.httpServer.on('upgrade', (req, socket, head) => {
                if (req.url === '/api/antigravity') {
                    wss.handleUpgrade(req, socket, head, (ws) => {
                        wss.emit('connection', ws, req);
                    });
                }
            });

            wss.on('connection', (ws) => {
                console.log('[Antigravity] Connection established');
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: 'No API Key' } }));
                    ws.close();
                    return;
                }
                new AntigravitySession(ws, apiKey);
            });
        }
    };
}
